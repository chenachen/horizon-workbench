use horizon_git::{dispatch, Request};
use serde_json::{json, Value};
use std::{fs, path::Path, process::Command};
use tempfile::TempDir;
fn git(root: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .current_dir(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8_lossy(&out.stdout).trim().into()
}
fn repo() -> TempDir {
    let d = TempDir::new().unwrap();
    git(d.path(), &["init", "-b", "main"]);
    git(d.path(), &["config", "user.name", "Horizon Test"]);
    git(
        d.path(),
        &["config", "user.email", "horizon-test@example.invalid"],
    );
    d
}
fn call(root: &Path, method: &str, params: Value) -> Result<Value, horizon_git::Error> {
    dispatch(Request {
        method: method.into(),
        root: root.into(),
        cache_dir: root.parent().unwrap().join(format!(
            "cache-{}",
            root.file_name().unwrap().to_string_lossy()
        )),
        params,
        git_path: None,
    })
}
fn status(root: &Path) -> Value {
    call(root, "git_status", json!({})).unwrap()
}
fn mutate(root: &Path, mut p: Value) -> Result<Value, horizon_git::Error> {
    p["expectedRepoToken"] = status(root)["repoToken"].clone();
    call(root, "git_mutate", p)
}
#[test]
fn staged_and_disk_are_separate_and_commit_uses_only_index() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("file.txt"), "A\n").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "A"]);
    fs::write(r.join("file.txt"), "B\n").unwrap();
    git(r, &["add", "."]);
    fs::write(r.join("file.txt"), "C\n").unwrap();
    let s = status(r);
    assert_eq!(s["files"][0]["index"], "M");
    assert_eq!(s["files"][0]["worktree"], "M");
    let staged = call(
        r,
        "git_diff",
        json!({"path":"file.txt","base":"headToIndex"}),
    )
    .unwrap();
    assert!(staged["patch"].as_str().unwrap().contains("+B"));
    assert!(!staged["patch"].as_str().unwrap().contains("+C"));
    let disk = call(
        r,
        "git_diff",
        json!({"path":"file.txt","base":"indexToWorktree"}),
    )
    .unwrap();
    assert!(disk["patch"].as_str().unwrap().contains("-B\n+C"));
    mutate(
        r,
        json!({"operation":"commit","message":"B only","paths":["file.txt"]}),
    )
    .unwrap();
    assert_eq!(git(r, &["show", "HEAD:file.txt"]), "B");
    assert_eq!(fs::read_to_string(r.join("file.txt")).unwrap(), "C\n");
}
#[test]
fn unborn_unstage_preserves_disk_even_if_disk_changed() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("中文 空格.txt"), "B").unwrap();
    mutate(r, json!({"operation":"stage","paths":["中文 空格.txt"]})).unwrap();
    fs::write(r.join("中文 空格.txt"), "C").unwrap();
    mutate(r, json!({"operation":"unstage","paths":["中文 空格.txt"]})).unwrap();
    assert_eq!(status(r)["files"][0]["kind"], "untracked");
    assert_eq!(fs::read_to_string(r.join("中文 空格.txt")).unwrap(), "C");
}
#[test]
fn stale_snapshot_and_unreviewed_commit_refused() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A").unwrap();
    let s = status(r);
    fs::write(r.join("a"), "B").unwrap();
    let e = call(
        r,
        "git_mutate",
        json!({"operation":"stage","paths":["a"],"expectedRepoToken":s["repoToken"]}),
    )
    .unwrap_err();
    assert_eq!(e.code, "STALE_VERSION");
    git(r, &["add", "."]);
    fs::write(r.join("b"), "B").unwrap();
    git(r, &["add", "."]);
    assert_eq!(
        mutate(
            r,
            json!({"operation":"commit","message":"bad","paths":["a"]})
        )
        .unwrap_err()
        .code,
        "STALE_VERSION"
    );
}
#[test]
fn hook_failure_preserves_index() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A").unwrap();
    git(r, &["add", "."]);
    let hook = r.join(".git/hooks/pre-commit");
    fs::write(&hook, "#!/bin/sh\necho rejected\nexit 1\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(hook, fs::Permissions::from_mode(0o755)).unwrap();
    }
    assert!(mutate(
        r,
        json!({"operation":"commit","message":"keep draft","paths":["a"]})
    )
    .unwrap_err()
    .message
    .contains("rejected"));
    assert_eq!(status(r)["files"][0]["index"], "A");
    assert_eq!(status(r)["head"]["state"], "unborn");
}
#[test]
fn discard_restores_index_and_rejects_old_plan() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "A"]);
    fs::write(r.join("a"), "B").unwrap();
    git(r, &["add", "."]);
    fs::write(r.join("a"), "C").unwrap();
    let p = call(
        r,
        "git_discard_plan",
        json!({"source":"index","paths":["a"]}),
    )
    .unwrap();
    mutate(
        r,
        json!({"operation":"discard","planId":p["planId"],"planDigest":p["digest"]}),
    )
    .unwrap();
    assert_eq!(fs::read_to_string(r.join("a")).unwrap(), "B");
    assert_eq!(git(r, &["show", ":a"]), "B");
    fs::write(r.join("a"), "D").unwrap();
    assert_eq!(
        mutate(
            r,
            json!({"operation":"discard","planId":p["planId"],"planDigest":p["digest"]})
        )
        .unwrap_err()
        .code,
        "STALE_VERSION"
    );
}
#[cfg(target_os = "macos")]
#[test]
fn untracked_discard_uses_native_trash_without_finder() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("tracked"), "retained").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "baseline"]);
    let name = format!("horizon-trash-regression-{}.txt", std::process::id());
    fs::write(r.join(&name), "synthetic recoverable trash fixture").unwrap();
    let plan = call(
        r,
        "git_discard_plan",
        json!({"source":"index","paths":[name]}),
    )
    .unwrap();
    let result = mutate(
        r,
        json!({"operation":"discard","planId":plan["planId"],"planDigest":plan["digest"]}),
    )
    .unwrap();
    assert_eq!(result["perFile"][0]["state"], "applied", "{result}");
    assert!(!r.join(name).exists());
    assert_eq!(fs::read_to_string(r.join("tracked")).unwrap(), "retained");
    assert!(status(r)["files"].as_array().unwrap().is_empty());
}
#[test]
fn histories_branches_deleted_files_and_conflict_sources() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A\n").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "A"]);
    git(r, &["switch", "-c", "other"]);
    fs::write(r.join("a"), "other\n").unwrap();
    git(r, &["commit", "-am", "other"]);
    git(r, &["switch", "main"]);
    fs::write(r.join("a"), "main\n").unwrap();
    git(r, &["commit", "-am", "main"]);
    let merge = Command::new("git")
        .current_dir(r)
        .args(["merge", "other"])
        .output()
        .unwrap();
    assert!(!merge.status.success());
    let s = status(r);
    assert_eq!(s["files"][0]["kind"], "unmerged");
    assert_eq!(s["operation"], "merge");
    assert_eq!(
        mutate(r, json!({"operation":"stage","paths":["a"]}))
            .unwrap_err()
            .code,
        "GIT_CONFLICT"
    );
    let c = call(
        r,
        "git_conflict_get",
        json!({"path":"a","expectedRepoToken":s["repoToken"]}),
    )
    .unwrap();
    assert_eq!(c["worktree"]["exists"], true);
    assert!(c["worktree"]["text"]
        .as_str()
        .unwrap()
        .contains("<<<<<<< HEAD"));
    let ours = call(r, "git_blob_read", json!({"blob":c["ours"]})).unwrap();
    assert_eq!(ours["text"], "main\n");
    call(
        r,
        "git_conflict_resolve",
        json!({"path":"a","choice":"stage3","expectedRepoToken":s["repoToken"]}),
    )
    .unwrap();
    assert_eq!(fs::read_to_string(r.join("a")).unwrap(), "other\n");
    let after_choose = call(
        r,
        "git_conflict_get",
        json!({"path":"a","expectedRepoToken":status(r)["repoToken"]}),
    )
    .unwrap();
    assert_eq!(after_choose["worktree"]["text"], "other\n");
    assert_eq!(status(r)["files"][0]["kind"], "unmerged");
    mutate(r, json!({"operation":"stage","paths":["a"]})).unwrap();
    assert_ne!(status(r)["files"][0]["kind"], "unmerged");
    let history = call(r, "git_history", json!({"limit":1})).unwrap();
    assert_eq!(history["items"].as_array().unwrap().len(), 1);
    assert!(history["nextCursor"].is_string());
    assert_eq!(
        call(r, "git_branches", json!({})).unwrap()["items"]
            .as_array()
            .unwrap()
            .len(),
        2
    );
}
#[test]
fn large_diff_pages_and_binary_are_explicit() {
    let d = repo();
    let r = d.path();
    fs::write(
        r.join("large"),
        (0..20000)
            .map(|i| format!("line {i:08}\n"))
            .collect::<String>(),
    )
    .unwrap();
    let first = call(
        r,
        "git_diff",
        json!({"path":"large","base":"indexToWorktree"}),
    )
    .unwrap();
    assert!(first["nextCursor"].is_string());
    assert!(first["patch"].as_str().unwrap().len() <= 128 * 1024);
    assert!(first["patch"]
        .as_str()
        .unwrap()
        .contains("@@ -0,0 +1,20000 @@\n+line 00000000"));
    let next = call(
        r,
        "git_diff_page",
        json!({"diffId":first["diffId"],"cursor":first["nextCursor"]}),
    )
    .unwrap();
    assert!(!next["patch"].as_str().unwrap().is_empty());
    let first_line = next["patch"].as_str().unwrap().lines().next().unwrap();
    let fixture_index: u64 = first_line.trim_start_matches("+line ").parse().unwrap();
    assert_eq!(next["newLine"], fixture_index + 1);
    fs::write(r.join("binary"), [0, 255, 3]).unwrap();
    assert_eq!(
        call(
            r,
            "git_diff",
            json!({"path":"binary","base":"indexToWorktree"})
        )
        .unwrap()["binary"],
        true
    );
}
#[test]
fn clone_never_overwrites_and_registers_only_after_success() {
    let source = repo();
    fs::write(source.path().join("a"), "A").unwrap();
    git(source.path(), &["add", "."]);
    git(source.path(), &["commit", "-m", "A"]);
    let dest = TempDir::new().unwrap();
    call(
        dest.path(),
        "git_clone",
        json!({"url":source.path(),"name":"copied"}),
    )
    .unwrap();
    assert!(dest.path().join("copied/.git").is_dir());
    assert!(call(
        dest.path(),
        "git_clone",
        json!({"url":source.path(),"name":"copied"})
    )
    .is_err());
    assert_eq!(
        call(dest.path(), "git_clone_cleanup", json!({"name":"copied"}))
            .unwrap_err()
            .code,
        "PERMISSION_DENIED"
    );
    assert_eq!(
        fs::read_to_string(dest.path().join("copied/a")).unwrap(),
        "A"
    );
    assert!(call(
        dest.path(),
        "git_clone",
        json!({"url":source.path(),"name":"../escape"})
    )
    .is_err());
}

#[test]
fn rename_unstage_handles_both_paths_and_history_survives_deletion() {
    let d = repo();
    let r = d.path();
    fs::create_dir(r.join("nested")).unwrap();
    fs::write(r.join("nested/old name"), "same\n").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "initial"]);
    git(r, &["mv", "nested/old name", "new name"]);
    let s = status(r);
    assert_eq!(s["files"][0]["kind"], "rename");
    mutate(r, json!({"operation":"unstage","paths":["new name"]})).unwrap();
    assert_eq!(git(r, &["diff", "--cached", "--name-only"]), "");
    assert!(r.join("new name").exists());
    git(r, &["add", "-A"]);
    git(r, &["commit", "-m", "rename"]);
    let oid = git(r, &["rev-parse", "HEAD"]);
    fs::remove_file(r.join("new name")).unwrap();
    git(r, &["commit", "-am", "delete"]);
    let compare = call(r, "git_compare", json!({"target":"HEAD"})).unwrap();
    assert_eq!(compare["items"][0]["status"], "D");
    let diff = call(
        r,
        "git_diff",
        json!({"base":"commitToParent","commitOid":"HEAD","path":"new name"}),
    )
    .unwrap();
    assert!(diff["patch"].as_str().unwrap().contains("-same"));
    let old = call(
        r,
        "git_diff",
        json!({"base":"commitToParent","commitOid":oid,"path":"new name"}),
    )
    .unwrap();
    assert!(old["patch"].as_str().unwrap().contains("+same"));
}

#[test]
fn local_remote_fetch_pull_push_and_non_fast_forward() {
    let remote = TempDir::new().unwrap();
    git(remote.path(), &["init", "--bare", "-b", "main"]);
    let a = repo();
    fs::write(a.path().join("a"), "A").unwrap();
    git(a.path(), &["add", "."]);
    git(a.path(), &["commit", "-m", "A"]);
    git(
        a.path(),
        &["remote", "add", "origin", remote.path().to_str().unwrap()],
    );
    mutate(a.path(),json!({"operation":"push","remote":"origin","sourceRef":"main","targetRef":"main","setUpstream":true})).unwrap();
    let b = repo();
    git(
        b.path(),
        &["remote", "add", "origin", remote.path().to_str().unwrap()],
    );
    mutate(b.path(), json!({"operation":"fetch","remote":"origin"})).unwrap();
    git(
        b.path(),
        &[
            "symbolic-ref",
            "refs/remotes/origin/HEAD",
            "refs/remotes/origin/main",
        ],
    );
    let branch_list = call(b.path(), "git_branches", json!({})).unwrap();
    let remote_names = branch_list["items"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|item| item["remote"] == true)
        .map(|item| item["name"].as_str().unwrap())
        .collect::<Vec<_>>();
    assert_eq!(remote_names, vec!["origin/main"]);
    mutate(
        b.path(),
        json!({"operation":"pull","remote":"origin","branch":"main","strategy":"ffOnly"}),
    )
    .unwrap();
    fs::write(a.path().join("a"), "remote update").unwrap();
    git(a.path(), &["commit", "-am", "update"]);
    mutate(a.path(),json!({"operation":"push","remote":"origin","sourceRef":"main","targetRef":"main","setUpstream":false})).unwrap();
    mutate(
        b.path(),
        json!({"operation":"pull","remote":"origin","branch":"main","strategy":"ffOnly"}),
    )
    .unwrap();
    assert_eq!(
        fs::read_to_string(b.path().join("a")).unwrap(),
        "remote update"
    );
    fs::write(a.path().join("a"), "advance A").unwrap();
    git(a.path(), &["commit", "-am", "advance A"]);
    mutate(a.path(),json!({"operation":"push","remote":"origin","sourceRef":"main","targetRef":"main","setUpstream":false})).unwrap();
    fs::write(b.path().join("a"), "advance B").unwrap();
    git(b.path(), &["commit", "-am", "advance B"]);
    let before = git(b.path(), &["rev-parse", "HEAD"]);
    assert_eq!(mutate(b.path(),json!({"operation":"push","remote":"origin","sourceRef":"main","targetRef":"main","setUpstream":false})).unwrap_err().code,"GIT_NON_FAST_FORWARD");
    assert_eq!(
        mutate(
            b.path(),
            json!({"operation":"pull","remote":"origin","branch":"main","strategy":"ffOnly"})
        )
        .unwrap_err()
        .code,
        "GIT_NON_FAST_FORWARD"
    );
    assert_eq!(git(b.path(), &["rev-parse", "HEAD"]), before);
    let remote_before = git(remote.path(), &["rev-parse", "HEAD"]);
    git(b.path(), &["branch", "+main"]);
    assert_eq!(mutate(b.path(),json!({"operation":"push","remote":"origin","sourceRef":"+main","targetRef":"main","setUpstream":false})).unwrap_err().code,"GIT_NON_FAST_FORWARD");
    assert_eq!(git(remote.path(), &["rev-parse", "HEAD"]), remote_before);
}

#[test]
fn refs_are_resolved_before_compare_and_unsafe_paths_are_rejected() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "first"]);
    let first = git(r, &["rev-parse", "HEAD"]);
    fs::write(r.join("a"), "B").unwrap();
    git(r, &["commit", "-am", "second"]);
    fs::write(r.join("a"), "C").unwrap();
    git(r, &["commit", "-am", "third"]);
    let d = call(
        r,
        "git_diff",
        json!({"base":"commitToParent","commitOid":"HEAD","parentOid":first,"path":"a"}),
    )
    .unwrap();
    assert!(d["patch"].as_str().unwrap().contains("-A"));
    assert!(!d["patch"].as_str().unwrap().contains("-B"));
    assert_eq!(
        call(
            r,
            "git_diff",
            json!({"base":"indexToWorktree","path":"../outside"})
        )
        .unwrap_err()
        .code,
        "PERMISSION_DENIED"
    );
    assert!(call(r, "git_compare", json!({"target":"--help"})).is_err());
    git(r, &["switch", "-c", "new"]);
    mutate(r, json!({"operation":"switch","branch":"main"})).unwrap();
    assert_eq!(status(r)["head"]["name"], "main");
}

#[test]
fn blob_reader_pages_beyond_sixteen_mib_without_cutting_utf8() {
    let d = repo();
    let r = d.path();
    let text = "界".repeat(6 * 1024 * 1024);
    fs::write(r.join("large.txt"), text).unwrap();
    let oid = git(r, &["hash-object", "-w", "large.txt"]);
    let offset = 16 * 1024 * 1024 / 3 * 3;
    let result=call(r,"git_blob_read",json!({"blob":{"oid":oid,"byteLength":(18*1024*1024).to_string()},"cursor":offset.to_string(),"limitBytes":131})).unwrap();
    assert_eq!(result["text"].as_str().unwrap().chars().count(), 43);
    assert_eq!(result["nextCursor"], (offset + 129).to_string());
    assert_eq!(result["truncated"], false);
}

#[test]
fn index_lock_is_reported_and_never_removed_automatically() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A").unwrap();
    let lock = r.join(".git/index.lock");
    fs::write(&lock, "another git owns this").unwrap();
    assert_eq!(
        mutate(r, json!({"operation":"stage","paths":["a"]}))
            .unwrap_err()
            .code,
        "GIT_LOCKED"
    );
    assert_eq!(fs::read_to_string(&lock).unwrap(), "another git owns this");
    fs::remove_file(lock).unwrap();
    mutate(r, json!({"operation":"stage","paths":["a"]})).unwrap();
    assert_eq!(status(r)["files"][0]["index"], "A");
}

#[test]
fn dirty_branch_switch_is_refused_without_stashing() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "A"]);
    fs::write(r.join("a"), "B").unwrap();
    assert_eq!(mutate(r,json!({"operation":"createBranch","name":"switch-now","startOid":"HEAD","switchAfter":true})).unwrap_err().code,"RESOURCE_BUSY");
    mutate(r,json!({"operation":"createBranch","name":"review-only","startOid":"HEAD","switchAfter":false})).unwrap();
    assert_eq!(status(r)["head"]["name"], "main");
    assert_eq!(
        mutate(r, json!({"operation":"switch","branch":"review-only"}))
            .unwrap_err()
            .code,
        "RESOURCE_BUSY"
    );
    assert_eq!(fs::read_to_string(r.join("a")).unwrap(), "B");
    assert!(git(r, &["stash", "list"]).is_empty());
    git(r, &["restore", "a"]);
    mutate(r, json!({"operation":"switch","branch":"review-only"})).unwrap();
    assert_eq!(status(r)["head"]["name"], "review-only");
}

#[test]
fn unborn_detached_parent_repository_and_missing_git_are_distinct() {
    let d = repo();
    let r = d.path();
    assert_eq!(status(r)["head"]["state"], "unborn");
    assert!(call(r, "git_history", json!({})).unwrap()["items"]
        .as_array()
        .unwrap()
        .is_empty());
    let identity = call(r, "git_identity", json!({})).unwrap();
    assert_eq!(identity["name"]["value"], "Horizon Test");
    assert_eq!(identity["name"]["source"], "local");
    fs::write(r.join("a"), "A").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "A"]);
    git(r, &["switch", "--detach"]);
    let detached = status(r);
    assert_eq!(detached["head"]["state"], "detached");
    assert!(detached["head"]["name"].is_null());
    let child = r.join("nested");
    fs::create_dir(&child).unwrap();
    let error = call(&child, "git_status", json!({})).unwrap_err();
    assert_eq!(error.code, "NOT_FOUND");
    assert_eq!(error.details.unwrap()["notRepository"], true);
    let request = Request {
        method: "git_detect".into(),
        root: r.into(),
        cache_dir: r.join("cache"),
        params: json!({}),
        git_path: Some(r.join("missing-git")),
    };
    assert_eq!(dispatch(request).unwrap_err().code, "GIT_NOT_FOUND");
}

#[test]
fn modify_delete_conflict_exposes_missing_stage_without_faking_empty_text() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("a"), "A\n").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "A"]);
    git(r, &["switch", "-c", "incoming"]);
    fs::write(r.join("a"), "incoming\n").unwrap();
    git(r, &["commit", "-am", "incoming"]);
    git(r, &["switch", "main"]);
    git(r, &["rm", "a"]);
    git(r, &["commit", "-m", "delete"]);
    let merge = Command::new("git")
        .current_dir(r)
        .args(["merge", "incoming"])
        .output()
        .unwrap();
    assert!(!merge.status.success());
    let s = status(r);
    let conflict = call(
        r,
        "git_conflict_get",
        json!({"path":"a","expectedRepoToken":s["repoToken"]}),
    )
    .unwrap();
    assert!(conflict["ours"].is_null());
    assert!(conflict["base"].is_object());
    assert!(conflict["theirs"].is_object());
    call(
        r,
        "git_conflict_resolve",
        json!({"path":"a","expectedRepoToken":s["repoToken"],"choice":"stage3"}),
    )
    .unwrap();
    assert_eq!(status(r)["files"][0]["kind"], "unmerged");
    mutate(r, json!({"operation":"stage","paths":["a"]})).unwrap();
    assert_eq!(status(r)["files"][0]["index"], "A");
}

#[test]
fn merge_history_uses_first_parent_and_old_cursor_expires() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("base"), "base").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "base"]);
    git(r, &["switch", "-c", "feature"]);
    fs::write(r.join("feature"), "feature\n").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "feature"]);
    git(r, &["switch", "main"]);
    fs::write(r.join("main"), "main").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "main"]);
    let old = call(r, "git_history", json!({"limit":1})).unwrap();
    git(r, &["merge", "--no-ff", "feature", "-m", "合并功能"]);
    let history = call(r, "git_history", json!({"limit":1})).unwrap();
    assert_eq!(history["items"][0]["parents"].as_array().unwrap().len(), 2);
    assert_eq!(
        call(r, "git_history", json!({"cursor":old["nextCursor"]}))
            .unwrap_err()
            .code,
        "STALE_CURSOR"
    );
    let compare = call(r, "git_compare", json!({"target":"HEAD"})).unwrap();
    assert_eq!(compare["items"].as_array().unwrap().len(), 1);
    assert_eq!(compare["items"][0]["path"], "feature");
    assert!(call(
        r,
        "git_diff",
        json!({"base":"commitToParent","path":"feature","commitOid":"HEAD"})
    )
    .unwrap()["patch"]
        .as_str()
        .unwrap()
        .contains("+feature"));
}

#[test]
fn diff_cache_is_bound_to_repository_and_rename_keeps_old_path() {
    let d = repo();
    let r = d.path();
    fs::write(r.join("old"), "same\n").unwrap();
    git(r, &["add", "."]);
    git(r, &["commit", "-m", "base"]);
    git(r, &["mv", "old", "new"]);
    let diff = call(r, "git_diff", json!({"base":"headToIndex","path":"new"})).unwrap();
    assert!(diff["patch"].as_str().unwrap().contains("rename from old"));
    let other = repo();
    let shared_cache = r.parent().unwrap().join(format!(
        "cache-{}",
        r.file_name().unwrap().to_string_lossy()
    ));
    let request = Request {
        method: "git_diff_page".into(),
        root: other.path().into(),
        cache_dir: shared_cache,
        params: json!({"diffId":diff["diffId"],"cursor":"0"}),
        git_path: None,
    };
    assert_eq!(dispatch(request).unwrap_err().code, "PERMISSION_DENIED");
}
