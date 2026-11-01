//! Registry-policy integration tests. Installed records are fixtures; these do not replace GUI install tests.
use horizon_host::{extensions, HostState};
use serde_json::{json, Value};
use std::fs;

struct Fixture {
    data: tempfile::TempDir,
    state: HostState,
}
impl Fixture {
    fn new() -> Self {
        let data = tempfile::tempdir().unwrap();
        let state = HostState::new(data.path().into()).unwrap();
        extensions::initialize(&state).unwrap();
        Self { data, state }
    }
    fn registry(&self) -> Value {
        serde_json::from_slice(
            &fs::read(self.data.path().join("extensions/registry.json")).unwrap(),
        )
        .unwrap()
    }
    fn edit(&self, edit: impl FnOnce(&mut Value)) {
        let mut registry = self.registry();
        edit(&mut registry);
        fs::write(
            self.data.path().join("extensions/registry.json"),
            serde_json::to_vec(&registry).unwrap(),
        )
        .unwrap();
    }
    fn add(&self, id: &str, requires: Value) {
        self.edit(|registry|registry["records"][id]=json!({
            "manifest":{"id":id,"version":"1.0.0","runtime":{"kind":"declarative"},"requires":requires,"capabilities":[],"contributes":{}},
            "revision":1,"installed":true,"enabledGlobal":true,"pausedGlobal":false,"projects":{},"activations":{},"stopping":{},"errors":{},"grants":[],"logs":[]
        }));
    }
}

#[test]
fn project_override_cannot_enable_globally_disabled_extension() {
    let fixture = Fixture::new();
    fixture.edit(|registry| {
        let record = &mut registry["records"]["horizon.git"];
        record["enabledGlobal"] = json!(false);
        record["projects"]["project-a"] = json!({"policy":"enabled"});
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "horizon.git", Some("project-a"))
            .unwrap_err()
            .code,
        "EXTENSION_DISABLED"
    );
}

#[test]
fn pause_survives_restart_and_does_not_pause_another_project() {
    let fixture = Fixture::new();
    fixture.edit(|registry| {
        let record = &mut registry["records"]["horizon.git"];
        record["projects"]["project-a"] = json!({"paused":true});
        record["activations"] = json!({"project-a":"lease-a","project-b":"lease-b"});
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "horizon.git", Some("project-a"))
            .unwrap_err()
            .code,
        "RESOURCE_BUSY"
    );
    extensions::extension_gate(&fixture.state, "horizon.git", Some("project-b")).unwrap();
    let restarted = HostState::new(fixture.data.path().into()).unwrap();
    extensions::initialize(&restarted).unwrap();
    assert_eq!(
        extensions::extension_gate(&restarted, "horizon.git", Some("project-a"))
            .unwrap_err()
            .code,
        "RESOURCE_BUSY"
    );
    extensions::extension_gate(&restarted, "horizon.git", Some("project-b")).unwrap();
    assert_eq!(
        extensions::activation_id(&restarted, "horizon.git", Some("project-b"))
            .unwrap_err()
            .code,
        "NOT_FOUND"
    );
}

#[test]
fn global_pause_cannot_be_cleared_by_project_enabled_override() {
    let fixture = Fixture::new();
    fixture.edit(|registry| {
        let record = &mut registry["records"]["horizon.git"];
        record["pausedGlobal"] = json!(true);
        record["projects"]["project-a"] = json!({"paused":false,"policy":"enabled"});
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "horizon.git", Some("project-a"))
            .unwrap_err()
            .code,
        "RESOURCE_BUSY"
    );
}

#[test]
fn project_cleanup_failure_does_not_block_another_project() {
    let fixture = Fixture::new();
    fixture.edit(|registry| {
        registry["records"]["horizon.git"]["cleanupErrors"] = json!({"project-a":"process still stopping"});
    });
    assert_eq!(extensions::extension_gate(&fixture.state, "horizon.git", Some("project-a")).unwrap_err().code, "RESOURCE_BUSY");
    extensions::extension_gate(&fixture.state, "horizon.git", Some("project-b")).unwrap();
    fixture.edit(|registry| { registry["records"]["horizon.git"]["cleanupErrors"]["@app"] = json!("global cleanup failed"); });
    assert_eq!(extensions::extension_gate(&fixture.state, "horizon.git", Some("project-b")).unwrap_err().code, "RESOURCE_BUSY");
}

#[test]
fn missing_grant_is_rejected_before_activation() {
    let fixture = Fixture::new();
    fixture.add("local.reader", json!({}));
    fixture.edit(|registry| {
        registry["records"]["local.reader"]["manifest"]["capabilities"] = json!(["git.read"])
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "local.reader", Some("project-a"))
            .unwrap_err()
            .code,
        "PERMISSION_DENIED"
    );
}

#[test]
fn dependency_pause_blocks_consumer_in_only_the_same_project() {
    let fixture = Fixture::new();
    fixture.add("local.reader", json!({"horizon.git":"^0.1.0"}));
    fixture.edit(|registry| {
        registry["records"]["horizon.git"]["projects"]["project-a"] = json!({"paused":true})
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "local.reader", Some("project-a"))
            .unwrap_err()
            .code,
        "RESOURCE_BUSY"
    );
    extensions::extension_gate(&fixture.state, "local.reader", Some("project-b")).unwrap();
}

#[test]
fn dependency_version_change_cannot_bypass_consumer_range() {
    let fixture = Fixture::new();
    fixture.add("local.provider", json!({}));
    fixture.add("local.consumer", json!({"local.provider":"^1.0.0"}));
    extensions::extension_gate(&fixture.state, "local.consumer", Some("project-a")).unwrap();
    fixture.edit(|registry| {
        registry["records"]["local.provider"]["manifest"]["version"] = json!("2.0.0")
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "local.consumer", Some("project-a"))
            .unwrap_err()
            .code,
        "DEPENDENCY_UNAVAILABLE"
    );
}

#[test]
fn dependency_cycle_is_rejected() {
    let fixture = Fixture::new();
    fixture.add("local.first", json!({"local.second":"*"}));
    fixture.add("local.second", json!({"local.first":"*"}));
    assert_eq!(
        extensions::extension_gate(&fixture.state, "local.first", Some("project-a"))
            .unwrap_err()
            .code,
        "DEPENDENCY_UNAVAILABLE"
    );
}

#[test]
fn cleanup_failure_in_one_project_does_not_block_another() {
    let fixture = Fixture::new();
    fixture.add("local.required", json!({}));
    fixture.edit(|registry| {
        registry["records"]["local.required"]["cleanupErrors"] =
            json!({"project-a":"owned child did not exit"})
    });
    assert_eq!(
        extensions::extension_gate(&fixture.state, "local.required", Some("project-a"))
            .unwrap_err()
            .code,
        "RESOURCE_BUSY"
    );
    extensions::extension_gate(&fixture.state, "local.required", Some("project-b")).unwrap();
}

#[test]
fn restart_keeps_default_package_tombstone_and_does_not_recreate_files() {
    let fixture = Fixture::new();
    let path = fixture.data.path().join("extensions/packages/horizon.git");
    assert!(path.is_dir());
    fs::remove_dir_all(&path).unwrap();
    fixture.edit(|registry| registry["records"]["horizon.git"]["installed"] = json!(false));
    extensions::initialize(&fixture.state).unwrap();
    assert!(!path.exists());
    assert_eq!(
        extensions::extension_gate(&fixture.state, "horizon.git", Some("project-a"))
            .unwrap_err()
            .code,
        "EXTENSION_MISSING"
    );
}

#[test]
fn startup_syncs_installed_builtin_theme_declarations_and_preserves_user_state() {
    let fixture = Fixture::new();
    let original = fixture.registry();
    let themes: Vec<String> = original["records"].as_object().unwrap().keys().filter(|id| id.starts_with("horizon.theme.")).cloned().collect();
    assert_eq!(themes.len(), 8);
    let appearance = fixture.data.path().join("appearance.json");
    let colors = br##"{"global":{"theme":{"colors":{"light":{"accent":"#123456"}}}},"projects":{"project-a":{"theme":{"colors":{"dark":{"accent":"#654321"}}}}}}"##;
    fs::write(&appearance, colors).unwrap();
    fixture.edit(|registry| {
        for id in &themes {
            let record = &mut registry["records"][id];
            record["manifest"]["contributes"]["themes"][0]["light"]["background"] = json!("#abcdef");
            record["enabledGlobal"] = json!(false);
            record["pausedGlobal"] = json!(true);
            record["projects"] = json!({"project-a":{"policy":"disabled","paused":true}});
            record["config"] = json!({"choice":"retained"});
            record["projectConfig"] = json!({"project-a":{"choice":"project-retained"}});
            record["grants"] = json!(["preserved-grant"]);
        }
    });
    let before = fixture.registry();
    extensions::initialize(&fixture.state).unwrap();
    let after = fixture.registry();
    for id in &themes {
        assert_eq!(after["records"][id]["manifest"]["contributes"]["themes"], original["records"][id]["manifest"]["contributes"]["themes"]);
        for field in ["enabledGlobal", "pausedGlobal", "projects", "config", "projectConfig", "grants", "installed", "builtin"] { assert_eq!(after["records"][id][field], before["records"][id][field], "{id} {field}"); }
        let installed: Value = serde_json::from_slice(&fs::read(std::path::Path::new(after["records"][id]["packageDir"].as_str().unwrap()).join("manifest.json")).unwrap()).unwrap();
        assert_eq!(installed, after["records"][id]["manifest"]);
    }
    assert_eq!(fs::read(&appearance).unwrap(), colors);
    extensions::initialize(&fixture.state).unwrap();
    let repeated = fixture.registry();
    for id in &themes { assert_eq!(repeated["records"][id]["revision"], after["records"][id]["revision"]); }
}

#[test]
fn startup_syncs_builtin_descriptions_without_replacing_capabilities_or_user_policy() {
    let fixture = Fixture::new();
    let original = fixture.registry();
    let ids: Vec<String> = original["records"].as_object().unwrap().keys().cloned().collect();
    assert_eq!(ids.len(), 24);
    fixture.edit(|registry| {
        for id in &ids {
            let record = &mut registry["records"][id];
            record["manifest"]["description"] = json!("旧内置说明");
            record["manifest"]["name"] = json!("保留其他元数据");
            record["manifest"]["capabilities"] = json!(["preserved-capability"]);
            record["enabledGlobal"] = json!(false);
            record["pausedGlobal"] = json!(true);
            record["projects"] = json!({"project-a":{"policy":"disabled","paused":true}});
            record["config"] = json!({"choice":"retained"});
            record["projectConfig"] = json!({"project-a":{"choice":"retained"}});
            record["grants"] = json!(["preserved-grant"]);
        }
    });
    let before = fixture.registry();
    extensions::initialize(&fixture.state).unwrap();
    let after = fixture.registry();
    for id in &ids {
        let mut expected_manifest = before["records"][id]["manifest"].clone();
        expected_manifest["description"] = original["records"][id]["manifest"]["description"].clone();
        assert_eq!(after["records"][id]["manifest"], expected_manifest, "{id}");
        for field in ["enabledGlobal", "pausedGlobal", "projects", "config", "projectConfig", "grants", "installed", "builtin"] { assert_eq!(after["records"][id][field], before["records"][id][field], "{id} {field}"); }
        let installed: Value = serde_json::from_slice(&fs::read(std::path::Path::new(after["records"][id]["packageDir"].as_str().unwrap()).join("manifest.json")).unwrap()).unwrap();
        assert_eq!(installed, expected_manifest);
    }
    extensions::initialize(&fixture.state).unwrap();
    let repeated = fixture.registry();
    for id in &ids { assert_eq!(repeated["records"][id]["revision"], after["records"][id]["revision"]); }
}

#[test]
fn theme_sync_skips_uninstalled_external_and_different_version_records() {
    let fixture = Fixture::new();
    let removed = fixture.data.path().join("extensions/packages/horizon.theme.mist");
    fs::remove_dir_all(&removed).unwrap();
    fixture.edit(|registry| {
        for id in ["mist", "paper", "orbit", "graphite", "iris"] {
            registry["records"][format!("horizon.theme.{id}")]["manifest"]["contributes"]["themes"][0]["light"]["background"] = json!("#abcdef");
            registry["records"][format!("horizon.theme.{id}")]["manifest"]["description"] = json!("外部或已卸载描述应保留");
        }
        registry["records"]["horizon.theme.mist"]["installed"] = json!(false);
        registry["records"]["horizon.theme.paper"]["source"] = json!("/chosen/local-update.horizon-extension");
        registry["records"]["horizon.theme.orbit"]["manifest"]["version"] = json!("0.2.0");
        registry["records"]["horizon.theme.graphite"]["builtin"] = json!(false);
        registry["records"]["horizon.theme.iris"]["packageDir"] = json!("/chosen/external-package");
    });
    let before = fixture.registry();
    extensions::initialize(&fixture.state).unwrap();
    let after = fixture.registry();
    for id in ["mist", "paper", "orbit", "graphite", "iris"] {
        let id = format!("horizon.theme.{id}");
        for field in ["manifest", "revision", "installed", "source", "packageDir"] { assert_eq!(after["records"][&id][field], before["records"][&id][field], "{id} {field}"); }
    }
    assert!(!removed.exists());
}

#[tokio::test]
async fn launch_leases_release_only_last_owned_activation() {
    let fixture = Fixture::new();
    fixture.add("local.required", json!({}));
    let ids = vec!["local.required".to_string()];
    extensions::acquire_launch_requirements(&fixture.state, "project-a", &ids, "run-one").unwrap();
    let activation =
        extensions::activation_id(&fixture.state, "local.required", Some("project-a")).unwrap();
    extensions::acquire_launch_requirements(&fixture.state, "project-a", &ids, "run-two").unwrap();
    extensions::release_launch_requirements(&fixture.state, "project-a", "run-one")
        .await
        .unwrap();
    assert_eq!(
        extensions::activation_id(&fixture.state, "local.required", Some("project-a")).unwrap(),
        activation
    );
    extensions::release_launch_requirements(&fixture.state, "project-a", "run-two")
        .await
        .unwrap();
    assert_eq!(
        extensions::activation_id(&fixture.state, "local.required", Some("project-a"))
            .unwrap_err()
            .code,
        "NOT_FOUND"
    );
}

#[tokio::test]
async fn launch_release_preserves_preexisting_activation_and_other_project() {
    let fixture = Fixture::new();
    fixture.add("local.required", json!({}));
    fixture.edit(|registry| {
        registry["records"]["local.required"]["activations"] =
            json!({"project-a":"existing-a","project-b":"existing-b"})
    });
    let ids = vec!["local.required".to_string()];
    extensions::acquire_launch_requirements(&fixture.state, "project-a", &ids, "run").unwrap();
    extensions::release_launch_requirements(&fixture.state, "project-a", "run")
        .await
        .unwrap();
    assert_eq!(
        extensions::activation_id(&fixture.state, "local.required", Some("project-a")).unwrap(),
        "existing-a"
    );
    assert_eq!(
        extensions::activation_id(&fixture.state, "local.required", Some("project-b")).unwrap(),
        "existing-b"
    );
}
