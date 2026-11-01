#!/usr/bin/env python3
"""Compare macOS DMG/ZIP contents with a release bundle without launching it."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import plistlib
import stat
import subprocess
import tempfile


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def manifest(bundle: Path) -> dict:
    result = {}
    for directory, directories, files in os.walk(bundle, followlinks=False):
        for name in sorted(directories + files):
            item = Path(directory) / name
            metadata = item.lstat()
            record = {"mode": oct(stat.S_IMODE(metadata.st_mode))}
            if item.is_symlink():
                record.update(type="symlink", target=os.readlink(item))
            elif item.is_file():
                record.update(type="file", bytes=metadata.st_size, sha256=sha256(item))
            elif item.is_dir():
                record.update(type="directory")
            else:
                record.update(type="other")
            result[item.relative_to(bundle).as_posix()] = record
    return dict(sorted(result.items()))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--dmg", type=Path, required=True)
    parser.add_argument("--zip", dest="archive", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True, help="New evidence directory")
    args = parser.parse_args()
    if platform.system() != "Darwin":
        parser.error("Run on macOS")
    for source in (args.bundle, args.dmg, args.archive):
        if not source.exists():
            parser.error(f"Missing input: {source}")
    args.output.mkdir(parents=True, exist_ok=False)
    report = {
        "recordedAt": datetime.now(timezone.utc).isoformat(),
        "baselineBundle": str(args.bundle.resolve()),
        "packageHashes": {"dmg": sha256(args.dmg), "zip": sha256(args.archive)},
        "packages": {}, "commands": [], "complete": False,
        "limitations": ["Integrity and signature verification only; no application launch or GUI acceptance.",
                       "Ad-hoc code signing verification does not establish Developer ID or notarization.",
                       "Extended attributes are not part of the byte/mode manifest; codesign checks signed resources."],
    }

    def run(label: str, command: list[str]) -> bytes:
        began = datetime.now(timezone.utc).isoformat()
        completed = subprocess.run(command, capture_output=True, timeout=120)
        (args.output / f"{label}.stdout").write_bytes(completed.stdout)
        (args.output / f"{label}.stderr").write_bytes(completed.stderr)
        report["commands"].append({"label": label, "argv": command, "startedAt": began,
                                   "finishedAt": datetime.now(timezone.utc).isoformat(),
                                   "exitCode": completed.returncode})
        if completed.returncode:
            raise RuntimeError(f"{label} exited {completed.returncode}; see saved output")
        return completed.stdout

    try:
        expected = manifest(args.bundle)
        (args.output / "baseline-files.json").write_text(json.dumps(expected, indent=2) + "\n")
        report["baselineManifestSha256"] = sha256(args.output / "baseline-files.json")
        info = plistlib.loads((args.bundle / "Contents/Info.plist").read_bytes())
        report["baselineExecutableSha256"] = sha256(args.bundle / "Contents/MacOS" / info["CFBundleExecutable"])
        run("baseline-codesign", ["/usr/bin/codesign", "--verify", "--deep", "--strict", str(args.bundle)])

        def compare(kind: str, folder: Path) -> None:
            app = folder / args.bundle.name
            actual = manifest(app)
            (args.output / f"{kind}-files.json").write_text(json.dumps(actual, indent=2) + "\n")
            result = {
                "bundlePath": str(app), "exactBaselineMatch": actual == expected,
                "missing": sorted(expected.keys() - actual.keys()),
                "extra": sorted(actual.keys() - expected.keys()),
                "different": sorted(key for key in expected.keys() & actual.keys() if expected[key] != actual[key]),
                "regularFileCount": sum(row["type"] == "file" for row in actual.values()),
                "totalFileBytes": sum(row.get("bytes", 0) for row in actual.values()),
                "topLevelEntries": sorted(item.name for item in folder.iterdir()),
                "topLevelSymlinks": {item.name: os.readlink(item) for item in folder.iterdir() if item.is_symlink()},
                "bundleNeverLaunched": True,
            }
            report["packages"][kind] = result
            run(f"{kind}-codesign", ["/usr/bin/codesign", "--verify", "--deep", "--strict", str(app)])
            if not result["exactBaselineMatch"]:
                raise RuntimeError(f"{kind} differs from release bundle")

        run("dmg-verify", ["/usr/bin/hdiutil", "verify", str(args.dmg)])
        with tempfile.TemporaryDirectory(prefix="horizon-package-audit-") as temporary:
            stage = Path(temporary)
            mount = stage / "dmg"
            mount.mkdir()
            attached = False
            try:
                run("dmg-attach", ["/usr/bin/hdiutil", "attach", "-readonly", "-nobrowse", "-noautoopen",
                                   "-plist", "-mountpoint", str(mount), str(args.dmg)])
                attached = True
                compare("dmg", mount)
            finally:
                if attached:
                    run("dmg-detach", ["/usr/bin/hdiutil", "detach", str(mount)])
                    report["dmgDetached"] = True
            extraction = stage / "zip"
            extraction.mkdir()
            run("zip-test", ["/usr/bin/unzip", "-t", str(args.archive)])
            run("zip-extract", ["/usr/bin/ditto", "-x", "-k", str(args.archive), str(extraction)])
            compare("zip", extraction)
        report["temporaryFilesRemoved"] = True
        report["complete"] = True
    except Exception as error:
        report["error"] = str(error)
        raise
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        (args.output / "audit.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"output": str(args.output), "complete": report["complete"], "error": report.get("error")}))


if __name__ == "__main__":
    main()
