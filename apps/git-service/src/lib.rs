use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
fn hide_console(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    command.creation_flags(windows_sys::Win32::System::Threading::CREATE_NO_WINDOW);
}

const MAX_OUTPUT: usize = 16 * 1024 * 1024;
const PAGE_BYTES: usize = 128 * 1024;
const MAX_FILES: usize = 10_000;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Error {
    pub code: String,
    pub message: String,
    pub retryable: bool,
    pub recovery: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}
impl Error {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            retryable: matches!(code, "IO_ERROR" | "CONNECTION_FAILED" | "GIT_LOCKED"),
            recovery: match code {
                "STALE_VERSION" | "STALE_CURSOR" | "FILE_CHANGED" | "OUTCOME_UNKNOWN" => {
                    vec!["refresh".into()]
                }
                "GIT_AUTH_REQUIRED" => vec!["reauthenticate".into()],
                "GIT_NON_FAST_FORWARD" | "GIT_CONFLICT" => vec!["compare".into()],
                "GIT_NOT_FOUND" => vec!["openSettings".into()],
                _ => vec!["retry".into()],
            },
            details: None,
        }
    }
    fn details(mut self, value: Value) -> Self {
        self.details = Some(value);
        self
    }
}
type Result<T> = std::result::Result<T, Error>;
impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Self::new("IO_ERROR", e.to_string())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub method: String,
    pub root: PathBuf,
    pub cache_dir: PathBuf,
    #[serde(default)]
    pub params: Value,
    #[serde(default)]
    pub git_path: Option<PathBuf>,
}
struct Repo {
    root: PathBuf,
    cache: PathBuf,
    git: PathBuf,
}
struct Output {
    bytes: Vec<u8>,
    truncated: bool,
}
fn digest(data: impl AsRef<[u8]>) -> String {
    format!("{:x}", Sha256::digest(data.as_ref()))
}
fn file_hash(path: &Path) -> Result<String> {
    if path.is_symlink() {
        return Ok(digest(fs::read_link(path)?.as_os_str().as_encoded_bytes()));
    }
    if !path.exists() {
        return Ok(digest([]));
    }
    let mut file = fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        hasher.update(&buffer[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}
fn text(v: &Value, key: &str) -> Result<String> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| Error::new("INVALID_ARGUMENT", format!("缺少 {key}")))
}
fn flag(v: &Value, key: &str) -> bool {
    v.get(key).and_then(Value::as_bool).unwrap_or(false)
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn safe_path(root: &Path, value: &str) -> Result<PathBuf> {
    let p = Path::new(value);
    if p.is_absolute()
        || p.components().any(|c| !matches!(c, Component::Normal(_)))
        || p.components().any(|c| c.as_os_str() == ".git")
    {
        return Err(Error::new(
            "PERMISSION_DENIED",
            "路径必须在项目内，且不能操作 .git",
        ));
    }
    let joined = root.join(p);
    // A symlink file may be staged, but traversing a symlink directory is forbidden.
    let mut parent = joined.parent();
    while let Some(path) = parent {
        if path == root {
            break;
        }
        if path.is_symlink() {
            return Err(Error::new(
                "PERMISSION_DENIED",
                "不允许通过符号链接目录操作仓库外文件",
            ));
        }
        parent = path.parent();
    }
    Ok(joined)
}
fn paths(v: &Value) -> Result<Vec<String>> {
    let p = v
        .get("paths")
        .and_then(Value::as_array)
        .ok_or_else(|| Error::new("INVALID_ARGUMENT", "缺少文件范围"))?;
    if p.is_empty() || p.len() > MAX_FILES {
        return Err(Error::new("INVALID_ARGUMENT", "请选择有效文件范围"));
    }
    p.iter()
        .map(|x| {
            x.as_str()
                .map(str::to_owned)
                .ok_or_else(|| Error::new("INVALID_ARGUMENT", "无效文件路径"))
        })
        .collect()
}
fn classify(stderr: &str) -> Error {
    let l = stderr.to_lowercase();
    let code = if l.contains("index.lock")
        || l.contains("could not lock")
        || l.contains("cannot lock ref")
    {
        "GIT_LOCKED"
    } else if l.contains("authentication")
        || l.contains("permission denied (publickey)")
        || l.contains("could not read username")
        || l.contains("terminal prompts disabled")
    {
        "GIT_AUTH_REQUIRED"
    } else if l.contains("non-fast-forward")
        || l.contains("not possible to fast-forward")
        || l.contains("fetch first")
    {
        "GIT_NON_FAST_FORWARD"
    } else if l.contains("conflict") || l.contains("unmerged") {
        "GIT_CONFLICT"
    } else if l.contains("could not resolve host")
        || l.contains("connection")
        || l.contains("unable to access")
    {
        "CONNECTION_FAILED"
    } else {
        "GIT_COMMAND_FAILED"
    };
    // Credentials in remote URLs must never be surfaced in diagnostics.
    let sanitized = stderr
        .split_whitespace()
        .map(|s| {
            if s.contains("://") && s.contains('@') {
                "[远端地址已隐藏]"
            } else {
                s
            }
        })
        .collect::<Vec<_>>()
        .join(" ");
    Error::new(code, sanitized.chars().take(4000).collect::<String>())
}
impl Repo {
    fn command(&self, args: &[String], progress: bool) -> Result<Output> {
        let mut command = Command::new(&self.git);
        command
            .current_dir(&self.root)
            .args([
                "--no-pager",
                "--literal-pathspecs",
                "-c",
                "core.quotepath=false",
                "-c",
                "color.ui=false",
            ])
            .args(args)
            .env("GIT_TERMINAL_PROMPT", "0")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(windows)]
        hide_console(&mut command);
        let mut child = command.spawn().map_err(|e| {
            Error::new(
                if e.kind() == std::io::ErrorKind::NotFound {
                    "GIT_NOT_FOUND"
                } else {
                    "IO_ERROR"
                },
                e.to_string(),
            )
        })?;
        let mut stderr = child.stderr.take().unwrap();
        let err_thread = std::thread::spawn(move || {
            let mut kept = Vec::new();
            let mut buf = [0; 4096];
            loop {
                let n = stderr.read(&mut buf).unwrap_or(0);
                if n == 0 {
                    break;
                }
                if kept.len() < 64 * 1024 {
                    kept.extend_from_slice(&buf[..n.min(64 * 1024 - kept.len())]);
                }
                if progress {
                    let phase = String::from_utf8_lossy(&buf[..n]);
                    println!(
                        "{}",
                        json!({"type":"progress","phase":phase.chars().take(2000).collect::<String>()})
                    );
                    let _ = std::io::stdout().flush();
                }
            }
            kept
        });
        let mut stdout = child.stdout.take().unwrap();
        let mut bytes = Vec::new();
        let mut buf = [0; 8192];
        let mut truncated = false;
        loop {
            let n = stdout.read(&mut buf)?;
            if n == 0 {
                break;
            }
            let keep = n.min(MAX_OUTPUT.saturating_sub(bytes.len()));
            bytes.extend_from_slice(&buf[..keep]);
            truncated |= keep < n;
        }
        let status = child.wait()?;
        let stderr = err_thread.join().unwrap_or_default();
        if !status.success() {
            let empty = stderr.is_empty() && bytes.is_empty();
            let mut error = classify(&String::from_utf8_lossy(if stderr.is_empty() {
                &bytes
            } else {
                &stderr
            }));
            if error.message.is_empty() {
                error.message = format!(
                    "Git 命令失败（退出状态 {}）",
                    status
                        .code()
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| "进程终止".into())
                );
            }
            error.details = Some(json!({"exitCode":status.code(),"outputEmpty":empty}));
            return Err(error);
        }
        Ok(Output { bytes, truncated })
    }
    fn run(&self, args: &[&str]) -> Result<Output> {
        self.command(
            &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            false,
        )
    }
    fn string(&self, args: &[&str]) -> Result<String> {
        Ok(String::from_utf8_lossy(&self.run(args)?.bytes)
            .trim()
            .to_owned())
    }
    fn check_root(&self) -> Result<()> {
        let output = self
            .string(&["rev-parse", "--show-toplevel"])
            .map_err(|e| {
                if e.code == "GIT_COMMAND_FAILED" {
                    Error::new("NOT_FOUND", "当前项目不是 Git 仓库；可单独添加仓库根目录")
                        .details(json!({"notRepository":true}))
                } else {
                    e
                }
            })?;
        if fs::canonicalize(output)? != fs::canonicalize(&self.root)? {
            return Err(Error::new(
                "NOT_FOUND",
                "项目位于父仓库内。请单独添加仓库根目录，避免无提示提交父目录。",
            )
            .details(json!({"notRepository":true})));
        }
        Ok(())
    }
    fn status(&self) -> Result<Value> {
        self.check_root()?;
        let output = self.run(&[
            "status",
            "--porcelain=v2",
            "--branch",
            "-z",
            "--untracked-files=all",
        ])?;
        let mut files = Vec::new();
        let mut oid = None;
        let mut branch = None;
        let mut upstream = None;
        let (mut ahead, mut behind) = (None, None);
        let mut records = output.bytes.split(|b| *b == 0);
        while let Some(raw) = records.next() {
            let s = String::from_utf8_lossy(raw);
            if let Some(v) = s.strip_prefix("# branch.oid ") {
                if v != "(initial)" {
                    oid = Some(v.to_owned());
                }
            } else if let Some(v) = s.strip_prefix("# branch.head ") {
                if v != "(detached)" {
                    branch = Some(v.to_owned());
                }
            } else if let Some(v) = s.strip_prefix("# branch.upstream ") {
                upstream = Some(v.to_owned());
            } else if let Some(v) = s.strip_prefix("# branch.ab ") {
                let p = v.split_whitespace().collect::<Vec<_>>();
                ahead = p
                    .first()
                    .and_then(|s| s.trim_start_matches('+').parse::<i64>().ok());
                behind = p
                    .get(1)
                    .and_then(|s| s.trim_start_matches('-').parse::<i64>().ok());
            } else if s.starts_with("1 ") || s.starts_with("2 ") || s.starts_with("u ") {
                let kind = if s.starts_with("2 ") {
                    "rename"
                } else if s.starts_with("u ") {
                    "unmerged"
                } else {
                    "ordinary"
                };
                let n = if kind == "rename" {
                    10
                } else if kind == "unmerged" {
                    11
                } else {
                    9
                };
                let p = s.splitn(n, ' ').collect::<Vec<_>>();
                if p.len() == n {
                    let xy = p[1].as_bytes();
                    let mut f = json!({"path":p[n-1],"index":String::from_utf8_lossy(&xy[..1]),"worktree":String::from_utf8_lossy(&xy[1..2]),"kind":kind});
                    if kind == "rename" {
                        f["originalPath"] =
                            json!(String::from_utf8_lossy(records.next().unwrap_or_default()));
                    }
                    files.push(f);
                }
            } else if let Some(path) = s.strip_prefix("? ") {
                files.push(json!({"path":path,"index":"?","worktree":"?","kind":"untracked"}));
            }
            if files.len() > MAX_FILES {
                break;
            }
        }
        let truncated = output.truncated || files.len() > MAX_FILES;
        files.truncate(MAX_FILES);
        let mut hash = Sha256::new();
        hash.update(self.root.as_os_str().as_encoded_bytes());
        hash.update(&output.bytes);
        // Git's index and changed disk content both participate in the write precondition.
        if let Ok(index) = self.string(&["rev-parse", "--git-path", "index"]) {
            let path = PathBuf::from(index);
            if let Ok(bytes) = fs::read(if path.is_absolute() {
                path
            } else {
                self.root.join(path)
            }) {
                hash.update(bytes);
            }
        }
        for f in &files {
            let p = safe_path(&self.root, f["path"].as_str().unwrap())?;
            if p.is_symlink() {
                hash.update(fs::read_link(p)?.as_os_str().as_encoded_bytes());
            } else if let Ok(mut file) = fs::File::open(p) {
                let mut buf = [0; 65536];
                loop {
                    let n = file.read(&mut buf)?;
                    if n == 0 {
                        break;
                    }
                    hash.update(&buf[..n]);
                }
            }
        }
        let token = format!("{:x}", hash.finalize());
        let git_dir = self.string(&["rev-parse", "--absolute-git-dir"])?;
        let operation = if Path::new(&git_dir).join("rebase-merge").exists()
            || Path::new(&git_dir).join("rebase-apply").exists()
        {
            Some("rebase")
        } else if Path::new(&git_dir).join("MERGE_HEAD").exists() {
            Some("merge")
        } else if Path::new(&git_dir).join("CHERRY_PICK_HEAD").exists() {
            Some("cherry-pick")
        } else {
            None
        };
        let head = if oid.is_none() {
            json!({"state":"unborn","name":branch})
        } else if branch.is_none() {
            json!({"state":"detached","oid":oid})
        } else {
            json!({"state":"branch","name":branch,"oid":oid})
        };
        Ok(
            json!({"repoId":digest(self.root.as_os_str().as_encoded_bytes()),"generation":SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64,"repoToken":token,"head":head,"upstream":upstream.map(|name|json!({"name":name,"ahead":ahead,"behind":behind})),"files":files,"truncated":truncated,"operation":operation,"rootDisplayPath":self.root,"shallow":self.string(&["rev-parse","--is-shallow-repository"])?=="true"}),
        )
    }
    fn expected(&self, p: &Value) -> Result<Value> {
        let s = self.status()?;
        if let Some(t) = p.get("expectedRepoToken").and_then(Value::as_str) {
            if s["repoToken"] != t {
                return Err(Error::new(
                    "STALE_VERSION",
                    "仓库已变化，请刷新后重新审查操作范围",
                ));
            }
        }
        Ok(s)
    }
    fn revision(&self, input: &str) -> Result<String> {
        if input.starts_with('-') || input.contains('\0') {
            return Err(Error::new("INVALID_ARGUMENT", "无效 Git 引用"));
        }
        self.string(&[
            "rev-parse",
            "--verify",
            "--end-of-options",
            &format!("{input}^{{commit}}"),
        ])
    }
    fn cache_write(&self, kind: &str, value: &Value) -> Result<String> {
        fs::create_dir_all(&self.cache)?;
        let encoded =
            serde_json::to_vec(value).map_err(|e| Error::new("IO_ERROR", e.to_string()))?;
        let id = digest(&encoded);
        fs::write(self.cache.join(format!("{kind}-{id}.json")), encoded)?;
        self.prune_cache()?;
        Ok(id)
    }
    fn cache_read(&self, kind: &str, id: &str) -> Result<Value> {
        if id.len() != 64 || !id.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(Error::new("INVALID_ARGUMENT", "无效分页标识"));
        }
        let p = self.cache.join(format!("{kind}-{id}.json"));
        let metadata =
            fs::metadata(&p).map_err(|_| Error::new("STALE_CURSOR", "内容已过期，请重新读取"))?;
        if metadata.modified()?.elapsed().unwrap_or_default().as_secs() > 600 {
            return Err(Error::new("STALE_CURSOR", "内容已过期，请重新读取"));
        }
        serde_json::from_slice(&fs::read(p)?).map_err(|e| Error::new("IO_ERROR", e.to_string()))
    }
    fn prune_cache(&self) -> Result<()> {
        let mut entries = fs::read_dir(&self.cache)?
            .filter_map(|e| e.ok())
            .filter_map(|e| {
                e.metadata()
                    .ok()
                    .map(|m| (e.path(), m.modified().ok(), m.len()))
            })
            .collect::<Vec<_>>();
        entries.sort_by_key(|e| e.1);
        let mut bytes = entries.iter().map(|e| e.2).sum::<u64>();
        let count = entries.len();
        for (i, (p, _, n)) in entries.into_iter().enumerate() {
            if count - i > 20 || bytes > 32 * 1024 * 1024 {
                let _ = fs::remove_file(p);
                bytes = bytes.saturating_sub(n);
            } else {
                break;
            }
        }
        Ok(())
    }
}

pub fn dispatch(request: Request) -> Result<Value> {
    let repo = Repo {
        root: request.root,
        cache: request.cache_dir,
        git: request.git_path.unwrap_or_else(|| PathBuf::from("git")),
    };
    let p = &request.params;
    match request.method.as_str() {
        "git_status" => repo.status(),
        "git_diff" => diff(&repo, p),
        "git_diff_page" => diff_page(&repo, p),
        "git_history" => history(&repo, p),
        "git_branches" => branches(&repo),
        "git_compare" => compare(&repo, p),
        "git_conflict_get" => conflict_get(&repo, p),
        "git_blob_read" => blob_read(&repo, p),
        "git_conflict_resolve" => resolve_conflict(&repo, p),
        "git_mutate" => mutate(&repo, p),
        "git_discard_plan" => discard_plan(&repo, p),
        "git_clone" => clone_repo(&repo, p),
        "git_clone_cleanup" => clone_cleanup(&repo, p),
        "git_detect" => Ok(json!({"version":repo.string(&["--version"])?})),
        "git_identity" => {
            repo.check_root()?;
            let read = |key: &str| -> Result<Value> {
                match repo.string(&["config", "--show-origin", "--show-scope", "--get", key]) {
                    Ok(value) => {
                        let fields = value.splitn(3, '\t').collect::<Vec<_>>();
                        if fields.len() == 3 {
                            Ok(json!({"value":fields[2],"source":fields[0],"origin":fields[1]}))
                        } else {
                            Ok(json!({"value":value,"source":"unknown","origin":null}))
                        }
                    }
                    Err(error)
                        if error.code == "GIT_COMMAND_FAILED"
                            && error.details.as_ref().is_some_and(|d| {
                                d["exitCode"] == 1 && d["outputEmpty"] == true
                            }) =>
                    {
                        Ok(json!({"value":null,"source":"unset","origin":null}))
                    }
                    Err(error) => Err(error),
                }
            };
            Ok(json!({"name":read("user.name")?,"email":read("user.email")?}))
        }
        _ => Err(Error::new("NOT_FOUND", "未知 Git 方法")),
    }
}

fn utf8_page(value: &str, start: usize, size: usize) -> Result<(String, Option<String>)> {
    if start > value.len() || !value.is_char_boundary(start) {
        return Err(Error::new("INVALID_ARGUMENT", "无效分页偏移"));
    }
    let mut end = (start + size).min(value.len());
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    // Prefer complete lines; exceptionally long lines remain bounded fragments.
    if end < value.len() {
        if let Some(newline) = value[start..end].rfind('\n') {
            if newline > size / 2 {
                end = start + newline + 1;
            }
        }
    }
    Ok((
        value[start..end].into(),
        (end < value.len()).then(|| end.to_string()),
    ))
}
fn diff(repo: &Repo, p: &Value) -> Result<Value> {
    let snapshot = repo.expected(p)?;
    let path = text(p, "path")?;
    safe_path(&repo.root, &path)?;
    let base = text(p, "base")?;
    let mut args = vec![
        "diff".into(),
        "--no-ext-diff".into(),
        "--no-textconv".into(),
        "--no-color".into(),
        "--unified=3".into(),
    ];
    let mut old_oid = None;
    let mut new_oid = None;
    match base.as_str() {
        "headToIndex" => args.push("--cached".into()),
        "indexToWorktree" => {}
        "commitToParent" => {
            let oid = repo.revision(&text(p, "commitOid")?)?;
            let parent = p["parentOid"]
                .as_str()
                .map(|r| repo.revision(r))
                .transpose()?
                .or_else(|| repo.string(&["rev-parse", &format!("{oid}^1")]).ok());
            args = if let Some(parent) = &parent {
                vec![
                    "diff".into(),
                    "--no-ext-diff".into(),
                    "--no-textconv".into(),
                    parent.clone(),
                    oid.clone(),
                ]
            } else {
                vec![
                    "diff-tree".into(),
                    "--root".into(),
                    "--no-commit-id".into(),
                    "-p".into(),
                    "--no-ext-diff".into(),
                    "--no-textconv".into(),
                    oid.clone(),
                ]
            };
            old_oid = parent;
            new_oid = Some(oid);
        }
        _ => return Err(Error::new("INVALID_ARGUMENT", "未知差异基线")),
    }
    args.insert(1, "--find-renames".into());
    args.extend(["--".into(), path.clone()]);
    let original = p["originalPath"].as_str().or_else(|| {
        snapshot["files"]
            .as_array()
            .unwrap()
            .iter()
            .find(|f| f["path"] == path && f["kind"] == "rename")
            .and_then(|f| f["originalPath"].as_str())
    });
    if let Some(original) = original {
        safe_path(&repo.root, original)?;
        if original != path {
            args.push(original.into());
        }
    }
    let untracked = base == "indexToWorktree"
        && snapshot["files"]
            .as_array()
            .unwrap()
            .iter()
            .any(|f| f["path"] == path && f["kind"] == "untracked");
    let output = if untracked {
        let disk = safe_path(&repo.root, &path)?;
        let mut bytes = Vec::new();
        if disk.is_symlink() {
            bytes = fs::read_link(disk)?.as_os_str().as_encoded_bytes().to_vec();
        } else {
            fs::File::open(disk)?
                .take(MAX_OUTPUT as u64 + 1)
                .read_to_end(&mut bytes)?;
        }
        let truncated = bytes.len() > MAX_OUTPUT;
        bytes.truncate(MAX_OUTPUT);
        if bytes.contains(&0) {
            Output {
                bytes: b"Binary files /dev/null and worktree differ\n".to_vec(),
                truncated,
            }
        } else {
            let text = String::from_utf8_lossy(&bytes);
            Output {
                bytes: format!(
                    "--- /dev/null\n+++ b/{path}\n@@ -0,0 +1,{} @@\n{}",
                    text.lines().count(),
                    text.lines().map(|l| format!("+{l}\n")).collect::<String>()
                )
                .into_bytes(),
                truncated,
            }
        }
    } else {
        repo.command(&args, false)?
    };
    let patch = String::from_utf8_lossy(&output.bytes).into_owned();
    let binary = patch.contains("Binary files ") || patch.contains("GIT binary patch");
    let record = json!({"repoId":snapshot["repoId"],"repoToken":snapshot["repoToken"],"base":base,"path":path,"byteLength":patch.len().to_string(),"patch":patch,"binary":binary,"truncated":output.truncated,"oldOid":old_oid,"newOid":new_oid});
    let id = repo.cache_write("diff", &record)?;
    let (page, next) = utf8_page(record["patch"].as_str().unwrap(), 0, PAGE_BYTES)?;
    let mut result = record;
    result["patch"] = json!(page);
    result["diffId"] = json!(id);
    result["nextCursor"] = json!(next);
    result["oldLine"] = json!(0);
    result["newLine"] = json!(0);
    result["startsMidLine"] = json!(false);
    Ok(result)
}
fn diff_page(repo: &Repo, p: &Value) -> Result<Value> {
    let id = text(p, "diffId")?;
    let cached = repo.cache_read("diff", &id)?;
    if cached["repoId"] != digest(repo.root.as_os_str().as_encoded_bytes()) {
        return Err(Error::new("PERMISSION_DENIED", "差异不属于当前项目"));
    }
    let start = text(p, "cursor")?
        .parse::<usize>()
        .map_err(|_| Error::new("INVALID_ARGUMENT", "无效分页偏移"))?;
    let (page, next) = utf8_page(cached["patch"].as_str().unwrap_or(""), start, PAGE_BYTES)?;
    let patch = cached["patch"].as_str().unwrap_or("");
    let (old_line, new_line) = patch_position(&patch[..start]);
    Ok(
        json!({"diffId":id,"patch":page,"nextCursor":next,"repoToken":cached["repoToken"],"oldLine":old_line,"newLine":new_line,"startsMidLine":start>0&&patch.as_bytes()[start-1]!=b'\n'}),
    )
}
fn patch_position(prefix: &str) -> (usize, usize) {
    let (mut old, mut new) = (0, 0);
    for line in prefix.split_inclusive('\n') {
        if !line.ends_with('\n') {
            break;
        }
        if line.starts_with("@@ ") {
            let parts = line.split_whitespace().collect::<Vec<_>>();
            old = parts
                .get(1)
                .and_then(|s| s.trim_start_matches('-').split(',').next())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
            new = parts
                .get(2)
                .and_then(|s| s.trim_start_matches('+').split(',').next())
                .and_then(|s| s.parse().ok())
                .unwrap_or(0);
        } else if !line.starts_with("---") && !line.starts_with("+++") {
            if line.starts_with('-') || line.starts_with(' ') {
                old += 1;
            }
            if line.starts_with('+') || line.starts_with(' ') {
                new += 1;
            }
        }
    }
    (old, new)
}
fn history(repo: &Repo, p: &Value) -> Result<Value> {
    let s = repo.status()?;
    if s["head"]["state"] == "unborn" {
        return Ok(json!({"items":[],"nextCursor":null,"shallow":false}));
    }
    let head = s["head"]["oid"].as_str().unwrap();
    let mut offset = 0;
    if let Some(c) = p["cursor"].as_str() {
        let parts = c.split(':').collect::<Vec<_>>();
        if parts.len() != 2 || parts[0] != head {
            return Err(Error::new("STALE_CURSOR", "历史已变化，请重新加载"));
        }
        offset = parts[1]
            .parse::<usize>()
            .map_err(|_| Error::new("INVALID_ARGUMENT", "无效分页偏移"))?;
    }
    let limit = p["limit"].as_u64().unwrap_or(30).clamp(1, 100) as usize;
    let raw = repo.string(&[
        "log",
        head,
        &format!("--skip={offset}"),
        &format!("--max-count={}", limit + 1),
        "--format=%H%x00%P%x00%s%x00%an%x00%aI%x00",
    ])?;
    let fields = raw.split('\0').collect::<Vec<_>>();
    let mut items = Vec::new();
    for row in fields.chunks(5) {
        if row.len() == 5 {
            items.push(json!({"oid":row[0].trim(),"parents":row[1].split_whitespace().collect::<Vec<_>>(),"subject":row[2],"author":row[3],"time":row[4]}));
        }
    }
    let more = items.len() > limit;
    items.truncate(limit);
    Ok(
        json!({"items":items,"nextCursor":more.then(||format!("{head}:{}",offset+limit)),"shallow":s["shallow"]}),
    )
}
fn branches(repo: &Repo) -> Result<Value> {
    let s = repo.status()?;
    let raw = repo.string(&[
        "for-each-ref",
        "--format=%(refname:short)%00%(objectname)%00%(HEAD)%00%(upstream:short)%00%(refname)%00%(symref)",
        "refs/heads",
        "refs/remotes",
    ])?;
    let items=raw.lines().filter_map(|line|{let p=line.split('\0').collect::<Vec<_>>();(p.len()==6 && p[5].is_empty()).then(||json!({"name":p[0],"oid":p[1],"current":p[2]=="*","remote":p[4].starts_with("refs/remotes/"),"upstream":if p[3].is_empty(){None}else{Some(p[3])}}))}).collect::<Vec<_>>();
    let remotes = repo
        .string(&["remote"])?
        .lines()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    Ok(json!({"items":items,"repoToken":s["repoToken"],"remotes":remotes}))
}
fn compare(repo: &Repo, p: &Value) -> Result<Value> {
    repo.check_root()?;
    let target = repo.revision(&text(p, "target")?)?;
    let source = p["source"]
        .as_str()
        .map(|s| repo.revision(s))
        .transpose()?
        .or_else(|| repo.string(&["rev-parse", &format!("{target}^1")]).ok());
    let args = if let Some(source) = &source {
        vec![
            "diff",
            "--find-renames",
            "--name-status",
            "-z",
            source,
            &target,
        ]
    } else {
        vec![
            "diff-tree",
            "--root",
            "--no-commit-id",
            "-r",
            "--find-renames",
            "--name-status",
            "-z",
            &target,
        ]
    };
    let out = repo.run(&args)?;
    let mut records = out.bytes.split(|b| *b == 0);
    let mut items = Vec::new();
    while let Some(status) = records.next() {
        if status.is_empty() {
            continue;
        }
        let status = String::from_utf8_lossy(status);
        let path = String::from_utf8_lossy(records.next().unwrap_or_default()).into_owned();
        let (original, path) = if status.starts_with('R') || status.starts_with('C') {
            (
                Some(path),
                String::from_utf8_lossy(records.next().unwrap_or_default()).into_owned(),
            )
        } else {
            (None, path)
        };
        items.push(json!({"path":path,"status":status,"originalPath":original}));
    }
    Ok(json!({"source":source,"target":target,"items":items,"truncated":out.truncated}))
}
fn conflict_get(repo: &Repo, p: &Value) -> Result<Value> {
    let s = repo.expected(p)?;
    let path = text(p, "path")?;
    safe_path(&repo.root, &path)?;
    let raw = repo.run(&["ls-files", "--unmerged", "-z", "--", &path])?;
    let mut result = json!({"repoToken":s["repoToken"],"base":null,"ours":null,"theirs":null,"path":path,"operation":s["operation"]});
    for record in raw.bytes.split(|b| *b == 0) {
        let raw = String::from_utf8_lossy(record);
        let fields = raw.split_whitespace().collect::<Vec<_>>();
        if fields.len() >= 3 {
            let key = match fields[2] {
                "1" => "base",
                "2" => "ours",
                "3" => "theirs",
                _ => continue,
            };
            let size = repo.string(&["cat-file", "-s", fields[1]])?;
            result[key] = json!({"oid":fields[1],"byteLength":size});
        }
    }
    let disk = safe_path(&repo.root, &path)?;
    result["worktree"] = if !disk.exists() && !disk.is_symlink() {
        json!({"exists":false,"binary":false,"truncated":false})
    } else {
        let mut bytes = Vec::new();
        if disk.is_symlink() {
            bytes.extend_from_slice(fs::read_link(&disk)?.as_os_str().as_encoded_bytes());
        } else {
            fs::File::open(&disk)?
                .take(PAGE_BYTES as u64 + 1)
                .read_to_end(&mut bytes)?;
        }
        let truncated = bytes.len() > PAGE_BYTES;
        bytes.truncate(PAGE_BYTES);
        if bytes.contains(&0) {
            json!({"exists":true,"binary":true,"truncated":truncated})
        } else {
            let valid = match std::str::from_utf8(&bytes) {
                Ok(_) => Some(bytes.len()),
                Err(e) if e.error_len().is_none() && truncated => Some(e.valid_up_to()),
                Err(_) => None,
            };
            match valid {
                Some(length) => {
                    json!({"exists":true,"binary":false,"truncated":truncated,"text":std::str::from_utf8(&bytes[..length]).unwrap()})
                }
                None => {
                    json!({"exists":true,"binary":false,"truncated":truncated,"encodingUnsupported":true})
                }
            }
        }
    };
    Ok(result)
}
fn blob_read(repo: &Repo, p: &Value) -> Result<Value> {
    let oid = p["blob"]["oid"]
        .as_str()
        .ok_or_else(|| Error::new("INVALID_ARGUMENT", "无效 blob"))?;
    if !oid.chars().all(|c| c.is_ascii_hexdigit()) || !(oid.len() == 40 || oid.len() == 64) {
        return Err(Error::new("INVALID_ARGUMENT", "无效 blob"));
    }
    if repo.string(&["cat-file", "-t", oid])? != "blob" {
        return Err(Error::new("INVALID_ARGUMENT", "所选对象不是文件内容"));
    }
    let size = repo
        .string(&["cat-file", "-s", oid])?
        .parse::<usize>()
        .map_err(|_| Error::new("GIT_COMMAND_FAILED", "无法读取 Git 对象大小"))?;
    let offset = p["cursor"]
        .as_str()
        .unwrap_or("0")
        .parse::<usize>()
        .map_err(|_| Error::new("INVALID_ARGUMENT", "无效分页偏移"))?;
    let limit = p["limitBytes"]
        .as_u64()
        .unwrap_or(PAGE_BYTES as u64)
        .clamp(4, 1024 * 1024) as usize;
    if offset > size {
        return Err(Error::new("INVALID_ARGUMENT", "分页偏移超过文件大小"));
    }
    let mut command = Command::new(&repo.git);
    command
        .current_dir(&repo.root)
        .args(["cat-file", "blob", oid])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    hide_console(&mut command);
    let mut child = command.spawn()?;
    let mut stdout = child.stdout.take().unwrap();
    let mut bytes = Vec::new();
    let read = (|| -> std::io::Result<()> {
        std::io::copy(
            &mut stdout.by_ref().take(offset as u64),
            &mut std::io::sink(),
        )?;
        stdout.by_ref().take(limit as u64).read_to_end(&mut bytes)?;
        Ok(())
    })();
    // This is a read-only stream. Once this page is collected, release its Git
    // process without accumulating the remaining (possibly huge) blob.
    drop(stdout);
    let _ = child.kill();
    let _ = child.wait();
    read?;
    if bytes.contains(&0) {
        return Ok(json!({"binary":true,"nextCursor":null}));
    }
    let valid = match std::str::from_utf8(&bytes) {
        Ok(_) => bytes.len(),
        Err(e) if e.error_len().is_none() => e.valid_up_to(),
        Err(_) => return Err(Error::new("ENCODING_UNSUPPORTED", "此文件不是 UTF-8 文本")),
    };
    bytes.truncate(valid);
    let text = String::from_utf8(bytes).unwrap();
    let end = offset + text.len();
    if end == offset && end < size {
        return Err(Error::new("GIT_COMMAND_FAILED", "未能读取 Git 对象页"));
    }
    Ok(
        json!({"text":text,"binary":false,"nextCursor":(end<size).then(||end.to_string()),"truncated":false}),
    )
}
fn resolve_conflict(repo: &Repo, p: &Value) -> Result<Value> {
    text(p, "expectedRepoToken")?;
    let s = repo.expected(p)?;
    let path = text(p, "path")?;
    let disk = safe_path(&repo.root, &path)?;
    if !s["files"]
        .as_array()
        .unwrap()
        .iter()
        .any(|f| f["path"] == path && f["kind"] == "unmerged")
    {
        return Err(Error::new("STALE_VERSION", "此文件已不在冲突列表"));
    }
    match text(p, "choice")?.as_str() {
        "stage2" | "stage3" => {
            let stage = if p["choice"] == "stage2" {
                "--ours"
            } else {
                "--theirs"
            };
            repo.run(&["checkout", stage, "--", &path])?;
        }
        "delete" => {
            move_to_trash(&disk)?;
        }
        _ => return Err(Error::new("INVALID_ARGUMENT", "无效整文件选择")),
    }
    Ok(json!({"snapshot":repo.status()?,"saved":true,"staged":false}))
}
fn discard_plan(repo: &Repo, p: &Value) -> Result<Value> {
    let s = repo.status()?;
    let source = text(p, "source")?;
    if source != "index" && source != "head" {
        return Err(Error::new("INVALID_ARGUMENT", "无效恢复来源"));
    }
    let paths = paths(p)?;
    let mut files = Vec::new();
    for path in &paths {
        let disk = safe_path(&repo.root, path)?;
        let f = s["files"]
            .as_array()
            .unwrap()
            .iter()
            .find(|f| f["path"] == *path)
            .ok_or_else(|| Error::new("FILE_CHANGED", "所选文件状态已变化"))?;
        if f["kind"] == "unmerged" {
            return Err(Error::new("GIT_CONFLICT", "请在冲突页面处理该文件"));
        }
        if disk.is_dir() {
            return Err(Error::new(
                "CAPABILITY_UNSUPPORTED",
                "子模块内部更改请在其独立项目中处理",
            ));
        }
        let hash = file_hash(&disk)?;
        files.push(json!({"path":path,"beforeHash":hash,"operation":if f["kind"]=="untracked"{"trash"}else{"restore"}}));
    }
    let plan = json!({"repoToken":s["repoToken"],"root":repo.root,"source":source,"files":files,"createdAt":now()});
    let id = repo.cache_write("plan", &plan)?;
    Ok(
        json!({"planId":id,"digest":digest(serde_json::to_vec(&plan).unwrap()),"repoToken":s["repoToken"],"files":files}),
    )
}
fn mutate(repo: &Repo, p: &Value) -> Result<Value> {
    let s = repo.expected(p)?;
    if p["expectedRepoToken"].as_str().is_none() {
        return Err(Error::new("INVALID_ARGUMENT", "写操作必须携带仓库版本"));
    }
    if s["truncated"] == true {
        return Err(Error::new(
            "RESOURCE_LIMIT",
            "更改列表超过上限，请在外部 Git 缩小范围后操作",
        ));
    }
    let operation = text(p, "operation")?;
    let mut args = Vec::<String>::new();
    let mut commit = false;
    let mut per_file = Vec::new();
    match operation.as_str() {
        "stage" | "unstage" => {
            let mut paths = paths(p)?;
            // A rename is one UI file, but both index entries must be unstaged.
            if operation == "unstage" {
                let originals = s["files"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .filter(|f| {
                        f["kind"] == "rename"
                            && f["path"]
                                .as_str()
                                .is_some_and(|path| paths.iter().any(|p| p == path))
                    })
                    .filter_map(|f| f["originalPath"].as_str().map(str::to_owned))
                    .collect::<Vec<_>>();
                paths.extend(originals);
            }
            for path in &paths {
                let disk = safe_path(&repo.root, path)?;
                if operation == "stage"
                    && s["files"]
                        .as_array()
                        .unwrap()
                        .iter()
                        .any(|f| f["path"] == *path && f["kind"] == "unmerged")
                    && disk.is_file()
                {
                    let mut data = Vec::new();
                    fs::File::open(disk)?
                        .take(MAX_OUTPUT as u64)
                        .read_to_end(&mut data)?;
                    if String::from_utf8_lossy(&data).lines().any(|l| {
                        l.starts_with("<<<<<<< ") || l.starts_with(">>>>>>> ") || l == "======="
                    }) {
                        return Err(Error::new(
                            "GIT_CONFLICT",
                            "结果仍含冲突标记，请先编辑并保存后再暂存",
                        ));
                    }
                }
            }
            args = if operation == "stage" {
                vec!["add".into(), "--all".into()]
            } else if s["head"]["state"] == "unborn" {
                vec![
                    "rm".into(),
                    "--cached".into(),
                    "--force".into(),
                    "--ignore-unmatch".into(),
                ]
            } else {
                vec!["reset".into(), "--quiet".into(), "HEAD".into()]
            };
            args.push("--".into());
            args.extend(paths);
        }
        "commit" => {
            let message = text(p, "message")?;
            if message.trim().is_empty() {
                return Err(Error::new("INVALID_ARGUMENT", "提交说明不能为空"));
            }
            let actual = s["files"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|f| f["index"] != "." && f["index"] != "?" && f["kind"] != "unmerged")
                .map(|f| f["path"].as_str().unwrap().to_owned())
                .collect::<BTreeSet<_>>();
            let reviewed = paths(p)?.into_iter().collect::<BTreeSet<_>>();
            if actual.is_empty() {
                return Err(Error::new("INVALID_ARGUMENT", "没有已暂存更改"));
            }
            if actual != reviewed {
                return Err(Error::new("STALE_VERSION", "已暂存范围变化，请重新核对"));
            }
            if s["files"]
                .as_array()
                .unwrap()
                .iter()
                .any(|f| f["kind"] == "unmerged")
            {
                return Err(Error::new("GIT_CONFLICT", "请先解决并暂存冲突"));
            }
            args = vec!["commit".into(), "-m".into(), message];
            commit = true;
        }
        "fetch" => {
            let remote = remote(repo, p)?;
            args = vec!["fetch".into(), "--progress".into(), remote];
        }
        "pull" => {
            if p["strategy"] != "ffOnly" {
                return Err(Error::new("INVALID_ARGUMENT", "只支持仅快进拉取"));
            }
            clean(&s)?;
            let remote = remote(repo, p)?;
            let branch = text(p, "branch")?;
            valid_ref(repo, &branch)?;
            args = vec![
                "pull".into(),
                "--ff-only".into(),
                "--progress".into(),
                remote,
                branch,
            ];
        }
        "push" => {
            let remote = remote(repo, p)?;
            let source = text(p, "sourceRef")?;
            let target = text(p, "targetRef")?;
            valid_ref(repo, &source)?;
            valid_ref(repo, &target)?;
            // Fully qualified refs cannot accidentally turn a legal '+name'
            // branch into Git's force-refspec syntax.
            let source = if source.starts_with("refs/heads/") {
                source
            } else {
                format!("refs/heads/{source}")
            };
            let target = if target.starts_with("refs/heads/") {
                target
            } else {
                format!("refs/heads/{target}")
            };
            args = vec!["push".into(), "--progress".into()];
            if flag(p, "setUpstream") {
                args.push("--set-upstream".into());
            }
            args.extend([remote, format!("{source}:{target}")]);
        }
        "switch" => {
            clean(&s)?;
            let branch = text(p, "branch")?;
            valid_ref(repo, &branch)?;
            args = vec!["switch".into(), "--".into(), branch];
        }
        "createBranch" => {
            let name = text(p, "name")?;
            valid_ref(repo, &name)?;
            let start = repo.revision(&text(p, "startOid")?)?;
            if flag(p, "switchAfter") {
                clean(&s)?;
                args = vec!["switch".into(), "-c".into(), name, start];
            } else {
                args = vec!["branch".into(), name, start];
            }
        }
        "discard" => {
            let id = text(p, "planId")?;
            let plan = repo.cache_read("plan", &id)?;
            if plan["root"] != json!(repo.root)
                || plan["repoToken"] != s["repoToken"]
                || text(p, "planDigest")? != digest(serde_json::to_vec(&plan).unwrap())
            {
                return Err(Error::new("STALE_VERSION", "放弃计划已过期，请重新审查"));
            }
            for f in plan["files"].as_array().unwrap() {
                let path = f["path"].as_str().unwrap();
                let disk = match safe_path(&repo.root, path) {
                    Ok(path) => path,
                    Err(error) => {
                        per_file.push(json!({"path":path,"state":"failed","error":error}));
                        continue;
                    }
                };
                let hash = match file_hash(&disk) {
                    Ok(hash) => hash,
                    Err(error) => {
                        per_file.push(json!({"path":path,"state":"failed","error":error}));
                        continue;
                    }
                };
                let result = if hash != f["beforeHash"] {
                    Err(Error::new(
                        "FILE_CHANGED",
                        "此文件在计划确认后继续变化，已保留最新内容",
                    ))
                } else if f["operation"] == "trash" {
                    move_to_trash(&disk)
                } else if plan["source"] == "head" {
                    repo.run(&["restore", "--source=HEAD", "--worktree", "--", path])
                        .map(|_| ())
                } else {
                    repo.run(&["restore", "--worktree", "--", path]).map(|_| ())
                };
                per_file.push(match result {
                    Ok(()) => json!({"path":path,"state":"applied"}),
                    Err(error) => json!({"path":path,"state":"failed","error":error}),
                });
            }
        }
        _ => return Err(Error::new("INVALID_ARGUMENT", "未知 Git 操作")),
    }
    if !args.is_empty() {
        if let Err(mut error) = repo.command(&args, true) {
            if operation == "push"
                && matches!(
                    error.code.as_str(),
                    "CONNECTION_FAILED" | "GIT_COMMAND_FAILED" | "IO_ERROR"
                )
                && !error.message.contains("[remote rejected]")
                && !error.message.contains("pre-receive hook declined")
            {
                error.code = "OUTCOME_UNKNOWN".into();
                error.retryable = false;
                error.recovery = vec!["refresh".into()];
                error.message = format!(
                    "推送未能确认远端结果。请先获取并比较远端：{}",
                    error.message
                );
            }
            let effect = if error.code == "OUTCOME_UNKNOWN" {
                "unknown"
            } else {
                match repo.status() {
                    Ok(after) if after["repoToken"] != s["repoToken"] => "partial",
                    Ok(_) => "none",
                    Err(_) => "unknown",
                }
            };
            let mut details = error.details.take().unwrap_or_else(|| json!({}));
            details["effect"] = json!(effect);
            error.details = Some(details);
            return Err(error);
        }
    }
    let snapshot = repo.status().map_err(|mut error|{error.message=format!("Git 操作已执行，但后续状态读取失败，请先刷新核对：{}",error.message);error.details=Some(json!({"effect":if per_file.iter().any(|f|f["state"]=="failed"){"partial"}else{"applied"}}));error})?;
    Ok(
        json!({"commitOid":if commit{snapshot["head"]["oid"].clone()}else{Value::Null},"snapshot":snapshot,"perFile":per_file}),
    )
}
fn clean(s: &Value) -> Result<()> {
    if !s["files"].as_array().unwrap().is_empty() {
        return Err(Error::new(
            "RESOURCE_BUSY",
            "请先处理工作目录与暂存区更改，再切换分支或拉取",
        ));
    }
    Ok(())
}
fn valid_ref(repo: &Repo, name: &str) -> Result<()> {
    if name.starts_with('-') || name.contains(':') {
        return Err(Error::new("INVALID_ARGUMENT", "无效分支名"));
    }
    repo.run(&["check-ref-format", "--branch", name])
        .map(|_| ())
        .map_err(|_| Error::new("INVALID_ARGUMENT", "无效分支名"))
}
fn remote(repo: &Repo, p: &Value) -> Result<String> {
    let remote = text(p, "remote")?;
    if remote.starts_with('-') {
        return Err(Error::new("INVALID_ARGUMENT", "远端名称不能以选项前缀开头"));
    }
    if !repo.string(&["remote"])?.lines().any(|r| r == remote) {
        return Err(Error::new("INVALID_ARGUMENT", "请选择已配置远端"));
    }
    Ok(remote)
}
fn clone_repo(repo: &Repo, p: &Value) -> Result<Value> {
    let url = text(p, "url")?;
    let name = text(p, "name")?;
    if url.starts_with('-') || url.contains('\0') || url.starts_with("ext::") {
        return Err(Error::new("INVALID_ARGUMENT", "无效仓库地址"));
    }
    if name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err(Error::new("INVALID_ARGUMENT", "目标名称必须为单个目录名"));
    }
    let dest = safe_path(&repo.root, &name)?;
    if dest.exists() {
        return Err(Error::new(
            "INVALID_ARGUMENT",
            "目标目录已存在，请选择新名称；不会覆盖现有内容",
        ));
    }
    let marker = repo.cache.join(format!(
        "clone-{}.json",
        digest(dest.as_os_str().as_encoded_bytes())
    ));
    fs::create_dir_all(&repo.cache)?;
    fs::write(
        &marker,
        serde_json::to_vec(&json!({"path":dest,"createdAt":now()})).unwrap(),
    )?;
    repo.command(
        &["clone".into(), "--progress".into(), "--".into(), url, name],
        true,
    )?;
    let _ = fs::remove_file(marker);
    Ok(json!({"path":dest,"cloned":true}))
}
fn move_to_trash(path: &Path) -> Result<()> {
    let mut context = trash::TrashContext::new();
    #[cfg(target_os = "macos")]
    {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        // Finder AppleEvents can wait for minutes after a closed picker. The native
        // file manager still moves the item to Trash without that automation hop.
        context.set_delete_method(DeleteMethod::NsFileManager);
    }
    context
        .delete(path)
        .map_err(|e| Error::new("IO_ERROR", e.to_string()))
}
fn clone_cleanup(repo: &Repo, p: &Value) -> Result<Value> {
    let name = text(p, "name")?;
    let dest = safe_path(&repo.root, &name)?;
    let marker = repo.cache.join(format!(
        "clone-{}.json",
        digest(dest.as_os_str().as_encoded_bytes())
    ));
    if !marker.exists() {
        return Err(Error::new(
            "PERMISSION_DENIED",
            "此目录不属于未完成的克隆任务",
        ));
    }
    if dest.exists() {
        move_to_trash(&dest)?;
    }
    fs::remove_file(marker)?;
    Ok(json!({"trashed":true}))
}
