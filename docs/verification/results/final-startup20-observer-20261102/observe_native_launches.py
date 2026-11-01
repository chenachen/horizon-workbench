#!/usr/bin/env python3
"""Watch CUA-owned launches. Never launches, activates, quits, or signals Horizon.

The only child command is the existing read-only ax_probe.
Full CUA launch/normal-quit/AX/screenshot records remain required.
"""
from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

REPOSITORY = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPOSITORY / "scripts" / "desktop"))
from mac_metrics import MacMetrics, environment, stats


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_actions(path):
    if not path.exists():
        return []
    raw = path.read_text()
    lines = raw.splitlines()
    if raw and not raw.endswith("\n"):
        lines = lines[:-1]  # An append still in progress is not a completed record.
    rows = [json.loads(line) for line in lines if line.strip()]
    iterations = [row["iteration"] for row in rows]
    if len(set(iterations)) != len(iterations) or any(i not in range(1, 21) for i in iterations):
        raise ValueError("CUA index needs one completed record per original attempt, iterations 1..20")
    return sorted(rows, key=lambda row: row["iteration"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--executable", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--probe", type=Path, required=True)
    parser.add_argument("--label", required=True)
    parser.add_argument("--role", default="AXButton")
    parser.add_argument("--cua-actions", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--poll", type=float, default=.05)
    parser.add_argument("--ready-timeout", type=float, default=20)
    parser.add_argument("--cache-condition", required=True)
    args = parser.parse_args()
    executable = args.executable.resolve(strict=True)
    probe = args.probe.resolve(strict=True)
    if not executable.is_file() or not probe.is_file() or args.poll <= 0 or args.ready_timeout <= 0:
        parser.error("Existing exact executable/probe and positive intervals required")
    if digest(executable) != args.expected_sha256.lower():
        parser.error("Exact executable SHA256 differs from the frozen candidate")

    metrics = MacMetrics()
    absolute = metrics.system.mach_absolute_time
    absolute.argtypes, absolute.restype = [], ctypes.c_uint64
    numer, denom = metrics.timebase.numer, metrics.timebase.denom
    to_ns = lambda ticks: ticks * numer // denom

    def clock():
        before = absolute()
        utc_ns = time.time_ns()
        after = absolute()
        midpoint = (before + after) // 2
        return {"mach_ticks": after, "utc_ns": utc_ns,
                "clock_pair_span_ns": to_ns(after - before),
                "utc_minus_mach_midpoint_ns": utc_ns - to_ns(midpoint)}

    def discover():
        started = clock()
        processes = metrics.processes()
        if not processes:
            raise RuntimeError("Process table unavailable; cannot infer target exit")
        owned = {}
        for process in processes.values():
            if Path(process["executable"]).name != executable.name:
                continue
            path = metrics.executable_path(process["pid"])
            if not path or Path(path).resolve() != executable:
                continue
            usage = metrics.read(process, time.monotonic())
            birth = usage.get("start_abstime")
            key = (process["pid"], birth if birth else process["start"])
            owned[key] = {"pid": process["pid"], "process_start": process["start"],
                          "start_abstime": birth, "executable": str(executable)}
        ended = clock()
        return owned, started, ended

    args.output.mkdir(parents=True, exist_ok=False)
    observed, actions, failure = {}, [], None
    events = (args.output / "events.jsonl").open("x")

    def emit(kind, **data):
        row = {"event": kind, **data}
        events.write(json.dumps(row, ensure_ascii=False) + "\n")
        events.flush()
        if kind in {"armed", "process_seen", "first_ax_ready", "process_gone", "observer_error"}:
            print(json.dumps(row, ensure_ascii=False), flush=True)

    baseline, _, arm = discover()
    baseline_keys = set(baseline)
    metadata = {"environment": environment(),
                "mode": "watch-only; all 20 launches/normal quits remain CUA-owned",
                "requested_cua_attempts": 20, "executable": str(executable),
                "expected_sha256": args.expected_sha256.lower(), "probe": str(probe),
                "probe_sha256": digest(probe), "label": args.label, "role": args.role,
                "mach_timebase": {"numer": numer, "denom": denom}, "armed": arm,
                "baseline_excluded": list(baseline.values()), "poll_requested_seconds": args.poll,
                "ready_timeout_seconds": args.ready_timeout, "cache_condition": args.cache_condition,
                "endpoint": "first successful read-only exact-label/role enabled-control AX probe return",
                "budget_endpoint": "CUA launch invocation before UTC -> first AX-ready UTC; never process birth",
                "limits": ["No cache purge; independent processes are not OS-cache-cold launches.",
                           "Discovery, scheduling, helper startup and AX traversal costs are included, never subtracted.",
                           "Probe start/end bound its positive observation, not earliest paint or earliest possible readiness.",
                           "Actual probe intervals include probe/discovery cost; requested poll is not a +/- error guarantee.",
                           "CUA Date.now has millisecond resolution; retain clock-pair spans/offset changes for UTC correlation.",
                           "Process disappearance does not prove normal quit; retain original CUA quit evidence.",
                           "No automatic retry/replacement launch, no provider/app-state change, no target signals."]}
    (args.output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    emit("armed", baseline_excluded=list(baseline.values()), clock=arm)
    try:
        while True:
            live, scan_start, scan_end = discover()
            new_live = {key: value for key, value in live.items() if key not in baseline_keys}
            emit("process_scan", begin=scan_start, end=scan_end,
                 duration_ms=to_ns(scan_end["mach_ticks"] - scan_start["mach_ticks"]) / 1e6,
                 new_live_identities=list(new_live.values()))
            for key, process in new_live.items():
                if key not in observed:
                    birth = process["start_abstime"]
                    row = {**process, "observed_sequence": len(observed) + 1, "status": "waiting_ax",
                           "detected": scan_end, "probe_count": 0, "probe_total_ms": 0,
                           "last_probe_start": None, "last_negative_probe": None, "exit_observed": False,
                           "discovery_scan_ms": to_ns(scan_end["mach_ticks"] - scan_start["mach_ticks"]) / 1e6,
                           "detection_age_ms": to_ns(scan_end["mach_ticks"] - birth) / 1e6 if birth else None}
                    if not birth:
                        row["status"] = "process_birth_unavailable"
                    observed[key] = row
                    emit("process_seen", **row)
                row = observed[key]
                if row["status"] != "waiting_ax":
                    continue
                if to_ns(scan_end["mach_ticks"] - row["start_abstime"]) / 1e9 >= args.ready_timeout:
                    row["status"] = "timeout"
                    emit("attempt_timeout", pid=row["pid"], start_abstime=row["start_abstime"], clock=scan_end)
                    continue
                begin = clock()
                remaining = args.ready_timeout - to_ns(begin["mach_ticks"] - row["start_abstime"]) / 1e9
                if remaining <= 0:
                    row["status"] = "timeout"
                    emit("attempt_timeout", pid=row["pid"], start_abstime=row["start_abstime"], clock=begin)
                    continue
                probe_timeout = min(2, remaining)
                timed_out = False
                # Only the observer-owned read-only AX helper is reaped on timeout.
                # No launcher, activation, input, or signal to Horizon is performed.
                try:
                    result = subprocess.run([str(probe), "--pid", str(row["pid"]), "--role", args.role,
                                             "--label", args.label], capture_output=True, text=True,
                                            timeout=probe_timeout)
                    returncode, stdout, stderr = result.returncode, result.stdout, result.stderr
                except subprocess.TimeoutExpired as error:
                    timed_out = True
                    returncode = None
                    stdout, stderr = error.stdout or "", error.stderr or ""
                    if isinstance(stdout, bytes):
                        stdout = stdout.decode(errors="replace")
                    if isinstance(stderr, bytes):
                        stderr = stderr.decode(errors="replace")
                end = clock()
                duration = to_ns(end["mach_ticks"] - begin["mach_ticks"]) / 1e6
                interval = (to_ns(begin["mach_ticks"] - row["last_probe_start"]["mach_ticks"]) / 1e6
                            if row["last_probe_start"] else None)
                try:
                    payload = json.loads(stdout)
                except ValueError:
                    payload = None
                ready = returncode == 0 and payload and payload.get("ready") is True and payload.get("pid") == row["pid"]
                observation = {"pid": row["pid"], "start_abstime": row["start_abstime"],
                               "begin": begin, "end": end, "probe_duration_ms": duration,
                               "actual_probe_start_interval_ms": interval, "returncode": returncode,
                               "probe_timeout_seconds": probe_timeout, "probe_timed_out": timed_out,
                               "stdout": stdout[-4000:], "stderr": stderr[-2000:], "ready": bool(ready)}
                row["probe_count"] += 1
                row["probe_total_ms"] += duration
                row["last_probe_start"] = begin
                emit("ax_probe", **observation)
                if ready:
                    row.update(status="ready", ready=end,
                               process_birth_to_ax_ready_ms=to_ns(end["mach_ticks"] - row["start_abstime"]) / 1e6,
                               successful_probe_duration_ms=duration,
                               clock_offset_change_ms=(end["utc_minus_mach_midpoint_ns"] - arm["utc_minus_mach_midpoint_ns"]) / 1e6)
                    emit("first_ax_ready", **row)
                else:
                    row["last_negative_probe"] = observation
                    if returncode in {64, 77}:
                        row["status"] = "probe_unavailable"
            for key, row in observed.items():
                if key not in live and not row["exit_observed"]:
                    row["exit_observed"] = True
                    row["exit_seen"] = scan_end
                    if row["status"] == "waiting_ax":
                        row["status"] = "exited_before_ready"
                    emit("process_gone", **row)
            actions = read_actions(args.cua_actions)
            if len(actions) == 20 and not new_live:
                break
            time.sleep(args.poll)
    except KeyboardInterrupt:
        failure = "Observer interrupted; partial attempts retained; no Horizon signal sent"
    except Exception as error:
        failure = str(error)
        emit("observer_error", error=failure)
    finally:
        events.close()
        try:
            actions = read_actions(args.cua_actions)
        except Exception as error:
            failure = f"{failure or ''}; CUA index read failed: {error}"
        joined = []
        bound_identities = set()
        for action in actions:
            matches = [row for row in observed.values() if row["pid"] == action.get("pid") and
                       ((action.get("start_abstime") is not None and action["start_abstime"] == row["start_abstime"]) or
                        (action.get("process_start") is not None and action["process_start"] == row["process_start"]))]
            row = {"iteration": action["iteration"], "cua": action, "status": "cua_launch_failed" if action.get("launch_status") == "launch_failed" else "no_matching_independent_process",
                   "cua_launch_to_ax_ready_ms": None, "process_birth_to_ax_ready_ms": None}
            if len(matches) == 1:
                measured = matches[0]
                row.update(status=measured["status"], observer=measured,
                           process_birth_to_ax_ready_ms=measured.get("process_birth_to_ax_ready_ms"))
                identity = (measured["pid"], measured["start_abstime"])
                if identity in bound_identities:
                    row["status"] = "duplicate_process_identity"
                else:
                    bound_identities.add(identity)
                before = action.get("launch_before_utc_ms")
                if measured.get("ready") and isinstance(before, (int, float)):
                    elapsed = measured["ready"]["utc_ns"] / 1e6 - before
                    if elapsed >= 0:
                        row["cua_launch_to_ax_ready_ms"] = elapsed
                    else:
                        row["status"] = "invalid_utc_correlation"
            joined.append(row)
        end_to_end = [row["cua_launch_to_ax_ready_ms"] for row in joined if row["status"] == "ready" and row["cua_launch_to_ax_ready_ms"] is not None]
        complete = len(actions) == 20 and len(end_to_end) == 20 and len(bound_identities) == 20 and not failure
        unchanged = digest(executable) == args.expected_sha256.lower()
        summary = {"requested_attempts": 20, "cua_attempts_recorded": len(actions), "observed_new_processes": len(observed),
                   "distinct_matched_process_identities": len(bound_identities),
                   "end_to_end_launch_to_ax_ready_ms": stats(end_to_end),
                   "process_segment_diagnostic_ms": stats([row["process_birth_to_ax_ready_ms"] for row in joined if row["process_birth_to_ax_ready_ms"] is not None]),
                   "process_segment_is_budget_endpoint": False,
                   "all_20_timing_rows_eligible": complete and unchanged,
                   "failed_or_unmeasurable_cua_attempts": len(actions) - len(end_to_end),
                   "executable_sha256_unchanged": unchanged, "observer_error": failure,
                   "suggested_p95_budget_ms": 2000,
                   "budget_comparison": "review end-to-end P95 against existing 2000ms budget with original CUA/clock evidence; no automatic pass",
                   "normal_quit_and_native_AX_screenshot_evidence": "review original complete 20 CUA records; observer does not substitute"}
        (args.output / "runs.json").write_text(json.dumps(joined, ensure_ascii=False, indent=2) + "\n")
        (args.output / "observed-processes.json").write_text(json.dumps(list(observed.values()), ensure_ascii=False, indent=2) + "\n")
        (args.output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
