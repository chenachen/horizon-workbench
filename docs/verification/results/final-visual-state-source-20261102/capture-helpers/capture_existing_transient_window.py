#!/usr/bin/env python3
"""Passive, single-event existing-window PNG burst. Never launches or inputs to Horizon."""
from __future__ import annotations
import argparse
import ctypes
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/desktop"))
from mac_metrics import MacMetrics, RUsage


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--executable", type=Path, required=True)
    parser.add_argument("--expected-sha256", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--pid", type=int, required=True)
    parser.add_argument("--start-abstime", type=int, required=True)
    parser.add_argument("--probe", type=Path, default=ROOT / ".work/final-startup-watch-20261101/probe/horizon-ax-probe")
    parser.add_argument("--wait-seconds", type=float, default=30)
    parser.add_argument("--capture-seconds", type=float, default=8)
    parser.add_argument("--max-frames", type=int, default=120)
    args = parser.parse_args()
    if not (0 < args.wait_seconds <= 30 and 0 < args.capture_seconds <= 8 and 1 <= args.max_frames <= 120):
        parser.error("Caps: wait <=30s, capture <=8s, frames <=120; all positive")
    executable = args.executable.resolve(strict=True)
    probe = args.probe.resolve(strict=True)
    if not executable.is_file() or not probe.is_file() or not Path("/usr/sbin/screencapture").is_file():
        parser.error("Existing exact executable, probe and system screencapture required")
    if digest(executable) != args.expected_sha256.lower():
        parser.error("Installed executable SHA256 does not match the authorized new bundle")
    args.output.mkdir(parents=True, exist_ok=False)
    metrics = MacMetrics()
    absolute = metrics.system.mach_absolute_time
    absolute.argtypes, absolute.restype = [], ctypes.c_uint64
    events = (args.output / "events.jsonl").open("x")
    frames = []
    target = window = arm = None
    failure = None
    terminal = "not_armed"

    def clock():
        return {"utc": datetime.now(timezone.utc).isoformat(), "utc_ns": time.time_ns(),
                "monotonic_ns": time.monotonic_ns(), "mach_ticks": absolute()}

    def emit(kind, **data):
        row = {"event": kind, **data}
        events.write(json.dumps(row, ensure_ascii=False) + "\n")
        events.flush()
        if kind in {"armed", "process_seen", "window_bound", "failed", "finished"}:
            print(json.dumps(row, ensure_ascii=False), flush=True)

    def identity(row):
        path = metrics.executable_path(row["pid"])
        if not path or Path(path).resolve() != executable:
            return None
        usage = RUsage()
        if metrics.lib.proc_pid_rusage(row["pid"], 2, ctypes.byref(usage)) or not usage.proc_start_abstime:
            raise RuntimeError("Exact target birth identity unavailable")
        return {**row, "executable": str(executable), "start_abstime": usage.proc_start_abstime}

    def discover(timeout):
        result = subprocess.run(["/bin/ps", "-axo", "pid=,ppid=,uid=,lstart=,comm="],
                                capture_output=True, text=True, timeout=timeout)
        if result.returncode or not result.stdout.strip():
            raise RuntimeError("Process table unavailable; no target exit inferred")
        found = []
        for line in result.stdout.splitlines():
            part = line.split(None, 8)
            if len(part) != 9 or int(part[2]) != os.getuid() or Path(part[8]).name != executable.name:
                continue
            row = identity({"pid": int(part[0]), "ppid": int(part[1]), "uid": int(part[2]),
                            "start": " ".join(part[3:8])})
            if row:
                found.append(row)
        if len(found) > 1:
            raise RuntimeError("Multiple processes use the exact installed executable")
        return found

    def probe_json(argv, timeout):
        begin = clock()
        result = subprocess.run([str(probe), *argv], capture_output=True, text=True, timeout=timeout)
        end = clock()
        emit("probe", argv=argv, begin=begin, end=end, returncode=result.returncode,
             stdout=result.stdout, stderr=result.stderr)
        if result.returncode:
            raise RuntimeError("Read-only probe failed; no retry or permission request")
        return json.loads(result.stdout)

    def main_windows(info):
        return [w for w in info if w.get("kCGWindowOwnerPID") == target["pid"]
                and w.get("kCGWindowLayer") == 0 and w.get("kCGWindowIsOnscreen")
                and w.get("kCGWindowBounds", {}).get("Width", 0) > 0
                and w.get("kCGWindowBounds", {}).get("Height", 0) > 0]

    metadata = {"mode": "passive existing-window event; Terra owns the separately authorized native click",
                "executable": str(executable), "expected_sha256": args.expected_sha256.lower(),
                "probe": str(probe), "probe_sha256": digest(probe),
                "mac_metrics_source_sha256": digest(ROOT / "scripts/desktop/mac_metrics.py"),
                "wait_cap_seconds": args.wait_seconds, "capture_cap_seconds": args.capture_seconds,
                "frame_cap": args.max_frames, "no_target_launch_input_signal_or_permission_request": True,
                "time_limit": "Requested deadlines include subprocess work; actual call start/end retained",
                "frame_time": "Capture occurs within command begin/end, not an invented exact paint timestamp"}
    (args.output / "metadata.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    try:
        permission = probe_json(["--environment"], 2)
        if permission.get("screenCaptureAllowed") is not True:
            raise RuntimeError("Screen capture permission unavailable; no prompt/change attempted")
        baseline = discover(2)
        emit("baseline", clock=clock(), exact_processes=baseline)
        if len(baseline) != 1 or baseline[0]["pid"] != args.pid or baseline[0]["start_abstime"] != args.start_abstime:
            raise RuntimeError("Exact existing main PID/birth differs from the authorized event")
        target = baseline[0]
        emit("existing_process_bound", clock=clock(), identity=target)
        arm = clock()
        deadline = arm["monotonic_ns"] + int(args.wait_seconds * 1e9)
        emit("armed", clock=arm, installed_sha256=args.expected_sha256.lower())
        while time.monotonic_ns() < deadline:
            remaining = (deadline - time.monotonic_ns()) / 1e9
            if target is None:
                found = discover(min(1, max(.001, remaining)))
                if found:
                    target = found[0]
                    if target["start_abstime"] < arm["mach_ticks"]:
                        raise RuntimeError("Target predates arm; no substitute launch accepted")
                    emit("process_seen", clock=clock(), identity=target)
            if target:
                current = identity({k: target[k] for k in ("pid", "ppid", "uid", "start")})
                if not current or current["start_abstime"] != target["start_abstime"]:
                    raise RuntimeError("Bound process exited or changed; no reacquire/relaunch")
                remaining = (deadline - time.monotonic_ns()) / 1e9
                if remaining <= 0:
                    break
                candidates = main_windows(probe_json(["--pid", str(target["pid"]), "--windows"], min(1, remaining)))
                if time.monotonic_ns() >= deadline:
                    break
                if len(candidates) > 1:
                    raise RuntimeError("Ambiguous visible layer0 window; no guessed selection")
                if candidates:
                    window = candidates[0]
                    emit("window_bound", clock=clock(), identity=target, window=window)
                    break
            time.sleep(min(.02, max(0, (deadline - time.monotonic_ns()) / 1e9)))
        if window is None:
            raise RuntimeError("Fresh PID/window wait cap reached; no launch/retry performed")
        start = clock()
        capture_deadline = start["monotonic_ns"] + int(args.capture_seconds * 1e9)
        for index in range(1, args.max_frames + 1):
            remaining = (capture_deadline - time.monotonic_ns()) / 1e9
            if remaining <= 0:
                terminal = "capture_time_cap"
                break
            current = identity({k: target[k] for k in ("pid", "ppid", "uid", "start")})
            if not current or current["start_abstime"] != target["start_abstime"]:
                raise RuntimeError("Bound process changed during burst; no other process captured")
            remaining = (capture_deadline - time.monotonic_ns()) / 1e9
            if remaining <= 0:
                terminal = "capture_time_cap"
                break
            frame_path = args.output / f"frame-{index:04d}.png"
            argv = ["/usr/sbin/screencapture", "-x", "-o", "-t", "png", "-l",
                    str(window["kCGWindowNumber"]), str(frame_path)]
            begin = clock()
            remaining = (capture_deadline - begin["monotonic_ns"]) / 1e9
            if remaining <= 0:
                terminal = "capture_time_cap"
                break
            timed_out = False
            try:
                result = subprocess.run(argv, capture_output=True, timeout=remaining)
                code, stdout, stderr = result.returncode, result.stdout, result.stderr
            except subprocess.TimeoutExpired as exc:
                timed_out, code, stdout, stderr = True, None, exc.stdout or b"", exc.stderr or b""
            end = clock()
            raw = frame_path.read_bytes() if frame_path.exists() else b""
            png = len(raw) >= 24 and raw[:8] == b"\x89PNG\r\n\x1a\n" and raw[12:16] == b"IHDR"
            dimensions = list(struct.unpack(">II", raw[16:24])) if png else None
            bounds = window["kCGWindowBounds"]
            frame = {"frame": index, "capture_method": "screencapture-window",
                     "bound_main_sha256": args.expected_sha256.lower(),
                     "begin": begin, "end": end, "returncode": code,
                     "timed_out": timed_out, "pid": target["pid"], "start_abstime": target["start_abstime"],
                     "window_id": window["kCGWindowNumber"], "bound_window_bounds": bounds,
                     "file": str(frame_path), "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(),
                     "png_dimensions": dimensions, "pixel_ratio_xy": [dimensions[0] / bounds["Width"], dimensions[1] / bounds["Height"]] if png else None,
                     "stdout": stdout.decode(errors="replace"), "stderr": stderr.decode(errors="replace")}
            frames.append(frame)
            emit("frame", **frame)
            if timed_out or code != 0 or not png:
                raise RuntimeError("Capture timeout/error/invalid PNG; original bytes kept, no retry")
        else:
            terminal = "frame_count_cap"
        if digest(executable) != args.expected_sha256.lower():
            raise RuntimeError("Installed binary changed during observation; no stable-build claim")
        final_info = probe_json(["--pid", str(target["pid"]), "--windows"], 1)
        emit("final_window_observation", clock=clock(), windows=final_info,
             same_window=[w for w in final_info if w.get("kCGWindowNumber") == window["kCGWindowNumber"]])
    except Exception as exc:
        failure, terminal = f"{type(exc).__name__}: {exc}", "failed"
        emit("failed", clock=clock(), error=failure)
    summary = {"finished": clock(), "terminal": terminal, "failure": failure,
               "armed": arm, "identity": target, "bound_window": window, "frames": frames,
               "raw_frames_unchanged": True, "no_visual_pass_or_caught_transient_claim": True,
               "limits": ["No promised Hz; command/encoding intervals are measured, not subtracted.",
                          "No transient AX claimed; keep real before/after CUA evidence.",
                          "Window bounds sampled at bind/end, not claimed exact for every exposure.",
                          "A failed/deadline-limited attempt is kept, never repeated automatically."]}
    (args.output / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    emit("finished", terminal=terminal, failure=failure, frame_count=len(frames), output=str(args.output))
    events.close()
    return 1 if failure else 0


if __name__ == "__main__":
    raise SystemExit(main())
