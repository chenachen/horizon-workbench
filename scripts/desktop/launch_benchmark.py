#!/usr/bin/env python3
"""Measure 20 independent process launches against an explicit native readiness probe."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import signal
import subprocess
import time

from mac_metrics import MacMetrics, environment, stats


class LaunchedApp:
    """A LaunchServices-owned app PID; only signal the exact process we launched."""
    def __init__(self, pid: int):
        self.pid, self.returncode = pid, None
        self.metrics = MacMetrics()
        process = self.metrics.processes().get(pid)
        self.identity = process["start"] if process else None

    def poll(self):
        process = self.metrics.processes().get(self.pid)
        return None if process and process["start"] == self.identity else 0

    def terminate(self):
        if self.poll() is None:
            try:
                os.kill(self.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass

    def kill(self):
        if self.poll() is None:
            try:
                os.kill(self.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

    def wait(self, timeout: float):
        deadline = time.monotonic() + timeout
        while self.poll() is None:
            if time.monotonic() >= deadline:
                raise subprocess.TimeoutExpired("LaunchServices app", timeout)
            time.sleep(.05)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    launch_group = parser.add_mutually_exclusive_group(required=True)
    launch_group.add_argument("--launch-command", help='JSON argv of app executable, not "open"; app may inherit launcher responsibility')
    launch_group.add_argument("--app-bundle", type=Path, help="Preferred: LaunchServices launches an independent .app in background")
    parser.add_argument("--native-launcher", type=Path, help="Compiled launch_app.swift; required with --app-bundle")
    parser.add_argument("--probe-command", required=True, help='JSON argv; {pid} and {iteration} substituted')
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--runs", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=20)
    parser.add_argument("--poll", type=float, default=.05)
    parser.add_argument("--settle", type=float, default=1)
    parser.add_argument("--build", choices=["release", "debug", "harness-self-check"], required=True)
    parser.add_argument("--cache-condition", required=True, help="State OS/filesystem cache condition; tool never purges caches")
    parser.add_argument("--endpoint", required=True, help="Exact observable interactive readiness definition")
    parser.add_argument("--env-file", type=Path, help="JSON environment additions, e.g. isolated app data directory; values not logged")
    args = parser.parse_args()
    launch = json.loads(args.launch_command) if args.launch_command else []
    if args.app_bundle:
        if not args.native_launcher or not args.native_launcher.is_file():
            parser.error("--app-bundle requires --native-launcher compiled from launch_app.swift")
        launch = [str(args.native_launcher), str(args.app_bundle.resolve())]
    probe = json.loads(args.probe_command)
    if not launch or not probe or args.runs < 1 or args.poll <= 0:
        parser.error("commands must be nonempty argv; runs and poll must be positive")
    if Path(launch[0]).name == "open":
        parser.error("open exits before the app; pass the actual executable to track its PID")
    args.output.mkdir(parents=True, exist_ok=False)
    additions = json.loads(args.env_file.read_text()) if args.env_file else {}
    executable = Path(launch[0])
    if args.app_bundle:
        info = plistlib.loads((args.app_bundle / "Contents/Info.plist").read_bytes())
        executable = args.app_bundle / "Contents/MacOS" / info["CFBundleExecutable"]
    metadata = {"schema_version": 1, **environment(), "build": args.build,
                "executable_sha256": hashlib.sha256(executable.read_bytes()).hexdigest() if executable.is_file() else None,
                "launch_mode": "LaunchServices background new instance" if args.app_bundle else "direct executable",
                "cache_condition": args.cache_condition, "endpoint": args.endpoint, "launch_argv": launch,
                "probe_argv": probe, "environment_keys": sorted(additions), "requested_runs": args.runs,
                "timing": "monotonic_ns immediately before Popen through successful native readiness probe; probe cost included",
                "limits": ["Independent process launches do not imply cold OS filesystem cache.",
                           "Readiness accuracy is defined by the supplied probe; app spawn alone is invalid.",
                           "Only invoke while coordinated with native GUI testing; launches may activate the app.",
                           "Application state must be disposable; tool sends SIGTERM to its own launched process after each run."]}
    (args.output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    results = []
    with (args.output / "runs.jsonl").open("w") as raw:
        for iteration in range(1, args.runs + 1):
            with (args.output / f"launch-{iteration:02d}.log").open("w") as log:
                started = time.monotonic_ns()
                launch_info = None
                try:
                    if args.app_bundle:
                        result = subprocess.run(launch, env={**os.environ, **additions}, capture_output=True, text=True, timeout=args.timeout)
                        if result.returncode:
                            raise RuntimeError(f"LaunchServices launch failed: {result.stderr[-2000:]}")
                        launch_info = json.loads(result.stdout)
                        process = LaunchedApp(launch_info["pid"])
                    else:
                        process = subprocess.Popen(launch, env={**os.environ, **additions}, stdout=log, stderr=subprocess.STDOUT)
                except (OSError, RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
                    row = {"iteration": iteration, "ready_ms": None, "status": "launch_failed", "error": str(error),
                           "stop": "launch result unknown; stopped benchmark to avoid repeated orphan launches"}
                    results.append(row)
                    raw.write(json.dumps(row, ensure_ascii=False) + "\n")
                    raw.flush()
                    print(json.dumps(row), flush=True)
                    break
                row = {"iteration": iteration, "pid": process.pid, "ready_ms": None, "status": "timeout"}
                if launch_info:
                    row["launch_info"] = launch_info
                try:
                    while (time.monotonic_ns() - started) / 1e9 < args.timeout:
                        if process.poll() is not None:
                            row.update(status="exited_before_ready", exit_code=process.returncode)
                            break
                        argv = [part.replace("{pid}", str(process.pid)).replace("{iteration}", str(iteration)) for part in probe]
                        try:
                            result = subprocess.run(argv, capture_output=True, text=True, timeout=min(2, args.timeout))
                        except subprocess.TimeoutExpired:
                            result = None
                        if result and result.returncode == 0:
                            row.update(status="ready", ready_ms=(time.monotonic_ns() - started) / 1e6,
                                       probe_stdout=result.stdout[-4000:])
                            break
                        time.sleep(args.poll)
                finally:
                    if process.poll() is None:
                        process.terminate()
                        try:
                            process.wait(timeout=10)
                            row["stop"] = "SIGTERM completed"
                        except subprocess.TimeoutExpired:
                            process.kill()
                            process.wait(timeout=5)
                            row["stop"] = "SIGKILL required; lifecycle acceptance failed"
                    else:
                        row["stop"] = "already exited"
                results.append(row)
                raw.write(json.dumps(row, ensure_ascii=False) + "\n")
                raw.flush()
                print(json.dumps({k: v for k, v in row.items() if k != "probe_stdout"}), flush=True)
                time.sleep(args.settle)
    timings = [row["ready_ms"] for row in results if row["ready_ms"] is not None]
    summary = {"interactive_launch_ms": stats(timings), "failed_runs": len(results) - len(timings),
               "requested_runs": args.runs, "recorded_runs": len(results),
               "sample_requirement_met": len(timings) >= 20 and len(timings) == len(results),
               "suggested_p95_budget_ms": 2000, "budget_comparison": "not eligible"}
    if summary["sample_requirement_met"] and args.build == "release":
        summary["budget_comparison"] = "within suggested budget" if summary["interactive_launch_ms"]["p95"] <= 2000 else "above suggested budget"
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))


if __name__ == "__main__":
    main()
