//! Windowless native integration check. Uses only temporary projects/data and real production APIs.
use horizon_host::{extension_host, extensions, files, git, settings, Call, HostError, HostState};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Listener, Manager};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
const SAMPLE: &str = "local.read-only-changes";
const CRASH: &str = "local.failure-probe";
const EDITOR_DEPENDENT: &str = "local.editor-stop-probe";

fn check(condition: bool, message: &str) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(std::io::Error::other(message).into())
    }
}
fn check_error(result: Result<Value>, code: &str) -> Result<()> {
    match result {
        Err(error)
            if error
                .downcast_ref::<HostError>()
                .is_some_and(|error| error.code == code) =>
        {
            Ok(())
        }
        Err(error) => Err(std::io::Error::other(format!("expected {code}, got {error}")).into()),
        Ok(value) => {
            Err(std::io::Error::other(format!("expected {code}, got success: {value}")).into())
        }
    }
}
fn call(method: &str, params: Value, project: Option<&str>) -> Call {
    Call {
        protocol_version: 1,
        request_id: uuid::Uuid::new_v4().to_string(),
        method: method.into(),
        scope: project
            .map(|id| json!({"kind":"project","projectId":id,"projectEpoch":1}))
            .unwrap_or(json!({"kind":"app"})),
        params,
        idempotency_key: Some(uuid::Uuid::new_v4().to_string()),
    }
}
fn make_zip(path: &Path, manifest: &str, source: &str) -> Result<()> {
    let mut zip = zip::ZipWriter::new(fs::File::create(path)?);
    for (name, bytes) in [
        ("manifest.json", manifest.as_bytes()),
        ("index.js", source.as_bytes()),
    ] {
        zip.start_file(
            name,
            zip::write::SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o644),
        )?;
        zip.write_all(bytes)?;
    }
    zip.finish()?;
    Ok(())
}
fn git_init(path: &Path, filename: &str) -> Result<()> {
    fs::create_dir_all(path)?;
    let output = Command::new("/usr/bin/git")
        .args(["init", "-q"])
        .arg(path)
        .output()?;
    check(output.status.success(), "temporary git init failed")?;
    fs::write(path.join(filename), "真实数据 · native QuickJS smoke\n")?;
    Ok(())
}
fn alive(pid: u32) -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
        false
    }
}

struct Smoke {
    state: Arc<HostState>,
    app: AppHandle,
    events: Arc<Mutex<Vec<Value>>>,
    steps: Vec<Value>,
    pids: Vec<u32>,
}
impl Smoke {
    fn file(&self, method: &str, params: Value, project: &str) -> Result<Value> {
        Ok(files::dispatch(
            self.state.clone(),
            call(method, params, Some(project)),
        )?)
    }
    async fn ext(&self, method: &str, params: Value, project: Option<&str>) -> Result<Value> {
        Ok(extensions::dispatch(
            self.state.clone(),
            self.app.clone(),
            call(method, params, project),
            None,
        )
        .await?)
    }
    async fn runtime(&self, method: &str, params: Value, project: &str) -> Result<Value> {
        Ok(extension_host::dispatch(
            self.state.clone(),
            self.app.clone(),
            call(method, params, Some(project)),
            None,
        )
        .await?)
    }
    async fn state(&self, id: &str, project: Option<&str>) -> Result<Value> {
        let result = self
            .ext("extension_list", json!({"projectId":project}), project)
            .await?;
        result["items"]
            .as_array()
            .and_then(|items| items.iter().find(|item| item["id"] == id))
            .cloned()
            .ok_or_else(|| std::io::Error::other(format!("missing extension {id}")).into())
    }
    fn pass(&mut self, name: &str, detail: Value) {
        println!("PASS {name}");
        self.steps
            .push(json!({"name":name,"passed":true,"detail":detail}));
    }
    async fn install(&mut self, path: &Path, id: &str, grants: Value) -> Result<()> {
        let token = self.state.register_selection(path.to_path_buf());
        let plan = self
            .ext(
                "extension_install_prepare",
                json!({"packageSelectionToken":token}),
                None,
            )
            .await?;
        let denied = self
            .ext(
                "extension_install_apply",
                json!({"planId":plan["planId"],"digest":plan["digest"],"grantIds":[]}),
                None,
            )
            .await;
        check(
            denied
                .as_ref()
                .err()
                .is_some_and(|error| error.to_string().contains("PERMISSION_DENIED")),
            "missing grants did not reject installation",
        )?;
        let installed = self
            .ext(
                "extension_install_apply",
                json!({"planId":plan["planId"],"digest":plan["digest"],"grantIds":grants}),
                None,
            )
            .await?;
        check(
            installed["installState"] == "installed" && installed["runState"] == "stopped",
            "installation unexpectedly activated extension",
        )?;
        check(
            extension_host::resource_count(id, None) == 0,
            "install spawned a sidecar",
        )?;
        self.pass("zip-install-requires-explicit-grants-and-starts-no-process",json!({"extensionId":id,"version":installed["installedVersion"],"packageDigest":plan["packageDigest"]}));
        Ok(())
    }
    async fn enable(&self, id: &str) -> Result<()> {
        let state = self.state(id, None).await?;
        self.ext("extension_enable",json!({"extensionId":id,"scope":"global","expectedRevision":state["revision"],"enabled":true}),None).await?;
        Ok(())
    }
    async fn activate(&mut self, id: &str, command: &str, project: &str) -> Result<String> {
        let state = self
            .ext(
                "extension_activate",
                json!({"extensionId":id,"reason":{"kind":"command","id":command}}),
                Some(project),
            )
            .await?;
        let activation = state["activationId"]
            .as_str()
            .ok_or_else(|| std::io::Error::other("activation missing"))?
            .to_string();
        check(
            state["runState"] == "activating",
            "QuickJS reported active before ready",
        )?;
        let result = self
            .runtime(
                "extension_runtime_activate",
                json!({"extensionId":id,"activationId":activation}),
                project,
            )
            .await?;
        let pid = result["pid"]
            .as_u64()
            .ok_or_else(|| std::io::Error::other("sidecar PID missing"))? as u32;
        self.pids.push(pid);
        check(alive(pid), "activated process is not alive")?;
        check(
            self.state(id, Some(project)).await?["runState"] == "active",
            "ready process not reflected in native state",
        )?;
        Ok(activation)
    }
    async fn command(
        &self,
        id: &str,
        activation: &str,
        command: &str,
        project: &str,
    ) -> Result<Value> {
        self.runtime(
            "extension_runtime_execute",
            json!({"extensionId":id,"activationId":activation,"commandId":command}),
            project,
        )
        .await
    }
    async fn stop(&self, id: &str, action: &str, project: Option<&str>) -> Result<Value> {
        let plan=self.ext("extension_stop_prepare",json!({"extensionId":id,"action":action,"scope":if project.is_some(){"project"}else{"global"},"projectId":project}),project).await?;
        let decisions: Vec<_> = plan["resources"]
            .as_array()
            .into_iter()
            .flatten()
            .map(|resource| json!({"resourceId":resource["resourceId"],"action":"stop"}))
            .collect();
        self.ext("extension_stop_apply",json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":decisions,"stopDependents":true}),project).await
    }
    async fn wait_until(&self, timeout: Duration, condition: impl Fn() -> bool) -> Result<()> {
        let started = Instant::now();
        while !condition() {
            check(started.elapsed() < timeout, "condition deadline expired")?;
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
        Ok(())
    }
}

struct Draft {
    project: String,
    path: PathBuf,
    meta: Value,
}
impl Draft {
    fn create(smoke: &Smoke, root: &Path, label: &str) -> Result<Self> {
        let directory = root.join(label);
        fs::create_dir_all(&directory)?;
        let project = smoke
            .state
            .register_project(directory.clone(), None, Some(label))?["project"]["id"]
            .as_str()
            .unwrap()
            .to_owned();
        let path = directory.join("draft.txt");
        fs::write(&path, "磁盘原文 · keep unchanged\n")?;
        let file = smoke.state.file_ref(&project, &path)?;
        let opened = smoke.file(
            "document_open",
            json!({"fileId":file["fileId"],"mode":"auto"}),
            &project,
        )?;
        let draft = Self {
            project,
            path,
            meta: opened["meta"].clone(),
        };
        draft.edit(smoke, 1, "首版未保存草稿\n")?;
        Ok(draft)
    }
    fn id(&self) -> &str {
        self.meta["documentId"].as_str().unwrap()
    }
    fn checkpoint_path(&self, smoke: &Smoke) -> PathBuf {
        smoke
            .state
            .data_dir()
            .join("recovery")
            .join(format!("{}.json", self.id()))
    }
    fn edit(&self, smoke: &Smoke, revision: u64, text: &str) -> Result<()> {
        smoke.file(
            "document_mark_dirty",
            json!({"documentId":self.id(),"editorRevision":revision,"dirty":true}),
            &self.project,
        )?;
        smoke.file("document_checkpoint", json!({"documentId":self.id(),"editorRevision":revision,"baseDiskRevision":self.meta["baseDiskRevision"],"text":text,"selection":{"anchor":3,"head":3}}), &self.project)?;
        Ok(())
    }
    fn snapshot(&self, smoke: &Smoke) -> Result<Value> {
        Ok(
            json!({"documents":smoke.state.open_documents(Some(&self.project)),"checkpoint":fs::read(self.checkpoint_path(smoke))?,"source":fs::read(&self.path)?}),
        )
    }
    fn retain(&self) -> Value {
        json!({"resourceId":self.id(),"action":"retainCheckpoint","checkpointId":self.id()})
    }
}
fn stop_decisions(plan: &Value, document: Value) -> Vec<Value> {
    plan["resources"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|resource| json!({"resourceId":resource["resourceId"],"action":"stop"}))
        .chain(std::iter::once(document))
        .collect()
}
async fn editor_stop_plan_preserves_documents(smoke: &mut Smoke, temp: &Path) -> Result<()> {
    let a = Draft::create(smoke, temp, "editor-stop-a")?;
    let b = Draft::create(smoke, temp, "editor-stop-b")?;
    let manifest = json!({"id":EDITOR_DEPENDENT,"name":"编辑器停止计划探针","version":"0.1.0","description":"Native integration fixture","author":"Horizon tests","apiVersion":1,"engines":{"horizon":">=0.1.0 <0.2.0"},"runtime":{"kind":"quickjs","entry":"index.js"},"activation":["onCommand:local.editor-stop-probe.echo"],"requires":{"horizon.editor":"^0.1.0"},"optional":{},"capabilities":["storage"],"contributes":{"commands":[{"id":"local.editor-stop-probe.echo","title":"检查停止计划"}]}});
    let package = temp.join("editor-stop-probe.horizon-extension");
    make_zip(&package, &manifest.to_string(), "export function activate(ctx){ctx.commands.register('local.editor-stop-probe.echo',()=> 'alive')}")?;
    smoke
        .install(&package, EDITOR_DEPENDENT, json!(["storage"]))
        .await?;
    smoke.enable(EDITOR_DEPENDENT).await?;
    let activation = smoke
        .activate(EDITOR_DEPENDENT, "local.editor-stop-probe.echo", &a.project)
        .await?;
    let a_before = a.snapshot(smoke)?;
    let b_before = b.snapshot(smoke)?;
    let prepare = || json!({"extensionId":"horizon.editor","action":"pause","scope":"project","projectId":a.project});

    let plan = smoke
        .ext("extension_stop_prepare", prepare(), Some(&a.project))
        .await?;
    check(
        plan["dependents"]
            .as_array()
            .is_some_and(|ids| ids.contains(&json!(EDITOR_DEPENDENT))),
        "editor stop plan omitted installed dependent",
    )?;
    check_error(smoke.ext("extension_stop_apply", json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":stop_decisions(&plan,json!({"resourceId":a.id(),"action":"discard"})),"stopDependents":false}), Some(&a.project)).await, "DEPENDENCY_UNAVAILABLE")?;
    check(
        a.snapshot(smoke)? == a_before && b.snapshot(smoke)? == b_before,
        "dependency rejection changed open documents, checkpoint or source",
    )?;
    check(
        smoke
            .command(
                EDITOR_DEPENDENT,
                &activation,
                "local.editor-stop-probe.echo",
                &a.project,
            )
            .await?
            == "alive",
        "dependency rejection stopped dependent process",
    )?;
    smoke.pass("editor-stop-dependent-rejection-preserves-documents", json!({"projectId":a.project,"documentId":a.id(),"error":"DEPENDENCY_UNAVAILABLE","unchanged":["openDocuments","checkpointBytes","sourceBytes","dependentActivation"]}));

    let plan = smoke
        .ext("extension_stop_prepare", prepare(), Some(&a.project))
        .await?;
    let mut decisions = stop_decisions(&plan, a.retain());
    decisions.push(json!({"resourceId":b.id(),"action":"discard"}));
    check_error(smoke.ext("extension_stop_apply", json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":decisions,"stopDependents":true}), Some(&a.project)).await, "PERMISSION_DENIED")?;
    check(
        a.snapshot(smoke)? == a_before && b.snapshot(smoke)? == b_before,
        "out-of-plan decision changed either project's document, checkpoint or source",
    )?;
    smoke.pass("editor-stop-rejects-out-of-plan-document-without-mutation", json!({"plannedDocumentId":a.id(),"injectedOtherProjectDocumentId":b.id(),"error":"PERMISSION_DENIED","bothProjectsUnchanged":true}));

    let stale = smoke
        .ext("extension_stop_prepare", prepare(), Some(&a.project))
        .await?;
    a.edit(smoke, 2, "计划之后继续编辑 · 最新恢复稿\n")?;
    let latest = a.snapshot(smoke)?;
    check_error(smoke.ext("extension_stop_apply", json!({"planId":stale["planId"],"digest":stale["digest"],"decisions":stop_decisions(&stale,a.retain()),"stopDependents":true}), Some(&a.project)).await, "STALE_VERSION")?;
    check(
        a.snapshot(smoke)? == latest && b.snapshot(smoke)? == b_before,
        "stale stop plan changed document, latest checkpoint or source",
    )?;
    smoke.pass("editor-stop-rejects-edits-after-prepare", json!({"documentId":a.id(),"plannedRevision":1,"currentRevision":2,"checkpointRevision":2,"error":"STALE_VERSION","allDocumentStateUnchanged":true}));

    let plan = smoke
        .ext("extension_stop_prepare", prepare(), Some(&a.project))
        .await?;
    smoke.ext("extension_stop_apply", json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":stop_decisions(&plan,a.retain()),"stopDependents":true}), Some(&a.project)).await?;
    check(
        smoke.state.open_documents(Some(&a.project)).is_empty(),
        "valid retained checkpoint did not release editor document",
    )?;
    check(
        fs::read(a.checkpoint_path(smoke))?
            == serde_json::from_value::<Vec<u8>>(latest["checkpoint"].clone())?
            && fs::read(&a.path)? == serde_json::from_value::<Vec<u8>>(latest["source"].clone())?,
        "valid retain modified recovery or original source",
    )?;
    let recovered = smoke.file("recovery_read", json!({"checkpointId":a.id()}), &a.project)?;
    check(
        recovered["text"] == "计划之后继续编辑 · 最新恢复稿\n" && recovered["editorRevision"] == 2,
        "retained checkpoint does not contain latest text",
    )?;
    check(
        b.snapshot(smoke)? == b_before,
        "valid A stop affected B document",
    )?;
    check(
        extension_host::resource_count(EDITOR_DEPENDENT, Some(&a.project)) == 0,
        "valid editor stop retained dependent process",
    )?;
    smoke.pass("editor-stop-retains-latest-checkpoint-and-isolates-other-project", json!({"closedDocumentId":a.id(),"checkpointRevision":recovered["editorRevision"],"sourceUnchanged":true,"otherProjectUnchanged":true,"remainingDependentProcesses":0}));
    smoke.stop(EDITOR_DEPENDENT, "uninstall", None).await?;
    Ok(())
}

fn impact_decisions(plan: &Value) -> Vec<Value> {
    plan["resources"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|resource| json!({"resourceId":resource["resourceId"],"action":"stop"}))
        .chain(plan["documents"].as_array().into_iter().flatten().map(|document| {
            json!({"resourceId":document["documentId"],"action":"retainCheckpoint","checkpointId":document["documentId"]})
        }))
        .collect()
}
fn registry_bytes(smoke: &Smoke) -> Result<Vec<u8>> {
    Ok(fs::read(
        smoke.state.data_dir().join("extensions/registry.json"),
    )?)
}
fn document_bytes(smoke: &Smoke) -> Result<Value> {
    let documents = smoke.state.open_documents(None);
    let sources: Vec<_> = documents
        .iter()
        .map(|document| -> Result<Value> {
            let path = smoke.state.resolve_file(
                document["projectId"].as_str().unwrap(),
                document["fileId"].as_str().unwrap(),
            )?;
            Ok(json!({"documentId":document["documentId"],"source":fs::read(path)?}))
        })
        .collect::<Result<_>>()?;
    let mut paths = fs::read_dir(smoke.state.data_dir().join("recovery"))?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<std::result::Result<Vec<_>, _>>()?;
    paths.sort();
    let checkpoints: Vec<_> = paths
        .into_iter()
        .filter(|path| path.is_file())
        .map(|path| -> Result<Value> {
            Ok(json!({"name":path.file_name().unwrap().to_string_lossy(),"bytes":fs::read(&path)?}))
        })
        .collect::<Result<_>>()?;
    Ok(json!({"documents":documents,"sources":sources,"checkpoints":checkpoints}))
}
async fn appearance_policy(smoke: &Smoke) -> Result<Value> {
    let state = smoke.ext("extension_list", json!({}), None).await?;
    Ok(json!(state["items"]
        .as_array()
        .unwrap()
        .iter()
        .filter(|item| {
            item["id"].as_str().is_some_and(|id| {
                id.starts_with("horizon.layout.") || id.starts_with("horizon.theme.")
            })
        })
        .cloned()
        .collect::<Vec<_>>()))
}
async fn capability_presets(smoke: &mut Smoke, temp: &Path) -> Result<()> {
    let appearance = appearance_policy(smoke).await?;
    let policy = registry_bytes(smoke)?;
    let documents = document_bytes(smoke)?;
    let prepare_development = json!({"profile":"development","scope":"global","selectedIds":["horizon.terminal","horizon.launch"]});
    let plan = smoke
        .ext(
            "extension_preset_prepare",
            prepare_development.clone(),
            None,
        )
        .await?;
    check(
        plan["enableIds"].as_array().is_some_and(|ids| {
            ["horizon.terminal", "horizon.launch"]
                .iter()
                .all(|id| ids.contains(&json!(id)))
        }),
        "development preset omitted optional terminal/launch enable impact",
    )?;
    check(
        plan["missingIds"] == json!([]) && plan["blockers"] == json!([]),
        "development preset unexpectedly blocked",
    )?;
    check(
        registry_bytes(smoke)? == policy && document_bytes(smoke)? == documents,
        "preset preparation changed policy or documents",
    )?;

    // Seed only transport task bookkeeping; task_cancel and preset application are real APIs.
    // A windowless harness cannot invoke the private WebView-only horizon_start command.
    let request = call(
        "extension_preset_apply",
        json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":impact_decisions(&plan)}),
        None,
    );
    let task_id = uuid::Uuid::new_v4().to_string();
    smoke.state.tasks.lock().unwrap().insert(
        task_id.clone(),
        horizon_host::state::TaskRecord {
            id: task_id.clone(),
            call: request.clone(),
            state: "queued".into(),
            cancelled: false,
            seq: 0,
            ack: 0,
            events: Default::default(),
            ring_bytes: 0,
            channel: None,
            terminal: None,
            updated: Instant::now(),
        },
    );
    let cancelled = horizon_host::dispatch(
        smoke.state.clone(),
        smoke.app.clone(),
        call("task_cancel", json!({"taskId":task_id}), None),
        None,
    )
    .await?;
    check(
        cancelled["cancelRequested"] == true,
        "production task cancellation did not acknowledge request",
    )?;
    check_error(
        extensions::dispatch(smoke.state.clone(), smoke.app.clone(), request, None)
            .await
            .map_err(Into::into),
        "CANCELLED",
    )?;
    smoke.state.tasks.lock().unwrap().remove(&task_id);
    check(
        registry_bytes(smoke)? == policy && document_bytes(smoke)? == documents,
        "cancelled preset mutated policy, documents or disk",
    )?;
    smoke.pass("preset-prepare-and-cancel-have-no-policy-or-document-effect",json!({"cancelledBeforeApply":true,"error":"CANCELLED","taskRegistration":"controlled bookkeeping; production task_cancel and extension_preset_apply","policyBytesUnchanged":true,"documentAndDiskBytesUnchanged":true}));

    let plan = smoke
        .ext("extension_preset_prepare", prepare_development, None)
        .await?;
    let applied = smoke.ext("extension_preset_apply",json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":impact_decisions(&plan)}),None).await?;
    check(
        applied["applied"] == true && applied["processesStarted"] == 0,
        "development preset did not apply lazily",
    )?;
    for id in ["horizon.terminal", "horizon.launch"] {
        check(
            smoke.state(id, None).await?["effectiveEnabled"] == true,
            "development capability was not enabled",
        )?;
    }
    check(
        horizon_host::processes::resources(None)["items"]
            .as_array()
            .is_some_and(Vec::is_empty),
        "development preset started a terminal/launch process",
    )?;
    check(
        extension_host::resources(None).is_empty(),
        "development preset started a QuickJS process",
    )?;
    check(
        appearance_policy(smoke).await? == appearance,
        "development preset changed layout/theme policy",
    )?;
    smoke.pass("development-preset-enables-terminal-and-launch-with-zero-processes",json!({"enabled":["horizon.terminal","horizon.launch"],"ownedTerminalAndLaunchProcesses":0,"ownedQuickJsProcesses":0,"appearanceUnchanged":true}));

    let root = temp.join("preset-project");
    git_init(&root, "preset-change.txt")?;
    let project = smoke
        .state
        .register_project(root, None, Some("Preset integration"))?["project"]["id"]
        .as_str()
        .unwrap()
        .to_owned();
    smoke
        .install(
            &temp.join("sample.horizon-extension"),
            SAMPLE,
            json!(["git.read", "storage"]),
        )
        .await?;
    smoke.enable(SAMPLE).await?;
    let activation = smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &project)
        .await?;
    smoke
        .command(
            SAMPLE,
            &activation,
            "local.read-only-changes.refresh",
            &project,
        )
        .await?;
    extensions::activation_id(&smoke.state, "horizon.git", Some(&project))?;
    let pid = extension_host::resources(Some(&project))[0]["pid"]
        .as_u64()
        .unwrap() as u32;
    let plan = smoke
        .ext(
            "extension_preset_prepare",
            json!({"profile":"minimal","scope":"global","selectedIds":[]}),
            None,
        )
        .await?;
    check(
        plan["stopIds"]
            .as_array()
            .is_some_and(|ids| ids.contains(&json!("horizon.git")) && ids.contains(&json!(SAMPLE))),
        "minimal preset omitted Git or its actual QuickJS dependent",
    )?;
    smoke.ext("extension_preset_apply",json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":impact_decisions(&plan)}),None).await?;
    check(
        !alive(pid)
            && extension_host::resource_count(SAMPLE, None) == 0
            && git::resource_snapshot(None).is_empty(),
        "minimal preset did not reap native dependent resources",
    )?;
    check(
        smoke.state("horizon.git", None).await?["effectiveEnabled"] == false
            && smoke.state(SAMPLE, None).await?["effectiveEnabled"] == false,
        "minimal preset retained Git/dependent enable policy",
    )?;
    check(
        extensions::activation_id(&smoke.state, "horizon.git", Some(&project)).is_err(),
        "minimal preset retained Git activation lease",
    )?;
    check(
        appearance_policy(smoke).await? == appearance && document_bytes(smoke)? == documents,
        "minimal preset changed appearance or retained editor documents",
    )?;
    smoke.pass("minimal-preset-stops-real-git-dependent-and-preserves-appearance",json!({"retiredQuickJsPid":pid,"stopped":["horizon.git",SAMPLE,"horizon.terminal","horizon.launch"],"appearanceUnchanged":true,"editorDocumentsUnchanged":true}));

    let policy = registry_bytes(smoke)?;
    let plan = smoke
        .ext(
            "extension_preset_prepare",
            json!({"profile":"custom","scope":"global","selectedIds":["local.not-installed"]}),
            None,
        )
        .await?;
    check(
        plan["missingIds"] == json!(["local.not-installed"]),
        "custom preset failed to report missing package",
    )?;
    check_error(smoke.ext("extension_preset_apply",json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":impact_decisions(&plan)}),None).await,"EXTENSION_MISSING")?;
    check(
        registry_bytes(smoke)? == policy
            && document_bytes(smoke)? == documents
            && !smoke
                .state
                .data_dir()
                .join("extensions/packages/local.not-installed")
                .exists(),
        "missing-package preset installed a package or mutated policy/documents",
    )?;
    let closure = smoke
        .ext(
            "extension_preset_prepare",
            json!({"profile":"custom","scope":"global","selectedIds":[SAMPLE]}),
            None,
        )
        .await?;
    check(
        closure["selectedIds"]
            .as_array()
            .is_some_and(|ids| ids.contains(&json!(SAMPLE)) && ids.contains(&json!("horizon.git"))),
        "custom preset did not include its required Git dependency",
    )?;
    check(
        registry_bytes(smoke)? == policy,
        "reviewing custom dependency closure changed policy",
    )?;
    smoke.pass("custom-preset-reports-missing-and-dependency-closure-without-installing",json!({"missingIds":plan["missingIds"],"error":"EXTENSION_MISSING","expandedSelection":closure["selectedIds"],"policyAndDocumentsUnchanged":true}));

    let plan = smoke.ext("extension_preset_prepare",json!({"profile":"custom","scope":"project","projectId":project,"selectedIds":["horizon.terminal"]}),Some(&project)).await?;
    check(
        plan["blockers"]
            .as_array()
            .is_some_and(|items| !items.is_empty()),
        "project preset omitted global-disable blocker",
    )?;
    check_error(smoke.ext("extension_preset_apply",json!({"planId":plan["planId"],"digest":plan["digest"],"decisions":impact_decisions(&plan)}),Some(&project)).await,"DEPENDENCY_UNAVAILABLE")?;
    check(
        registry_bytes(smoke)? == policy
            && document_bytes(smoke)? == documents
            && smoke.state("horizon.terminal", Some(&project)).await?["effectiveEnabled"] == false,
        "project preset bypassed global disable or mutated state",
    )?;
    smoke.pass("project-preset-cannot-bypass-global-disable",json!({"projectId":project,"extensionId":"horizon.terminal","blockers":plan["blockers"],"error":"DEPENDENCY_UNAVAILABLE","policyAndDocumentsUnchanged":true}));
    smoke.stop(SAMPLE, "uninstall", None).await?;
    Ok(())
}

async fn exercise(smoke: &mut Smoke, temp: &Path) -> Result<()> {
    check(
        extension_host::resources(None).is_empty(),
        "initial host resources are not empty",
    )?;
    let a_dir = temp.join("project-a");
    let b_dir = temp.join("project-b");
    git_init(&a_dir, "changed-a.txt")?;
    git_init(&b_dir, "changed-b.txt")?;
    let a = smoke
        .state
        .register_project(a_dir.clone(), None, Some("Smoke A"))?["project"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let b = smoke.state.register_project(b_dir, None, Some("Smoke B"))?["project"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let package = temp.join("sample.horizon-extension");
    make_zip(
        &package,
        include_str!("../../../../packages/plugins/examples/read-only-changes/manifest.json"),
        include_str!("../../../../packages/plugins/examples/read-only-changes/index.js"),
    )?;
    smoke
        .install(&package, SAMPLE, json!(["git.read", "storage"]))
        .await?;
    smoke.enable(SAMPLE).await?;
    let first_a = smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &a)
        .await?;
    let first_b = smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &b)
        .await?;
    check(
        extension_host::resource_count(SAMPLE, None) == 2,
        "two project activations did not own two processes",
    )?;
    smoke
        .command(SAMPLE, &first_a, "local.read-only-changes.refresh", &a)
        .await?;
    smoke
        .wait_until(Duration::from_secs(1), || {
            let events = smoke.events.lock().unwrap();
            [(&a, "changed-a.txt"), (&b, "changed-b.txt")]
                .iter()
                .all(|(project, name)| {
                    events.iter().any(|event| {
                        event["projectId"] == **project
                            && event["event"] == "view"
                            && event["data"]["view"]["items"]
                                .as_array()
                                .is_some_and(|items| {
                                    items.iter().any(|item| item["label"] == *name)
                                })
                    })
                })
        })
        .await?;
    smoke.pass(
        "real-git-data-arrives-through-native-broker-and-tauri-events",
        json!({"projects":[a,b],"processes":2,"eventName":"horizon:extension:runtime:v1"}),
    );

    let old_a_pid = extension_host::resources(Some(&a))[0]["pid"]
        .as_u64()
        .unwrap() as u32;
    smoke.stop(SAMPLE, "pause", Some(&a)).await?;
    check(
        smoke.state(SAMPLE, Some(&a)).await?["effectivePaused"] == true,
        "project pause marker missing",
    )?;
    check(
        extension_host::resource_count(SAMPLE, Some(&a)) == 0 && !alive(old_a_pid),
        "paused A process not reaped",
    )?;
    check(
        extension_host::ready_count(SAMPLE, Some(&b)) == 1,
        "pausing A stopped B",
    )?;
    smoke
        .command(SAMPLE, &first_b, "local.read-only-changes.refresh", &b)
        .await?;
    let paused=smoke.ext("extension_activate",json!({"extensionId":SAMPLE,"reason":{"kind":"command","id":"local.read-only-changes.refresh"}}),Some(&a)).await;
    check(paused.is_err(), "paused project automatically reactivated")?;
    let state = smoke.state(SAMPLE, Some(&a)).await?;
    smoke.ext("extension_resume",json!({"extensionId":SAMPLE,"scope":"project","projectId":a,"expectedRevision":state["revision"]}),Some(&a)).await?;
    let resumed_a = smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &a)
        .await?;
    check(resumed_a != first_a, "resume reused revoked activation ID")?;
    smoke.pass(
        "pause-resume-reaps-a-and-preserves-b",
        json!({"retiredPid":old_a_pid,"oldActivation":first_a,"newActivation":resumed_a}),
    );

    smoke.stop(SAMPLE, "pause", Some(&a)).await?;
    extension_host::stop_all().await?;
    let restarted = HostState::new(smoke.state.data_dir().to_path_buf())?;
    extensions::initialize(&restarted)?;
    check(
        smoke.state(SAMPLE, Some(&a)).await?["effectivePaused"] == true,
        "native restart cleared persisted project pause",
    )?;
    check(
        extension_host::resources(None).is_empty(),
        "native restart retained sidecars",
    )?;
    let paused=smoke.ext("extension_activate",json!({"extensionId":SAMPLE,"reason":{"kind":"command","id":"local.read-only-changes.refresh"}}),Some(&a)).await;
    check(
        paused.is_err(),
        "persisted pause did not block activation after restart",
    )?;
    let state = smoke.state(SAMPLE, Some(&a)).await?;
    smoke.ext("extension_resume",json!({"extensionId":SAMPLE,"scope":"project","projectId":a,"expectedRevision":state["revision"]}),Some(&a)).await?;
    smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &a)
        .await?;
    smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &b)
        .await?;
    smoke.pass(
        "pause-survives-native-restart-until-explicit-resume",
        json!({"pausedProject":a,"processesAfterRestart":0,"processesAfterExplicitActivation":2}),
    );

    smoke.stop(SAMPLE, "disable", None).await?;
    check(
        extension_host::resource_count(SAMPLE, None) == 0,
        "global disable retained processes",
    )?;
    let state = smoke.state(SAMPLE, Some(&a)).await?;
    smoke.ext("extension_project_override",json!({"extensionId":SAMPLE,"projectId":a,"expectedRevision":state["revision"],"policy":"enabled"}),Some(&a)).await?;
    check(
        smoke.state(SAMPLE, Some(&a)).await?["effectiveEnabled"] == false,
        "project override bypassed global disable",
    )?;
    smoke.enable(SAMPLE).await?;
    let healthy_b = smoke
        .activate(SAMPLE, "local.read-only-changes.refresh", &b)
        .await?;
    smoke.pass(
        "global-disable-stops-both-and-cannot-be-bypassed",
        json!({"remainingAfterDisable":0}),
    );

    // Configure a controlled Git executable via the production settings API. It delays only
    // status in project A and delegates every command to real /usr/bin/git; no service or
    // broker is mocked. git.path is global, so project B must remain undelayed.
    let marker = temp.join("git-status-started");
    let wrapper = temp.join("slow-git");
    let quoted_a = fs::canonicalize(&a_dir)?.to_string_lossy().replace('\'', "'\\''");
    let quoted_marker = marker.to_string_lossy().replace('\'', "'\\''");
    let wrapper_source=format!("#!/bin/sh\nfor argument in \"$@\"; do\n if [ \"$argument\" = status ] && [ \"$(pwd -P)\" = '{quoted_a}' ]; then\n  /bin/sleep 20 &\n  horizon_delay_pid=$!\n  printf '%s %s\\n' \"$$\" \"$horizon_delay_pid\" > '{}'\n  wait \"$horizon_delay_pid\"\n fi\ndone\nexec /usr/bin/git \"$@\"\n",quoted_marker);
    fs::write(&wrapper, wrapper_source)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&wrapper, fs::Permissions::from_mode(0o700))?;
    }
    let configuration = settings::dispatch(
        smoke.state.clone(),
        call("settings_get", json!({"projectId":a}), Some(&a)),
    )?;
    check_error(
        settings::dispatch(
            smoke.state.clone(),
            call(
                "settings_patch",
                json!({"scope":"project","projectId":a,"expectedRevision":configuration["revision"],"set":{"git.path":wrapper},"unset":[]}),
                Some(&a),
            ),
        ).map_err(Into::into),
        "INVALID_ARGUMENT",
    )?;
    settings::dispatch(
        smoke.state.clone(),
        call(
            "settings_patch",
            json!({"scope":"global","expectedRevision":configuration["revision"],"set":{"git.path":wrapper},"unset":[]}),
            None,
        ),
    )?;
    let probe_manifest = json!({"id":CRASH,"name":"故障回收探针","version":"0.1.0","description":"Native integration fixture","author":"Horizon tests","apiVersion":1,"engines":{"horizon":">=0.1.0 <0.2.0"},"runtime":{"kind":"quickjs","entry":"index.js"},"activation":["onCommand:local.failure-probe.begin"],"requires":{"horizon.git":"^0.1.0"},"optional":{},"capabilities":["git.read"],"contributes":{"commands":[{"id":"local.failure-probe.begin","title":"开始真实 Git 请求"},{"id":"local.failure-probe.crash","title":"CPU 限额故障"},{"id":"local.failure-probe.echo","title":"检查隔离"}]}});
    let probe_source="export function activate(ctx){ctx.commands.register('local.failure-probe.begin',()=>{ctx.git.status().catch(()=>{});return 'started'});ctx.commands.register('local.failure-probe.crash',()=>{while(true){}});ctx.commands.register('local.failure-probe.echo',()=> 'alive')}";
    let probe = temp.join("probe.horizon-extension");
    make_zip(&probe, &probe_manifest.to_string(), probe_source)?;
    smoke.install(&probe, CRASH, json!(["git.read"])).await?;
    smoke.enable(CRASH).await?;
    let crash_a = smoke
        .activate(CRASH, "local.failure-probe.begin", &a)
        .await?;
    let crash_b = smoke
        .activate(CRASH, "local.failure-probe.begin", &b)
        .await?;
    check(
        smoke
            .command(CRASH, &crash_a, "local.failure-probe.begin", &a)
            .await?
            == "started",
        "fire-and-forget command failed",
    )?;
    smoke
        .wait_until(Duration::from_secs(3), || {
            marker.metadata().is_ok_and(|metadata| metadata.len() > 0)
                && !git::resource_snapshot(Some(&a)).is_empty()
        })
        .await?;
    let git_pid = git::resource_snapshot(Some(&a))[0]["pid"].as_u64().unwrap() as u32;
    let delayed_pids: Vec<u32> = fs::read_to_string(&marker)?
        .split_whitespace()
        .map(str::parse)
        .collect::<std::result::Result<_, _>>()?;
    check(
        delayed_pids.len() == 2 && delayed_pids.iter().all(|pid| alive(*pid)),
        "controlled Git descendants did not start",
    )?;
    let started = Instant::now();
    let failure = smoke
        .command(CRASH, &crash_a, "local.failure-probe.crash", &a)
        .await;
    check(failure.is_err(), "infinite loop did not fail")?;
    smoke
        .wait_until(Duration::from_secs(4), || {
            git::resource_snapshot(Some(&a)).is_empty()
                && !alive(git_pid)
                && delayed_pids.iter().all(|pid| !alive(*pid))
                && extension_host::resource_count(CRASH, Some(&a)) == 0
        })
        .await?;
    check(
        smoke.state(CRASH, Some(&a)).await?["runState"] == "failed",
        "native failed state missing",
    )?;
    check(
        smoke
            .command(CRASH, &crash_b, "local.failure-probe.echo", &b)
            .await?
            == "alive",
        "A crash harmed same extension in B",
    )?;
    smoke
        .command(SAMPLE, &healthy_b, "local.read-only-changes.refresh", &b)
        .await?;
    smoke.pass("cpu-failure-cancels-owned-inflight-real-git-and-preserves-b",json!({"ownedGitPid":git_pid,"ownedDescendantPids":delayed_pids,"cleanupMs":started.elapsed().as_millis(),"otherActivation":crash_b}));

    smoke.stop(CRASH, "uninstall", None).await?;
    smoke.stop(SAMPLE, "uninstall", None).await?;
    check(
        !smoke
            .state
            .data_dir()
            .join("extensions/packages")
            .join(SAMPLE)
            .exists(),
        "sample package files remain after uninstall",
    )?;
    check(
        smoke.state(SAMPLE, None).await?["installState"] == "absent",
        "sample tombstone missing",
    )?;
    check(
        extension_host::resources(None).is_empty() && git::resource_snapshot(None).is_empty(),
        "owned process resources remain",
    )?;
    check(
        smoke.pids.iter().all(|pid| !alive(*pid)),
        "reaped sidecar PID still alive",
    )?;
    smoke.pass(
        "uninstall-removes-package-and-all-owned-processes",
        json!({"sidecarPids":smoke.pids,"remainingSidecars":0,"remainingGit":0}),
    );

    let git_package = smoke
        .state
        .data_dir()
        .join("extensions/packages/horizon.git");
    check(
        git_package.is_dir(),
        "default Git package missing before uninstall",
    )?;
    smoke.stop("horizon.git", "uninstall", None).await?;
    check(
        !git_package.exists(),
        "default Git package files not removed",
    )?;
    let restarted = HostState::new(smoke.state.data_dir().to_path_buf())?;
    extensions::initialize(&restarted)?;
    check(
        !git_package.exists(),
        "restart silently restored uninstalled default package",
    )?;
    smoke
        .ext(
            "extension_restore",
            json!({"extensionId":"horizon.git"}),
            None,
        )
        .await?;
    check(
        git_package.exists(),
        "explicit restore did not restore default package files",
    )?;
    smoke.enable("horizon.git").await?;
    smoke.ext("extension_activate",json!({"extensionId":"horizon.git","reason":{"kind":"command","id":"horizon.git.open"}}),Some(&b)).await?;
    let status = git::dispatch(
        smoke.state.clone(),
        smoke.app.clone(),
        call("git_status", json!({"refresh":true}), Some(&b)),
        None,
    )
    .await?;
    check(
        status["files"]
            .as_array()
            .is_some_and(|files| files.iter().any(|file| file["path"] == "changed-b.txt")),
        "restored Git failed to read original project",
    )?;
    smoke.pass(
        "default-git-uninstall-tombstone-and-explicit-restore",
        json!({"restoredProject":b,"file":"changed-b.txt"}),
    );
    editor_stop_plan_preserves_documents(smoke, temp).await?;
    capability_presets(smoke, temp).await?;
    Ok(())
}

fn main() -> Result<()> {
    let temp = tempfile::tempdir()?;
    let state = Arc::new(HostState::new(temp.path().join("app-data"))?);
    extensions::initialize(&state)?;
    let mut context = tauri::generate_context!();
    context.config_mut().app.windows.clear();
    context.config_mut().identifier = "dev.horizon.extension-smoke".into();
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = builder
        .enable_macos_default_menu(false)
        .activate_ignoring_other_apps(false);
    let mut app = builder.build(context)?;
    #[cfg(target_os = "macos")]
    app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
    check(
        app.webview_windows().is_empty(),
        "smoke must never create a window",
    )?;
    let events = Arc::new(Mutex::new(Vec::new()));
    let capture = events.clone();
    let listener = app.listen("horizon:extension:runtime:v1", move |event| {
        if let Ok(value) = serde_json::from_str::<Value>(event.payload()) {
            capture.lock().unwrap().push(value);
        }
    });
    let mut smoke = Smoke {
        state: state.clone(),
        app: app.handle().clone(),
        events: events.clone(),
        steps: Vec::new(),
        pids: Vec::new(),
    };
    let started = Instant::now();
    let result = tauri::async_runtime::block_on(exercise(&mut smoke, temp.path()));
    let cleanup = tauri::async_runtime::block_on(async {
        extension_host::stop_all().await?;
        git::stop_resources(None).await?;
        Ok::<_, HostError>(())
    });
    app.unlisten(listener);
    let report = json!({"recordedAt":chrono::Utc::now().to_rfc3339(),"testKind":"windowless-native-integration","platform":std::env::consts::OS,"architecture":std::env::consts::ARCH,"temporaryDataDir":state.data_dir(),"windowsCreated":app.webview_windows().len(),"durationMs":started.elapsed().as_millis(),"passed":result.is_ok()&&cleanup.is_ok(),"error":result.as_ref().err().map(ToString::to_string),"cleanupError":cleanup.as_ref().err().map(ToString::to_string),"steps":smoke.steps,"events":events.lock().unwrap().clone(),"remainingSidecars":extension_host::resources(None),"remainingGit":git::resource_snapshot(None),"remainingOwnedPids":smoke.pids.iter().copied().filter(|pid|alive(*pid)).collect::<Vec<_>>(),"notCovered":["GUI clicks or rendering","Whole-application physical footprint","30-minute soak"]});
    let destination = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../../extension-host/evidence/native-smoke.json")
        });
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&destination, serde_json::to_vec_pretty(&report)?)?;
    println!("Evidence: {}", destination.display());
    result?;
    cleanup?;
    Ok(())
}
