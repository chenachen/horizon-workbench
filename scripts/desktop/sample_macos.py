#!/usr/bin/env python3
"""Sample all attributed application processes. Default: 30-minute passive observation."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import time

from mac_metrics import MacMetrics, environment, read_json, select_processes, stats


def summarize(rows: list[dict], duration: float) -> dict:
    samples = [r for r in rows if r.get("type") == "sample"]
    values = [(r["elapsed_seconds"], r["totals"]["footprint_bytes"]) for r in samples
              if r["totals"]["footprint_bytes"] is not None]
    xmean = statistics.mean(x for x, _ in values) if values else 0
    ymean = statistics.mean(y for _, y in values) if values else 0
    denominator = sum((x - xmean) ** 2 for x, _ in values)
    slope = sum((x - xmean) * (y - ymean) for x, y in values) / denominator if denominator else None
    after_warmup = [r for r in samples if r["elapsed_seconds"] >= 60]
    stable = [y for x, y in values if x >= 60]
    return {"sample_count": len(samples), "requested_duration_seconds": duration,
            "observed_duration_seconds": samples[-1]["elapsed_seconds"] if samples else 0,
            "physical_footprint_bytes": stats([y for _, y in values]),
            "stable_after_60s_footprint_bytes": stats(stable),
            "stable_after_60s_rss_sum_bytes": stats([r["totals"]["rss_bytes"] for r in after_warmup
                                                    if r["totals"]["rss_bytes"] is not None]),
            "stable_after_60s_cpu_percent_one_core": stats([r["totals"]["cpu_percent_one_core"] for r in after_warmup
                                                          if r["totals"]["cpu_percent_one_core"] is not None]),
            "after_60s_sample_count": len(after_warmup),
            "after_60s_observed_seconds": (after_warmup[-1]["elapsed_seconds"] - after_warmup[0]["elapsed_seconds"]
                                           if len(after_warmup) > 1 else 0),
            "after_60s_interpretation": "Excludes warm-up by time only; a steady-state claim also requires unchanged scenario and no GUI actions during this window.",
            "rss_sum_bytes": stats([r["totals"]["rss_bytes"] for r in samples if r["totals"]["rss_bytes"] is not None]),
            "cpu_percent_one_core": stats([r["totals"]["cpu_percent_one_core"] for r in samples
                                           if r["totals"]["cpu_percent_one_core"] is not None]),
            "footprint_linear_slope_bytes_per_minute": slope * 60 if slope is not None else None,
            "first_minute_footprint_bytes": stats([y for x, y in values if x <= 60]),
            "last_minute_footprint_bytes": stats([y for x, y in values if values and x >= values[-1][0] - 60]),
            "status": ("measured; acceptance requires scenario, attribution and release-build review" if values
                       else "no valid process memory measurement; not eligible for acceptance")}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pid", type=int, action="append", required=True, help="App root; repeat for additional roots")
    parser.add_argument("--output", type=Path, required=True, help="New evidence directory")
    parser.add_argument("--scenario", required=True)
    parser.add_argument("--build", choices=["release", "debug", "collector-self-check"], required=True)
    parser.add_argument("--build-id", default="not provided", help="Version/revision or release artifact identity")
    parser.add_argument("--fixture-manifest", type=Path)
    parser.add_argument("--plugin-state", type=Path, help="Snapshot JSON of installed/enabled/running plugins and window conditions")
    parser.add_argument("--duration", type=float, default=1800)
    parser.add_argument("--interval", type=float, default=1)
    parser.add_argument("--members", type=Path, help='Live JSON: {"123":{"group":"pi","reason":"owned session id"}}')
    parser.add_argument("--resources", type=Path, help="App diagnostic JSON with live listener/subscription/process counts")
    parser.add_argument("--phase-file", type=Path, help="Plain-text phase label; reread each sample")
    parser.add_argument("--stop-file", type=Path, help="Finish after a final sample when this file appears; duration remains the maximum")
    parser.add_argument("--activity-log", type=Path, help="Manual/native action JSONL evidence; collector does not synthesize actions")
    parser.add_argument("--cycle-command", help="Explicit JSON argv for an existing background/native test driver")
    parser.add_argument("--cycle-every", type=float, default=30)
    parser.add_argument("--cache-condition", default="OS cache unchanged; no cache purge")
    args = parser.parse_args()
    if args.duration < 0 or args.interval <= 0 or args.cycle_every <= 0:
        parser.error("duration must be nonnegative; intervals must be positive")
    args.output.mkdir(parents=True, exist_ok=False)
    metrics = MacMetrics()
    root_processes = metrics.processes()
    if missing := [pid for pid in args.pid if pid not in root_processes]:
        raise SystemExit(f"Root process absent before sampling: {missing}; discover current application PID")
    root_executables = {}
    for pid in args.pid:
        executable = metrics.executable_path(pid) or root_processes.get(pid, {}).get("executable", "")
        path = Path(executable)
        root_executables[str(pid)] = {"path": executable,
                                      "sha256": hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None}
    metadata = {"schema_version": 1, **environment(), "scenario": args.scenario, "build": args.build,
                "build_id": args.build_id, "root_executables": root_executables,
                "fixture": read_json(args.fixture_manifest, None), "plugin_state": read_json(args.plugin_state, None),
                "root_pids": args.pid, "cache_condition": args.cache_condition,
                "accounting": "libproc RUSAGE_INFO_V2 physical footprint; ps RSS; CPU Mach ticks converted using mach_timebase_info, delta nanoseconds / wall time",
                "mach_timebase": {"numer": metrics.timebase.numer, "denom": metrics.timebase.denom},
                "responsibility_spi_available": metrics.responsible is not None,
                "attribution": "explicit root/member + descendants + macOS responsibility + retained process identity",
                "cycle_evidence": "driver" if args.cycle_command else "manual log" if args.activity_log else "none; passive sampling only",
                "activity_log": str(args.activity_log) if args.activity_log else None,
                "stop_file": str(args.stop_file) if args.stop_file else None,
                "limits": ["Footprint sum can include shared accounting; RSS sum is not private memory.",
                           "Root descendants default to horizon; label Pi/development/model PIDs explicitly.",
                           "Inspect unassigned WebKit candidates before claiming complete attribution.",
                           "Sampling can miss short-lived processes; listener counts require app diagnostic export."]}
    (args.output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    known, rows, cycle_process = {}, [], None
    cycle_argv = json.loads(args.cycle_command) if args.cycle_command else None
    start = time.monotonic()
    next_cycle = start
    with (args.output / "samples.jsonl").open("w") as stream, (args.output / "cycle-output.log").open("w") as cycle_output:
        try:
            while True:
                now = time.monotonic()
                if cycle_process and cycle_process.poll() is not None:
                    event = {"type": "cycle_end", "elapsed_seconds": now - start, "exit_code": cycle_process.returncode}
                    rows.append(event)
                    stream.write(json.dumps(event) + "\n")
                    cycle_process = None
                if cycle_argv and now >= next_cycle and not cycle_process:
                    cycle_process = subprocess.Popen(cycle_argv, stdout=cycle_output, stderr=subprocess.STDOUT)
                    event = {"type": "cycle_start", "elapsed_seconds": now - start, "pid": cycle_process.pid}
                    rows.append(event)
                    stream.write(json.dumps(event) + "\n")
                    next_cycle = now + args.cycle_every
                processes = metrics.processes()
                selected, unassigned = select_processes(processes, set(args.pid), read_json(args.members, {}), known, metrics)
                details = [{**metrics.read(processes[pid], now), **attribution} for pid, attribution in selected.items()]
                footprint = [r["footprint_bytes"] for r in details]
                cpus = [r["cpu_percent_one_core"] for r in details]
                row = {"type": "sample", "elapsed_seconds": round(now - start, 4), "processes": details,
                       "phase": args.phase_file.read_text().strip() if args.phase_file and args.phase_file.exists() else args.scenario,
                       "resources": read_json(args.resources, None), "unassigned_webkit_candidates": unassigned,
                       "missing_roots": [pid for pid in args.pid if pid not in processes],
                       "totals": {"process_count": len(details), "rss_bytes": sum(r["rss_bytes"] for r in details) if details else None,
                                  "footprint_bytes": sum(footprint) if details and all(x is not None for x in footprint) else None,
                                  "cpu_percent_one_core": sum(cpus) if details and all(x is not None for x in cpus) else None}}
                row["groups"] = {group: {"process_count": len([r for r in details if r["group"] == group]),
                                          "footprint_bytes": sum(r["footprint_bytes"] for r in details if r["group"] == group)
                                          if all(r["footprint_bytes"] is not None for r in details if r["group"] == group) else None}
                                 for group in sorted({r["group"] for r in details})}
                rows.append(row)
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
                stream.flush()
                if args.stop_file and args.stop_file.exists():
                    metadata["stop_reason"] = "operator stop file after final sample"
                    break
                if now - start >= args.duration:
                    metadata["stop_reason"] = "duration reached"
                    break
                time.sleep(min(args.interval, max(0, args.duration - (time.monotonic() - start))))
        except KeyboardInterrupt:
            metadata["interrupted"] = True
        finally:
            if cycle_process and cycle_process.poll() is None:
                # Do not kill a driver which may own useful application state.
                metadata["unfinished_cycle_pid"] = cycle_process.pid
    (args.output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    summary = summarize(rows, args.duration)
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), **summary}, ensure_ascii=False))


if __name__ == "__main__":
    main()
