//! Git extension transport. Git parsing and mutations live in the independently
//! packaged horizon-git sidecar, not in the host binary.
use crate::{Call, HostError, HostState};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
    time::Duration,
};
use tauri::{ipc::Channel, AppHandle};
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    process::Command,
    sync::Mutex as AsyncMutex,
};

#[derive(Clone)]
struct Lease {
    pid: u32,
    project_id: Option<String>,
    request_id: String,
    method: String,
    #[cfg(windows)]
    job: Option<Arc<crate::windows_process::OwnedJob>>,
}
static PROCESSES: OnceLock<Mutex<HashMap<u32, Lease>>> = OnceLock::new();
static REPO_LOCKS: OnceLock<Mutex<HashMap<String, Arc<AsyncMutex<()>>>>> = OnceLock::new();
static REVOKED_REQUESTS: OnceLock<Mutex<HashMap<String, std::time::Instant>>> = OnceLock::new();
fn processes() -> &'static Mutex<HashMap<u32, Lease>> {
    PROCESSES.get_or_init(Default::default)
}
fn lock_repo(key: &str) -> Arc<AsyncMutex<()>> {
    REPO_LOCKS
        .get_or_init(Default::default)
        .lock()
        .unwrap()
        .entry(key.to_owned())
        .or_default()
        .clone()
}
pub fn resource_snapshot(project_id: Option<&str>) -> Vec<Value> {
    processes().lock().unwrap().values().filter(|p|project_id.is_none()||p.project_id.as_deref()==project_id).map(|p|json!({"resourceId":format!("git-process-{}",p.pid),"ownerExtensionId":"horizon.git","kind":"git","state":"running","pid":p.pid,"projectId":p.project_id,"requestId":p.request_id,"method":p.method,"actions":["stop"]})).collect()
}
#[cfg(unix)]
fn signal(pid: u32, signal: i32) {
    unsafe {
        libc::kill(-(pid as i32), signal);
    }
}
pub async fn stop_resources(project_id: Option<&str>) -> Result<(), HostError> {
    let ids = processes()
        .lock()
        .unwrap()
        .values()
        .filter(|p| project_id.is_none() || p.project_id.as_deref() == project_id)
        .map(|p| p.pid)
        .collect::<Vec<_>>();
    stop_pids(ids).await
}
pub async fn stop_requests(request_ids: &[String]) -> Result<(), HostError> {
    {
        let mut revoked = REVOKED_REQUESTS
            .get_or_init(Default::default)
            .lock()
            .unwrap();
        revoked.retain(|_, at| at.elapsed().as_secs() < 600);
        for id in request_ids {
            revoked.insert(id.clone(), std::time::Instant::now());
        }
    }
    let pids = processes()
        .lock()
        .unwrap()
        .values()
        .filter(|p| request_ids.contains(&p.request_id))
        .map(|p| p.pid)
        .collect::<Vec<_>>();
    stop_pids(pids).await
}
fn request_revoked(id: &str) -> bool {
    REVOKED_REQUESTS
        .get_or_init(Default::default)
        .lock()
        .unwrap()
        .contains_key(id)
}
struct RequestGuard(String);
impl Drop for RequestGuard {
    fn drop(&mut self) {
        REVOKED_REQUESTS
            .get_or_init(Default::default)
            .lock()
            .unwrap()
            .remove(&self.0);
    }
}
async fn stop_pids(ids: Vec<u32>) -> Result<(), HostError> {
    for pid in &ids {
        request_stop(*pid, false)?;
    }
    for _ in 0..20 {
        if ids
            .iter()
            .all(|p| !processes().lock().unwrap().contains_key(p))
        {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    for pid in &ids {
        request_stop(*pid, true)?;
    }
    for _ in 0..20 {
        if ids
            .iter()
            .all(|p| !processes().lock().unwrap().contains_key(p))
        {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Err(HostError::new(
        "RESOURCE_BUSY",
        "Git 进程尚未退出，请重试停止",
    ))
}
struct LeaseGuard {
    pid: u32,
    #[cfg(windows)]
    job: Arc<crate::windows_process::OwnedJob>,
}
impl Drop for LeaseGuard {
    fn drop(&mut self) {
        #[cfg(unix)]
        processes().lock().unwrap().remove(&self.pid);
        #[cfg(windows)]
        release_windows_lease(self.pid, self.job.clone());
    }
}

fn request_stop(pid: u32, force: bool) -> Result<(), HostError> {
    #[cfg(unix)]
    signal(pid, if force { libc::SIGKILL } else { libc::SIGTERM });
    #[cfg(windows)]
    {
        let _ = force;
        let lease = processes().lock().unwrap().get(&pid).cloned();
        if let Some(lease) = lease {
            let job = lease.job.ok_or_else(|| HostError::new(
                "RESOURCE_BUSY", "Git 启动清理尚未确认，请稍后核对资源",
            ))?;
            job.terminate().map_err(|e| HostError::new("RESOURCE_BUSY", e.to_string()))?;
        }
    }
    Ok(())
}

#[cfg(windows)]
async fn wait_windows_job(job: &crate::windows_process::OwnedJob) -> Result<(), HostError> {
    job.terminate().map_err(|e| HostError::new("RESOURCE_BUSY", e.to_string()))?;
    for _ in 0..40 {
        if job.is_empty().map_err(|e| HostError::new("RESOURCE_BUSY", e.to_string()))? {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    Err(HostError::new("RESOURCE_BUSY", "Git 子进程尚未全部退出，请核对资源后重试停止"))
}

#[cfg(windows)]
fn remove_windows_lease(pid: u32, job: &Arc<crate::windows_process::OwnedJob>) {
    let mut leases = processes().lock().unwrap();
    if leases.get(&pid).and_then(|lease| lease.job.as_ref()).is_some_and(|current| Arc::ptr_eq(current, job)) {
        leases.remove(&pid);
    }
}

#[cfg(windows)]
fn release_windows_lease(pid: u32, job: Arc<crate::windows_process::OwnedJob>) {
    if job.is_empty().unwrap_or(false) {
        remove_windows_lease(pid, &job);
        return;
    }
    // Early errors must also stop descendants. Keep the resource record and Job
    // until the actual owned tree is empty, even if this request has returned.
    let _ = job.terminate();
    if let Ok(runtime) = tokio::runtime::Handle::try_current() {
        runtime.spawn(async move {
            for _ in 0..40 {
                if job.is_empty().unwrap_or(false) {
                    remove_windows_lease(pid, &job);
                    return;
                }
                tokio::time::sleep(Duration::from_millis(50)).await;
            }
            // The map retains its Arc and stop action when cleanup is uncertain.
        });
    }
}

#[cfg(windows)]
fn retain_failed_windows_spawn(mut child: tokio::process::Child, lease: Lease) {
    let pid = lease.pid;
    let request_id = lease.request_id.clone();
    processes().lock().unwrap().insert(pid, lease);
    tokio::spawn(async move {
        // attach_suspended already attempted handle-based cleanup. Retain this
        // real Child across an uncertain timeout; never reopen or kill by PID.
        let _ = child.start_kill();
        if child.wait().await.is_ok() {
            let mut leases = processes().lock().unwrap();
            if leases.get(&pid).is_some_and(|lease| lease.job.is_none() && lease.request_id == request_id) {
                leases.remove(&pid);
            }
        }
    });
}
fn executable() -> Result<PathBuf, HostError> {
    let filename = format!("horizon-git{}", std::env::consts::EXE_SUFFIX);
    if let Some(path) = std::env::var_os("HORIZON_GIT_SIDECAR") {
        return Ok(path.into());
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join(&filename);
            if candidate.is_file() {
                return Ok(candidate);
            }
        }
    }
    let base = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../git-service/target");
    for profile in ["debug", "release"] {
        let path = base.join(profile).join(&filename);
        if path.is_file() {
            return Ok(path);
        }
    }
    Err(HostError::new(
        "DEPENDENCY_UNAVAILABLE",
        "Git 扩展服务未安装，请恢复 Git 扩展或重新安装 Horizon",
    ))
}
fn relative_path(root: &Path, path: &Path) -> Result<String, HostError> {
    path.strip_prefix(root)
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|_| HostError::new("PERMISSION_DENIED", "Git 文件不属于当前项目"))
}

pub async fn dispatch(
    state: Arc<HostState>,
    _app: AppHandle,
    call: Call,
    _channel: Option<Channel<Value>>,
) -> Result<Value, HostError> {
    let _request_guard = RequestGuard(call.request_id.clone());
    let clone_method = call.method == "git_clone" || call.method == "git_clone_cleanup";
    let project_id = if clone_method {
        None
    } else if call.method == "git_detect" {
        call.scope["projectId"].as_str().map(str::to_owned)
    } else {
        Some(call.project_id()?.to_owned())
    };
    let root = if clone_method {
        state.resolve_selection(
            call.params["destinationSelectionToken"]
                .as_str()
                .ok_or_else(|| HostError::new("INVALID_ARGUMENT", "请选择目标父目录"))?,
        )?
    } else if let Some(id) = &project_id {
        state.project_root(id)?
    } else {
        state.data_dir().to_path_buf()
    };
    validate_params(&call)?;
    let mut params = call.params.clone();
    if let Some(repo_id) = params.get("repoId") {
        if repo_id != &json!(crate::state::digest(root.as_os_str().as_encoded_bytes())) {
            return Err(HostError::new(
                "PERMISSION_DENIED",
                "仓库标识与当前项目不匹配",
            ));
        }
    }
    if let Some(project_id) = &project_id {
        if let Some(id) = params["fileId"].as_str() {
            params["path"] = json!(relative_path(&root, &state.resolve_file(project_id, id)?)?);
        }
        for key in ["fileIds", "stagedFileIds"] {
            if let Some(ids) = params[key].as_array() {
                let paths = ids
                    .iter()
                    .map(|id| {
                        let id = id
                            .as_str()
                            .ok_or_else(|| HostError::new("INVALID_ARGUMENT", "无效文件 ID"))?;
                        relative_path(&root, &state.resolve_file(project_id, id)?)
                    })
                    .collect::<Result<Vec<_>, HostError>>()?;
                params["paths"] = json!(paths);
            }
        }
    }
    let lock = lock_repo(&root.to_string_lossy());
    let _guard = lock.lock().await;
    crate::extensions::extension_gate(&state, "horizon.git", project_id.as_deref())?;
    if state.is_cancelled(&call.request_id) || request_revoked(&call.request_id) {
        return Err(HostError::new("CANCELLED", "操作已取消"));
    }
    if let Some(project_id) = &project_id {
        check_dirty(&state, project_id, &call)?;
    }
    let settings = crate::settings::effective_for(&state, project_id.as_deref())?;
    let request = json!({"method":call.method,"root":root,"cacheDir":state.data_dir().join("git-cache"),"params":params,"gitPath":settings["git.path"]});
    let mut command = Command::new(executable()?);
    command
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true);
    #[cfg(unix)]
    {
        command.process_group(0);
    }
    #[cfg(windows)]
    crate::windows_process::prepare_command(command.as_std_mut());
    let mut child = command
        .spawn()
        .map_err(|e| HostError::new("DEPENDENCY_UNAVAILABLE", e.to_string()))?;
    let pid = child
        .id()
        .ok_or_else(|| HostError::new("PROCESS_EXITED", "Git 服务未启动"))?;
    #[cfg(windows)]
    let job = {
        // No request bytes are sent until the suspended sidecar is in its Job.
        // It cannot launch Git while waiting for its complete stdin request.
        let handle = child.raw_handle().ok_or_else(|| HostError::new("PROCESS_EXITED", "Git 服务未启动"))?;
        match unsafe { crate::windows_process::attach_suspended(handle, pid) } {
            Ok(job) => job,
            Err(error) => {
                if !child.try_wait().map(|status| status.is_some()).unwrap_or(false) {
                    retain_failed_windows_spawn(child, Lease {
                        pid,
                        project_id: project_id.clone(),
                        request_id: call.request_id.clone(),
                        method: call.method.clone(),
                        job: None,
                    });
                    return Err(HostError::new("RESOURCE_BUSY", format!("Git 启动清理尚未确认：{error}")));
                }
                return Err(HostError::new("DEPENDENCY_UNAVAILABLE", error.to_string()));
            }
        }
    };
    processes().lock().unwrap().insert(
        pid,
        Lease {
            pid,
            project_id: project_id.clone(),
            request_id: call.request_id.clone(),
            method: call.method.clone(),
            #[cfg(windows)]
            job: Some(job.clone()),
        },
    );
    let _lease = LeaseGuard {
        pid,
        #[cfg(windows)]
        job: job.clone(),
    };
    if request_revoked(&call.request_id) {
        request_stop(pid, true)?;
        #[cfg(windows)]
        wait_windows_job(&job).await?;
        let _ = child.wait().await;
        return Err(HostError::new("CANCELLED", "请求所属扩展已停止"));
    }
    let mut stdin = child.stdin.take().unwrap();
    stdin
        .write_all(request.to_string().as_bytes())
        .await
        .map_err(|e| HostError::new("IO_ERROR", e.to_string()))?;
    drop(stdin);
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    let err_reader = tokio::spawn(async move {
        let mut bytes = Vec::new();
        let _ = stderr.take(64 * 1024).read_to_end(&mut bytes).await;
        bytes
    });
    let mut lines = BufReader::new(stdout).lines();
    let mut result = None;
    let mut cancelled = false;
    let mut process_poll = tokio::time::interval(Duration::from_millis(80));
    loop {
        tokio::select! {
            line=lines.next_line()=>{match line{Ok(Some(line))=>{let event:Value=serde_json::from_str(&line).map_err(|_|HostError::new("EXTENSION_FAILED","Git 服务返回无效消息"))?;match event["type"].as_str(){Some("progress")=>{let _=state.emit_task(&call.request_id,json!({"type":"progress","phase":event["phase"]}));},Some("result")=>result=Some(Ok(event["data"].clone())),Some("error")=>result=Some(Err(serde_json::from_value(event["error"].clone()).unwrap_or_else(|_|HostError::new("GIT_COMMAND_FAILED","Git 操作失败")))),_=>{}}},Ok(None)=>break,Err(e)=>{result=Some(Err(HostError::new("IO_ERROR",e.to_string())));break;}}},
            _ = process_poll.tick() => {
                if state.is_cancelled(&call.request_id) || request_revoked(&call.request_id) {
                    cancelled = true;
                    request_stop(pid, false)?;
                    #[cfg(unix)]
                    {
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        request_stop(pid, true)?;
                    }
                    break;
                }
                #[cfg(windows)]
                if child.try_wait().map_err(|e| HostError::new("IO_ERROR", e.to_string()))?.is_some() {
                    // A descendant can keep stdout/stderr open after the sidecar
                    // exits. Close the owned tree, then drain buffered events.
                    job.terminate().map_err(|e| HostError::new("RESOURCE_BUSY", e.to_string()))?;
                }
            }
        }
    }
    #[cfg(windows)]
    wait_windows_job(&job).await?;
    let status = child
        .wait()
        .await
        .map_err(|e| HostError::new("IO_ERROR", e.to_string()))?;
    let _ = err_reader.await;
    if cancelled && result.is_none() {
        let uncertain = call.method == "git_mutate"
            && matches!(
                params["operation"].as_str(),
                Some("commit" | "push" | "pull")
            );
        return Err(HostError::new(
            if uncertain {
                "OUTCOME_UNKNOWN"
            } else {
                "CANCELLED"
            },
            if uncertain {
                "停止已完成；Git 操作可能已生效。请刷新 HEAD、暂存区与远端后核对。"
            } else if clone_method {
                "克隆已停止；若留下本次目标目录，可显式移到废纸篓。"
            } else {
                "Git 操作已停止，请刷新状态。"
            },
        ));
    }
    let mut data = result.unwrap_or_else(|| {
        Err(HostError::new(
            "EXTENSION_FAILED",
            format!("Git 服务已退出（{status}），请刷新后重试"),
        ))
    })?;
    if let Some(project_id) = &project_id {
        map_files(&state, project_id, &root, &mut data)?;
        if call.method == "git_conflict_get" {
            data["workingFile"] = data["file"].clone();
        }
        if call.method == "git_discard_plan" {
            state.plans.lock().unwrap().insert(
                format!("git-discard-{}", data["planId"].as_str().unwrap_or("")),
                data.clone(),
            );
        }
        if call.method == "git_mutate" || call.method == "git_conflict_resolve" {
            state.notify(
                "horizon.git.v1",
                project_id,
                data["snapshot"]["generation"].as_u64().unwrap_or(1),
                "invalidate",
            );
        }
    }
    if call.method == "git_clone" {
        let path = PathBuf::from(
            data["path"]
                .as_str()
                .ok_or_else(|| HostError::new("EXTENSION_FAILED", "缺少克隆结果"))?,
        );
        let registration = state.register_project(path, params["workspaceId"].as_str(), None)?;
        data["project"] = registration["project"].clone();
        data["reused"] = registration["reused"].clone();
    }
    Ok(data)
}
fn validate_params(call: &Call) -> Result<(), HostError> {
    let fields: &[&str] = match call.method.as_str() {
        "git_status" => &["refresh"],
        "git_detect" | "git_identity" => &[],
        "git_diff" => &[
            "repoId",
            "fileId",
            "base",
            "commitOid",
            "parentOid",
            "originalPath",
            "expectedRepoToken",
        ],
        "git_diff_page" => &["diffId", "cursor"],
        "git_history" => &["repoId", "cursor", "limit"],
        "git_branches" => &["repoId"],
        "git_compare" => &["repoId", "source", "target"],
        "git_conflict_get" => &["repoId", "fileId", "expectedRepoToken"],
        "git_blob_read" => &["repoId", "blob", "cursor", "limitBytes"],
        "git_conflict_resolve" => &["repoId", "fileId", "expectedRepoToken", "choice"],
        "git_discard_plan" => &["repoId", "fileIds", "source"],
        "git_mutate" => &[
            "repoId",
            "expectedRepoToken",
            "operation",
            "fileIds",
            "stagedFileIds",
            "message",
            "remote",
            "branch",
            "strategy",
            "sourceRef",
            "targetRef",
            "setUpstream",
            "name",
            "startOid",
            "switchAfter",
            "planId",
            "planDigest",
            "allowDirtyDisk",
        ],
        "git_clone" => &["url", "name", "destinationSelectionToken", "workspaceId"],
        "git_clone_cleanup" => &["name", "destinationSelectionToken"],
        _ => return Err(HostError::new("NOT_FOUND", "未知 Git 方法")),
    };
    crate::protocol::allowed(&call.params, fields)
}
fn check_dirty(state: &HostState, project_id: &str, call: &Call) -> Result<(), HostError> {
    let dirty = state.dirty_documents(Some(project_id));
    if dirty.is_empty() {
        return Ok(());
    }
    let p = &call.params;
    if call.method == "git_mutate"
        && (matches!(p["operation"].as_str(), Some("switch" | "pull"))
            || (p["operation"] == "createBranch" && p["switchAfter"] == true))
    {
        return Err(HostError::new(
            "RESOURCE_BUSY",
            "请先处理未保存文档，再切换分支或拉取",
        ));
    }
    let mut ids = Vec::<String>::new();
    if call.method == "git_conflict_resolve" {
        if let Some(id) = p["fileId"].as_str() {
            ids.push(id.into());
        }
    }
    if call.method == "git_discard_plan"
        || (call.method == "git_mutate" && p["operation"] == "stage" && p["allowDirtyDisk"] != true)
    {
        ids.extend(
            p["fileIds"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .map(str::to_owned),
        );
    }
    if call.method == "git_mutate" && p["operation"] == "discard" {
        if let Some(plan) = state.plans.lock().unwrap().get(&format!(
            "git-discard-{}",
            p["planId"].as_str().unwrap_or("")
        )) {
            ids.extend(
                plan["files"]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|f| f["fileId"].as_str())
                    .map(str::to_owned),
            );
        }
    }
    if dirty.iter().any(|d| {
        d["fileId"]
            .as_str()
            .is_some_and(|id| ids.iter().any(|i| i == id))
    }) {
        return Err(HostError::new(
            "RESOURCE_BUSY",
            "所选文件有未保存内容。请先保存，或明确选择仅暂存磁盘内容。",
        ));
    }
    Ok(())
}
fn map_files(
    state: &HostState,
    project_id: &str,
    root: &Path,
    value: &mut Value,
) -> Result<(), HostError> {
    if let Some(object) = value.as_object_mut() {
        if let Some(path) = object
            .get("path")
            .and_then(Value::as_str)
            .map(str::to_owned)
        {
            let file = state.file_ref(project_id, &root.join(path))?;
            object.insert(
                "file".into(),
                serde_json::to_value(file)
                    .map_err(|e| HostError::new("IO_ERROR", e.to_string()))?,
            );
            if let Some(id) = object.get("file").and_then(|v| v.get("fileId")).cloned() {
                object.insert("fileId".into(), id);
            }
        }
        for child in object.values_mut() {
            map_files(state, project_id, root, child)?;
        }
    } else if let Some(array) = value.as_array_mut() {
        for child in array {
            map_files(state, project_id, root, child)?;
        }
    }
    Ok(())
}

/// Read the immutable, project-bound diff explicitly selected for Agent context.
pub async fn read_diff_snapshot(
    state: &HostState,
    project_id: &str,
    diff_id: &str,
    expected_repo_token: &str,
) -> Result<Value, HostError> {
    crate::extensions::extension_gate(state, "horizon.git", Some(project_id))?;
    if diff_id.len() != 64 || !diff_id.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(HostError::new("INVALID_ARGUMENT", "无效差异标识"));
    }
    let path = state
        .data_dir()
        .join("git-cache")
        .join(format!("diff-{diff_id}.json"));
    let metadata = tokio::fs::metadata(&path)
        .await
        .map_err(|_| HostError::new("STALE_CURSOR", "差异缓存已失效，请重新打开差异"))?;
    if metadata.modified()?.elapsed().unwrap_or_default().as_secs() > 600 {
        return Err(HostError::new(
            "STALE_CURSOR",
            "差异缓存已过期，请重新打开差异",
        ));
    }
    let data: Value = serde_json::from_slice(&tokio::fs::read(path).await?)?;
    let root = state.project_root(project_id)?;
    if data["repoId"] != crate::state::digest(root.as_os_str().as_encoded_bytes()) {
        return Err(HostError::new("PERMISSION_DENIED", "差异不属于当前项目"));
    }
    if data["repoToken"] != expected_repo_token {
        return Err(HostError::new(
            "STALE_VERSION",
            "所选差异版本已变化，请重新选择",
        ));
    }
    if data["truncated"] == true || data["binary"] == true {
        return Err(HostError::new(
            "RESOURCE_LIMIT",
            "二进制或已截断差异不能作为完整文本上下文，请选择较小范围",
        ));
    }
    let file = state.file_ref(
        project_id,
        &root.join(
            data["path"]
                .as_str()
                .ok_or_else(|| HostError::new("IO_ERROR", "差异元数据损坏"))?,
        ),
    )?;
    Ok(
        json!({"diffId":diff_id,"repoToken":data["repoToken"],"base":data["base"],"file":file,"text":data["patch"],"byteLength":data["byteLength"],"readOnly":true}),
    )
}
