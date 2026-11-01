#!/usr/bin/env python3
"""One explicitly gated launch; otherwise read-only ownership/fixture receipts.

PREPARED ONLY. Do not execute until root confirms the exact launch flag.
No signal, GUI API, network probe, remote Git, app copy, resign, or restoration.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

WORK = Path(__file__).resolve().parent
ROOT = WORK.parent.parent
OUT = ROOT / "docs/verification/results/offline-boundary-native-20261102/owner"
EXPECTED_SHA = "4d4bca76055afb46f403811035a718b2b8a8f892ca2e7e8ddc5ed2c5dbe5a135"
MAIN = Path("/Users/chenpengxiang/Applications/Horizon.app/Contents/MacOS/horizon-desktop")
PROFILE = "(version 1)(allow default)(deny network*)"


def utc():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def prepared():
    data = json.loads((WORK / "fixture-prepared.json").read_text())
    if data["installed"]["main"] != str(MAIN) or data["installed"]["expectedMainSha256"] != EXPECTED_SHA:
        raise RuntimeError("Prepared original installed identity differs")
    return data


def write_new(name, value):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / name
    with path.open("x") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    return path


def git_environment():
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update(GIT_CONFIG_GLOBAL="/dev/null", GIT_CONFIG_SYSTEM="/dev/null",
               GIT_CONFIG_NOSYSTEM="1", GIT_TERMINAL_PROMPT="0")
    return env


def fixture_snapshot(data):
    directory = Path(data["fixture"]["root"])
    def git(*args):
        result = subprocess.run(["rtk", "proxy", "/usr/bin/git", "--no-optional-locks", "-C", str(directory), *args],
                                env=git_environment(), capture_output=True, text=True, timeout=15)
        result.check_returncode()
        return result.stdout
    files = []
    for original in data["fixture"]["files"]:
        path = directory / original["relativePath"]
        files.append({"relativePath": original["relativePath"], "bytes": path.stat().st_size,
                      "sha256": digest(path), "mode": oct(path.stat().st_mode & 0o777)})
    text = (directory / "offline.txt").read_text()
    return {"root": str(directory), "files": files, "sourceText": text,
            "markerCount": text.count(data["fixture"]["nativeAppendMarker"]),
            "head": git("rev-parse", "HEAD").strip(),
            "branch": git("symbolic-ref", "--short", "HEAD").strip(),
            "statusPorcelain": git("status", "--porcelain=v1"),
            "indexLogical": git("ls-files", "--stage"),
            "remotes": git("remote", "-v"),
            "role": "Owner local read-only verification outside sandbox; not native functional evidence"}


def metrics_and_rows():
    sys.path.insert(0, str(ROOT / "scripts/desktop"))
    from mac_metrics import MacMetrics
    metrics = MacMetrics()
    rows = metrics.processes()
    if not rows:
        raise RuntimeError("Process table unavailable; cannot infer absence")
    return metrics, rows


def identity(metrics, row):
    measured = metrics.read(row, time.monotonic())
    keep = ("pid", "ppid", "uid", "start", "executable", "start_abstime")
    return {key: measured.get(key) for key in keep}


def same_process(left, right):
    return (left.get("pid"), left.get("start_abstime"), left.get("start"), left.get("executable")) == (
        right.get("pid"), right.get("start_abstime"), right.get("start"), right.get("executable"))


def ownership(launch):
    metrics, rows = metrics_and_rows()
    ledger_path = OUT / "seen-owned.json"
    known = json.loads(ledger_path.read_text()) if ledger_path.exists() else []
    selected = {}
    main = launch["mainIdentity"]
    row = rows.get(main["pid"])
    if row and same_process(identity(metrics, row), main):
        selected[main["pid"]] = "exact launched main PID/birth/path"
    for old in known:
        row = rows.get(old["pid"])
        if row and same_process(identity(metrics, row), old):
            selected[old["pid"]] = "previously observed owned identity; same birth/path"
    changed = True
    while changed:
        changed = False
        for pid, row in rows.items():
            if pid in selected:
                continue
            if row["ppid"] in selected:
                selected[pid] = "ordinary child of owned process"
                changed = True
            elif row["uid"] == os.getuid() and metrics.responsible_pid(pid) in selected:
                selected[pid] = "macOS responsibility only; sandbox inheritance NOT inferred"
                changed = True
    current = [{**identity(metrics, rows[pid]), "ownershipReason": reason} for pid, reason in selected.items()]
    keys = {(item["pid"], item.get("start_abstime"), item["start"], item["executable"]): item for item in known}
    for item in current:
        keys[(item["pid"], item.get("start_abstime"), item["start"], item["executable"])] = item
    ledger_path.write_text(json.dumps(list(keys.values()), ensure_ascii=False, indent=2) + "\n")
    all_mains = [identity(metrics, row) for row in rows.values()
                 if (metrics.executable_path(row["pid"]) or row["executable"]) == str(MAIN)]
    bundle_rows = [identity(metrics, row) for row in rows.values()
                   if (metrics.executable_path(row["pid"]) or row["executable"]).startswith(str(MAIN.parent.parent) + "/")]
    return {"currentOwned": current, "allObservedOwned": list(keys.values()), "currentExactPathMains": all_mains,
            "currentOriginalBundleProcesses": bundle_rows,
            "limits": "Discrete read-only snapshots may miss short Git children. Responsibility is not proof of XPC network denial."}


def launch_once(args):
    if not args.execute_network_denied_horizon_once_4d4:
        raise RuntimeError("Root must confirm --execute-network-denied-horizon-once-4d4; no launch performed")
    data = prepared()
    if digest(MAIN) != EXPECTED_SHA:
        raise RuntimeError("Installed original main SHA differs; no launch")
    for item in data["installed"]["files"]:
        if digest(Path(item["path"])) != item["sha256"]:
            raise RuntimeError("Original installed bundle bytes differ; no launch")
    baseline = fixture_snapshot(data)
    if baseline["head"] != data["fixture"]["head"] or baseline["statusPorcelain"] or baseline["indexLogical"] != data["fixture"]["indexLogical"]:
        raise RuntimeError("Owned fixture no longer at prepared baseline; no reset or launch")
    metrics, rows = metrics_and_rows()
    blockers = [identity(metrics, row) for row in rows.values()
                if Path(metrics.executable_path(row["pid"]) or row["executable"]).name in
                {"horizon-desktop", "horizon-extension-host", "horizon-git", "horizon-rg", "HorizonPicker"}]
    if blockers:
        raise RuntimeError("Existing Horizon main/helper found; no concurrent launch: " + json.dumps(blockers))
    argv = ["/usr/bin/sandbox-exec", "-p", PROFILE, str(MAIN)]
    claim = {"claimedAt": utc(), "argv": argv, "expectedMainSha256": EXPECTED_SHA,
             "fixtureBeforeLaunch": baseline, "authority": "Explicit root-confirmed CLI flag only",
             "notStartup20": True, "globalNetworkConfigurationChanged": False}
    write_new("launch-claim.json", claim)  # All failures retain this one-shot claim; never retry automatically.
    with (OUT / "launch.stdout.txt").open("xb") as stdout, (OUT / "launch.stderr.txt").open("xb") as stderr:
        child = subprocess.Popen(argv, cwd=data["fixture"]["root"], env=git_environment(),
                                 stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, start_new_session=True)
    end = time.monotonic() + 15
    main_identity = None
    while time.monotonic() < end and child.poll() is None:
        metrics, rows = metrics_and_rows()
        row = rows.get(child.pid)
        if row and (metrics.executable_path(child.pid) or row["executable"]) == str(MAIN):
            main_identity = identity(metrics, row)
            break
        time.sleep(.05)
    result = {**claim, "observedAt": utc(), "launcherPid": child.pid, "launcherExitObserved": child.poll(),
              "mainIdentity": main_identity,
              "status": "main_identity_observed_not_GUI_ready" if main_identity else "launch_failed_or_identity_unconfirmed",
              "limits": "No AX/UI probe or network request. Tool return is not app exit/ready or offline proof. No retry/signal."}
    write_new("launch.json", result)
    print(json.dumps(result, ensure_ascii=False))
    if main_identity is None:
        raise SystemExit(1)


def record(args):
    data = prepared()
    launch = json.loads((OUT / "launch.json").read_text())
    if not launch.get("mainIdentity"):
        raise RuntimeError("No confirmed launched identity; record launch failure as-is")
    receipt = {"recordedAt": utc(), "stage": args.stage, "launchMain": launch["mainIdentity"],
               "ownership": ownership(launch), "fixture": fixture_snapshot(data),
               "role": "Read-only process/fixture evidence; native images/AX and actual fetch failure remain Terra's evidence"}
    if args.stage == "after-quit":
        receipt["installedAfter"] = [{**item, "actualSha256": digest(Path(item["path"]))} for item in data["installed"]["files"]]
        receipt["allObservedOwnedGone"] = not receipt["ownership"]["currentOwned"] and not receipt["ownership"]["currentOriginalBundleProcesses"]
    path = write_new(args.stage + ".json", receipt)
    print(json.dumps({"receipt": str(path), "data": receipt}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    launch = sub.add_parser("launch")
    launch.add_argument("--execute-network-denied-horizon-once-4d4", action="store_true")
    snapshot = sub.add_parser("record")
    snapshot.add_argument("--stage", choices=["after-save", "after-fetch", "after-local-recheck", "after-quit"], required=True)
    args = parser.parse_args()
    launch_once(args) if args.action == "launch" else record(args)


if __name__ == "__main__":
    main()
