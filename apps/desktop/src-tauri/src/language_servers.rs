//! Owned stdio transports. The editor owns LSP requests and document state.
use crate::{
    protocol::{allowed, string},
    Call, HostError, HostState,
};
use serde_json::{json, Value};
use std::{
    collections::BTreeMap,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, OnceLock,
    },
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, Emitter};
use tokio::{
    io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader},
    process::{Child, Command},
    sync::{mpsc, oneshot, Notify},
};

const MAX_MESSAGE: usize = 32 * 1024 * 1024;
const MAX_HEADER: usize = 8192;
const SHUTDOWN_GRACE: Duration = Duration::from_millis(750);

struct WriteRequest {
    message: String,
    done: oneshot::Sender<Result<(), String>>,
}
struct Session {
    id: String,
    owner: PathBuf,
    project: String,
    extension: String,
    activation: String,
    server: String,
    root: PathBuf,
    root_markers: Vec<Value>,
    language_ids: Vec<String>,
    fingerprint: String,
    pid: u32,
    started: String,
    app: Option<AppHandle>,
    channel: Channel<Value>,
    input: mpsc::Sender<WriteRequest>,
    stopping: AtomicBool,
    force: AtomicBool,
    terminated: AtomicBool,
    stop: Notify,
    finished: Notify,
    shutdown_reply: Notify,
    failure: Mutex<Option<String>>,
}
fn sessions() -> &'static Mutex<BTreeMap<String, Arc<Session>>> {
    static SESSIONS: OnceLock<Mutex<BTreeMap<String, Arc<Session>>>> = OnceLock::new();
    SESSIONS.get_or_init(Default::default)
}
fn starts() -> &'static tokio::sync::Mutex<()> {
    static STARTS: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
    STARTS.get_or_init(Default::default)
}
fn fail(message: impl Into<String>) -> HostError {
    HostError::new("LANGUAGE_SERVER_FAILED", message)
}
fn uri(path: &Path) -> Result<String, HostError> {
    reqwest::Url::from_file_path(path)
        .map(|url| url.to_string())
        .map_err(|_| HostError::new("UNSUPPORTED_PATH", "语言服务需要绝对文件路径"))
}
fn path_from_uri(value: &str) -> Result<PathBuf, HostError> {
    let url = reqwest::Url::parse(value)
        .map_err(|_| HostError::new("INVALID_ARGUMENT", "文件 URI 无效"))?;
    if url.scheme() != "file" || url.query().is_some() || url.fragment().is_some() {
        return Err(HostError::new(
            "PERMISSION_DENIED",
            "当前仅支持本地文件语言服务目标",
        ));
    }
    url.to_file_path()
        .map_err(|_| HostError::new("INVALID_ARGUMENT", "本地文件 URI 无效"))
}
fn workspace_root(project: &Path, file: &Path, markers: &[Value]) -> PathBuf {
    // Prefer the outer matching workspace: a monorepo's service can share its
    // project graph rather than spawning once per nested package/tsconfig.
    let mut matched = None;
    let mut directory = file.parent();
    while let Some(path) = directory {
        if !path.starts_with(project) {
            break;
        }
        if markers
            .iter()
            .filter_map(Value::as_str)
            .any(|marker| path.join(marker).exists())
        {
            matched = Some(path.to_owned());
        }
        if path == project {
            break;
        }
        directory = path.parent();
    }
    matched.unwrap_or_else(|| project.to_owned())
}

async fn write_frame(writer: &mut (impl AsyncWrite + Unpin), message: &str) -> std::io::Result<()> {
    writer
        .write_all(format!("Content-Length: {}\r\n\r\n", message.len()).as_bytes())
        .await?;
    writer.write_all(message.as_bytes()).await?;
    writer.flush().await
}
async fn read_frame(reader: &mut (impl AsyncBufRead + Unpin)) -> std::io::Result<Option<String>> {
    let mut total = 0;
    let mut length = None;
    loop {
        // read_until has no inherent bound; take limits allocation on malformed
        // headers while preserving all bytes belonging to the next frame.
        let mut line = Vec::new();
        let count = (&mut *reader)
            .take((MAX_HEADER + 1 - total) as u64)
            .read_until(b'\n', &mut line)
            .await?;
        if count == 0 && total == 0 {
            return Ok(None);
        }
        total += count;
        if count == 0 || total > MAX_HEADER || !line.ends_with(b"\n") {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "invalid LSP header",
            ));
        }
        if line == b"\r\n" || line == b"\n" {
            break;
        }
        let header = std::str::from_utf8(&line).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, "non-ASCII LSP header")
        })?;
        let (name, value) = header.split_once(':').ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidData, "invalid LSP header")
        })?;
        if name.eq_ignore_ascii_case("Content-Length") {
            if length.is_some() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "duplicate Content-Length",
                ));
            }
            let count = value.trim().parse::<usize>().map_err(|_| {
                std::io::Error::new(std::io::ErrorKind::InvalidData, "invalid Content-Length")
            })?;
            if count > MAX_MESSAGE {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    "LSP message exceeds 32 MiB",
                ));
            }
            length = Some(count);
        }
    }
    let count = length.ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, "missing Content-Length")
    })?;
    let mut body = vec![0; count];
    reader.read_exact(&mut body).await?;
    String::from_utf8(body).map(Some).map_err(|_| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, "invalid UTF-8 LSP message")
    })
}
impl Session {
    async fn write(&self, message: String) -> Result<(), HostError> {
        let (done, receive) = oneshot::channel();
        self.input
            .send(WriteRequest { message, done })
            .await
            .map_err(|_| fail("语言服务输入管道已关闭"))?;
        receive
            .await
            .map_err(|_| fail("语言服务输入管道已关闭"))?
            .map_err(fail)
    }
    fn request_stop(&self) {
        self.stopping.store(true, Ordering::Release);
        self.stop.notify_one();
    }
    fn notify_change(&self) {
        if let Some(app) = &self.app {
            let _ = app.emit(
                "horizon:process:v1",
                json!({"processInstanceId":self.id,"projectId":self.project}),
            );
            let _ = app.emit(
                "horizon:extension:v1",
                json!({"extensionId":self.extension,"projectId":self.project}),
            );
        }
    }
    async fn wait_finished(&self) -> Result<(), HostError> {
        let wait = async {
            loop {
                let notified = self.finished.notified();
                tokio::pin!(notified);
                notified.as_mut().enable();
                if self.terminated.load(Ordering::Acquire) {
                    return;
                }
                notified.await;
            }
        };
        tokio::time::timeout(Duration::from_secs(5), wait)
            .await
            .map_err(|_| fail("语言服务尚未完成退出，请稍后重试"))
    }
}

#[cfg(unix)]
fn kill_tree(session: &Session) -> std::io::Result<()> {
    let result = unsafe { libc::kill(-(session.pid as i32), libc::SIGKILL) };
    if result == 0 {
        return Ok(());
    }
    let error = std::io::Error::last_os_error();
    if error.raw_os_error() == Some(libc::ESRCH) {
        Ok(())
    } else {
        Err(error)
    }
}

async fn serve(
    state: Arc<HostState>,
    session: Arc<Session>,
    mut child: Child,
    mut writes: mpsc::Receiver<WriteRequest>,
    #[cfg(windows)] job: Arc<crate::windows_process::OwnedJob>,
) {
    let mut stdin = child.stdin.take().expect("piped language server stdin");
    let stdout = child.stdout.take().expect("piped language server stdout");
    let mut stderr = child.stderr.take().expect("piped language server stderr");
    let writer_session = session.clone();
    let writer = tokio::spawn(async move {
        while let Some(request) = writes.recv().await {
            let result = write_frame(&mut stdin, &request.message)
                .await
                .map_err(|error| error.to_string());
            let failed = result.is_err();
            let _ = request.done.send(result);
            if failed {
                writer_session.request_stop();
                break;
            }
        }
    });
    let output_session = session.clone();
    let output = tokio::spawn(async move {
        let mut reader = BufReader::new(stdout);
        loop {
            match read_frame(&mut reader).await {
                Ok(Some(message)) => {
                    let shutdown_id = format!("__horizon_shutdown_{}", output_session.id);
                    if output_session.stopping.load(Ordering::Acquire)
                        && message.contains(&shutdown_id)
                        && serde_json::from_str::<Value>(&message)
                            .ok()
                            .is_some_and(|value| value["id"] == shutdown_id)
                    {
                        output_session.shutdown_reply.notify_one();
                    } else {
                        let sent = output_session.channel.send(json!({"type":"message", "message":message}));
                        if sent.is_err() {
                            *output_session.failure.lock().unwrap() = Some("语言服务连接已关闭".into());
                            break;
                        }
                    }
                }
                Ok(None) => break,
                Err(error) => {
                    *output_session.failure.lock().unwrap() =
                        Some(format!("语言服务输出无效：{error}"));
                    break;
                }
            }
        }
        output_session.request_stop();
    });
    // Logs are not protocol messages and never enter the launch output/history
    // pipeline. Draining prevents a chatty server from blocking its stdout.
    let logs = tokio::spawn(async move {
        let mut buffer = [0; 4096];
        while stderr.read(&mut buffer).await.is_ok_and(|count| count > 0) {}
    });
    let status = tokio::select! {
        result = child.wait() => result,
        _ = session.stop.notified() => {
            session.stopping.store(true, Ordering::Release);
            session.notify_change();
            if session.force.load(Ordering::Acquire) {
                #[cfg(unix)] let _ = kill_tree(&session);
                #[cfg(windows)] let _ = job.terminate();
                let _ = child.start_kill();
            } else {
                let shutdown = json!({"jsonrpc":"2.0", "id":format!("__horizon_shutdown_{}",session.id), "method":"shutdown", "params":null}).to_string();
                if tokio::time::timeout(SHUTDOWN_GRACE, session.write(shutdown)).await.is_ok_and(|result| result.is_ok()) {
                    let _ = tokio::time::timeout(SHUTDOWN_GRACE, session.shutdown_reply.notified()).await;
                    let _ = tokio::time::timeout(SHUTDOWN_GRACE, session.write(json!({"jsonrpc":"2.0", "method":"exit"}).to_string())).await;
                }
            }
            match tokio::time::timeout(SHUTDOWN_GRACE, child.wait()).await {
                Ok(result) => result,
                Err(_) => {
                    #[cfg(unix)] let _ = kill_tree(&session);
                    #[cfg(windows)] let _ = job.terminate();
                    let _ = child.start_kill();
                    child.wait().await
                }
            }
        }
    };
    // Servers may launch indexers. Their owned process tree cannot outlive the
    // server even if the root exits before its helpers finish.
    #[cfg(unix)]
    let _ = kill_tree(&session);
    #[cfg(windows)]
    let _ = job.terminate();
    session.stopping.store(true, Ordering::Release);
    writer.abort();
    output.abort();
    logs.abort();
    let _ = writer.await;
    let _ = output.await;
    let _ = logs.await;
    let failure = session
        .failure
        .lock()
        .unwrap()
        .clone()
        .or_else(|| match status {
            Ok(status) if status.success() => None,
            Ok(status) => Some(format!("语言服务已退出（{status}）")),
            Err(error) => Some(format!("语言服务退出失败：{error}")),
        });
    sessions().lock().unwrap().remove(&session.id);
    session.notify_change();
    let _ = state; // Keep the owning application state alive until cleanup ends.
    let _ = session
        .channel
        .send(json!({"type":"closed", "error":failure}));
    session.terminated.store(true, Ordering::Release);
    session.finished.notify_waiters();
}

async fn connect(
    state: Arc<HostState>,
    call: &Call,
    channel: Channel<Value>,
    app: Option<AppHandle>,
) -> Result<Value, HostError> {
    allowed(&call.params, &["fileId", "serverId", "expectedRevision"])?;
    let expected_revision = call
        .params
        .get("expectedRevision")
        .map(|_| crate::protocol::revision(&call.params, "expectedRevision"))
        .transpose()?;
    let project = call.project_id()?;
    let _serial = state.write_lock.lock().await;
    state.validate_scope(call)?;
    let _start = starts().lock().await;
    let path = state.resolve_file(project, string(&call.params, "fileId")?)?;
    let declaration = crate::extensions::language_server_for_file_at_revision(
        &state,
        project,
        &path,
        call.params["serverId"].as_str(),
        expected_revision,
    )?;
    let server = &declaration["server"];
    let extension = string(&declaration, "extensionId")?;
    let activation = string(&declaration, "activationId")?;
    let server_id = string(server, "id")?;
    let project_root = state.project_root(project)?;
    let root = workspace_root(
        &project_root,
        &path,
        server["rootMarkers"]
            .as_array()
            .map(Vec::as_slice)
            .unwrap_or(&[]),
    );
    let fingerprint = serde_json::to_string(&json!([server, activation]))?;
    let existing = sessions()
        .lock()
        .unwrap()
        .values()
        .find(|session| {
            session.owner == state.data_dir()
                && session.project == project
                && session.server == server_id
                && session.root == root
                && session.fingerprint == fingerprint
                && !session.stopping.load(Ordering::Acquire)
        })
        .cloned();
    let mut reply = json!({"serverId":server_id,"extensionId":extension,"revision":declaration["revision"],"rootUri":uri(&root)?,"fileUri":uri(&path)?,"languageId":declaration["languageId"],"initializationOptions":server.get("initializationOptions").cloned().unwrap_or_else(||json!({})),"settings":server.get("settings").cloned().unwrap_or_else(||json!({}))});
    if let Some(existing) = existing {
        reply["sessionId"] = json!(existing.id);
        reply["reused"] = json!(true);
        return Ok(reply);
    }
    let command_name = string(server, "command")?;
    let executable = crate::processes::executable(command_name).map_err(|_| HostError::new("DEPENDENCY_UNAVAILABLE", format!("找不到语言服务器 {command_name}；请安装服务程序，或在扩展设置中配置 server.{server_id}.command")))?;
    #[cfg(windows)]
    if executable.extension().is_some_and(|extension| {
        ["cmd", "bat"]
            .iter()
            .any(|value| extension.to_string_lossy().eq_ignore_ascii_case(value))
    }) {
        return Err(HostError::new("DEPENDENCY_UNAVAILABLE", format!("请在 server.{server_id}.command 中选择实际语言服务器 .exe；当前不运行 npm 的 .cmd/.bat 启动脚本")));
    }
    let args: Vec<_> = server["args"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let mut command = Command::new(&executable);
    command
        .args(&args)
        .current_dir(&root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    // Desktop launchers can have a smaller PATH than terminals. Retain the
    // configured executable directory and discovered Node for npm launchers.
    let mut paths = Vec::new();
    if let Some(parent) = executable.parent() {
        paths.push(parent.to_owned());
    }
    if let Ok(node) = crate::processes::executable("node") {
        if let Some(parent) = node.parent() {
            paths.push(parent.to_owned());
        }
    }
    paths.extend(std::env::split_paths(
        &std::env::var_os("PATH").unwrap_or_default(),
    ));
    if let Ok(path) = std::env::join_paths(paths) {
        command.env("PATH", path);
    }
    #[cfg(unix)]
    command.process_group(0);
    #[cfg(windows)]
    crate::windows_process::prepare_command(command.as_std_mut());
    let child = command
        .spawn()
        .map_err(|error| fail(format!("启动语言服务器 {command_name} 失败：{error}")))?;
    let pid = child
        .id()
        .ok_or_else(|| fail("无法取得语言服务器进程 ID"))?;
    #[cfg(windows)]
    let job = unsafe {
        crate::windows_process::attach_suspended(
            child
                .raw_handle()
                .ok_or_else(|| fail("无法取得语言服务器进程句柄"))?,
            pid,
        )
    }
    .map_err(|error| fail(error.to_string()))?;
    let (input, writes) = mpsc::channel(64);
    let session = Arc::new(Session {
        id: crate::state::id(),
        owner: state.data_dir().to_owned(),
        project: project.into(),
        extension: extension.into(),
        activation: activation.into(),
        server: server_id.into(),
        root,
        root_markers: server["rootMarkers"]
            .as_array()
            .cloned()
            .unwrap_or_default(),
        language_ids: server["languageIds"]
            .as_array()
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect(),
        fingerprint,
        pid,
        started: chrono::Utc::now().timestamp_millis().to_string(),
        app,
        channel,
        input,
        stopping: AtomicBool::new(false),
        force: AtomicBool::new(false),
        terminated: AtomicBool::new(false),
        stop: Notify::new(),
        finished: Notify::new(),
        shutdown_reply: Notify::new(),
        failure: Mutex::new(None),
    });
    sessions()
        .lock()
        .unwrap()
        .insert(session.id.clone(), session.clone());
    session.notify_change();
    reply["sessionId"] = json!(session.id);
    reply["reused"] = json!(false);
    tokio::spawn(serve(
        state.clone(),
        session,
        child,
        writes,
        #[cfg(windows)]
        job,
    ));
    Ok(reply)
}

fn owned_session(state: &HostState, project: &str, id: &str) -> Result<Arc<Session>, HostError> {
    let session = sessions()
        .lock()
        .unwrap()
        .get(id)
        .cloned()
        .ok_or_else(|| HostError::new("NOT_FOUND", "语言服务会话已结束"))?;
    if session.project != project || session.owner != state.data_dir() {
        return Err(HostError::new("PERMISSION_DENIED", "语言服务属于其他项目"));
    }
    Ok(session)
}
pub async fn dispatch(
    state: Arc<HostState>,
    call: Call,
    channel: Option<Channel<Value>>,
) -> Result<Value, HostError> {
    dispatch_inner(state, call, channel, None).await
}
pub async fn dispatch_with_app(
    state: Arc<HostState>,
    app: AppHandle,
    call: Call,
    channel: Option<Channel<Value>>,
) -> Result<Value, HostError> {
    dispatch_inner(state, call, channel, Some(app)).await
}
async fn dispatch_inner(
    state: Arc<HostState>,
    call: Call,
    channel: Option<Channel<Value>>,
    app: Option<AppHandle>,
) -> Result<Value, HostError> {
    let project = call.project_id()?;
    match call.method.as_str() {
        "language_server_document" => {
            allowed(&call.params, &["sessionId", "fileId"])?;
            let session = owned_session(&state, project, string(&call.params, "sessionId")?)?;
            if session.stopping.load(Ordering::Acquire) {
                return Err(fail("语言服务正在停止"));
            }
            let path = state.resolve_file(project, string(&call.params, "fileId")?)?;
            let root = state.project_root(project)?;
            if workspace_root(&root, &path, &session.root_markers) != session.root {
                return Ok(Value::Null);
            }
            let Some(language) = crate::extensions::language_id_for_file(&state, project, &path)?
            else {
                return Ok(Value::Null);
            };
            if !session.language_ids.contains(&language) {
                return Ok(Value::Null);
            }
            Ok(json!({"fileUri":uri(&path)?,"languageId":language}))
        }
        "language_server_connect" => {
            connect(
                state.clone(),
                &call,
                channel
                    .ok_or_else(|| HostError::new("INVALID_ARGUMENT", "语言服务需要消息通道"))?,
                app,
            )
            .await
        }
        "language_server_send" => {
            allowed(&call.params, &["sessionId", "message"])?;
            let session = owned_session(&state, project, string(&call.params, "sessionId")?)?;
            if session.stopping.load(Ordering::Acquire) {
                return Err(fail("语言服务正在停止"));
            }
            let message = string(&call.params, "message")?;
            if message.len() > MAX_MESSAGE {
                return Err(HostError::new("RESOURCE_LIMIT", "LSP 消息超过 32 MiB"));
            }
            session.write(message.into()).await?;
            Ok(json!({"sent":true}))
        }
        "language_server_stop" => {
            allowed(&call.params, &["sessionId"])?;
            let session = owned_session(&state, project, string(&call.params, "sessionId")?)?;
            session.request_stop();
            session.wait_finished().await?;
            Ok(json!({"stopped":true}))
        }
        "language_server_resolve" => {
            allowed(&call.params, &["uri"])?;
            let path = path_from_uri(string(&call.params, "uri")?)?;
            // Language tools may use an OS path alias (for example /var on
            // macOS). Apply the existing boundary to its actual file target.
            let path = if path.try_exists()? {
                path.canonicalize()?
            } else {
                path
            };
            let root = state.project_root(project)?;
            if path.starts_with(&root) {
                crate::state::ensure_inside(&root, &path)?;
                return state.file_ref(project, &path);
            }
            // A server URI alone does not create an external-file grant. Reuse
            // paths already authorized through the existing file picker.
            let file_id = {
                let registry = state.registry.lock().unwrap();
                registry
                    .paths
                    .iter()
                    .find(|(id, (owner, encoded))| {
                        owner == project
                            && registry.external_file_grants.contains(*id)
                            && crate::state::native_decode(encoded)
                                .is_ok_and(|registered| registered == path)
                    })
                    .map(|(id, _)| id.clone())
            };
            if let Some(file_id) = file_id {
                state.resolve_file(project, &file_id)?;
                return state.registered_file_ref(project, &file_id);
            }
            Err(HostError::new(
                "PERMISSION_DENIED",
                "跳转目标位于项目外；请先通过文件选择器打开并授权该文件",
            ))
        }
        _ => Err(HostError::new("INVALID_ARGUMENT", "未知语言服务操作")),
    }
}
pub fn resources(project: Option<&str>) -> Vec<Value> {
    sessions().lock().unwrap().values().filter(|session| project.is_none_or(|project|session.project == project)).map(|session| json!({"id":session.id,"resourceId":session.id,"kind":"languageServer","type":"languageServer","projectId":session.project,"extensionId":session.extension,"ownerExtensionId":session.extension,"requiresExtensions":[session.extension],"activationId":session.activation,"title":format!("{} 语言服务",session.server),"pid":session.pid,"state":if session.stopping.load(Ordering::Acquire){"stopping"}else{"running"},"actions":["stop"]})).collect()
}
pub fn process_snapshot(project: Option<&str>) -> Vec<Value> {
    sessions().lock().unwrap().values().filter(|session|project.is_none_or(|project|session.project == project)).map(|session|json!({
        "processInstanceId":session.id,"kind":"languageServer","terminalSessionId":null,
        "owner":{"projectId":session.project,"extensionId":session.extension,"activationId":session.activation,"launchRunId":null},
        "ownership":"owned","state":if session.stopping.load(Ordering::Acquire){"stopping"}else{"running"},
        "revision":1,"pid":session.pid,"startedAt":session.started,"exitCode":null,
        "title":format!("{} 语言服务",session.server),"cwd":session.root.to_string_lossy(),"bufferStart":"0","bufferEnd":"0"
    })).collect()
}
pub async fn stop_process(
    state: &HostState,
    id: &str,
    project: Option<&str>,
    force: bool,
) -> Result<Option<Value>, HostError> {
    let session = sessions().lock().unwrap().get(id).cloned();
    let Some(session) = session else {
        return Ok(None);
    };
    if session.owner != state.data_dir()
        || project.is_some_and(|project| session.project != project)
    {
        return Err(HostError::new("PERMISSION_DENIED", "语言服务属于其他项目"));
    }
    if force {
        session.force.store(true, Ordering::Release);
    }
    session.request_stop();
    session.wait_finished().await?;
    Ok(Some(json!({"exited":true,"forced":force})))
}
pub fn resource_count(extension: &str, project: Option<&str>) -> usize {
    sessions()
        .lock()
        .unwrap()
        .values()
        .filter(|session| {
            session.extension == extension
                && project.is_none_or(|project| session.project == project)
        })
        .count()
}
async fn stop_matching(extension: Option<&str>, project: Option<&str>) -> Result<(), HostError> {
    let matches: Vec<_> = sessions()
        .lock()
        .unwrap()
        .values()
        .filter(|session| {
            extension.is_none_or(|extension| session.extension == extension)
                && project.is_none_or(|project| session.project == project)
        })
        .cloned()
        .collect();
    for session in &matches {
        session.request_stop();
    }
    for session in matches {
        session.wait_finished().await?;
    }
    Ok(())
}
pub async fn stop_extension(extension: &str, project: Option<&str>) -> Result<(), HostError> {
    stop_matching(Some(extension), project).await
}
pub async fn stop_resources(project: Option<&str>) -> Result<(), HostError> {
    stop_matching(None, project).await
}

#[cfg(test)]
mod wire_tests {
    use super::*;

    #[tokio::test]
    async fn fragmented_frames_preserve_unicode_and_message_boundaries() {
        let (mut write, read) = tokio::io::duplex(17);
        let first = r#"{"jsonrpc":"2.0","result":"中文😀"}"#;
        let second = r#"{"jsonrpc":"2.0","result":null}"#;
        let bytes = format!("Content-Length: {}\r\nContent-Type: application/vscode-jsonrpc; charset=utf-8\r\n\r\n{first}Content-Length: {}\r\n\r\n{second}",first.len(),second.len()).into_bytes();
        let sender = tokio::spawn(async move {
            for byte in bytes {
                write.write_all(&[byte]).await.unwrap();
                tokio::task::yield_now().await;
            }
        });
        let mut read = BufReader::new(read);
        assert_eq!(read_frame(&mut read).await.unwrap().as_deref(), Some(first));
        assert_eq!(
            read_frame(&mut read).await.unwrap().as_deref(),
            Some(second)
        );
        assert!(read_frame(&mut read).await.unwrap().is_none());
        sender.await.unwrap();
    }

    #[tokio::test]
    async fn framing_uses_utf8_byte_length() {
        let body = "中文😀";
        let mut output = Vec::new();
        write_frame(&mut output, body).await.unwrap();
        assert_eq!(
            output,
            b"Content-Length: 10\r\n\r\n\xe4\xb8\xad\xe6\x96\x87\xf0\x9f\x98\x80"
        );
    }

    #[tokio::test]
    async fn invalid_or_truncated_frames_fail_without_reading_an_unbounded_body() {
        for bytes in [
            b"Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}".to_vec(),
            b"Content-Length: -1\r\n\r\n".to_vec(),
            b"Content-Length: 33554433\r\n\r\n".to_vec(),
            b"Content-Type: text/plain\r\n\r\n{}".to_vec(),
            b"Content-Length: 4\r\n\r\n{}".to_vec(),
            b"Content-Length: 1\r\n\r\n\xff".to_vec(),
            vec![b'x'; MAX_HEADER + 1],
        ] {
            assert!(read_frame(&mut BufReader::new(bytes.as_slice()))
                .await
                .is_err());
        }
    }

    #[test]
    fn workspace_root_shares_nested_packages_but_stays_inside_project() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path();
        std::fs::create_dir_all(root.join("packages/one/src")).unwrap();
        std::fs::write(root.join("package.json"), "{}").unwrap();
        std::fs::write(root.join("packages/one/tsconfig.json"), "{}").unwrap();
        let markers = vec![json!("package.json"), json!("tsconfig.json")];
        assert_eq!(
            workspace_root(root, &root.join("packages/one/src/a.ts"), &markers),
            root
        );
        assert_eq!(
            workspace_root(root, &directory.path().join("../outside.ts"), &markers),
            root
        );
    }
}
