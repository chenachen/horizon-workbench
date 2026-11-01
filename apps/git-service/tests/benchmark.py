#!/usr/bin/env python3
"""Real Git sidecar pressure/cancellation probe. Only temporary repositories mutate."""
import argparse
import hashlib
import json
import os
import platform
import signal
import subprocess
import tempfile
import threading
import time
from pathlib import Path


def git(root, *args):
    result = subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()


def request(binary, root, cache, method, params, cancel_after=None, cancel_ready=None):
    body = json.dumps({"method": method, "root": str(root), "cacheDir": str(cache), "params": params})
    started = time.perf_counter()
    child = subprocess.Popen([str(binary)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, start_new_session=True, text=True)
    output = []
    reader = threading.Thread(target=lambda: output.append(child.communicate(body)), daemon=True)
    reader.start()
    peak = 0
    processes = set()
    cancelled = False
    cancel_sent_at = None
    while child.poll() is None:
        raw = subprocess.run(["ps", "-axo", "pid=,pgid=,rss=,comm="], capture_output=True, text=True).stdout
        total = 0
        for row in raw.splitlines():
            fields = row.split(None, 3)
            if len(fields) >= 4 and fields[1] == str(child.pid):
                total += int(fields[2])
                processes.add(fields[3])
        peak = max(peak, total)
        if cancel_after and not cancelled and time.perf_counter() - started > cancel_after and (cancel_ready is None or cancel_ready.exists()):
            cancel_sent_at = time.perf_counter()
            os.killpg(child.pid, signal.SIGTERM)
            cancelled = True
        time.sleep(.02)
    reader.join()
    elapsed = (time.perf_counter() - started) * 1000
    cancellation = {"cancelSentElapsedMs": round((cancel_sent_at - started) * 1000, 2), "cancelToExitObservedMs": round((time.perf_counter() - cancel_sent_at) * 1000, 2)} if cancel_sent_at else {}
    stdout, stderr = output[0]
    lines = [json.loads(line) for line in stdout.splitlines() if line.strip()]
    final = next((line for line in reversed(lines) if line.get("type") in ("result", "error")), None)
    return {"durationMs": round(elapsed, 2), "peakProcessGroupRssKiB": peak,
            "processes": sorted(processes), "exitCode": child.returncode, "cancelled": cancelled,
            "result": final, **cancellation}, child.pid


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", type=Path, default=Path(__file__).resolve().parents[1] / "target/release/horizon-git")
    parser.add_argument("--files", nargs="+", type=int, default=[10000, 100000])
    parser.add_argument("--large-mib", type=int, default=50)
    parser.add_argument("--cancel-only", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = {"date": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "platform": platform.platform(),
              "machine": platform.machine(), "git": subprocess.check_output(["git", "--version"], text=True).strip(),
              "binary": str(args.binary.resolve()), "binarySha256": hashlib.sha256(args.binary.read_bytes()).hexdigest(), "sampling": "20ms requested; ps overhead included. RSS sums sidecar and same-process-group Git descendants; no desktop/WebView in this probe.", "cases": []}
    with tempfile.TemporaryDirectory(prefix="horizon-git-pressure-") as temporary:
        base = Path(temporary)
        for count in ([] if args.cancel_only else args.files):
            root = base / f"files-{count}"
            root.mkdir()
            git(root, "init", "-b", "main")
            for n in range(count):
                directory = root / f"group-{n // 1000:04d}"
                directory.mkdir(exist_ok=True)
                (directory / f"文件-{n:06d}.txt").write_text(f"line {n}\n")
            row, _ = request(args.binary, root, base / "cache", "git_status", {"refresh": True})
            data = row.pop("result")
            assert data["type"] == "result", data
            row.update({"case": "status", "fileCount": count, "returnedFiles": len(data["data"]["files"]), "truncated": data["data"]["truncated"]})
            assert row["returnedFiles"] <= 10000
            report["cases"].append(row)
        root = base / "large"
        root.mkdir()
        git(root, "init", "-b", "main")
        with (root / "large.txt").open("w") as file:
            chunk = "long line " + "x" * 100000 + "\n"
            for _ in range(args.large_mib * 1024 * 1024 // len(chunk) + 1):
                file.write(chunk)
        if not args.cancel_only:
            row, _ = request(args.binary, root, base / "cache", "git_diff", {"path": "large.txt", "base": "indexToWorktree"})
            data = row.pop("result")
            assert data["type"] == "result", data
            row.update({"case": "largeDiff", "diskBytes": (root / "large.txt").stat().st_size, "pageBytes": len(data["data"]["patch"].encode()), "truncated": data["data"]["truncated"], "nextCursor": data["data"]["nextCursor"] is not None})
            assert row["pageBytes"] <= 128 * 1024
            if args.large_mib > 16:
                assert row["truncated"]
            report["cases"].append(row)
        # A real hook creates a descendant to prove process-group cancellation.
        git(root, "config", "user.name", "Horizon Test")
        git(root, "config", "user.email", "horizon@example.invalid")
        git(root, "add", ".")
        hook = root / ".git/hooks/pre-commit"
        hook.write_text("#!/bin/sh\necho started > .git/horizon-hook-started\nsleep 30\n")
        hook.chmod(0o755)
        state, _ = request(args.binary, root, base / "cache", "git_status", {})
        token = state["result"]["data"]["repoToken"]
        row, pgid = request(args.binary, root, base / "cache", "git_mutate", {"operation": "commit", "message": "cancel probe", "paths": ["large.txt"], "expectedRepoToken": token}, cancel_after=.35, cancel_ready=root / ".git/horizon-hook-started")
        row.pop("result")
        time.sleep(.1)
        alive = subprocess.run(["pgrep", "-g", str(pgid)], capture_output=True, text=True).stdout.strip()
        row.update({"case": "cancelProcessGroup", "hookStartedBeforeCancel": (root / ".git/horizon-hook-started").exists(), "remainingProcessIds": alive.splitlines() if alive else [], "headCreated": subprocess.run(["git", "-C", str(root), "rev-parse", "--verify", "HEAD"], capture_output=True).returncode == 0})
        assert not alive and not row["headCreated"]
        report["cases"].append(row)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
