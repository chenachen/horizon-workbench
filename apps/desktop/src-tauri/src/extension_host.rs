//! Per-activation QuickJS processes. The pipe, not JavaScript payloads, owns identity.
use crate::{Call, HostError, HostState};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    io::{Read, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex, OnceLock,
    },
    thread,
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle, Emitter};
use tokio::sync::oneshot;

const MAX_FRAME: usize = 1024 * 1024;
const EVENT: &str = "horizon:extension:runtime:v1";
type Response = Result<Value, HostError>;
struct Session {
    extension_id: String,
    activation_id: String,
    project_id: Option<String>,
    scope: Value,
    epoch: String,
    digest: String,
    manifest: Value,
    child: Mutex<Child>,
    #[cfg(windows)]
    job: Option<Arc<crate::windows_process::OwnedJob>>,
    input: Mutex<ChildStdin>,
    pending: Mutex<BTreeMap<String, oneshot::Sender<Response>>>,
    commands: Mutex<BTreeSet<String>>,
    stopping: AtomicBool,
    ready: AtomicBool,
    failure_reported: AtomicBool,
    closed: AtomicBool,
    broker_pending: AtomicUsize,
    #[cfg(test)]
    fail_next_terminate: AtomicBool,
}
fn sessions() -> &'static Mutex<BTreeMap<String, Arc<Session>>> {
    static SESSIONS: OnceLock<Mutex<BTreeMap<String, Arc<Session>>>> = OnceLock::new();
    SESSIONS.get_or_init(Default::default)
}
fn key(id: &str, project: Option<&str>) -> String {
    format!("{id}\0{}", project.unwrap_or("@app"))
}
fn error(message: impl Into<String>) -> HostError {
    HostError::new("EXTENSION_FAILED", message)
}
fn string<'a>(value: &'a Value, field: &str) -> Result<&'a str, HostError> {
    crate::protocol::string(value, field)
}
fn write_frame(writer: &mut impl Write, frame: &Value) -> Result<(), HostError> {
    let bytes = serde_json::to_vec(frame)?;
    if bytes.len() > MAX_FRAME {
        return Err(HostError::new("RESOURCE_LIMIT", "扩展消息超过 1 MiB"));
    }
    writer.write_all(&(bytes.len() as u32).to_be_bytes())?;
    writer.write_all(&bytes)?;
    writer.flush()?;
    Ok(())
}
fn read_frame(reader: &mut impl Read) -> Result<Value, HostError> {
    let mut length = [0; 4];
    reader.read_exact(&mut length)?;
    let length = u32::from_be_bytes(length) as usize;
    if length == 0 || length > MAX_FRAME {
        return Err(error("扩展协议帧长度无效"));
    }
    let mut bytes = vec![0; length];
    reader.read_exact(&mut bytes)?;
    Ok(serde_json::from_slice(&bytes)?)
}
fn executable() -> Result<PathBuf, HostError> {
    let current = std::env::current_exe()?;
    let bundled = current.parent().unwrap().join(format!("horizon-extension-host{}", std::env::consts::EXE_SUFFIX));
    if bundled.is_file() {
        return Ok(bundled);
    }
    #[cfg(debug_assertions)]
    for profile in ["debug", "release"] {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(format!(
            "../../extension-host/target/{profile}/horizon-extension-host{}", std::env::consts::EXE_SUFFIX
        ));
        if path.is_file() {
            return Ok(path);
        }
    }
    Err(HostError::new(
        "NOT_FOUND",
        "QuickJS 扩展宿主缺失，请重新构建或安装 Horizon",
    ))
}
impl Session {
    fn send(&self, frame: Value) -> Result<(), HostError> {
        if self.closed.load(Ordering::Acquire) {
            return Err(error("扩展宿主已退出"));
        }
        write_frame(&mut *self.input.lock().unwrap(), &frame)
    }
    async fn request(&self, method: &str, params: Value) -> Response {
        if self.stopping.load(Ordering::Acquire) {
            return Err(HostError::new("STALE_SCOPE", "扩展正在停止"));
        }
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = oneshot::channel();
        self.pending.lock().unwrap().insert(id.clone(), tx);
        if let Err(error)=self.send(json!({"type":"request","id":id,"activationHandle":self.activation_id,"method":method,"params":params})) {
            self.pending.lock().unwrap().remove(&id); return Err(error);
        }
        let result = tokio::time::timeout(Duration::from_secs(31), rx).await;
        self.pending.lock().unwrap().remove(&id);
        match result {
            Ok(Ok(value)) => value,
            Ok(Err(_)) => Err(error("扩展宿主已断开")),
            Err(_) => {
                self.terminate()?;
                Err(error("扩展运行超时，宿主已回收"))
            }
        }
    }
    fn terminate(&self) -> Result<(), HostError> {
        let mut child = self.child.lock().unwrap();
        #[cfg(not(windows))]
        {
        if child.try_wait()?.is_none() {
            #[cfg(test)]
            if self.fail_next_terminate.swap(false, Ordering::AcqRel) {
                return Err(HostError::new("CLEANUP_FAILED", "测试注入：本次终止失败，进程仍存活"));
            }
            if let Err(kill_error) = child.kill() {
                if child.try_wait()?.is_none() {
                    return Err(HostError::new("CLEANUP_FAILED", kill_error.to_string()));
                }
            }
        }
        child.wait()?;
        }
        #[cfg(windows)]
        {
            #[cfg(test)]
            if child.try_wait()?.is_none() && self.fail_next_terminate.swap(false, Ordering::AcqRel) {
                return Err(HostError::new("CLEANUP_FAILED", "测试注入：本次终止失败，进程仍存活"));
            }
            if let Some(job) = &self.job { job.terminate().map_err(|e| HostError::new("CLEANUP_FAILED", e.to_string()))?; }
            else if child.try_wait()?.is_none() {
                if let Err(error) = child.kill() {
                    if child.try_wait()?.is_none() { return Err(HostError::new("CLEANUP_FAILED", error.to_string())); }
                }
            }
            let started = std::time::Instant::now();
            loop {
                let root_done = child.try_wait()?.is_some();
                let tree_done = self.job.as_ref().is_none_or(|job| job.is_empty().unwrap_or(false));
                if root_done && tree_done { break; }
                if started.elapsed() >= Duration::from_secs(3) {
                    return Err(HostError::new("CLEANUP_FAILED", "Windows扩展自有Job清退尚未确认；实例记录已保留"));
                }
                thread::sleep(Duration::from_millis(20));
            }
            child.wait()?;
        }
        self.closed.store(true, Ordering::Release);
        for (_, sender) in std::mem::take(&mut *self.pending.lock().unwrap()) {
            let _ = sender.send(Err(error("扩展宿主已停止")));
        }
        Ok(())
    }
    fn emit(&self, app: &AppHandle, kind: &str, data: Value) {
        let _=app.emit(EVENT,json!({"extensionId":self.extension_id,"activationId":self.activation_id,"projectId":self.project_id,"event":kind,"data":data}));
    }
    fn report_failure(&self, state: &HostState, app: &AppHandle, message: &str) {
        if self.failure_reported.swap(true, Ordering::AcqRel) {
            return;
        }
        self.ready.store(false, Ordering::Release);
        let _ = crate::extensions::runtime_failed(
            state,
            app,
            &self.extension_id,
            &self.activation_id,
            self.project_id.as_deref(),
            message,
        );
        self.emit(app, "failed", json!({"message":message}));
    }
}
fn validate_event(session: &Session, frame: &Value) -> Result<(), HostError> {
    let data = &frame["data"];
    let id = string(data, "id")?;
    match frame["event"].as_str() {
        Some("command" | "commandRemove") => {
            if !session.manifest["contributes"]["commands"]
                .as_array()
                .is_some_and(|commands| commands.iter().any(|item| item["id"] == id))
            {
                return Err(error("扩展命令未声明"));
            }
            if frame["event"] == "command" {
                session.commands.lock().unwrap().insert(id.to_string());
            } else {
                session.commands.lock().unwrap().remove(id);
            }
        }
        Some("view" | "viewRemove") => {
            if !session.manifest["contributes"]["views"]
                .as_array()
                .is_some_and(|views| {
                    views
                        .iter()
                        .any(|item| item["id"] == id && item["renderer"] == "declarative")
                })
            {
                return Err(error("扩展视图未声明"));
            }
            if frame["event"] == "view" {
                let view = &data["view"];
                if !matches!(view["kind"].as_str(), Some("list" | "text" | "tree"))
                    || !view["title"].is_string()
                    || !view["items"].as_array().is_some_and(|items| {
                        items.len() <= 2000
                            && items
                                .iter()
                                .all(|item| item["id"].is_string() && item["label"].is_string())
                    })
                {
                    return Err(error("扩展视图数据无效"));
                }
            }
        }
        _ => return Err(error("未知扩展事件")),
    }
    Ok(())
}
fn read_session(
    state: Arc<HostState>,
    app: AppHandle,
    session: Arc<Session>,
    mut output: impl Read,
) {
    let mut execution_error = None;
    let outcome = (|| -> Result<(), HostError> {
        let hello = read_frame(&mut output)?;
        if hello["type"] != "hello"
            || hello["protocolVersion"] != 1
            || hello["hostEpoch"] != session.epoch
            || hello["packageDigest"] != session.digest
        {
            return Err(error("扩展宿主握手不匹配"));
        }
        let mut sequence = 0;
        loop {
            let frame = read_frame(&mut output)?;
            match frame["type"].as_str() {
                Some("reply") => {
                    let id = string(&frame, "id")?;
                    if frame["result"]["requestId"] != id {
                        return Err(error("扩展响应 ID 不匹配"));
                    }
                    let sender = session.pending.lock().unwrap().remove(id);
                    if let Some(sender) = sender {
                        let result = if frame["result"]["ok"] == true {
                            Ok(frame["result"]["data"].clone())
                        } else {
                            let failure: HostError =
                                serde_json::from_value(frame["result"]["error"].clone())
                                    .unwrap_or_else(|_| error("扩展执行失败"));
                            if failure.code != "RESOURCE_BUSY" {
                                execution_error = Some(failure.clone());
                                // Record before replying: UI cleanup must not hide an activation failure.
                                session.report_failure(&state, &app, &failure.message);
                            }
                            Err(failure)
                        };
                        let _ = sender.send(result);
                    }
                }
                Some("request") => {
                    if frame["activationHandle"] != session.activation_id
                        || session.stopping.load(Ordering::Acquire)
                    {
                        return Err(error("扩展租约已失效"));
                    }
                    let method = string(&frame, "method")?.to_string();
                    let id = string(&frame, "id")?.to_string();
                    if ![
                        "project.read",
                        "git.status",
                        "storage.get",
                        "storage.set",
                        "settings.get",
                    ]
                    .contains(&method.as_str())
                    {
                        return Err(error("扩展 SDK 方法未开放"));
                    }
                    if session.broker_pending.fetch_add(1, Ordering::AcqRel) >= 32 {
                        session.broker_pending.fetch_sub(1, Ordering::AcqRel);
                        return Err(error("扩展并发请求超过 32"));
                    }
                    let owned = session.clone();
                    let state = state.clone();
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        // JS cannot choose these fields; every call retains the activation's original scope.
                        let call = Call {
                            protocol_version: 1,
                            request_id: uuid::Uuid::new_v4().to_string(),
                            method: "extension_sdk_call".into(),
                            scope: owned.scope.clone(),
                            params: json!({"extensionId":owned.extension_id,"activationId":owned.activation_id,"method":method,"params":frame["params"]}),
                            idempotency_key: None,
                        };
                        let result = crate::extensions::broker_call(state, app, call).await;
                        owned.broker_pending.fetch_sub(1, Ordering::AcqRel);
                        if !owned.stopping.load(Ordering::Acquire) {
                            let _=owned.send(json!({"type":"reply","id":id,"result":crate::protocol::reply(&id,result)}));
                        }
                    });
                }
                Some("event") => {
                    if frame["activationHandle"] != session.activation_id {
                        return Err(error("扩展事件租约不匹配"));
                    }
                    let seq = frame["seq"]
                        .as_u64()
                        .ok_or_else(|| error("扩展事件缺少序号"))?;
                    if seq <= sequence {
                        return Err(error("扩展事件序号重复"));
                    }
                    sequence = seq;
                    validate_event(&session, &frame)?;
                    if !session.stopping.load(Ordering::Acquire) {
                        session.emit(&app, string(&frame, "event")?, frame["data"].clone());
                    }
                }
                Some("disposed") => {
                    if frame["activationHandle"] != session.activation_id
                        || frame["remainingLeaseIds"] != json!([])
                    {
                        return Err(error("扩展资源未完整释放"));
                    }
                    return Ok(());
                }
                _ => return Err(error("未知扩展协议消息")),
            }
        }
    })();
    let intentionally_stopped = session.stopping.load(Ordering::Acquire);
    let termination = session.terminate();
    let session_key = key(&session.extension_id, session.project_id.as_deref());
    let mut registry = sessions().lock().unwrap();
    if registry
        .get(&session_key)
        .is_some_and(|current| Arc::ptr_eq(current, &session))
    {
        registry.remove(&session_key);
    }
    drop(registry);
    if !intentionally_stopped {
        let message = termination
            .err()
            .or(execution_error)
            .or(outcome.err())
            .map(|error| error.message)
            .unwrap_or_else(|| "扩展宿主意外退出".into());
        session.report_failure(&state, &app, &message);
    }
}

async fn start_session(
    state: Arc<HostState>,
    app: AppHandle,
    call: &Call,
    entry: Value,
) -> Response {
    let id = string(&call.params, "extensionId")?;
    let activation = string(&call.params, "activationId")?;
    let project = call.scope["projectId"].as_str();
    let session_key = key(id, project);
    if let Some(existing) = sessions().lock().unwrap().get(&session_key) {
        if existing.activation_id == activation
            && existing.ready.load(Ordering::Acquire)
            && !existing.closed.load(Ordering::Acquire)
        {
            return Ok(
                json!({"active":true,"manifest":existing.manifest,"pid":existing.child.lock().unwrap().id(),"heapLimitBytes":32*1024*1024}),
            );
        }
        return Err(HostError::new("RESOURCE_BUSY", "旧扩展实例尚未停止"));
    }
    let digest = string(&entry, "packageDigest")?.to_string();
    let mut command = Command::new(executable()?);
    command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null()).env_clear();
    #[cfg(windows)]
    {
        for key in ["SystemRoot", "WINDIR", "TEMP", "TMP"] {
            if let Some(value) = std::env::var_os(key) { command.env(key, value); }
        }
        crate::windows_process::prepare_command(&mut command);
    }
    let mut child = command.spawn()?;
    #[cfg(windows)]
    let (job, spawn_error) = {
        use std::os::windows::io::AsRawHandle;
        match unsafe { crate::windows_process::attach_suspended(child.as_raw_handle(), child.id()) } {
            Ok(job) => (Some(job), None),
            Err(error) => {
                if child.try_wait()?.is_some() { return Err(HostError::new("EXTENSION_FAILED", error.to_string())); }
                (None, Some(error))
            }
        }
    };
    let input = child.stdin.take().unwrap();
    let output = child.stdout.take().unwrap();
    let pid = child.id();
    let session = Arc::new(Session {
        extension_id: id.into(),
        activation_id: activation.into(),
        project_id: project.map(str::to_string),
        scope: call.scope.clone(),
        epoch: uuid::Uuid::new_v4().to_string(),
        digest,
        manifest: entry["manifest"].clone(),
        child: Mutex::new(child),
        #[cfg(windows)]
        job,
        input: Mutex::new(input),
        pending: Mutex::default(),
        commands: Mutex::default(),
        stopping: AtomicBool::new(false),
        ready: AtomicBool::new(false),
        failure_reported: AtomicBool::new(false),
        closed: AtomicBool::new(false),
        broker_pending: AtomicUsize::new(0),
        #[cfg(test)]
        fail_next_terminate: AtomicBool::new(false),
    });
    {
        let mut registry = sessions().lock().unwrap();
        if registry.contains_key(&session_key) {
            session.terminate()?;
            return Err(HostError::new("RESOURCE_BUSY", "扩展正在激活"));
        }
        registry.insert(session_key, session.clone());
    }
    #[cfg(windows)]
    if let Some(error) = spawn_error {
        session.stopping.store(true, Ordering::Release);
        return Err(HostError::new("CLEANUP_FAILED", format!("{error}; 自有扩展PID {pid} 清退未确认，实例记录已保留")));
    }
    let owned = session.clone();
    let reader_state = state.clone();
    let reader_app = app.clone();
    thread::spawn(move || read_session(reader_state, reader_app, owned, output));
    let result=async {
        // Revalidate after insertion: a concurrent disable cannot miss the new process.
        let mut check=call.clone(); check.method="extension_entry".into();
        Box::pin(crate::extensions::dispatch(state,app.clone(),check,None)).await?;
        session.send(json!({"type":"hello","protocolVersion":1,"hostEpoch":session.epoch,"packageDigest":session.digest}))?;
        session.request("activate",json!({"source":entry["source"],"manifest":entry["manifest"]})).await?;
        session.ready.store(true,Ordering::Release);
        let _=app.emit("horizon:extension:v1",json!({"extensionId":session.extension_id}));
        Ok(json!({"active":true,"pid":pid,"manifest":entry["manifest"],"heapLimitBytes":32*1024*1024}))
    }.await;
    if result.is_err() {
        session.terminate()?;
    }
    result
}

async fn stop_sessions(targets: Vec<Arc<Session>>) -> Result<(), HostError> {
    for session in targets {
        session.stopping.store(true, Ordering::Release);
        let _ = session.send(
            json!({"type":"dispose","activationHandle":session.activation_id,"reason":"stop"}),
        );
        let owned = session.clone();
        tauri::async_runtime::spawn_blocking(move || {
            for _ in 0..25 {
                if owned.closed.load(Ordering::Acquire) {
                    break;
                }
                if owned
                    .child
                    .lock()
                    .unwrap()
                    .try_wait()
                    .ok()
                    .flatten()
                    .is_some()
                {
                    break;
                }
                thread::sleep(Duration::from_millis(20));
            }
            owned.terminate()
        })
        .await
        .map_err(|error| HostError::new("CLEANUP_FAILED", error.to_string()))??;
        let mut registry = sessions().lock().unwrap();
        let session_key = key(&session.extension_id, session.project_id.as_deref());
        if registry
            .get(&session_key)
            .is_some_and(|current| Arc::ptr_eq(current, &session))
        {
            registry.remove(&session_key);
        }
    }
    Ok(())
}
pub async fn stop(id: &str, project: Option<&str>) -> Result<(), HostError> {
    let targets = sessions()
        .lock()
        .unwrap()
        .values()
        .filter(|session| {
            session.extension_id == id
                && project.is_none_or(|project| session.project_id.as_deref() == Some(project))
        })
        .cloned()
        .collect();
    stop_sessions(targets).await
}
pub async fn stop_all() -> Result<(), HostError> {
    let targets = sessions().lock().unwrap().values().cloned().collect();
    stop_sessions(targets).await
}
pub async fn stop_project(project: &str) -> Result<(), HostError> {
    let targets = sessions()
        .lock()
        .unwrap()
        .values()
        .filter(|session| session.project_id.as_deref() == Some(project))
        .cloned()
        .collect();
    stop_sessions(targets).await
}
pub fn resource_count(id: &str, project: Option<&str>) -> usize {
    sessions()
        .lock()
        .unwrap()
        .values()
        .filter(|session| {
            session.extension_id == id
                && project.is_none_or(|project| session.project_id.as_deref() == Some(project))
                && !session.closed.load(Ordering::Acquire)
        })
        .count()
}
pub fn ready_count(id: &str, project: Option<&str>) -> usize {
    sessions()
        .lock()
        .unwrap()
        .values()
        .filter(|session| {
            session.extension_id == id
                && project.is_none_or(|project| session.project_id.as_deref() == Some(project))
                && session.ready.load(Ordering::Acquire)
                && !session.stopping.load(Ordering::Acquire)
                && !session.closed.load(Ordering::Acquire)
        })
        .count()
}
pub fn resources(project: Option<&str>) -> Vec<Value> {
    sessions().lock().unwrap().values().filter(|session|project.is_none_or(|project|session.project_id.as_deref()==Some(project))&&!session.closed.load(Ordering::Acquire)).map(|session|json!({"resourceId":format!("extension-runtime:{}",session.activation_id),"ownerExtensionId":session.extension_id,"activationId":session.activation_id,"projectId":session.project_id,"kind":"extensionRuntime","state":if session.stopping.load(Ordering::Acquire){"stopping"}else{"running"},"pid":session.child.lock().unwrap().id(),"actions":["stop"],"label":format!("{} · QuickJS",session.extension_id)})).collect()
}

pub async fn dispatch(
    state: Arc<HostState>,
    app: AppHandle,
    call: Call,
    _channel: Option<Channel<Value>>,
) -> Response {
    let id = string(&call.params, "extensionId")?;
    let project = call.scope["projectId"].as_str();
    match call.method.as_str() {
        "extension_runtime_activate" => {
            let mut entry_call = call.clone();
            entry_call.method = "extension_entry".into();
            let entry = Box::pin(crate::extensions::dispatch(
                state.clone(),
                app.clone(),
                entry_call,
                None,
            ))
            .await?;
            let result = start_session(state.clone(), app.clone(), &call, entry).await;
            if let Err(failure) = &result {
                if failure.code != "RESOURCE_BUSY" {
                    let _ = crate::extensions::runtime_failed(
                        &state,
                        &app,
                        id,
                        string(&call.params, "activationId")?,
                        project,
                        &failure.message,
                    );
                }
            }
            result
        }
        "extension_runtime_execute" => {
            let activation = string(&call.params, "activationId")?;
            if crate::extensions::activation_id(&state, id, project)? != activation {
                return Err(HostError::new("STALE_SCOPE", "扩展激活已撤销"));
            }
            let session = sessions()
                .lock()
                .unwrap()
                .get(&key(id, project))
                .cloned()
                .ok_or_else(|| HostError::new("STALE_SCOPE", "扩展未激活"))?;
            if session.activation_id != activation {
                return Err(HostError::new("STALE_SCOPE", "扩展激活已过期"));
            }
            if !session.ready.load(Ordering::Acquire) {
                return Err(HostError::new("RESOURCE_BUSY", "扩展正在激活"));
            }
            let command = string(&call.params, "commandId")?;
            if !session.commands.lock().unwrap().contains(command) {
                return Err(HostError::new("NOT_FOUND", "扩展命令未注册"));
            }
            let result = session
                .request(
                    "execute",
                    json!({"commandId":command,"args":call.params["args"]}),
                )
                .await;
            if let Err(failure) = &result {
                if !["RESOURCE_BUSY", "STALE_SCOPE"].contains(&failure.code.as_str()) {
                    session.report_failure(&state, &app, &failure.message);
                    session.terminate()?;
                }
            }
            result
        }
        "extension_runtime_stop" => {
            let activation = string(&call.params, "activationId")?;
            let session = sessions()
                .lock()
                .unwrap()
                .get(&key(id, project))
                .filter(|session| session.activation_id == activation)
                .cloned();
            if let Some(session) = session {
                stop_sessions(vec![session]).await?;
            }
            Ok(json!({"stopped":true}))
        }
        _ => Err(HostError::new("NOT_FOUND", "未知扩展宿主方法")),
    }
}

#[cfg(test)]
pub(crate) mod test_support {
    use super::*;
    use std::{process::ChildStdout, sync::mpsc};

    // Only setup is test-specific. Stop, resource accounting and kill/wait use the
    // production Session after a real QuickJS hello and successful activation.
    pub(crate) struct StalledDeactivateSession {
        session: Arc<Session>,
        _output: Option<ChildStdout>,
    }

    impl StalledDeactivateSession {
        pub(crate) fn start(id: &str, activation: &str, project: &str, manifest: Value) -> Result<Self, HostError> {
            let mut child = Command::new(executable()?)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .env_clear()
                .spawn()?;
            let input = child.stdin.take().unwrap();
            let mut output = child.stdout.take().unwrap();
            let session = Arc::new(Session {
                extension_id: id.into(),
                activation_id: activation.into(),
                project_id: Some(project.into()),
                scope: json!({"projectId":project}),
                epoch: uuid::Uuid::new_v4().to_string(),
                digest: "ext-009-stalled-deactivate-fixture".into(),
                manifest: manifest.clone(),
                child: Mutex::new(child),
                #[cfg(windows)]
                job: None,
                input: Mutex::new(input),
                pending: Mutex::default(),
                commands: Mutex::default(),
                stopping: AtomicBool::new(false),
                ready: AtomicBool::new(false),
                failure_reported: AtomicBool::new(false),
                closed: AtomicBool::new(false),
                broker_pending: AtomicUsize::new(0),
                fail_next_terminate: AtomicBool::new(false),
            });
            let mut fixture = Self { session, _output: None };
            let hello = json!({"type":"hello","protocolVersion":1,"hostEpoch":fixture.session.epoch,"packageDigest":fixture.session.digest});
            let (tx, rx) = mpsc::channel();
            thread::spawn(move || {
                let frames = (|| -> Result<(Value, Value), HostError> {
                    Ok((read_frame(&mut output)?, read_frame(&mut output)?))
                })();
                let _ = tx.send((frames, output));
            });
            fixture.session.send(hello.clone())?;
            fixture.session.send(json!({
                "type":"request", "id":"ext-009-activate", "activationHandle":activation,
                "method":"activate", "params":{
                    "source":"export function activate() {}\nexport function deactivate() { return new Promise(() => {}); }",
                    "manifest":manifest
                }
            }))?;
            let (frames, output) = rx.recv_timeout(Duration::from_secs(5))
                .map_err(|_| error("测试 QuickJS 握手或激活超时"))?;
            fixture._output = Some(output);
            let (received_hello, activated) = frames?;
            if received_hello != hello || activated["type"] != "reply"
                || activated["id"] != "ext-009-activate"
                || activated["result"]["ok"] != true
                || activated["result"]["data"]["active"] != true
            {
                return Err(error(format!("测试 QuickJS 握手或激活失败: {activated}")));
            }
            fixture.session.ready.store(true, Ordering::Release);
            let mut registry = sessions().lock().unwrap();
            let session_key = key(id, Some(project));
            if registry.contains_key(&session_key) {
                return Err(error("测试扩展实例已存在"));
            }
            registry.insert(session_key, fixture.session.clone());
            drop(registry);
            Ok(fixture)
        }

        pub(crate) fn fail_next_terminate(&self) {
            self.session.fail_next_terminate.store(true, Ordering::Release);
        }

        pub(crate) fn pid(&self) -> u32 {
            self.session.child.lock().unwrap().id()
        }

        pub(crate) fn is_alive(&self) -> bool {
            self.session.child.lock().unwrap().try_wait().unwrap().is_none()
        }
    }

    impl Drop for StalledDeactivateSession {
        fn drop(&mut self) {
            self.session.fail_next_terminate.store(false, Ordering::Release);
            let _ = self.session.terminate();
            let session_key = key(&self.session.extension_id, self.session.project_id.as_deref());
            let mut registry = sessions().lock().unwrap();
            if registry.get(&session_key).is_some_and(|current| Arc::ptr_eq(current, &self.session)) {
                registry.remove(&session_key);
            }
        }
    }
}
