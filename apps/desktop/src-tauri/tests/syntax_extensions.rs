use horizon_host::{extensions, HostState};
use serde_json::{json, Value};
use std::{fs, path::PathBuf};

const EXTENSION: &str = "local.syntax-test";
const SCOPE: &str = "source.syntax-test";

struct Fixture {
    data: tempfile::TempDir,
    state: HostState,
    package: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let data = tempfile::tempdir().unwrap();
        let state = HostState::new(data.path().into()).unwrap();
        extensions::initialize(&state).unwrap();
        let package = data
            .path()
            .join("extensions/packages/local.syntax-test/1.0.0");
        fs::create_dir_all(package.join("syntaxes")).unwrap();
        fs::write(
            package.join("syntaxes/test.json"),
            serde_json::to_vec(&json!({
                "scopeName": SCOPE,
                "patterns": [{"match": "\\btest\\b", "name": "keyword.test"}]
            }))
            .unwrap(),
        )
        .unwrap();
        let fixture = Self {
            data,
            state,
            package,
        };
        fixture.edit(|registry| {
            registry["records"][EXTENSION] = json!({
                "manifest": {
                    "id": EXTENSION,
                    "version": "1.0.0",
                    "runtime": {"kind": "declarative"},
                    "capabilities": [],
                    "requires": {},
                    "contributes": {
                        "languages": [{"id": "syntax-test", "extensions": [".syntax-test"]}],
                        "grammars": [{"language": "syntax-test", "scopeName": SCOPE, "path": "syntaxes/test.json"}]
                    }
                },
                "packageDir": fixture.package,
                "revision": 1,
                "installed": true,
                "enabledGlobal": true,
                "pausedGlobal": false,
                "projects": {},
                "activations": {},
                "stopping": {},
                "errors": {},
                "grants": [],
                "logs": []
            });
        });
        fixture
    }

    fn registry(&self) -> Value {
        serde_json::from_slice(
            &fs::read(self.data.path().join("extensions/registry.json")).unwrap(),
        )
        .unwrap()
    }

    fn edit(&self, change: impl FnOnce(&mut Value)) {
        let mut registry = self.registry();
        change(&mut registry);
        fs::write(
            self.data.path().join("extensions/registry.json"),
            serde_json::to_vec(&registry).unwrap(),
        )
        .unwrap();
    }

    fn read(&self, project: Option<&str>) -> Result<Value, horizon_host::HostError> {
        extensions::read_grammar(&self.state, EXTENSION, SCOPE, project)
    }
}

#[test]
fn declared_grammar_returns_raw_json_without_activation() {
    let fixture = Fixture::new();
    let grammar = fixture.read(Some("project-a")).unwrap();
    assert_eq!(grammar["scopeName"], SCOPE);
    assert_eq!(grammar["patterns"][0]["name"], "keyword.test");
    assert!(grammar.get("grammar").is_none());
    assert!(extensions::activation_id(&fixture.state, EXTENSION, Some("project-a")).is_err());
    assert!(extensions::read_grammar(
        &fixture.state,
        EXTENSION,
        "source.undeclared",
        Some("project-a")
    )
    .is_err());
}

#[test]
fn grammar_reads_follow_global_and_project_plugin_policy() {
    let fixture = Fixture::new();
    for (field, value, expected) in [
        ("enabledGlobal", json!(false), "EXTENSION_DISABLED"),
        ("pausedGlobal", json!(true), "RESOURCE_BUSY"),
        ("installed", json!(false), "EXTENSION_MISSING"),
    ] {
        fixture.edit(|registry| registry["records"][EXTENSION][field] = value);
        assert_eq!(fixture.read(Some("project-a")).unwrap_err().code, expected);
        fixture.edit(|registry| {
            registry["records"][EXTENSION][field] = json!(field != "pausedGlobal")
        });
    }
    fixture.edit(|registry| {
        registry["records"][EXTENSION]["projects"]["project-a"] = json!({"policy": "disabled"});
    });
    assert_eq!(
        fixture.read(Some("project-a")).unwrap_err().code,
        "EXTENSION_DISABLED"
    );
    fixture.read(Some("project-b")).unwrap();
    fixture.edit(|registry| {
        registry["records"][EXTENSION]["projects"]["project-a"] = json!({"paused": true});
    });
    assert_eq!(
        fixture.read(Some("project-a")).unwrap_err().code,
        "RESOURCE_BUSY"
    );
    fixture.read(Some("project-b")).unwrap();
}

#[test]
fn missing_invalid_and_mismatched_grammar_resources_are_rejected() {
    let fixture = Fixture::new();
    let path = fixture.package.join("syntaxes/test.json");
    for bytes in [
        br#"{"scopeName":"source.other","patterns":[]}"#.as_slice(),
        b"not json".as_slice(),
        b"[]".as_slice(),
    ] {
        fs::write(&path, bytes).unwrap();
        assert!(fixture.read(None).is_err());
    }
    fs::remove_file(&path).unwrap();
    assert!(fixture.read(None).is_err());
}

#[test]
fn grammar_path_cannot_escape_package_root() {
    let fixture = Fixture::new();
    fs::write(
        fixture.data.path().join("outside.json"),
        serde_json::to_vec(&json!({"scopeName": SCOPE, "patterns": []})).unwrap(),
    )
    .unwrap();
    for path in [
        "../../../../outside.json",
        "syntaxes/../syntaxes/test.json",
        "syntaxes\\test.json",
    ] {
        fixture.edit(|registry| {
            registry["records"][EXTENSION]["manifest"]["contributes"]["grammars"][0]["path"] =
                json!(path);
        });
        assert!(fixture.read(None).is_err(), "accepted {path}");
    }
    fixture.edit(|registry| {
        registry["records"][EXTENSION]["manifest"]["contributes"]["grammars"][0]["path"] =
            json!(fixture.data.path().join("outside.json"));
    });
    assert!(fixture.read(None).is_err());
}

#[cfg(unix)]
#[test]
fn grammar_symlink_cannot_read_outside_package_root() {
    let fixture = Fixture::new();
    let outside = fixture.data.path().join("outside.json");
    fs::write(
        &outside,
        serde_json::to_vec(&json!({"scopeName": SCOPE, "patterns": []})).unwrap(),
    )
    .unwrap();
    let grammar = fixture.package.join("syntaxes/test.json");
    fs::remove_file(&grammar).unwrap();
    std::os::unix::fs::symlink(outside, grammar).unwrap();
    assert!(fixture.read(None).is_err());
}

#[test]
fn grammar_resource_size_limit_is_enforced() {
    let fixture = Fixture::new();
    fs::write(
        fixture.package.join("syntaxes/test.json"),
        vec![b' '; 4 * 1024 * 1024 + 1],
    )
    .unwrap();
    assert_eq!(fixture.read(None).unwrap_err().code, "RESOURCE_LIMIT");
}

#[test]
fn shipped_language_plugins_have_readable_declared_grammars() {
    let fixture = Fixture::new();
    let registry = fixture.registry();
    let languages: Vec<_> = registry["records"]
        .as_object()
        .unwrap()
        .iter()
        .filter(|(id, _)| id.starts_with("horizon.language."))
        .collect();
    assert!(!languages.is_empty());
    for (id, record) in languages {
        for declaration in record["manifest"]["contributes"]["grammars"]
            .as_array()
            .unwrap()
        {
            let scope = declaration["scopeName"].as_str().unwrap();
            let grammar =
                extensions::read_grammar(&fixture.state, id, scope, Some("project-a")).unwrap();
            assert_eq!(grammar["scopeName"], scope, "{id}");
        }
    }
}

#[test]
fn existing_registry_gains_new_shipped_languages_and_keeps_uninstalled_records() {
    let fixture = Fixture::new();
    let registry = fixture.registry();
    let ids: Vec<_> = registry["records"]
        .as_object()
        .unwrap()
        .keys()
        .filter(|id| id.starts_with("horizon.language."))
        .cloned()
        .collect();
    assert!(ids.len() >= 2);
    fixture.edit(|registry| {
        registry["records"].as_object_mut().unwrap().remove(&ids[0]);
        registry["records"][&ids[1]]["installed"] = json!(false);
    });
    extensions::initialize(&fixture.state).unwrap();
    let updated = fixture.registry();
    assert_eq!(updated["records"][&ids[0]]["installed"], true);
    assert_eq!(updated["records"][&ids[1]]["installed"], false);
}
