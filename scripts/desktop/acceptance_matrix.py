#!/usr/bin/env python3
"""Build/check the 104 requirement + 39 task macOS evidence matrix from canonical documents."""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
STATUSES = {"unverified": "未证实", "partial": "部分证实", "verified": "已证实", "failed": "失败", "limited": "受限"}


def canonical() -> tuple[list[dict], list[dict]]:
    requirements = []
    for line in (ROOT / "docs/product/REQUIREMENTS.md").read_text().splitlines():
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) >= 7 and re.fullmatch(r"REQ-[A-Z]+-\d{3}", cells[0]) and cells[3] == "v0.1":
            requirements.append({"id": cells[0], "title": cells[1], "priority": cells[2],
                                 "acceptance": cells[5], "tasks": []})
    mapping = {row["id"]: row for row in requirements}
    for line in (ROOT / "docs/implementation/TRACEABILITY.md").read_text().splitlines():
        if not line.startswith("| REQ-"):
            continue
        match = re.match(r"\| (REQ-[A-Z]+-\d{3})", line)
        if match and match[1] in mapping:
            mapping[match[1]]["tasks"] = sorted(set(mapping[match[1]]["tasks"]) | set(re.findall(r"TASK-\d{3}", line)))
    plan = (ROOT / "docs/implementation/IMPLEMENTATION_PLAN.md").read_text()
    headings = list(re.finditer(r"^### (TASK-\d{3}) — (.+)$", plan, re.M))
    tasks = []
    for i, heading in enumerate(headings):
        task_id, title = heading.groups()
        number = int(task_id.split("-")[1])
        if number >= 103:
            continue
        body = plan[heading.end():headings[i + 1].start() if i + 1 < len(headings) else len(plan)]
        acceptance = re.search(r"^- \*\*验收步骤\*\*：(.+)$", body, re.M)
        definition = re.search(r"^- \*\*完成定义\*\*：(.+)$", body, re.M)
        tasks.append({"id": task_id, "title": title,
                      "acceptance": acceptance[1] if acceptance else "见实施计划对应任务",
                      "definition": definition[1] if definition else "见实施计划对应任务",
                      "requirements": [row["id"] for row in requirements if task_id in row["tasks"]]})
    if len(requirements) != 104 or len(tasks) != 39:
        raise ValueError(f"Canonical baseline changed: {len(requirements)} requirements / {len(tasks)} tasks; expected 104 / 39")
    return requirements, tasks


def apply_evidence(rows: list[dict], evidence: list[dict], kind: str) -> None:
    superseded = {old for record in evidence for old in record.get("supersedes", [])}
    for row in rows:
        records = [record for record in evidence if row["id"] in record.get(kind, [])]
        row.update(status="unverified", implementation=[], evidence=[], limitations=[])
        for record in records:
            row["evidence"].append(record["id"])
            row["implementation"].extend(record.get("implementation", []))
            if record["id"] not in superseded:
                row["limitations"].extend(record.get("limitations", []))
        row["implementation"] = sorted(set(row["implementation"]))
        records = [record for record in records if record["id"] not in superseded]
        full = [r for r in records if r["coverage"] == "full"]
        if any(r["outcome"] == "fail" for r in records):
            row["status"] = "failed"
        elif any(r["outcome"] == "pass" for r in full):
            row["status"] = "verified"
        elif any(r["outcome"] == "pass" for r in records):
            row["status"] = "partial"
        elif records:
            row["status"] = "limited"


def apply_scope_decisions(rows: list[dict], evidence: list[dict], decisions: list[dict]) -> None:
    """Interpret existing evidence within an explicitly recorded delivery scope; no new test credit."""
    superseded = {old for record in evidence for old in record.get("supersedes", [])}
    active_pass = {record["id"] for record in evidence if record["outcome"] == "pass" and record["id"] not in superseded}
    by_id, seen = {row["id"]: row for row in rows}, set()
    for decision in decisions:
        key = decision["requirement"]
        if key not in by_id or key in seen:
            raise ValueError(f"Unknown or duplicate scope decision: {key}")
        seen.add(key)
        row = by_id[key]
        if decision["originalAcceptance"] != row["acceptance"] or not decision["basisEvidence"]:
            raise ValueError(f"Scope decision must retain the original clause and existing evidence: {key}")
        if set(decision["basisEvidence"]) - active_pass or row["status"] == "failed":
            raise ValueError(f"Scope decision cannot replace an active failure or missing evidence: {key}")
        if decision["newExecution"] is not False or not decision["limitations"]:
            raise ValueError(f"Scope decision must disclose its interpretation-only limits: {key}")
        row["scope_decision"] = decision
        row["limitations"].extend(decision["limitations"])
        row["status"] = "verified"


def validate_records(records: list[dict], ids: set[str]) -> None:
    seen = set()
    for record in records:
        required = {"id", "requirements", "tasks", "outcome", "coverage", "platform", "build", "method",
                    "implementation", "steps", "artifacts", "observed", "limitations"}
        missing = required - record.keys()
        if missing:
            raise ValueError(f"Evidence missing fields: {sorted(missing)}")
        if record["id"] in seen:
            raise ValueError(f"Duplicate evidence id: {record['id']}")
        seen.add(record["id"])
        unknown = set(record["requirements"] + record["tasks"]) - ids
        if unknown:
            raise ValueError(f"Unknown IDs in {record['id']}: {sorted(unknown)}")
        if record["outcome"] not in {"pass", "fail", "blocked", "not_run"} or record["coverage"] not in {"full", "partial"}:
            raise ValueError(f"Invalid outcome/coverage: {record['id']}")
        if record["outcome"] in {"pass", "fail"} and not record["artifacts"]:
            raise ValueError(f"Measured evidence requires an artifact: {record['id']}")
        for artifact in record["artifacts"] + record["implementation"]:
            path = Path(artifact)
            if not path.is_absolute():
                path = ROOT / path
            if not path.exists():
                raise ValueError(f"Missing artifact in {record['id']}: {artifact}")
        if record["outcome"] == "pass" and record["coverage"] == "full" and record["method"] in {"build", "prototype", "static"}:
            raise ValueError(f"Build/prototype/static alone cannot close full acceptance: {record['id']}")
    for record in records:
        if unknown := set(record.get("supersedes", [])) - seen:
            raise ValueError(f"Unknown superseded records: {sorted(unknown)}")


def render(requirements: list[dict], tasks: list[dict], records: list[dict]) -> str:
    lines = ["# macOS 首版验收矩阵", "", "范围：104 条首版需求、39 项首版任务。来源为产品 0.4.0；按本机 macOS 与已交付 Windows x64 试用事实验收，平台未测项单列。",
             "已有构建、单元测试、原型或静态审查不能替代真实行为证据；未测平台不计通过。范围裁决只解释已有证据，不新增测试或截图回合。",
             "", "状态：已证实＝原条款在明确的本次范围内已履行；不代表建议指标达标、未测平台通过或额外视觉门完成。部分证实＝仍有条款子项未验；失败＝已有反例；受限＝有具体阻断；未证实＝未运行或无足够证据。",
             "", "## 计数", ""]
    for label, rows in [("需求", requirements), ("任务", tasks)]:
        count = Counter(row["status"] for row in rows)
        lines.append(f"- {label} {len(rows)}：" + "；".join(f"{text} {count[status]}" for status, text in STATUSES.items()))
    decisions = [row["scope_decision"] for row in requirements if "scope_decision" in row]
    if decisions:
        lines.extend(["", "## 本次范围裁决", "", "来源：[acceptance-scope-decisions.json](acceptance-scope-decisions.json)。原始证据及其 partial/full 标签不改；以下是既有事实的范围解释。", ""])
        for decision in decisions:
            lines.extend([f"- {decision['requirement']}：{decision['interpretation']}", "  限制：" + "；".join(decision["limitations"])])
        lines.extend(["", "UI003 的 Windows 125%/150% 仍未测；额外536视觉门独立见[视觉矩阵](VISUAL_MATRIX.md)。", ""])
    lines.extend(["", "## 需求待办", "", "| 编号 / 需求 | 优先级 | 任务 | 实现位置 | 状态 / 证据 | 验收条件 |", "| --- | --- | --- | --- | --- | --- |"])
    escape = lambda text: str(text).replace("|", "\\|").replace("\n", " ")
    for row in requirements:
        lines.append("| " + " | ".join(map(escape, [f"{row['id']} {row['title']}", row["priority"], ", ".join(row["tasks"]), ", ".join(row["implementation"]) or "待绑定真实实现",
                     STATUSES[row["status"]] + (" / " + ", ".join(row["evidence"]) if row["evidence"] else ""), row["acceptance"]])) + " |")
    lines.extend(["", "## 任务待办", "", "| 编号 / 任务 | 实现位置 | 状态 / 证据 | 验收步骤 | 完成条件 |", "| --- | --- | --- | --- | --- |"])
    for row in tasks:
        lines.append("| " + " | ".join(map(escape, [f"{row['id']} {row['title']}", ", ".join(row["implementation"]) or "待绑定真实实现", STATUSES[row["status"]] +
                     (" / " + ", ".join(row["evidence"]) if row["evidence"] else ""), row["acceptance"], row["definition"]])) + " |")
    lines.extend(["", "## 证据记录", ""])
    if not records:
        lines.append("尚无应用验收记录。夹具和采样工具自检只证明工具可用，不提升应用需求状态。")
    for record in records:
        lines.extend([f"### {record['id']}", "", f"{record['platform']} / {record['build']} / {record['method']} / {record['outcome']} / {record['coverage']}",
                      "", "实现：" + "、".join(record["implementation"]), "", "步骤：" + " → ".join(record["steps"]),
                      "", record["observed"], "", "证据：" + "、".join(record["artifacts"]),
                      "", "限制：" + ("；".join(record["limitations"]) or "无另列限制"), ""])
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence", type=Path, default=ROOT / "docs/verification/evidence.json")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/verification")
    parser.add_argument("--scope-decisions", type=Path, default=ROOT / "docs/verification/acceptance-scope-decisions.json")
    parser.add_argument("--check", action="store_true", help="Verify exact generated matrix matches canonical source/evidence")
    args = parser.parse_args()
    requirements, tasks = canonical()
    records = json.loads(args.evidence.read_text()) if args.evidence.exists() else []
    validate_records(records, {row["id"] for row in requirements + tasks})
    apply_evidence(requirements, records, "requirements")
    apply_evidence(tasks, records, "tasks")
    decisions = json.loads(args.scope_decisions.read_text()).get("decisions", []) if args.scope_decisions.exists() else []
    apply_scope_decisions(requirements, records, decisions)
    data = {"schema_version": 1, "scope": "macOS", "requirements": requirements, "tasks": tasks}
    outputs = {"MACOS_ACCEPTANCE.md": render(requirements, tasks, records),
               "matrix.json": json.dumps(data, ensure_ascii=False, indent=2) + "\n"}
    for name, contents in outputs.items():
        path = args.output / name
        if args.check:
            if not path.exists() or path.read_text() != contents:
                raise SystemExit(f"Stale matrix: {path}; regenerate acceptance_matrix.py")
        else:
            args.output.mkdir(parents=True, exist_ok=True)
            path.write_text(contents)
    print(json.dumps({"requirements": len(requirements), "tasks": len(tasks), "records": len(records),
                      "statuses": dict(Counter(row["status"] for row in requirements)), "checked": args.check}))


if __name__ == "__main__":
    main()
