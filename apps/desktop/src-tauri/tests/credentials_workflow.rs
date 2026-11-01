use horizon_host::{settings,state,Call,HostState};
use serde_json::{json,Value};
use std::{fs,sync::Arc};

fn call(state:&Arc<HostState>,method:&str,params:Value)->Result<Value,horizon_host::HostError>{settings::dispatch(state.clone(),Call{protocol_version:1,request_id:state::id(),method:method.into(),scope:json!({"kind":"app"}),params,idempotency_key:Some(state::id())})}
fn set(state:&Arc<HostState>,connection:&str,secret:&str,persistence:&str)->Result<Value,horizon_host::HostError>{call(state,"credential_set",json!({"connectionId":connection,"secret":secret,"persistence":persistence}))}

struct UnavailableKeyring;
impl keyring::credential::CredentialBuilderApi for UnavailableKeyring{
    fn build(&self,_target:Option<&str>,_service:&str,_user:&str)->keyring::Result<Box<keyring::credential::Credential>>{Err(keyring::Error::Invalid("test".into(),"storage unavailable".into()))}
    fn as_any(&self)->&dyn std::any::Any{self}
}

#[test]fn unavailable_keyring_preserves_session_and_previous_system_configuration(){
    keyring::set_default_credential_builder(Box::new(UnavailableKeyring));
    let data=tempfile::tempdir().unwrap();let host=Arc::new(HostState::new(data.path().into()).unwrap());let connection=state::id();let saved=set(&host,&connection,"fixture-session-secret","session").unwrap();let reference=saved["credentialRef"].as_str().unwrap();let path=data.path().join("credential-index.json");let original=fs::read(&path).unwrap();assert_eq!(host.credential_secret(reference).unwrap(),"fixture-session-secret");assert!(!String::from_utf8(original.clone()).unwrap().contains("fixture-session-secret"));
    assert_eq!(set(&host,&connection,"fixture-system-secret","system").unwrap_err().code,"CREDENTIAL_UNAVAILABLE");assert_eq!(fs::read(&path).unwrap(),original);assert_eq!(host.credential_secret(reference).unwrap(),"fixture-session-secret");
    assert_eq!(call(&host,"credential_remove",json!({"credentialRef":reference})).unwrap_err().code,"CREDENTIAL_UNAVAILABLE");assert_eq!(fs::read(&path).unwrap(),original);assert_eq!(host.credential_secret(reference).unwrap(),"fixture-session-secret");
    let restarted=HostState::new(data.path().into()).unwrap();assert_eq!(restarted.credential_secret(reference).unwrap_err().code,"CREDENTIAL_UNAVAILABLE");assert_eq!(call(&host,"credential_remove",json!({"credentialRef":"unregistered-ref"})).unwrap()["removed"],false);
    let mut system:Value=serde_json::from_slice(&original).unwrap();system["items"][0]["persistence"]=json!("system");state::atomic_json(&path,&system).unwrap();let before=fs::read(&path).unwrap();assert_eq!(set(&host,&connection,"replacement-session-secret","session").unwrap_err().code,"CREDENTIAL_UNAVAILABLE");assert_eq!(fs::read(&path).unwrap(),before);assert_eq!(host.credentials.lock().unwrap()[reference],"fixture-session-secret");
}

#[cfg(target_os="macos")]
#[test]
#[ignore="Writes and removes only two isolated fake macOS Keychain entries; run explicitly"]
fn real_macos_keyring_system_to_session_expires_without_fallback_and_removes_only_its_ref(){
    #[link(name="Security",kind="framework")]
    extern "C"{fn SecKeychainSetUserInteractionAllowed(allowed:u8)->i32;}
    struct NoInteraction;
    impl Drop for NoInteraction{fn drop(&mut self){unsafe{SecKeychainSetUserInteractionAllowed(1);}}}
    assert_eq!(unsafe{SecKeychainSetUserInteractionAllowed(0)},0,"disable keychain prompts before testing");let _no_interaction=NoInteraction;
    struct Cleanup(Vec<String>);
    impl Drop for Cleanup{fn drop(&mut self){for reference in &self.0{if let Ok(entry)=keyring::Entry::new("dev.horizon.desktop",reference){let _=entry.delete_credential();}}}}
    let connection=format!("horizon-fake-keyring-test-{}",state::id());let other_connection=format!("horizon-fake-keyring-other-{}",state::id());let reference=state::digest(format!("horizon-credential:{connection}"));let other_reference=state::digest(format!("horizon-credential:{other_connection}"));let _cleanup=Cleanup(vec![reference.clone(),other_reference.clone()]);
    let data=tempfile::tempdir().unwrap();let host=Arc::new(HostState::new(data.path().into()).unwrap());set(&host,&connection,"horizon-fake-system-A","system").expect("dedicated fake system credential save without UI");set(&host,&other_connection,"horizon-fake-other","system").unwrap();assert_eq!(host.credential_secret(&reference).unwrap(),"horizon-fake-system-A");let restarted=HostState::new(data.path().into()).unwrap();assert_eq!(restarted.credential_secret(&reference).unwrap(),"horizon-fake-system-A");
    set(&host,&connection,"horizon-fake-session-B","session").unwrap();assert_eq!(host.credential_secret(&reference).unwrap(),"horizon-fake-session-B");assert!(matches!(keyring::Entry::new("dev.horizon.desktop",&reference).unwrap().get_password(),Err(keyring::Error::NoEntry)));assert_eq!(host.credential_secret(&other_reference).unwrap(),"horizon-fake-other");
    // A read-only app-data directory must fail before creating a system key or
    // discarding the currently active in-memory session credential.
    use std::os::unix::fs::PermissionsExt;
    let permissions=fs::metadata(data.path()).unwrap().permissions();fs::set_permissions(data.path(),fs::Permissions::from_mode(0o500)).unwrap();let failed=set(&host,&connection,"horizon-fake-rejected-system","system");fs::set_permissions(data.path(),permissions).unwrap();assert!(failed.is_err());assert_eq!(host.credential_secret(&reference).unwrap(),"horizon-fake-session-B");assert!(matches!(keyring::Entry::new("dev.horizon.desktop",&reference).unwrap().get_password(),Err(keyring::Error::NoEntry)));
    let restarted=Arc::new(HostState::new(data.path().into()).unwrap());assert_eq!(restarted.credential_secret(&reference).unwrap_err().code,"CREDENTIAL_UNAVAILABLE");let listed=call(&restarted,"credential_list",json!({})).unwrap();assert_eq!(listed["items"].as_array().unwrap().iter().find(|item|item["credentialRef"]==reference).unwrap()["configured"],false);
    // A leftover key from versions before the persistence guard is ignored too.
    keyring::Entry::new("dev.horizon.desktop",&reference).unwrap().set_password("horizon-fake-legacy-A").unwrap();assert_eq!(restarted.credential_secret(&reference).unwrap_err().code,"CREDENTIAL_UNAVAILABLE");call(&restarted,"credential_remove",json!({"credentialRef":reference})).unwrap();assert!(matches!(keyring::Entry::new("dev.horizon.desktop",&reference).unwrap().get_password(),Err(keyring::Error::NoEntry)));assert_eq!(restarted.credential_secret(&other_reference).unwrap(),"horizon-fake-other");
    let index=fs::read_to_string(data.path().join("credential-index.json")).unwrap();for secret in ["horizon-fake-system-A","horizon-fake-session-B","horizon-fake-legacy-A","horizon-fake-other"]{assert!(!index.contains(secret));}call(&restarted,"credential_remove",json!({"credentialRef":other_reference})).unwrap();assert!(matches!(keyring::Entry::new("dev.horizon.desktop",&other_reference).unwrap().get_password(),Err(keyring::Error::NoEntry)));
}
