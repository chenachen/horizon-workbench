#!/usr/bin/env python3
"""Verify evidence tooling against real temporary data and macOS counters, without GUI input."""
from __future__ import annotations

import argparse
import ast
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

from mac_metrics import MacMetrics, environment

ROOT = Path(__file__).resolve().parents[2]


def run(argv: list[str]) -> str:
    result = subprocess.run(argv, cwd=ROOT, capture_output=True, text=True, timeout=60)
    if result.returncode:
        raise RuntimeError(f"{argv[0]} exited {result.returncode}: {result.stderr[-1500:] or result.stdout[-1500:]}")
    return result.stdout.strip()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", type=Path, help="Existing full fixture directory from fixtures.py")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = {"schema_version": 1, "scope": "tool self-check only; NOT Horizon application acceptance",
              "environment": environment(), "checks": {}}
    for path in (ROOT / "scripts/desktop").glob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    report["checks"]["python_syntax"] = "pass"
    for tool in ["acceptance_matrix.py", "visual_matrix.py"]:
        report["checks"][tool] = json.loads(run([sys.executable, str(ROOT / "scripts/desktop" / tool), "--check"]))
    metrics = MacMetrics()
    process = metrics.processes()[os.getpid()]
    first = metrics.read(process, time.monotonic())
    python_first = time.process_time_ns()
    until = python_first + 200_000_000
    while time.process_time_ns() < until:
        pass
    python_last = time.process_time_ns()
    last = metrics.read(process, time.monotonic())
    ratio = (last["cpu_ns"] - first["cpu_ns"]) / (python_last - python_first)
    if not .9 < ratio < 1.1:
        raise RuntimeError(f"Mach CPU conversion differs from process_time_ns: {ratio}")
    report["checks"]["cpu_timebase"] = {"numer": metrics.timebase.numer, "denom": metrics.timebase.denom,
                                        "libproc_delta_ns": last["cpu_ns"] - first["cpu_ns"],
                                        "python_delta_ns": python_last - python_first, "ratio": ratio, "status": "pass"}
    temporary = Path(tempfile.mkdtemp(prefix="horizon-tools-check-"))
    child = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    try:
        time.sleep(.15)
        row = metrics.read(metrics.processes()[child.pid], time.monotonic())
        footprint = run(["footprint", "-p", str(child.pid), "--noCategories", "-f", "bytes"])
        match = re.search(r"phys_footprint:\s+(\d+) B", footprint)
        if not match:
            raise RuntimeError("System footprint did not provide phys_footprint")
        difference = abs(int(match[1]) - row["footprint_bytes"])
        if difference > 1024 * 1024:
            raise RuntimeError(f"Sleeping process accounting differs by {difference} bytes")
        report["checks"]["footprint_crosscheck"] = {"libproc_bytes": row["footprint_bytes"], "system_bytes": int(match[1]),
                                                    "difference_bytes": difference, "raw": footprint, "status": "pass"}
        run([sys.executable, str(ROOT / "scripts/desktop/sample_macos.py"), "--pid", str(child.pid),
             "--output", str(temporary / "sample"), "--scenario", "sleeping Python collector self-check",
             "--build", "collector-self-check", "--duration", "2", "--interval", ".5"])
        report["checks"]["sampling"] = json.loads((temporary / "sample/summary.json").read_text())
        report["checks"]["sampling"]["raw_directory"] = str(temporary / "sample")
        probe = temporary / "ax-probe"
        run(["xcrun", "swiftc", str(ROOT / "scripts/desktop/ax_probe.swift"), "-o", str(probe)])
        report["checks"]["native_permissions"] = json.loads(run([str(probe), "--environment"]))
        unready = subprocess.run([str(probe), "--pid", str(child.pid), "--label", "添加本地项目"],
                                 capture_output=True, text=True, timeout=5)
        if unready.returncode != 1:
            raise RuntimeError(f"Readiness unexpectedly accepted non-GUI process: {unready.returncode}")
        report["checks"]["native_probe_no_false_ready"] = {"exit_code": unready.returncode, "raw": unready.stdout, "status": "pass"}
    finally:
        child.terminate()
        child.wait(timeout=5)
    if args.fixture:
        root = args.fixture.resolve()
        manifest = json.loads((root / "fixture.json").read_text())
        if manifest["profile"] != "full":
            raise RuntimeError("Full pressure fixture expected")
        actual = {label: sum(1 for _ in (root / label).rglob("*.ts")) for label in ["paths-10k", "paths-100k"]}
        if actual != {"paths-10k": 10_000, "paths-100k": 100_000}:
            raise RuntimeError(f"Wrong pressure path counts: {actual}")
        actual["wide-directory"] = len(list((root / "wide-directory").iterdir()))
        if actual["wide-directory"] != 10_000:
            raise RuntimeError("Wide directory must have 10,000 siblings")
        sizes = {f"text-{mib}MiB.txt": (root / "large-files" / f"text-{mib}MiB.txt").stat().st_size for mib in [10, 50, 101]}
        if any(size != int(name.split("-")[1].split("MiB")[0]) * 1024 * 1024 for name, size in sizes.items()):
            raise RuntimeError("Large file byte counts differ")
        git = lambda *argv: run(["git", "-C", str(root / "git-stress"), *argv])
        baseline = {"HEAD": git("show", "HEAD:dual-baseline.txt"), "index": git("show", ":dual-baseline.txt"),
                    "disk": (root / "git-stress/dual-baseline.txt").read_text().strip()}
        if baseline != {"HEAD": "A: HEAD", "index": "B: index", "disk": "C: working tree"}:
            raise RuntimeError(f"Git baselines differ: {baseline}")
        report["checks"]["fixture"] = {"root": str(root), "generator_version": manifest["generator_version"],
                                         "seed": manifest["seed"], "paths": actual, "sizes": sizes, "git_baselines": baseline,
                                         "git_status_rows": len(git("status", "--porcelain").splitlines()), "status": "pass"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"output": str(args.output), "scope": report["scope"], "checks": list(report["checks"]), "status": "pass"}))


if __name__ == "__main__":
    main()
