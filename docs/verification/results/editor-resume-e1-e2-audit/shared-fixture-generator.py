#!/usr/bin/env python3
"""Create deterministic disposable macOS acceptance data. Never edits an existing path."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import random
import subprocess
import tempfile
import time

VERSION = 3
MIB = 1024 * 1024


def git(path: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-c", "user.name=Horizon Fixture", "-c", "user.email=fixture@invalid.local",
         "-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "-C", str(path), *args],
        check=True, capture_output=True, text=True,
        env={**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": "/dev/null",
             "GIT_AUTHOR_DATE": "2026-01-01T00:00:00Z", "GIT_COMMITTER_DATE": "2026-01-01T00:00:00Z"},
    )
    return result.stdout.strip()


def sized_text(path: Path, size: int, seed: int) -> None:
    rng = random.Random(seed)
    block = ("// horizon fixture " + str(rng.randrange(10**9)) + "\n").encode()
    block = (block * (65536 // len(block) + 1))[:65536]
    with path.open("wb") as stream:
        while size:
            chunk = block[:min(size, len(block))]
            stream.write(chunk)
            size -= len(chunk)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(MIB), b""):
            digest.update(chunk)
    return digest.hexdigest()


def make_paths(root: Path, count: int, seed: int) -> dict:
    root.mkdir()
    for index in range(count):
        folder = root / f"group-{index // 1000:04d}" / f"module-{index // 100 % 10:02d}"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"file-{index:06d}.ts").write_text(
            f"// seed={seed}, path={index}\nexport const value{index} = 'needle-{index % 97}';\n"
        )
    return {"files": count, "distribution": "100 files per directory; 10 directories per group"}


def create_reading(root: Path, seed: int) -> dict:
    """One Git project with exactly 10,000 files and five openable <=200 KB tabs."""
    started = time.monotonic()
    project = root / "reading-project"
    make_paths(project, 9_995, seed)
    hot_files = []
    for index in range(5):
        path = project / f"hot-{index + 1}.ts"
        sized_text(path, 180 * 1024, seed + index)
        hot_files.append({"path": str(path.relative_to(project)), "bytes": path.stat().st_size,
                          "sha256": sha256(path)})
    git(project, "init", "--initial-branch=main")
    git(project, "add", ".")
    git(project, "commit", "-m", "Deterministic reading workload baseline")
    count = len(git(project, "ls-files").splitlines())
    if count != 10_000:
        raise RuntimeError(f"Reading workload has {count} tracked files, expected 10,000")
    meta = {"generator_version": VERSION, "seed": seed, "profile": "reading", "root": str(root),
            "cases": {"reading": {"project_root": str(project), "tracked_files": count,
                                    "hot_files": hot_files, "git_head": git(project, "rev-parse", "HEAD"),
                                    "git_status": git(project, "status", "--porcelain"),
                                    "budget_file_limit_bytes": 200_000}},
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "generation_seconds": round(time.monotonic() - started, 3)}
    (root / "fixture.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    return meta


def create_review(root: Path, seed: int) -> dict:
    """Fixed diff workload, separate from the 10,000-change stress repository."""
    started = time.monotonic()
    project = root / "review-project"
    project.mkdir()
    paths = [project / f"review-{index:02d}.txt" for index in range(10)]
    for path in paths:
        path.write_text("".join(f"old line {line}\n" for line in range(100)))
    git(project, "init", "--initial-branch=main")
    git(project, "add", ".")
    git(project, "commit", "-m", "Deterministic ten-file review baseline")
    head = git(project, "rev-parse", "HEAD")
    for path in paths:
        path.write_text("".join(f"new line {line}\n" for line in range(100)))
    numstat = git(project, "diff", "--numstat").splitlines()
    changed_lines = sum(int(row.split("\t")[0]) + int(row.split("\t")[1]) for row in numstat)
    if len(numstat) != 10 or changed_lines != 2_000:
        raise RuntimeError("Review workload differs from ten files / 2,000 changed lines")
    meta = {"generator_version": VERSION, "seed": seed, "profile": "review", "root": str(root),
            "cases": {"review": {"project_root": str(project), "tracked_files": 10,
                                   "changed_files": len(numstat), "changed_lines": changed_lines,
                                   "git_head": head, "git_status": git(project, "status", "--porcelain"),
                                   "files": [{"path": path.name, "bytes": path.stat().st_size,
                                              "sha256": sha256(path)} for path in paths]}},
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "generation_seconds": round(time.monotonic() - started, 3)}
    (root / "fixture.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    return meta


def create(root: Path, seed: int, smoke: bool) -> dict:
    started = time.monotonic()
    meta = {"generator_version": VERSION, "seed": seed, "profile": "smoke" if smoke else "full",
            "root": str(root), "cases": {}}
    counts = [100, 1000] if smoke else [10_000, 100_000]
    for label, count in zip(["paths-10k", "paths-100k"], counts):
        meta["cases"][label] = make_paths(root / label, count, seed)
    wide = root / "wide-directory"
    wide.mkdir()
    wide_count = 100 if smoke else 10_000
    for index in range(wide_count):
        (wide / f"sibling-{index:05d}.txt").write_text(f"sibling {index}\n")
    meta["cases"]["wide-directory"] = {"direct_files": wide_count}
    sizes = root / "large-files"
    sizes.mkdir()
    for mib in [10, 50, 101]:
        size = (mib * 1024) if smoke else mib * MIB
        path = sizes / f"text-{mib}MiB.txt"
        sized_text(path, size, seed + mib)
        meta["cases"][path.name] = {"bytes": size, "sha256": sha256(path)}
    for length in [99_999, 100_000, 100_001, 1_000_000]:
        (sizes / f"single-line-{length}.txt").write_text("x" * length + "\n")
    (sizes / "binary.bin").write_bytes(bytes(range(256)) * 4096)
    common = root / "common"
    common.mkdir()
    for i in range(5):
        sized_text(common / f"hot-{i + 1}.ts", 180 * 1024, seed + i)
    for name, contents in {"utf8-bom.txt": b"\xef\xbb\xbfhello\n", "crlf.txt": b"first\r\nsecond\r\n",
                           "no-final-newline.txt": b"first\nlast", "unsupported-latin1.txt": b"caf\xe9\n",
                           "中文 空格.txt": "输入法组合测试：你好 Horizon。\n".encode()}.items():
        (common / name).write_bytes(contents)
    deep = root / "deep"
    for _ in range(120):
        deep /= "d"
    deep.mkdir(parents=True)
    (deep / "leaf.txt").write_text("depth 120\n")
    meta["cases"]["deep"] = {"depth": 120, "relative_leaf": str((deep / "leaf.txt").relative_to(root))}
    (common / "loop").symlink_to(common, target_is_directory=True)
    (common / "missing-target").symlink_to(common / "nonexistent")
    denied = common / "permission-denied"
    denied.mkdir()
    (denied / "secret.txt").write_text("fixture only\n")
    denied.chmod(0)
    meta["cases"]["permission-denied"] = {"path": str(denied), "mode": "000", "cleanup": "chmod 700 before removal"}
    for name in ["project-a", "project-b", "project-c"]:
        project = root / name
        project.mkdir()
        (project / "same-name.txt").write_text(f"{name}\n")
    logs = root / "long-output"
    logs.mkdir()
    output_lines = 1000 if smoke else 100_000
    with (logs / "terminal.log").open("w") as stream:
        for index in range(output_lines):
            stream.write(f"{index:08d} stdout 中文 output " + "x" * 100 + "\n")
    with (logs / "session.jsonl").open("w") as stream:
        for index in range(output_lines // 10):
            stream.write(json.dumps({"index": index, "role": "user" if index % 2 == 0 else "assistant",
                                     "text": "fixture long conversation " + "x" * 1000}) + "\n")
    meta["cases"]["long-output"] = {"terminal_lines": output_lines, "conversation_messages": output_lines // 10,
                                      "note": "Synthetic load data only; never a substitute for a real Pi response"}
    remote = root / "remote.git"
    remote.mkdir()
    git(remote, "init", "--bare", "--initial-branch=main")
    repo = root / "git-stress"
    repo.mkdir()
    git(repo, "init", "--initial-branch=main")
    change_count = 100 if smoke else 10_000
    (repo / "changes").mkdir()
    for i in range(change_count):
        (repo / "changes" / f"change-{i:05d}.txt").write_text(f"base {i}\n")
    (repo / "dual-baseline.txt").write_text("A: HEAD\n")
    diff_lines = 2_000 if smoke else 200_000
    (repo / "large-diff.txt").write_text("".join(f"base line {i}\n" for i in range(diff_lines)))
    for i in range(10):
        (repo / f"review-{i:02d}.txt").write_text("".join(f"old {j}\n" for j in range(100)))
    git(repo, "add", ".")
    git(repo, "commit", "-m", "Deterministic fixture baseline")
    head = git(repo, "rev-parse", "HEAD")
    git(repo, "remote", "add", "origin", str(remote))
    git(repo, "push", "-u", "origin", "main")
    git(root, "clone", str(remote), str(root / "git-peer"))
    (repo / "dual-baseline.txt").write_text("B: index\n")
    git(repo, "add", "dual-baseline.txt")
    (repo / "dual-baseline.txt").write_text("C: working tree\n")
    for i in range(change_count):
        (repo / "changes" / f"change-{i:05d}.txt").write_text(f"changed {i}\n")
    (repo / "large-diff.txt").write_text("".join(f"changed line {i}\n" for i in range(diff_lines)))
    for i in range(10):
        (repo / f"review-{i:02d}.txt").write_text("".join(f"new {j}\n" for j in range(100)))
    (repo / "untracked 中文.txt").write_text("untracked\n")
    meta["cases"]["git"] = {"head": head, "changed_files": change_count, "large_diff_lines_per_side": diff_lines,
                            "review_files": 10, "review_diff_changed_lines": 2000,
                            "dual_baseline": {"HEAD": "A: HEAD", "index": "B: index", "disk": "C: working tree",
                                              "manual_buffer": "D: unsaved buffer (type in application)"},
                            "local_remote": str(remote), "peer": str(root / "git-peer")}
    meta["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    meta["generation_seconds"] = round(time.monotonic() - started, 3)
    (root / "fixture.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n")
    return meta


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="New directory only; default is a unique system temporary directory")
    parser.add_argument("--seed", type=int, default=20261031)
    profiles = parser.add_mutually_exclusive_group()
    profiles.add_argument("--smoke", action="store_true", help="Small generator check; NOT the required pressure dataset")
    profiles.add_argument("--reading-only", action="store_true", help="Dedicated clean Git project: exactly 10,000 paths including five 180 KiB reading tabs")
    profiles.add_argument("--review-only", action="store_true", help="Dedicated Git project: ten changed files with 2,000 added/deleted lines in total")
    args = parser.parse_args()
    if args.output:
        root = args.output.resolve()
        root.mkdir(parents=True, exist_ok=False)
    else:
        root = Path(tempfile.mkdtemp(prefix="horizon-fixture-"))
    meta = (create_reading(root, args.seed) if args.reading_only else
            create_review(root, args.seed) if args.review_only else create(root, args.seed, args.smoke))
    print(json.dumps({"manifest": str(root / "fixture.json"), "profile": meta["profile"],
                      "generation_seconds": meta["generation_seconds"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
