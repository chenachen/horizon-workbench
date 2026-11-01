#!/usr/bin/env python3
"""Measure the release QuickJS sidecar, separately from the full desktop footprint."""
import argparse
import hashlib
import json
import math
import pathlib
import platform
import statistics
import struct
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument("--binary", default=str(pathlib.Path(__file__).parent / "target/release/horizon-extension-host"))
parser.add_argument("--output", default=str(pathlib.Path(__file__).parent / "evidence/release-sidecar.json"))
args = parser.parse_args()
binary = pathlib.Path(args.binary).resolve()


def send(process, value):
    data = json.dumps(value, ensure_ascii=False).encode()
    process.stdin.write(struct.pack(">I", len(data)) + data)
    process.stdin.flush()


def receive(process):
    length = process.stdout.read(4)
    if len(length) != 4:
        raise RuntimeError("sidecar disconnected")
    return json.loads(process.stdout.read(struct.unpack(">I", length)[0]))


def activate(label, source="export function activate() {}"):
    started = time.perf_counter()
    process = subprocess.Popen([str(binary)], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env={})
    send(process, {"type": "hello", "protocolVersion": 1, "hostEpoch": label, "packageDigest": "measurement"})
    assert receive(process)["hostEpoch"] == label
    send(process, {"type": "request", "id": "activate", "activationHandle": label, "method": "activate", "params": {"source": source, "manifest": {"contributes": {}}}})
    reply = receive(process)
    assert reply["result"]["ok"], reply
    return process, (time.perf_counter() - started) * 1000


def dispose(process, label):
    send(process, {"type": "dispose", "activationHandle": label, "reason": "measurement"})
    while receive(process)["type"] != "disposed":
        pass
    assert process.wait(timeout=2) == 0


def sample(process):
    values = subprocess.check_output(["ps", "-o", "rss=,%cpu=", "-p", str(process.pid)], text=True).split()
    return {"rssKiB": int(values[0]), "cpuPercent": float(values[1])}


def process_count():
    rows = subprocess.check_output(["ps", "-axo", "pid=,comm="], text=True).splitlines()
    return sum(pathlib.Path(row.strip().split(maxsplit=1)[1]).name == "horizon-extension-host" for row in rows if len(row.strip().split(maxsplit=1)) == 2)


before = process_count()
cold = []
for index in range(20):
    child, elapsed = activate(f"cold-{index}")
    cold.append(elapsed)
    dispose(child, f"cold-{index}")

child, _ = activate("idle")
try:
    idle = []
    for _ in range(20):
        time.sleep(0.1)
        idle.append(sample(child))
    second, _ = activate("second", "export function activate() { globalThis.retained = new Uint8Array(20 * 1024 * 1024); retained.fill(1); }")
    try:
        allocated = sample(second)
        simultaneous = process_count()
    finally:
        dispose(second, "second")
finally:
    dispose(child, "idle")

after = process_count()
report = {
    "measuredAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
    "platform": platform.platform(), "architecture": platform.machine(),
    "cpu": subprocess.check_output(["sysctl", "-n", "machdep.cpu.brand_string"], text=True).strip(),
    "binary": str(binary), "binaryBytes": binary.stat().st_size,
    "binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
    "runtime": "rquickjs 0.14.0; 32 MiB heap; 50 ms execution slice; 500 ms operation CPU budget",
    "measurementScope": "Standalone owned sidecars only. RSS from macOS ps; not physical footprint or total Horizon/WebView memory.",
    "beforeProcessCount": before, "afterProcessCount": after,
    "simultaneousProcessCount": simultaneous,
    "coldActivationMs": {"samples": cold, "median": statistics.median(cold), "p95": sorted(cold)[math.ceil(len(cold) * 0.95) - 1]},
    "idle": {"samples": idle, "rssMedianKiB": statistics.median(row["rssKiB"] for row in idle), "rssMaxKiB": max(row["rssKiB"] for row in idle)},
    "retained20MiB": allocated,
    "processesReaped": after == before,
}
output = pathlib.Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({key: report[key] for key in ["beforeProcessCount", "afterProcessCount", "simultaneousProcessCount", "processesReaped"]}))
print(f"Idle RSS {report['idle']['rssMedianKiB'] / 1024:.2f} MiB; activation median {statistics.median(cold):.2f} ms; P95 {report['coldActivationMs']['p95']:.2f} ms")
print(output)
