#!/usr/bin/env python3
"""TASK037 phase projection only. Run only at Root's explicit owner boundary."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import sys
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = HERE / "owner"
DATA = Path("/Users/chenpengxiang/Library/Application Support/dev.horizon.desktop")
MAIN = Path("/Users/chenpengxiang/Applications/Horizon.app/Contents/MacOS/horizon-desktop")
EXPECTED_SHA = "5a0a6c5a6edca82751a54abe34d0dc40a798f60d49182b70a47bad21e233190d"
EXPECTED_PID = 18459
EXPECTED_BIRTH = 2667048786342
ASSET_A = "613103d6e17e2e449cd5043665877a3b7192e48dc14b11a623acf4e6f64cc690"
OLD_QA_NAME = "外观验收 · 雾蓝背景"
NEW_QA_NAME = "QA-T037-Ref-20261102"
PHASES = ("before", "active-B", "oversize", "corrupt", "remove", "ref-applied", "restored")
PRESET_KEYS = ("id", "name", "revision", "packageRefs", "assetRefs", "values")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def read_json(path):
    raw = path.read_bytes()
    return json.loads(raw), sha(raw)


def asset_file(name):
    path = DATA / "appearance-assets" / name
    if not path.is_file():
        return {"file": name, "exists": False}
    raw = path.read_bytes()
    return {"file": name, "exists": True, "bytes": len(raw), "sha256": sha(raw)}


def key_delta(before, after):
    return {"added": sorted(after.keys() - before.keys()),
            "removed": sorted(before.keys() - after.keys()),
            "changed": sorted(k for k in before.keys() & after.keys() if before[k] != after[k])}


def without_background(fields):
    return {k: v for k, v in fields.items() if k != "background"}


def preset_fields(values):
    # Mechanical data-key projection only: no defaults, validation, plugin lookup or apply.
    fields = {k: values[k] for k in ("layoutId", "themeId", "mode") if k in values}
    for layout, sizes in values.get("geometryByLayout", {}).items():
        for key, value in sizes.items():
            fields[f"geometry:{layout}:{key}"] = value
    for theme, modes in values.get("colorsByTheme", {}).items():
        for mode, colors in modes.items():
            for token, value in colors.items():
                fields[f"color:{theme}:{mode}:{token}"] = value
    return fields


def baseline(phase):
    path = OUT / f"{PHASES.index(phase):02d}-{phase}.json"
    return read_json(path) if path.is_file() else (None, None)


def comparisons(result, reference):
    current_presets = {p["id"]: p for p in result["presets"]}
    prior_presets = {p["id"]: p for p in reference["presets"]}
    return {"global_exact": result["globalAppearance"] == reference["globalAppearance"],
            "global_key_delta": key_delta(reference["globalAppearance"], result["globalAppearance"]),
            "non_background_global_exact": without_background(result["globalAppearance"]) == without_background(reference["globalAppearance"]),
            "appearance_revision_equal": result["appearanceRevision"] == reference["appearanceRevision"],
            "presets_set_exact": current_presets == prior_presets,
            "preset_id_delta": key_delta(prior_presets, current_presets),
            "asset_A_record_and_files_exact": result["assetA"] == reference["assetA"]}


def snapshot(phase):
    destination = OUT / f"{PHASES.index(phase):02d}-{phase}.json"
    if destination.exists():
        raise SystemExit("Phase already recorded; refusing duplicate reads or overwrite")
    result = {"phase": phase, "observedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "helperSHA256": sha(Path(__file__).read_bytes()),
              "scope": "One read-only exact-main identity and global appearance/preset/A projection. No other projects, recovery or credential output. Native UI/error outcome is separate AX/image evidence.",
              "nativeOutcome": "not collected by this helper; no GUI pass/fail is inferred"}
    try:
        sys.path.insert(0, str(ROOT / "scripts/desktop"))
        from mac_metrics import MacMetrics
        metrics = MacMetrics()
        # Reuse the fixed-PID reader directly; never enumerate processes/descendants.
        row = metrics.read({"pid": EXPECTED_PID, "executable": ""}, time.monotonic())
        actual_sha = sha(MAIN.read_bytes())
        identity = {"pid": EXPECTED_PID, "start_abstime": row.get("start_abstime"),
                    "executable": row.get("executable"), "mainSHA256": actual_sha}
        result["identity"] = identity
        if (actual_sha != EXPECTED_SHA or identity["start_abstime"] != EXPECTED_BIRTH
                or identity["executable"] != str(MAIN)):
            raise RuntimeError("Fixed 5a0a/PID18459/birth identity mismatch; appdata was not read")

        appearance, appearance_sha = read_json(DATA / "appearance.json")
        registry, _ = read_json(DATA / "registry.json")
        global_fields = appearance["global"]
        if not isinstance(global_fields, dict):
            raise ValueError("Stored global appearance is not an object")
        presets = sorted(({key: p.get(key) for key in PRESET_KEYS}
                          for p in appearance["presets"]), key=lambda p: str(p["id"]))
        result.update(appearanceSchemaVersion=appearance.get("schemaVersion"),
                      appearanceRevision=appearance.get("revision"),
                      appearanceReadSHA256=appearance_sha, globalAppearance=global_fields,
                      presets=presets,
                      hostRegistry={"schemaVersion": registry.get("schemaVersion"),
                                    "revision": registry.get("revision")},
                      assetA={"assetId": ASSET_A,
                              "record": appearance.get("assets", {}).get(ASSET_A),
                              "png": asset_file(ASSET_A + ".png"),
                              "preview": asset_file(ASSET_A + "-preview.png")})
        result["assetA"]["expectedPNG_SHA256"] = ASSET_A
        result["assetA"]["pngMatchesExpectedSHA256"] = result["assetA"]["png"].get("sha256") == ASSET_A
        result["presetIdsWhoseValuesReferenceA"] = [p["id"] for p in presets
            if (p.get("values") or {}).get("background", {}).get("assetId") == ASSET_A]
        result["reuseReview"] = []
        for p in presets:
            name = p.get("name") or ""
            if not (name.startswith(OLD_QA_NAME) or name == NEW_QA_NAME):
                continue
            values = p.get("values") or {}
            flat = preset_fields(values)
            stored = without_background(global_fields)
            delta = key_delta(stored, flat)
            result["reuseReview"].append({"id": p["id"], "name": name,
                "valuesReferenceA": values.get("background", {}).get("assetId") == ASSET_A,
                "nonBackgroundStoredProjectionExact": flat == stored,
                "presetVsStoredNonBackgroundDelta": delta,
                "note": "Name alone is not ownership. This compares saved values with stored overrides, not a reconstructed effective snapshot; absent/default fields are not guessed. Root decides reuse or the single owned QA reference preset."})
        if phase != "before":
            prior, prior_sha = baseline("before")
            if prior is not None and "globalAppearance" in prior:
                result["versusBeforeO"] = {"receiptSHA256": prior_sha, **comparisons(result, prior)}
            active, active_sha = baseline("active-B")
            if phase != "active-B" and active is not None and "globalAppearance" in active:
                result["versusActiveB"] = {"receiptSHA256": active_sha, **comparisons(result, active)}
        result["comparisonMeaning"] = "Recorded equalities/deltas only, not new acceptance gates; revisions may increase after explicit actions. RESOURCE_BUSY/import errors and displayed image must come from same-phase native AX/screenshots."
    except Exception as error:
        result["error"] = type(error).__name__ + ": " + str(error)
    result["completedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    OUT.mkdir(exist_ok=True)
    with destination.open("x") as stream:
        stream.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"phase": phase, "output": str(destination),
                      "sha256": sha(destination.read_bytes()), "error": result.get("error"),
                      "presetCount": len(result.get("presets", []))}, ensure_ascii=False))
    return 1 if "error" in result else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=PHASES)
    raise SystemExit(snapshot(parser.parse_args().phase))
