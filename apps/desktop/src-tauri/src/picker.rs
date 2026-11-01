//! Native file panels live in a short-lived AppKit client on macOS. Reaping
//! that client releases its system panel services without terminating them.
use crate::{Call, HostError};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use tauri::AppHandle;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    mode: &'static str,
    title: Option<&'static str>,
    filters: Vec<Filter>,
    default_filename: Option<&'static str>,
}

#[derive(Clone, Serialize)]
struct Filter {
    name: &'static str,
    extensions: Vec<&'static str>,
}

impl Request {
    pub fn file() -> Self {
        Self::new("file")
    }
    pub fn folder() -> Self {
        Self::new("folder")
    }
    pub fn save(filename: &'static str) -> Self {
        let mut request = Self::new("save");
        request.default_filename = Some(filename);
        request
    }
    fn new(mode: &'static str) -> Self {
        Self {
            mode,
            title: None,
            filters: vec![],
            default_filename: None,
        }
    }
    pub fn title(mut self, title: &'static str) -> Self {
        self.title = Some(title);
        self
    }
    pub fn filter(mut self, name: &'static str, extensions: &[&'static str]) -> Self {
        self.filters.push(Filter {
            name,
            extensions: extensions.to_vec(),
        });
        self
    }
}

pub async fn pick(
    app: &AppHandle,
    call: &Call,
    request: Request,
) -> Result<Option<PathBuf>, HostError> {
    let app = app.clone();
    let call = call.clone();
    tauri::async_runtime::spawn_blocking(move || pick_blocking(&app, &call, request))
        .await
        .map_err(|error| HostError::new("IO_ERROR", error.to_string()))?
}

#[cfg(target_os = "macos")]
pub use implementation::{pick_blocking, resources, stop_resources};

#[cfg(not(target_os = "macos"))]
pub fn pick_blocking(
    app: &AppHandle,
    _call: &Call,
    request: Request,
) -> Result<Option<PathBuf>, HostError> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file();
    if let Some(title) = request.title {
        dialog = dialog.set_title(title);
    }
    for filter in request.filters {
        dialog = dialog.add_filter(filter.name, &filter.extensions);
    }
    if let Some(filename) = request.default_filename {
        dialog = dialog.set_file_name(filename);
    }
    let selected = match request.mode {
        "folder" => dialog.blocking_pick_folder(),
        "save" => dialog.blocking_save_file(),
        _ => dialog.blocking_pick_file(),
    };
    selected
        .map(|path| {
            path.into_path()
                .map_err(|error| HostError::new("IO_ERROR", error.to_string()))
        })
        .transpose()
}

#[cfg(not(target_os = "macos"))]
pub fn resources(_project: Option<&str>) -> Vec<Value> {
    vec![]
}
#[cfg(not(target_os = "macos"))]
pub async fn stop_resources(_project: Option<&str>) -> Result<(), HostError> {
    Ok(())
}

#[cfg(target_os = "macos")]
mod implementation {
    use super::*;
    use serde::Deserialize;
    use serde_json::json;
    use std::{
        io::{BufRead, BufReader, Read, Write},
        process::{Child, ChildStdin, Command, Stdio},
        sync::{
            atomic::{AtomicBool, AtomicU32, Ordering},
            Arc, Condvar, Mutex, OnceLock,
        },
        time::{Duration, Instant},
    };
    use tauri::{Manager, WebviewWindow};

    struct Lease {
        id: String,
        project: Option<String>,
        request_id: String,
        pid: AtomicU32,
        cancelled: AtomicBool,
        input: Mutex<Option<ChildStdin>>,
        completed: Mutex<bool>,
        done: Condvar,
    }
    static ACTIVE: OnceLock<Mutex<Option<Arc<Lease>>>> = OnceLock::new();
    fn active() -> &'static Mutex<Option<Arc<Lease>>> {
        ACTIVE.get_or_init(Default::default)
    }

    struct LeaseGuard {
        lease: Arc<Lease>,
        window: WebviewWindow,
    }
    impl Drop for LeaseGuard {
        fn drop(&mut self) {
            self.lease.input.lock().unwrap().take();
            let _ = self.window.set_enabled(true);
            let _ = self.window.set_focus();
            active().lock().unwrap().take();
            *self.lease.completed.lock().unwrap() = true;
            self.lease.done.notify_all();
        }
    }

    // The child handle stays owned until wait. Even error cleanup can therefore
    // terminate only this unreaped child, never an Apple service or reused PID.
    struct ChildGuard<'a>(Child, &'a Lease);
    impl Drop for ChildGuard<'_> {
        fn drop(&mut self) {
            if !matches!(self.0.try_wait(), Ok(Some(_))) {
                // EOF asks AppKit to cancel normally even on an I/O error.
                self.1.input.lock().unwrap().take();
                self.0.stdin.take();
                let deadline = Instant::now() + Duration::from_secs(3);
                while Instant::now() < deadline {
                    if matches!(self.0.try_wait(), Ok(Some(_))) {
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(25));
                }
                let _ = self.0.kill();
                let _ = self.0.wait();
            }
        }
    }

    fn executable() -> Result<PathBuf, HostError> {
        let current = std::env::current_exe()?;
        let bundled = current
            .parent()
            .and_then(|parent| parent.parent())
            .map(|contents| {
                contents.join("Helpers/HorizonPicker.app/Contents/MacOS/HorizonPicker")
            });
        if let Some(path) = bundled.filter(|path| path.is_file()) {
            return Ok(path);
        }
        #[cfg(debug_assertions)]
        {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../picker-service/target/HorizonPicker.app/Contents/MacOS/HorizonPicker");
            if path.is_file() {
                return Ok(path);
            }
        }
        Err(HostError::new(
            "DEPENDENCY_UNAVAILABLE",
            "文件选择服务缺失，请重新安装 Horizon",
        ))
    }

    fn acquire(call: &Call, window: WebviewWindow) -> Result<LeaseGuard, HostError> {
        let mut active = active().lock().unwrap();
        if active.is_some() || crate::close_requested() {
            return Err(HostError::new(
                "RESOURCE_BUSY",
                "请先完成当前文件选择或关闭操作",
            ));
        }
        let lease = Arc::new(Lease {
            id: crate::state::id(),
            project: call.scope["projectId"].as_str().map(str::to_owned),
            request_id: call.request_id.clone(),
            pid: AtomicU32::new(0),
            cancelled: AtomicBool::new(false),
            input: Mutex::new(None),
            completed: Mutex::new(false),
            done: Condvar::new(),
        });
        *active = Some(lease.clone());
        Ok(LeaseGuard { lease, window })
    }

    #[derive(Deserialize)]
    struct Reply {
        status: String,
        path: Option<PathBuf>,
        message: Option<String>,
    }

    fn run_child(path: PathBuf, request: &Request, lease: &Lease) -> Result<Reply, HostError> {
        if lease.cancelled.load(Ordering::SeqCst) {
            return Ok(Reply {
                status: "cancelled".into(),
                path: None,
                message: None,
            });
        }
        let mut child = ChildGuard(
            Command::new(path)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()?,
            lease,
        );
        lease.pid.store(child.0.id(), Ordering::SeqCst);
        let output = child
            .0
            .stdout
            .take()
            .ok_or_else(|| HostError::new("IO_ERROR", "文件选择服务输出不可用"))?;
        let reader = std::thread::spawn(move || {
            let mut line = String::new();
            BufReader::new(output.take(65536))
                .read_line(&mut line)
                .map(|_| line)
        });
        {
            let mut input = child
                .0
                .stdin
                .take()
                .ok_or_else(|| HostError::new("IO_ERROR", "文件选择服务输入不可用"))?;
            serde_json::to_writer(&mut input, request)?;
            input.write_all(b"\n")?;
            *lease.input.lock().unwrap() = Some(input);
        }
        let mut cancel_at = None;
        let status = loop {
            if let Some(status) = child.0.try_wait()? {
                break status;
            }
            if lease.cancelled.load(Ordering::SeqCst) {
                if cancel_at.is_none() {
                    // Closing stdin also cancels if the command cannot be written.
                    if let Some(mut input) = lease.input.lock().unwrap().take() {
                        let _ = input.write_all(b"{\"command\":\"cancel\"}\n");
                    }
                    cancel_at = Some(Instant::now());
                } else if cancel_at
                    .is_some_and(|at: Instant| at.elapsed() >= Duration::from_secs(3))
                {
                    child.0.kill()?;
                    break child.0.wait()?;
                }
            }
            std::thread::sleep(Duration::from_millis(25));
        };
        lease.input.lock().unwrap().take();
        let output = reader
            .join()
            .map_err(|_| HostError::new("IO_ERROR", "文件选择服务响应读取失败"))??;
        if lease.cancelled.load(Ordering::SeqCst) {
            return Ok(Reply {
                status: "cancelled".into(),
                path: None,
                message: None,
            });
        }
        if !status.success() {
            return Err(HostError::new("IO_ERROR", "文件选择服务异常退出，请重试"));
        }
        serde_json::from_str(&output)
            .map_err(|_| HostError::new("IO_ERROR", "文件选择服务响应无效"))
    }

    pub fn pick_blocking(
        app: &AppHandle,
        call: &Call,
        request: Request,
    ) -> Result<Option<PathBuf>, HostError> {
        let path = executable()?;
        let window = app
            .get_webview_window("main")
            .ok_or_else(|| HostError::new("NOT_FOUND", "主窗口不可用"))?;
        let guard = acquire(call, window)?;
        guard
            .window
            .set_enabled(false)
            .map_err(|error| HostError::new("IO_ERROR", error.to_string()))?;
        let result = run_child(path, &request, &guard.lease);
        drop(guard); // Re-enable and focus the host only after the child has exited.
        let reply = result?;
        match reply.status.as_str() {
            "selected" => reply
                .path
                .filter(|path| path.is_absolute())
                .map(Some)
                .ok_or_else(|| HostError::new("IO_ERROR", "文件选择服务未返回有效路径")),
            "cancelled" => Ok(None),
            "quit" => {
                crate::request_close(app);
                Ok(None)
            }
            _ => Err(HostError::new(
                "IO_ERROR",
                reply.message.unwrap_or_else(|| "文件选择失败".into()),
            )),
        }
    }

    pub fn resources(project: Option<&str>) -> Vec<Value> {
        active().lock().unwrap().iter().filter(|lease| project.is_none() || lease.project.as_deref() == project)
            .map(|lease| json!({"resourceId":format!("picker-{}",lease.id),"ownerExtensionId":"horizon.host",
                "kind":"picker","title":"文件选择窗口","state":"running","pid":lease.pid.load(Ordering::SeqCst),
                "projectId":lease.project,"requestId":lease.request_id,"actions":["stop"]})).collect()
    }

    pub async fn stop_resources(project: Option<&str>) -> Result<(), HostError> {
        let lease = active()
            .lock()
            .unwrap()
            .as_ref()
            .filter(|lease| project.is_none() || lease.project.as_deref() == project)
            .cloned();
        let Some(lease) = lease else { return Ok(()) };
        lease.cancelled.store(true, Ordering::SeqCst);
        tauri::async_runtime::spawn_blocking(move || {
            let done = lease.completed.lock().unwrap();
            let (done, _) = lease
                .done
                .wait_timeout_while(done, Duration::from_secs(5), |done| !*done)
                .unwrap();
            if *done {
                Ok(())
            } else {
                Err(HostError::new(
                    "RESOURCE_BUSY",
                    "文件选择窗口仍在关闭，请稍后重试",
                ))
            }
        })
        .await
        .map_err(|error| HostError::new("IO_ERROR", error.to_string()))?
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use std::os::unix::fs::PermissionsExt;

        fn lease() -> Arc<Lease> {
            Arc::new(Lease {
                id: "test-picker".into(),
                project: None,
                request_id: "test-request".into(),
                pid: AtomicU32::new(0),
                cancelled: AtomicBool::new(false),
                input: Mutex::new(None),
                completed: Mutex::new(false),
                done: Condvar::new(),
            })
        }

        fn helper(body: &str) -> (tempfile::TempDir, PathBuf) {
            let directory = tempfile::tempdir().unwrap();
            let path = directory.path().join("picker-fixture");
            std::fs::write(&path, format!("#!/bin/sh\nread -r request\n{body}\n")).unwrap();
            std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o755)).unwrap();
            (directory, path)
        }

        fn assert_reaped(lease: &Lease) {
            let pid = lease.pid.load(Ordering::SeqCst);
            assert!(pid > 0);
            assert_eq!(
                unsafe { libc::waitpid(pid as i32, std::ptr::null_mut(), libc::WNOHANG) },
                -1
            );
            assert_eq!(
                std::io::Error::last_os_error().raw_os_error(),
                Some(libc::ECHILD)
            );
            assert!(lease.input.lock().unwrap().is_none());
        }

        #[test]
        fn selected_unicode_path_and_quit_reply_are_reaped() {
            for (status, path) in [("selected", Some("/tmp/文件 name.json")), ("quit", None)] {
                let output = json!({"status":status,"path":path}).to_string();
                let (_directory, executable) = helper(&format!("printf '%s\\n' '{output}'"));
                let lease = lease();
                let reply = run_child(executable, &Request::file(), &lease).unwrap();
                assert_eq!(reply.status, status);
                assert_eq!(reply.path, path.map(PathBuf::from));
                assert_reaped(&lease);
            }
        }

        #[test]
        fn failed_and_malformed_helper_replies_are_reaped() {
            for body in ["exit 7", "printf 'invalid\\n'"] {
                let (_directory, executable) = helper(body);
                let lease = lease();
                let error = run_child(executable, &Request::file(), &lease)
                    .err()
                    .unwrap();
                assert_eq!(error.code, "IO_ERROR");
                assert_reaped(&lease);
            }
        }

        fn cancelled_helper(body: &str) -> Duration {
            let (_directory, executable) = helper(body);
            let lease = lease();
            let child_lease = lease.clone();
            let worker =
                std::thread::spawn(move || run_child(executable, &Request::folder(), &child_lease));
            let deadline = Instant::now() + Duration::from_secs(2);
            while lease.pid.load(Ordering::SeqCst) == 0 {
                assert!(Instant::now() < deadline);
                std::thread::sleep(Duration::from_millis(5));
            }
            let started = Instant::now();
            lease.cancelled.store(true, Ordering::SeqCst);
            let reply = worker.join().unwrap().unwrap();
            assert_eq!(reply.status, "cancelled");
            assert!(reply.path.is_none());
            assert_reaped(&lease);
            started.elapsed()
        }

        #[test]
        fn cancel_waits_for_child_and_discards_a_racing_selection() {
            let elapsed = cancelled_helper("read -r command\nprintf '%s\\n' '{\"status\":\"selected\",\"path\":\"/tmp/late\"}'");
            assert!(elapsed < Duration::from_secs(2));
        }

        #[test]
        fn unresponsive_owned_child_is_reaped_after_cancel_timeout() {
            // exec retains the direct child PID; no descendant is created.
            let elapsed = cancelled_helper("exec /bin/sleep 30");
            assert!(elapsed >= Duration::from_secs(3));
            assert!(elapsed < Duration::from_secs(5));
        }
    }
}
