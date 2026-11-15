use super::{
    append_log, bump, check_gate, err, key, lock, read_registry, record, record_mut, str_param,
    write_registry,
};
use crate::{HostError, HostState};
use serde_json::{json, Value};
use std::{collections::BTreeSet, path::Path};

fn identifier(value: &str) -> bool {
    value
        .as_bytes()
        .first()
        .is_some_and(u8::is_ascii_alphabetic)
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"_.+-".contains(&byte))
}

fn array<'a>(value: &'a Value, field: &str) -> Result<&'a [Value], HostError> {
    match value.get(field) {
        None => Ok(&[]),
        Some(value) => value
            .as_array()
            .map(Vec::as_slice)
            .ok_or_else(|| err("INVALID_ARGUMENT", format!("{field} 必须是数组"))),
    }
}

fn valid_command(command: &str) -> bool {
    !command.trim().is_empty() && !command.contains('\0')
}

fn valid_args(args: &Value) -> bool {
    args.as_array().is_some_and(|args| {
        args.iter()
            .all(|arg| arg.as_str().is_some_and(|arg| !arg.contains('\0')))
    })
}

pub(super) fn validate_contributions(manifest: &Value) -> Result<(), HostError> {
    let servers = array(&manifest["contributes"], "languageServers")?;
    if !servers.is_empty() {
        if manifest["runtime"]["kind"] != "declarative" {
            return Err(err(
                "INVALID_ARGUMENT",
                "语言服务器贡献必须使用声明式运行时",
            ));
        }
        if !manifest["capabilities"]
            .as_array()
            .is_some_and(|caps| caps.contains(&json!("language.server")))
        {
            return Err(err(
                "PERMISSION_DENIED",
                "语言服务器贡献需要 language.server 能力",
            ));
        }
    }
    let mut ids = BTreeSet::new();
    for server in servers {
        crate::protocol::allowed(
            server,
            &[
                "id",
                "languageIds",
                "rootMarkers",
                "command",
                "args",
                "initializationOptions",
                "settings",
            ],
        )?;
        let id = str_param(server, "id")?;
        if !identifier(id) || !ids.insert(id) {
            return Err(err("INVALID_ARGUMENT", "语言服务器 ID 无效或重复"));
        }
        let languages = array(server, "languageIds")?;
        let mut language_ids = BTreeSet::new();
        if languages.is_empty()
            || languages.iter().any(|value| {
                !value
                    .as_str()
                    .is_some_and(|id| identifier(id) && language_ids.insert(id))
            })
        {
            return Err(err(
                "INVALID_ARGUMENT",
                "languageIds 必须包含不重复的语言 ID",
            ));
        }
        if !valid_command(str_param(server, "command")?) {
            return Err(err("INVALID_ARGUMENT", "语言服务器 command 无效"));
        }
        if server.get("args").is_some_and(|args| !valid_args(args)) {
            return Err(err("INVALID_ARGUMENT", "语言服务器 args 必须是字符串数组"));
        }
        if array(server, "rootMarkers")?.iter().any(|value| {
            !value.as_str().is_some_and(|marker| {
                !marker.is_empty()
                    && marker != "."
                    && marker != ".."
                    && !marker.contains(['/', '\\', '\0'])
            })
        }) {
            return Err(err("INVALID_ARGUMENT", "rootMarkers 必须是文件或目录名"));
        }
        for field in ["initializationOptions", "settings"] {
            if server.get(field).is_some_and(|value| !value.is_object()) {
                return Err(err("INVALID_ARGUMENT", format!("{field} 必须是对象")));
            }
        }
    }
    Ok(())
}

fn language_for_path(registry: &Value, project: &str, path: &Path) -> Option<String> {
    let filename = path.file_name()?.to_str()?;
    let lower = filename.to_lowercase();
    let mut matched = None;
    let mut match_length = 0;
    for (id, package) in registry["records"].as_object().into_iter().flatten() {
        if check_gate(registry, id, Some(project), &mut BTreeSet::new()).is_err() {
            continue;
        }
        for language in package["manifest"]["contributes"]["languages"]
            .as_array()
            .into_iter()
            .flatten()
        {
            if language["filenames"]
                .as_array()
                .is_some_and(|names| names.iter().any(|name| name == filename))
            {
                return language["id"].as_str().map(str::to_owned);
            }
            for suffix in language["extensions"]
                .as_array()
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
            {
                if suffix.len() > match_length && lower.ends_with(&suffix.to_lowercase()) {
                    matched = language["id"].as_str().map(str::to_owned);
                    match_length = suffix.len();
                }
            }
        }
    }
    matched
}

pub fn language_id_for_file(
    state: &HostState,
    project: &str,
    path: &Path,
) -> Result<Option<String>, HostError> {
    Ok(language_for_path(&read_registry(state)?, project, path))
}

fn setting<'a>(package: &'a Value, project: &str, name: &str) -> Option<&'a Value> {
    package["projectConfig"][project]
        .get(name)
        .filter(|value| !value.is_null())
        .or_else(|| package["config"].get(name).filter(|value| !value.is_null()))
        .or_else(|| {
            package["manifest"]["contributes"]["settings"]
                .as_array()
                .and_then(|settings| settings.iter().find(|setting| setting["key"] == name))
                .and_then(|setting| setting.get("default"))
        })
}

fn configure(package: &Value, project: &str, mut server: Value) -> Result<Value, HostError> {
    let id = str_param(&server, "id")?.to_owned();
    if let Some(value) = setting(package, project, &format!("server.{id}.command")) {
        let command = value
            .as_str()
            .ok_or_else(|| err("INVALID_ARGUMENT", "语言服务器程序设置必须是字符串"))?;
        if !command.trim().is_empty() {
            if !valid_command(command) {
                return Err(err("INVALID_ARGUMENT", "语言服务器程序设置无效"));
            }
            server["command"] = json!(command);
        }
    }
    if let Some(value) = setting(package, project, &format!("server.{id}.args")) {
        let text = value
            .as_str()
            .ok_or_else(|| err("INVALID_ARGUMENT", "语言服务器参数设置必须是 JSON 数组文本"))?;
        if !text.trim().is_empty() {
            let args: Value = serde_json::from_str(text).map_err(|_| {
                err(
                    "INVALID_ARGUMENT",
                    "语言服务器参数设置必须是 JSON 字符串数组",
                )
            })?;
            if !valid_args(&args) {
                return Err(err(
                    "INVALID_ARGUMENT",
                    "语言服务器参数设置必须是 JSON 字符串数组",
                ));
            }
            server["args"] = args;
        }
    }
    Ok(server)
}

pub(super) fn validate_setting(
    manifest: &Value,
    name: &str,
    value: &Value,
) -> Result<(), HostError> {
    if value.is_null() {
        return Ok(());
    }
    for server in manifest["contributes"]["languageServers"]
        .as_array()
        .into_iter()
        .flatten()
    {
        let id = str_param(server, "id")?;
        if name == format!("server.{id}.command") {
            let command = value
                .as_str()
                .ok_or_else(|| err("INVALID_ARGUMENT", "语言服务器程序设置必须是字符串"))?;
            if !command.trim().is_empty() && !valid_command(command) {
                return Err(err("INVALID_ARGUMENT", "语言服务器程序设置无效"));
            }
        } else if name == format!("server.{id}.args") {
            let text = value
                .as_str()
                .ok_or_else(|| err("INVALID_ARGUMENT", "语言服务器参数设置必须是 JSON 数组文本"))?;
            if !text.trim().is_empty() {
                let args: Value = serde_json::from_str(text).map_err(|_| {
                    err(
                        "INVALID_ARGUMENT",
                        "语言服务器参数设置必须是 JSON 字符串数组",
                    )
                })?;
                if !valid_args(&args) {
                    return Err(err(
                        "INVALID_ARGUMENT",
                        "语言服务器参数设置必须是 JSON 字符串数组",
                    ));
                }
            }
        }
    }
    Ok(())
}

fn activate(
    registry: &mut Value,
    id: &str,
    project: &str,
    direct: bool,
) -> Result<bool, HostError> {
    let dependencies: Vec<String> = record(registry, id)?["manifest"]["requires"]
        .as_object()
        .into_iter()
        .flatten()
        .map(|(id, _)| id.clone())
        .collect();
    let mut changed = false;
    for dependency in dependencies {
        changed |= activate(registry, &dependency, project, false)?;
    }
    let package = record_mut(registry, id)?;
    if !package["activations"][project].is_string() {
        package["activations"][project] = json!(uuid::Uuid::new_v4().to_string());
        if !package["sleeping"].is_object() {
            package["sleeping"] = json!({});
        }
        package["sleeping"][project] = json!(false);
        if let Some(errors) = package["errors"].as_object_mut() {
            errors.remove(project);
        }
        append_log(
            package,
            if direct {
                "实例按需激活"
            } else {
                "作为显式激活的必需依赖启动"
            },
        );
        bump(package);
        changed = true;
    }
    if direct {
        if !package["directActivations"].is_object() {
            package["directActivations"] = json!({});
        }
        if package["directActivations"][project] != package["activations"][project] {
            package["directActivations"][project] = package["activations"][project].clone();
            changed = true;
        }
    }
    Ok(changed)
}

/// Resolve a declared server under current extension policy, then establish its activation owner.
/// Executable resolution and the process itself remain owned by the native language service.
pub fn language_server_for_file(
    state: &HostState,
    project: &str,
    path: &Path,
    server_id: Option<&str>,
) -> Result<Value, HostError> {
    language_server_for_file_at_revision(state, project, path, server_id, None)
}

pub(crate) fn language_server_for_file_at_revision(
    state: &HostState,
    project: &str,
    path: &Path,
    server_id: Option<&str>,
    expected_revision: Option<u64>,
) -> Result<Value, HostError> {
    let _guard = lock().lock().unwrap();
    let mut registry = read_registry(state)?;
    let language = language_for_path(&registry, project, path)
        .ok_or_else(|| err("LANGUAGE_SERVER_UNAVAILABLE", "此文件没有已启用的语言声明"))?;
    let mut chosen = None;
    for (id, package) in registry["records"].as_object().into_iter().flatten() {
        for declaration in package["manifest"]["contributes"]["languageServers"]
            .as_array()
            .into_iter()
            .flatten()
        {
            if server_id.is_some_and(|server| declaration["id"] != server)
                || !declaration["languageIds"]
                    .as_array()
                    .is_some_and(|languages| languages.contains(&json!(language)))
            {
                continue;
            }
            match check_gate(&registry, id, Some(project), &mut BTreeSet::new()) {
                Ok(()) => {}
                Err(error) if server_id.is_some() => return Err(error),
                Err(_) => continue,
            }
            if !package["grants"]
                .as_array()
                .is_some_and(|grants| grants.contains(&json!("language.server")))
            {
                return Err(err(
                    "PERMISSION_DENIED",
                    "语言服务器缺少 language.server 授权",
                ));
            }
            chosen = Some((
                id.clone(),
                configure(package, project, declaration.clone())?,
            ));
            break;
        }
        if chosen.is_some() {
            break;
        }
    }
    let (extension_id, server) =
        chosen.ok_or_else(|| err("LANGUAGE_SERVER_UNAVAILABLE", "此语言没有已启用的语义插件"))?;
    let package = record(&registry, &extension_id)?;
    if expected_revision.is_some_and(|expected| {
        expected
            < package["languageServerLifecycleRevision"]
                .as_u64()
                .unwrap_or(0)
            || expected > package["revision"].as_u64().unwrap_or(0)
    }) {
        return Err(err(
            "STALE_VERSION",
            "语言服务生命周期已变化，请重新查询后连接",
        ));
    }
    if activate(&mut registry, &extension_id, project, true)? {
        write_registry(state, &registry)?;
    }
    let package = record(&registry, &extension_id)?;
    Ok(
        json!({"server":server,"extensionId":extension_id,"languageId":language,
        "activationId":package["activations"][key(Some(project))],"packageDir":package["packageDir"],
        "revision":package["revision"],"initializationOptions":server["initializationOptions"],"settings":server["settings"]}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn manifest() -> Value {
        json!({"id":"local.semantic", "name":"Semantic", "version":"0.1.0", "description":"Example", "author":"Example", "apiVersion":1,
            "engines":{"horizon":">=0.1.0 <0.2.0"},"runtime":{"kind":"declarative"},"activation":["onLanguage:example"],
            "requires":{},"optional":{},"capabilities":["language.server"],"contributes":{
                "languages":[{"id":"example","extensions":[".example"]}],
                "languageServers":[{"id":"example","languageIds":["example"],"command":"example-lsp","args":["--stdio"],"rootMarkers":["Examplefile"],"settings":{}}]}})
    }

    #[test]
    fn declarations_require_explicit_server_capability_and_valid_arguments() {
        let original = manifest();
        super::super::validate_manifest(&original, false).unwrap();
        for changes in [
            json!({"command":""}),
            json!({"command":"bad\u{0000}command"}),
            json!({"args":"--stdio"}),
            json!({"args":[1]}),
            json!({"languageIds":[]}),
            json!({"languageIds":["example","example"]}),
            json!({"rootMarkers":["../outside"]}),
            json!({"settings":[]}),
            json!({"initializationOptions":null}),
        ] {
            let mut value = original.clone();
            for (key, change) in changes.as_object().unwrap() {
                value["contributes"]["languageServers"][0][key] = change.clone();
            }
            assert!(
                super::super::validate_manifest(&value, false).is_err(),
                "accepted {changes}"
            );
        }
        let mut missing = original.clone();
        missing["capabilities"] = json!([]);
        assert_eq!(
            super::super::validate_manifest(&missing, false)
                .unwrap_err()
                .code,
            "PERMISSION_DENIED"
        );
        let mut runtime = original;
        runtime["runtime"] = json!({"kind":"quickjs","entry":"main.js"});
        assert!(super::super::validate_manifest(&runtime, false).is_err());
    }

    #[test]
    fn same_server_id_cannot_be_claimed_by_another_installed_plugin() {
        let original = manifest();
        let registry = json!({"records":{"local.semantic":{"installed":true,"manifest":original}}});
        let mut other = manifest();
        other["id"] = json!("local.other");
        other["contributes"]
            .as_object_mut()
            .unwrap()
            .remove("languages");
        assert!(super::super::dependency_check(&registry, &other).is_err());
        other["contributes"]["languageServers"][0]["id"] = json!("another");
        super::super::dependency_check(&registry, &other).unwrap();
    }

    #[test]
    fn resolution_applies_project_config_and_preserves_one_activation_per_project() {
        let data = tempfile::tempdir().unwrap();
        let state = HostState::new(data.path().into()).unwrap();
        let mut package = super::super::initial_record(manifest(), false);
        package["config"] =
            json!({"server.example.command":"global-lsp", "server.example.args":"[\"--global\"]"});
        package["projectConfig"] = json!({"project-a":{"server.example.command":"project-lsp", "server.example.args":"[\"--project\",\"中文\"]"}});
        write_registry(&state, &json!({"records":{"local.semantic":package}})).unwrap();
        let path = Path::new("/project/main.example");
        let first = language_server_for_file(&state, "project-a", path, None).unwrap();
        let again = language_server_for_file(&state, "project-a", path, Some("example")).unwrap();
        let other = language_server_for_file(&state, "project-b", path, None).unwrap();
        assert_eq!(first["server"]["command"], "project-lsp");
        assert_eq!(first["server"]["args"], json!(["--project", "中文"]));
        assert_eq!(first["activationId"], again["activationId"]);
        assert_ne!(first["activationId"], other["activationId"]);
        assert_eq!(other["server"]["command"], "global-lsp");
        let mut registry = read_registry(&state).unwrap();
        registry["records"]["local.semantic"]["projects"]["project-a"] = json!({"paused":true});
        write_registry(&state, &registry).unwrap();
        assert!(language_server_for_file(&state, "project-a", path, None).is_err());
        language_server_for_file(&state, "project-b", path, None).unwrap();
    }

    #[test]
    fn language_resolution_uses_exact_filename_then_longest_suffix() {
        let mut package = super::super::initial_record(manifest(), false);
        package["manifest"]["contributes"]["languages"] = json!([
            {"id":"example","extensions":[".example"]},
            {"id":"definition","extensions":[".d.example"]},
            {"id":"config","filenames":["Config.example"]}
        ]);
        let registry = json!({"records":{"local.semantic":package}});
        assert_eq!(
            language_for_path(&registry, "p", Path::new("main.D.EXAMPLE")).as_deref(),
            Some("definition")
        );
        assert_eq!(
            language_for_path(&registry, "p", Path::new("Config.example")).as_deref(),
            Some("config")
        );
    }

    #[test]
    fn semantic_plugin_uses_dependency_language_and_follows_its_own_policy() {
        let data = tempfile::tempdir().unwrap();
        let state = HostState::new(data.path().into()).unwrap();
        let mut syntax = manifest();
        syntax["id"] = json!("local.syntax");
        syntax["capabilities"] = json!([]);
        syntax["contributes"]
            .as_object_mut()
            .unwrap()
            .remove("languageServers");
        let mut semantic = manifest();
        semantic["requires"] = json!({"local.syntax":"^0.1.0"});
        semantic["contributes"]
            .as_object_mut()
            .unwrap()
            .remove("languages");
        let mut registry = json!({"records":{
            "local.syntax":super::super::initial_record(syntax, false),
            "local.semantic":super::super::initial_record(semantic, false)
        }});
        write_registry(&state, &registry).unwrap();
        let path = Path::new("/project/main.example");
        let selected = language_server_for_file(&state, "p", path, None).unwrap();
        assert_eq!(selected["extensionId"], "local.semantic");
        assert_eq!(selected["languageId"], "example");
        registry = read_registry(&state).unwrap();
        assert!(registry["records"]["local.syntax"]["activations"]["p"].is_string());
        registry["records"]["local.semantic"]["enabledGlobal"] = json!(false);
        write_registry(&state, &registry).unwrap();
        assert_eq!(
            language_server_for_file(&state, "p", path, Some("example"))
                .unwrap_err()
                .code,
            "EXTENSION_DISABLED"
        );
        registry["records"]["local.semantic"]["enabledGlobal"] = json!(true);
        registry["records"]["local.semantic"]["grants"] = json!([]);
        write_registry(&state, &registry).unwrap();
        assert_eq!(
            language_server_for_file(&state, "p", path, Some("example"))
                .unwrap_err()
                .code,
            "PERMISSION_DENIED"
        );
    }

    #[test]
    fn server_setting_validation_rejects_invalid_json_before_saving() {
        let manifest = manifest();
        for value in [json!("[\"--stdio\"]"), json!("[]"), json!(""), Value::Null] {
            validate_setting(&manifest, "server.example.args", &value).unwrap();
        }
        for value in [
            json!("--stdio"),
            json!("[1]"),
            json!("{}"),
            json!("[\"bad\\u0000arg\"]"),
        ] {
            assert!(validate_setting(&manifest, "server.example.args", &value).is_err());
        }
    }

    #[test]
    fn global_sleep_is_visible_in_project_state_until_that_project_wakes() {
        let mut package = super::super::initial_record(manifest(), false);
        package["sleeping"] = json!({"@app":true});
        let mut registry = json!({"records":{"local.semantic":package}});
        assert_eq!(
            super::super::state_value(&registry, "local.semantic", Some("project-a")).unwrap()
                ["runState"],
            "sleeping"
        );
        registry["records"]["local.semantic"]["sleeping"]["project-a"] = json!(false);
        assert_eq!(
            super::super::state_value(&registry, "local.semantic", Some("project-a")).unwrap()
                ["runState"],
            "stopped"
        );
        assert_eq!(
            super::super::state_value(&registry, "local.semantic", Some("project-b")).unwrap()
                ["runState"],
            "sleeping"
        );
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn stop_plan_includes_owned_language_server_and_stops_its_process() {
        use std::{fs, sync::Arc};
        let data = tempfile::tempdir().unwrap();
        let directory = tempfile::tempdir().unwrap();
        let state = Arc::new(HostState::new(data.path().into()).unwrap());
        let project = state
            .register_project(directory.path().into(), None, None)
            .unwrap()["project"]["id"]
            .as_str()
            .unwrap()
            .to_owned();
        state.epochs.lock().unwrap().insert(project.clone(), 1);
        let path = state.project_root(&project).unwrap().join("main.example");
        fs::write(&path, "example").unwrap();
        let file = state.file_ref(&project, &path).unwrap();
        let mut declared = manifest();
        declared["id"] = json!(format!("local.stop-plan.{}", uuid::Uuid::new_v4()));
        declared["contributes"]["languageServers"][0]["command"] = json!("/bin/cat");
        declared["contributes"]["languageServers"][0]["args"] = json!([]);
        let extension = declared["id"].as_str().unwrap().to_owned();
        let package = super::super::initial_record(declared, false);
        write_registry(&state, &json!({"records":{&extension:package}})).unwrap();
        let call = crate::Call {
            protocol_version: 1,
            request_id: uuid::Uuid::new_v4().to_string(),
            method: "language_server_connect".into(),
            scope: json!({"kind":"project","projectId":project,"projectEpoch":1}),
            params: json!({"fileId":file["fileId"]}),
            idempotency_key: Some(uuid::Uuid::new_v4().to_string()),
        };
        let connected = crate::language_servers::dispatch(
            state.clone(),
            call,
            Some(tauri::ipc::Channel::new(|_| Ok(()))),
        )
        .await
        .unwrap();
        let registry = read_registry(&state).unwrap();
        let plan = super::super::prepare_stop(
            &state,
            &registry,
            &extension,
            "sleep",
            "project",
            Some(&project),
        )
        .unwrap();
        assert_eq!(plan["resources"].as_array().unwrap().len(), 1);
        assert_eq!(plan["resources"][0]["resourceId"], connected["sessionId"]);
        assert_eq!(plan["resources"][0]["ownerExtensionId"], extension);
        assert_eq!(plan["resources"][0]["projectId"], project);
        let app = tauri::test::mock_app();
        let targets = vec![extension.clone()];
        super::super::begin_stop_targets(&state, app.handle(), &targets, Some(&project)).unwrap();
        super::super::stop_targets(&state, app.handle(), &targets, Some(&project))
            .await
            .unwrap();
        assert!(crate::language_servers::resources(Some(&project)).is_empty());
        assert!(super::super::stop_impact(
            &state,
            &read_registry(&state).unwrap(),
            &targets,
            Some(&project)
        )["resources"]
            .as_array()
            .unwrap()
            .is_empty());
    }
}
