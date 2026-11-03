#!/usr/bin/env python3
"""Fail-closed guard for temporary GUI-only debugging of an unchanged binary."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

BASELINE = '313cf2bcb6f0adfb420d0d2b676be63becc200d9'
SOURCE_RUN = '41566650728'
SOURCE_ARTIFACT = '13199174245'
# Build/release/prepare scripts are deliberately NOT permitted: they are product inputs.
HARNESS_FILES = {
    'scripts/linux-native-smoke.py', 'scripts/linux-native-extended.py',
    'scripts/linux-plugin-gui.py', 'scripts/run-linux-desktop-test.sh',
    'scripts/inspect-linux-accessibility.py', 'scripts/check-linux-smoke-js.py',
    'scripts/test-linux-smoke-contract.py', 'scripts/test-linux-desktop-wrapper.py',
    'scripts/verify-linux-gui-reuse.py',
}


def allowed(path):
    return path in HARNESS_FILES or path.startswith(('docs/', '.github/workflows/'))


def git(*args):
    return subprocess.check_output(['git', *args], text=True).strip()


def verify_source():
    subprocess.run(['git', 'merge-base', '--is-ancestor', BASELINE, 'HEAD'], check=True)
    changed = git('diff', '--name-only', '--no-renames', BASELINE, 'HEAD').splitlines()
    forbidden = [path for path in changed if not allowed(path)]
    if forbidden:
        raise RuntimeError(f'Binary reuse forbidden: product/build inputs changed: {forbidden}')
    # Uncommitted tracked changes must not silently enter the tested harness.
    if git('status', '--porcelain', '--untracked-files=no'):
        raise RuntimeError('Binary reuse requires a clean tracked checkout')
    return {'mode': 'debug-only; NOT final full acceptance', 'binarySourceCommit': BASELINE,
            'harnessCommit': git('rev-parse', 'HEAD'), 'binarySourceRun': SOURCE_RUN,
            'binarySourceArtifact': SOURCE_ARTIFACT, 'allowedChangedFiles': changed}


def verify_artifact(root):
    identity = (root / 'build-identity.txt').read_text().splitlines()
    if f'commit={BASELINE}' not in identity:
        raise RuntimeError('Artifact binary source commit mismatch')
    expected_run = f'run=https://github.com/chenachen/horizon-workbench/actions/runs/{SOURCE_RUN}'
    if expected_run not in identity:
        raise RuntimeError('Artifact source run mismatch')
    packages = {}
    for line in (root / 'SHA256SUMS.txt').read_text().splitlines():
        match = re.fullmatch(r'([0-9a-f]{64})  (Horizon_[A-Za-z0-9_.+-]+\.(?:deb|AppImage))', line)
        if not match:
            raise RuntimeError(f'Unsafe/unexpected package checksum line: {line!r}')
        digest, name = match.groups()
        if name in packages:
            raise RuntimeError('Duplicate package checksum')
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise RuntimeError(f'Invalid package file: {name}')
        with path.open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        if actual != digest:
            raise RuntimeError(f'Package SHA256 mismatch: {name}')
        packages[name] = digest
    if len(packages) != 2 or sum(n.endswith('.deb') for n in packages) != 1 or sum(n.endswith('.AppImage') for n in packages) != 1:
        raise RuntimeError('Expected exactly one Debian and one AppImage checksum')
    return packages


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--artifact', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    report = verify_source()
    if args.artifact:
        report['verifiedPackageSha256'] = verify_artifact(args.artifact)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
