//! Native extension registry: installation, policy, activation and revocation are authoritative here.
use crate::{Call, HostError, HostState};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::Read,
    path::{Path, PathBuf},
    sync::{Arc, Mutex, OnceLock},
};
use tauri::{ipc::Channel, AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
mod presets;

pub fn resource_profile(state: &HostState, project: Option<&str>) -> Result<Value, HostError> {
    presets::current(&read_registry(state)?, project)
}

fn err(code: &str, message: impl Into<String>) -> HostError {
    HostError::new(code, message)
}
fn io(error: impl std::fmt::Display) -> HostError {
    err("IO_ERROR", error.to_string())
}
fn lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}
fn plans() -> &'static Mutex<BTreeMap<String, Value>> {
    static PLANS: OnceLock<Mutex<BTreeMap<String, Value>>> = OnceLock::new();
    PLANS.get_or_init(|| Mutex::new(BTreeMap::new()))
}
struct SdkRequest {
    extension_id: String,
    activation_id: String,
    project_id: Option<String>,
}
fn sdk_requests() -> &'static Mutex<BTreeMap<String, SdkRequest>> {
    static REQUESTS: OnceLock<Mutex<BTreeMap<String, SdkRequest>>> = OnceLock::new();
    REQUESTS.get_or_init(Default::default)
}
struct SdkRequestGuard(String);
impl Drop for SdkRequestGuard {
    fn drop(&mut self) {
        sdk_requests().lock().unwrap().remove(&self.0);
    }
}
fn builtin_manifests() -> Vec<Value> {
    vec![
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.graphite/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.graphite/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.agent/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.celadon/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.aurora/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.mist/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.celadon/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.sand/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.editor/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.sand/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.search/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.mist/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.iris/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.orbit/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.launch/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.layout.paper/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.aurora/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.markdown/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.git/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.files/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.orbit/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.terminal/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.paper/manifest.json"
        ))
        .expect("valid builtin manifest"),
        serde_json::from_str(include_str!(
            "../../../../packages/plugins/builtins/horizon.theme.iris/manifest.json"
        ))
        .expect("valid builtin manifest"),
    ]
}
fn registry_path(state: &HostState) -> PathBuf {
    state.data_dir().join("extensions/registry.json")
}
fn initial_record(manifest: Value, builtin: bool) -> Value {
    let id = manifest["id"].as_str().unwrap_or_default();
    let enabled = !id.starts_with("horizon.layout.")
        && !id.starts_with("horizon.theme.")
        && ![
            "horizon.terminal",
            "horizon.launch",
            "horizon.agent",
            "horizon.markdown",
        ]
        .contains(&id)
        || id.ends_with(".mist");
    json!({"manifest":manifest,"revision":1,"installed":true,"enabledGlobal":enabled,"pausedGlobal":false,"projects":{},"activations":{},"errors":{},"grants":manifest["capabilities"],"builtin":builtin,"config":{},"projectConfig":{},"logs":[]})
}
fn read_registry(state: &HostState) -> Result<Value, HostError> {
    let path = registry_path(state);
    if path.exists() {
        return serde_json::from_slice(&fs::read(path).map_err(io)?).map_err(io);
    }
    let mut records = serde_json::Map::new();
    for manifest in builtin_manifests() {
        let package_dir = write_builtin_package(state, &manifest)?;
        let mut r = initial_record(manifest.clone(), true);
        r["packageDir"] = json!(package_dir);
        records.insert(manifest["id"].as_str().unwrap().to_string(), r);
    }
    let registry = json!({"schemaVersion":1,"records":records});
    write_registry(state, &registry)?;
    Ok(registry)
}
fn write_builtin_package(state: &HostState, manifest: &Value) -> Result<PathBuf, HostError> {
    let path = state
        .data_dir()
        .join("extensions/packages")
        .join(str_param(manifest, "id")?)
        .join(str_param(manifest, "version")?);
    fs::create_dir_all(&path).map_err(io)?;
    fs::write(
        path.join("manifest.json"),
        serde_json::to_vec_pretty(manifest).map_err(io)?,
    )
    .map_err(io)?;
    Ok(path)
}
pub fn initialize(state: &HostState) -> Result<(), HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    for embedded in builtin_manifests() {
        let id = str_param(&embedded, "id")?;
        let version = str_param(&embedded, "version")?;
        let expected_dir = state.data_dir().join("extensions/packages").join(id).join(version);
        let Some(record) = registry["records"].get_mut(id) else { continue; };
        if record["installed"] != true || record["builtin"] != true
            || record["manifest"]["version"] != embedded["version"]
            || record["source"].is_string() || record["development"] == true
            || record["packageDir"] != json!(expected_dir)
        { continue; }
        let description_changed = record["manifest"]["description"] != embedded["description"];
        let themes_changed = embedded["contributes"]["themes"].as_array().is_some_and(|themes| !themes.is_empty())
            && record["manifest"]["contributes"]["themes"] != embedded["contributes"]["themes"];
        if !description_changed && !themes_changed { continue; }
        // Update presentation metadata only for the unchanged bundled package.
        // Policy, grants, settings and external package declarations stay intact.
        if description_changed { record["manifest"]["description"] = embedded["description"].clone(); }
        if themes_changed { record["manifest"]["contributes"]["themes"] = embedded["contributes"]["themes"].clone(); }
        write_builtin_package(state, &record["manifest"])?;
        if record["packageDigest"].is_string() { record["packageDigest"] = json!(package_digest(&package_files(&expected_dir)?)); }
        append_log(record, "随应用更新同步内置扩展说明与主题声明");
        bump(record);
    }
    for (id, r) in registry["records"].as_object_mut().unwrap() {
        migrate_external_failure_logs(r, id);
        r["activations"] = json!({});
        r["stopping"] = json!({});
        r["runLeases"] = json!({});
        r["launchOrigins"] = json!({});
        r["directActivations"] = json!({});
    }
    write_registry(state, &registry)
}
pub async fn sleep_project(state: &HostState, project: &str) -> Result<(), HostError> {
    crate::extension_host::stop_project(project).await?;
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    for (id, r) in registry["records"].as_object_mut().unwrap() {
        if r["activations"]
            .as_object_mut()
            .unwrap()
            .remove(project)
            .is_some()
        {
            if !r["sleeping"].is_object() {
                r["sleeping"] = json!({});
            }
            r["sleeping"][project] = json!(true);
            state.release_extension_resources(id, Some(project));
            append_log(r, "项目空闲，实例已休眠");
            bump(r);
        }
    }
    write_registry(state, &registry)
}
fn write_registry(state: &HostState, registry: &Value) -> Result<(), HostError> {
    let path = registry_path(state);
    write_registry_path(&path, registry)
}
fn write_registry_path(path: &Path, registry: &Value) -> Result<(), HostError> {
    fs::create_dir_all(path.parent().unwrap()).map_err(io)?;
    let tmp = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    fs::write(&tmp, serde_json::to_vec_pretty(registry).map_err(io)?).map_err(io)?;
    fs::rename(tmp, path).map_err(io)
}
fn record<'a>(registry: &'a Value, id: &str) -> Result<&'a Value, HostError> {
    registry["records"]
        .get(id)
        .ok_or_else(|| err("EXTENSION_MISSING", format!("未安装扩展 {id}")))
}
fn record_mut<'a>(registry: &'a mut Value, id: &str) -> Result<&'a mut Value, HostError> {
    registry["records"]
        .get_mut(id)
        .ok_or_else(|| err("EXTENSION_MISSING", format!("未安装扩展 {id}")))
}
fn current_scope<'a>(call: &'a Call) -> Option<&'a str> {
    call.scope.get("projectId").and_then(Value::as_str)
}
fn key(project: Option<&str>) -> &str {
    project.unwrap_or("@app")
}
fn cleanup_error<'a>(record: &'a Value, project: Option<&str>) -> Option<&'a str> {
    record["cleanupError"].as_str()
        .or(record["cleanupErrors"]["@app"].as_str())
        .or(record["cleanupErrors"][key(project)].as_str())
}
fn set_cleanup_error(record: &mut Value, project: Option<&str>, message: Option<&str>) {
    if !record["cleanupErrors"].is_object() { record["cleanupErrors"] = json!({}); }
    if let Some(message) = message { record["cleanupErrors"][key(project)] = json!(message); }
    else if let Some(project) = project { record["cleanupErrors"].as_object_mut().unwrap().remove(project); }
    else { record["cleanupErrors"] = json!({}); record["cleanupError"] = Value::Null; }
}
fn bump(r: &mut Value) {
    r["revision"] = json!(r["revision"].as_u64().unwrap_or(0) + 1);
}
fn bump_policy(r: &mut Value) {
    r["policyRevision"] = json!(r["policyRevision"].as_u64().unwrap_or(0) + 1);
    bump(r);
}
fn expected(r: &Value, params: &Value) -> Result<(), HostError> {
    if params["expectedRevision"].as_u64() != r["revision"].as_u64() {
        return Err(err("STALE_VERSION", "扩展状态已变化，请刷新后重试"));
    }
    Ok(())
}
fn state_value(registry: &Value, id: &str, project: Option<&str>) -> Result<Value, HostError> {
    let r = record(registry, id)?;
    let p = project.and_then(|p| r["projects"].get(p));
    let policy = p.and_then(|p| p["policy"].as_str()).unwrap_or("inherit");
    let paused_global = r["pausedGlobal"].as_bool().unwrap_or(false);
    let paused_project = p.and_then(|p| p["paused"].as_bool()).unwrap_or(false);
    let enabled = r["enabledGlobal"].as_bool().unwrap_or(false) && policy != "disabled";
    let activation = &r["activations"][key(project)];
    let installed = r["installed"].as_bool().unwrap_or(false);
    let dependents = dependents_of(registry, id);
    let stopping = r["stopping"]["@app"] == true || r["stopping"][key(project)] == true;
    let runtime_error = cleanup_error(r, project).map(|message| json!({"code":"CLEANUP_FAILED","message":message})).unwrap_or_else(|| r["errors"]
        .get(key(project))
        .cloned()
        .unwrap_or(Value::Null));
    let active_count = if project.is_some() {
        usize::from(activation.is_string())
    } else {
        r["activations"].as_object().map(|a| a.len()).unwrap_or(0)
    };
    let instances:Vec<Value>=r["activations"].as_object().into_iter().flatten().map(|(project,activation)|json!({"projectId":if project=="@app"{None}else{Some(project)},"activationId":activation,"runState":"active"})).collect();
    let run_state = if cleanup_error(r, project).is_some() {
        "cleanupFailed"
    } else if stopping {
        "pausing"
    } else if runtime_error.is_object() {
        "failed"
    } else if paused_global || paused_project {
        "paused"
    } else if active_count > 0
        && r["manifest"]["runtime"]["kind"] == "quickjs"
        && crate::extension_host::ready_count(id, project) == 0
    {
        "activating"
    } else if active_count > 0 {
        "active"
    } else if r["sleeping"][key(project)] == true {
        "sleeping"
    } else {
        "stopped"
    };
    Ok(
        json!({"id":id,"revision":r["revision"],"installedVersion":if installed {r["manifest"]["version"].clone()} else {Value::Null},"installState":if installed {"installed"} else {"absent"},"pausedGlobal":paused_global,"pausedProject":paused_project,"effectivePaused":paused_global||paused_project,"enabledGlobal":r["enabledGlobal"],"projectOverride":policy,"effectiveEnabled":enabled && installed,"runState":run_state,"activationId":activation,"dependents":dependents,"ownedResourceCount":if r["manifest"]["runtime"]["kind"]=="quickjs"{crate::extension_host::resource_count(id,project)}else{active_count},"instances":instances,"uiReclaim":if installed && r["manifest"]["runtime"]["kind"]=="trusted-main" {"retainedModule"} else {"released"},"manifest":r["manifest"],"error":runtime_error,"source":r["source"],"development":r["development"],"previousVersion":r["previous"]["manifest"]["version"]}),
    )
}
pub fn manifest(state: &HostState, extension_id: &str) -> Result<Value, HostError> {
    let registry = read_registry(state)?;
    let r = record(&registry, extension_id)?;
    if r["installed"] != true {
        return Err(err("EXTENSION_MISSING", extension_id));
    }
    Ok(r["manifest"].clone())
}
pub fn contribution_owner(state: &HostState, kind: &str, id: &str) -> Result<String, HostError> {
    if !["layouts", "themes", "views", "commands"].contains(&kind) {
        return Err(err("INVALID_ARGUMENT", "未知贡献类型"));
    }
    let registry = read_registry(state)?;
    for (owner, record) in registry["records"].as_object().into_iter().flatten() {
        if record["installed"] == true
            && record["manifest"]["contributes"][kind]
                .as_array()
                .is_some_and(|items| items.iter().any(|item| item["id"] == id))
        {
            return Ok(owner.clone());
        }
    }
    Err(err("NOT_FOUND", format!("未找到已安装贡献 {id}")))
}
fn check_gate(
    registry: &Value,
    id: &str,
    project: Option<&str>,
    visiting: &mut BTreeSet<String>,
) -> Result<(), HostError> {
    if !visiting.insert(id.to_string()) {
        return Err(err("DEPENDENCY_UNAVAILABLE", "扩展依赖形成环"));
    }
    let s = state_value(registry, id, project)?;
    if s["runState"] == "cleanupFailed" {
        return Err(err(
            "RESOURCE_BUSY",
            "扩展上一次资源清理未完成，请先重试停止",
        ));
    }
    if s["installState"] != "installed" {
        return Err(err("EXTENSION_MISSING", format!("{id} 已卸载")));
    }
    if s["effectiveEnabled"] != true {
        return Err(err("EXTENSION_DISABLED", format!("{id} 已禁用")));
    }
    if s["effectivePaused"] == true {
        return Err(err("RESOURCE_BUSY", format!("{id} 已暂停，请显式恢复")));
    }
    let r = record(registry, id)?;
    if r["stopping"]["@app"] == true || r["stopping"][key(project)] == true {
        return Err(err("RESOURCE_BUSY", format!("{id} 正在停止")));
    }
    for cap in r["manifest"]["capabilities"]
        .as_array()
        .into_iter()
        .flatten()
    {
        if !r["grants"]
            .as_array()
            .map(|v| v.contains(cap))
            .unwrap_or(false)
        {
            return Err(err("PERMISSION_DENIED", format!("{id} 缺少 {cap} 授权")));
        }
    }
    if let Some(requires) = r["manifest"]["requires"].as_object() {
        for (dep, range) in requires {
            let dependency = record(registry, dep)?;
            let installed = dependency["manifest"]["version"].as_str().unwrap_or("");
            if !version_matches(installed, range.as_str().unwrap_or("")) {
                return Err(err(
                    "DEPENDENCY_UNAVAILABLE",
                    format!("{id} 的依赖 {dep} 版本不满足 {range}"),
                ));
            }
            check_gate(registry, dep, project, visiting)?;
        }
    }
    visiting.remove(id);
    Ok(())
}
pub fn extension_gate(
    state: &HostState,
    extension_id: &str,
    project_id: Option<&str>,
) -> Result<(), HostError> {
    check_gate(
        &read_registry(state)?,
        extension_id,
        project_id,
        &mut BTreeSet::new(),
    )
}
pub fn activation_id(
    state: &HostState,
    id: &str,
    project: Option<&str>,
) -> Result<String, HostError> {
    let registry = read_registry(state)?;
    check_gate(&registry, id, project, &mut BTreeSet::new())?;
    record(&registry, id)?["activations"][key(project)]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| err("NOT_FOUND", "扩展尚未激活"))
}
pub fn acquire_launch_requirements(
    state: &HostState,
    project: &str,
    ids: &[String],
    run_id: &str,
) -> Result<Value, HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    let mut ordered = Vec::new();
    let mut seen = BTreeSet::new();
    fn visit(
        registry: &Value,
        id: &str,
        project: &str,
        seen: &mut BTreeSet<String>,
        ordered: &mut Vec<String>,
    ) -> Result<(), HostError> {
        if !seen.insert(id.to_string()) {
            return Ok(());
        }
        check_gate(registry, id, Some(project), &mut BTreeSet::new())?;
        for (dep, _) in record(registry, id)?["manifest"]["requires"]
            .as_object()
            .into_iter()
            .flatten()
        {
            visit(registry, dep, project, seen, ordered)?;
        }
        ordered.push(id.to_string());
        Ok(())
    }
    for id in ids {
        visit(&registry, id, project, &mut seen, &mut ordered)?;
    }
    let mut leases = Vec::new();
    for id in ordered {
        let r = record_mut(&mut registry, &id)?;
        let created = !r["activations"][project].is_string();
        if created {
            r["activations"][project] = json!(uuid::Uuid::new_v4().to_string());
            if !r["launchOrigins"].is_object() {
                r["launchOrigins"] = json!({});
            }
            r["launchOrigins"][project] = json!({"activationId":r["activations"][project],"policyRevision":r["policyRevision"].as_u64().unwrap_or(0)});
        }
        if !r["runLeases"].is_object() {
            r["runLeases"] = json!({});
        }
        if !r["runLeases"][project].is_object() {
            r["runLeases"][project] = json!({});
        }
        r["runLeases"][project][run_id] = json!({"activationId":r["activations"][project]});
        bump(r);
        leases.push(json!({"extensionId":id,"activationId":r["activations"][project],"createdForRun":created}));
    }
    write_registry(state, &registry)?;
    Ok(json!({"items":leases}))
}
pub async fn release_launch_requirements(
    state: &HostState,
    project: &str,
    run_id: &str,
) -> Result<(), HostError> {
    let candidates = {
        let _guard = lock().lock().unwrap();
        let mut registry = read_registry(state)?;
        let mut candidates = Vec::new();
        let process_snapshot = crate::processes::resources(Some(project));
        for (id, r) in registry["records"].as_object_mut().unwrap() {
            let Some(leases) = r["runLeases"][project].as_object_mut() else {
                continue;
            };
            if leases.remove(run_id).is_none() {
                continue;
            }
            let empty = leases.is_empty();
            let has_resources = process_snapshot["items"].as_array().is_some_and(|items| {
                items.iter().any(|resource| {
                    resource["ownerExtensionId"] == id.as_str()
                        || resource["requiresExtensions"]
                            .as_array()
                            .is_some_and(|requires| requires.contains(&json!(id)))
                })
            }) || (id == "horizon.git"
                && !crate::git::resource_snapshot(Some(project)).is_empty());
            if empty
                && !has_resources
                && r["launchOrigins"][project]["activationId"].is_string()
                && r["launchOrigins"][project]["activationId"] == r["activations"][project]
                && r["directActivations"][project] != r["activations"][project]
                && r["launchOrigins"][project]["policyRevision"].as_u64()
                    == Some(r["policyRevision"].as_u64().unwrap_or(0))
                && r["stopping"]["@app"] != true
                && r["stopping"][project] != true
            {
                candidates.push((id.clone(), r["activations"][project].clone()));
                if !r["stopping"].is_object() {
                    r["stopping"] = json!({});
                }
                r["stopping"][project] = json!(true);
            }
            bump(r);
        }
        candidates.sort_by_key(|(id, _)| dependents_of(&registry, id).len());
        write_registry(state, &registry)?;
        candidates
    };
    for (id, activation) in candidates.clone() {
        if let Err(error) = crate::extension_host::stop(&id, Some(project)).await {
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(state)?;
            for (pending, lease) in &candidates {
                let r = record_mut(&mut registry, pending)?;
                if r["activations"][project] == *lease {
                    r["runLeases"][project][run_id] = json!({"activationId":lease});
                    r["stopping"][project] = json!(false);
                    set_cleanup_error(r, Some(project), Some(&error.message));
                    bump(r);
                }
            }
            write_registry(state, &registry)?;
            return Err(error);
        }
        state.release_extension_resources(&id, Some(project));
        let _guard = lock().lock().unwrap();
        let mut registry = read_registry(state)?;
        let r = record_mut(&mut registry, &id)?;
        if r["activations"][project] == activation {
            r["activations"].as_object_mut().unwrap().remove(project);
            r["launchOrigins"].as_object_mut().unwrap().remove(project);
            if !r["sleeping"].is_object() {
                r["sleeping"] = json!({});
            }
            r["sleeping"][project] = json!(true);
        }
        r["stopping"][project] = json!(false);
        set_cleanup_error(r, Some(project), None);
        bump(r);
        write_registry(state, &registry)?;
    }
    Ok(())
}
pub fn validate_requirement(
    state: &HostState,
    id: &str,
    range: &str,
    project: Option<&str>,
) -> Result<(), HostError> {
    extension_gate(state, id, project)?;
    let manifest = manifest(state, id)?;
    let version = manifest["version"].as_str().unwrap_or("");
    if !version_matches(version, range) {
        return Err(err(
            "DEPENDENCY_UNAVAILABLE",
            format!("{id} 需要 {range}，当前 {version}"),
        ));
    }
    Ok(())
}
fn version_matches(version: &str, range: &str) -> bool {
    if range == "*" || range == version {
        return true;
    }
    if let Some(min) = range.strip_prefix('^') {
        let parse = |s: &str| {
            s.split('.')
                .map(str::parse::<u32>)
                .collect::<Result<Vec<_>, _>>()
        };
        if let (Ok(v), Ok(m)) = (parse(version), parse(min)) {
            return v.len() == 3
                && m.len() == 3
                && v >= m
                && v[0] == m[0]
                && (m[0] > 0 || v[1] == m[1])
                && (m[0] > 0 || m[1] > 0 || v[2] == m[2]);
        }
    }
    false
}
fn dependents_of(registry: &Value, id: &str) -> Vec<String> {
    fn visit(registry: &Value, id: &str, visited: &mut BTreeSet<String>, out: &mut Vec<String>) {
        for (other, record) in registry["records"].as_object().into_iter().flatten() {
            if record["installed"] == true
                && record["manifest"]["requires"].get(id).is_some()
                && visited.insert(other.clone())
            {
                visit(registry, other, visited, out);
                out.push(other.clone());
            }
        }
    }
    let mut out = Vec::new();
    let mut visited = BTreeSet::from([id.to_string()]);
    visit(registry, id, &mut visited, &mut out);
    out
}

fn digest(value: &[u8]) -> String {
    format!("{:x}", Sha256::digest(value))
}
fn str_param<'a>(p: &'a Value, name: &str) -> Result<&'a str, HostError> {
    p[name]
        .as_str()
        .ok_or_else(|| err("INVALID_ARGUMENT", format!("缺少 {name}")))
}
fn valid_id(id: &str) -> bool {
    id.len() >= 3
        && id.len() <= 128
        && id.as_bytes()[0].is_ascii_lowercase()
        && id
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'.' || b == b'-')
}
fn validate_manifest(m: &Value, trusted: bool) -> Result<(), HostError> {
    let id = str_param(m, "id")?;
    if !valid_id(id) || m["apiVersion"] != 1 {
        return Err(err("INVALID_ARGUMENT", "扩展 ID 或 API 版本无效"));
    }
    let allowed = [
        "id",
        "name",
        "version",
        "description",
        "author",
        "apiVersion",
        "engines",
        "runtime",
        "activation",
        "requires",
        "optional",
        "capabilities",
        "contributes",
    ];
    if m.as_object()
        .map(|o| o.keys().any(|k| !allowed.contains(&k.as_str())))
        .unwrap_or(true)
    {
        return Err(err("INVALID_ARGUMENT", "清单包含未知字段"));
    }
    let version = str_param(m, "version")?;
    if version.split('.').count() != 3 || version.split('.').any(|v| v.parse::<u32>().is_err()) {
        return Err(err("INVALID_ARGUMENT", "扩展版本格式无效"));
    }
    if m["engines"]["horizon"] != ">=0.1.0 <0.2.0" {
        return Err(err("PROTOCOL_UNSUPPORTED", "扩展与 Horizon 0.1 不兼容"));
    }
    let kind = str_param(&m["runtime"], "kind")?;
    if (m["contributes"]["layouts"]
        .as_array()
        .is_some_and(|items| !items.is_empty())
        || m["contributes"]["themes"]
            .as_array()
            .is_some_and(|items| !items.is_empty()))
        && kind != "declarative"
    {
        return Err(err(
            "INVALID_ARGUMENT",
            "布局与主题包必须为无代码的声明式运行时",
        ));
    }
    crate::protocol::allowed(&m["runtime"], &["kind", "entry"])?;
    crate::protocol::allowed(
        &m["contributes"],
        &["commands", "views", "layouts", "themes", "settings"],
    )?;
    if !["declarative", "quickjs", "trusted-main"].contains(&kind)
        || (!trusted && kind == "trusted-main")
    {
        return Err(err(
            "PERMISSION_DENIED",
            "本地第三方包只支持声明式或独立 QuickJS 运行时",
        ));
    }
    if !trusted && id.starts_with("horizon.") {
        return Err(err("PERMISSION_DENIED", "horizon 命名空间仅用于可信默认包"));
    }
    for cap in m["capabilities"]
        .as_array()
        .ok_or_else(|| err("INVALID_ARGUMENT", "capabilities 必须是数组"))?
    {
        if !trusted
            && !["project.read", "git.read", "storage"].contains(&cap.as_str().unwrap_or(""))
        {
            return Err(err("PERMISSION_DENIED", format!("第三方 SDK 不提供 {cap}")));
        }
    }
    if kind == "declarative" && m["runtime"].get("entry").is_some() {
        return Err(err("INVALID_ARGUMENT", "声明式扩展不可包含代码入口"));
    }
    if kind == "quickjs" {
        let entry = str_param(&m["runtime"], "entry")?;
        if entry.contains("..") || Path::new(entry).is_absolute() || !entry.ends_with(".js") {
            return Err(err("INVALID_ARGUMENT", "JS 入口必须位于包内"));
        }
    }
    for layout in m["contributes"]["layouts"].as_array().into_iter().flatten() {
        owned_contribution(id, layout)?;
        validate_layout(layout)?;
    }
    for theme in m["contributes"]["themes"].as_array().into_iter().flatten() {
        owned_contribution(id, theme)?;
        validate_theme(theme)?;
    }
    let mut contributions = BTreeSet::new();
    for category in ["commands", "views"] {
        for contribution in m["contributes"][category].as_array().into_iter().flatten() {
            owned_contribution(id, contribution)?;
            let contribution_id = str_param(contribution, "id")?;
            if !contributions.insert(contribution_id) {
                return Err(err("INVALID_ARGUMENT", "贡献点 ID 重复"));
            }
            if category == "views" {
                if ![
                    "navigation",
                    "primarySidebar",
                    "editor",
                    "auxiliary",
                    "bottom",
                    "status",
                ]
                .contains(&contribution["slot"].as_str().unwrap_or(""))
                    || (!trusted && contribution["renderer"] != "declarative")
                {
                    return Err(err("PERMISSION_DENIED", "无效或不允许的视图贡献"));
                }
            }
        }
    }
    Ok(())
}
fn owned_contribution(package: &str, contribution: &Value) -> Result<(), HostError> {
    let id = str_param(contribution, "id")?;
    if id != package && !id.starts_with(&format!("{package}.")) {
        return Err(err("PERMISSION_DENIED", "贡献点必须属于扩展自己的命名空间"));
    }
    Ok(())
}
fn validate_layout(layout: &Value) -> Result<(), HostError> {
    crate::protocol::allowed(
        layout,
        &[
            "id",
            "apiVersion",
            "label",
            "navigation",
            "root",
            "requiredSlots",
            "geometry",
            "narrow",
        ],
    )?;
    if layout["apiVersion"] != 1
        || ![
            "rail",
            "unified",
            "tabs",
            "compact",
            "drawer",
            "expressive",
            "expanded",
            "dock",
        ]
        .contains(&layout["navigation"].as_str().unwrap_or(""))
    {
        return Err(err("INVALID_ARGUMENT", "布局版本或导航构件无效"));
    }
    let limits = [
        ("sidebarWidth", 160., 480.),
        ("navigationWidth", 48., 280.),
        ("topbarHeight", 40., 88.),
        ("tabHeight", 28., 64.),
        ("tabMinWidth", 80., 240.),
        ("auxiliaryWidth", 240., 560.),
        ("bottomHeight", 120., 480.),
        ("statusHeight", 20., 40.),
        ("uiFontSize", 11., 20.),
        ("codeFontSize", 10., 28.),
    ];
    for (name, rule) in layout["geometry"]
        .as_object()
        .ok_or_else(|| err("INVALID_ARGUMENT", "布局缺少尺寸声明"))?
    {
        let (_, lower, upper) = limits
            .iter()
            .find(|(key, _, _)| name == key)
            .ok_or_else(|| err("INVALID_ARGUMENT", "未知布局尺寸"))?;
        crate::protocol::allowed(rule, &["initial", "min", "max", "step"])?;
        let min = rule["min"].as_f64().unwrap_or(f64::NAN);
        let max = rule["max"].as_f64().unwrap_or(f64::NAN);
        let initial = rule["initial"].as_f64().unwrap_or(f64::NAN);
        let step = rule["step"].as_f64().unwrap_or(0.);
        if !min.is_finite()
            || !max.is_finite()
            || !initial.is_finite()
            || min < *lower
            || max > *upper
            || initial < min
            || initial > max
            || step <= 0.
        {
            return Err(err("INVALID_ARGUMENT", "布局尺寸超出公共范围"));
        }
    }
    fn walk(
        n: &Value,
        depth: usize,
        ids: &mut BTreeSet<String>,
        slots: &mut Vec<String>,
        geometry: &Value,
    ) -> Result<(), HostError> {
        let id = str_param(n, "id")?;
        if depth > 8 || ids.len() >= 64 || !ids.insert(id.to_string()) {
            return Err(err("INVALID_ARGUMENT", "布局节点重复或超出限制"));
        }
        match n["kind"].as_str().unwrap_or("") {
            "row" | "column" => {
                for child in n["children"]
                    .as_array()
                    .ok_or_else(|| err("INVALID_ARGUMENT", "布局 children 无效"))?
                {
                    walk(child, depth + 1, ids, slots, geometry)?;
                }
            }
            "slot" => {
                slots.push(str_param(n, "slot")?.to_string());
                if let Some(s) = n["sizing"].as_str() {
                    if geometry.get(s).is_none() {
                        return Err(err("INVALID_ARGUMENT", "布局引用未声明尺寸"));
                    }
                }
            }
            "tabs" => {
                for s in n["slots"]
                    .as_array()
                    .ok_or_else(|| err("INVALID_ARGUMENT", "tabs 无插槽"))?
                {
                    slots.push(
                        s.as_str()
                            .ok_or_else(|| err("INVALID_ARGUMENT", "slot 无效"))?
                            .to_string(),
                    );
                }
            }
            _ => return Err(err("INVALID_ARGUMENT", "未知布局节点")),
        };
        Ok(())
    }
    let mut ids = BTreeSet::new();
    let mut slots = Vec::new();
    walk(
        &layout["root"],
        1,
        &mut ids,
        &mut slots,
        &layout["geometry"],
    )?;
    if slots.iter().filter(|s| s.as_str() == "editor").count() != 1
        || slots.iter().collect::<BTreeSet<_>>().len() != slots.len()
        || slots.iter().any(|s| {
            ![
                "navigation",
                "primarySidebar",
                "editor",
                "auxiliary",
                "bottom",
                "status",
            ]
            .contains(&s.as_str())
        })
    {
        return Err(err(
            "INVALID_ARGUMENT",
            "布局必须有一个编辑区且无重复或宿主插槽",
        ));
    }
    for s in layout["requiredSlots"].as_array().into_iter().flatten() {
        if !slots.iter().any(|slot| Some(slot.as_str()) == s.as_str()) {
            return Err(err("INVALID_ARGUMENT", "缺少必需插槽"));
        }
    }
    Ok(())
}
fn validate_theme(theme: &Value) -> Result<(), HostError> {
    crate::protocol::allowed(
        theme,
        &[
            "id",
            "apiVersion",
            "label",
            "light",
            "dark",
            "radius",
            "density",
        ],
    )?;
    if theme["apiVersion"] != 1
        || !theme["radius"]
            .as_f64()
            .is_some_and(|r| (0.0..=40.0).contains(&r))
        || !["compact", "comfortable", "spacious"]
            .contains(&theme["density"].as_str().unwrap_or(""))
    {
        return Err(err("INVALID_ARGUMENT", "主题版本、圆角或密度无效"));
    }
    let tokens = [
        "background",
        "surface",
        "text",
        "muted",
        "border",
        "accent",
        "onAccent",
        "selection",
        "success",
        "warning",
        "error",
    ];
    for mode in ["light", "dark"] {
        let colors = theme[mode]
            .as_object()
            .ok_or_else(|| err("INVALID_ARGUMENT", "主题缺少颜色模式"))?;
        if colors.len() != tokens.len() {
            return Err(err("INVALID_ARGUMENT", "主题包含未知令牌"));
        }
        for token in tokens {
            let c = colors.get(token).and_then(Value::as_str).unwrap_or("");
            if c.len() != 7 || !c.starts_with('#') || !c[1..].bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err(err("INVALID_ARGUMENT", "主题颜色必须为六位 HEX"));
            }
        }
    }
    Ok(())
}
fn package_files(path: &Path) -> Result<Vec<(PathBuf, Vec<u8>)>, HostError> {
    if path.is_file() {
        if fs::metadata(path).map_err(io)?.len() > 28 * 1024 * 1024 {
            return Err(err("RESOURCE_LIMIT", "扩展归档超过 28 MiB"));
        }
        let mut archive = zip::ZipArchive::new(fs::File::open(path).map_err(io)?)
            .map_err(|e| err("INVALID_ARGUMENT", format!("无效 ZIP 扩展包: {e}")))?;
        if archive.len() > 256 {
            return Err(err("RESOURCE_LIMIT", "扩展包最多 256 个条目"));
        }
        let mut files = Vec::new();
        let mut total = 0usize;
        let mut names = BTreeSet::new();
        for index in 0..archive.len() {
            let mut entry = archive
                .by_index(index)
                .map_err(|e| err("INVALID_ARGUMENT", format!("无法读取 ZIP 条目: {e}")))?;
            let name = entry.name().replace('\\', "/");
            if entry.enclosed_name().is_none()
                || name.starts_with('/')
                || name.as_bytes().get(1) == Some(&b':')
                || name.contains('\0')
            {
                return Err(err("INVALID_ARGUMENT", "归档包含绝对路径或路径穿越"));
            }
            let relative = PathBuf::from(&name);
            if relative
                .components()
                .any(|component| !matches!(component, std::path::Component::Normal(_)))
            {
                return Err(err("INVALID_ARGUMENT", "归档包含不规范路径"));
            }
            if entry
                .unix_mode()
                .is_some_and(|mode| mode & 0o170000 == 0o120000)
            {
                return Err(err("INVALID_ARGUMENT", "扩展归档不能包含符号链接"));
            }
            if entry.is_dir() {
                continue;
            }
            if !names.insert(name.to_lowercase()) {
                return Err(err("INVALID_ARGUMENT", "归档路径重复或大小写冲突"));
            }
            if entry.size() > 4 * 1024 * 1024 {
                return Err(err("RESOURCE_LIMIT", "单个扩展文件超过 4 MiB"));
            }
            let mut bytes = Vec::new();
            entry
                .by_ref()
                .take(4 * 1024 * 1024 + 1)
                .read_to_end(&mut bytes)
                .map_err(io)?;
            total += bytes.len();
            if bytes.len() > 4 * 1024 * 1024 || total > 20 * 1024 * 1024 {
                return Err(err("RESOURCE_LIMIT", "扩展包解压后超过限制"));
            }
            files.push((relative, bytes));
        }
        files.sort_by(|a, b| a.0.cmp(&b.0));
        return Ok(files);
    }
    fn collect(
        base: &Path,
        path: &Path,
        out: &mut Vec<(PathBuf, Vec<u8>)>,
        total: &mut usize,
    ) -> Result<(), HostError> {
        if path
            .components()
            .count()
            .saturating_sub(base.components().count())
            > 16
        {
            return Err(err("RESOURCE_LIMIT", "扩展包目录超过 16 层"));
        }
        for entry in fs::read_dir(path).map_err(io)? {
            let entry = entry.map_err(io)?;
            let meta = fs::symlink_metadata(entry.path()).map_err(io)?;
            if meta.file_type().is_symlink() {
                return Err(err("INVALID_ARGUMENT", "扩展包不能含符号链接"));
            }
            if meta.is_dir() {
                collect(base, &entry.path(), out, total)?;
            } else if meta.is_file() {
                if out.len() >= 256 || meta.len() > 4 * 1024 * 1024 {
                    return Err(err("RESOURCE_LIMIT", "扩展包超出文件限制"));
                }
                let bytes = fs::read(entry.path()).map_err(io)?;
                *total += bytes.len();
                if *total > 20 * 1024 * 1024 {
                    return Err(err("RESOURCE_LIMIT", "扩展包超过 20 MiB"));
                }
                out.push((
                    entry.path().strip_prefix(base).map_err(io)?.to_path_buf(),
                    bytes,
                ));
            }
        }
        Ok(())
    }
    let mut files = Vec::new();
    collect(path, path, &mut files, &mut 0)?;
    files.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(files)
}
fn package_digest(files: &[(PathBuf, Vec<u8>)]) -> String {
    let mut h = Sha256::new();
    for (path, bytes) in files {
        h.update(path.to_string_lossy().as_bytes());
        h.update([0]);
        h.update((bytes.len() as u64).to_be_bytes());
        h.update(bytes);
    }
    format!("{:x}", h.finalize())
}
fn save_plan(mut plan: Value) -> Value {
    let id = uuid::Uuid::new_v4().to_string();
    let hash = digest(serde_json::to_string(&plan).unwrap().as_bytes());
    plan["planId"] = json!(id);
    plan["digest"] = json!(hash);
    plan["createdAt"] = json!(chrono::Utc::now().timestamp());
    let mut plans = plans().lock().unwrap();
    plans
        .retain(|_, p| chrono::Utc::now().timestamp() - p["createdAt"].as_i64().unwrap_or(0) < 600);
    if plans.len() >= 128 {
        let first = plans.keys().next().cloned();
        if let Some(first) = first {
            plans.remove(&first);
        }
    }
    plans.insert(id, plan.clone());
    plan
}
fn get_plan(params: &Value, kind: &str) -> Result<Value, HostError> {
    let id = str_param(params, "planId")?;
    let plan = plans()
        .lock()
        .unwrap()
        .get(id)
        .cloned()
        .ok_or_else(|| err("STALE_VERSION", "操作计划已过期"))?;
    if plan["kind"] != kind
        || plan["digest"] != params["digest"]
        || chrono::Utc::now().timestamp() - plan["createdAt"].as_i64().unwrap_or(0) > 600
    {
        return Err(err("STALE_VERSION", "操作计划已变化或过期"));
    }
    Ok(plan)
}
fn consume_plan(plan: &Value) {
    if let Some(id) = plan["planId"].as_str() {
        plans().lock().unwrap().remove(id);
    }
}
struct PlanGuard(String);
impl PlanGuard {
    fn claim(plan: &Value) -> Result<Self, HostError> {
        let id = str_param(plan, "planId")?;
        let mut plans = plans().lock().unwrap();
        let stored = plans
            .get_mut(id)
            .ok_or_else(|| err("STALE_VERSION", "操作计划已过期"))?;
        if stored["executing"] == true {
            return Err(err("RESOURCE_BUSY", "此计划正在执行"));
        }
        stored["executing"] = json!(true);
        Ok(Self(id.to_string()))
    }
}
impl Drop for PlanGuard {
    fn drop(&mut self) {
        if let Some(plan) = plans().lock().unwrap().get_mut(&self.0) {
            plan["executing"] = json!(false);
        }
    }
}
fn changed<R: tauri::Runtime>(app: &AppHandle<R>, id: &str) {
    let _ = app.emit("horizon:extension:v1", json!({"extensionId":id}));
}
fn append_log(r: &mut Value, action: &str) {
    if !r["logs"].is_array() {
        r["logs"] = json!([]);
    }
    let logs = r["logs"].as_array_mut().unwrap();
    logs.push(json!({"time":chrono::Utc::now().to_rfc3339(),"message":action}));
    if logs.len() > 100 {
        logs.remove(0);
    }
}
const EXTERNAL_FAILURE_MESSAGE: &str = "扩展执行失败。原始异常内容未写入日志；请重试或停用该扩展。";
const LEGACY_FAILURE_MESSAGE: &str = "旧扩展诊断的原始内容已隐藏。";
fn external_failure_summary(id: &str, activation: Option<&str>, project: Option<&str>) -> Value {
    json!({"code":"EXTENSION_FAILED","reason":"runtimeFailure","message":EXTERNAL_FAILURE_MESSAGE,
        "extensionId":id,"activationId":activation,"projectId":project,"detailsOmitted":true})
}
fn known_host_lifecycle_message(message: &str) -> bool {
    matches!(message,
        "随应用更新同步内置扩展说明与主题声明" | "项目空闲，实例已休眠" |
        "安装包校验和复制完成" | "更新未完成，保留旧版本" |
        "作为显式激活的必需依赖启动" | "实例按需激活" | "已回退到上一个校验版本" |
        "pause" | "disable" | "uninstall" | "sleep" | "stop" |
        "应用能力预设 minimal" | "应用能力预设 review" | "应用能力预设 development" | "应用能力预设 custom" |
        "Git 进程尚未退出，请重试停止" | EXTERNAL_FAILURE_MESSAGE | LEGACY_FAILURE_MESSAGE)
}
fn migrate_external_failure_logs(record: &mut Value, id: &str) {
    if record["manifest"]["runtime"]["kind"] != "quickjs" || record["runtimeLogPrivacyVersion"] == 1 { return; }
    if let Some(errors) = record["errors"].as_object_mut() {
        for (scope, failure) in errors {
            if failure["code"] == "EXTENSION_FAILED" {
                // Legacy failures did not retain a verified activation ID. Do not invent one.
                *failure = external_failure_summary(id, None, (scope != "@app").then_some(scope.as_str()));
            }
        }
    }
    if let Some(logs) = record["logs"].as_array_mut() {
        for entry in logs {
            let time = entry["time"].as_str().filter(|time| chrono::DateTime::parse_from_rfc3339(time).is_ok()).map(|time| json!(time)).unwrap_or(Value::Null);
            let message = entry["message"].as_str().unwrap_or("");
            // Only whole, fixed host messages survive. Prefixes could contain plugin source or secrets.
            *entry = if known_host_lifecycle_message(message) { json!({"time":time,"message":message}) }
                else { json!({"time":time,"message":LEGACY_FAILURE_MESSAGE,"code":"EXTENSION_DIAGNOSTIC_REDACTED","reason":"legacyRuntimeDiagnostic","extensionId":id}) };
        }
    }
    record["runtimeLogPrivacyVersion"] = json!(1);
}
fn append_external_failure_log(record: &mut Value, summary: &Value) {
    if !record["logs"].is_array() { record["logs"] = json!([]); }
    let mut entry = summary.clone();
    entry["time"] = json!(chrono::Utc::now().to_rfc3339());
    entry["event"] = json!("runtimeFailure");
    let logs = record["logs"].as_array_mut().unwrap();
    logs.push(entry);
    if logs.len() > 100 { logs.remove(0); }
}
fn log_snapshot(record: &Value, project: Option<&str>) -> Value {
    json!({"items":record["logs"],"error":record["errors"][key(project)],"cleanupError":cleanup_error(record, project)})
}
fn transition(
    state: &HostState,
    app: &AppHandle,
    id: &str,
    project: Option<&str>,
    stopping: bool,
) -> Result<(), HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    let r = record_mut(&mut registry, id)?;
    if stopping
        && (r["stopping"]["@app"] == true || r["stopping"][key(project)] == true)
        && cleanup_error(r, project).is_none()
    {
        return Err(err("RESOURCE_BUSY", "扩展正在执行另一个停止或更新操作"));
    }
    if !r["stopping"].is_object() {
        r["stopping"] = json!({});
    }
    r["stopping"][key(project)] = json!(stopping);
    write_registry(state, &registry)?;
    changed(app, id);
    Ok(())
}
fn dependency_check(registry: &Value, m: &Value) -> Result<(), HostError> {
    let package_id = str_param(m, "id")?;
    for (consumer, record) in registry["records"].as_object().into_iter().flatten() {
        if consumer != package_id && record["installed"] == true {
            if let Some(range) = record["manifest"]["requires"]
                .get(package_id)
                .and_then(Value::as_str)
            {
                if !version_matches(m["version"].as_str().unwrap_or(""), range) {
                    return Err(err(
                        "DEPENDENCY_UNAVAILABLE",
                        format!("更新不满足 {consumer} 对 {package_id} 的版本要求 {range}"),
                    ));
                }
            }
        }
    }
    let contributed: BTreeSet<&str> = ["layouts", "themes", "views", "commands"]
        .iter()
        .flat_map(|kind| m["contributes"][kind].as_array().into_iter().flatten())
        .filter_map(|item| item["id"].as_str())
        .collect();
    for (other, record) in registry["records"].as_object().into_iter().flatten() {
        if other != package_id && record["installed"] == true {
            for kind in ["layouts", "themes", "views", "commands"] {
                if record["manifest"]["contributes"][kind]
                    .as_array()
                    .into_iter()
                    .flatten()
                    .filter_map(|item| item["id"].as_str())
                    .any(|id| contributed.contains(id))
                {
                    return Err(err(
                        "INVALID_ARGUMENT",
                        format!("贡献点 ID 与已安装扩展 {other} 冲突"),
                    ));
                }
            }
        }
    }
    fn visit(reg: &Value, m: &Value, stack: &mut BTreeSet<String>) -> Result<(), HostError> {
        let id = str_param(m, "id")?;
        if !stack.insert(id.to_string()) {
            return Err(err("DEPENDENCY_UNAVAILABLE", format!("依赖环: {id}")));
        }
        for (dep, range) in m["requires"].as_object().into_iter().flatten() {
            let r = record(reg, dep)?;
            if r["installed"] != true {
                return Err(err("DEPENDENCY_UNAVAILABLE", format!("缺少依赖 {dep}")));
            }
            let v = r["manifest"]["version"].as_str().unwrap_or("");
            let range = range.as_str().unwrap_or("");
            if !version_matches(v, range) {
                return Err(err(
                    "DEPENDENCY_UNAVAILABLE",
                    format!("依赖版本不匹配 {dep}"),
                ));
            }
            visit(reg, &r["manifest"], stack)?;
        }
        stack.remove(id);
        Ok(())
    }
    visit(registry, m, &mut BTreeSet::new())
}
async fn stop_resources(id: &str, project: Option<&str>) -> Result<(), HostError> {
    let requests: Vec<String> = sdk_requests()
        .lock()
        .unwrap()
        .iter()
        .filter(|(_, owner)| {
            owner.extension_id == id && (project.is_none() || owner.project_id.as_deref() == project)
        })
        .map(|(id, _)| id.clone())
        .collect();
    if !requests.is_empty() {
        crate::git::stop_requests(&requests).await?;
    }
    crate::extension_host::stop(id, project).await?;
    if id == "horizon.git" {
        crate::git::stop_resources(project).await?;
    }
    if id == "horizon.search" {
        crate::search::stop_resources(project).await?;
    }
    if id == "horizon.agent" {
        crate::agent::stop_extension(id, project).await?;
    }
    if id == "horizon.terminal" || id == "horizon.launch" {
        crate::processes::stop_extension(id, project)?;
    }
    Ok(())
}
fn stop_impact(state: &HostState, registry: &Value, ids: &[String], project: Option<&str>) -> Value {
    let documents = if ids.iter().any(|id| id == "horizon.editor") { state.dirty_documents(project) } else { vec![] };
    let requests: BTreeMap<String, String> = sdk_requests().lock().unwrap().iter()
        .filter(|(_, request)| ids.contains(&request.extension_id) && project.is_none_or(|project| request.project_id.as_deref() == Some(project)))
        .map(|(request, owner)| (request.clone(), owner.extension_id.clone())).collect();
    let mut seen = BTreeSet::new();
    let resources: Vec<Value> = crate::projects::resources(project).into_iter().filter_map(|mut resource| {
        let requested_by = resource["requestId"].as_str().and_then(|id| requests.get(id));
        let affected = resource["ownerExtensionId"].as_str().is_some_and(|owner| ids.iter().any(|id| id == owner))
            || resource["requiresExtensions"].as_array().is_some_and(|requires| ids.iter().any(|id| requires.contains(&json!(id))))
            || requested_by.is_some();
        if !affected || !seen.insert(resource["resourceId"].clone().to_string()) { return None; }
        if let Some(owner) = requested_by { resource["requestedByExtensionId"] = json!(owner); }
        Some(resource)
    }).collect();
    let projects: Vec<Value> = state.registry.lock().unwrap().projects.iter()
        .filter(|item| project.is_none_or(|id| item["id"] == id)).cloned().collect();
    let names: serde_json::Map<String, Value> = registry["records"].as_object().into_iter().flatten()
        .map(|(id, item)| (id.clone(), item["manifest"]["name"].clone())).collect();
    let revisions: serde_json::Map<String, Value> = ids.iter().map(|id| (id.clone(), registry["records"][id]["revision"].clone())).collect();
    json!({"extensionIds":ids,"extensionNames":names,"revisions":revisions,"resources":resources,"documents":documents,"dirtyDocuments":documents,"projects":projects})
}
fn validate_impact_documents(state: &HostState, plan: &Value, decisions: &[Value]) -> Result<(), HostError> {
    crate::projects::validate_close_decisions(plan, decisions)?;
    state.validate_document_decisions(decisions)?;
    let editor = plan["extensionIds"].as_array().is_some_and(|ids| ids.contains(&json!("horizon.editor")));
    if !editor { return Ok(()); }
    for document in state.dirty_documents(plan["projectId"].as_str()) {
        if !plan["documents"].as_array().is_some_and(|documents| documents.iter().any(|previous| previous["documentId"] == document["documentId"] && previous["editorRevision"] == document["editorRevision"])) {
            return Err(err("STALE_VERSION", "文档在确认后继续编辑，请重新检查影响"));
        }
        if !decisions.iter().any(|decision| decision["resourceId"] == document["documentId"]) {
            return Err(err("RESOURCE_BUSY", "仍有未处理的未保存文档"));
        }
    }
    Ok(())
}
fn validate_impact(state: &HostState, registry: &Value, plan: &Value, decisions: &[Value]) -> Result<(), HostError> {
    for (id, revision) in plan["revisions"].as_object().into_iter().flatten() {
        if record(registry, id)?["revision"] != *revision { return Err(err("STALE_VERSION", "扩展状态已变化，请重新检查影响")); }
    }
    validate_impact_documents(state, plan, decisions)?;
    let ids: Vec<String> = plan["extensionIds"].as_array().into_iter().flatten().filter_map(Value::as_str).map(str::to_string).collect();
    let current = stop_impact(state, registry, &ids, plan["projectId"].as_str());
    for resource in current["resources"].as_array().into_iter().flatten() {
        if !plan["resources"].as_array().is_some_and(|resources| resources.iter().any(|prior| prior["resourceId"] == resource["resourceId"] && prior["ownerExtensionId"] == resource["ownerExtensionId"] && prior["projectId"] == resource["projectId"])) {
            return Err(err("STALE_VERSION", "运行资源已变化，请重新检查影响"));
        }
    }
    Ok(())
}
fn begin_stop_targets<R: tauri::Runtime>(state: &HostState, app: &AppHandle<R>, ids: &[String], project: Option<&str>) -> Result<(), HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    for id in ids {
        let record = record(&registry, id)?;
        if (record["stopping"]["@app"] == true || record["stopping"][key(project)] == true) && cleanup_error(record, project).is_none() {
            return Err(err("RESOURCE_BUSY", "扩展正在执行另一个停止或更新操作"));
        }
    }
    for id in ids {
        let record = record_mut(&mut registry, id)?;
        if !record["stopping"].is_object() { record["stopping"] = json!({}); }
        record["stopping"][key(project)] = json!(true);
    }
    write_registry(state, &registry)?;
    for id in ids { changed(app, id); }
    Ok(())
}
fn cleanup_failed<R: tauri::Runtime>(state: &HostState, app: &AppHandle<R>, ids: &[String], project: Option<&str>, error: &HostError) -> Result<(), HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    for id in ids { let record = record_mut(&mut registry, id)?; set_cleanup_error(record, project, Some(&error.message)); bump(record); }
    write_registry(state, &registry)?;
    for id in ids { changed(app, id); }
    Ok(())
}
async fn stop_targets<R: tauri::Runtime>(state: &HostState, app: &AppHandle<R>, ids: &[String], project: Option<&str>) -> Result<(), HostError> {
    for id in ids {
        if let Err(error) = stop_resources(id, project).await {
            cleanup_failed(state, app, ids, project, &error)?;
            return Err(error.details(json!({"effect":"partial"})));
        }
    }
    Ok(())
}
fn finish_document_stop(state: &HostState, app: &AppHandle, ids: &[String], plan: &Value, decisions: &[Value]) -> Result<(), HostError> {
    let result = (|| {
        validate_impact_documents(state, plan, decisions)?;
        let document_decisions: Vec<Value> = decisions.iter().filter(|decision| plan["documents"].as_array().is_some_and(|documents| documents.iter().any(|document| document["documentId"] == decision["resourceId"]))).cloned().collect();
        state.resolve_document_decisions(&document_decisions)
    })();
    if let Err(error) = result { cleanup_failed(state, app, ids, plan["projectId"].as_str(), &error)?; return Err(error.details(json!({"effect":"partial"}))); }
    for id in ids { state.release_extension_resources(id, plan["projectId"].as_str()); }
    Ok(())
}
fn prepare_stop(state: &HostState, registry: &Value, id: &str, action: &str, scope: &str, project: Option<&str>) -> Result<Value, HostError> {
    let record = record(registry, id)?;
    if !["pause", "disable", "uninstall", "sleep"].contains(&action) { return Err(err("INVALID_ARGUMENT", "停止动作无效")); }
    if action == "uninstall" && project.is_some() { return Err(err("INVALID_ARGUMENT", "卸载仅支持全局作用域")); }
    let dependents = dependents_of(registry, id);
    let ids: Vec<String> = dependents.iter().cloned().chain(std::iter::once(id.to_string())).collect();
    let mut plan = stop_impact(state, registry, &ids, project);
    for (field, value) in json!({"kind":"stop","extensionId":id,"action":action,"scope":scope,"projectId":project,"revision":record["revision"],"dependents":dependents}).as_object().unwrap() { plan[field] = value.clone(); }
    Ok(save_plan(plan))
}

pub async fn dispatch(
    state: Arc<HostState>,
    app: AppHandle,
    call: Call,
    _channel: Option<Channel<Value>>,
) -> Result<Value, HostError> {
    let p = &call.params;
    let project = current_scope(&call);
    let id = p["extensionId"].as_str().unwrap_or("");
    let allowed_fields: &[&str] = match call.method.as_str() {
        "extension_list" | "extension_preset_state" => &["projectId"],
        "extension_preset_prepare" => &["profile", "scope", "projectId", "selectedIds"],
        "extension_preset_apply" => &["planId", "digest", "decisions"],
        "extension_pick_package" | "extension_dev_pick" | "extension_developer_state" => &[],
        "extension_developer_mode" => &["enabled"],
        "extension_install_prepare" => &["packageSelectionToken"],
        "extension_install_apply" => &["planId", "digest", "grantIds"],
        "extension_restore"
        | "extension_dev_reload_prepare"
        | "extension_config_get"
        | "extension_logs" => &["extensionId"],
        "extension_enable" => &[
            "extensionId",
            "scope",
            "projectId",
            "expectedRevision",
            "enabled",
        ],
        "extension_project_override" => &["extensionId", "projectId", "expectedRevision", "policy"],
        "extension_resume" => &["extensionId", "scope", "projectId", "expectedRevision"],
        "extension_activate" => &["extensionId", "reason"],
        "extension_stop_prepare" => &["extensionId", "action", "scope", "projectId"],
        "extension_stop_apply" => &[
            "planId",
            "digest",
            "decisions",
            "deleteData",
            "stopDependents",
        ],
        "extension_entry" => &["extensionId", "activationId"],
        "extension_sdk_call" => &["extensionId", "activationId", "method", "params"],
        "extension_report_error" => &["extensionId", "activationId", "message"],
        "extension_config_set" => &["extensionId", "expectedRevision", "key", "value", "scope"],
        "extension_rollback" => &["extensionId", "expectedRevision"],
        _ => return Err(err("NOT_FOUND", format!("未知扩展方法 {}", call.method))),
    };
    crate::protocol::allowed(p, allowed_fields)?;
    match call.method.as_str() {
        "extension_preset_state" => presets::state(&state, p["projectId"].as_str().or(project)),
        "extension_preset_prepare" => presets::prepare(&state, &call),
        "extension_preset_apply" => presets::apply(state.clone(), app.clone(), &call).await,
        "extension_developer_state" => {
            let registry = read_registry(&state)?;
            Ok(json!({"enabled":registry["developerEnabled"].as_bool().unwrap_or(false)}))
        }
        "extension_developer_mode" => {
            let enabled = p["enabled"]
                .as_bool()
                .ok_or_else(|| err("INVALID_ARGUMENT", "enabled 须为布尔值"))?;
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            registry["developerEnabled"] = json!(enabled);
            write_registry(&state, &registry)?;
            Ok(json!({"enabled":enabled}))
        }
        "extension_list" => {
            let _guard = lock().lock().unwrap();
            let registry = read_registry(&state)?;
            let project = p["projectId"].as_str().or(project);
            let items: Result<Vec<_>, _> = registry["records"]
                .as_object()
                .unwrap()
                .keys()
                .map(|id| state_value(&registry, id, project))
                .collect();
            Ok(json!({"items":items?}))
        }
        "extension_pick_package" => {
            let path = app
                .dialog()
                .file()
                .set_title("安装 Horizon 扩展包")
                .add_filter("Horizon 扩展包", &["horizon-extension"])
                .blocking_pick_file();
            let token = path
                .and_then(|p| p.into_path().ok())
                .map(|p| state.register_selection(p));
            Ok(json!({"packageSelectionToken":token}))
        }
        "extension_dev_pick" => {
            if read_registry(&state)?["developerEnabled"] != true {
                return Err(err("PERMISSION_DENIED", "请先启用扩展开发者模式"));
            }
            let path = app
                .dialog()
                .file()
                .set_title("加载本地开发目录")
                .blocking_pick_folder();
            let token = path
                .and_then(|p| p.into_path().ok())
                .map(|p| state.register_selection(p));
            Ok(json!({"packageSelectionToken":token}))
        }
        "extension_install_prepare" => {
            let path = state.resolve_selection(str_param(p, "packageSelectionToken")?)?;
            if path.is_dir() && read_registry(&state)?["developerEnabled"] != true {
                return Err(err(
                    "PERMISSION_DENIED",
                    "目录加载需要显式启用开发者模式；普通安装请选择 .horizon-extension 文件",
                ));
            }
            let files = package_files(&path)?;
            let bytes = files
                .iter()
                .find(|(p, _)| p == Path::new("manifest.json"))
                .ok_or_else(|| err("INVALID_ARGUMENT", "目录内缺少 manifest.json"))?;
            let m: Value = serde_json::from_slice(&bytes.1).map_err(io)?;
            validate_manifest(&m, false)?;
            let registry = read_registry(&state)?;
            dependency_check(&registry, &m)?;
            if m["runtime"]["kind"] == "quickjs"
                && !files.iter().any(|(path, _)| {
                    Some(path.to_string_lossy().as_ref()) == m["runtime"]["entry"].as_str()
                })
            {
                return Err(err("INVALID_ARGUMENT", "缺少扩展入口文件"));
            }
            let permissions:Vec<_>=m["capabilities"].as_array().unwrap().iter().map(|cap|json!({"id":cap,"capability":cap,"description":match cap.as_str(){Some("git.read")=>"读取当前项目的 Git 更改",Some("project.read")=>"读取当前项目内文件",Some("storage")=>"写入此扩展的私有设置",_=>""}})).collect();
            let old = registry["records"].get(str_param(&m, "id")?);
            let old_grants = old
                .and_then(|r| r["grants"].as_array())
                .cloned()
                .unwrap_or_default();
            let new_permissions: Vec<_> = m["capabilities"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|cap| !old_grants.contains(cap))
                .cloned()
                .collect();
            Ok(save_plan(
                json!({"kind":"install","source":path,"development":path.is_dir(),"packageDigest":package_digest(&files),"manifest":m,"dependencies":m["requires"],"permissions":permissions,"newPermissions":new_permissions,"previousVersion":old.map(|r|r["manifest"]["version"].clone()),"previousRevision":old.map(|r|r["revision"].clone()),"downloadBytes":files.iter().map(|(_,b)|b.len()).sum::<usize>().to_string()}),
            ))
        }
        "extension_install_apply" => {
            let plan = get_plan(p, "install")?;
            let _plan_guard = PlanGuard::claim(&plan)?;
            let m = &plan["manifest"];
            let id = str_param(m, "id")?;
            let grants = p["grantIds"]
                .as_array()
                .ok_or_else(|| err("PERMISSION_DENIED", "请明确授权扩展请求的权限"))?;
            let capabilities = m["capabilities"].as_array().unwrap();
            if capabilities.iter().any(|cap| !grants.contains(cap))
                || grants.iter().any(|cap| !capabilities.contains(cap))
            {
                return Err(err("PERMISSION_DENIED", "授权必须与已检查的声明权限一致"));
            }
            let _ = state.emit_task(
                &call.request_id,
                json!({"type":"progress","phase":"核对扩展包与兼容性"}),
            );
            let source = Path::new(str_param(&plan, "source")?);
            let files = package_files(source)?;
            if package_digest(&files) != plan["packageDigest"].as_str().unwrap_or("") {
                return Err(err("STALE_VERSION", "扩展包已变化，请重新检查"));
            }
            let registry = read_registry(&state)?;
            dependency_check(&registry, m)?;
            if source.is_dir() && registry["developerEnabled"] != true {
                return Err(err("PERMISSION_DENIED", "开发者模式已关闭"));
            }
            let existing = registry["records"].get(id).cloned();
            if let Some(old) = &existing {
                if plan["previousRevision"]
                    .as_u64()
                    .is_some_and(|revision| old["revision"].as_u64() != Some(revision))
                {
                    return Err(err("STALE_VERSION", "扩展状态已变化，请重新检查更新"));
                }
            }
            if state.is_cancelled(&call.request_id) {
                return Err(err("CANCELLED", "安装已取消"));
            }
            if existing.is_some() {
                transition(&state, &app, id, None, true)?;
                if let Err(e) = stop_resources(id, None).await {
                    transition(&state, &app, id, None, false)?;
                    return Err(e);
                }
            }
            let hash = str_param(&plan, "packageDigest")?;
            let version = str_param(m, "version")?;
            let directory = state
                .data_dir()
                .join("extensions/packages")
                .join(id)
                .join(format!("{version}-{}", &hash[..12]));
            let staging = directory.with_extension(format!("stage-{}", uuid::Uuid::new_v4()));
            let result = (|| -> Result<Value, HostError> {
                fs::create_dir_all(&staging).map_err(io)?;
                for (index, (path, bytes)) in files.iter().enumerate() {
                    if state.is_cancelled(&call.request_id) {
                        return Err(err("CANCELLED", "安装已取消，旧版本保留"));
                    }
                    let target = staging.join(path);
                    fs::create_dir_all(target.parent().unwrap()).map_err(io)?;
                    fs::write(target, bytes).map_err(io)?;
                    let _=state.emit_task(&call.request_id,json!({"type":"progress","phase":"复制扩展文件","completed":index+1,"total":files.len()}));
                }
                if state.is_cancelled(&call.request_id) {
                    return Err(err("CANCELLED", "安装已取消，旧版本保留"));
                }
                if directory.exists() {
                    fs::remove_dir_all(&staging).map_err(io)?;
                } else {
                    fs::rename(&staging, &directory).map_err(io)?;
                }
                let _guard = lock().lock().unwrap();
                let mut registry = read_registry(&state)?;
                dependency_check(&registry, m)?;
                let mut record = existing
                    .clone()
                    .unwrap_or_else(|| initial_record(m.clone(), false));
                if let Some(old) = &existing {
                    if old["packageDir"] != json!(directory) {
                        record["previous"] = json!({"manifest":old["manifest"],"grants":old["grants"],"packageDir":old["packageDir"],"packageDigest":old["packageDigest"]});
                    }
                }
                record["manifest"] = m.clone();
                record["packageDigest"] = plan["packageDigest"].clone();
                record["installed"] = json!(true);
                record["activations"] = json!({});
                record["stopping"] = json!({});
                record["errors"] = json!({});
                set_cleanup_error(&mut record, None, None);
                record["grants"] = json!(grants);
                record["packageDir"] = json!(directory);
                record["source"] = plan["source"].clone();
                record["development"] = plan["development"].clone();
                record["enabledGlobal"] = existing
                    .as_ref()
                    .map(|old| old["enabledGlobal"].clone())
                    .unwrap_or(json!(false));
                append_log(&mut record, "安装包校验和复制完成");
                bump(&mut record);
                registry["records"][id] = record;
                write_registry(&state, &registry)?;
                state_value(&registry, id, project)
            })();
            if result.is_err() {
                let _ = fs::remove_dir_all(&staging);
                let _guard = lock().lock().unwrap();
                let mut registry = read_registry(&state)?;
                if let Some(mut old) = existing {
                    old["activations"] = json!({});
                    old["stopping"] = json!({});
                    append_log(&mut old, "更新未完成，保留旧版本");
                    registry["records"][id] = old;
                    write_registry(&state, &registry)?;
                }
                changed(&app, id);
                return result;
            }
            consume_plan(&plan);
            changed(&app, id);
            let _ = state.emit_task(
                &call.request_id,
                json!({"type":"progress","phase":"完成安装登记"}),
            );
            result
        }
        "extension_restore" => {
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            if registry["records"][id]["installed"] == true {
                return state_value(&registry, id, project);
            }
            let m = builtin_manifests()
                .into_iter()
                .find(|m| m["id"] == id)
                .ok_or_else(|| err("NOT_FOUND", "不是默认扩展"))?;
            validate_manifest(&m, true)?;
            dependency_check(&registry, &m)?;
            let mut r = registry["records"]
                .get(id)
                .cloned()
                .unwrap_or_else(|| initial_record(m.clone(), true));
            r["packageDir"] = json!(write_builtin_package(&state, &m)?);
            r["manifest"] = m;
            r["installed"] = json!(true);
            r["error"] = Value::Null;
            set_cleanup_error(&mut r, None, None);
            r["activations"] = json!({});
            bump(&mut r);
            registry["records"][id] = r;
            write_registry(&state, &registry)?;
            changed(&app, id);
            state_value(&registry, id, project)
        }
        "extension_enable" | "extension_project_override" | "extension_resume" => {
            let target_project =
                if call.method == "extension_project_override" || p["scope"] == "project" {
                    Some(str_param(p, "projectId")?)
                } else {
                    None
                };
            if (call.method == "extension_enable" && p["enabled"] == false)
                || (call.method == "extension_project_override" && p["policy"] == "disabled")
            {
                let registry = read_registry(&state)?;
                expected(record(&registry, id)?, p)?;
                return Ok(
                    json!({"status":"needsStop","plan":prepare_stop(&state,&registry,id,"disable",if target_project.is_some(){"project"}else{"global"},target_project)?}),
                );
            }
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            let r = record_mut(&mut registry, id)?;
            expected(r, p)?;
            if r["stopping"]
                .as_object()
                .is_some_and(|scopes| scopes.values().any(|value| value == true))
            {
                return Err(err("RESOURCE_BUSY", "扩展正在停止或更新"));
            }
            if r["installed"] != true {
                return Err(err("EXTENSION_MISSING", "扩展已卸载"));
            }
            if let Some(project) = target_project {
                if r["projects"].get(project).is_none() {
                    r["projects"][project] = json!({});
                }
            }
            if call.method == "extension_resume" {
                if let Some(project) = target_project {
                    r["projects"][project]["paused"] = json!(false);
                } else {
                    r["pausedGlobal"] = json!(false);
                }
            } else if call.method == "extension_project_override" {
                let policy = str_param(p, "policy")?;
                if !["inherit", "enabled", "disabled"].contains(&policy) {
                    return Err(err("INVALID_ARGUMENT", "覆盖策略无效"));
                }
                if policy == "inherit" {
                    r["projects"][target_project.unwrap()]
                        .as_object_mut()
                        .unwrap()
                        .remove("policy");
                } else {
                    r["projects"][target_project.unwrap()]["policy"] = json!(policy);
                }
            } else if let Some(project) = target_project {
                r["projects"][project]["policy"] = json!("enabled");
            } else {
                r["enabledGlobal"] = json!(true);
            }
            if !r["errors"].is_object() {
                r["errors"] = json!({});
            }
            r["errors"]
                .as_object_mut()
                .unwrap()
                .remove(key(target_project));
            bump_policy(r);
            write_registry(&state, &registry)?;
            changed(&app, id);
            let s = state_value(&registry, id, project)?;
            if call.method == "extension_resume" {
                Ok(s)
            } else {
                Ok(json!({"status":"applied","state":s}))
            }
        }
        "extension_activate" => {
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            check_gate(&registry, id, project, &mut BTreeSet::new())?;
            crate::protocol::allowed(&p["reason"], &["kind", "id"])?;
            let activation_event = format!(
                "on{}:{}",
                match p["reason"]["kind"].as_str() {
                    Some("command") => "Command",
                    Some("view") => "View",
                    Some("language") => "Language",
                    Some("launch") => "Launch",
                    _ => return Err(err("INVALID_ARGUMENT", "未知激活触发条件")),
                },
                p["reason"]["id"].as_str().unwrap_or("")
            );
            let m = &record(&registry, id)?["manifest"];
            if m["runtime"]["kind"] != "declarative"
                && !m["activation"]
                    .as_array()
                    .map(|events| events.contains(&json!(activation_event)))
                    .unwrap_or(false)
            {
                return Err(err("INVALID_ARGUMENT", "未声明的激活触发条件"));
            }
            fn activate_dependencies(
                registry: &mut Value,
                id: &str,
                project: Option<&str>,
            ) -> Result<(), HostError> {
                let dependencies: Vec<_> = record(registry, id)?["manifest"]["requires"]
                    .as_object()
                    .into_iter()
                    .flatten()
                    .map(|(id, _)| id.clone())
                    .collect();
                for dependency in dependencies {
                    activate_dependencies(registry, &dependency, project)?;
                    let r = record_mut(registry, &dependency)?;
                    if !r["activations"][key(project)].is_string() {
                        r["activations"][key(project)] = json!(uuid::Uuid::new_v4().to_string());
                        append_log(r, "作为显式激活的必需依赖启动");
                        bump(r);
                    }
                }
                Ok(())
            }
            activate_dependencies(&mut registry, id, project)?;
            let r = record_mut(&mut registry, id)?;
            if !r["activations"][key(project)].is_string() {
                r["activations"][key(project)] = json!(uuid::Uuid::new_v4().to_string());
                if !r["sleeping"].is_object() {
                    r["sleeping"] = json!({});
                }
                r["sleeping"][key(project)] = json!(false);
                bump(r);
                if !r["errors"].is_object() {
                    r["errors"] = json!({});
                }
                r["errors"].as_object_mut().unwrap().remove(key(project));
                append_log(r, "实例按需激活");
                write_registry(&state, &registry)?;
                changed(&app, id);
            }
            let r = record_mut(&mut registry, id)?;
            if !r["directActivations"].is_object() {
                r["directActivations"] = json!({});
            }
            if r["directActivations"][key(project)] != r["activations"][key(project)] {
                r["directActivations"][key(project)] = r["activations"][key(project)].clone();
                write_registry(&state, &registry)?;
            }
            state_value(&registry, id, project)
        }
        "extension_stop_prepare" => {
            let registry = read_registry(&state)?;
            let target = if p["scope"] == "project" {
                Some(str_param(p, "projectId")?)
            } else {
                None
            };
            prepare_stop(
                &state,
                &registry,
                id,
                str_param(p, "action")?,
                p["scope"].as_str().unwrap_or("global"),
                target,
            )
        }
        "extension_stop_apply" => {
            let plan = get_plan(p, "stop")?;
            let _plan_guard = PlanGuard::claim(&plan)?;
            let id = str_param(&plan, "extensionId")?;
            let target_project = plan["projectId"].as_str();
            let registry = read_registry(&state)?;
            let decisions = p["decisions"].as_array().ok_or_else(|| err("INVALID_ARGUMENT", "decisions 必须为数组"))?;
            let dependents = plan["dependents"].as_array().cloned().unwrap_or_default();
            if !dependents.is_empty() && p["stopDependents"] != true {
                return Err(err("DEPENDENCY_UNAVAILABLE", "存在依赖扩展，需一并停止或取消"));
            }
            if json!(dependents_of(&registry, id)) != plan["dependents"] { return Err(err("STALE_VERSION", "依赖关系已变化，请重新检查影响")); }
            validate_impact(&state, &registry, &plan, decisions)?;
            let ids: Vec<String> = plan["extensionIds"].as_array().unwrap().iter().filter_map(Value::as_str).map(str::to_string).collect();
            begin_stop_targets(&state, &app, &ids, target_project)?;
            stop_targets(&state, &app, &ids, target_project).await?;
            finish_document_stop(&state, &app, &ids, &plan, decisions)?;
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            for extension in ids {
                let r = record_mut(&mut registry, &extension)?;
                if let Some(project) = target_project {
                    r["activations"].as_object_mut().unwrap().remove(project);
                    if r["projects"].get(project).is_none() {
                        r["projects"][project] = json!({});
                    }
                    if plan["action"] == "pause" {
                        r["projects"][project]["paused"] = json!(true);
                    } else if plan["action"] != "sleep" {
                        r["projects"][project]["policy"] = json!("disabled");
                    }
                } else {
                    r["activations"] = json!({});
                    if plan["action"] == "pause" {
                        r["pausedGlobal"] = json!(true);
                    } else if plan["action"] != "sleep" {
                        r["enabledGlobal"] = json!(false);
                    }
                }
                if !r["sleeping"].is_object() {
                    r["sleeping"] = json!({});
                }
                r["sleeping"][key(target_project)] = json!(plan["action"] == "sleep");
                if extension == id && plan["action"] == "uninstall" {
                    let packages = state.data_dir().join("extensions/packages").join(id);
                    if packages.exists() {
                        fs::remove_dir_all(packages).map_err(io)?;
                    }
                    r["installed"] = json!(false);
                    if p["deleteData"] == true {
                        r["config"] = json!({});
                        r["projectConfig"] = json!({});
                        let storage = state.data_dir().join("extensions/storage").join(id);
                        if storage.exists() {
                            fs::remove_dir_all(storage).map_err(io)?;
                        }
                    }
                }
                r["stopping"][key(target_project)] = json!(false);
                if let Some(project) = target_project {
                    for field in ["runLeases", "launchOrigins", "directActivations"] {
                        if let Some(map) = r[field].as_object_mut() {
                            map.remove(project);
                        }
                    }
                } else {
                    r["runLeases"] = json!({});
                    r["launchOrigins"] = json!({});
                    r["directActivations"] = json!({});
                }
                set_cleanup_error(r, target_project, None);
                append_log(r, plan["action"].as_str().unwrap_or("stop"));
                if plan["action"] == "sleep" {
                    bump(r);
                } else {
                    bump_policy(r);
                }
                changed(&app, &extension);
            }
            write_registry(&state, &registry)?;
            consume_plan(&plan);
            changed(&app, id);
            Ok(
                json!({"state":state_value(&registry,id,project)?,"resourcesReleased":true,"uiReclaim":"retainedModule"}),
            )
        }
        "extension_entry" => {
            let registry = read_registry(&state)?;
            check_gate(&registry, id, project, &mut BTreeSet::new())?;
            let r = record(&registry, id)?;
            if r["activations"][key(project)] != p["activationId"] || !p["activationId"].is_string()
            {
                return Err(err("STALE_SCOPE", "扩展激活已失效"));
            }
            if r["manifest"]["runtime"]["kind"] != "quickjs" {
                return Err(err("PERMISSION_DENIED", "扩展不是QuickJS 包"));
            }
            let path = Path::new(str_param(r, "packageDir")?)
                .join(str_param(&r["manifest"]["runtime"], "entry")?);
            let actual_digest =
                package_digest(&package_files(Path::new(str_param(r, "packageDir")?))?);
            if r["packageDigest"] != actual_digest {
                return Err(err(
                    "EXTENSION_FAILED",
                    "已安装扩展内容已变化，请重新检查并安装",
                ));
            }
            let source = fs::read_to_string(path).map_err(io)?;
            let package_digest = r["packageDigest"]
                .as_str()
                .map(str::to_string)
                .unwrap_or_else(|| digest(source.as_bytes()));
            Ok(json!({"source":source,"manifest":r["manifest"],"packageDigest":package_digest}))
        }
        "extension_dev_reload_prepare" => {
            let registry = read_registry(&state)?;
            let r = record(&registry, id)?;
            if registry["developerEnabled"] != true {
                return Err(err("PERMISSION_DENIED", "开发者模式已关闭"));
            }
            if r["development"] != true {
                return Err(err("PERMISSION_DENIED", "此扩展不是开发目录安装"));
            }
            let source = PathBuf::from(str_param(r, "source")?);
            let files = package_files(&source)?;
            let bytes = files
                .iter()
                .find(|(p, _)| p == Path::new("manifest.json"))
                .ok_or_else(|| err("INVALID_ARGUMENT", "缺少 manifest.json"))?;
            let m: Value = serde_json::from_slice(&bytes.1).map_err(io)?;
            validate_manifest(&m, false)?;
            if m["id"] != id {
                return Err(err("INVALID_ARGUMENT", "开发清单 ID 已变化，请重新安装"));
            }
            dependency_check(&registry, &m)?;
            let permissions:Vec<_>=m["capabilities"].as_array().unwrap().iter().map(|cap|json!({"id":cap,"capability":cap,"description":format!("使用 {} 能力",cap.as_str().unwrap_or(""))})).collect();
            Ok(save_plan(
                json!({"kind":"install","development":true,"source":source,"packageDigest":package_digest(&files),"manifest":m,"permissions":permissions,"previousVersion":r["manifest"]["version"],"previousRevision":r["revision"],"downloadBytes":files.iter().map(|(_,b)|b.len()).sum::<usize>().to_string()}),
            ))
        }
        "extension_rollback" => {
            let registry = read_registry(&state)?;
            let current = record(&registry, id)?.clone();
            expected(&current, p)?;
            let previous = current["previous"].clone();
            if !previous.is_object() {
                return Err(err("NOT_FOUND", "没有可回退的本地版本"));
            }
            let dir = PathBuf::from(str_param(&previous, "packageDir")?);
            if !dir.join("manifest.json").exists() {
                return Err(err("NOT_FOUND", "上一个安装版本已被移除"));
            }
            validate_manifest(&previous["manifest"], false)?;
            dependency_check(&registry, &previous["manifest"])?;
            transition(&state, &app, id, None, true)?;
            if let Err(e) = stop_resources(id, None).await {
                transition(&state, &app, id, None, false)?;
                return Err(e);
            }
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            let r = record_mut(&mut registry, id)?;
            r["manifest"] = previous["manifest"].clone();
            r["grants"] = previous["grants"].clone();
            r["packageDigest"] = previous["packageDigest"].clone();
            r["errors"] = json!({});
            set_cleanup_error(r, None, None);
            r["packageDir"] = previous["packageDir"].clone();
            r["previous"] = json!({"manifest":current["manifest"],"grants":current["grants"],"packageDir":current["packageDir"],"packageDigest":current["packageDigest"]});
            r["activations"] = json!({});
            r["stopping"] = json!({});
            r["error"] = Value::Null;
            append_log(r, "已回退到上一个校验版本");
            bump(r);
            write_registry(&state, &registry)?;
            changed(&app, id);
            state_value(&registry, id, project)
        }
        "extension_sdk_call" => sdk_call(state.clone(), app.clone(), &call).await,
        "extension_report_error" => {
            runtime_failed(
                &state,
                &app,
                id,
                str_param(p, "activationId")?,
                project,
                p["message"].as_str().unwrap_or("扩展意外退出"),
            )?;
            Ok(json!({"recorded":true}))
        }
        "extension_config_get" => {
            let registry = read_registry(&state)?;
            let r = record(&registry, id)?;
            Ok(
                json!({"revision":r["revision"],"global":r["config"],"project":project.and_then(|p|r["projectConfig"].get(p)),"schema":r["manifest"]["contributes"]["settings"]}),
            )
        }
        "extension_config_set" => {
            let _guard = lock().lock().unwrap();
            let mut registry = read_registry(&state)?;
            let r = record_mut(&mut registry, id)?;
            expected(r, p)?;
            let config_key = str_param(p, "key")?;
            let def = r["manifest"]["contributes"]["settings"]
                .as_array()
                .and_then(|defs| defs.iter().find(|d| d["key"] == config_key))
                .ok_or_else(|| err("INVALID_ARGUMENT", "未知扩展设置"))?;
            let value = &p["value"];
            let valid = match def["type"].as_str() {
                Some("boolean") => value.is_boolean(),
                Some("string" | "path") => value.is_string(),
                Some("select") => def["options"]
                    .as_array()
                    .map(|o| o.contains(value))
                    .unwrap_or(false),
                _ => false,
            };
            if !value.is_null() && !valid {
                return Err(err("INVALID_ARGUMENT", "设置值类型无效"));
            }
            let target = if p["scope"] == "project" {
                let project = project.ok_or_else(|| err("INVALID_ARGUMENT", "未选择项目"))?;
                if r["projectConfig"].get(project).is_none() {
                    r["projectConfig"][project] = json!({});
                }
                &mut r["projectConfig"][project]
            } else {
                &mut r["config"]
            };
            if value.is_null() {
                target.as_object_mut().unwrap().remove(config_key);
            } else {
                target[config_key] = value.clone();
            }
            bump(r);
            write_registry(&state, &registry)?;
            Ok(json!({"saved":true}))
        }
        "extension_logs" => {
            let registry = read_registry(&state)?;
            let r = record(&registry, id)?;
            Ok(log_snapshot(r, project))
        }
        _ => Err(err("NOT_FOUND", format!("未知扩展方法 {}", call.method))),
    }
}

async fn sdk_call(state: Arc<HostState>, app: AppHandle, call: &Call) -> Result<Value, HostError> {
    let p = &call.params;
    let id = str_param(p, "extensionId")?;
    let project = current_scope(call);
    let registry = read_registry(&state)?;
    check_gate(&registry, id, project, &mut BTreeSet::new())?;
    let r = record(&registry, id)?;
    if r["activations"][key(project)] != p["activationId"] || !p["activationId"].is_string() {
        return Err(err("STALE_SCOPE", "扩展租约已撤销"));
    }
    let method = str_param(p, "method")?;
    let capability = match method {
        "project.read" => "project.read",
        "git.status" => "git.read",
        "storage.get" | "storage.set" => "storage",
        "settings.get" => "",
        _ => return Err(err("PERMISSION_DENIED", "SDK 不开放该方法")),
    };
    if !capability.is_empty() && !r["grants"].as_array().unwrap().contains(&json!(capability)) {
        return Err(err("PERMISSION_DENIED", format!("缺少 {capability} 授权")));
    }
    match method {
        "settings.get" => {
            let config_key = str_param(&p["params"], "key")?;
            let definition = r["manifest"]["contributes"]["settings"]
                .as_array()
                .and_then(|defs| defs.iter().find(|d| d["key"] == config_key))
                .ok_or_else(|| err("INVALID_ARGUMENT", "设置未声明"))?;
            Ok(project
                .and_then(|project| r["projectConfig"][project].get(config_key))
                .or(r["config"].get(config_key))
                .cloned()
                .unwrap_or_else(|| definition["default"].clone()))
        }
        "project.read" => {
            let project = project.ok_or_else(|| err("INVALID_ARGUMENT", "请选择项目"))?;
            let path = state.resolve_file(project, str_param(&p["params"], "fileId")?)?;
            let canonical = fs::canonicalize(&path).map_err(io)?;
            let root = fs::canonicalize(state.project_root(project)?).map_err(io)?;
            if !canonical.starts_with(root) {
                return Err(err(
                    "PERMISSION_DENIED",
                    "project.read 不允许读取项目根目录以外的文件",
                ));
            }
            let meta = fs::metadata(&path).map_err(io)?;
            if meta.len() > 1024 * 1024 {
                return Err(err("RESOURCE_LIMIT", "SDK 文件读取上限 1 MiB"));
            }
            Ok(json!({"text":fs::read_to_string(path).map_err(io)?}))
        }
        "git.status" => {
            let project = project.ok_or_else(|| err("INVALID_ARGUMENT", "请选择项目"))?;
            extension_gate(&state, "horizon.git", Some(project))?;
            let request_id = uuid::Uuid::new_v4().to_string();
            sdk_requests().lock().unwrap().insert(
                request_id.clone(),
                SdkRequest { extension_id: id.to_string(), activation_id: str_param(p, "activationId")?.to_string(), project_id: Some(project.to_string()) },
            );
            let _lease = SdkRequestGuard(request_id.clone());
            // Recheck after registering so revocation cannot lose an in-flight request.
            if activation_id(&state, id, Some(project))? != str_param(p, "activationId")? {
                return Err(err("STALE_SCOPE", "扩展租约已撤销"));
            }
            let request = Call {
                protocol_version: 1,
                request_id,
                method: "git_status".to_string(),
                scope: call.scope.clone(),
                params: json!({"refresh":true}),
                idempotency_key: None,
            };
            crate::git::dispatch(state, app, request, None).await
        }
        "storage.get" | "storage.set" => {
            // Storage is shared by an extension's project instances. Serialize quota
            // calculation and replacement, then recheck the activation under the lock.
            let _guard = lock().lock().unwrap();
            if activation_id(&state, id, project)? != str_param(p, "activationId")? {
                return Err(err("STALE_SCOPE", "扩展租约已撤销"));
            }
            let storage_key = str_param(&p["params"], "key")?;
            if storage_key.len() > 128 {
                return Err(err("INVALID_ARGUMENT", "存储键过长"));
            }
            let path = state
                .data_dir()
                .join("extensions/storage")
                .join(id)
                .join(format!("{}.json", digest(storage_key.as_bytes())));
            if method == "storage.get" {
                if !path.exists() {
                    return Ok(Value::Null);
                }
                return serde_json::from_slice(&fs::read(path).map_err(io)?).map_err(io);
            }
            let bytes = serde_json::to_vec(&p["params"]["value"]).map_err(io)?;
            if bytes.len() > 64 * 1024 {
                return Err(err("RESOURCE_LIMIT", "单个存储项上限 64 KiB"));
            }
            fs::create_dir_all(path.parent().unwrap()).map_err(io)?;
            let usage: u64 = fs::read_dir(path.parent().unwrap())
                .map_err(io)?
                .filter_map(Result::ok)
                .filter_map(|entry| entry.metadata().ok())
                .map(|meta| meta.len())
                .sum();
            let old_size = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
            if usage.saturating_sub(old_size) + bytes.len() as u64 > 4 * 1024 * 1024 {
                return Err(err("RESOURCE_LIMIT", "扩展私有存储超过 4 MiB"));
            }
            let temp = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
            fs::write(&temp, bytes).map_err(io)?;
            if let Err(error) = fs::rename(&temp, &path) {
                let _ = fs::remove_file(&temp);
                return Err(io(error));
            }
            Ok(json!({"saved":true}))
        }
        _ => Err(err("PERMISSION_DENIED", "SDK 方法未授权")),
    }
}

/// Used only by the native QuickJS channel after it binds extension and activation identity.
pub async fn broker_call(
    state: Arc<HostState>,
    app: AppHandle,
    call: Call,
) -> Result<Value, HostError> {
    sdk_call(state, app, &call).await
}
fn persist_runtime_failure(
    state: &HostState,
    id: &str,
    activation_id: &str,
    project: Option<&str>,
    message: &str,
) -> Result<Vec<String>, HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    let r = record_mut(&mut registry, id)?;
    if r["activations"][key(project)] != activation_id {
        return Err(err("STALE_SCOPE", "过期扩展实例"));
    }
    if !r["errors"].is_object() {
        r["errors"] = json!({});
    }
    if r["manifest"]["runtime"]["kind"] == "quickjs" {
        migrate_external_failure_logs(r, id);
        let summary = external_failure_summary(id, Some(activation_id), project);
        r["errors"][key(project)] = summary.clone();
        append_external_failure_log(r, &summary);
    } else {
        let message: String = message.chars().take(512).collect();
        r["errors"][key(project)] = json!({"code":"EXTENSION_FAILED","message":message});
        append_log(r, &message);
    }
    r["activations"]
        .as_object_mut()
        .unwrap()
        .remove(key(project));
    bump(r);
    write_registry(state, &registry)?;
    Ok(sdk_requests().lock().unwrap().iter()
        .filter(|(_, request)| request.extension_id == id && request.activation_id == activation_id && request.project_id.as_deref() == project)
        .map(|(id, _)| id.clone()).collect())
}
pub fn runtime_failed(
    state: &HostState,
    app: &AppHandle,
    id: &str,
    activation_id: &str,
    project: Option<&str>,
    message: &str,
) -> Result<(), HostError> {
    let requests = persist_runtime_failure(state, id, activation_id, project, message)?;
    // Revoke first, then cancel only this activation's in-flight calls. A caller
    // registering after this snapshot must fail its post-registration lease check.
    if !requests.is_empty() {
        let path = registry_path(state);
        let id = id.to_string();
        let project = project.map(str::to_string);
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            if let Err(error) = crate::git::stop_requests(&requests).await {
                let _guard = lock().lock().unwrap();
                if let Ok(bytes) = fs::read(&path) {
                    if let Ok(mut registry) = serde_json::from_slice::<Value>(&bytes) {
                        if let Ok(record) = record_mut(&mut registry, &id) {
                            set_cleanup_error(record, project.as_deref(), Some(&error.message));
                            append_log(record, &error.message);
                            bump(record);
                            let _ = write_registry_path(&path, &registry);
                            changed(&app, &id);
                        }
                    }
                }
            }
        });
    }
    changed(app, id);
    Ok(())
}

#[cfg(test)]
mod cleanup_failure_tests {
    use super::*;
    use crate::extension_host::test_support::StalledDeactivateSession;
    use std::{sync::mpsc, time::Duration};
    use tauri::Listener;

    fn policy_snapshot(record: &Value) -> Value {
        let fields = ["installed", "enabledGlobal", "pausedGlobal", "projects", "activations",
            "policyRevision", "manifest", "grants", "config", "projectConfig"];
        Value::Object(fields.into_iter().map(|field| (field.to_string(), record[field].clone())).collect())
    }

    #[tokio::test]
    async fn failed_quickjs_stop_retains_live_resource_and_policy_until_retry() {
        let directory = tempfile::tempdir().unwrap();
        let state = HostState::new(directory.path().into()).unwrap();
        let app = tauri::test::mock_app();
        let handle = app.handle();
        let (tx, rx) = mpsc::channel();
        let listener = handle.listen("horizon:extension:v1", move |event| {
            let _ = tx.send(serde_json::from_str::<Value>(event.payload()).unwrap());
        });
        let id = format!("local.cleanup-test.{}", uuid::Uuid::new_v4());
        let activation = uuid::Uuid::new_v4().to_string();
        let project = "cleanup-test-project-a";
        let manifest = json!({"id":id,"version":"0.1.0","runtime":{"kind":"quickjs"},"capabilities":[],"contributes":{}});
        let mut registry = read_registry(&state).unwrap();
        let mut record = initial_record(manifest.clone(), false);
        record["activations"] = json!({project:activation,"cleanup-test-project-b":"other-activation"});
        record["projects"] = json!({project:{"policy":"inherit","paused":false},"cleanup-test-project-b":{"policy":"disabled","paused":true}});
        record["config"] = json!({"retained":"global"});
        record["projectConfig"] = json!({project:{"retained":"project"}});
        record["policyRevision"] = json!(7);
        let original_policy = policy_snapshot(&record);
        registry["records"][&id] = record;
        write_registry(&state, &registry).unwrap();
        let worker = StalledDeactivateSession::start(&id, &activation, project, manifest).unwrap();
        let pid = worker.pid();
        let ids = vec![id.clone()];
        let before = state_value(&read_registry(&state).unwrap(), &id, Some(project)).unwrap();
        assert_eq!(before["runState"], "active");
        assert_eq!(before["activationId"], activation);
        assert_eq!(before["ownedResourceCount"], 1);
        assert!(worker.is_alive());

        worker.fail_next_terminate();
        begin_stop_targets(&state, handle, &ids, Some(project)).unwrap();
        assert_eq!(rx.recv_timeout(Duration::from_secs(1)).unwrap(), json!({"extensionId":id}));
        let pausing = state_value(&read_registry(&state).unwrap(), &id, Some(project)).unwrap();
        assert_eq!(pausing["runState"], "pausing");
        assert_eq!(pausing["activationId"], activation);
        assert_eq!(pausing["ownedResourceCount"], 1);
        println!("EXT-009 {}", json!({"stage":"pausing","activationId":activation,"pid":pid,"ownedResourceCount":pausing["ownedResourceCount"],"processAlive":worker.is_alive()}));

        let failure = stop_targets(&state, handle, &ids, Some(project)).await.unwrap_err();
        assert_eq!(failure.code, "CLEANUP_FAILED");
        assert_eq!(rx.recv_timeout(Duration::from_secs(1)).unwrap(), json!({"extensionId":id}));
        let failed_registry = read_registry(&state).unwrap();
        let failed = state_value(&failed_registry, &id, Some(project)).unwrap();
        assert_eq!(failed["runState"], "cleanupFailed");
        assert_eq!(failed["error"]["code"], "CLEANUP_FAILED");
        assert_eq!(failed["activationId"], activation);
        assert_eq!(failed["ownedResourceCount"], 1);
        assert_eq!(failed_registry["records"][&id]["stopping"][project], true);
        assert_eq!(policy_snapshot(&failed_registry["records"][&id]), original_policy);
        assert_eq!(worker.pid(), pid);
        assert!(worker.is_alive());
        let remaining = crate::extension_host::resources(Some(project));
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0]["ownerExtensionId"], id);
        assert_eq!(remaining[0]["activationId"], activation);
        assert_eq!(remaining[0]["pid"], pid);
        assert_eq!(remaining[0]["state"], "stopping");
        println!("EXT-009 {}", json!({"stage":"cleanupFailed","activationId":activation,"pid":pid,"ownedResourceCount":failed["ownedResourceCount"],"processAlive":worker.is_alive(),"policyUnchanged":true,"resources":remaining}));

        // Retry the same production cleanup path. The one-shot fault has been
        // consumed; the never-resolving deactivate now reaches real kill/wait.
        begin_stop_targets(&state, handle, &ids, Some(project)).unwrap();
        stop_targets(&state, handle, &ids, Some(project)).await.unwrap();
        assert!(!worker.is_alive());
        assert_eq!(crate::extension_host::resource_count(&id, Some(project)), 0);
        assert!(crate::extension_host::resources(Some(project)).is_empty());
        assert_eq!(unsafe { libc::kill(pid as i32, 0) }, -1);
        assert_eq!(std::io::Error::last_os_error().raw_os_error(), Some(libc::ESRCH));
        assert_eq!(policy_snapshot(&read_registry(&state).unwrap()["records"][&id]), original_policy);
        println!("EXT-009 {}", json!({"stage":"retryResourcesReclaimed","activationId":activation,"pid":pid,"ownedResourceCount":0,"processAlive":false,"policyUnchanged":true,"coverage":"resource cleanup only; final stop_apply policy commit is outside this test"}));
        handle.unlisten(listener);
    }
}

#[cfg(test)]
mod failure_privacy_tests {
    use super::*;

    const PRIVATE_ERROR: &str = "token=qa-fake-private-token /Users/qa/project/private.ts\nsource: const PRIVATE_BODY_MARKER = 'test only';";

    fn fixture(kind: &str) -> (tempfile::TempDir, HostState) {
        let directory = tempfile::tempdir().unwrap();
        let state = HostState::new(directory.path().into()).unwrap();
        let mut registry = read_registry(&state).unwrap();
        let mut record = initial_record(json!({"id":"local.failure-test","version":"0.1.0","runtime":{"kind":kind},"capabilities":[],"contributes":{}}), false);
        record["activations"] = json!({"project-a":"lease-a","project-b":"lease-b"});
        record["config"] = json!({"retained":true});
        record["projectConfig"] = json!({"project-b":{"retained":true}});
        registry["records"]["local.failure-test"] = record;
        write_registry(&state, &registry).unwrap();
        (directory, state)
    }

    fn assert_private_error_absent(value: &str) {
        for marker in ["qa-fake-private-token", "/Users/qa/project/private.ts", "PRIVATE_BODY_MARKER"] {
            assert!(!value.contains(marker), "external exception content leaked: {marker}");
        }
    }

    #[test]
    fn external_error_text_is_not_persisted_or_returned_by_log_snapshot() {
        let (_directory, state) = fixture("quickjs");
        persist_runtime_failure(&state, "local.failure-test", "lease-a", Some("project-a"), PRIVATE_ERROR).unwrap();
        let persisted = fs::read_to_string(registry_path(&state)).unwrap();
        assert_private_error_absent(&persisted);
        let registry = read_registry(&state).unwrap();
        let record = &registry["records"]["local.failure-test"];
        let failure = &record["errors"]["project-a"];
        assert_eq!(failure["code"], "EXTENSION_FAILED");
        assert_eq!(failure["reason"], "runtimeFailure");
        assert_eq!(failure["message"], EXTERNAL_FAILURE_MESSAGE);
        assert_eq!(failure["extensionId"], "local.failure-test");
        assert_eq!(failure["activationId"], "lease-a");
        assert_eq!(failure["projectId"], "project-a");
        assert_eq!(record["activations"]["project-a"], Value::Null);
        assert_eq!(record["activations"]["project-b"], "lease-b");
        assert_eq!(record["errors"]["project-b"], Value::Null);
        let snapshot = log_snapshot(record, Some("project-a"));
        assert_private_error_absent(&snapshot.to_string());
        assert_eq!(snapshot["items"][0]["event"], "runtimeFailure");
        assert_eq!(snapshot["items"][0]["activationId"], "lease-a");
    }

    #[test]
    fn external_error_from_stale_activation_cannot_change_registry() {
        let (_directory, state) = fixture("quickjs");
        let before = fs::read(registry_path(&state)).unwrap();
        let failure = persist_runtime_failure(&state, "local.failure-test", "old-lease", Some("project-a"), PRIVATE_ERROR).unwrap_err();
        assert_eq!(failure.code, "STALE_SCOPE");
        assert_eq!(fs::read(registry_path(&state)).unwrap(), before);
    }

    #[test]
    fn external_error_migration_scrubs_old_text_without_changing_policy_or_settings() {
        let (_directory, state) = fixture("quickjs");
        let mut registry = read_registry(&state).unwrap();
        let record = &mut registry["records"]["local.failure-test"];
        record["enabledGlobal"] = json!(false);
        record["pausedGlobal"] = json!(true);
        record["projects"] = json!({"project-a":{"policy":"disabled","paused":true}});
        record["grants"] = json!(["storage"]);
        record["errors"] = json!({"project-a":{"code":"EXTENSION_FAILED","message":PRIVATE_ERROR}});
        record["logs"] = json!([
            {"time":"2026-10-30T20:00:00Z","message":"实例按需激活"},
            {"time":"2026-10-30T20:01:00Z","message":PRIVATE_ERROR},
            {"time":"2026-10-30T20:02:00Z","message":format!("实例按需激活 {PRIVATE_ERROR}"),"extra":PRIVATE_ERROR}
        ]);
        let before = record.clone();
        write_registry(&state, &registry).unwrap();
        initialize(&state).unwrap();
        let registry = read_registry(&state).unwrap();
        let after = &registry["records"]["local.failure-test"];
        assert_private_error_absent(&after.to_string());
        for field in ["enabledGlobal", "pausedGlobal", "projects", "grants", "config", "projectConfig", "manifest", "installed"] {
            assert_eq!(after[field], before[field], "migration changed {field}");
        }
        assert_eq!(after["logs"][0]["message"], "实例按需激活");
        assert_eq!(after["logs"][1]["message"], LEGACY_FAILURE_MESSAGE);
        assert_eq!(after["logs"][2]["message"], LEGACY_FAILURE_MESSAGE);
        assert_eq!(after["logs"][2]["extra"], Value::Null);
        assert_eq!(after["errors"]["project-a"]["activationId"], Value::Null);
        assert_eq!(after["errors"]["project-a"]["projectId"], "project-a");
        assert_eq!(after["runtimeLogPrivacyVersion"], 1);
        let once = fs::read(registry_path(&state)).unwrap();
        initialize(&state).unwrap();
        assert_eq!(fs::read(registry_path(&state)).unwrap(), once);
    }

    #[test]
    fn external_error_migration_does_not_change_trusted_host_error_channel() {
        let (_directory, state) = fixture("trusted-main");
        persist_runtime_failure(&state, "local.failure-test", "lease-a", Some("project-a"), "Host save failed at /tmp/qa-host-document.txt").unwrap();
        let before = read_registry(&state).unwrap()["records"]["local.failure-test"].clone();
        assert_eq!(before["errors"]["project-a"]["message"], "Host save failed at /tmp/qa-host-document.txt");
        initialize(&state).unwrap();
        let after = read_registry(&state).unwrap()["records"]["local.failure-test"].clone();
        assert_eq!(after["errors"], before["errors"]);
        assert_eq!(after["logs"], before["logs"]);
        assert_eq!(after["runtimeLogPrivacyVersion"], Value::Null);
    }
}

#[cfg(test)]
mod package_tests {
    use super::*;
    use std::io::Write;
    use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

    fn archive(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut writer = ZipWriter::new(fs::File::create(file.path()).unwrap());
        for (name, bytes) in entries {
            writer.start_file(*name, SimpleFileOptions::default().compression_method(CompressionMethod::Deflated)).unwrap();
            writer.write_all(bytes).unwrap();
        }
        writer.finish().unwrap();
        file
    }

    #[test]
    fn checked_in_zip_matches_development_directory() {
        let example = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../packages/plugins/examples/read-only-changes");
        let packaged = example.with_extension("horizon-extension");
        assert_eq!(package_digest(&package_files(&example).unwrap()), package_digest(&package_files(&packaged).unwrap()));
    }

    #[test]
    fn zip_rejects_traversal_absolute_paths_and_case_collisions() {
        for name in ["../outside.js", "/outside.js", "C:/outside.js", "folder/../../outside.js", "..\\outside.js"] {
            let file = archive(&[(name, b"bad")]);
            assert_eq!(package_files(file.path()).unwrap_err().code, "INVALID_ARGUMENT", "{name}");
        }
        let file = archive(&[("manifest.json", b"{}"), ("MANIFEST.json", b"{}")]);
        assert_eq!(package_files(file.path()).unwrap_err().code, "INVALID_ARGUMENT");
    }

    #[test]
    fn zip_checks_uncompressed_size() {
        let bomb = vec![0; 4 * 1024 * 1024 + 1];
        let file = archive(&[("large.js", &bomb)]);
        assert!(fs::metadata(file.path()).unwrap().len() < 10_000);
        assert_eq!(package_files(file.path()).unwrap_err().code, "RESOURCE_LIMIT");
    }

    #[test]
    fn zip_rejects_symlinks() {
        let file = tempfile::NamedTempFile::new().unwrap();
        let mut writer = ZipWriter::new(fs::File::create(file.path()).unwrap());
        writer.add_symlink("entry.js", "../../outside.js", SimpleFileOptions::default()).unwrap();
        writer.finish().unwrap();
        assert_eq!(package_files(file.path()).unwrap_err().code, "INVALID_ARGUMENT");
    }
}
