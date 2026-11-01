#!/usr/bin/env python3
"""Index all 8 × 73 design states; compare unchanged references with genuine native captures."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import struct
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[2]


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image_info(path: Path) -> tuple[str, list[int]]:
    with path.open("rb") as stream:
        header = stream.read(24)
        if header[:8] == b"\x89PNG\r\n\x1a\n" and len(header) == 24:
            return "PNG", list(struct.unpack(">II", header[16:24]))
        if header[:2] == b"\xff\xd8":
            stream.seek(2)
            while stream.read(1) == b"\xff":
                marker = stream.read(1)
                while marker == b"\xff":
                    marker = stream.read(1)
                if not marker or marker[0] in {0xD9, 0xDA}:
                    break
                if marker[0] == 0x01 or 0xD0 <= marker[0] <= 0xD7:
                    continue
                size = stream.read(2)
                if len(size) != 2:
                    break
                length = struct.unpack(">H", size)[0]
                if length < 2:
                    break
                if marker[0] in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                    frame = stream.read(5)
                    if len(frame) == 5:
                        height, width = struct.unpack(">HH", frame[1:])
                        return "JPEG", [width, height]
                    break
                stream.seek(length - 2, 1)
    raise ValueError(f"Unreadable PNG/JPEG dimensions: {path}")


def build(records: list[dict], output: Path, specifications: list[dict] | None = None) -> list[dict]:
    manifest = json.loads((ROOT / "design/exports/manifest.json").read_text())
    styles = {row["id"]: row for row in json.loads((ROOT / "design/source/styles.json").read_text())}
    if len(manifest["files"]) != 584:
        raise ValueError("Design index changed; review baseline before replacing 584-state matrix")
    entries, known = [], set()
    mappings = {}
    for mapping in specifications or []:
        required = {"id", "cases", "requirements", "artifacts", "method", "observed", "limitations"}
        if missing := required - mapping.keys():
            raise ValueError(f"Specification mapping missing: {sorted(missing)}")
        if not mapping["artifacts"]:
            raise ValueError(f"Specification mapping requires evidence: {mapping['id']}")
        for artifact in mapping["artifacts"]:
            if not (ROOT / artifact).is_file():
                raise ValueError(f"Missing specification artifact: {artifact}")
        for case in mapping["cases"]:
            if not case.split("/")[-1].startswith("H") or case in mappings:
                raise ValueError(f"Invalid or duplicate specification case: {case}")
            mappings[case] = mapping
    for reference in manifest["files"]:
        key = f"{reference['style']}/{reference['id']}"
        known.add(key)
        reference_path = ROOT / "design/exports" / reference["file"]
        style = styles[reference["style"]]
        scope = "design-specification" if reference["id"].startswith("H") else "deferred-platform" if reference["id"] == "G07" else "macOS-product"
        row = {**reference, "case": key, "scope": scope, "status": "unverified", "captures": [],
               "reference_sha256": digest(reference_path), "reference_pixels": image_info(reference_path)[1],
               "reference_url": quote(os.path.relpath(reference_path, output)),
               "expected": {"viewport": [reference["width"], reference["height"]], "zoom": 1,
                            "theme": "dark" if reference["id"] == "G05" else style["theme"], "density": style["density"]}}
        if scope == "design-specification":
            row["status"] = "specification-mapping-required"
            if key in mappings:
                row["specification_mapping"] = mappings[key]
                row["status"] = "specification-mapped"
        elif scope == "deferred-platform":
            row["status"] = "platform-not-tested"
        for record in [r for r in records if r.get("case") == key]:
            required = {"case", "screenshot", "capture_method", "app_build", "platform", "viewport", "pixel_ratio", "zoom",
                        "theme", "density", "state", "actions", "review", "differences", "captured_at"}
            if missing := required - record.keys():
                raise ValueError(f"{key} capture missing: {sorted(missing)}")
            if record["capture_method"] not in {"computer-use-native", "screencapture-window", "screencapture-region", "native-ax"}:
                raise ValueError(f"{key}: prototype/browser/evaluate screenshots cannot serve as native visual evidence")
            path = Path(record["screenshot"])
            if not path.is_absolute():
                path = ROOT / path
            if not path.exists():
                raise ValueError(f"Missing screenshot: {path}")
            if path.is_relative_to(ROOT / "design"):
                raise ValueError(f"Reference/prototype image supplied as native evidence: {path}")
            if record["review"] not in {"unreviewed", "pass", "differences", "blocked"}:
                raise ValueError(f"Unknown review state: {record['review']}")
            image_format, dimensions = image_info(path)
            expected_pixels = [round(x * record["pixel_ratio"]) for x in record["viewport"]]
            condition_mismatches = record.get("condition_mismatches", [])
            if not isinstance(condition_mismatches, list) or any(
                not isinstance(mismatch, dict) or any(
                    not isinstance(mismatch.get(field), str) or not mismatch[field].strip()
                    for field in ["kind", "actual", "reference", "observation"]
                ) for mismatch in condition_mismatches
            ):
                raise ValueError(f"{key}: condition mismatches require kind, actual, reference and observation")
            comparable = (record["viewport"] == row["expected"]["viewport"] and dimensions == expected_pixels
                          and all(record[field] == row["expected"][field] for field in ["theme", "density", "zoom"])
                          and not condition_mismatches)
            for difference in record["differences"]:
                if difference.get("status") == "accepted" and any(
                    not isinstance(difference.get(field), str) or not difference[field].strip()
                    for field in ["reason", "observation"]
                ):
                    raise ValueError(f"{key}: accepted difference requires reason and observation")
            if record["review"] == "pass" and (not comparable or any(d.get("status") not in {"resolved", "accepted"} for d in record["differences"])):
                raise ValueError(f"{key}: cannot pass with mismatched conditions or unresolved differences")
            row["captures"].append({**record, "sha256": digest(path), "image_format": image_format,
                                    "pixels": dimensions, "comparable": comparable,
                                    "url": quote(os.path.relpath(path, output))})
        if row["captures"]:
            latest = row["captures"][-1]
            row["status"] = "verified" if latest["review"] == "pass" else "differences" if latest["review"] == "differences" else "captured-unreviewed"
            if not latest["comparable"]:
                row["status"] = "conditions-mismatch"
        entries.append(row)
    unknown = ({r.get("case") for r in records} | mappings.keys()) - known
    if unknown:
        raise ValueError(f"Unknown visual cases: {sorted(unknown)}")
    return entries


def report(entries: list[dict]) -> str:
    data = json.dumps(entries, ensure_ascii=False).replace("</", "<\\/")
    return """<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Horizon · 原生 UI 对照</title>
<style>*{box-sizing:border-box}body{margin:0;background:#f1f4f7;color:#17273d;font:14px system-ui}header{padding:18px 24px;background:white;border-bottom:1px solid #ccd6e0}h1{font-size:20px;margin:0 0 8px}p{margin:6px 0}main{display:grid;grid-template-columns:300px minmax(0,1fr);height:calc(100vh - 134px)}aside{overflow:auto;padding:12px;border-right:1px solid #ccd6e0}button,select,input{font:inherit;padding:7px;margin:3px;border:1px solid #bbc7d6;border-radius:5px;background:white}aside button{display:block;width:100%;text-align:left}.selected{background:#d9e7ff}article{overflow:auto;padding:18px}.toolbar{position:sticky;top:0;background:#f1f4f7;padding-bottom:8px;z-index:2}.pair{display:flex;gap:16px;overflow:auto;align-items:flex-start}.frame{flex:none;position:relative;background:white;border:1px solid #acb8ca}.frame img{display:block;width:var(--image-width);height:auto}.frame label{display:block;padding:8px;background:#e6ecf4}.overlay img:last-child{position:absolute;left:0;top:0;opacity:var(--opacity,.5)}.overlay{position:relative}.warning{color:#b32929}.empty{border:2px dashed #9aa9bb;min-height:240px;padding:30px}pre{white-space:pre-wrap;font:12px ui-monospace}#counts{color:#5e6d80}</style>
<header><h1>Horizon · 设计与真实 macOS 应用对照</h1><p>原图与实机图保持原始字节；只在浏览器中并排或透明叠加。没有实机图的场景保持未证实。</p><p id="counts"></p></header>
<main><aside><select id="style"><option value="">全部布局</option></select><select id="status"><option value="">全部状态</option></select><input id="query" placeholder="页面编号或名称"><div id="list"></div></aside><article><div id="details"></div></article></main>
<script>const rows=__DATA__;let selected=rows[0].case;const $=id=>document.getElementById(id);const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const [id,name] of new Map(rows.map(r=>[r.style,r.styleName])))$('style').add(new Option(name,id));for(const s of new Set(rows.map(r=>r.status)))$('status').add(new Option(s,s));$('counts').textContent=`${rows.length} 个索引 · ${rows.filter(r=>r.scope==='macOS-product').length} 个 macOS 产品状态 · ${rows.filter(r=>r.status==='verified').length} 个视觉通过`;
function list(){const visible=rows.filter(r=>(!$('style').value||r.style===$('style').value)&&(!$('status').value||r.status===$('status').value)&&(`${r.id} ${r.title}`.includes($('query').value)));$('list').innerHTML=visible.map(r=>`<button class="${selected===r.case?'selected':''}" data-case="${r.case}">${r.styleName} · ${r.id} ${r.title}<br><small>${r.status}</small></button>`).join('');$('list').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.case;list();show()})}
function show(){const r=rows.find(x=>x.case===selected),c=r.captures.at(-1);$('details').innerHTML=`<div class="toolbar"><h1>${esc(r.styleName)} · ${r.id} ${esc(r.title)}</h1><p>${esc(r.status)} · ${esc(r.scope)}</p><p>基准 ${r.expected.viewport.join(' × ')} · ${esc(r.expected.theme)} · ${esc(r.expected.density)} · zoom ${r.expected.zoom}</p><button id="mode">切换并排 / 叠加</button><label>显示宽度 <select id="scale"><option value="640">640px</option><option value="${r.width}">原逻辑尺寸</option></select></label><label>叠加透明度 <input id="opacity" type="range" min="0" max="1" step=".05" value=".5"></label></div><div id="images"></div><h3>状态与差异</h3><pre>${esc(JSON.stringify(c??r.specification_mapping??{note:r.note,status:'没有真实 macOS 截图；未验收'},null,2))}</pre>`;let overlay=false;function images(){const w=$('scale').value;const ref=`<img src="${r.reference_url}" alt="原设计">`,native=c?`<img src="${c.url}" alt="真实macOS应用">`:'';$('images').innerHTML=c?(overlay?`<div class="frame overlay" style="--image-width:${w}px;--opacity:${$('opacity').value}">${ref}${native}</div>`:`<div class="pair"><div class="frame" style="--image-width:${w}px"><label>原设计</label>${ref}</div><div class="frame" style="--image-width:${w}px"><label>真实 macOS ${c.comparable?'条件一致':'条件不匹配'}</label>${native}</div></div>`):`<div class="pair"><div class="frame" style="--image-width:${w}px"><label>原设计</label>${ref}</div><div class="empty">${r.specification_mapping?'设计规范映射已核对；非应用页面截图':'等待真实 macOS 截图'}</div></div>`;}$('mode').onclick=()=>{overlay=!overlay;images()};$('scale').onchange=images;$('opacity').oninput=images;images()}
['style','status','query'].forEach(id=>$(id).oninput=list);list();show();</script></html>""".replace("__DATA__", data)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--records", type=Path, default=ROOT / "docs/verification/visual-records.json")
    parser.add_argument("--specifications", type=Path, default=ROOT / "docs/verification/specification-records.json")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/verification")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    records = json.loads(args.records.read_text()) if args.records.exists() else []
    specifications = json.loads(args.specifications.read_text()) if args.specifications.exists() else []
    rows = build(records, args.output, specifications)
    counts = Counter(row["status"] for row in rows)
    lines = ["# 真实 macOS 视觉验收索引", "", "584 个索引全部保留。536 个 macOS 产品页面/状态待真实截图；40 个 H 组规范页映射实际组件行为；8 个 G07 为未测平台。",
             "原设计不改写；实机截图保留哈希及采集条件。视觉判断由人工完成，脚本只校验条件和证据。", "",
             "对照入口：[visual-report.html](visual-report.html)。记录来源：[visual-records.json](visual-records.json)。", "",
             "| 布局 / 页面 | 场景 | 范围 | 状态 | 实机 / 规范证据 |", "| --- | --- | --- | --- | --- |"]
    for row in rows:
        captures = "、".join(capture["screenshot"] for capture in row["captures"])
        if not captures:
            captures = "、".join(row.get("specification_mapping", {}).get("artifacts", [])) or "—"
        lines.append(f"| {row['styleName']} / {row['id']} | {row['title']} | {row['scope']} | {row['status']} | {captures} |")
    outputs = {"VISUAL_MATRIX.md": "\n".join(lines) + "\n", "visual-matrix.json": json.dumps(rows, ensure_ascii=False, indent=2) + "\n",
               "visual-report.html": report(rows)}
    for name, text in outputs.items():
        path = args.output / name
        if args.check:
            if not path.exists() or path.read_text() != text:
                raise SystemExit(f"Stale visual matrix: {path}")
        else:
            args.output.mkdir(parents=True, exist_ok=True)
            path.write_text(text)
    print(json.dumps({"indexed": len(rows), "records": len(records), "states": dict(counts), "checked": args.check}))


if __name__ == "__main__":
    main()
