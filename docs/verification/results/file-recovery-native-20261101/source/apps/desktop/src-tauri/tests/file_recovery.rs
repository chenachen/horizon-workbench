use horizon_host::{files,state,Call,HostError,HostState};
use serde_json::{json,Value};
use std::{fs,path::{Path,PathBuf},sync::Arc,time::{Duration,Instant}};

struct Fixture {
    data:tempfile::TempDir,
    _project_dir:tempfile::TempDir,
    root:PathBuf,
    state:Arc<HostState>,
    project:String,
}

impl Fixture {
    fn new()->Self {
        let data=tempfile::tempdir().unwrap();let project_dir=tempfile::tempdir().unwrap();
        let state=Arc::new(HostState::new(data.path().into()).unwrap());
        let registered=state.register_project(project_dir.path().into(),None,None).unwrap();
        let project=registered["project"]["id"].as_str().unwrap().to_owned();
        let root=state.project_root(&project).unwrap();
        Self{data,_project_dir:project_dir,root,state,project}
    }
    fn call(&self,method:&str,params:Value)->Call {
        Call{protocol_version:1,request_id:state::id(),method:method.into(),scope:json!({"kind":"project","projectId":self.project,"projectEpoch":1}),params,idempotency_key:Some(state::id())}
    }
    fn command(&self,method:&str,params:Value)->Result<Value,HostError> { files::dispatch(self.state.clone(),self.call(method,params)) }
    fn file(&self,name:&str,bytes:impl AsRef<[u8]>)->Value {
        let path=self.root.join(name);fs::create_dir_all(path.parent().unwrap()).unwrap();fs::write(&path,bytes).unwrap();
        self.state.file_ref(&self.project,&path).unwrap()
    }
    fn open(&self,file:&Value)->Value { self.command("document_open",json!({"fileId":file["fileId"],"mode":"auto"})).unwrap() }
    fn draft(&self,meta:&Value,text:&str,revision:u64)->Value {
        self.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":revision,"baseDiskRevision":meta["baseDiskRevision"],"text":text,"selection":{"anchor":3,"head":7}})).unwrap();
        self.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap()
    }
    fn prepare(&self,file:&Value,meta:Option<&Value>,target:&Path)->Result<Value,HostError> {
        let mut params=json!({"fileId":file["fileId"]});
        if let Some(meta)=meta {params["documentId"]=meta["documentId"].clone();params["expectedEditorRevision"]=meta["editorRevision"].clone();}
        files::prepare_relocation_selection(&self.state,&self.call("document_relocate_prepare",params),target).map(|value|value["plan"].clone())
    }
    fn apply(&self,plan:&Value,choice:&str)->Result<Value,HostError> { self.command("document_relocate_apply",json!({"planId":plan["planId"],"digest":plan["digest"],"choice":choice})) }
    fn recovery(&self,meta:&Value)->Value { self.command("recovery_read",json!({"checkpointId":meta["documentId"]})).unwrap() }
}

#[cfg(unix)]
#[test]
fn broken_link_open_retains_registered_identity_without_leaking_cross_project_file_refs() {
    let f=Fixture::new();let path=f.root.join("broken.txt");
    std::os::unix::fs::symlink("missing-target.txt",&path).unwrap();let file=f.state.file_ref(&f.project,&path).unwrap();
    let error=f.command("document_open",json!({"fileId":file["fileId"],"mode":"auto"})).unwrap_err();
    assert_eq!(error.code,"NOT_FOUND");assert_eq!(error.details.unwrap()["file"],file);
    assert!(f.state.documents.lock().unwrap().is_empty());
    let other=tempfile::tempdir().unwrap();let registered=f.state.register_project(other.path().into(),None,None).unwrap();
    let mut call=f.call("document_open",json!({"fileId":file["fileId"],"mode":"auto"}));call.scope["projectId"]=registered["project"]["id"].clone();
    let denied=files::dispatch(f.state.clone(),call).unwrap_err();assert_eq!(denied.code,"PERMISSION_DENIED");assert!(denied.details.is_none());
    let unknown=f.command("document_open",json!({"fileId":"not-registered","mode":"auto"})).unwrap_err();assert_eq!(unknown.code,"NOT_FOUND");assert!(unknown.details.is_none());
    fs::write(f.root.join("missing-target.txt"),"available again").unwrap();assert_eq!(f.open(&file)["text"],"available again");
}

#[test]
fn deleted_source_keeps_draft_copy_and_close_available_without_recreating_source() {
    let f=Fixture::new();let file=f.file("source.txt","original");let opened=f.open(&file);let meta=&opened["meta"];
    fs::remove_file(f.root.join("source.txt")).unwrap();
    f.command("document_mark_dirty",json!({"documentId":meta["documentId"],"editorRevision":1,"dirty":true})).unwrap();
    let dirty=f.draft(meta,"unwritten draft",2);assert_eq!(f.recovery(meta)["text"],"unwritten draft");
    let destination=tempfile::tempdir().unwrap();let token=f.state.register_selection(destination.path().into());
    f.command("document_save_as",json!({"documentId":meta["documentId"],"editorRevision":2,"text":"unwritten draft","encoding":"utf8","eol":"lf","destinationSelectionToken":token,"name":"copy.txt","expectedDestinationRevision":null})).unwrap();
    assert_eq!(fs::read_to_string(destination.path().join("copy.txt")).unwrap(),"unwritten draft");
    assert_eq!(f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap(),dirty);
    assert_eq!(f.command("document_save",json!({"documentId":meta["documentId"],"editorRevision":2,"text":"unwritten draft","encoding":"utf8","eol":"lf","expectedDiskRevision":meta["baseDiskRevision"]})).unwrap_err().code,"FILE_CHANGED");
    assert!(!f.root.join("source.txt").exists());
    f.command("document_close",json!({"documentId":meta["documentId"],"expectedEditorRevision":2,"decision":"discard"})).unwrap();
    assert!(f.state.documents.lock().unwrap().is_empty());assert_eq!(f.command("recovery_list",json!({"projectId":f.project})).unwrap()["items"],json!([]));
}

#[cfg(unix)]
#[test]
fn permission_failure_preserves_file_identity_and_metadata_only_draft_operations() {
    use std::os::unix::fs::PermissionsExt;
    let f=Fixture::new();let file=f.file("blocked/source.txt","original");let opened=f.open(&file);let meta=&opened["meta"];
    let directory=f.root.join("blocked");let permissions=fs::metadata(&directory).unwrap().permissions();fs::set_permissions(&directory,fs::Permissions::from_mode(0)).unwrap();
    let failed=f.command("document_open",json!({"fileId":file["fileId"],"mode":"auto"}));
    let marked=f.command("document_mark_dirty",json!({"documentId":meta["documentId"],"editorRevision":1,"dirty":true}));
    let saved=f.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":1,"baseDiskRevision":meta["baseDiskRevision"],"text":"retained","selection":null}));
    fs::set_permissions(&directory,permissions).unwrap();
    let error=failed.unwrap_err();assert_eq!(error.code,"PERMISSION_DENIED");assert_eq!(error.details.unwrap()["file"],file);marked.unwrap();saved.unwrap();
    assert_eq!(f.recovery(meta)["text"],"retained");assert_eq!(fs::read_to_string(directory.join("source.txt")).unwrap(),"original");
}

#[test]
fn actual_delete_watch_events_invalidate_documents_without_changing_clean_or_dirty_state() {
    let f=Fixture::new();let clean=f.file("clean.txt","clean");let dirty=f.file("dirty.txt","base");
    let clean_open=f.open(&clean);let dirty_open=f.open(&dirty);f.draft(&dirty_open["meta"],"local draft",1);
    let clean_id=clean_open["meta"]["documentId"].as_str().unwrap();let dirty_id=dirty_open["meta"]["documentId"].as_str().unwrap();
    let keys=[format!("horizon.document.v1:{clean_id}"),format!("horizon.document.v1:{dirty_id}")];
    let before:Vec<u64>={let revisions=f.state.entity_revisions.lock().unwrap();keys.iter().map(|key|*revisions.get(key).unwrap_or(&0)).collect()};
    fs::remove_file(f.root.join("clean.txt")).unwrap();fs::remove_file(f.root.join("dirty.txt")).unwrap();
    let deadline=Instant::now()+Duration::from_secs(5);
    loop {
        let observed={let revisions=f.state.entity_revisions.lock().unwrap();keys.iter().zip(&before).all(|(key,before)|revisions.get(key).is_some_and(|revision|revision>before))};
        if observed {break;}assert!(Instant::now()<deadline,"native watcher did not deliver both deletion invalidations");std::thread::sleep(Duration::from_millis(20));
    }
    assert_eq!(f.state.document_meta(clean_id).unwrap()["state"],"clean");assert_eq!(f.state.document_meta(dirty_id).unwrap()["state"],"dirty");assert_eq!(f.recovery(&dirty_open["meta"])["text"],"local draft");
}

#[test]
fn relocation_of_unopened_missing_file_grants_only_selected_external_file_after_confirmation() {
    let f=Fixture::new();let file=f.file("missing.txt","old");fs::remove_file(f.root.join("missing.txt")).unwrap();
    let outside=tempfile::tempdir().unwrap();let target=outside.path().join("selected.txt");let sibling=outside.path().join("sibling.txt");fs::write(&target,"selected contents").unwrap();fs::write(&sibling,"sibling contents").unwrap();
    let revision=files::disk_revision(&target).unwrap();let plan=f.prepare(&file,None,&target).unwrap();
    assert_eq!(plan["hasBuffer"],false);assert_eq!(plan["dirty"],false);assert_eq!(plan["candidate"]["canKeepBuffer"],false);assert!(f.state.registry.lock().unwrap().external_file_grants.is_empty());
    assert_eq!(f.apply(&plan,"keepBuffer").unwrap_err().code,"RESOURCE_BUSY");assert!(f.state.registry.lock().unwrap().external_file_grants.is_empty());
    let applied=f.apply(&plan,"useSelected").unwrap();assert_eq!(applied["previousFileId"],file["fileId"]);assert_eq!(applied["opened"]["text"],"selected contents");assert_eq!(files::disk_revision(&target).unwrap(),revision);
    let registry=f.state.registry.lock().unwrap();assert_eq!(registry.external_file_grants.len(),1);assert!(registry.external_file_grants.contains(applied["file"]["fileId"].as_str().unwrap()));drop(registry);
    assert_eq!(f.state.file_ref(&f.project,&sibling).unwrap_err().code,"PERMISSION_DENIED");assert_eq!(fs::read_to_string(&sibling).unwrap(),"sibling contents");
}

#[test]
fn relocation_keep_buffer_preserves_full_checkpoint_identity_and_encoding_until_explicit_save() {
    let f=Fixture::new();let file=f.file("source.txt",b"\xef\xbb\xbforiginal\r\n");let opened=f.open(&file);
    let body="保留草稿\n".repeat(40_000);let meta=f.draft(&opened["meta"],&body,2);fs::remove_file(f.root.join("source.txt")).unwrap();
    let outside=tempfile::tempdir().unwrap();let target=outside.path().join("selected.txt");let selected="selected line\n".repeat(24_000);fs::write(&target,&selected).unwrap();let before=files::disk_revision(&target).unwrap();
    let plan=f.prepare(&file,Some(&meta),&target).unwrap();assert_eq!(plan["candidate"]["canKeepBuffer"],true);assert_eq!(plan["candidate"]["previewTruncated"],true);assert!(plan["candidate"]["text"].as_str().unwrap().len()<=256*1024);
    let applied=f.apply(&plan,"keepBuffer").unwrap();let next=&applied["opened"]["meta"];
    for field in ["documentId","editorRevision","encoding","eol","state"] {assert_eq!(next[field],meta[field],"{field}");}
    assert_eq!(applied["opened"]["text"],body);assert_eq!(next["baseDiskRevision"],before);assert_eq!(fs::read_to_string(&target).unwrap(),selected);assert!(!f.root.join("source.txt").exists());
    let recovery=f.recovery(next);assert_eq!(recovery["file"],applied["file"]);assert_eq!(recovery["fileId"],applied["file"]["fileId"]);assert_eq!(recovery["baseDiskRevision"],before);assert_eq!(recovery["selection"],json!({"anchor":3,"head":7}));assert_eq!(recovery["text"],body);
    let restarted=Arc::new(HostState::new(f.data.path().into()).unwrap());let recovered=files::dispatch(restarted.clone(),f.call("recovery_read",json!({"checkpointId":meta["documentId"]}))).unwrap();assert_eq!(recovered,recovery);assert_eq!(restarted.registered_file_ref(&f.project,applied["file"]["fileId"].as_str().unwrap()).unwrap(),applied["file"]);
    f.command("document_save",json!({"documentId":next["documentId"],"editorRevision":2,"expectedDiskRevision":next["baseDiskRevision"],"text":body,"encoding":next["encoding"],"eol":next["eol"]})).unwrap();
    assert_eq!(fs::read(&target).unwrap(),files::encode(&body,"utf8bom","crlf").unwrap());assert!(!f.root.join("source.txt").exists());
}

#[test]
fn relocation_use_selected_discards_checkpoint_only_after_loading_confirmed_target() {
    let f=Fixture::new();let file=f.file("source.txt","source");let opened=f.open(&file);let meta=f.draft(&opened["meta"],"discarded by explicit choice",1);
    let target=f.root.join("target.txt");fs::write(&target,"chosen contents\n").unwrap();let before=files::disk_revision(&target).unwrap();
    let plan=f.prepare(&file,Some(&meta),&target).unwrap();assert_eq!(f.recovery(&meta)["text"],"discarded by explicit choice");
    let applied=f.apply(&plan,"useSelected").unwrap();assert_eq!(applied["opened"]["text"],"chosen contents\n");assert_eq!(applied["opened"]["meta"]["documentId"],meta["documentId"]);assert_eq!(applied["opened"]["meta"]["state"],"clean");
    assert_eq!(f.command("recovery_read",json!({"checkpointId":meta["documentId"]})).unwrap_err().code,"NOT_FOUND");assert_eq!(files::disk_revision(&target).unwrap(),before);assert_eq!(fs::read_to_string(f.root.join("source.txt")).unwrap(),"source");
}

#[test]
fn relocation_rejects_candidate_or_source_changes_and_keeps_original_checkpoint() {
    let f=Fixture::new();let file=f.file("source.txt","source");let opened=f.open(&file);let meta=f.draft(&opened["meta"],"keep local",1);
    let target=f.root.join("target.txt");fs::write(&target,"chosen").unwrap();let plan=f.prepare(&file,Some(&meta),&target).unwrap();fs::write(&target,"changed after compare").unwrap();
    assert_eq!(f.apply(&plan,"useSelected").unwrap_err().code,"FILE_CHANGED");assert_eq!(f.recovery(&meta)["text"],"keep local");assert_eq!(f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap()["file"],file);
    let current=f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap();let plan=f.prepare(&file,Some(&current),&target).unwrap();let newer=f.draft(&current,"newer local",2);
    assert_eq!(f.apply(&plan,"keepBuffer").unwrap_err().code,"STALE_VERSION");assert_eq!(f.recovery(&newer)["text"],"newer local");assert_eq!(f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap()["file"],file);assert_eq!(fs::read_to_string(&target).unwrap(),"changed after compare");
}

#[test]
fn relocation_rejects_another_open_document_and_keep_buffer_for_noneditable_candidates() {
    let f=Fixture::new();let file=f.file("source.txt","source");let opened=f.open(&file);let meta=f.draft(&opened["meta"],"keep local",1);
    let other=f.file("other.txt","other buffer");let other_open=f.open(&other);
    let error=f.prepare(&file,Some(&meta),&f.root.join("other.txt")).unwrap_err();assert_eq!(error.code,"RESOURCE_BUSY");assert_eq!(error.details.unwrap()["file"],other);assert_eq!(f.state.document_meta(other_open["meta"]["documentId"].as_str().unwrap()).unwrap(),other_open["meta"]);
    let cases=[("mixed.txt",b"a\r\nb\n".to_vec()),("utf16.txt",files::encode("unicode\n","utf16le","lf").unwrap()),("binary.bin",b"binary\0data".to_vec()),("long.txt",vec![b'a';100_000])];
    for (name,bytes) in cases {
        let path=f.root.join(name);fs::write(&path,&bytes).unwrap();let plan=f.prepare(&file,Some(&meta),&path).unwrap();assert_eq!(plan["candidate"]["canKeepBuffer"],false,"{name}");
        assert_eq!(f.apply(&plan,"keepBuffer").unwrap_err().code,"RESOURCE_BUSY","{name}");if plan["candidate"]["mode"]!="editor"{assert_eq!(f.apply(&plan,"useSelected").unwrap_err().code,"RESOURCE_LIMIT","{name}");}assert_eq!(fs::read(&path).unwrap(),bytes);assert_eq!(f.recovery(&meta)["text"],"keep local");
    }
}

#[cfg(unix)]
#[test]
fn relocation_use_selected_loads_full_readonly_text_after_explicit_discard_without_disk_writes() {
    use std::os::unix::fs::PermissionsExt;
    let f=Fixture::new();let file=f.file("source.txt","source unchanged");let opened=f.open(&file);let meta=f.draft(&opened["meta"],"local edits",1);
    let target=f.root.join("readonly.txt");fs::write(&target,"readonly selected text\n").unwrap();fs::set_permissions(&target,fs::Permissions::from_mode(0o444)).unwrap();
    let source_before=files::disk_revision(&f.root.join("source.txt")).unwrap();let target_before=files::disk_revision(&target).unwrap();
    let plan=f.prepare(&file,Some(&meta),&target).unwrap();assert_eq!(plan["dirty"],true);assert_eq!(plan["candidate"]["readOnly"],true);assert_eq!(plan["candidate"]["canKeepBuffer"],false);assert_eq!(plan["candidate"]["text"],"readonly selected text\n");
    assert_eq!(f.apply(&plan,"keepBuffer").unwrap_err().code,"RESOURCE_BUSY");assert_eq!(f.recovery(&meta)["text"],"local edits");assert_eq!(f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap()["file"],file);
    let applied=f.apply(&plan,"useSelected").unwrap();assert_eq!(applied["opened"]["text"],"readonly selected text\n");assert_eq!(applied["opened"]["meta"]["state"],"clean");assert_eq!(applied["opened"]["meta"]["readOnly"],true);assert_eq!(applied["opened"]["meta"]["documentId"],meta["documentId"]);
    assert_eq!(f.command("recovery_read",json!({"checkpointId":meta["documentId"]})).unwrap_err().code,"NOT_FOUND");assert_eq!(files::disk_revision(&f.root.join("source.txt")).unwrap(),source_before);assert_eq!(files::disk_revision(&target).unwrap(),target_before);assert_eq!(fs::metadata(&target).unwrap().permissions().mode()&0o777,0o444);
}

#[test]
fn relocation_rechecks_project_epoch_and_confirmation_digest_before_association() {
    let f=Fixture::new();let file=f.file("source.txt","source");let target=f.root.join("target.txt");fs::write(&target,"target").unwrap();let plan=f.prepare(&file,None,&target).unwrap();
    let mut call=f.call("document_relocate_apply",json!({"planId":plan["planId"],"digest":"wrong","choice":"useSelected"}));assert_eq!(files::dispatch(f.state.clone(),call.clone()).unwrap_err().code,"STALE_VERSION");
    call.params["digest"]=plan["digest"].clone();call.scope["projectEpoch"]=json!(2);assert_eq!(files::dispatch(f.state.clone(),call.clone()).unwrap_err().code,"STALE_VERSION");
    call.scope["projectId"]=json!("other-project");assert_eq!(files::dispatch(f.state.clone(),call).unwrap_err().code,"PERMISSION_DENIED");assert!(f.state.documents.lock().unwrap().is_empty());assert_eq!(fs::read_to_string(&target).unwrap(),"target");
}
