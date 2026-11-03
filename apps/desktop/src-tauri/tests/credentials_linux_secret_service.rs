//! Real Secret Service, only in the disposable D-Bus/home created by the CI wrapper.
#![cfg(target_os = "linux")]
use horizon_host::{settings, state, Call, HostState};
use serde_json::{json, Value};
use std::{fs, path::PathBuf, sync::Arc};

fn call(host: &Arc<HostState>, method: &str, params: Value) -> Value {
    settings::dispatch(host.clone(), Call { protocol_version: 1, request_id: state::id(),
        method: method.into(), scope: json!({"kind":"app"}), params,
        idempotency_key: Some(state::id()) }).unwrap()
}
fn set(host: &Arc<HostState>, connection: &str, secret: &str, persistence: &str) -> Value {
    call(host, "credential_set", json!({"connectionId":connection,"secret":secret,"persistence":persistence}))
}

#[test]
#[ignore = "Requires disposable D-Bus and gnome-keyring; run scripts/test-linux-secret-service.sh only"]
fn real_linux_secret_service_roundtrip() {
    let root = PathBuf::from(std::env::var("HORIZON_SECRET_SERVICE_FIXTURE").expect("isolated fixture required"));
    assert_eq!(fs::read_to_string(root.join("fixture-marker")).unwrap(), "horizon-synthetic-keyring-only\n");
    assert_eq!(PathBuf::from(std::env::var("HOME").unwrap()), root.join("home"));
    assert_eq!(PathBuf::from(std::env::var("XDG_DATA_HOME").unwrap()), root.join("data"));
    assert!(std::env::var("DBUS_SESSION_BUS_ADDRESS").unwrap().starts_with("unix:"));
    // This separate integration-test executable never installs the failure/mock builder.
    let data = tempfile::tempdir_in(&root).unwrap();
    let host = Arc::new(HostState::new(data.path().into()).unwrap());
    let connection = format!("linux-synthetic-{}", state::id());
    let other = format!("linux-synthetic-other-{}", state::id());
    let reference = state::digest(format!("horizon-credential:{connection}"));
    let other_ref = state::digest(format!("horizon-credential:{other}"));
    struct Cleanup(Vec<String>);
    impl Drop for Cleanup { fn drop(&mut self) { for reference in &self.0 {
        if let Ok(entry) = keyring::Entry::new("dev.horizon.desktop", reference) { let _ = entry.delete_credential(); }
    } } }
    let _cleanup = Cleanup(vec![reference.clone(), other_ref.clone()]);
    let entry = keyring::Entry::new("dev.horizon.desktop", &reference).unwrap();
    assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    set(&host, &connection, "synthetic-linux-system-A", "system");
    set(&host, &other, "synthetic-linux-unrelated", "system");
    assert_eq!(entry.get_password().unwrap(), "synthetic-linux-system-A");
    let restarted = Arc::new(HostState::new(data.path().into()).unwrap());
    assert_eq!(restarted.credential_secret(&reference).unwrap(), "synthetic-linux-system-A");
    set(&restarted, &connection, "synthetic-linux-system-updated", "system");
    assert_eq!(entry.get_password().unwrap(), "synthetic-linux-system-updated");
    set(&restarted, &connection, "synthetic-linux-session-B", "session");
    assert_eq!(restarted.credential_secret(&reference).unwrap(), "synthetic-linux-session-B");
    assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    assert_eq!(restarted.credential_secret(&other_ref).unwrap(), "synthetic-linux-unrelated");
    let fresh = Arc::new(HostState::new(data.path().into()).unwrap());
    assert_eq!(fresh.credential_secret(&reference).unwrap_err().code, "CREDENTIAL_UNAVAILABLE");
    // Legacy stray system data must not resurrect a session-only credential.
    entry.set_password("synthetic-linux-legacy").unwrap();
    assert_eq!(fresh.credential_secret(&reference).unwrap_err().code, "CREDENTIAL_UNAVAILABLE");
    call(&fresh, "credential_remove", json!({"credentialRef":reference}));
    assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    assert_eq!(fresh.credential_secret(&other_ref).unwrap(), "synthetic-linux-unrelated");
    let index = fs::read_to_string(data.path().join("credential-index.json")).unwrap();
    for secret in ["synthetic-linux-system-A", "synthetic-linux-system-updated", "synthetic-linux-session-B", "synthetic-linux-legacy", "synthetic-linux-unrelated"] {
        assert!(!index.contains(secret), "credential index leaked synthetic secret");
    }
    call(&fresh, "credential_remove", json!({"credentialRef":other_ref}));
    assert!(matches!(keyring::Entry::new("dev.horizon.desktop", &other_ref).unwrap().get_password(), Err(keyring::Error::NoEntry)));
    assert!(call(&fresh, "credential_list", json!({}))["items"].as_array().unwrap().is_empty());
}
