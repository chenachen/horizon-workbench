#!/usr/bin/env python3
"""Prepare isolated, real repositories for native GUI acceptance.

This script creates preconditions and records disk/Git observations. It never
invokes Horizon IPC or counts setup commands as product acceptance.
"""
import argparse
import hashlib
import json
import os
import platform
import subprocess
import tempfile
import time
from pathlib import Path

FIXTURE_KIND = "horizon-native-git-gui-v1"
ENV = {**os.environ, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
       "GIT_TERMINAL_PROMPT": "0"}


def run(root, *args, expected=(0,)):
    command = ["git", "-C", str(root), *args]
    result = subprocess.run(command, env=ENV, capture_output=True, text=True)
    if result.returncode not in expected:
        raise RuntimeError(f"{command!r}: {result.stderr.strip()}")
    return result.stdout.strip()


def configure(repo):
    for key, value in {"user.name": "地平线 GUI 验收", "user.email": "horizon-gui@example.invalid",
                       "commit.gpgSign": "false", "tag.gpgSign": "false", "core.autocrlf": "false",
                       "core.hooksPath": str(repo / ".git/horizon-empty-hooks")}.items():
        run(repo, "config", key, value)
    (repo / ".git/horizon-empty-hooks").mkdir(exist_ok=True)


def init(repo):
    repo.mkdir()
    run(repo, "init", "-b", "main")
    configure(repo)


def write(repo, relative, text):
    path = repo / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def commit(repo, message):
    run(repo, "add", "--all")
    run(repo, "commit", "-m", message)
    return run(repo, "rev-parse", "HEAD")


def clone(remote, destination):
    result = subprocess.run(["git", "clone", remote.as_uri(), str(destination)], env=ENV,
                            capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    configure(destination)


def fingerprint(path):
    if not path.exists():
        return {"exists": False}
    sha = hashlib.sha256()
    prefix = b""
    with path.open("rb") as handle:
        while data := handle.read(1024 * 1024):
            sha.update(data)
            if len(prefix) < 1024:
                prefix += data[:1024 - len(prefix)]
    return {"exists": True, "byteLength": path.stat().st_size, "sha256": sha.hexdigest(),
            "preview": None if b"\0" in prefix else prefix.decode("utf-8", errors="replace")}


def repo_observation(repo):
    selected = ["src/workspace.ts", "src/message.txt", "src/conflict.txt", "notes.txt",
                "temporary-note.txt", "中文 空格.txt", "docs/rename-old.md", "docs/renamed.md",
                "docs/obsolete.md", "history.txt", "nested/removed.md", "first.txt",
                "assets/pixel.bin", "large-diff.txt", "long-line.txt"]
    return {
        "path": str(repo), "head": run(repo, "rev-parse", "--verify", "HEAD", expected=(0, 128)) or None,
        "branch": run(repo, "symbolic-ref", "--short", "HEAD", expected=(0, 1, 128)) or None,
        "statusV2": run(repo, "status", "--porcelain=v2", "--branch", "--untracked-files=all"),
        "indexEntries": run(repo, "ls-files", "--stage"),
        "stagedPaths": run(repo, "diff", "--cached", "--name-status"),
        "unmerged": run(repo, "ls-files", "--unmerged"),
        "branches": run(repo, "for-each-ref", "--format=%(refname) %(objectname) %(upstream)", "refs/heads", "refs/remotes"),
        "stashes": run(repo, "stash", "list"),
        "recentHistory": run(repo, "log", "-8", "--format=%H %P %s", expected=(0, 128)),
        "workspaceAtHead": run(repo, "show", "HEAD:src/workspace.ts", expected=(0, 128)),
        "workspaceAtIndex": run(repo, "show", ":src/workspace.ts", expected=(0, 128)),
        "files": {name: fingerprint(repo / name) for name in selected if (repo / name).exists() or name in ("src/workspace.ts", "temporary-note.txt", "nested/removed.md")},
        "mergeInProgress": (repo / ".git/MERGE_HEAD").exists(),
    }


def inspect(manifest, label):
    roots = manifest["projects"]
    return {"kind": "fixture-observation", "label": label, "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "platform": platform.platform(), "setupIsNotGuiAcceptance": True,
            "projects": {key: repo_observation(Path(value["path"])) for key, value in roots.items() if value["repository"]},
            "remoteRefs": run(Path(manifest["remotePath"]), "show-ref"),
            "remoteMessage": run(Path(manifest["remotePath"]), "show", "main:src/message.txt"),
            "remoteConflict": run(Path(manifest["remotePath"]), "show", "main:src/conflict.txt"),
            "guiCloneExists": (Path(manifest["cloneParent"]) / manifest["cloneName"]).exists()}


def load_manifest(path):
    manifest = json.loads(path.read_text())
    root = Path(manifest["root"]).resolve()
    marker = json.loads((root / ".horizon-gui-fixture.json").read_text())
    if manifest.get("kind") != FIXTURE_KIND or marker.get("kind") != FIXTURE_KIND or marker["root"] != str(root):
        raise RuntimeError("Not a Horizon GUI fixture; no mutation is allowed")
    for value in manifest["projects"].values():
        Path(value["path"]).resolve().relative_to(root)
    return manifest


def prepare(output):
    if output.exists():
        raise RuntimeError("Manifest already exists. Use another --output to preserve active GUI fixtures.")
    root = Path(tempfile.mkdtemp(prefix="horizon-git-native-gui-", dir="/tmp")).resolve()
    (root / ".horizon-gui-fixture.json").write_text(json.dumps({"kind": FIXTURE_KIND, "root": str(root)}))
    remote = root / "remote.git"
    remote.mkdir()
    run(remote, "init", "--bare", "-b", "main")
    publisher = root / "publisher-control"
    init(publisher)
    write(publisher, "README.md", "# Horizon Git 原生验收夹具\n\n此仓库仅含合成测试内容。\n")
    write(publisher, "src/workspace.ts", "export const version = 'A';\nexport const project = 'horizon-gui';\n")
    write(publisher, "src/message.txt", "remote base A\n")
    write(publisher, "src/conflict.txt", "shared before\nshared base\nshared after\n")
    write(publisher, "docs/obsolete.md", "历史删除文件：此内容应仍可读取。\n")
    write(publisher, "docs/rename-old.md", "重命名应保留来源路径与内容。\n")
    write(publisher, "nested/removed.md", "删除整个目录后的历史文件内容。\n")
    binary = publisher / "assets/pixel.bin"
    binary.parent.mkdir()
    binary.write_bytes(bytes(range(256)))
    base_oid = commit(publisher, "夹具初始提交 A")
    run(publisher, "tag", "fixture-base")
    run(publisher, "remote", "add", "origin", remote.as_uri())
    run(publisher, "push", "--set-upstream", "origin", "main")
    projects = {}
    names = {"review": "01-双基线与提交", "sync": "02-远端同步", "conflict": "03-基本冲突",
             "discard": "04-放弃更改", "history": "05-提交历史", "diffKinds": "06-差异类型",
             "detached": "08-分离HEAD"}
    for key, name in names.items():
        repo = root / name
        clone(remote, repo)
        projects[key] = {"path": str(repo), "displayName": name, "repository": True}

    review = Path(projects["review"]["path"])
    write(review, "src/workspace.ts", "export const version = 'B-index';\nexport const project = 'horizon-gui';\n")
    run(review, "add", "src/workspace.ts")
    write(review, "src/workspace.ts", "export const version = 'C-disk';\nexport const project = 'horizon-gui';\n")
    write(review, "notes.txt", "未跟踪内容，不应随仅暂存提交进入历史。\n")

    discard = Path(projects["discard"]["path"])
    write(discard, "src/workspace.ts", "export const version = 'B-retained-index';\n")
    run(discard, "add", "src/workspace.ts")
    write(discard, "src/workspace.ts", "export const version = 'C-discard-only';\n")
    write(discard, "temporary-note.txt", f"Horizon GUI trash fixture {root.name}\n")

    conflict = Path(projects["conflict"]["path"])
    run(conflict, "switch", "-c", "incoming")
    write(conflict, "src/conflict.txt", "shared before\nincoming stage 3\nshared after\n")
    commit(conflict, "传入侧改动")
    run(conflict, "switch", "main")
    write(conflict, "src/conflict.txt", "shared before\ncurrent stage 2\nshared after\n")
    commit(conflict, "当前侧改动")
    run(conflict, "merge", "incoming", expected=(1,))

    history = Path(projects["history"]["path"])
    for index in range(1, 36):
        write(history, "history.txt", f"历史页面第 {index:02d} 次提交\n")
        commit(history, f"历史验收 {index:02d}：更新记录")
    run(history, "branch", "history/earlier", "HEAD~8")
    run(history, "rm", "nested/removed.md")
    commit(history, "删除 nested 整个目录，保留历史可读")

    kinds = Path(projects["diffKinds"]["path"])
    run(kinds, "mv", "docs/rename-old.md", "docs/renamed.md")
    (kinds / "docs/obsolete.md").unlink()
    (kinds / "assets/pixel.bin").write_bytes(b"\0horizon-gui-binary-change\xff\n")
    write(kinds, "中文 空格.txt", "未跟踪的中文文件，完整路径可扫描。\n")
    write(kinds, "long-line.txt", "长行开始 " + "x" * 120000 + " 长行结束\n")
    chunk = "large diff preview line 0123456789 abcdefghijklmnopqrstuvwxyz\n"
    with (kinds / "large-diff.txt").open("w") as handle:
        for _ in range(18 * 1024 * 1024 // len(chunk) + 1):
            handle.write(chunk)

    detached = Path(projects["detached"]["path"])
    run(detached, "switch", "--detach")
    unborn = root / "07-空仓库"
    init(unborn)
    write(unborn, "first.txt", "首次暂存后取消暂存，磁盘内容应保留。\n")
    projects["unborn"] = {"path": str(unborn), "displayName": unborn.name, "repository": True}
    plain = root / "09-非Git目录"
    plain.mkdir()
    write(plain, "README.txt", "此目录没有 Git 仓库，不应自动初始化。\n")
    projects["notRepository"] = {"path": str(plain), "displayName": plain.name, "repository": False}
    clone_parent = root / "克隆目标父目录"
    clone_parent.mkdir()
    (clone_parent / "existing-nonempty").mkdir()
    write(clone_parent, "existing-nonempty/keep.txt", "现有目录内容不能被克隆覆盖。\n")

    write(publisher, "src/message.txt", "remote B awaiting native fetch and ff-only pull\n")
    remote_ahead_oid = commit(publisher, "远端新增 B，等待原生获取与拉取")
    run(publisher, "push", "origin", "main")
    manifest = {"kind": FIXTURE_KIND, "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "setupOnly": True, "root": str(root), "remotePath": str(remote), "remoteUrl": remote.as_uri(),
                "publisher": str(publisher), "cloneParent": str(clone_parent), "cloneName": "原生克隆项目",
                "baseOid": base_oid, "remoteAheadOid": remote_ahead_oid, "projects": projects,
                "identity": {"name": "地平线 GUI 验收", "email": "horizon-gui@example.invalid", "source": "local"},
                "expectedReview": {"head": "A", "index": "B-index", "disk": "C-disk", "bufferToTypeInGui": "D-buffer"},
                "nextAction": "Use native Horizon UI; no GUI acceptance has run for these fixtures."}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (output.parent / "initial-observation.json").write_text(json.dumps(inspect(manifest, "prepared-not-tested"), ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"manifest": str(output.resolve()), "root": str(root), "remoteUrl": manifest["remoteUrl"], "projects": projects}, ensure_ascii=False, indent=2))


def advance(manifest, action):
    sync = Path(manifest["projects"]["sync"]["path"])
    publisher = Path(manifest["publisher"])
    if action == "prepare-push":
        if run(sync, "status", "--porcelain"):
            raise RuntimeError("Sync fixture is not clean; preserve current GUI work and inspect it first")
        write(sync, "src/message.txt", "native GUI push C\n")
        return {"action": action, "productOperationPending": "Native stage, commit, then push to origin/main"}
    if action == "prepare-divergence":
        if run(sync, "status", "--porcelain") or run(sync, "symbolic-ref", "--short", "HEAD") != "main":
            raise RuntimeError("Sync fixture must be clean on main before preparing divergence")
        remote = Path(manifest["remotePath"])
        if run(sync, "rev-parse", "HEAD") != run(remote, "rev-parse", "main"):
            raise RuntimeError("Complete the native push before preparing divergence")
        run(publisher, "pull", "--ff-only", "origin", "main")
        write(publisher, "src/conflict.txt", "remote divergent D\n")
        remote_oid = commit(publisher, "夹具准备：远端分歧 D")
        run(publisher, "push", "origin", "main")
        write(sync, "src/conflict.txt", "local divergent E\n")
        local_oid = commit(sync, "夹具准备：本地分歧 E")
        return {"action": action, "localOid": local_oid, "remoteOid": remote_oid,
                "productOperationPending": "Native fetch, push rejection, ff-only pull rejection; no force or stash"}
    if action == "prepare-hook-failure":
        if run(sync, "status", "--porcelain"):
            raise RuntimeError("Sync fixture is not clean; preserve GUI work")
        hooks = sync / ".git/horizon-empty-hooks"
        hook = hooks / "pre-commit"
        hook.write_text("#!/bin/sh\necho 'Horizon GUI fixture: deliberate hook rejection'\nexit 1\n")
        hook.chmod(0o755)
        write(sync, "src/message.txt", "native hook failure recovery\n")
        return {"action": action, "productOperationPending": "Native stage and failed commit must retain message/index"}
    if action == "release-hook":
        hook = sync / ".git/horizon-empty-hooks/pre-commit"
        if hook.exists():
            hook.unlink()
        return {"action": action, "productOperationPending": "Native retry the retained commit message"}
    raise RuntimeError("Unknown fixture action")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("prepare")
    create.add_argument("--output", type=Path, required=True)
    observe = sub.add_parser("observe")
    observe.add_argument("--manifest", type=Path, required=True)
    observe.add_argument("--label", required=True)
    observe.add_argument("--output", type=Path, required=True)
    step = sub.add_parser("advance")
    step.add_argument("--manifest", type=Path, required=True)
    step.add_argument("--action", choices=["prepare-push", "prepare-divergence", "prepare-hook-failure", "release-hook"], required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        prepare(args.output)
        return
    manifest = load_manifest(args.manifest)
    if args.command == "observe":
        value = inspect(manifest, args.label)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({"output": str(args.output.resolve()), "label": args.label, "remoteRefs": value["remoteRefs"]}, ensure_ascii=False, indent=2))
    else:
        value = advance(manifest, args.action)
        value["recordedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
        with (args.manifest.parent / "fixture-actions.jsonl").open("a") as handle:
            handle.write(json.dumps(value, ensure_ascii=False) + "\n")
        print(json.dumps(value, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
