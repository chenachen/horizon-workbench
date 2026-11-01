#!/usr/bin/env python3
"""Summarize exported editor timings after real native actions; never opens files internally."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re

from mac_metrics import stats


def file_byte_length(value: object) -> int | None:
    """DiskRevision exports byte lengths as unsigned decimal strings."""
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        return int(value)
    if type(value) is int and value >= 0:
        return value
    if type(value) is float and value >= 0 and value.is_integer():
        return int(value)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="getEditorDiagnostics JSON exported from actual app")
    parser.add_argument("--field", default="", help="Optional dotted path to editor diagnostics in a larger export")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--build", choices=["release", "debug", "harness-self-check"], required=True)
    parser.add_argument("--build-id", required=True)
    parser.add_argument("--native-actions", type=Path, help="Actual native action log, required for target comparison eligibility")
    parser.add_argument("--max-file-bytes", type=int, default=200_000)
    args = parser.parse_args()
    source = json.loads(args.input.read_text())
    for key in args.field.split(".") if args.field else []:
        source = source[key]
    opens = source["opens"]
    # Repeated timing events carry the same id as async highlighting completes.
    latest = {}
    for row in opens:
        latest[row["id"]] = {**latest.get(row["id"], {}), **row}
    sizes = {key: file_byte_length(row.get("byteLength")) for key, row in latest.items()}
    eligible = [row for key, row in latest.items() if sizes[key] is not None
                and sizes[key] <= args.max_file_bytes]
    groups = {}
    for cache in ["cold", "warm"]:
        for language_type in ["syntax", "plain"]:
            rows = [row for row in eligible if row.get("cache") == cache
                    and (row.get("language") == "plain") == (language_type == "plain")]
            visible, ready, incomplete = [], [], []
            for row in rows:
                duration = row.get("durationMs")
                if isinstance(duration, (int, float)) and duration >= 0:
                    visible.append(duration)
                highlight = row.get("highlightReadyMs") if language_type == "syntax" else duration
                if isinstance(duration, (int, float)) and duration >= 0 and isinstance(highlight, (int, float)) and highlight >= 0:
                    ready.append(max(duration, highlight))
                else:
                    incomplete.append(row["id"])
            groups[f"{cache}-{language_type}"] = {"open_count": len(rows), "visible_layout_proxy_ms": stats(visible),
                                                  "readable_highlight_proxy_ms": stats(ready), "incomplete_ids": incomplete}
    warm = groups["warm-syntax"]
    comparison_eligible = (args.build == "release" and args.native_actions is not None and args.native_actions.is_file()
                           and warm["readable_highlight_proxy_ms"]["count"] >= 20 and not warm["incomplete_ids"])
    report = {"schema_version": 1, "build": args.build, "build_id": args.build_id,
              "input": str(args.input), "input_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
              "native_actions": str(args.native_actions) if args.native_actions else None,
              "measurement": source.get("measurement"), "maximum_file_bytes": args.max_file_bytes,
              "distinct_opens": len(latest), "within_size_limit": len(eligible), "groups": groups,
              "invalid_byte_length_ids": [key for key, size in sizes.items() if size is None],
              "view_counts": {key: source.get(key) for key in ["viewCount", "createdViews", "destroyedViews"]},
              "suggested_target_ms": 150, "comparison_eligible": comparison_eligible,
              "comparison": ("proxy within suggested target" if warm["readable_highlight_proxy_ms"]["p95"] <= 150
                             else "proxy above suggested target") if comparison_eligible else "not eligible",
              "limits": ["Timing begins at actual open handler and ends at visible-layout/highlight-ready rAF proxy; not exact pixel paint.",
                         "Native interaction evidence must establish real GUI triggers; this summarizer never triggers internal open methods.",
                         "Language module readiness alone is not highlighting readiness; missing highlightReadyMs stays incomplete.",
                         "Plain-text and cold opens stay separate from warm syntax-file target.",
                         "Reported target comparison does not close full requirements or visual acceptance."]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "distinct_opens": len(latest), "comparison": report["comparison"]}))


if __name__ == "__main__":
    main()
