use super::*;

const READING: &[&str] = &["horizon.files", "horizon.editor", "horizon.search"];
const DEVELOPMENT: &[&str] = &["horizon.terminal", "horizon.launch"];

fn feature(record: &Value) -> bool {
    !["layouts", "themes"].iter().any(|kind| record["manifest"]["contributes"][kind].as_array().is_some_and(|items| !items.is_empty()))
}
fn enabled_ids(registry: &Value, project: Option<&str>) -> Result<Vec<String>, HostError> {
    let mut ids = Vec::new();
    for (id, record) in registry["records"].as_object().into_iter().flatten() {
        if feature(record) && state_value(registry, id, project)?["effectiveEnabled"] == true { ids.push(id.clone()); }
    }
    Ok(ids)
}
pub(super) fn current(registry: &Value, project: Option<&str>) -> Result<Value, HostError> {
    let actual = enabled_ids(registry, project)?;
    let local = &registry["profiles"][key(project)];
    let global = &registry["profiles"]["@app"];
    let (saved, source) = if local.is_object() { (local, if project.is_some() { "project" } else { "global" }) } else if global.is_object() { (global, "global") } else { (&Value::Null, "default") };
    let default_ids = json!(["horizon.editor", "horizon.files", "horizon.git", "horizon.search"]);
    let expected = saved.get("selectedIds").unwrap_or(&default_ids);
    let matches = expected.as_array().is_some_and(|items| {
        let expected: Vec<&Value> = items.iter().filter(|id| id.as_str().is_none_or(|id| registry["records"].get(id).is_none_or(feature))).collect();
        expected.len() == actual.len() && actual.iter().all(|id| expected.contains(&&json!(id)))
    });
    Ok(json!({"profile":if matches { saved["profile"].as_str().unwrap_or("review") } else { "custom" },"selectedIds":actual,"source":source}))
}
pub(super) fn state(state: &HostState, project: Option<&str>) -> Result<Value, HostError> {
    if let Some(project) = project { state.project_root(project)?; }
    let registry = read_registry(state)?;
    let mut value = current(&registry, project)?;
    let items: Vec<Value> = registry["records"].as_object().into_iter().flatten().filter(|(_, record)| feature(record))
        .map(|(id, record)| json!({"id":id,"name":record["manifest"]["name"],"installed":record["installed"],"enabledGlobal":record["enabledGlobal"],"requires":record["manifest"]["requires"]})).collect();
    value["items"] = json!(items);
    Ok(value)
}
fn registry_token(registry: &Value) -> String {
    let versions: BTreeMap<&str, &Value> = registry["records"].as_object().into_iter().flatten().map(|(id, record)| (id.as_str(), &record["revision"])).collect();
    digest(&serde_json::to_vec(&versions).unwrap())
}
fn desired_ids(registry: &Value, profile: &str, selected: &[Value]) -> Result<(BTreeSet<String>, Vec<String>), HostError> {
    let mut desired = BTreeSet::new();
    match profile {
        "minimal" | "review" | "development" => {
            desired.extend(READING.iter().map(|id| id.to_string()));
            if profile != "minimal" { desired.insert("horizon.git".into()); }
            if profile == "development" {
                for id in selected {
                    let id = id.as_str().filter(|id| DEVELOPMENT.contains(id)).ok_or_else(|| err("INVALID_ARGUMENT", "项目开发仅选择终端与项目启动器"))?;
                    desired.insert(id.to_string());
                }
            } else if !selected.is_empty() { return Err(err("INVALID_ARGUMENT", "此预设不接受自定义能力列表")); }
        }
        "custom" => {
            for id in selected {
                let id = id.as_str().ok_or_else(|| err("INVALID_ARGUMENT", "扩展 ID 必须为字符串"))?;
                if let Some(record) = registry["records"].get(id) { if !feature(record) { return Err(err("INVALID_ARGUMENT", "布局和主题通过外观设置选择")); } }
                desired.insert(id.to_string());
            }
        }
        _ => return Err(err("INVALID_ARGUMENT", "未知能力预设")),
    }
    let requested = desired.clone();
    let mut pending: Vec<String> = desired.iter().cloned().collect();
    let mut missing = Vec::new();
    while let Some(id) = pending.pop() {
        let Some(record) = registry["records"].get(&id).filter(|record| record["installed"] == true) else { missing.push(id); continue; };
        for dependency in record["manifest"]["requires"].as_object().into_iter().flatten().map(|(id, _)| id) {
            if desired.insert(dependency.clone()) { pending.push(dependency.clone()); }
        }
    }
    missing.sort(); missing.dedup();
    // Keep roots and required dependencies in one explicit plan; no package is installed here.
    debug_assert!(requested.is_subset(&desired));
    Ok((desired, missing))
}
fn choose_policy(record: &mut Value, project: Option<&str>, enabled: bool) {
    if let Some(project) = project {
        if !record["projects"].is_object() { record["projects"] = json!({}); }
        if !record["projects"][project].is_object() { record["projects"][project] = json!({}); }
        record["projects"][project]["policy"] = json!(if enabled { "enabled" } else { "disabled" });
        if enabled { record["projects"][project]["paused"] = json!(false); }
    } else {
        record["enabledGlobal"] = json!(enabled);
        if enabled { record["pausedGlobal"] = json!(false); }
    }
}
pub(super) fn prepare(state: &HostState, call: &Call) -> Result<Value, HostError> {
    let params = &call.params;
    let project = match str_param(params, "scope")? {
        "global" => None,
        "project" => { let project = str_param(params, "projectId")?; state.project_root(project)?; if call.scope["kind"] == "project" && call.scope["projectId"] != project { return Err(err("PERMISSION_DENIED", "预设项目与请求范围不一致")); } Some(project) }
        _ => return Err(err("INVALID_ARGUMENT", "预设范围无效")),
    };
    let profile = str_param(params, "profile")?;
    let empty = Vec::new();
    let selected = if params["selectedIds"].is_null() { &empty } else { params["selectedIds"].as_array().ok_or_else(|| err("INVALID_ARGUMENT", "selectedIds 必须为数组"))? };
    let registry = read_registry(state)?;
    let (desired, missing) = desired_ids(&registry, profile, selected)?;
    let mut enable = Vec::new(); let mut stop = BTreeSet::new(); let mut policy_ids = BTreeSet::new();
    for (id, record) in registry["records"].as_object().into_iter().flatten() {
        if record["installed"] != true || (!feature(record) && !desired.contains(id)) { continue; }
        policy_ids.insert(id.clone());
        let current = state_value(&registry, id, project)?;
        if desired.contains(id) {
            if current["effectiveEnabled"] != true || current["effectivePaused"] == true { enable.push(id.clone()); }
        } else if current["effectiveEnabled"] == true || record["activations"].as_object().is_some_and(|activations| if let Some(project) = project { activations.contains_key(project) } else { !activations.is_empty() }) {
            stop.insert(id.clone());
        }
    }
    for id in stop.clone() { stop.extend(dependents_of(&registry, &id)); }
    let mut blockers = Vec::new();
    for id in &stop { if desired.contains(id) { blockers.push(format!("{id} 同时被选择启用和停止，请检查依赖")); } policy_ids.insert(id.clone()); }
    let mut candidate = registry.clone();
    for id in &policy_ids { if let Ok(record) = record_mut(&mut candidate, id) { choose_policy(record, project, desired.contains(id)); } }
    for id in &desired {
        if missing.contains(id) { continue; }
        if let Err(error) = check_gate(&candidate, id, project, &mut BTreeSet::new()) { blockers.push(format!("{id}: {}", error.message)); }
    }
    blockers.sort(); blockers.dedup();
    let mut stop: Vec<String> = stop.into_iter().collect();
    stop.sort_by_key(|id| dependents_of(&registry, id).len());
    let mut plan = stop_impact(state, &registry, &stop, project);
    for (field, value) in json!({"kind":"preset","profile":profile,"scope":params["scope"],"projectId":project,"selectedIds":desired,"enableIds":enable,"stopIds":stop,"policyIds":policy_ids,"missingIds":missing,"blockers":blockers,"registryToken":registry_token(&registry)}).as_object().unwrap() { plan[field] = value.clone(); }
    Ok(save_plan(plan))
}
pub(super) async fn apply(state: Arc<HostState>, app: AppHandle, call: &Call) -> Result<Value, HostError> {
    let plan = get_plan(&call.params, "preset")?;
    let _guard = PlanGuard::claim(&plan)?;
    if plan["missingIds"].as_array().is_some_and(|ids| !ids.is_empty()) { return Err(err("EXTENSION_MISSING", "预设需要的扩展尚未安装，请先明确安装缺失包")); }
    if plan["blockers"].as_array().is_some_and(|items| !items.is_empty()) { return Err(err("DEPENDENCY_UNAVAILABLE", "预设仍有权限、依赖或全局策略限制")); }
    let decisions = call.params["decisions"].as_array().ok_or_else(|| err("INVALID_ARGUMENT", "decisions 必须为数组"))?;
    let project = plan["projectId"].as_str();
    let ids: Vec<String> = plan["stopIds"].as_array().unwrap().iter().filter_map(Value::as_str).map(str::to_string).collect();
    let registry = read_registry(&state)?;
    if registry_token(&registry) != plan["registryToken"].as_str().unwrap_or("") { return Err(err("STALE_VERSION", "扩展配置已变化，请重新检查预设")); }
    validate_impact(&state, &registry, &plan, decisions)?;
    if state.is_cancelled(&call.request_id) { return Err(err("CANCELLED", "预设应用已取消")); }
    begin_stop_targets(&state, &app, &ids, project)?;
    stop_targets(&state, &app, &ids, project).await?;
    finish_document_stop(&state, &app, &ids, &plan, decisions)?;
    let _lock = lock().lock().unwrap();
    let mut registry = read_registry(&state)?;
    let desired: BTreeSet<String> = plan["selectedIds"].as_array().unwrap().iter().filter_map(Value::as_str).map(str::to_string).collect();
    for id in plan["policyIds"].as_array().unwrap().iter().filter_map(Value::as_str) {
        let record = record_mut(&mut registry, id)?;
        choose_policy(record, project, desired.contains(id));
        if ids.iter().any(|stopped| stopped == id) {
            if let Some(project) = project {
                for field in ["activations", "runLeases", "launchOrigins", "directActivations"] { if let Some(values) = record[field].as_object_mut() { values.remove(project); } }
            } else { for field in ["activations", "runLeases", "launchOrigins", "directActivations"] { record[field] = json!({}); } }
            record["stopping"][key(project)] = json!(false);
            set_cleanup_error(record, project, None);
        }
        append_log(record, &format!("应用能力预设 {}", plan["profile"].as_str().unwrap_or("custom")));
        bump_policy(record);
    }
    if !registry["profiles"].is_object() { registry["profiles"] = json!({}); }
    registry["profiles"][key(project)] = json!({"profile":plan["profile"],"selectedIds":plan["selectedIds"]});
    write_registry(&state, &registry)?;
    consume_plan(&plan);
    for id in plan["policyIds"].as_array().unwrap().iter().filter_map(Value::as_str) { changed(&app, id); }
    state.notify("horizon.settings.v1", project.unwrap_or("global"), 0, "upsert");
    Ok(json!({"applied":true,"profile":current(&registry, project)?,"enabledIds":plan["enableIds"],"stoppedIds":ids,"processesStarted":0}))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (tempfile::TempDir, Arc<HostState>) {
        let dir = tempfile::tempdir().unwrap();
        let state = Arc::new(HostState::new(dir.path().into()).unwrap());
        initialize(&state).unwrap();
        (dir, state)
    }
    fn request(profile: &str, selected: Value) -> Call {
        Call { protocol_version: 1, request_id: uuid::Uuid::new_v4().to_string(), method: "extension_preset_prepare".into(), scope: json!({"kind":"app"}), params: json!({"profile":profile,"scope":"global","selectedIds":selected}), idempotency_key: None }
    }
    #[test]
    fn initial_profile_is_review_and_preparing_development_does_not_enable_or_start() {
        let (_dir, state) = fixture();
        assert_eq!(resource_profile(&state, None).unwrap()["profile"], "review");
        let before = fs::read(registry_path(&state)).unwrap();
        let plan = prepare(&state, &request("development", json!(["horizon.terminal", "horizon.launch"]))).unwrap();
        assert!(plan["enableIds"].as_array().unwrap().contains(&json!("horizon.terminal")));
        assert!(plan["enableIds"].as_array().unwrap().contains(&json!("horizon.launch")));
        assert_eq!(plan["blockers"], json!([]));
        assert_eq!(before, fs::read(registry_path(&state)).unwrap());
        assert_eq!(activation_id(&state, "horizon.terminal", None).unwrap_err().code, "EXTENSION_DISABLED");
    }
    #[test]
    fn custom_selection_includes_dependencies_and_leaves_appearance_out_of_stop_list() {
        let (_dir, state) = fixture();
        let mut registry = read_registry(&state).unwrap();
        registry["records"]["local.consumer"] = initial_record(json!({"id":"local.consumer","version":"1.0.0","name":"Consumer","requires":{"horizon.git":"^0.1.0"},"capabilities":[],"contributes":{},"runtime":{"kind":"declarative"}}), false);
        write_registry(&state, &registry).unwrap();
        let plan = prepare(&state, &request("custom", json!(["local.consumer"]))).unwrap();
        assert!(plan["selectedIds"].as_array().unwrap().contains(&json!("horizon.git")));
        assert!(plan["stopIds"].as_array().unwrap().contains(&json!("horizon.editor")));
        assert!(plan["stopIds"].as_array().unwrap().iter().all(|id| !id.as_str().unwrap().starts_with("horizon.layout.") && !id.as_str().unwrap().starts_with("horizon.theme.")));
        assert_eq!(plan["blockers"], json!([]));
    }
    #[test]
    fn missing_packages_and_cycles_are_reported_without_installing() {
        let (_dir, state) = fixture();
        let plan = prepare(&state, &request("custom", json!(["local.missing"]))).unwrap();
        assert_eq!(plan["missingIds"], json!(["local.missing"]));
        assert!(!state.data_dir().join("extensions/packages/local.missing").exists());
        let mut registry = read_registry(&state).unwrap();
        registry["records"]["horizon.git"]["manifest"]["requires"] = json!({"horizon.git":"*"});
        write_registry(&state, &registry).unwrap();
        let plan = prepare(&state, &request("review", json!([]))).unwrap();
        assert!(plan["blockers"].as_array().unwrap().iter().any(|value| value.as_str().unwrap().contains("依赖形成环")));
    }
    #[test]
    fn manual_feature_policy_change_makes_profile_custom() {
        let (_dir, state) = fixture();
        let mut registry = read_registry(&state).unwrap();
        registry["records"]["horizon.git"]["enabledGlobal"] = json!(false);
        write_registry(&state, &registry).unwrap();
        assert_eq!(resource_profile(&state, None).unwrap()["profile"], "custom");
        assert_eq!(crate::settings::effective_for(&state, None).unwrap()["resources.profile"], "custom");
    }
    #[test]
    fn settings_patch_cannot_bypass_preset_confirmation() {
        let (_dir, state) = fixture();
        let mut call = request("minimal", json!([]));
        call.method = "settings_patch".into();
        call.params = json!({"scope":"global","expectedRevision":1,"set":{"resources.profile":"minimal"},"unset":[]});
        assert_eq!(crate::settings::dispatch(state.clone(), call).unwrap_err().code, "INVALID_ARGUMENT");
        assert_eq!(resource_profile(&state, None).unwrap()["profile"], "review");
    }
}
