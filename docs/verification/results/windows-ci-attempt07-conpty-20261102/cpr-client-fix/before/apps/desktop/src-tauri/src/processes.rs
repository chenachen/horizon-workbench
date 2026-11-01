//! Owned PTYs and launch runs. Views never own a process lifetime.
use crate::{Call, HostError, HostState};
use base64::{engine::general_purpose::STANDARD, Engine};
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, HashMap, HashSet, VecDeque},
    fs,
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex, OnceLock, Weak},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, AppHandle, Emitter};

const BUFFER: usize = 2 * 1024 * 1024;
const WINDOW: u64 = 512 * 1024;
const GLOBAL_WINDOW: u64 = 4 * 1024 * 1024;
const CHUNK: usize = 64 * 1024;
const EVENT_TERMINAL: &str = "horizon:terminal:v1";
const EVENT_PROCESS: &str = "horizon:process:v1";
const EVENT_LAUNCH: &str = "horizon:launch:v1";
const EVENT_EXTENSION: &str = "horizon:extension:v1";
type Result<T> = std::result::Result<T, HostError>;
fn err(code: &str, message: impl Into<String>) -> HostError {
    HostError::new(code, message.into())
}
fn io(e: impl std::fmt::Display) -> HostError {
    err("IO_ERROR", e.to_string())
}
fn stamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
fn id(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(1);
    format!(
        "{prefix}-{}-{}",
        stamp(),
        NEXT.fetch_add(1, Ordering::Relaxed)
    )
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LaunchProfile {
    schema_version: u32,
    profile_id: String,
    project_id: String,
    revision: u64,
    name: String,
    #[serde(default)]
    required_extensions: Vec<ExtensionRef>,
    steps: Vec<LaunchStep>,
    failure_policy: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ExtensionRef {
    id: String,
    version_range: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct LaunchStep {
    step_id: String,
    title: String,
    #[serde(default)]
    depends_on: Vec<String>,
    command: LaunchCommand,
    cwd: String,
    #[serde(default)]
    env: BTreeMap<String, String>,
    #[serde(default)]
    secret_refs: BTreeMap<String, String>,
    mode: String,
    lifecycle: String,
    ready: Ready,
    #[serde(default)]
    on_ready: Option<OnReady>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
enum LaunchCommand {
    Exec {
        executable: String,
        args: Vec<String>,
    },
    Shell {
        shell: String,
        script: String,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
enum Ready {
    ProcessStarted,
    Exit {
        codes: Vec<i32>,
    },
    Tcp {
        host: String,
        port: u16,
        timeout_ms: u64,
    },
    Http {
        url: String,
        status_codes: Vec<u16>,
        timeout_ms: u64,
    },
    Stdout {
        pattern: String,
        timeout_ms: u64,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct OnReady {
    #[serde(default)]
    open_terminal: bool,
    #[serde(default)]
    open_url: Option<String>,
    #[serde(default)]
    auto_open_url: bool,
}
#[derive(Clone)]
struct Resolved {
    step: LaunchStep,
    executable: PathBuf,
    args: Vec<String>,
    cwd: PathBuf,
}
#[derive(Clone)]
struct Plan {
    id: String,
    project: String,
    profile: LaunchProfile,
    digest: String,
    sources: BTreeMap<String, String>,
    steps: Vec<Resolved>,
    expires: u64,
    approved_before: bool,
    extension_versions: BTreeMap<String, String>,
    extension_actions: Vec<Value>,
}
struct Output {
    bytes: VecDeque<u8>,
    start: u64,
    end: u64,
}
impl Output {
    fn new() -> Self {
        Self {
            bytes: VecDeque::new(),
            start: 0,
            end: 0,
        }
    }
    fn push(&mut self, data: &[u8]) {
        self.bytes.extend(data);
        self.end += data.len() as u64;
        let excess = self.bytes.len().saturating_sub(BUFFER);
        self.bytes.drain(..excess);
        self.start += excess as u64;
    }
    fn read(&self, offset: u64, limit: usize) -> Vec<u8> {
        self.bytes
            .iter()
            .skip(offset.max(self.start).saturating_sub(self.start) as usize)
            .take(limit)
            .copied()
            .collect()
    }
}
struct View {
    process: String,
    project: String,
    request: String,
    sent: u64,
    ack: u64,
    seq: u64,
    channel: Option<Channel<Value>>,
    app: AppHandle,
}
#[derive(Clone)]
struct DirectLease {
    state: Weak<HostState>,
    project: String,
    id: String,
}
struct ProcessIdentity {
    activation_id: String,
    lease: Option<DirectLease>,
}
struct Process {
    id: String,
    project: String,
    extension: String,
    activation_id: String,
    direct_lease: Option<DirectLease>,
    lease_releasing: bool,
    #[cfg(windows)]
    exit_finalizing: bool,
    run: Option<String>,
    step: Option<String>,
    title: String,
    cwd: String,
    pid: u32,
    started: u64,
    state: String,
    revision: u64,
    exit: Option<i32>,
    is_terminal: bool,
    #[cfg(unix)]
    stop_groups: Vec<i32>,
    #[cfg(windows)]
    job: Option<Arc<crate::windows_process::OwnedJob>>,
    master: Option<Box<dyn MasterPty + Send>>,
    writer: Option<Arc<Mutex<Box<dyn Write + Send>>>>,
    killer: Option<Box<dyn ChildKiller + Send + Sync>>,
    output: Output,
}
impl Process {
    fn value(&self) -> Value {
        json!({"processInstanceId":self.id,"terminalSessionId":self.is_terminal.then_some(&self.id),"owner":{"projectId":self.project,"extensionId":self.extension,"activationId":self.activation_id,"launchRunId":self.run},"ownership":"owned","state":self.state,"revision":self.revision,"pid":self.pid,"startedAt":self.started.to_string(),"exitCode":self.exit,"title":self.title,"cwd":self.cwd,"stepId":self.step,"bufferStart":self.output.start.to_string(),"bufferEnd":self.output.end.to_string()})
    }
}
#[derive(Clone)]
struct Run {
    id: String,
    created_at: u64,
    project: String,
    profile: LaunchProfile,
    state: String,
    revision: u64,
    steps: Vec<Value>,
    order: Vec<String>,
    lease_state: Option<Weak<HostState>>,
    lease_releasing: bool,
}
impl Run {
    fn value(&self) -> Value {
        json!({"launchRunId":self.id,"createdAt":self.created_at,"projectId":self.project,"profileId":self.profile.profile_id,"profileRevision":self.profile.revision,"state":self.state,"revision":self.revision,"steps":self.steps})
    }
}
#[derive(Default)]
struct Registry {
    processes: HashMap<String, Arc<Mutex<Process>>>,
    views: HashMap<String, View>,
    plans: HashMap<String, Plan>,
    runs: HashMap<String, Run>,
    approvals: HashSet<String>,
}
fn registry() -> &'static Mutex<Registry> {
    static REGISTRY: OnceLock<Mutex<Registry>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(Registry::default()))
}
fn lifecycle_lock() -> &'static Mutex<()> {
    static LOCK: Mutex<()> = Mutex::new(());
    &LOCK
}
fn project(call: &Call) -> Result<String> {
    call.scope
        .get("projectId")
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| err("INVALID_ARGUMENT", "请选择项目"))
}
fn field<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .ok_or_else(|| err("INVALID_ARGUMENT", format!("缺少 {key}")))
}
fn process_for(pid: &str, project: Option<&str>) -> Result<Arc<Mutex<Process>>> {
    let r = registry().lock().unwrap();
    let p = r
        .processes
        .get(pid)
        .cloned()
        .ok_or_else(|| err("NOT_FOUND", "进程不存在"))?;
    if project.is_some_and(|id| p.lock().unwrap().project != id) {
        return Err(err("PERMISSION_DENIED", "进程属于其他项目"));
    }
    Ok(p)
}
fn cwd(root: &Path, relative: &str) -> Result<PathBuf> {
    let rel = Path::new(relative);
    if rel.is_absolute() {
        return Err(err("INVALID_ARGUMENT", "工作目录必须是项目相对路径"));
    }
    let root = root.canonicalize().map_err(io)?;
    let path = root.join(rel).canonicalize().map_err(io)?;
    if !path.starts_with(&root) || !path.is_dir() {
        return Err(err("PERMISSION_DENIED", "工作目录必须位于项目内"));
    }
    Ok(path)
}
#[cfg(unix)]
fn executable(value: &str) -> Result<PathBuf> {
    use std::os::unix::fs::PermissionsExt;
    if value.as_bytes().get(1) == Some(&b':') || value.starts_with("\\\\") {
        return Err(err(
            "UNSUPPORTED_PLATFORM",
            "此方案使用 Windows 程序路径；请编辑为当前 macOS 的可执行程序或 Shell",
        ));
    }
    let valid = |p: &Path| {
        p.is_file()
            && p.metadata()
                .map(|m| m.permissions().mode() & 0o111 != 0)
                .unwrap_or(false)
    };
    if value.contains('/') {
        let p = PathBuf::from(value);
        if p.is_absolute() && valid(&p) {
            return Ok(p);
        }
    } else {
        let paths = format!(
            "{}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            std::env::var("PATH").unwrap_or_default()
        );
        for dir in paths.split(':').filter(|x| !x.is_empty()) {
            let p = Path::new(dir).join(value);
            if valid(&p) {
                return Ok(p);
            }
        }
        if let Some(home_dir) = std::env::var_os("HOME").map(PathBuf::from) {
            let mut directories = vec![
                home_dir.join(".volta/bin"),
                home_dir.join(".local/share/mise/shims"),
                home_dir.join(".asdf/shims"),
                home_dir.join(".local/bin"),
            ];
            if ["node", "npm", "npx", "pnpm", "yarn", "corepack"].contains(&value) {
                let versions = home_dir.join(".nvm/versions/node");
                if let Ok(entries) = fs::read_dir(versions) {
                    let mut installed: Vec<_> = entries
                        .flatten()
                        .filter(|entry| entry.file_type().is_ok_and(|t| t.is_dir()))
                        .map(|entry| entry.path())
                        .collect();
                    installed.sort_by_key(|path| {
                        path.file_name()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .trim_start_matches('v')
                            .split('.')
                            .map(|v| v.parse::<u32>().unwrap_or(0))
                            .collect::<Vec<_>>()
                    });
                    installed.reverse();
                    let default =
                        fs::read_to_string(home_dir.join(".nvm/alias/default")).unwrap_or_default();
                    let default = default.trim().trim_start_matches('v');
                    if !default.is_empty() {
                        if let Some(index) = installed.iter().position(|path| {
                            path.file_name()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .trim_start_matches('v')
                                .starts_with(default)
                        }) {
                            let preferred = installed.remove(index);
                            installed.insert(0, preferred);
                        }
                    }
                    directories.extend(installed.into_iter().map(|path| path.join("bin")));
                }
            }
            for directory in directories {
                let path = directory.join(value);
                if valid(&path) {
                    return Ok(path);
                }
            }
        }
    }
    Err(err(
        "DEPENDENCY_UNAVAILABLE",
        format!("找不到可执行程序：{value}"),
    ))
}

#[cfg(windows)]
fn executable(value: &str) -> Result<PathBuf> {
    if value.starts_with('/') {
        return Err(err("UNSUPPORTED_PLATFORM", "此方案使用 Unix 程序路径；请编辑为 Windows 可执行程序或 PowerShell"));
    }
    let extensions: Vec<String> = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".EXE;.COM;.BAT;.CMD".into())
        .split(';').filter(|s| !s.is_empty()).map(str::to_owned).collect();
    let find = |path: PathBuf| {
        if path.is_file() { return Some(path); }
        if path.extension().is_none() {
            for extension in &extensions {
                let candidate = PathBuf::from(format!("{}{}", path.to_string_lossy(), extension));
                if candidate.is_file() { return Some(candidate); }
            }
        }
        None
    };
    let path = PathBuf::from(value);
    if path.is_absolute() {
        if let Some(path) = find(path) { return Ok(path); }
    } else if !value.contains('/') && !value.contains(std::path::MAIN_SEPARATOR) {
        let mut directories: Vec<PathBuf> = std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()).collect();
        if let Some(system) = std::env::var_os("SystemRoot") {
            directories.push(PathBuf::from(&system).join("System32"));
            directories.push(PathBuf::from(system).join("System32/WindowsPowerShell/v1.0"));
        }
        for directory in directories {
            if let Some(path) = find(directory.join(value)) { return Ok(path); }
        }
    }
    Err(err("DEPENDENCY_UNAVAILABLE", format!("找不到可执行程序：{value}")))
}
fn shell_arguments(shell: &str, script: &str) -> Vec<String> {
    #[cfg(not(windows))]
    let _ = shell;
    #[cfg(windows)]
    {
        let name = Path::new(shell).file_name().unwrap_or_default().to_string_lossy().to_ascii_lowercase();
        if ["powershell", "powershell.exe", "pwsh", "pwsh.exe"].contains(&name.as_str()) {
            return vec!["-NoLogo".into(), "-NoProfile".into(), "-Command".into(), script.into()];
        }
        if ["cmd", "cmd.exe"].contains(&name.as_str()) {
            return vec!["/D".into(), "/S".into(), "/C".into(), script.into()];
        }
    }
    vec!["-lc".into(), script.into()]
}
fn terminal_shell(reference: Option<&str>) -> Result<(String, Vec<String>)> {
    #[cfg(windows)]
    {
        let name = match reference.unwrap_or("powershell") {
            "powershell" | "powershell.exe" | "zsh" => "powershell.exe",
            "pwsh" | "pwsh.exe" => "pwsh.exe",
            "cmd" | "cmd.exe" => "cmd.exe",
            _ => return Err(err("INVALID_ARGUMENT", "未知 Windows shell")),
        };
        let shell = executable(name)?.to_string_lossy().into_owned();
        let args = if name == "cmd.exe" { vec!["/Q".into()] } else { vec!["-NoLogo".into()] };
        return Ok((shell, args));
    }
    #[cfg(unix)]
    {
        let shell = match reference.unwrap_or("zsh") {
            "zsh" => "/bin/zsh", "bash" => "/bin/bash", "sh" => "/bin/sh",
            _ => return Err(err("INVALID_ARGUMENT", "未知 shell")),
        };
        Ok((shell.into(), vec!["-l".into()]))
    }
}
fn profile_path(state: &HostState, project: &str) -> PathBuf {
    state
        .data_dir()
        .join("launch-profiles")
        .join(format!("{}.json", digest(project.as_bytes())))
}
fn profiles(state: &HostState, project: &str) -> Result<Vec<LaunchProfile>> {
    let path = profile_path(state, project);
    if !path.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&fs::read(path).map_err(io)?).map_err(io)
}
fn write_profiles(state: &HostState, project: &str, profiles: &[LaunchProfile]) -> Result<()> {
    let path = profile_path(state, project);
    crate::state::atomic_json(&path, &profiles)
}
fn export_profile(mut profile: LaunchProfile) -> Value {
    profile.project_id = String::new();
    profile.profile_id = String::new();
    profile.revision = 0;
    let mut redacted = vec![];
    for step in &mut profile.steps {
        for (name, value) in &mut step.env {
            let key = name.to_ascii_uppercase();
            if [
                "SECRET",
                "TOKEN",
                "PASSWORD",
                "API_KEY",
                "CREDENTIAL",
                "PRIVATE_KEY",
            ]
            .iter()
            .any(|word| key.contains(word))
            {
                value.clear();
                redacted.push(name.clone());
            }
        }
        for (name, reference) in &mut step.secret_refs {
            *reference = "请重新选择凭据".into();
            redacted.push(name.clone());
        }
    }
    json!({"format":"horizon-launch@1","profile":profile,"redactedEnvKeys":redacted})
}
fn detect_scripts(root: &Path) -> Result<Value> {
    let mut queue = VecDeque::from([(root.to_path_buf(), 0usize)]);
    let mut candidates = vec![];
    let mut warnings = vec![];
    let mut visited = 0;
    let manager = if root.join("pnpm-lock.yaml").is_file() {
        "pnpm"
    } else if root.join("yarn.lock").is_file() {
        "yarn"
    } else if root.join("bun.lock").is_file() || root.join("bun.lockb").is_file() {
        "bun"
    } else {
        "npm"
    };
    while let Some((dir, depth)) = queue.pop_front() {
        visited += 1;
        if visited > 300 || candidates.len() >= 256 {
            warnings.push("发现达到 300 个目录或 256 个脚本上限；可手动补充方案。".to_string());
            break;
        }
        let file = dir.join("package.json");
        if file.is_file()
            && !fs::symlink_metadata(&file)
                .map_err(io)?
                .file_type()
                .is_symlink()
        {
            if fs::metadata(&file).map_err(io)?.len() > 1024 * 1024 {
                warnings.push(format!(
                    "{} 超过 1 MiB，已跳过",
                    file.strip_prefix(root).unwrap_or(&file).display()
                ));
            } else {
                match serde_json::from_slice::<Value>(&fs::read(&file).map_err(io)?) {
                    Ok(package) => {
                        if let Some(scripts) = package["scripts"].as_object() {
                            let manager = package["packageManager"]
                                .as_str()
                                .and_then(|s| s.split('@').next())
                                .filter(|m| ["npm", "pnpm", "yarn", "bun"].contains(m))
                                .unwrap_or(manager);
                            for (name, command) in scripts {
                                if !command.is_string() {
                                    continue;
                                }
                                let relative = dir
                                    .strip_prefix(root)
                                    .unwrap_or(Path::new("."))
                                    .to_string_lossy();
                                let relative = if relative.is_empty() { "." } else { &relative };
                                candidates.push(json!({"sourceFile":file.strip_prefix(root).unwrap().to_string_lossy(),"scriptName":name,"originalCommand":command,"cwd":relative,"suggestedStep":{"stepId":id("step"),"title":name,"dependsOn":[],"command":{"kind":"exec","executable":manager,"args":["run",name]},"cwd":relative,"env":{},"secretRefs":{},"mode":"pipe","lifecycle":"service","ready":{"kind":"processStarted"}}}));
                                if candidates.len() >= 256 {
                                    break;
                                }
                            }
                        }
                    }
                    Err(_) => warnings.push(format!(
                        "{} 不是有效 JSON，已跳过",
                        file.strip_prefix(root).unwrap_or(&file).display()
                    )),
                }
            }
        }
        if depth < 3 {
            if let Ok(entries) = fs::read_dir(&dir) {
                let mut children: Vec<_> = entries
                    .flatten()
                    .filter(|entry| {
                        entry
                            .file_type()
                            .is_ok_and(|t| t.is_dir() && !t.is_symlink())
                            && !entry.file_name().to_string_lossy().starts_with('.')
                            && ![
                                "node_modules",
                                "target",
                                "dist",
                                "build",
                                "coverage",
                                "vendor",
                            ]
                            .contains(&entry.file_name().to_string_lossy().as_ref())
                    })
                    .map(|entry| entry.path())
                    .collect();
                children.sort();
                for child in children {
                    queue.push_back((child, depth + 1));
                }
            }
        }
    }
    Ok(json!({"candidates":candidates,"warnings":warnings}))
}
fn topology(profile: &LaunchProfile) -> Result<Vec<usize>> {
    if profile.schema_version != 1
        || profile.name.trim().is_empty()
        || profile.steps.is_empty()
        || profile.steps.len() > 32
        || !["stopStarted", "keepRunning"].contains(&profile.failure_policy.as_str())
    {
        return Err(err("INVALID_ARGUMENT", "方案需要名称和 1–32 个步骤"));
    }
    let ids: HashSet<_> = profile.steps.iter().map(|s| s.step_id.as_str()).collect();
    if ids.len() != profile.steps.len() || ids.contains("") {
        return Err(err("INVALID_ARGUMENT", "步骤 ID 必须唯一且非空"));
    }
    let mut done = HashSet::new();
    let mut order = Vec::new();
    while order.len() < profile.steps.len() {
        let before = order.len();
        for (index, s) in profile.steps.iter().enumerate() {
            if done.contains(s.step_id.as_str()) {
                continue;
            }
            if s.depends_on.iter().any(|d| !ids.contains(d.as_str())) {
                return Err(err("INVALID_ARGUMENT", "依赖步骤不存在"));
            }
            if s.depends_on.iter().all(|d| done.contains(d.as_str())) {
                done.insert(s.step_id.as_str());
                order.push(index);
            }
        }
        if order.len() == before {
            return Err(err("INVALID_ARGUMENT", "步骤依赖存在循环"));
        }
    }
    Ok(order)
}
fn validate(profile: &LaunchProfile, root: &Path) -> Result<Vec<usize>> {
    let order = topology(profile)?;
    for step in &profile.steps {
        cwd(root, &step.cwd)?;
        if !["pty", "pipe"].contains(&step.mode.as_str())
            || !["oneshot", "service"].contains(&step.lifecycle.as_str())
        {
            return Err(err("INVALID_ARGUMENT", "无效进程模式"));
        }
        if step.lifecycle == "oneshot" && !matches!(step.ready, Ready::Exit { .. }) {
            return Err(err("INVALID_ARGUMENT", "一次性命令须使用退出码就绪条件"));
        }
        for key in step.env.keys().chain(step.secret_refs.keys()) {
            if key.is_empty() || key.contains(['=', '\0']) {
                return Err(err("INVALID_ARGUMENT", "环境变量名无效"));
            }
        }
        match &step.ready {
            Ready::Tcp {
                host,
                port,
                timeout_ms,
            } => {
                if !["127.0.0.1", "::1"].contains(&host.as_str()) || *port == 0 {
                    return Err(err("INVALID_ARGUMENT", "TCP 就绪仅支持本地有效端口"));
                }
                timeout(*timeout_ms)?;
            }
            Ready::Http {
                url,
                timeout_ms,
                status_codes,
            } => {
                local_url(url)?;
                timeout(*timeout_ms)?;
                if status_codes.is_empty() {
                    return Err(err("INVALID_ARGUMENT", "请填写 HTTP 就绪状态码"));
                }
            }
            Ready::Stdout {
                pattern,
                timeout_ms,
            } => {
                timeout(*timeout_ms)?;
                regex::Regex::new(pattern).map_err(|e| err("INVALID_ARGUMENT", e.to_string()))?;
            }
            Ready::Exit { codes } if codes.is_empty() => {
                return Err(err("INVALID_ARGUMENT", "请填写允许的退出码"))
            }
            _ => {}
        }
        if let Some(url) = step.on_ready.as_ref().and_then(|r| r.open_url.as_ref()) {
            http_url(url)?;
        }
        if step
            .on_ready
            .as_ref()
            .is_some_and(|r| r.auto_open_url && r.open_url.is_none())
        {
            return Err(err("INVALID_ARGUMENT", "自动打开前请保存 URL"));
        }
    }
    Ok(order)
}
fn timeout(ms: u64) -> Result<()> {
    if !(100..=600_000).contains(&ms) {
        Err(err("INVALID_ARGUMENT", "就绪超时须在 100–600000 毫秒内"))
    } else {
        Ok(())
    }
}
fn local_url(value: &str) -> Result<reqwest::Url> {
    let url = http_url(value)?;
    if !["127.0.0.1", "localhost", "[::1]", "::1"].contains(&url.host_str().unwrap_or("")) {
        return Err(err("INVALID_ARGUMENT", "就绪探测需要本地 HTTP/HTTPS 地址"));
    }
    Ok(url)
}
fn http_url(value: &str) -> Result<reqwest::Url> {
    let url = reqwest::Url::parse(value).map_err(|_| err("INVALID_ARGUMENT", "URL 无效"))?;
    if !["http", "https"].contains(&url.scheme())
        || url.host_str().is_none()
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return Err(err(
            "INVALID_ARGUMENT",
            "URL 必须是 HTTP/HTTPS 地址，且不包含登录凭据",
        ));
    }
    Ok(url)
}
fn sources(steps: &[Resolved]) -> Result<BTreeMap<String, String>> {
    let mut result = BTreeMap::new();
    for step in steps {
        let mut files = vec![step.cwd.join("package.json")];
        if let LaunchCommand::Exec { args, .. } = &step.step.command {
            for arg in args {
                let path = step.cwd.join(arg);
                if path.is_file() {
                    files.push(path);
                }
            }
        }
        for file in files {
            if file.is_file() {
                let metadata = fs::metadata(&file).map_err(io)?;
                if metadata.len() > 16 * 1024 * 1024 {
                    return Err(err(
                        "RESOURCE_LIMIT",
                        "命令来源文件超过 16 MiB，请使用较小脚本入口",
                    ));
                }
                result.insert(
                    file.to_string_lossy().into(),
                    digest(&fs::read(file).map_err(io)?),
                );
            }
        }
    }
    Ok(result)
}
fn plan_value(plan: &Plan) -> Value {
    json!({"planId":plan.id,"profileId":plan.profile.profile_id,"profileRevision":plan.profile.revision,"digest":plan.digest,"expiresAt":plan.expires.to_string(),"extensionActions":plan.extension_actions,"requiresApproval":!plan.approved_before,"resolvedSteps":plan.steps.iter().map(|s|json!({"stepId":s.step.step_id,"executable":s.executable,"args":s.args,"cwd":s.cwd,"envKeys":s.step.env.keys().chain(s.step.secret_refs.keys()).collect::<Vec<_>>(),"mode":s.step.mode,"ready":s.step.ready,"lifecycle":s.step.lifecycle})).collect::<Vec<_>>()})
}

fn flush_views() {
    let mut r = registry().lock().unwrap();
    let mut in_flight: u64 = r.views.values().map(|v| v.sent.saturating_sub(v.ack)).sum();
    let processes = r.processes.clone();
    let mut dead = vec![];
    for (id, view) in r.views.iter_mut() {
        if in_flight >= GLOBAL_WINDOW || view.sent.saturating_sub(view.ack) >= WINDOW {
            continue;
        }
        let Some(p) = processes.get(&view.process) else {
            dead.push(id.clone());
            continue;
        };
        let p = p.lock().unwrap();
        let gap = view.sent < p.output.start;
        let offset = view.sent.max(p.output.start);
        let bytes = p.output.read(
            offset,
            CHUNK
                .min((WINDOW.saturating_sub(view.sent.saturating_sub(view.ack))) as usize)
                .min((GLOBAL_WINDOW - in_flight) as usize),
        );
        if bytes.is_empty() {
            continue;
        }
        view.seq += 1;
        let data = json!({"requestId":view.request,"viewSubscriptionId":id,"terminalSessionId":view.process,"seq":view.seq,"byteOffset":offset.to_string(),"bufferStart":p.output.start.to_string(),"encoding":"base64","data":STANDARD.encode(&bytes),"gap":gap});
        let sent = if let Some(ch) = &view.channel {
            ch.send(data).is_ok()
        } else {
            view.app.emit(EVENT_TERMINAL, data).is_ok()
        };
        if !sent {
            dead.push(id.clone());
            continue;
        }
        if gap {
            view.ack = offset;
        }
        view.sent = offset + bytes.len() as u64;
        in_flight += bytes.len() as u64;
    }
    for id in dead {
        r.views.remove(&id);
    }
}
struct Redactor {
    secrets: Vec<Vec<u8>>,
    pending: Vec<u8>,
}
impl Redactor {
    fn feed(&mut self, data: &[u8], final_chunk: bool) -> Vec<u8> {
        if self.secrets.is_empty() {
            return data.to_vec();
        }
        self.pending.extend_from_slice(data);
        let mut out = Vec::with_capacity(self.pending.len());
        let mut offset = 0;
        while offset < self.pending.len() {
            let tail = &self.pending[offset..];
            if let Some(secret) = self.secrets.iter().find(|secret| tail.starts_with(secret)) {
                out.extend_from_slice(b"[REDACTED]");
                offset += secret.len();
            } else if !final_chunk && self.secrets.iter().any(|secret| secret.starts_with(tail)) {
                break;
            } else {
                out.push(self.pending[offset]);
                offset += 1;
            }
        }
        self.pending.drain(..offset);
        out
    }
}
fn read_output(
    mut reader: Box<dyn Read + Send>,
    process: Arc<Mutex<Process>>,
    secrets: Vec<Vec<u8>>,
) {
    thread::spawn(move || {
        let mut buf = [0; 16384];
        let mut redactor = Redactor {
            secrets,
            pending: vec![],
        };
        loop {
            match reader.read(&mut buf) {
                Ok(0) => {
                    let tail = redactor.feed(&[], true);
                    process.lock().unwrap().output.push(&tail);
                    flush_views();
                    break;
                }
                Ok(n) => {
                    process
                        .lock()
                        .unwrap()
                        .output
                        .push(&redactor.feed(&buf[..n], false));
                    flush_views();
                }
                Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
                Err(_) => break,
            }
        }
    });
}

#[cfg(windows)]
fn retain_windows_spawn_failure(mut process: Process, mut child: Box<dyn portable_pty::Child + Send + Sync>, app: Option<AppHandle>, problem: std::io::Error) -> HostError {
    if child.try_wait().is_ok_and(|status| status.is_some()) { return io(problem); }
    let id = process.id.clone(); let pid = process.pid;
    process.state = "stopping".into();
    process.killer = Some(child.clone_killer());
    let run = process.run.clone(); let step = process.step.clone();
    let p = Arc::new(Mutex::new(process));
    {
        let mut r = registry().lock().unwrap(); r.processes.insert(id.clone(), p.clone());
        if let Some(run) = run.and_then(|run| r.runs.get_mut(&run)) {
            if !run.order.contains(&id) { run.order.push(id.clone()); }
            run.state = "partial".into(); run.revision += 1;
            for item in &mut run.steps { if item["stepId"].as_str() == step.as_deref() { item["pid"] = json!(pid); item["state"] = json!("stopping"); item["stopError"] = json!(problem.to_string()); } }
        }
    }
    thread::spawn(move || {
        loop {
            if let Ok(Some(status)) = child.try_wait() { process_exited(&p, status.exit_code() as i32, &app); break; }
            thread::sleep(Duration::from_millis(50));
        }
    });
    err("CLEANUP_FAILED", format!("{problem}; 自有启动资源 {id}/PID {pid} 清退未确认，记录已保留"))
}
fn process_exited(process: &Arc<Mutex<Process>>, code: i32, app: &Option<AppHandle>) {
    #[cfg(windows)]
    {
        let job = {
            let mut p = process.lock().unwrap();
            if p.exit_finalizing { return; }
            p.exit_finalizing = true;
            p.job.clone()
        };
        if let Some(job) = job {
            let settled = (|| -> std::io::Result<bool> {
                job.terminate()?;
                let started = Instant::now();
                while !job.is_empty()? && started.elapsed() < Duration::from_secs(2) { thread::sleep(Duration::from_millis(20)); }
                job.is_empty()
            })();
            if !matches!(settled, Ok(true)) {
                let mut p = process.lock().unwrap(); p.exit = Some(code); p.state = "stopping".into(); p.revision += 1;
                p.exit_finalizing = false;
                p.output.push(b"\r\n[Horizon] Windows owned child cleanup remains unconfirmed.\r\n");
                if let Some(app) = app { let _ = app.emit(EVENT_PROCESS, p.value()); }
                return;
            }
        }
    }
    #[cfg(not(windows))]
    let (run, step) = {
        let mut p = process.lock().unwrap();
        p.state = "exited".into();
        p.revision += 1;
        p.exit = Some(code);
        p.writer = None;
        p.master = None;
        (p.run.clone(), p.step.clone())
    };
    #[cfg(windows)]
    let (run, step) = {
        let (run, step, writer, master) = {
            let mut p = process.lock().unwrap();
            p.state = "stopping".into();
            p.revision += 1;
            p.exit = Some(code);
            (p.run.clone(), p.step.clone(), p.writer.take(), p.master.take())
        };
        // ClosePseudoConsole may synchronously flush a final output frame on
        // older Windows. Keep Process unlocked so read_output can keep draining.
        drop(writer);
        drop(master);
        {
            let mut p = process.lock().unwrap();
            // Lease release must see this resource as exited, while stop callers
            // still wait on exit_finalizing until lease completion is known.
            p.state = "exited".into();
            p.revision += 1;
        }
        (run, step)
    };
    let _ = release_process_lease(process, app.as_ref());
    #[cfg(windows)]
    { process.lock().unwrap().exit_finalizing = false; }
    if let Some(app) = app {
        let _ = app.emit(EVENT_PROCESS, process.lock().unwrap().value());
    }
    let mut cleanup = None;
    if let (Some(run_id), Some(step_id)) = (run, step) {
        let mut r = registry().lock().unwrap();
        let remaining = r.processes.values().any(|p| {
            let p = p.lock().unwrap();
            p.run.as_deref() == Some(&run_id) && p.state != "exited"
        });
        if let Some(run) = r.runs.get_mut(&run_id) {
            run.revision += 1;
            let service = run
                .profile
                .steps
                .iter()
                .any(|s| s.step_id == step_id && s.lifecycle == "service");
            for step in &mut run.steps {
                if step["stepId"] == step_id {
                    step["exitCode"] = json!(code);
                    step["state"] = json!("exited");
                    if service {
                        step["ready"] = json!(false);
                    }
                }
            }
            if service && matches!(run.state.as_str(), "running" | "starting" | "partial") {
                run.state = "partial".into();
                if run.profile.failure_policy == "stopStarted" || !remaining {
                    cleanup = Some((run_id.clone(), run.project.clone()));
                }
            }
            if let Some(app) = app {
                let _ = app.emit(EVENT_LAUNCH, run.value());
            }
        }
    }
    if let Some((run_id, project)) = cleanup {
        let app = app.clone();
        thread::spawn(move || {
            if stop_run(&run_id, &app, &project)
                .is_ok_and(|result| result["failed"].as_array().is_some_and(Vec::is_empty))
            {
                update_run(&run_id, &app, |run| run.state = "failed".into());
            }
        });
    }
    flush_views();
}
fn spawn_process(
    resolved: &Resolved,
    project: &str,
    extension: &str,
    run: Option<&str>,
    app: Option<AppHandle>,
    identity: Option<ProcessIdentity>,
) -> Result<String> {
    {
        let mut r = registry().lock().unwrap();
        if r.processes
            .values()
            .filter(|p| p.lock().unwrap().state != "exited")
            .count()
            >= 32
        {
            return Err(err("RESOURCE_LIMIT", "最多同时运行 32 个进程"));
        }
        if r.processes.len() >= 64 {
            let mut exited: Vec<_> = r
                .processes
                .iter()
                .filter_map(|(id, p)| {
                    let p = p.lock().unwrap();
                    (p.state == "exited").then_some((id.clone(), p.started))
                })
                .collect();
            exited.sort_by_key(|p| p.1);
            if let Some((id, _)) = exited.first() {
                r.processes.remove(id);
            }
        }
    }
    let process_id = id("process");
    #[cfg(unix)]
    let command_path = resolved.step.env.get("PATH").cloned().unwrap_or_else(|| {
        format!(
            "{}:{}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            resolved
                .executable
                .parent()
                .unwrap_or(Path::new("/usr/bin"))
                .to_string_lossy(),
            std::env::var("PATH").unwrap_or_default()
        )
    });
    #[cfg(windows)]
    let command_path = if let Some(path) = resolved.step.env.get("PATH") { path.clone() } else {
        let mut paths = vec![resolved.executable.parent().unwrap_or(Path::new(".")).to_path_buf()];
        paths.extend(std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default()));
        std::env::join_paths(paths).map_err(io)?.to_string_lossy().into_owned()
    };
    let identity = identity.unwrap_or_else(|| ProcessIdentity {
        activation_id: "test-owned-process".into(),
        lease: None,
    });
    let secrets: Vec<Vec<u8>> = resolved
        .step
        .secret_refs
        .keys()
        .filter_map(|key| resolved.step.env.get(key))
        .filter(|value| !value.is_empty())
        .map(|value| value.as_bytes().to_vec())
        .collect();
    let mut process = Process {
        id: process_id.clone(),
        project: project.into(),
        extension: extension.into(),
        activation_id: identity.activation_id,
        direct_lease: identity.lease,
        lease_releasing: false,
        #[cfg(windows)]
        exit_finalizing: false,
        run: run.map(str::to_owned),
        step: run.map(|_| resolved.step.step_id.clone()),
        title: resolved.step.title.clone(),
        cwd: resolved.cwd.to_string_lossy().into(),
        pid: 0,
        started: stamp(),
        state: "running".into(),
        revision: 1,
        exit: None,
        is_terminal: resolved.step.mode == "pty",
        #[cfg(unix)]
        stop_groups: vec![],
        #[cfg(windows)]
        job: None,
        master: None,
        writer: None,
        killer: None,
        output: Output::new(),
    };
    if resolved.step.mode == "pty" {
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(io)?;
        let mut command = CommandBuilder::new(&resolved.executable);
        command.args(&resolved.args);
        command.cwd(&resolved.cwd);
        command.env("TERM", "xterm-256color");
        command.env("COLORTERM", "truecolor");
        command.env("PATH", &command_path);
        for (key, value) in &resolved.step.env {
            command.env(key, value);
        }
        #[cfg(windows)]
        command.set_creation_flags(crate::windows_process::SUSPENDED_CREATION_FLAGS);
        let mut child = pair.slave.spawn_command(command).map_err(io)?;
        drop(pair.slave);
        process.pid = child
            .process_id()
            .ok_or_else(|| err("IO_ERROR", "无法取得 PTY 进程 ID"))?;
        process.killer = Some(child.clone_killer());
        #[cfg(windows)]
        {
            let Some(handle) = child.as_raw_handle() else {
                let _ = child.kill();
                return Err(retain_windows_spawn_failure(process, child, app.clone(), std::io::Error::other("Windows PTY process handle unavailable")));
            };
            match unsafe { crate::windows_process::attach_suspended(handle, process.pid) } {
                Ok(job) => process.job = Some(job),
                Err(error) => return Err(retain_windows_spawn_failure(process, child, app.clone(), error)),
            }
        }
        let reader = pair.master.try_clone_reader().map_err(io)?;
        process.writer = Some(Arc::new(Mutex::new(pair.master.take_writer().map_err(io)?)));
        process.master = Some(pair.master);
        let p = Arc::new(Mutex::new(process));
        registry()
            .lock()
            .unwrap()
            .processes
            .insert(process_id.clone(), p.clone());
        read_output(reader, p.clone(), secrets);
        let a = app.clone();
        thread::spawn(move || {
            let code = child.wait().map(|s| s.exit_code() as i32).unwrap_or(-1);
            process_exited(&p, code, &a);
        });
    } else {
        let mut command = Command::new(&resolved.executable);
        command
            .args(&resolved.args)
            .current_dir(&resolved.cwd)
            .envs(&resolved.step.env)
            .env("PATH", &command_path)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        #[cfg(unix)] { use std::os::unix::process::CommandExt; command.process_group(0); }
        #[cfg(windows)] crate::windows_process::prepare_command(&mut command);
        let mut child = command.spawn().map_err(io)?;
        process.pid = child.id();
        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            process.killer = Some(portable_pty::ChildKiller::clone_killer(&child));
            match unsafe { crate::windows_process::attach_suspended(child.as_raw_handle(), child.id()) } {
                Ok(job) => process.job = Some(job),
                Err(error) => return Err(retain_windows_spawn_failure(process, Box::new(child), app.clone(), error)),
            }
        }
        let out = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        let p = Arc::new(Mutex::new(process));
        registry()
            .lock()
            .unwrap()
            .processes
            .insert(process_id.clone(), p.clone());
        read_output(Box::new(out), p.clone(), secrets.clone());
        read_output(Box::new(stderr), p.clone(), secrets);
        let a = app.clone();
        thread::spawn(move || {
            let code = child.wait().map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
            process_exited(&p, code, &a);
        });
    }
    if let Some(app) = app {
        let _ = app.emit(
            EVENT_PROCESS,
            process_for(&process_id, None)?.lock().unwrap().value(),
        );
    }
    Ok(process_id)
}

// Record descendant groups before stopping the root: interactive shells use separate job groups.
#[cfg(unix)]
fn owned_groups(pid: u32) -> Vec<i32> {
    let mut groups = vec![pid as i32];
    if let Ok(output) = Command::new("/bin/ps")
        .args(["-axo", "pid=,ppid=,pgid="])
        .output()
    {
        let rows: Vec<Vec<i32>> = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|l| {
                l.split_whitespace()
                    .filter_map(|s| s.parse().ok())
                    .collect()
            })
            .filter(|r: &Vec<i32>| r.len() == 3)
            .collect();
        let mut children = HashSet::from([pid as i32]);
        loop {
            let old = children.len();
            for row in &rows {
                if children.contains(&row[1]) {
                    children.insert(row[0]);
                    if row[2] > 1 && !groups.contains(&row[2]) {
                        groups.push(row[2]);
                    }
                }
            }
            if children.len() == old {
                break;
            }
        }
    }
    groups.reverse();
    groups
}
#[cfg(unix)]
fn signal_groups(groups: &[i32], signal: i32) {
    for pgid in groups {
        if *pgid > 1 {
            unsafe {
                libc::kill(-*pgid, signal);
            }
        }
    }
}
#[cfg(all(test, unix))]
fn stop_failures_once() -> &'static Mutex<HashSet<String>> {
    static RUNS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    RUNS.get_or_init(|| Mutex::new(HashSet::new()))
}
#[cfg(unix)]
fn stop_process(
    process: &Arc<Mutex<Process>>,
    force: bool,
    app: Option<&AppHandle>,
) -> Result<Value> {
    if process.lock().unwrap().exit.is_some() {
        release_process_lease(process, app)?;
    }
    let pid = {
        let mut p = process.lock().unwrap();
        if p.state == "exited" && !p.lease_releasing {
            return Ok(json!({"exited":true,"forced":false,"exitCode":p.exit}));
        }
        p.state = "stopping".into();
        p.revision += 1;
        p.pid
    };
    let mut groups = owned_groups(pid);
    {
        let mut p = process.lock().unwrap();
        for group in &p.stop_groups {
            if !groups.contains(group) {
                groups.push(*group);
            }
        }
        p.stop_groups = groups.clone();
        if let Some(app) = app {
            let _ = app.emit(EVENT_PROCESS, p.value());
        }
    }
    #[cfg(test)]
    if let Some(run_id) = process.lock().unwrap().run.as_ref() {
        if stop_failures_once().lock().unwrap().remove(run_id) {
            return Err(err(
                "IO_ERROR",
                "受控测试故障：本次停止请求在发送系统信号前失败",
            ));
        }
    }
    signal_groups(&groups, if force { libc::SIGKILL } else { libc::SIGTERM });
    let started = Instant::now();
    while started.elapsed() < Duration::from_millis(if force { 500 } else { 1800 }) {
        if {
            let p = process.lock().unwrap();
            p.state == "exited" && !p.lease_releasing
        } {
            break;
        }
        thread::sleep(Duration::from_millis(30));
    }
    let forced = force || process.lock().unwrap().state != "exited";
    if forced {
        signal_groups(&groups, libc::SIGKILL);
        if let Some(killer) = process.lock().unwrap().killer.as_mut() {
            let _ = killer.kill();
        }
        let until = Instant::now();
        while until.elapsed() < Duration::from_secs(2) && process.lock().unwrap().state != "exited"
        {
            thread::sleep(Duration::from_millis(25));
        }
    } else {
        // A root can exit before one of its owned job groups.
        signal_groups(&groups, libc::SIGKILL);
    }
    let stopped_at = Instant::now();
    let groups_alive = || {
        groups.iter().any(|group| unsafe {
            libc::kill(-*group, 0) == 0
                || std::io::Error::last_os_error().raw_os_error() == Some(libc::EPERM)
        })
    };
    while groups_alive() && stopped_at.elapsed() < Duration::from_millis(700) {
        thread::sleep(Duration::from_millis(25));
    }
    let mut p = process.lock().unwrap();
    if groups_alive() {
        p.state = "stopping".into();
        p.revision += 1;
        return Err(err("TIMEOUT", "子进程组停止尚未确认，请重试强制结束"));
    }
    if p.state != "exited" || p.lease_releasing {
        return Err(err("TIMEOUT", "进程停止尚未确认，请重试强制结束"));
    }
    Ok(json!({"exited":true,"forced":forced,"exitCode":p.exit}))
}

#[cfg(windows)]
fn stop_process(process: &Arc<Mutex<Process>>, force: bool, app: Option<&AppHandle>) -> Result<Value> {
    let job = {
        let mut p = process.lock().unwrap();
        if p.state == "exited" && !p.exit_finalizing && !p.lease_releasing && p.job.as_ref().is_none_or(|job| job.is_empty().unwrap_or(false)) {
            return Ok(json!({"exited":true,"forced":false,"exitCode":p.exit}));
        }
        if !p.exit_finalizing {
            p.state = "stopping".into(); p.revision += 1;
            if let Some(app) = app { let _ = app.emit(EVENT_PROCESS, p.value()); }
        }
        p.job.clone()
    };
    if let Some(job) = &job { job.terminate().map_err(io)?; }
    else if let Some(killer) = process.lock().unwrap().killer.as_mut() { let _ = killer.kill(); }
    let started = Instant::now();
    while started.elapsed() < Duration::from_millis(if force { 2500 } else { 2700 }) {
        let empty = job.as_ref().is_none_or(|job| job.is_empty().unwrap_or(false));
        let (root_exit, exited, finalizing) = { let p = process.lock().unwrap(); (p.exit, p.state == "exited", p.exit_finalizing) };
        if empty {
            if let Some(code) = root_exit.filter(|_| !exited && !finalizing) { process_exited(process, code, &app.cloned()); }
            let p = process.lock().unwrap();
            if p.state == "exited" && !p.exit_finalizing && !p.lease_releasing {
                return Ok(json!({"exited":true,"forced":true,"exitCode":p.exit}));
            }
        }
        thread::sleep(Duration::from_millis(25));
    }
    let mut p = process.lock().unwrap();
    if !p.exit_finalizing { p.state = "stopping".into(); p.revision += 1; }
    Err(err("TIMEOUT", "自有 Windows Job/进程停止尚未确认，请重试强制结束"))
}
fn process_snapshot(project_id: Option<&str>, active_only: bool) -> Value {
    let r = registry().lock().unwrap();
    let mut items: Vec<_> =
        r.processes
            .values()
            .filter_map(|p| {
                let p = p.lock().unwrap();
                (project_id.is_none_or(|id| id == p.project)
                    && (!active_only || p.state != "exited"))
                    .then(|| {
                        let mut value = p.value();
                        if active_only {
                            value["resourceId"] = json!(p.id);
                            value["ownerExtensionId"] = json!(p.extension);
                            value["kind"] = json!(if p.is_terminal {
                                "terminal"
                            } else {
                                "launchProcess"
                            });
                            value["requiresExtensions"] =
                                json!(if p.is_terminal
                                    || p.run.as_ref().and_then(|id| r.runs.get(id)).is_some_and(
                                        |run| run.profile.steps.iter().any(|s| s.mode == "pty")
                                    ) {
                                    vec![p.extension.as_str(), "horizon.terminal"]
                                } else {
                                    vec![p.extension.as_str()]
                                });
                        }
                        value
                    })
            })
            .collect();
    items.sort_by_key(|p| {
        p["processInstanceId"]
            .as_str()
            .unwrap_or("")
            .rsplit('-')
            .next()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
    });
    json!({"items":items})
}
pub fn resources(project_id: Option<&str>) -> Value {
    process_snapshot(project_id, true)
}
pub fn stop_extension(extension_id: &str, project_id: Option<&str>) -> Result<Value> {
    let lifecycle = lifecycle_lock().lock().unwrap();
    let mut processes: Vec<_> = {
        let mut r = registry().lock().unwrap();
        for run in r.runs.values_mut() {
            if project_id.is_none_or(|id| id == run.project)
                && (extension_id == "horizon.launch"
                    || (extension_id == "horizon.terminal"
                        && run.profile.steps.iter().any(|s| s.mode == "pty")))
                && !["stopped", "failed"].contains(&run.state.as_str())
            {
                run.state = "stopping".into();
                run.revision += 1;
            }
        }
        let affected_runs: HashSet<_> = r
            .runs
            .values()
            .filter(|run| run.state == "stopping" && project_id.is_none_or(|id| id == run.project))
            .map(|run| run.id.clone())
            .collect();
        r.processes
            .values()
            .filter(|p| {
                let p = p.lock().unwrap();
                (p.extension == extension_id
                    || (extension_id == "horizon.terminal" && p.is_terminal)
                    || p.run
                        .as_ref()
                        .is_some_and(|run| affected_runs.contains(run)))
                    && project_id.is_none_or(|id| id == p.project)
                    && p.state != "exited"
            })
            .cloned()
            .collect()
    };
    drop(lifecycle);
    processes.sort_by_key(|p| {
        p.lock()
            .unwrap()
            .id
            .rsplit('-')
            .next()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
    });
    let mut stopped = vec![];
    let mut failed = vec![];
    for p in processes.into_iter().rev() {
        let id = p.lock().unwrap().id.clone();
        if stop_process(&p, false, None).is_ok() {
            stopped.push(id);
        } else {
            failed.push(id);
        }
    }
    {
        let mut r = registry().lock().unwrap();
        r.views.retain(|_, v| !stopped.contains(&v.process));
        let states: HashMap<_, _> = r
            .processes
            .iter()
            .map(|(id, p)| (id.clone(), p.lock().unwrap().state.clone()))
            .collect();
        for run in r.runs.values_mut().filter(|run| run.state == "stopping") {
            run.revision += 1;
            run.state = if run
                .order
                .iter()
                .all(|id| states.get(id).is_none_or(|s| s == "exited"))
            {
                "stopped"
            } else {
                "partial"
            }
            .into();
        }
    }
    if !failed.is_empty() {
        return Err(err(
            "RESOURCE_BUSY",
            format!("停止失败：{}", failed.join(", ")),
        ));
    }
    let completed: Vec<_> = {
        let r = registry().lock().unwrap();
        r.runs
            .values()
            .filter(|run| {
                run.state == "stopped"
                    && project_id.is_none_or(|project| project == run.project)
                    && run.lease_state.is_some()
            })
            .map(|run| run.id.clone())
            .collect()
    };
    for run in completed {
        release_run_requirements(&run, &None)?;
    }
    Ok(json!({"stopped":stopped,"failed":failed}))
}
pub fn shutdown() {
    let lifecycle = lifecycle_lock().lock().unwrap();
    for run in registry().lock().unwrap().runs.values_mut() {
        run.state = "stopping".into();
    }
    let mut processes: Vec<_> = registry()
        .lock()
        .unwrap()
        .processes
        .values()
        .cloned()
        .collect();
    drop(lifecycle);
    processes.sort_by_key(|p| {
        p.lock()
            .unwrap()
            .id
            .rsplit('-')
            .next()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0)
    });
    for p in processes.into_iter().rev() {
        let _ = stop_process(&p, false, None);
    }
    let runs: Vec<_> = registry().lock().unwrap().runs.keys().cloned().collect();
    for run in runs {
        let _ = release_run_requirements(&run, &None);
    }
    registry().lock().unwrap().views.clear();
}

fn active_run(project: &str, profile: &str) -> Option<String> {
    registry()
        .lock()
        .unwrap()
        .runs
        .values()
        .find(|r| {
            r.project == project
                && r.profile.profile_id == profile
                && !["failed", "stopped"].contains(&r.state.as_str())
        })
        .map(|r| r.id.clone())
}
fn delete_profile(
    state: &HostState,
    project: &str,
    profile_id: &str,
    revision: u64,
) -> Result<Value> {
    let _config_lock = state.file_lock.lock().unwrap();
    if let Some(run) = active_run(project, profile_id) {
        return Err(err("RESOURCE_BUSY", format!("请先停止运行实例 {run}")));
    }
    let mut all = profiles(state, project)?;
    let index = all
        .iter()
        .position(|s| s.profile_id == profile_id)
        .ok_or_else(|| err("NOT_FOUND", "方案不存在"))?;
    if revision != all[index].revision {
        return Err(err("STALE_VERSION", "方案已变化"));
    }
    all.remove(index);
    write_profiles(state, project, &all)?;
    Ok(json!({"deletedId":profile_id}))
}
fn preflight(steps: &[Resolved], allowed_run: Option<&str>) -> Result<()> {
    let mut checked = HashSet::new();
    for s in steps {
        let target = match &s.step.ready {
            Ready::Tcp { host, port, .. } => Some((host.clone(), *port)),
            Ready::Http { url, .. } => {
                let u = local_url(url)?;
                Some((
                    u.host_str().unwrap().trim_matches(['[', ']']).into(),
                    u.port_or_known_default().unwrap(),
                ))
            }
            _ => None,
        };
        if let Some((host, port)) = target {
            if !checked.insert(port) {
                return Err(err(
                    "INVALID_ARGUMENT",
                    format!("多个步骤使用同一就绪端口 {port}"),
                ));
            }
            if (host.as_str(), port)
                .to_socket_addrs()
                .map(|a| {
                    a.into_iter()
                        .any(|a| TcpStream::connect_timeout(&a, Duration::from_millis(150)).is_ok())
                })
                .unwrap_or(false)
                && !port_belongs_to_run(port, allowed_run)
            {
                return Err(err(
                    "PORT_IN_USE",
                    format!(
                        "步骤 {} 的端口 {port} 已被占用；未停止外部进程",
                        s.step.title
                    ),
                ));
            }
        }
    }
    Ok(())
}
fn update_run(run_id: &str, app: &Option<AppHandle>, update: impl FnOnce(&mut Run)) {
    let mut r = registry().lock().unwrap();
    if let Some(run) = r.runs.get_mut(run_id) {
        update(run);
        run.revision += 1;
        if let Some(app) = app {
            let _ = app.emit(EVENT_LAUNCH, run.value());
        }
    }
}
fn claim_ready_url(
    run_id: &str,
    project: &str,
    step_id: &str,
    automatic: bool,
) -> Result<Option<String>> {
    let mut r = registry().lock().unwrap();
    let run = r
        .runs
        .get_mut(run_id)
        .ok_or_else(|| err("NOT_FOUND", "运行实例不存在"))?;
    if run.project != project {
        return Err(err("PERMISSION_DENIED", "实例属于其他项目"));
    }
    let config = run
        .profile
        .steps
        .iter()
        .find(|s| s.step_id == step_id)
        .and_then(|s| s.on_ready.as_ref());
    if automatic && !config.is_some_and(|r| r.auto_open_url) {
        return Ok(None);
    }
    let url = config
        .and_then(|s| s.open_url.clone())
        .ok_or_else(|| err("NOT_FOUND", "此步骤未保存 URL"))?;
    http_url(&url)?;
    let step = run
        .steps
        .iter_mut()
        .find(|s| s["stepId"] == step_id)
        .ok_or_else(|| err("NOT_FOUND", "步骤不存在"))?;
    if step["ready"] != true
        || (automatic
            && (!["running", "completed"].contains(&step["state"].as_str().unwrap_or(""))
                || !["starting", "running"].contains(&run.state.as_str())))
    {
        return Err(err("RESOURCE_BUSY", "步骤尚未就绪或已停止"));
    }
    if automatic {
        if step["autoUrlAttempted"] == true {
            return Ok(None);
        }
        // Claim before the OS call: subscriptions, retries and later state changes cannot reopen it.
        step["autoUrlAttempted"] = json!(true);
    }
    Ok(Some(url))
}
fn open_ready_url(run_id: &str, project: &str, step_id: &str, automatic: bool) -> Result<bool> {
    open_ready_url_with(run_id, project, step_id, automatic, &mut open_system_url)
}
fn open_ready_url_with(
    run_id: &str,
    project: &str,
    step_id: &str,
    automatic: bool,
    opener: &mut impl FnMut(&str) -> Result<()>,
) -> Result<bool> {
    let Some(url) = claim_ready_url(run_id, project, step_id, automatic)? else {
        return Ok(false);
    };
    opener(&url)?;
    Ok(true)
}
fn open_system_url(url: &str) -> Result<()> {
    #[cfg(windows)] { return tauri_plugin_opener::open_url(url, None::<&str>).map_err(io); }
    #[cfg(not(windows))]
    {
    let status = Command::new("/usr/bin/open")
        .arg(url)
        .status()
        .map_err(io)?;
    if !status.success() {
        return Err(err("IO_ERROR", "系统未能打开此 URL；可手动重试"));
    }
    Ok(())
    }
}
fn port_belongs_to_run(port: u16, run_id: Option<&str>) -> bool {
    let Some(run_id) = run_id else {
        return false;
    };
    let processes: Vec<_> = {
        let r = registry().lock().unwrap();
        r.processes
            .values()
            .filter_map(|p| {
                let p = p.lock().unwrap();
                (p.run.as_deref() == Some(run_id) && p.state != "exited").then_some(p.pid)
            })
            .collect()
    };
    port_belongs_to_processes(port, processes)
}
#[cfg(unix)]
fn port_belongs_to_processes(port: u16, processes: Vec<u32>) -> bool {
    let groups: HashSet<_> = processes.into_iter().flat_map(owned_groups).collect();
    let Ok(output) = Command::new("/usr/sbin/lsof")
        .args(["-nP", &format!("-iTCP:{port}"), "-sTCP:LISTEN", "-Fp"])
        .output()
    else {
        return false;
    };
    let owners: Vec<i32> = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.strip_prefix('p')?.parse().ok())
        .collect();
    !owners.is_empty()
        && owners
            .iter()
            .all(|pid| groups.contains(&unsafe { libc::getpgid(*pid) }))
}

#[cfg(windows)]
fn port_belongs_to_processes(port: u16, processes: Vec<u32>) -> bool {
    let jobs: Vec<_> = {
        let r = registry().lock().unwrap();
        r.processes.values().filter_map(|p| { let p = p.lock().unwrap(); processes.contains(&p.pid).then(|| p.job.clone()).flatten() }).collect()
    };
    let Ok(owners) = crate::windows_process::tcp_listener_pids(port) else { return false; };
    !owners.is_empty() && owners.iter().all(|pid| jobs.iter().any(|job| job.contains_pid(*pid).unwrap_or(false)))
}
fn run_start_allowed(run_id: &str) -> bool {
    registry()
        .lock()
        .unwrap()
        .runs
        .get(run_id)
        .is_some_and(|r| r.state == "starting")
}
fn wait_ready(
    step: &Resolved,
    process: &Arc<Mutex<Process>>,
    state: &HostState,
    request: &str,
    run_id: &str,
) -> Result<bool> {
    if !run_start_allowed(run_id) {
        return Err(err("CANCELLED", "运行组已停止或依赖进程退出"));
    }
    let timeout_ms = match &step.step.ready {
        Ready::Tcp { timeout_ms, .. }
        | Ready::Http { timeout_ms, .. }
        | Ready::Stdout { timeout_ms, .. } => *timeout_ms,
        Ready::Exit { .. } => 600_000,
        Ready::ProcessStarted => return Ok(false),
    };
    let regex = if let Ready::Stdout { pattern, .. } = &step.step.ready {
        Some(regex::Regex::new(pattern).map_err(io)?)
    } else {
        None
    };
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(700))
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(io)?;
    let start = Instant::now();
    loop {
        if state.is_cancelled(request) || !run_start_allowed(run_id) {
            return Err(err("CANCELLED", "启动已取消"));
        }
        let (exited, code, text) = {
            let p = process.lock().unwrap();
            (
                p.state == "exited",
                p.exit,
                regex.as_ref().map(|_| {
                    String::from_utf8_lossy(&p.output.read(p.output.start, BUFFER)).into_owned()
                }),
            )
        };
        if let Ready::Exit { codes } = &step.step.ready {
            if exited {
                return if codes.contains(&code.unwrap_or(-1)) {
                    Ok(true)
                } else {
                    Err(err(
                        "PROCESS_EXITED",
                        format!("{} 退出码 {}", step.step.title, code.unwrap_or(-1)),
                    ))
                };
            }
        } else {
            if exited {
                return Err(err(
                    "PROCESS_EXITED",
                    format!(
                        "{} 在就绪前退出，退出码 {}",
                        step.step.title,
                        code.unwrap_or(-1)
                    ),
                ));
            }
            let ready = match &step.step.ready {
                Ready::Tcp { host, port, .. } => {
                    (host.as_str(), *port)
                        .to_socket_addrs()
                        .map(|a| {
                            a.into_iter().any(|a| {
                                TcpStream::connect_timeout(&a, Duration::from_millis(150)).is_ok()
                            })
                        })
                        .unwrap_or(false)
                        && port_belongs_to_processes(*port, vec![process.lock().unwrap().pid])
                }
                Ready::Http {
                    url, status_codes, ..
                } => {
                    client
                        .get(url)
                        .send()
                        .map(|r| status_codes.contains(&r.status().as_u16()))
                        .unwrap_or(false)
                        && port_belongs_to_processes(
                            local_url(url)?.port_or_known_default().unwrap(),
                            vec![process.lock().unwrap().pid],
                        )
                }
                Ready::Stdout { .. } => regex
                    .as_ref()
                    .unwrap()
                    .is_match(text.as_deref().unwrap_or("")),
                _ => false,
            };
            if ready {
                return Ok(true);
            }
        }
        if start.elapsed() > Duration::from_millis(timeout_ms) {
            return Err(err("TIMEOUT", format!("{} 等待就绪超时", step.step.title)));
        }
        thread::sleep(Duration::from_millis(80));
    }
}
fn checked_plan(state: &HostState, project: &str, params: &Value) -> Result<Plan> {
    let plan = registry()
        .lock()
        .unwrap()
        .plans
        .get(field(params, "planId")?)
        .cloned()
        .ok_or_else(|| err("NOT_FOUND", "启动计划不存在，请重新预检"))?;
    if plan.project != project {
        return Err(err("PERMISSION_DENIED", "计划属于其他项目"));
    }
    if plan.expires < stamp() || plan.digest != field(params, "planDigest")? {
        return Err(err("STALE_VERSION", "启动计划已过期或发生变化，请重新预检"));
    }
    if !params["approved"].as_bool().unwrap_or(false) && !plan.approved_before {
        return Err(err("PERMISSION_DENIED", "请先审阅并批准启动命令"));
    }
    let current = profiles(state, project)?
        .into_iter()
        .find(|p| p.profile_id == plan.profile.profile_id)
        .ok_or_else(|| err("NOT_FOUND", "方案已删除"))?;
    if current.revision != plan.profile.revision || sources(&plan.steps)? != plan.sources {
        return Err(err("STALE_VERSION", "方案或脚本来源已变化，请重新审阅"));
    }
    for (id, version) in &plan.extension_versions {
        if crate::extensions::manifest(state, id)?["version"].as_str() != Some(version.as_str()) {
            return Err(err(
                "STALE_VERSION",
                format!("扩展 {id} 版本已变化，请重新预检"),
            ));
        }
    }
    crate::extensions::extension_gate(state, "horizon.launch", Some(project))?;
    for ext in &plan.profile.required_extensions {
        crate::extensions::validate_requirement(state, &ext.id, &ext.version_range, Some(project))?;
    }
    if plan.steps.iter().any(|s| s.step.mode == "pty") {
        crate::extensions::extension_gate(state, "horizon.terminal", Some(project))?;
    }
    Ok(plan)
}
fn start_plan(
    state: &Arc<HostState>,
    app: &Option<AppHandle>,
    request: &str,
    plan: Plan,
) -> Result<Value> {
    start_plan_with_url_opener(state, app, request, plan, &mut open_system_url)
}
fn start_plan_with_url_opener(
    state: &Arc<HostState>,
    app: &Option<AppHandle>,
    request: &str,
    plan: Plan,
    opener: &mut impl FnMut(&str) -> Result<()>,
) -> Result<Value> {
    preflight(&plan.steps, None)?;
    let run_id = id("launch");
    {
        let mut r = registry().lock().unwrap();
        if let Some(run) = r.runs.values().find(|r| {
            r.project == plan.project
                && r.profile.profile_id == plan.profile.profile_id
                && !["failed", "stopped"].contains(&r.state.as_str())
        }) {
            return Err(err("RESOURCE_BUSY", format!("方案已经运行：{}", run.id)));
        }
        r.approvals.insert(plan.digest.clone());
        if r.approvals.len() > 1024 {
            if let Some(old) = r
                .approvals
                .iter()
                .find(|hash| *hash != &plan.digest)
                .cloned()
            {
                r.approvals.remove(&old);
            }
        }
        let mut completed: Vec<_> = r
            .runs
            .values()
            .filter(|run| ["failed", "stopped"].contains(&run.state.as_str()))
            .map(|run| run.id.clone())
            .collect();
        completed.sort_by_key(|id| {
            id.rsplit('-')
                .next()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0)
        });
        let excess = r.runs.len().saturating_sub(127);
        for old in completed.into_iter().take(excess) {
            r.runs.remove(&old);
        }
        r.runs.insert(run_id.clone(),Run {id:run_id.clone(),created_at:stamp(),project:plan.project.clone(),profile:plan.profile.clone(),state:"starting".into(),revision:1,steps:plan.steps.iter().map(|s|json!({"stepId":s.step.step_id,"title":s.step.title,"state":"queued","ready":false,"url":s.step.on_ready.as_ref().and_then(|r|r.open_url.as_ref())})).collect(),order:vec![],lease_state:None,lease_releasing:false});
    }
    let mut requirements: Vec<String> = plan
        .profile
        .required_extensions
        .iter()
        .map(|e| e.id.clone())
        .collect();
    requirements.push("horizon.launch".into());
    if plan.steps.iter().any(|s| s.step.mode == "pty") {
        requirements.push("horizon.terminal".into());
    }
    requirements.sort();
    requirements.dedup();
    let lease = match crate::extensions::acquire_launch_requirements(
        state,
        &plan.project,
        &requirements,
        &run_id,
    ) {
        Ok(lease) => lease,
        Err(e) => {
            update_run(&run_id, app, |run| run.state = "failed".into());
            return Err(e);
        }
    };
    let activation = lease["items"]
        .as_array()
        .and_then(|items| {
            items
                .iter()
                .find(|item| item["extensionId"] == "horizon.launch")
        })
        .and_then(|item| item["activationId"].as_str())
        .unwrap_or("")
        .to_string();
    registry()
        .lock()
        .unwrap()
        .runs
        .get_mut(&run_id)
        .unwrap()
        .lease_state = Some(Arc::downgrade(state));
    if let Some(app) = app {
        let _ = app.emit(
            EVENT_EXTENSION,
            json!({"projectId":plan.project,"launchRunId":run_id}),
        );
    }
    let mut failure = None;
    for step in &plan.steps {
        let lifecycle = lifecycle_lock().lock().unwrap();
        if state.is_cancelled(request) || !run_start_allowed(&run_id) {
            failure = Some(err("CANCELLED", "启动已取消"));
            break;
        }
        let mut execution = step.clone();
        for (key, reference) in &step.step.secret_refs {
            match state.credential_secret(reference) {
                Ok(secret) => {
                    execution.step.env.insert(key.clone(), secret);
                }
                Err(e) => {
                    failure = Some(e);
                    break;
                }
            }
        }
        if failure.is_some() {
            break;
        }
        let spawned = spawn_process(
            &execution,
            &plan.project,
            "horizon.launch",
            Some(&run_id),
            app.clone(),
            Some(ProcessIdentity {
                activation_id: activation.clone(),
                lease: None,
            }),
        );
        let process_id = match spawned {
            Ok(p) => p,
            Err(e) => {
                failure = Some(e);
                break;
            }
        };
        let p = process_for(&process_id, None)?;
        let process_pid = p.lock().unwrap().pid;
        update_run(&run_id, app, |run| {
            run.order.push(process_id.clone());
            if let Some(s) = run
                .steps
                .iter_mut()
                .find(|s| s["stepId"] == step.step.step_id)
            {
                s["state"] = json!("starting");
                s["processInstanceId"] = json!(process_id);
                s["pid"] = json!(process_pid);
                if step.step.mode == "pty" {
                    s["terminalSessionId"] = json!(process_id);
                    s["openTerminal"] = json!(step
                        .step
                        .on_ready
                        .as_ref()
                        .is_some_and(|ready| ready.open_terminal));
                }
            }
        });
        drop(lifecycle);
        match wait_ready(step, &p, state, request, &run_id) {
            Ok(verified) => {
                update_run(&run_id, app, |run| {
                    if let Some(s) = run
                        .steps
                        .iter_mut()
                        .find(|s| s["stepId"] == step.step.step_id)
                    {
                        s["state"] = json!(if step.step.lifecycle == "oneshot" {
                            "completed"
                        } else {
                            "running"
                        });
                        s["ready"] = json!(true);
                        s["verified"] = json!(verified);
                        s["pid"] = json!(p.lock().unwrap().pid);
                    }
                });
                if let Err(error) =
                    open_ready_url_with(&run_id, &plan.project, &step.step.step_id, true, opener)
                {
                    update_run(&run_id, app, |run| {
                        if let Some(s) = run
                            .steps
                            .iter_mut()
                            .find(|s| s["stepId"] == step.step.step_id)
                        {
                            s["urlError"] = json!(error.message);
                        }
                    });
                }
            }
            Err(e) => {
                update_run(&run_id, app, |run| {
                    if let Some(s) = run
                        .steps
                        .iter_mut()
                        .find(|s| s["stepId"] == step.step.step_id)
                    {
                        s["state"] = json!("failed");
                        s["error"] = json!("进程未就绪；请查看日志");
                    }
                });
                failure = Some(e);
                break;
            }
        }
    }
    if let Some(e) = failure {
        if plan.profile.failure_policy == "stopStarted"
            || state.is_cancelled(request)
            || e.code == "CANCELLED"
        {
            let _ = stop_run(&run_id, app, &plan.project);
        }
        let running = {
            let r = registry().lock().unwrap();
            r.processes.values().any(|p| {
                let p = p.lock().unwrap();
                p.run.as_deref() == Some(&run_id) && p.state != "exited"
            })
        };
        update_run(&run_id, app, |run| {
            run.state = if running { "partial" } else { "failed" }.into();
        });
        if !running {
            release_run_requirements(&run_id, app)?;
        }
        return Err(e);
    }
    update_run(&run_id, app, |run| {
        run.state = if plan.steps.iter().all(|s| s.step.lifecycle == "oneshot") {
            "stopped"
        } else {
            "running"
        }
        .into()
    });
    if plan.steps.iter().all(|s| s.step.lifecycle == "oneshot") {
        release_run_requirements(&run_id, app)?;
    }
    Ok(registry().lock().unwrap().runs[&run_id].value())
}
fn release_lease(state: Arc<HostState>, project: String, run_id: String) -> Result<()> {
    thread::spawn(move || {
        tauri::async_runtime::block_on(crate::extensions::release_launch_requirements(
            &state, &project, &run_id,
        ))
    })
    .join()
    .map_err(|_| err("IO_ERROR", "扩展资源释放线程异常"))?
}
fn release_process_lease(process: &Arc<Mutex<Process>>, app: Option<&AppHandle>) -> Result<()> {
    let started = Instant::now();
    let lease = loop {
        let mut p = process.lock().unwrap();
        if p.lease_releasing {
            drop(p);
            if started.elapsed() > Duration::from_secs(10) {
                return Err(err("TIMEOUT", "终端扩展资源仍在释放"));
            }
            thread::sleep(Duration::from_millis(20));
            continue;
        }
        let Some(lease) = p.direct_lease.take() else {
            return Ok(());
        };
        p.lease_releasing = true;
        break lease;
    };
    let result = if let Some(state) = lease.state.upgrade() {
        release_lease(state, lease.project.clone(), lease.id.clone())
    } else {
        Ok(())
    };
    {
        let mut p = process.lock().unwrap();
        p.lease_releasing = false;
        if result.is_err() {
            p.direct_lease = Some(lease);
            p.state = "stopping".into();
        } else if p.exit.is_some() {
            p.state = "exited".into();
        }
        p.revision += 1;
    }
    if let Some(app) = app {
        let _ = app.emit(EVENT_EXTENSION, json!({"extensionId":"horizon.terminal"}));
    }
    result
}
fn release_run_requirements(run_id: &str, app: &Option<AppHandle>) -> Result<()> {
    let started = Instant::now();
    let lease = loop {
        let mut r = registry().lock().unwrap();
        let Some(run) = r.runs.get_mut(run_id) else {
            return Ok(());
        };
        if run.lease_releasing {
            drop(r);
            if started.elapsed() > Duration::from_secs(10) {
                return Err(err("TIMEOUT", "扩展资源仍在释放"));
            }
            thread::sleep(Duration::from_millis(25));
            continue;
        }
        let Some(state) = run.lease_state.take() else {
            return Ok(());
        };
        run.lease_releasing = true;
        break (state, run.project.clone());
    };
    let result = if let Some(state) = lease.0.upgrade() {
        release_lease(state, lease.1, run_id.into())
    } else {
        Ok(())
    };
    {
        let mut r = registry().lock().unwrap();
        if let Some(run) = r.runs.get_mut(run_id) {
            run.lease_releasing = false;
            if result.is_err() {
                run.lease_state = Some(lease.0);
                run.state = "partial".into();
                run.revision += 1;
            }
        }
    }
    if let Some(app) = app {
        let _ = app.emit(EVENT_EXTENSION, json!({"launchRunId":run_id}));
    }
    result
}
fn stop_run(run_id: &str, app: &Option<AppHandle>, project: &str) -> Result<Value> {
    let lifecycle = lifecycle_lock().lock().unwrap();
    let run = {
        let r = registry().lock().unwrap();
        r.runs
            .get(run_id)
            .cloned()
            .ok_or_else(|| err("NOT_FOUND", "运行实例不存在"))?
    };
    if run.project != project {
        return Err(err("PERMISSION_DENIED", "运行实例属于其他项目"));
    }
    update_run(run_id, app, |r| r.state = "stopping".into());
    drop(lifecycle);
    let mut stopped = vec![];
    let mut failed = vec![];
    for id in run.order.iter().rev() {
        if let Ok(p) = process_for(id, None) {
            match stop_process(&p, false, app.as_ref()) {
                Ok(_) => {
                    stopped.push(id.clone());
                    update_run(run_id, app, |run| {
                        if let Some(step) =
                            run.steps.iter_mut().find(|s| s["processInstanceId"] == *id)
                        {
                            step.as_object_mut().unwrap().remove("stopError");
                        }
                    });
                }
                Err(error) => {
                    failed.push(id.clone());
                    update_run(run_id, app, |run| {
                        if let Some(step) =
                            run.steps.iter_mut().find(|s| s["processInstanceId"] == *id)
                        {
                            step["state"] = json!("stopping");
                            step["ready"] = json!(false);
                            step["stopError"] = json!(error.message);
                        }
                    });
                }
            }
        }
    }
    update_run(run_id, app, |r| {
        r.state = if failed.is_empty() {
            "stopped"
        } else {
            "partial"
        }
        .into()
    });
    if failed.is_empty() {
        release_run_requirements(run_id, app)?;
    }
    Ok(json!({"stopped":stopped,"failed":failed,"externalUntouched":[]}))
}

pub async fn dispatch(
    state: Arc<HostState>,
    app: AppHandle,
    call: Call,
    channel: Option<Channel<Value>>,
) -> Result<Value> {
    tauri::async_runtime::spawn_blocking(move || handle(&state, &app, call, channel))
        .await
        .map_err(io)?
}
fn handle(
    state: &Arc<HostState>,
    app: &AppHandle,
    call: Call,
    channel: Option<Channel<Value>>,
) -> Result<Value> {
    let p = &call.params;
    let fields: &[&str] = match call.method.as_str() {
        "process_list" => &["projectId"],
        "process_stop" => &["processInstanceId", "mode"],
        "terminal_create" => &["shellRef", "cwd"],
        "terminal_attach_view" => &["terminalSessionId", "afterOffset"],
        "terminal_output_ack" => &["viewSubscriptionId", "throughOffset"],
        "terminal_detach_view" => &["viewSubscriptionId"],
        "terminal_input" => &["terminalSessionId", "data"],
        "terminal_resize" => &["terminalSessionId", "cols", "rows"],
        "terminal_stop" => &["terminalSessionId"],
        "process_output_read" => &["processInstanceId", "offset"],
        "launch_detect" | "launch_profile_list" | "launch_list" => &[],
        "launch_profile_save" => &["profile", "expectedRevision"],
        "launch_profile_pick" => &["purpose"],
        "launch_profile_import" => &["selectionToken"],
        "launch_profile_export" => &["profileId", "profileRevision", "selectionToken"],
        "launch_profile_delete" => &["profileId", "expectedRevision"],
        "launch_prepare" => &["profileId", "profileRevision"],
        "launch_start" => &["planId", "planDigest", "approved"],
        "launch_get" | "launch_stop" => &["launchRunId"],
        "launch_restart" => &["launchRunId", "replacementPlanId", "planDigest", "approved"],
        "launch_open_url" => &["launchRunId", "stepId"],
        _ => return Err(err("NOT_FOUND", format!("未知进程方法 {}", call.method))),
    };
    crate::protocol::allowed(p, fields)?;
    if call.method == "process_list" {
        let project = call
            .scope
            .get("projectId")
            .and_then(Value::as_str)
            .or_else(|| p.get("projectId").and_then(Value::as_str));
        return Ok(process_snapshot(project, false));
    }
    if call.method == "process_stop" {
        if !["graceful", "force"].contains(&field(p, "mode")?) {
            return Err(err("INVALID_ARGUMENT", "停止模式无效"));
        }
        let project = call.scope.get("projectId").and_then(Value::as_str);
        let process = process_for(field(p, "processInstanceId")?, project)?;
        return stop_process(&process, p["mode"] == "force", Some(app));
    }
    let project = project(&call)?;
    let root = state.project_root(&project)?;
    match call.method.as_str() {
        "terminal_create" => {
            let _lifecycle = lifecycle_lock().lock().unwrap();
            crate::extensions::extension_gate(state, "horizon.terminal", Some(&project))?;
            let (shell, shell_args) = terminal_shell(p.get("shellRef").and_then(Value::as_str))?;
            let directory = cwd(&root, p.get("cwd").and_then(Value::as_str).unwrap_or("."))?;
            let step = LaunchStep {
                step_id: "shell".into(),
                title: Path::new(&shell)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into(),
                depends_on: vec![],
                command: LaunchCommand::Exec {
                    executable: shell.clone(),
                    args: shell_args.clone(),
                },
                cwd: ".".into(),
                env: BTreeMap::new(),
                secret_refs: BTreeMap::new(),
                mode: "pty".into(),
                lifecycle: "service".into(),
                ready: Ready::ProcessStarted,
                on_ready: None,
            };
            let lease_id = id("terminal-lease");
            let acquired = crate::extensions::acquire_launch_requirements(
                state,
                &project,
                &["horizon.terminal".into()],
                &lease_id,
            )?;
            let activation = acquired["items"]
                .as_array()
                .and_then(|items| {
                    items
                        .iter()
                        .find(|item| item["extensionId"] == "horizon.terminal")
                })
                .and_then(|item| item["activationId"].as_str())
                .ok_or_else(|| err("EXTENSION_FAILED", "终端激活失败"))?
                .to_string();
            let process_id = match spawn_process(
                &Resolved {
                    step,
                    executable: PathBuf::from(shell),
                    args: shell_args,
                    cwd: directory,
                },
                &project,
                "horizon.terminal",
                None,
                Some(app.clone()),
                Some(ProcessIdentity {
                    activation_id: activation,
                    lease: Some(DirectLease {
                        state: Arc::downgrade(state),
                        project: project.clone(),
                        id: lease_id.clone(),
                    }),
                }),
            ) {
                Ok(id) => id,
                Err(e) => {
                    let _ = release_lease(state.clone(), project.clone(), lease_id);
                    return Err(e);
                }
            };
            let _ = app.emit(
                EVENT_EXTENSION,
                json!({"extensionId":"horizon.terminal","projectId":project}),
            );
            Ok(json!({"terminalSessionId":process_id,"processInstanceId":process_id}))
        }
        "terminal_attach_view" => {
            if registry().lock().unwrap().views.len() >= 128 {
                return Err(err("RESOURCE_LIMIT", "终端视图已达到上限，请关闭其他视图"));
            }
            let process = process_for(field(p, "terminalSessionId")?, Some(&project))?;
            let process = process.lock().unwrap();
            let offset = p["afterOffset"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(process.output.start);
            if offset > process.output.end {
                return Err(err("INVALID_ARGUMENT", "输出偏移超出范围"));
            }
            let view_id = id("view");
            let response = json!({"viewSubscriptionId":view_id,"bufferStart":process.output.start.to_string()});
            let view = View {
                process: process.id.clone(),
                project,
                request: call.request_id,
                sent: offset,
                ack: offset,
                seq: 0,
                channel,
                app: app.clone(),
            };
            drop(process);
            registry().lock().unwrap().views.insert(view_id, view);
            flush_views();
            Ok(response)
        }
        "terminal_output_ack" => {
            let view_id = field(p, "viewSubscriptionId")?;
            let through = field(p, "throughOffset")?.parse::<u64>().map_err(io)?;
            {
                let mut r = registry().lock().unwrap();
                let v = r
                    .views
                    .get_mut(view_id)
                    .ok_or_else(|| err("NOT_FOUND", "视图已经关闭"))?;
                if v.project != project {
                    return Err(err("PERMISSION_DENIED", "视图属于其他项目"));
                }
                if through > v.sent {
                    return Err(err("INVALID_ARGUMENT", "确认不能超过已发送输出"));
                }
                v.ack = v.ack.max(through);
            }
            flush_views();
            Ok(json!({"acceptedThroughOffset":through.to_string()}))
        }
        "terminal_detach_view" => {
            let view_id = field(p, "viewSubscriptionId")?;
            let mut r = registry().lock().unwrap();
            if r.views.get(view_id).is_some_and(|v| v.project != project) {
                return Err(err("PERMISSION_DENIED", "视图属于其他项目"));
            }
            r.views.remove(view_id);
            Ok(json!({"detached":true,"processContinues":true}))
        }
        "terminal_input" => {
            let data = field(p, "data")?;
            if data.len() > CHUNK {
                return Err(err("RESOURCE_LIMIT", "输入单批最多 64 KiB"));
            }
            let process = process_for(field(p, "terminalSessionId")?, Some(&project))?;
            let writer = process
                .lock()
                .unwrap()
                .writer
                .as_ref()
                .cloned()
                .ok_or_else(|| err("PROCESS_EXITED", "终端已结束"))?;
            let mut writer = writer.lock().unwrap();
            writer.write_all(data.as_bytes()).map_err(io)?;
            writer.flush().map_err(io)?;
            Ok(json!({"acceptedBytes":data.len()}))
        }
        "terminal_resize" => {
            let cols = p["cols"].as_u64().unwrap_or(0);
            let rows = p["rows"].as_u64().unwrap_or(0);
            if !(1..=1000).contains(&cols) || !(1..=1000).contains(&rows) {
                return Err(err("INVALID_ARGUMENT", "终端行列须在 1–1000 之间"));
            }
            let process = process_for(field(p, "terminalSessionId")?, Some(&project))?;
            let p = process.lock().unwrap();
            p.master
                .as_ref()
                .ok_or_else(|| err("INVALID_ARGUMENT", "此进程没有 PTY"))?
                .resize(PtySize {
                    cols: cols as u16,
                    rows: rows as u16,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(io)?;
            Ok(json!({"applied":true}))
        }
        "terminal_stop" => stop_process(
            &process_for(field(p, "terminalSessionId")?, Some(&project))?,
            false,
            Some(app),
        ),
        "process_output_read" => {
            let process = process_for(field(p, "processInstanceId")?, Some(&project))?;
            let p = process.lock().unwrap();
            let offset = call.params["offset"]
                .as_str()
                .and_then(|v| v.parse().ok())
                .unwrap_or(p.output.start);
            let bytes = p.output.read(offset, CHUNK);
            Ok(
                json!({"data":STANDARD.encode(&bytes),"encoding":"base64","byteOffset":offset.max(p.output.start).to_string(),"nextOffset":(offset.max(p.output.start)+bytes.len() as u64).to_string(),"bufferStart":p.output.start.to_string(),"bufferEnd":p.output.end.to_string(),"gap":offset<p.output.start}),
            )
        }
        "launch_detect" => detect_scripts(&root),
        "launch_profile_list" => Ok(json!({"items":profiles(state,&project)?})),
        "launch_profile_pick" => {
            let purpose = field(p, "purpose")?;
            let request = match purpose {
                "import" => crate::picker::Request::file(),
                "export" => crate::picker::Request::save("launch-profile.horizon.json"),
                _ => return Err(err("INVALID_ARGUMENT", "选择用途无效")),
            }.filter("Horizon 启动方案", &["json"]);
            let picked = crate::picker::pick_blocking(app, &call, request)?;
            match picked {
                Some(path) => Ok(
                    json!({"selectionToken":state.register_selection(path)}),
                ),
                None => Ok(json!({"selectionToken":null})),
            }
        }
        "launch_profile_import" => {
            let path = state.resolve_selection(field(p, "selectionToken")?)?;
            if fs::metadata(&path).map_err(io)?.len() > 1024 * 1024 {
                return Err(err("RESOURCE_LIMIT", "启动方案文件超过 1 MiB"));
            }
            let data: Value = serde_json::from_slice(&fs::read(path).map_err(io)?).map_err(io)?;
            if data["format"] != "horizon-launch@1" {
                return Err(err("CONFIG_VERSION_UNSUPPORTED", "不支持的启动方案格式"));
            }
            let mut profile: LaunchProfile = serde_json::from_value(data["profile"].clone())
                .map_err(|e| err("INVALID_ARGUMENT", e.to_string()))?;
            profile.profile_id = id("profile");
            profile.project_id = project.clone();
            profile.revision = 0;
            profile.name = format!("{}（导入）", profile.name);
            topology(&profile)?;
            Ok(
                json!({"profile":profile,"warnings":["导入内容仅为未授权草稿。请核对程序、目录、环境变量和凭据引用，再保存并预检。"]}),
            )
        }
        "launch_profile_export" => {
            let path = state.resolve_selection(field(p, "selectionToken")?)?;
            let profile = profiles(state, &project)?
                .into_iter()
                .find(|profile| Some(profile.profile_id.as_str()) == p["profileId"].as_str())
                .ok_or_else(|| err("NOT_FOUND", "方案不存在"))?;
            if p["profileRevision"].as_u64() != Some(profile.revision) {
                return Err(err("STALE_VERSION", "方案已经修改，请刷新后导出"));
            }
            let data = export_profile(profile);
            crate::state::atomic_json(&path, &data)?;
            Ok(json!({"exported":true,"redacted":true}))
        }
        "launch_profile_save" => {
            let _config_lock = state.file_lock.lock().unwrap();
            let mut profile: LaunchProfile = serde_json::from_value(p["profile"].clone())
                .map_err(|e| err("INVALID_ARGUMENT", e.to_string()))?;
            if profile.project_id != project {
                return Err(err("PERMISSION_DENIED", "方案属于其他项目"));
            }
            validate(&profile, &root)?;
            let mut all = profiles(state, &project)?;
            let existing = all.iter().position(|s| s.profile_id == profile.profile_id);
            if let Some(index) = existing {
                if p["expectedRevision"].as_u64() != Some(all[index].revision) {
                    return Err(err("STALE_VERSION", "方案已经修改，请刷新"));
                }
                profile.revision = all[index].revision + 1;
                all[index] = profile.clone();
            } else {
                if !p["expectedRevision"].is_null() {
                    return Err(err("STALE_VERSION", "新方案不应有旧版本"));
                }
                if profile.profile_id.is_empty() {
                    profile.profile_id = id("profile");
                }
                profile.revision = 1;
                all.push(profile.clone());
            }
            write_profiles(state, &project, &all)?;
            Ok(json!(profile))
        }
        "launch_profile_delete" => delete_profile(
            state,
            &project,
            field(p, "profileId")?,
            p["expectedRevision"].as_u64().unwrap_or(0),
        ),
        "launch_prepare" => {
            let profile = profiles(state, &project)?
                .into_iter()
                .find(|s| Some(s.profile_id.as_str()) == p["profileId"].as_str())
                .ok_or_else(|| err("NOT_FOUND", "方案不存在"))?;
            if p["profileRevision"].as_u64() != Some(profile.revision) {
                return Err(err("STALE_VERSION", "方案已变化"));
            }
            let order = validate(&profile, &root)?;
            let mut steps = vec![];
            for index in order {
                let step = profile.steps[index].clone();
                for reference in step.secret_refs.values() {
                    state.credential_secret(reference)?;
                }
                let (program, args) = match &step.command {
                    LaunchCommand::Exec { executable, args } => (executable.clone(), args.clone()),
                    LaunchCommand::Shell { shell, script } => {
                        (shell.clone(), shell_arguments(shell, script))
                    }
                };
                steps.push(Resolved {
                    cwd: cwd(&root, &step.cwd)?,
                    executable: executable(&program)?,
                    args,
                    step,
                });
            }
            for ext in &profile.required_extensions {
                crate::extensions::validate_requirement(
                    state,
                    &ext.id,
                    &ext.version_range,
                    Some(&project),
                )?;
            }
            if steps.iter().any(|s| s.step.mode == "pty") {
                crate::extensions::extension_gate(state, "horizon.terminal", Some(&project))?;
            }
            preflight(&steps, active_run(&project, &profile.profile_id).as_deref())?;
            let sources = sources(&steps)?;
            let mut requirements: Vec<String> = profile
                .required_extensions
                .iter()
                .map(|ext| ext.id.clone())
                .collect();
            requirements.push("horizon.launch".into());
            if steps.iter().any(|step| step.step.mode == "pty") {
                requirements.push("horizon.terminal".into());
            }
            requirements.sort();
            requirements.dedup();
            let mut extension_versions = BTreeMap::new();
            let mut extension_actions = vec![];
            for id in requirements {
                let manifest = crate::extensions::manifest(state, &id)?;
                extension_versions.insert(
                    id.clone(),
                    manifest["version"].as_str().unwrap_or("").to_string(),
                );
                if crate::extensions::activation_id(state, &id, Some(&project)).is_err() {
                    extension_actions.push(json!({"id":id,"action":"activate"}));
                }
            }
            let snapshot = json!({"profile":profile,"sources":sources,"extensionVersions":extension_versions,"resolved":steps.iter().map(|s|json!([s.executable,s.args,s.cwd])).collect::<Vec<_>>()});
            let hash = digest(&serde_json::to_vec(&snapshot).map_err(io)?);
            let mut r = registry().lock().unwrap();
            let plan = Plan {
                id: id("plan"),
                project,
                profile,
                digest: hash.clone(),
                sources,
                steps,
                expires: stamp() + 300_000,
                approved_before: r.approvals.contains(&hash),
                extension_versions,
                extension_actions,
            };
            let value = plan_value(&plan);
            r.plans.retain(|_, p| p.expires >= stamp());
            if r.plans.len() >= 64 {
                if let Some(old) = r
                    .plans
                    .values()
                    .min_by_key(|p| p.expires)
                    .map(|p| p.id.clone())
                {
                    r.plans.remove(&old);
                }
            }
            r.plans.insert(plan.id.clone(), plan);
            Ok(value)
        }
        "launch_start" => {
            let plan = checked_plan(state, &project, p)?;
            start_plan(state, &Some(app.clone()), &call.request_id, plan)
        }
        "launch_get" => {
            let r = registry().lock().unwrap();
            let run = r
                .runs
                .get(field(p, "launchRunId")?)
                .ok_or_else(|| err("NOT_FOUND", "运行实例不存在"))?;
            if run.project != project {
                return Err(err("PERMISSION_DENIED", "运行实例属于其他项目"));
            }
            Ok(run.value())
        }
        "launch_list" => {
            let r = registry().lock().unwrap();
            Ok(
                json!({"items":r.runs.values().filter(|r|r.project==project).map(Run::value).collect::<Vec<_>>()}),
            )
        }
        "launch_stop" => stop_run(field(p, "launchRunId")?, &Some(app.clone()), &project),
        "launch_restart" => {
            let mut params = p.clone();
            params["planId"] = json!(field(p, "replacementPlanId")?);
            let plan = checked_plan(state, &project, &params)?;
            {
                let r = registry().lock().unwrap();
                let previous = r
                    .runs
                    .get(field(p, "launchRunId")?)
                    .ok_or_else(|| err("NOT_FOUND", "运行实例不存在"))?;
                if previous.profile.profile_id != plan.profile.profile_id {
                    return Err(err("INVALID_ARGUMENT", "重启计划必须属于原方案"));
                }
            }
            let stopped = stop_run(field(p, "launchRunId")?, &Some(app.clone()), &project)?;
            if !stopped["failed"].as_array().unwrap().is_empty() {
                return Err(err("RESOURCE_BUSY", "原实例停止未确认"));
            }
            start_plan(state, &Some(app.clone()), &call.request_id, plan)
        }
        "launch_open_url" => {
            let opened = open_ready_url(
                field(p, "launchRunId")?,
                &project,
                field(p, "stepId")?,
                false,
            )?;
            Ok(json!({"opened":opened}))
        }
        _ => Err(err("NOT_FOUND", format!("未知进程方法 {}", call.method))),
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    #[test]
    fn tauri_app_handle_delivers_process_transport_events() {
        use tauri::Listener;
        let app = tauri::test::mock_app();
        let handle = app.handle();
        for topic in [EVENT_TERMINAL, EVENT_PROCESS, EVENT_LAUNCH, EVENT_EXTENSION] {
            let (tx, rx) = std::sync::mpsc::channel();
            let listener = handle.listen(topic, move |event| {
                let _ = tx.send(event.payload().to_string());
            });
            let payload = json!({"terminalSessionId":"fixture-session","data":STANDARD.encode("中文事件".as_bytes()),"state":"running"});
            handle.emit(topic, payload.clone()).unwrap();
            let received: Value =
                serde_json::from_str(&rx.recv_timeout(Duration::from_secs(1)).unwrap()).unwrap();
            assert_eq!(received, payload);
            handle.unlisten(listener);
        }
        assert!(handle.emit("horizon.terminal.v1", json!({})).is_err());
    }
    fn profile() -> LaunchProfile {
        serde_json::from_value(json!({"schemaVersion":1,"profileId":"p","projectId":"test","revision":0,"name":"test","requiredExtensions":[],"failurePolicy":"stopStarted","steps":[{"stepId":"a","title":"A","dependsOn":[],"command":{"kind":"exec","executable":"/bin/sh","args":[]},"cwd":".","env":{},"secretRefs":{},"mode":"pipe","lifecycle":"service","ready":{"kind":"processStarted"}},{"stepId":"b","title":"B","dependsOn":["a"],"command":{"kind":"exec","executable":"/bin/sh","args":[]},"cwd":".","env":{},"secretRefs":{},"mode":"pipe","lifecycle":"service","ready":{"kind":"processStarted"}}]})).unwrap()
    }
    #[test]
    fn rejects_cycles_and_unknown_dependencies() {
        let mut p = profile();
        assert_eq!(topology(&p).unwrap(), vec![0, 1]);
        p.steps[0].depends_on = vec!["b".into()];
        assert!(topology(&p).is_err());
        p.steps[0].depends_on = vec!["missing".into()];
        assert!(topology(&p).is_err());
    }
    #[test]
    fn bounded_bytes_keep_utf8_raw() {
        let mut b = Output::new();
        b.push(&vec![b'a'; BUFFER]);
        b.push("中文".as_bytes());
        assert_eq!(b.bytes.len(), BUFFER);
        assert_eq!(b.start, 6);
        assert_eq!(b.read(b.end - 6, 6), "中文".as_bytes());
    }
    #[test]
    fn cwd_rejects_escape() {
        let root = std::env::temp_dir().join(id("horizon-cwd"));
        fs::create_dir(&root).unwrap();
        assert!(cwd(&root, "..").is_err());
        assert!(cwd(&root, ".").is_ok());
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn owned_pty_handles_chinese_resize_and_stop() {
        let root = std::env::temp_dir().join(id("horizon-pty"));
        fs::create_dir(&root).unwrap();
        let mut step = profile().steps.remove(0);
        step.mode = "pty".into();
        let process_id = spawn_process(
            &Resolved {
                step,
                executable: PathBuf::from("/bin/sh"),
                args: vec!["-c".into(), "printf '中文输出\\n'; sleep 30".into()],
                cwd: root.clone(),
            },
            "test",
            "horizon.terminal",
            None,
            None,
            None,
        )
        .unwrap();
        let process = process_for(&process_id, Some("test")).unwrap();
        let until = Instant::now();
        loop {
            let p = process.lock().unwrap();
            if String::from_utf8_lossy(&p.output.read(0, 100)).contains("中文输出") {
                break;
            }
            drop(p);
            assert!(until.elapsed() < Duration::from_secs(3));
            thread::sleep(Duration::from_millis(20));
        }
        process
            .lock()
            .unwrap()
            .master
            .as_ref()
            .unwrap()
            .resize(PtySize {
                rows: 40,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        assert_eq!(stop_process(&process, false, None).unwrap()["exited"], true);
        fs::remove_dir(root).unwrap();
    }
    #[test]
    fn terminal_input_backpressure_does_not_block_stop() {
        let dir = tempfile::tempdir().unwrap();
        let mut step = profile().steps.remove(0);
        step.mode = "pty".into();
        let process_id = spawn_process(
            &Resolved {
                step,
                executable: PathBuf::from("/bin/sh"),
                args: vec!["-c".into(), "stty -echo -icanon; sleep 30".into()],
                cwd: dir.path().to_owned(),
            },
            &id("input-pressure"),
            "horizon.terminal",
            None,
            None,
            None,
        )
        .unwrap();
        let process = process_for(&process_id, None).unwrap();
        let writer = process.lock().unwrap().writer.as_ref().unwrap().clone();
        let (tx, rx) = std::sync::mpsc::channel();
        thread::spawn(move || {
            let result = writer.lock().unwrap().write_all(&vec![b'x'; 1024 * 1024]);
            let _ = tx.send(result);
        });
        thread::sleep(Duration::from_millis(60));
        let start = Instant::now();
        assert_eq!(stop_process(&process, false, None).unwrap()["exited"], true);
        assert!(start.elapsed() < Duration::from_secs(3));
        assert!(rx.recv_timeout(Duration::from_secs(2)).is_ok());
    }
    #[test]
    fn interactive_pty_accepts_chinese_input_and_applies_actual_size() {
        let dir = tempfile::tempdir().unwrap();
        let mut step = profile().steps.remove(0);
        step.mode = "pty".into();
        let process_id = spawn_process(
            &Resolved {
                step,
                executable: PathBuf::from("/bin/sh"),
                args: vec!["-i".into()],
                cwd: dir.path().to_owned(),
            },
            &id("chinese-input"),
            "horizon.terminal",
            None,
            None,
            None,
        )
        .unwrap();
        let process = process_for(&process_id, None).unwrap();
        let writer = {
            let p = process.lock().unwrap();
            p.master
                .as_ref()
                .unwrap()
                .resize(PtySize {
                    rows: 37,
                    cols: 99,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .unwrap();
            p.writer.as_ref().unwrap().clone()
        };
        writer
            .lock()
            .unwrap()
            .write_all("stty size; read word; printf '回声:%s\\n' \"$word\"\n中文输入\n".as_bytes())
            .unwrap();
        let start = Instant::now();
        loop {
            let text = {
                let p = process.lock().unwrap();
                String::from_utf8_lossy(&p.output.read(0, 65536)).into_owned()
            };
            if text.contains("37 99") && text.contains("回声:中文输入") {
                break;
            }
            assert!(start.elapsed() < Duration::from_secs(3), "{text}");
            thread::sleep(Duration::from_millis(20));
        }
        assert_eq!(stop_process(&process, false, None).unwrap()["exited"], true);
    }
    #[test]
    fn hidden_output_is_continuously_consumed_with_bounded_history() {
        let dir = tempfile::tempdir().unwrap();
        let step = profile().steps.remove(0);
        let process_id = spawn_process(
            &Resolved {
                step,
                executable: PathBuf::from("/bin/sh"),
                args: vec![
                    "-c".into(),
                    "/usr/bin/yes bounded-output | /usr/bin/head -c 8388608".into(),
                ],
                cwd: dir.path().to_owned(),
            },
            &id("output-pressure"),
            "horizon.launch",
            None,
            None,
            None,
        )
        .unwrap();
        let process = process_for(&process_id, None).unwrap();
        let start = Instant::now();
        loop {
            let p = process.lock().unwrap();
            if p.state == "exited" && p.output.end == 8388608 {
                assert_eq!(p.output.bytes.len(), BUFFER);
                assert_eq!(p.output.start, 8388608 - BUFFER as u64);
                break;
            }
            drop(p);
            assert!(start.elapsed() < Duration::from_secs(5));
            thread::sleep(Duration::from_millis(20));
        }
    }

    fn fixture(scripts: &[(&str, Ready, &str)]) -> (tempfile::TempDir, Arc<HostState>, Plan) {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("项目 中文");
        fs::create_dir(&root).unwrap();
        let state = Arc::new(HostState::new(dir.path().join("state")).unwrap());
        crate::extensions::initialize(&state).unwrap();
        let registry_path = state.data_dir().join("extensions/registry.json");
        let mut extension_registry: Value =
            serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();
        for id in ["horizon.launch", "horizon.terminal"] {
            extension_registry["records"][id]["enabledGlobal"] = json!(true);
        }
        crate::state::atomic_json(&registry_path, &extension_registry).unwrap();
        let mut profile = profile();
        profile.profile_id = id("test-profile");
        profile.project_id = id("test-project");
        profile.revision = 1;
        profile.steps.clear();
        let mut steps = vec![];
        for (index, (script, ready, lifecycle)) in scripts.iter().enumerate() {
            let step = LaunchStep {
                step_id: format!("step-{index}"),
                title: format!("进程 {index}"),
                depends_on: if index > 0 {
                    vec![format!("step-{}", index - 1)]
                } else {
                    vec![]
                },
                command: LaunchCommand::Shell {
                    shell: "/bin/sh".into(),
                    script: script.to_string(),
                },
                cwd: ".".into(),
                env: BTreeMap::new(),
                secret_refs: BTreeMap::new(),
                mode: "pipe".into(),
                lifecycle: lifecycle.to_string(),
                ready: ready.clone(),
                on_ready: None,
            };
            profile.steps.push(step.clone());
            steps.push(Resolved {
                step,
                executable: PathBuf::from("/bin/sh"),
                args: vec!["-c".into(), script.to_string()],
                cwd: root.clone(),
            });
        }
        let plan = Plan {
            id: id("test-plan"),
            project: profile.project_id.clone(),
            profile,
            digest: id("digest"),
            sources: BTreeMap::new(),
            steps,
            expires: stamp() + 60_000,
            approved_before: false,
            extension_versions: BTreeMap::new(),
            extension_actions: vec![],
        };
        (dir, state, plan)
    }
    fn stdout_ready() -> Ready {
        Ready::Stdout {
            pattern: "READY".into(),
            timeout_ms: 3000,
        }
    }
    fn running_count(project: &str) -> usize {
        resources(Some(project))["items"]
            .as_array()
            .unwrap()
            .iter()
            .filter(|p| p["state"] != "exited")
            .count()
    }
    #[test]
    fn launch_waits_for_dependencies_and_stops_in_reverse_order() {
        let (_dir,state,plan)=fixture(&[
            ("trap 'printf a >> stopped; exit 0' TERM; sleep 0.15; printf yes > ready-marker; printf READY; while :; do sleep 1; done",stdout_ready(),"service"),
            ("test -f ready-marker || exit 17; trap 'printf b >> stopped; exit 0' TERM; printf READY; while :; do sleep 1; done",stdout_ready(),"service")
        ]);
        let project = plan.project.clone();
        let root = plan.steps[0].cwd.clone();
        let run = start_plan(&state, &None, "test-start", plan.clone()).unwrap();
        assert_eq!(run["state"], "running");
        assert_eq!(running_count(&project), 2);
        assert_eq!(
            start_plan(&state, &None, "test-duplicate", plan)
                .unwrap_err()
                .code,
            "RESOURCE_BUSY"
        );
        assert!(run["steps"]
            .as_array()
            .unwrap()
            .iter()
            .all(|s| s["ready"] == true && s["verified"] == true));
        let stopped = stop_run(run["launchRunId"].as_str().unwrap(), &None, &project).unwrap();
        assert!(stopped["failed"].as_array().unwrap().is_empty());
        assert_eq!(running_count(&project), 0);
        assert_eq!(fs::read_to_string(root.join("stopped")).unwrap(), "ba");
    }
    #[test]
    fn launch_failure_and_timeout_stop_only_owned_run() {
        let (_dir, state, plan) = fixture(&[
            ("printf READY; sleep 30", stdout_ready(), "service"),
            ("exit 7", Ready::Exit { codes: vec![0] }, "oneshot"),
            (
                "printf unexpected > dependent-started",
                Ready::Exit { codes: vec![0] },
                "oneshot",
            ),
        ]);
        let project = plan.project.clone();
        let marker = plan.steps[0].cwd.join("dependent-started");
        let result = start_plan(&state, &None, "test-failure", plan);
        assert_eq!(result.unwrap_err().code, "PROCESS_EXITED");
        assert_eq!(running_count(&project), 0);
        assert!(
            !marker.exists(),
            "a failed dependency must never execute its dependent"
        );
        let (_dir, state, plan) = fixture(&[(
            "sleep 30",
            Ready::Stdout {
                pattern: "never".into(),
                timeout_ms: 120,
            },
            "service",
        )]);
        let project = plan.project.clone();
        assert_eq!(
            start_plan(&state, &None, "test-timeout", plan)
                .unwrap_err()
                .code,
            "TIMEOUT"
        );
        assert_eq!(running_count(&project), 0);
    }
    #[test]
    fn controlled_stop_failure_retains_owned_run_until_real_retry() {
        let (_dir, state, plan) = fixture(&[
            (
                "sleep 30 & child=$!; printf '%s' \"$child\" > owned-child.pid; printf READY; wait \"$child\"",
                stdout_ready(),
                "service",
            ),
            (
                "printf READY; while [ ! -f trigger-failure ]; do sleep 0.03; done; exit 23",
                stdout_ready(),
                "service",
            ),
        ]);
        let project = plan.project.clone();
        let root = plan.steps[0].cwd.clone();
        write_profiles(&state, &project, &[plan.profile.clone()]).unwrap();
        let run = start_plan(&state, &None, "controlled-stop-failure", plan.clone()).unwrap();
        let run_id = run["launchRunId"].as_str().unwrap().to_owned();
        struct Cleanup(String, String);
        impl Drop for Cleanup {
            fn drop(&mut self) {
                stop_failures_once().lock().unwrap().remove(&self.0);
                let _ = stop_run(&self.0, &None, &self.1);
            }
        }
        let _cleanup = Cleanup(run_id.clone(), project.clone());
        let process_id = run["steps"][0]["processInstanceId"]
            .as_str()
            .unwrap()
            .to_owned();
        let pid = run["steps"][0]["pid"].as_u64().unwrap() as i32;
        let failed_pid = run["steps"][1]["pid"].as_u64().unwrap() as i32;
        let child: i32 = fs::read_to_string(root.join("owned-child.pid"))
            .unwrap()
            .parse()
            .unwrap();
        let group = unsafe { libc::getpgid(pid) };
        assert_eq!(unsafe { libc::getpgid(child) }, group);
        let identities = |ids: &[i32]| {
            let output = Command::new("/bin/ps")
                .args([
                    "-p",
                    &ids.iter().map(i32::to_string).collect::<Vec<_>>().join(","),
                    "-o",
                    "pid=,ppid=,pgid=,stat=,lstart=,command=",
                ])
                .output()
                .unwrap();
            String::from_utf8_lossy(&output.stdout).to_string()
        };
        println!(
            "STOP_FAILURE_EVIDENCE {}",
            json!({
                "phase":"before-controlled-failure","runId":run_id,"pid":pid,"childPid":child,"failingServicePid":failed_pid,"pgid":group,
                "identities":identities(&[pid, child, failed_pid]),
                "method":"real owned shell/process group; one cfg(test) run-scoped error before OS signal; not an OS permission failure or GUI test"
            })
        );
        stop_failures_once().lock().unwrap().insert(run_id.clone());
        fs::write(root.join("trigger-failure"), "fail now").unwrap();
        let started = Instant::now();
        loop {
            let snapshot = registry().lock().unwrap().runs[&run_id].value();
            if snapshot["state"] == "partial" && snapshot["steps"][0]["stopError"].is_string() {
                break;
            }
            assert!(started.elapsed() < Duration::from_secs(4), "{snapshot}");
            thread::sleep(Duration::from_millis(15));
        }
        // Give the background cleanup callback time to return; it must not overwrite partial with failed.
        thread::sleep(Duration::from_millis(100));
        let snapshot = registry().lock().unwrap().runs[&run_id].value();
        assert_eq!(snapshot["state"], "partial");
        assert_eq!(snapshot["steps"][0]["state"], "stopping");
        assert_eq!(snapshot["steps"][0]["ready"], false);
        assert!(snapshot["steps"][0]["stopError"]
            .as_str()
            .unwrap()
            .contains("发送系统信号前失败"));
        assert_eq!(snapshot["steps"][1]["exitCode"], 23);
        assert_eq!(unsafe { libc::kill(pid, 0) }, 0);
        assert_eq!(unsafe { libc::kill(child, 0) }, 0);
        assert_eq!(unsafe { libc::kill(-group, 0) }, 0);
        let retained = resources(Some(&project));
        assert_eq!(retained["items"].as_array().unwrap().len(), 1);
        assert_eq!(retained["items"][0]["processInstanceId"], process_id);
        assert_eq!(retained["items"][0]["pid"], pid);
        assert_eq!(retained["items"][0]["state"], "stopping");
        assert!(crate::extensions::activation_id(&state, "horizon.launch", Some(&project)).is_ok());
        assert_eq!(
            start_plan(&state, &None, "duplicate-after-stop-failure", plan.clone())
                .unwrap_err()
                .code,
            "RESOURCE_BUSY"
        );
        assert_eq!(resources(Some(&project)), retained);
        assert_eq!(
            registry()
                .lock()
                .unwrap()
                .runs
                .values()
                .filter(|r| r.project == project)
                .count(),
            1
        );
        assert_eq!(
            delete_profile(&state, &project, &plan.profile.profile_id, 1)
                .unwrap_err()
                .code,
            "RESOURCE_BUSY"
        );
        assert_eq!(profiles(&state, &project).unwrap().len(), 1);
        println!(
            "STOP_FAILURE_EVIDENCE {}",
            json!({
                "phase":"retained-after-controlled-failure","run":snapshot,"resources":retained,
                "identities":identities(&[pid, child, failed_pid]),"duplicateStart":"RESOURCE_BUSY","deleteProfile":"RESOURCE_BUSY"
            })
        );
        let stopped = stop_run(&run_id, &None, &project).unwrap();
        assert!(stopped["failed"].as_array().unwrap().is_empty());
        assert_eq!(running_count(&project), 0);
        assert_eq!(unsafe { libc::kill(pid, 0) }, -1);
        assert_eq!(unsafe { libc::kill(child, 0) }, -1);
        assert_eq!(unsafe { libc::kill(-group, 0) }, -1);
        assert!(
            crate::extensions::activation_id(&state, "horizon.launch", Some(&project)).is_err()
        );
        let snapshot = registry().lock().unwrap().runs[&run_id].value();
        assert_eq!(snapshot["state"], "stopped");
        assert!(snapshot["steps"][0].get("stopError").is_none());
        println!(
            "STOP_FAILURE_EVIDENCE {}",
            json!({
                "phase":"real-stop-retry-complete","result":stopped,"run":snapshot,"resources":resources(Some(&project)),
                "identities":identities(&[pid, child, failed_pid]),"ownedRootChildAndGroupGone":true
            })
        );
    }
    #[test]
    fn cancellation_stops_owned_run_even_when_failure_policy_keeps_processes() {
        let (_dir, state, mut plan) = fixture(&[(
            "printf WAITING; sleep 30",
            Ready::Stdout {
                pattern: "NEVER".into(),
                timeout_ms: 5000,
            },
            "service",
        )]);
        plan.profile.failure_policy = "keepRunning".into();
        let project = plan.project.clone();
        let request = id("cancel-request");
        let task_id = id("cancel-task");
        let call = Call {
            protocol_version: 1,
            request_id: request.clone(),
            method: "launch_start".into(),
            scope: json!({"kind":"project","projectId":project,"projectEpoch":1}),
            params: json!({}),
            idempotency_key: Some(id("idem")),
        };
        state.tasks.lock().unwrap().insert(
            task_id.clone(),
            crate::state::TaskRecord {
                id: task_id.clone(),
                call,
                state: "running".into(),
                cancelled: false,
                seq: 0,
                ack: 0,
                events: VecDeque::new(),
                ring_bytes: 0,
                channel: None,
                terminal: None,
                updated: Instant::now(),
            },
        );
        let run_state = state.clone();
        let worker = thread::spawn(move || start_plan(&run_state, &None, &request, plan));
        let started = Instant::now();
        while running_count(&project) == 0 {
            assert!(started.elapsed() < Duration::from_secs(3));
            thread::sleep(Duration::from_millis(15));
        }
        state
            .tasks
            .lock()
            .unwrap()
            .get_mut(&task_id)
            .unwrap()
            .cancelled = true;
        assert_eq!(worker.join().unwrap().unwrap_err().code, "CANCELLED");
        assert_eq!(running_count(&project), 0);
        let extensions: Value = serde_json::from_slice(
            &fs::read(state.data_dir().join("extensions/registry.json")).unwrap(),
        )
        .unwrap();
        assert!(extensions["records"]["horizon.launch"]["activations"]
            .get(&project)
            .is_none());
    }
    #[test]
    fn launch_lease_uses_actual_activation_and_releases_its_origin() {
        let (_dir, state, plan) = fixture(&[("printf READY; sleep 30", stdout_ready(), "service")]);
        let project = plan.project.clone();
        let run = start_plan(&state, &None, "lease-start", plan).unwrap();
        let activation =
            crate::extensions::activation_id(&state, "horizon.launch", Some(&project)).unwrap();
        assert_eq!(
            resources(Some(&project))["items"][0]["owner"]["activationId"],
            activation
        );
        stop_run(run["launchRunId"].as_str().unwrap(), &None, &project).unwrap();
        assert!(
            crate::extensions::activation_id(&state, "horizon.launch", Some(&project)).is_err()
        );
        let config: Value = serde_json::from_slice(
            &fs::read(state.data_dir().join("extensions/registry.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(config["records"]["horizon.launch"]["enabledGlobal"], true);
    }
    #[test]
    fn direct_terminal_lease_releases_after_natural_exit() {
        let (_dir, state, plan) = fixture(&[("", Ready::ProcessStarted, "service")]);
        let project = plan.project.clone();
        let lease_id = id("direct-terminal-test");
        let value = crate::extensions::acquire_launch_requirements(
            &state,
            &project,
            &["horizon.terminal".into()],
            &lease_id,
        )
        .unwrap();
        let activation = value["items"][0]["activationId"]
            .as_str()
            .unwrap()
            .to_string();
        let mut step = plan.steps[0].clone();
        step.step.mode = "pty".into();
        step.args = vec!["-c".into(), "printf done; sleep 0.1".into()];
        let process_id = spawn_process(
            &step,
            &project,
            "horizon.terminal",
            None,
            None,
            Some(ProcessIdentity {
                activation_id: activation,
                lease: Some(DirectLease {
                    state: Arc::downgrade(&state),
                    project: project.clone(),
                    id: lease_id,
                }),
            }),
        )
        .unwrap();
        let process = process_for(&process_id, None).unwrap();
        let started = Instant::now();
        loop {
            let finished = {
                let p = process.lock().unwrap();
                p.state == "exited" && !p.lease_releasing && p.direct_lease.is_none()
            };
            if finished {
                break;
            }
            assert!(started.elapsed() < Duration::from_secs(3));
            thread::sleep(Duration::from_millis(20));
        }
        assert!(
            crate::extensions::activation_id(&state, "horizon.terminal", Some(&project)).is_err()
        );
    }
    #[test]
    fn background_service_exit_stops_siblings_and_releases_lease() {
        let (_dir, state, plan) = fixture(&[
            ("printf READY; sleep 0.3; exit 9", stdout_ready(), "service"),
            ("printf READY; sleep 30", stdout_ready(), "service"),
        ]);
        let project = plan.project.clone();
        let run = start_plan(&state, &None, "background-fail", plan).unwrap();
        let run_id = run["launchRunId"].as_str().unwrap();
        let started = Instant::now();
        loop {
            let finished = {
                let r = registry().lock().unwrap();
                let run = &r.runs[run_id];
                run.state == "failed" && run.lease_state.is_none() && !run.lease_releasing
            };
            if finished {
                break;
            }
            assert!(started.elapsed() < Duration::from_secs(4));
            thread::sleep(Duration::from_millis(30));
        }
        assert_eq!(running_count(&project), 0);
        assert_eq!(
            registry().lock().unwrap().runs[run_id].steps[0]["exitCode"],
            9
        );
        assert!(
            crate::extensions::activation_id(&state, "horizon.launch", Some(&project)).is_err()
        );
    }
    #[test]
    fn port_preflight_leaves_external_listener_alive() {
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let (_dir, _state, plan) = fixture(&[(
            "sleep 30",
            Ready::Tcp {
                host: "127.0.0.1".into(),
                port,
                timeout_ms: 1000,
            },
            "service",
        )]);
        assert_eq!(
            preflight(&plan.steps, None).unwrap_err().code,
            "PORT_IN_USE"
        );
        assert!(TcpStream::connect(("127.0.0.1", port)).is_ok());
        assert_eq!(running_count(&plan.project), 0);
    }
    #[test]
    fn authorization_snapshot_rejects_changed_script_and_missing_approval() {
        let (_dir, state, mut plan) = fixture(&[("sleep 30", stdout_ready(), "service")]);
        let script = plan.steps[0].cwd.join("fixture.sh");
        fs::write(&script, "printf original").unwrap();
        plan.steps[0].step.command = LaunchCommand::Exec {
            executable: "/bin/sh".into(),
            args: vec!["fixture.sh".into()],
        };
        plan.sources = sources(&plan.steps).unwrap();
        write_profiles(&state, &plan.project, &[plan.profile.clone()]).unwrap();
        registry()
            .lock()
            .unwrap()
            .plans
            .insert(plan.id.clone(), plan.clone());
        let params = json!({"planId":plan.id,"planDigest":plan.digest,"approved":false});
        assert_eq!(
            checked_plan(&state, &plan.project, &params)
                .err()
                .unwrap()
                .code,
            "PERMISSION_DENIED"
        );
        fs::write(script, "printf changed").unwrap();
        let params = json!({"planId":plan.id,"planDigest":plan.digest,"approved":true});
        assert_eq!(
            checked_plan(&state, &plan.project, &params)
                .err()
                .unwrap()
                .code,
            "STALE_VERSION"
        );
    }
    #[test]
    fn saved_changes_do_not_mutate_live_snapshot_and_delete_requires_confirmed_stop() {
        let (_dir, state, mut plan) = fixture(&[(
            "printf old > snapshot-marker; sleep 30",
            Ready::ProcessStarted,
            "service",
        )]);
        let root = plan.steps[0].cwd.clone();
        write_profiles(&state, &plan.project, &[plan.profile.clone()]).unwrap();
        let run = start_plan(&state, &None, "snapshot-start", plan.clone()).unwrap();
        let run_id = run["launchRunId"].as_str().unwrap();
        plan.profile.revision = 2;
        plan.profile.steps[0].command = LaunchCommand::Shell {
            shell: "/bin/sh".into(),
            script: "printf new > snapshot-marker; sleep 30".into(),
        };
        plan.steps[0].step = plan.profile.steps[0].clone();
        plan.steps[0].args = vec!["-c".into(), "printf new > snapshot-marker; sleep 30".into()];
        write_profiles(&state, &plan.project, &[plan.profile.clone()]).unwrap();
        {
            let r = registry().lock().unwrap();
            let live = &r.runs[run_id];
            assert_eq!(live.profile.revision, 1);
            assert_eq!(live.steps[0]["verified"], false);
            assert!(
                matches!(&live.profile.steps[0].command, LaunchCommand::Shell { script, .. } if script.contains("printf old"))
            );
        }
        assert_eq!(
            delete_profile(&state, &plan.project, &plan.profile.profile_id, 2)
                .unwrap_err()
                .code,
            "RESOURCE_BUSY"
        );
        assert_eq!(profiles(&state, &plan.project).unwrap()[0].revision, 2);
        assert_eq!(running_count(&plan.project), 1);
        assert!(stop_run(run_id, &None, &plan.project).unwrap()["failed"]
            .as_array()
            .unwrap()
            .is_empty());
        let replacement = start_plan(&state, &None, "snapshot-restart", plan.clone()).unwrap();
        assert_eq!(replacement["profileRevision"], 2);
        let started = Instant::now();
        while fs::read_to_string(root.join("snapshot-marker")).unwrap_or_default() != "new" {
            assert!(started.elapsed() < Duration::from_secs(2));
            thread::sleep(Duration::from_millis(10));
        }
        stop_run(
            replacement["launchRunId"].as_str().unwrap(),
            &None,
            &plan.project,
        )
        .unwrap();
        delete_profile(&state, &plan.project, &plan.profile.profile_id, 2).unwrap();
        assert!(profiles(&state, &plan.project).unwrap().is_empty());
        assert_eq!(
            fs::read_to_string(root.join("snapshot-marker")).unwrap(),
            "new"
        );
    }
    #[test]
    fn automatic_url_uses_saved_ready_snapshot_once_and_never_log_urls() {
        let (_dir, state, mut plan) = fixture(&[(
            "printf 'http://127.0.0.1:59998/from-log\\n'; sleep 0.1; printf yes > ready-marker; printf READY; sleep 30",
            stdout_ready(), "service",
        )]);
        let config = OnReady {
            open_terminal: false,
            open_url: Some("http://127.0.0.1:59997/saved".into()),
            auto_open_url: true,
        };
        plan.profile.steps[0].on_ready = Some(config.clone());
        plan.steps[0].step.on_ready = Some(config);
        let root = plan.steps[0].cwd.clone();
        let mut opened = vec![];
        let mut opener = |url: &str| {
            assert!(root.join("ready-marker").exists());
            opened.push(url.to_owned());
            Ok(())
        };
        let run = start_plan_with_url_opener(&state, &None, "auto-url", plan.clone(), &mut opener)
            .unwrap();
        let run_id = run["launchRunId"].as_str().unwrap();
        // Saving a new target cannot alter the running snapshot or trigger another open.
        plan.profile.revision = 2;
        plan.profile.steps[0].on_ready.as_mut().unwrap().open_url =
            Some("http://127.0.0.1:59996/new-saved".into());
        write_profiles(&state, &plan.project, &[plan.profile.clone()]).unwrap();
        for _ in 0..3 {
            assert!(
                !open_ready_url_with(run_id, &plan.project, "step-0", true, &mut opener).unwrap()
            );
        }
        assert_eq!(opened, ["http://127.0.0.1:59997/saved"]);
        assert_eq!(
            claim_ready_url(run_id, &plan.project, "step-0", false)
                .unwrap()
                .as_deref(),
            Some("http://127.0.0.1:59997/saved")
        );
        stop_run(run_id, &None, &plan.project).unwrap();
        assert_eq!(
            claim_ready_url(run_id, &plan.project, "step-0", false)
                .unwrap_err()
                .code,
            "RESOURCE_BUSY"
        );
        let (_dir, state, mut waiting) = fixture(&[(
            "printf 'http://127.0.0.1:59998/from-log'; sleep 30",
            Ready::Stdout {
                pattern: "NEVER".into(),
                timeout_ms: 100,
            },
            "service",
        )]);
        waiting.profile.steps[0].on_ready = plan.steps[0].step.on_ready.clone();
        waiting.steps[0].step.on_ready = waiting.profile.steps[0].on_ready.clone();
        let mut opens_before_ready = 0;
        assert_eq!(
            start_plan_with_url_opener(&state, &None, "unready-url", waiting, &mut |_| {
                opens_before_ready += 1;
                Ok(())
            })
            .unwrap_err()
            .code,
            "TIMEOUT"
        );
        assert_eq!(opens_before_ready, 0);
    }
    #[test]
    fn preflight_program_errors_identify_missing_and_foreign_paths() {
        let error = executable("/nonexistent/horizon-candidate7-program").unwrap_err();
        assert_eq!(error.code, "DEPENDENCY_UNAVAILABLE");
        assert!(error
            .message
            .contains("/nonexistent/horizon-candidate7-program"));
        assert_eq!(
            executable(r"C:\\Program Files\\nodejs\\node.exe")
                .unwrap_err()
                .code,
            "UNSUPPORTED_PLATFORM"
        );
    }
    #[test]
    fn credential_redaction_handles_split_output() {
        let mut redactor = Redactor {
            secrets: vec![b"secret-key".to_vec()],
            pending: vec![],
        };
        assert_eq!(redactor.feed(b"hello sec", false), b"hello ");
        assert_eq!(redactor.feed(b"ret-key world", false), b"[REDACTED] world");
        assert!(redactor.feed(&[], true).is_empty());
    }
    #[test]
    fn profile_export_omits_secrets_and_local_authorization() {
        let mut p = profile();
        p.steps[0]
            .env
            .insert("API_TOKEN".into(), "do-not-export".into());
        p.steps[0]
            .env
            .insert("NODE_ENV".into(), "development".into());
        p.steps[0]
            .secret_refs
            .insert("AUTH".into(), "local-credential-id".into());
        let data = export_profile(p);
        let text = serde_json::to_string(&data).unwrap();
        assert!(!text.contains("do-not-export"));
        assert!(!text.contains("local-credential-id"));
        assert_eq!(data["profile"]["projectId"], "");
        assert_eq!(data["profile"]["revision"], 0);
        assert_eq!(
            data["profile"]["steps"][0]["env"]["NODE_ENV"],
            "development"
        );
    }
    #[test]
    fn discovery_reads_nested_scripts_without_executing() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("apps/中文 Web")).unwrap();
        fs::create_dir_all(dir.path().join("node_modules/package")).unwrap();
        fs::write(
            dir.path().join("apps/中文 Web/package.json"),
            br#"{"packageManager":"pnpm@10.0.0","scripts":{"dev":"touch NEVER_EXECUTED"}}"#,
        )
        .unwrap();
        fs::write(
            dir.path().join("node_modules/package/package.json"),
            br#"{"scripts":{"bad":"exit 1"}}"#,
        )
        .unwrap();
        let found = detect_scripts(dir.path()).unwrap();
        assert_eq!(found["candidates"].as_array().unwrap().len(), 1);
        assert_eq!(
            found["candidates"][0]["suggestedStep"]["command"]["executable"],
            "pnpm"
        );
        assert_eq!(found["candidates"][0]["cwd"], "apps/中文 Web");
        assert!(!dir.path().join("apps/中文 Web/NEVER_EXECUTED").exists());
    }
    #[test]
    fn stopping_terminal_releases_pty_dependencies_and_preserves_other_project() {
        let (_a, state_a, mut plan_a) = fixture(&[
            ("printf READY; sleep 30", stdout_ready(), "service"),
            ("printf READY; sleep 30", stdout_ready(), "service"),
        ]);
        plan_a.steps[0].step.mode = "pty".into();
        plan_a.profile.steps[0].mode = "pty".into();
        let (_b, state_b, plan_b) =
            fixture(&[("printf READY; sleep 30", stdout_ready(), "service")]);
        let project_a = plan_a.project.clone();
        let project_b = plan_b.project.clone();
        start_plan(&state_a, &None, "a-start", plan_a).unwrap();
        let b = start_plan(&state_b, &None, "b-start", plan_b).unwrap();
        assert!(resources(Some(&project_a))["items"]
            .as_array()
            .unwrap()
            .iter()
            .all(|p| p["requiresExtensions"]
                .as_array()
                .unwrap()
                .contains(&json!("horizon.terminal"))));
        stop_extension("horizon.terminal", Some(&project_a)).unwrap();
        assert_eq!(running_count(&project_a), 0);
        assert_eq!(running_count(&project_b), 1);
        stop_run(b["launchRunId"].as_str().unwrap(), &None, &project_b).unwrap();
    }
    #[test]
    #[ignore = "child process fixture, invoked by owned_http_readiness"]
    fn http_fixture_server() {
        let port = std::env::var("HORIZON_TEST_PORT")
            .unwrap()
            .parse::<u16>()
            .unwrap();
        let listener = std::net::TcpListener::bind(("127.0.0.1", port)).unwrap();
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                let _ = stream.write_all(
                    b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok",
                );
            }
        }
    }
    #[test]
    fn owned_http_readiness_and_restart_preflight_accept_only_owned_port() {
        let listener = std::net::TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        drop(listener);
        let (_dir, state, mut plan) = fixture(&[(
            "",
            Ready::Http {
                url: format!("http://127.0.0.1:{port}"),
                status_codes: vec![200],
                timeout_ms: 5000,
            },
            "service",
        )]);
        plan.steps[0].executable = std::env::current_exe().unwrap();
        plan.steps[0].args = vec![
            "--exact".into(),
            "processes::tests::http_fixture_server".into(),
            "--ignored".into(),
            "--nocapture".into(),
        ];
        plan.steps[0]
            .step
            .env
            .insert("HORIZON_TEST_PORT".into(), port.to_string());
        let project = plan.project.clone();
        let steps = plan.steps.clone();
        let run = start_plan(&state, &None, "http-start", plan).unwrap();
        let run_id = run["launchRunId"].as_str().unwrap();
        assert_eq!(run["steps"][0]["verified"], true);
        assert!(preflight(&steps, Some(run_id)).is_ok());
        assert_eq!(preflight(&steps, None).unwrap_err().code, "PORT_IN_USE");
        stop_run(run_id, &None, &project).unwrap();
        assert!(TcpStream::connect(("127.0.0.1", port)).is_err());
    }
}


#[cfg(all(test, windows))]
mod windows_tests {
    use super::*;

    struct OwnedPtyCleanup(String);
    impl Drop for OwnedPtyCleanup {
        fn drop(&mut self) {
            // Include a registered spawn-failure resource, if any, and target
            // only this test's unique project-owned objects, never a PID lookup.
            let processes = {
                let registry = registry().lock().unwrap_or_else(|e| e.into_inner());
                registry.processes.values().filter_map(|process| {
                    let owned = process.lock().unwrap_or_else(|e| e.into_inner()).project == self.0;
                    owned.then(|| process.clone())
                }).collect::<Vec<_>>()
            };
            for process in processes {
                if let Err(error) = stop_process(&process, true, None) {
                    eprintln!("owned Windows ConPTY cleanup remains unconfirmed: {error:?}");
                }
            }
        }
    }

    fn wait_for_output(process: &Arc<Mutex<Process>>, expected: &str, timeout: Duration) {
        let started = Instant::now();
        loop {
            let (state, bytes) = {
                let process = process.lock().unwrap();
                (process.state.clone(), process.output.read(0, 64 * 1024))
            };
            let text = String::from_utf8_lossy(&bytes);
            if text.contains(expected) { return; }
            assert!(state != "exited" && started.elapsed() < timeout,
                "expected {expected:?}, state={state}, output={:?}", text.chars().take(2000).collect::<String>());
            thread::sleep(Duration::from_millis(20));
        }
    }

    #[test]
    fn owned_conpty_chinese_resize_and_stop() {
        let directory = tempfile::tempdir().unwrap();
        let project = id("windows-conpty-test");
        let _cleanup = OwnedPtyCleanup(project.clone());
        let powershell = executable("powershell.exe").unwrap();
        let script = r#"[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false);
[Console]::WriteLine('HORIZON_CONPTY_中文输出');
while ($true) {
    [Console]::WriteLine(('HORIZON_CONPTY_SIZE={0}x{1}' -f [Console]::WindowWidth, [Console]::WindowHeight));
    Start-Sleep -Milliseconds 50;
}"#;
        let args = vec!["-NoLogo".into(), "-NoProfile".into(), "-Command".into(), script.into()];
        let step = LaunchStep {
            step_id: "windows-conpty".into(),
            title: "Owned Windows ConPTY".into(),
            depends_on: vec![],
            command: LaunchCommand::Exec { executable: powershell.to_string_lossy().into_owned(), args: args.clone() },
            cwd: ".".into(),
            env: BTreeMap::new(),
            secret_refs: BTreeMap::new(),
            mode: "pty".into(),
            lifecycle: "service".into(),
            ready: Ready::ProcessStarted,
            on_ready: None,
        };
        let process_id = spawn_process(
            &Resolved { step, executable: powershell, args, cwd: directory.path().to_path_buf() },
            &project, "horizon.terminal", None, None, None,
        ).unwrap();
        let process = process_for(&process_id, Some(&project)).unwrap();
        let (pid, job) = {
            let process = process.lock().unwrap();
            (process.pid, process.job.clone())
        };
        let job = job.expect("production ConPTY spawn must retain its owned Job");
        assert_eq!(job.root_pid(), pid);
        assert!(job.contains_pid(pid).unwrap());
        wait_for_output(&process, "HORIZON_CONPTY_中文输出", Duration::from_secs(10));

        // The library's get_size alone may reflect cached dimensions. Require
        // the attached PowerShell's real Console API report after the resize.
        let resized = {
            let process = process.lock().unwrap();
            match process.master.as_ref() {
                Some(master) => master.resize(PtySize { rows: 40, cols: 120, pixel_width: 0, pixel_height: 0 })
                    .and_then(|_| master.get_size()).map_err(|error| error.to_string()),
                None => Err("production PTY master missing".to_string()),
            }
        }.unwrap();
        assert_eq!((resized.cols, resized.rows), (120, 40));
        wait_for_output(&process, "HORIZON_CONPTY_SIZE=120x40", Duration::from_secs(5));

        let stopped = stop_process(&process, false, None).unwrap();
        assert_eq!(stopped["exited"], true);
        let (state, exit, lease_releasing, master_released, writer_released) = {
            let process = process.lock().unwrap();
            (process.state.clone(), process.exit, process.lease_releasing, process.master.is_none(), process.writer.is_none())
        };
        assert_eq!(state, "exited");
        assert!(exit.is_some());
        assert!(!lease_releasing);
        assert!(master_released && writer_released);
        assert!(job.is_empty().unwrap(), "owned root handle and entire Job must be terminal");
        println!("Windows ConPTY PID {pid}: Chinese output, real size120x40, process exited and Job empty");
    }
}
