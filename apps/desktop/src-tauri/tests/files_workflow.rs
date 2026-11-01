use horizon_host::{files,projects,settings,state,Call,HostState};
use serde_json::{json,Value};
use std::{fs,sync::Arc};

struct Fixture{_data:tempfile::TempDir,project_dir:tempfile::TempDir,state:Arc<HostState>,project:String}
impl Fixture{
    fn new()->Self{let data=tempfile::tempdir().unwrap();let project_dir=tempfile::tempdir().unwrap();let state=Arc::new(HostState::new(data.path().into()).unwrap());let result=state.register_project(project_dir.path().into(),None,None).unwrap();let project=result["project"]["id"].as_str().unwrap().into();Self{_data:data,project_dir,state,project}}
    fn call(&self,method:&str,params:Value)->Call{Call{protocol_version:1,request_id:state::id(),method:method.into(),scope:json!({"kind":"project","projectId":self.project,"projectEpoch":1}),params,idempotency_key:Some(state::id())}}
    fn file(&self,name:&str,bytes:impl AsRef<[u8]>)->Value{let path=self.project_dir.path().join(name);if let Some(parent)=path.parent(){fs::create_dir_all(parent).unwrap();}fs::write(&path,bytes).unwrap();self.state.file_ref(&self.project,&path).unwrap()}
    fn open(&self,file:&Value)->Value{files::dispatch(self.state.clone(),self.call("document_open",json!({"fileId":file["fileId"],"mode":"auto"}))).unwrap()}
    fn command(&self,method:&str,params:Value)->Result<Value,horizon_host::HostError>{files::dispatch(self.state.clone(),self.call(method,params))}
}

#[test]fn save_is_conditional_and_preserves_bom_eol(){
    let f=Fixture::new();let file=f.file("hello.txt",b"\xef\xbb\xbfhello\r\n");let opened=f.open(&file);let meta=&opened["meta"];
    let saved=f.command("document_save",json!({"documentId":meta["documentId"],"editorRevision":1,"expectedDiskRevision":meta["baseDiskRevision"],"text":"你好\n","encoding":"utf8bom","eol":"crlf"})).unwrap();
    assert_eq!(fs::read(f.project_dir.path().join("hello.txt")).unwrap(),"\u{feff}你好\r\n".as_bytes());
    fs::write(f.project_dir.path().join("hello.txt"),"external").unwrap();
    let err=f.command("document_save",json!({"documentId":meta["documentId"],"editorRevision":2,"expectedDiskRevision":saved["diskRevision"],"text":"do not overwrite","encoding":"utf8bom","eol":"crlf"})).unwrap_err();
    assert_eq!(err.code,"FILE_CHANGED");assert_eq!(fs::read_to_string(f.project_dir.path().join("hello.txt")).unwrap(),"external");
}

#[test]fn saving_older_snapshot_keeps_newer_checkpoint_dirty(){
    let f=Fixture::new();let file=f.file("draft.txt","base\n");let opened=f.open(&file);let meta=&opened["meta"];
    let checkpoint=f.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":2,"baseDiskRevision":meta["baseDiskRevision"],"text":"newer\n","selection":{"anchor":6,"head":6}})).unwrap();
    let saved=f.command("document_save",json!({"documentId":meta["documentId"],"editorRevision":1,"expectedDiskRevision":meta["baseDiskRevision"],"text":"captured\n","encoding":"utf8","eol":"lf"})).unwrap();
    assert_eq!(saved["savedEditorRevision"],1);let current=f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap();assert_eq!(current["state"],"dirty");assert_eq!(current["editorRevision"],2);
    let recovered=f.command("recovery_read",json!({"checkpointId":checkpoint["checkpointId"]})).unwrap();assert_eq!(recovered["text"],"newer\n");
}

#[test]fn save_as_exports_copy_without_replacing_original_document(){
    let f=Fixture::new();let file=f.file("source.txt","base");let opened=f.open(&file);let meta=&opened["meta"];
    f.command("document_mark_dirty",json!({"documentId":meta["documentId"],"editorRevision":1,"dirty":true})).unwrap();
    let destination=tempfile::tempdir().unwrap();let token=f.state.register_selection(destination.path().into());
    let exported=f.command("document_save_as",json!({"documentId":meta["documentId"],"editorRevision":1,"text":"copy","encoding":"utf8","eol":"lf","destinationSelectionToken":token,"name":"copy.txt","expectedDestinationRevision":null})).unwrap();
    assert_eq!(fs::read_to_string(destination.path().join("copy.txt")).unwrap(),"copy");assert_eq!(fs::read_to_string(f.project_dir.path().join("source.txt")).unwrap(),"base");
    let current=f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap();assert_eq!(current["state"],"dirty");assert_eq!(current["baseDiskRevision"],meta["baseDiskRevision"]);assert_eq!(current["file"],file);
    assert!(f.state.resolve_file(&f.project,exported["file"]["fileId"].as_str().unwrap()).unwrap().ends_with("copy.txt"));
}

#[test]fn rename_preserves_opaque_ids_and_unrelated_dirty_baseline(){
    let f=Fixture::new();let other=f.file("other.txt","old");let opened=f.open(&other);let meta=&opened["meta"];
    f.command("document_mark_dirty",json!({"documentId":meta["documentId"],"editorRevision":1,"dirty":true})).unwrap();fs::write(f.project_dir.path().join("other.txt"),"outside").unwrap();
    let nested=f.file("folder/a.txt","a");let nested_open=f.open(&nested);let parent=f.state.file_ref(&f.project,&f.project_dir.path().join("folder")).unwrap();let rev=files::disk_revision(&f.project_dir.path().join("folder")).unwrap();
    let renamed=f.command("file_rename",json!({"entryId":parent["fileId"],"newName":"renamed","expectedRevision":rev})).unwrap();
    assert_eq!(renamed["file"]["fileId"],parent["fileId"]);assert!(f.state.resolve_file(&f.project,nested["fileId"].as_str().unwrap()).unwrap().ends_with("renamed/a.txt"));
    assert_eq!(f.state.document_meta(nested_open["meta"]["documentId"].as_str().unwrap()).unwrap()["file"]["fileId"],nested["fileId"]);
    assert_eq!(f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap()["baseDiskRevision"],meta["baseDiskRevision"]);
}

#[test]fn rename_does_not_overwrite_collision(){let f=Fixture::new();let a=f.file("a.txt","a");f.file("b.txt","b");let rev=files::disk_revision(&f.project_dir.path().join("a.txt")).unwrap();assert!(f.command("file_rename",json!({"entryId":a["fileId"],"newName":"b.txt","expectedRevision":rev})).is_err());assert_eq!(fs::read_to_string(f.project_dir.path().join("b.txt")).unwrap(),"b");}

#[cfg(target_os="macos")]
#[test]fn file_trash_uses_native_trash_without_finder(){
    let f=Fixture::new();let name=format!("horizon-host-trash-regression-{}.txt",state::id());let file=f.file(&name,"synthetic recoverable trash fixture");f.file("retained.txt","keep");let stat=f.command("file_stat",json!({"fileId":file["fileId"]})).unwrap();
    let result=f.command("file_trash",json!({"entryId":file["fileId"],"expectedRevision":stat["revision"],"confirmationDigest":stat["confirmationDigest"]})).unwrap();assert_eq!(result["trashed"],true);assert!(!f.project_dir.path().join(name).exists());assert_eq!(fs::read_to_string(f.project_dir.path().join("retained.txt")).unwrap(),"keep");
}

#[test]fn file_trash_preserves_stale_unconfirmed_and_dirty_files(){
    let f=Fixture::new();let file=f.file("guarded.txt","base");let stat=f.command("file_stat",json!({"fileId":file["fileId"]})).unwrap();let mut params=json!({"entryId":file["fileId"],"expectedRevision":stat["revision"],"confirmationDigest":"invalid"});assert_eq!(f.command("file_trash",params.clone()).unwrap_err().code,"STALE_VERSION");
    params["confirmationDigest"]=stat["confirmationDigest"].clone();fs::write(f.project_dir.path().join("guarded.txt"),"changed").unwrap();assert_eq!(f.command("file_trash",params.clone()).unwrap_err().code,"FILE_CHANGED");let opened=f.open(&file);let stat=f.command("file_stat",json!({"fileId":file["fileId"]})).unwrap();params["expectedRevision"]=stat["revision"].clone();params["confirmationDigest"]=stat["confirmationDigest"].clone();f.command("document_mark_dirty",json!({"documentId":opened["meta"]["documentId"],"editorRevision":1,"dirty":true})).unwrap();assert_eq!(f.command("file_trash",params).unwrap_err().code,"RESOURCE_BUSY");assert_eq!(fs::read_to_string(f.project_dir.path().join("guarded.txt")).unwrap(),"changed");
}

#[test]fn recovery_survives_host_restart_and_does_not_touch_disk(){
    let f=Fixture::new();let file=f.file("draft.md","disk");let opened=f.open(&file);let meta=&opened["meta"];
    f.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":3,"baseDiskRevision":meta["baseDiskRevision"],"text":"崩溃前草稿","selection":{"anchor":3,"head":3}})).unwrap();f.state.persist().unwrap();
    let restarted=Arc::new(HostState::new(f._data.path().into()).unwrap());let recovery=files::dispatch(restarted,f.call("recovery_read",json!({"checkpointId":meta["documentId"]}))).unwrap();assert_eq!(recovery["text"],"崩溃前草稿");assert_eq!(fs::read_to_string(f.project_dir.path().join("draft.md")).unwrap(),"disk");
}

#[test]fn non_utf8_paths_are_lossless_and_project_ids_are_scoped(){
    use std::os::unix::ffi::OsStringExt;
    let f=Fixture::new();let name=std::ffi::OsString::from_vec(vec![b'a',0xff,b'.',b't']);let path=f.project_dir.path().join(name);
    if let Err(error)=fs::write(&path,"text"){assert_eq!(error.raw_os_error(),Some(92),"unexpected filesystem failure: {error}");assert_eq!(state::native_decode(&state::native_encode(&path)).unwrap(),path);eprintln!("APFS rejected non-Unicode name (EILSEQ); verified lossless path codec instead");return;}
    let file=f.state.file_ref(&f.project,&path).unwrap();assert_eq!(f.state.resolve_file(&f.project,file["fileId"].as_str().unwrap()).unwrap(),path.canonicalize().unwrap());
    let other=tempfile::tempdir().unwrap();let project=f.state.register_project(other.path().into(),None,None).unwrap();assert_eq!(f.state.resolve_file(project["project"]["id"].as_str().unwrap(),file["fileId"].as_str().unwrap()).unwrap_err().code,"PERMISSION_DENIED");
    let listing=f.command("directory_list",json!({"directoryId":null})).unwrap();assert_eq!(listing["entries"][0]["nativeNameLossless"],false);
}

#[test]fn project_symlink_cannot_escape(){
    let f=Fixture::new();let outside=tempfile::tempdir().unwrap();fs::write(outside.path().join("secret"),"outside").unwrap();std::os::unix::fs::symlink(outside.path().join("secret"),f.project_dir.path().join("link")).unwrap();let file=f.state.file_ref(&f.project,&f.project_dir.path().join("link")).unwrap();assert_eq!(f.state.resolve_file(&f.project,file["fileId"].as_str().unwrap()).unwrap_err().code,"PERMISSION_DENIED");
}

#[test]fn directory_cursor_invalidates_after_change(){let f=Fixture::new();f.file("a","a");f.file("b","b");let first=f.command("directory_list",json!({"directoryId":null,"limit":1})).unwrap();f.file("c","c");assert_eq!(f.command("directory_list",json!({"directoryId":null,"limit":1,"cursor":first["nextCursor"]})).unwrap_err().code,"STALE_CURSOR");}

#[test]fn utf16_and_mixed_eol_are_read_only(){let f=Fixture::new();let utf=f.file("utf16.txt",files::encode("中文😀\n","utf16le","lf").unwrap());let mixed=f.file("mixed.txt","a\r\nb\n");assert_eq!(f.open(&utf)["meta"]["readOnly"],true);assert_eq!(f.open(&mixed)["meta"]["readOnly"],true);}

#[test]fn big_file_chunks_preserve_utf8_boundaries_and_reject_changed_file(){
    let f=Fixture::new();let path=f.project_dir.path().join("big.txt");let text="你好😀\n".repeat(5_000_000);fs::write(&path,&text).unwrap();let file=f.state.file_ref(&f.project,&path).unwrap();let opened=f.open(&file);assert_eq!(opened["mode"],"chunked");
    let first=f.command("file_read_chunk",json!({"fileId":file["fileId"],"cursor":opened["cursor"],"limitBytes":17})).unwrap();let second=f.command("file_read_chunk",json!({"fileId":file["fileId"],"cursor":first["nextCursor"],"limitBytes":17})).unwrap();let combined=format!("{}{}",first["text"].as_str().unwrap(),second["text"].as_str().unwrap());assert!(text.starts_with(&combined));
    fs::write(&path,"changed").unwrap();assert_eq!(f.command("file_read_chunk",json!({"fileId":file["fileId"],"cursor":second["nextCursor"]})).unwrap_err().code,"FILE_CHANGED");
}

#[test]fn project_dedup_and_session_survive_restart(){
    let f=Fixture::new();let duplicate=f.state.register_project(f.project_dir.path().join("."),None,None).unwrap();assert_eq!(duplicate["reused"],true);assert_eq!(duplicate["project"]["id"],f.project);
    let file=f.file("a","a");let session=projects::dispatch(f.state.clone(),f.call("session_update",json!({"tabs":[{"fileId":file["fileId"],"pinned":true,"selection":{"anchor":1,"head":1},"scrollTop":7}],"activeFileId":file["fileId"],"expandedEntryIds":[],"searchDraft":"中文","commitDraft":"message"}))).unwrap();assert_eq!(session["searchDraft"],"中文");
    let restarted=HostState::new(f._data.path().into()).unwrap();assert_eq!(restarted.registry.lock().unwrap().sessions[&f.project]["commitDraft"],"message");assert!(restarted.resolve_file(&f.project,file["fileId"].as_str().unwrap()).is_ok());
}

#[test]fn settings_invalid_patch_is_atomic(){
    let f=Fixture::new();let mut call=f.call("settings_patch",json!({"scope":"global","expectedRevision":1,"set":{"editor.fontSize":15,"unknown.setting":1},"unset":[]}));call.scope=json!({"kind":"app"});assert_eq!(settings::dispatch(f.state.clone(),call).unwrap_err().code,"INVALID_ARGUMENT");assert!(!f.state.data_dir().join("settings.json").exists());
}

#[test]fn undo_to_saved_content_removes_checkpoint_without_changing_disk_baseline(){
    let f=Fixture::new();let file=f.file("undo.txt","saved");let opened=f.open(&file);let meta=&opened["meta"];
    f.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":1,"baseDiskRevision":meta["baseDiskRevision"],"text":"changed","selection":{"anchor":7,"head":7}})).unwrap();
    f.command("document_mark_dirty",json!({"documentId":meta["documentId"],"editorRevision":2,"dirty":false})).unwrap();
    assert!(!f.state.data_dir().join("recovery").join(format!("{}.json",meta["documentId"].as_str().unwrap())).exists());
    let clean=f.state.document_meta(meta["documentId"].as_str().unwrap()).unwrap();assert_eq!(clean["state"],"clean");assert_eq!(clean["baseDiskRevision"],meta["baseDiskRevision"]);assert_eq!(fs::read_to_string(f.project_dir.path().join("undo.txt")).unwrap(),"saved");
    assert_eq!(f.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":1,"baseDiskRevision":meta["baseDiskRevision"],"text":"stale","selection":{}})).unwrap_err().code,"STALE_VERSION");
}

#[test]fn close_retains_latest_checkpoint_and_releases_only_its_project(){
    let f=Fixture::new();let file=f.file("draft.txt","disk");let opened=f.open(&file);let meta=&opened["meta"];let other=f.file("clean.txt","clean");f.open(&other);
    f.command("document_checkpoint",json!({"documentId":meta["documentId"],"editorRevision":3,"baseDiskRevision":meta["baseDiskRevision"],"text":"recover me","selection":{"anchor":3,"head":3}})).unwrap();
    let other_root=tempfile::tempdir().unwrap();fs::write(other_root.path().join("a"),"other project").unwrap();let other_id=f.state.register_project(other_root.path().into(),None,None).unwrap()["project"]["id"].as_str().unwrap().to_owned();let other_file=f.state.file_ref(&other_id,&other_root.path().join("a")).unwrap();files::open_document(&f.state,&other_id,other_file["fileId"].as_str().unwrap(),"auto").unwrap();
    let plan=projects::dispatch(f.state.clone(),f.call("project_close_plan",json!({"projectId":f.project,"action":"sleep"}))).unwrap();
    assert_eq!(projects::validate_close_decisions(&plan,&[json!({"resourceId":"not-in-plan","action":"discard"})]).unwrap_err().code,"PERMISSION_DENIED");
    let decisions=vec![json!({"resourceId":meta["documentId"],"action":"retainCheckpoint","checkpointId":meta["documentId"]})];projects::validate_close_decisions(&plan,&decisions).unwrap();f.state.validate_document_decisions(&decisions).unwrap();
    assert_eq!(f.state.release_project_resources(&f.project).unwrap_err().code,"RESOURCE_BUSY");f.state.resolve_document_decisions(&decisions).unwrap();f.state.release_project_resources(&f.project).unwrap();assert!(f.state.open_documents(Some(&f.project)).is_empty());assert_eq!(f.state.open_documents(Some(&other_id)).len(),1);
    assert_eq!(f.command("recovery_read",json!({"checkpointId":meta["documentId"]})).unwrap()["text"],"recover me");
}

#[test]fn empty_workspace_selection_and_project_move_survive_restart(){
    let f=Fixture::new();let mut call=f.call("project_activate",json!({"projectId":f.project}));call.scope=json!({"kind":"app"});projects::dispatch(f.state.clone(),call.clone()).unwrap();
    call.method="workspace_create".into();call.params=json!({"name":"Empty"});let workspace=projects::dispatch(f.state.clone(),call.clone()).unwrap();let workspace_id=workspace["id"].as_str().unwrap();call.method="workspace_activate".into();call.params=json!({"workspaceId":workspace_id});let selected=projects::dispatch(f.state.clone(),call.clone()).unwrap();assert!(selected["activeProjectId"].is_null());
    let restarted=HostState::new(f._data.path().into()).unwrap();assert_eq!(restarted.registry.lock().unwrap().sessions["__app"]["activeWorkspaceId"],workspace_id);
    call.method="project_activate".into();call.params=json!({"projectId":f.project});projects::dispatch(f.state.clone(),call.clone()).unwrap();call.method="project_update".into();call.params=json!({"projectId":f.project,"expectedRevision":1,"workspaceId":workspace_id});projects::dispatch(f.state.clone(),call).unwrap();assert_eq!(f.state.registry.lock().unwrap().sessions["__app"]["activeWorkspaceId"],workspace_id);
}

#[test]fn image_preview_checks_dimensions_before_returning_browser_bytes(){
    let f=Fixture::new();let path=f.project_dir.path().join("wide.png");image::GrayImage::new(9000,1).save(&path).unwrap();let file=f.state.file_ref(&f.project,&path).unwrap();assert_eq!(f.command("image_read",json!({"fileId":file["fileId"]})).unwrap_err().code,"RESOURCE_LIMIT");
    let path=f.project_dir.path().join("small.png");image::GrayImage::new(16,8).save(&path).unwrap();let file=f.state.file_ref(&f.project,&path).unwrap();let preview=f.command("image_read",json!({"fileId":file["fileId"]})).unwrap();assert_eq!((preview["width"].as_u64(),preview["height"].as_u64()),(Some(16),Some(8)));assert!(preview["dataUrl"].as_str().unwrap().starts_with("data:image/png;base64,"));
}

#[test]fn sleeping_project_rejects_its_old_epoch_after_reactivation(){
    let f=Fixture::new();let call=f.call("project_activate",json!({"projectId":f.project}));let first=projects::dispatch(f.state.clone(),call.clone()).unwrap();let mut request=f.call("session_get",json!({}));request.scope["projectEpoch"]=first["projectEpoch"].clone();f.state.validate_scope(&request).unwrap();f.state.invalidate_project_scope(&f.project);assert_eq!(f.state.validate_scope(&request).unwrap_err().code,"STALE_SCOPE");let second=projects::dispatch(f.state.clone(),call).unwrap();assert!(second["projectEpoch"].as_u64().unwrap()>first["projectEpoch"].as_u64().unwrap());assert_eq!(f.state.validate_scope(&request).unwrap_err().code,"STALE_SCOPE");
}

#[test]fn diagnostic_export_writes_anonymous_editor_samples_and_native_measurement(){
    let f=Fixture::new();let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());
    let sample=json!({"id":7,"cache":"warm","startedAtMs":1_793_385_000_000u64,"durationMs":12.25,"languageReadyMs":4.5,"highlightReadyMs":18.75,"byteLength":204800,"editorRevision":3,"viewId":2,"language":"tsx"});
    let mut call=f.call("data_export",json!({"categories":["diagnostics"],"destinationSelectionToken":token,"name":"diagnostics.json","frontendDiagnostics":{"editor":{"schemaVersion":1,"viewCount":1,"openP95Ms":12.25,"opens":[sample]}}}));call.scope=json!({"kind":"app"});
    let receipt=settings::dispatch(f.state.clone(),call).unwrap();let bytes=fs::read(output.path().join("diagnostics.json")).unwrap();assert_eq!(receipt["bytesWritten"],bytes.len().to_string());let exported:Value=serde_json::from_slice(&bytes).unwrap();let editor=&exported["diagnostics"]["frontend"]["editor"];
    assert_eq!(editor["opens"],json!([sample]));assert_eq!(editor["openP95Ms"],12.25);assert!(editor["measurement"].as_str().unwrap().ends_with("Pixel paint is not directly observed."));
    let text=String::from_utf8(bytes).unwrap();assert!(!text.contains(&f.project));assert!(!text.contains(&f.project_dir.path().to_string_lossy().to_string()));
}

#[test]fn diagnostic_export_rejects_identifiers_extra_strings_and_unbounded_samples_before_write(){
    let f=Fixture::new();let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());let valid=json!({"id":1,"cache":"cold","startedAtMs":1_793_385_000_000u64});
    let mut invalid=Vec::new();for(field,value)in [("projectId",json!("private-project")),("fileId",json!("private-file")),("path",json!("/private/code")),("text",json!("document text")),("language",json!("arbitrary")),("byteLength",json!(1.5)),("viewId",json!(9_007_199_254_740_992u64)),("durationMs",json!(-1))]{let mut sample=valid.clone();sample[field]=value;invalid.push(json!({"opens":[sample]}));}
    invalid.push(json!({"opens":vec![valid.clone();201]}));invalid.push(json!({"opens":[{"cache":"cold","startedAtMs":0}]}));invalid.push(json!({"opens":[valid],"measurement":"client controlled text"}));
    for(index,editor)in invalid.into_iter().enumerate(){let name=format!("rejected-{index}.json");let mut call=f.call("data_export",json!({"categories":["diagnostics"],"destinationSelectionToken":token,"name":name,"frontendDiagnostics":{"editor":editor}}));call.scope=json!({"kind":"app"});assert_eq!(settings::dispatch(f.state.clone(),call).unwrap_err().code,"INVALID_ARGUMENT");assert!(!output.path().join(name).exists());}
}

#[test]fn diagnostic_export_counts_resources_without_serializing_their_records(){
    let f=Fixture::new();let file=f.file("private-source.txt","do not export document text");f.open(&file);
    f.state.subscriptions.lock().unwrap().insert("private-subscription".into(),state::Subscription{request_id:"private-request".into(),scope:json!({"kind":"project","projectId":f.project}),topics:vec!["horizon.document.v1".into()],channel:tauri::ipc::Channel::new(|_|Ok(())),seq:0});
    for(task_id,terminal)in [("private-active",None),("private-completed",Some(json!({"state":"succeeded"})))]{f.state.tasks.lock().unwrap().insert(task_id.into(),state::TaskRecord{id:task_id.into(),call:f.call("search_start",json!({"query":"private-query"})),state:if terminal.is_some(){"succeeded"}else{"running"}.into(),cancelled:false,seq:0,ack:0,events:Default::default(),ring_bytes:0,channel:None,terminal,updated:std::time::Instant::now()});}
    f.state.cache_paths(&f.project,Arc::new(vec![f.project_dir.path().join("private-source.txt")]),false);f.state.search_results.lock().unwrap().insert("private-completed".into(),vec![json!({"lineText":"private-result"})]);f.state.idempotency.lock().unwrap().insert("private-idempotency".into(),state::IdempotencyRecord{digest:"private-digest".into(),result:json!({"text":"private-result"}),bytes:25,at:std::time::Instant::now()});f.state.plans.lock().unwrap().insert("private-plan".into(),json!({"text":"private-plan-content"}));
    let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());let mut call=f.call("data_export",json!({"categories":["diagnostics"],"destinationSelectionToken":token,"name":"counts.json"}));call.scope=json!({"kind":"app"});settings::dispatch(f.state.clone(),call).unwrap();let bytes=fs::read(output.path().join("counts.json")).unwrap();let exported:Value=serde_json::from_slice(&bytes).unwrap();let diagnostics=&exported["diagnostics"];
    assert_eq!(diagnostics["taskRecords"],json!({"total":2,"active":1,"completedCached":1}));assert_eq!(diagnostics["subscriptions"],1);assert_eq!(diagnostics["openDocuments"],1);assert_eq!(diagnostics["watchers"],1);
    for field in ["pathSearchProjects","pathSearchPaths","searchResultTasks","searchResultItems","idempotencyEntries","operationPlans"]{assert_eq!(diagnostics["caches"][field],1,"{field}");}
    let text=String::from_utf8(bytes).unwrap();assert!(!text.contains("private-"));assert!(!text.contains("do not export"));assert!(!text.contains(&f.project));
}

#[test]fn project_activation_persists_last_opened_time_without_changing_revision(){
    let f=Fixture::new();assert!(f.state.registry.lock().unwrap().projects[0].get("lastOpenedAt").is_none());let mut call=f.call("project_activate",json!({"projectId":f.project}));call.scope=json!({"kind":"app"});let activated=projects::dispatch(f.state.clone(),call.clone()).unwrap();let opened=activated["project"]["lastOpenedAt"].as_str().unwrap();assert!(chrono::DateTime::parse_from_rfc3339(opened).is_ok());assert_eq!(activated["project"]["revision"],1);
    let restarted=HostState::new(f._data.path().into()).unwrap();assert_eq!(restarted.registry.lock().unwrap().projects[0]["lastOpenedAt"],opened);
    let moved=tempfile::tempdir().unwrap();fs::rename(f.project_dir.path(),moved.path().join("project")).unwrap();assert!(projects::dispatch(f.state.clone(),call).is_err());let registry=f.state.registry.lock().unwrap();assert_eq!(registry.projects[0]["lastOpenedAt"],opened);assert_eq!(registry.projects[0]["revision"],1);
}

#[cfg(unix)]
#[test]fn inaccessible_project_preserves_active_context_and_retries_after_permission_recovery(){
    use std::os::unix::fs::PermissionsExt;
    let f=Fixture::new();
    projects::dispatch(f.state.clone(),f.call("project_activate",json!({"projectId":f.project}))).unwrap();
    let blocked=tempfile::tempdir().unwrap();fs::write(blocked.path().join("keep.txt"),"keep").unwrap();
    let registered=f.state.register_project(blocked.path().into(),None,None).unwrap();let id=registered["project"]["id"].as_str().unwrap();
    let permissions=fs::metadata(blocked.path()).unwrap().permissions();fs::set_permissions(blocked.path(),fs::Permissions::from_mode(0)).unwrap();
    let result=projects::dispatch(f.state.clone(),f.call("project_activate",json!({"projectId":id})));
    fs::set_permissions(blocked.path(),permissions).unwrap();
    let error=result.unwrap_err();assert_eq!(error.code,"PERMISSION_DENIED");assert_eq!(error.details.unwrap()["kind"],"projectDirectory");
    {let reg=f.state.registry.lock().unwrap();assert_eq!(reg.sessions["__app"]["activeProjectId"],f.project);let item=reg.projects.iter().find(|p|p["id"]==id).unwrap();assert_eq!(item["state"],"unavailable");assert_eq!(item["accessError"]["code"],"PERMISSION_DENIED");}
    let reopened=projects::dispatch(f.state.clone(),f.call("project_activate",json!({"projectId":id}))).unwrap();assert_eq!(reopened["project"]["state"],"active");assert!(reopened["project"].get("accessError").is_none());assert_eq!(reopened["project"]["revision"],1);assert_eq!(fs::read_to_string(blocked.path().join("keep.txt")).unwrap(),"keep");
}

#[test]fn missing_project_is_distinct_from_permission_failure_and_recovers_without_new_identity(){
    let f=Fixture::new();let holding=tempfile::tempdir().unwrap();let moved=holding.path().join("moved-project");
    fs::write(f.project_dir.path().join("keep.txt"),"keep").unwrap();fs::rename(f.project_dir.path(),&moved).unwrap();
    let result=projects::dispatch(f.state.clone(),f.call("project_activate",json!({"projectId":f.project})));
    fs::rename(&moved,f.project_dir.path()).unwrap();
    let error=result.unwrap_err();assert_eq!(error.code,"NOT_FOUND");assert_eq!(error.details.unwrap()["projectId"],f.project);
    {let reg=f.state.registry.lock().unwrap();assert_eq!(reg.projects[0]["state"],"unavailable");assert_eq!(reg.projects[0]["accessError"]["code"],"NOT_FOUND");}
    let reopened=projects::dispatch(f.state.clone(),f.call("project_activate",json!({"projectId":f.project}))).unwrap();assert_eq!(reopened["project"]["id"],f.project);assert!(reopened["project"].get("accessError").is_none());assert_eq!(fs::read_to_string(f.project_dir.path().join("keep.txt")).unwrap(),"keep");
}

#[test]fn session_tabs_survive_missing_root_but_reject_other_project_file_ids(){
    let f=Fixture::new();let file=f.file("keep.txt","keep");
    let other=tempfile::tempdir().unwrap();fs::write(other.path().join("other.txt"),"other").unwrap();let other_project=f.state.register_project(other.path().into(),None,None).unwrap();let other_file=f.state.file_ref(other_project["project"]["id"].as_str().unwrap(),&other.path().join("other.txt")).unwrap();
    let holding=tempfile::tempdir().unwrap();let moved=holding.path().join("moved-project");fs::rename(f.project_dir.path(),&moved).unwrap();
    let saved=projects::dispatch(f.state.clone(),f.call("session_update",json!({"tabs":[{"fileId":file["fileId"],"pinned":true,"selection":{"anchor":1,"head":2},"scrollTop":42}],"activeFileId":file["fileId"]})));
    let rejected=projects::dispatch(f.state.clone(),f.call("session_update",json!({"tabs":[{"fileId":other_file["fileId"]}]})));
    fs::rename(&moved,f.project_dir.path()).unwrap();
    let session=saved.unwrap();assert_eq!(session["tabs"][0]["fileId"],file["fileId"]);assert_eq!(session["tabs"][0]["scrollTop"],42);assert_eq!(rejected.unwrap_err().code,"PERMISSION_DENIED");assert_eq!(f.state.registry.lock().unwrap().sessions[&f.project],session);assert_eq!(fs::read_to_string(f.project_dir.path().join("keep.txt")).unwrap(),"keep");
}

#[test]fn project_reveal_requires_app_scope_and_a_registered_existing_root(){
    let f=Fixture::new();let mut call=f.call("project_reveal",json!({"projectId":f.project}));assert_eq!(projects::dispatch(f.state.clone(),call.clone()).unwrap_err().code,"PERMISSION_DENIED");
    call.scope=json!({"kind":"app"});call.params=json!({"projectId":"not-registered"});assert_eq!(projects::dispatch(f.state.clone(),call.clone()).unwrap_err().code,"NOT_FOUND");
    call.params=json!({"projectId":f.project,"path":"/private/arbitrary-path"});assert_eq!(projects::dispatch(f.state.clone(),call.clone()).unwrap_err().code,"INVALID_ARGUMENT");
    call.params=json!({"projectId":f.project});let moved=tempfile::tempdir().unwrap();fs::rename(f.project_dir.path(),moved.path().join("project")).unwrap();assert_eq!(projects::dispatch(f.state.clone(),call.clone()).unwrap_err().code,"NOT_FOUND");
    fs::write(f.project_dir.path(),"not a directory").unwrap();let invalid=projects::dispatch(f.state.clone(),call).unwrap_err();fs::remove_file(f.project_dir.path()).unwrap();assert_eq!(invalid.code,"INVALID_ARGUMENT");
}

fn runtime_diagnostic_fixture()->Value{json!({"schemaVersion":1,"eventListeners":7,"eventListenersDisposing":0,"eventListenerDisposalFailures":0,"workerEventListeners":1,"workerAbortListeners":2,"workerCommandObservers":3,"workerCommands":4,"workerViews":5,"pluginInstances":6,"pluginInstancesDisposing":0,"cordisRootListeners":8,"cordisPluginListeners":9,"pluginStoreObservers":10,"activationErrorObservers":11})}

#[test]fn diagnostic_export_preserves_frontend_runtime_counts_separately_from_native_subscriptions(){
    let f=Fixture::new();let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());let runtime=runtime_diagnostic_fixture();let mut call=f.call("data_export",json!({"categories":["diagnostics"],"destinationSelectionToken":token,"name":"runtime.json","frontendDiagnostics":{"editor":{"schemaVersion":1,"viewCount":0},"runtime":runtime}}));call.scope=json!({"kind":"app"});settings::dispatch(f.state.clone(),call).unwrap();
    let exported:Value=serde_json::from_slice(&fs::read(output.path().join("runtime.json")).unwrap()).unwrap();assert_eq!(exported["diagnostics"]["frontend"]["runtime"],runtime);assert_eq!(exported["diagnostics"]["subscriptions"],0);assert_eq!(exported["diagnostics"]["frontend"]["editor"]["viewCount"],0);
}

#[test]fn diagnostic_export_rejects_unknown_incomplete_and_non_integer_runtime_counts(){
    let f=Fixture::new();let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());let mut invalid=vec![json!("runtime"),json!([]),Value::Null];
    for(field,value)in [("schemaVersion",json!(2)),("eventListeners",json!(-1)),("eventListeners",json!(1.5)),("eventListeners",json!("7")),("eventListeners",json!([])),("eventListeners",json!(true)),("eventListeners",json!(9_007_199_254_740_992u64)),("projectId",json!("private-id")),("path",json!("/private/path")),("text",json!("private text")),("unknown",json!(0))]{let mut runtime=runtime_diagnostic_fixture();runtime[field]=value;invalid.push(runtime);}
    let mut missing=runtime_diagnostic_fixture();missing.as_object_mut().unwrap().remove("workerViews");invalid.push(missing);
    for(index,runtime)in invalid.into_iter().enumerate(){let name=format!("runtime-rejected-{index}.json");let mut call=f.call("data_export",json!({"categories":["diagnostics"],"destinationSelectionToken":token,"name":name,"frontendDiagnostics":{"editor":{},"runtime":runtime}}));call.scope=json!({"kind":"app"});assert_eq!(settings::dispatch(f.state.clone(),call).unwrap_err().code,"INVALID_ARGUMENT");assert!(!output.path().join(name).exists());}
}

fn app_settings(f:&Fixture,method:&str,params:Value)->Result<Value,horizon_host::HostError>{let mut call=f.call(method,params);call.scope=json!({"kind":"app"});settings::dispatch(f.state.clone(),call)}

#[test]fn export_preview_projects_known_fields_and_writes_the_exact_frozen_snapshot(){
    let f=Fixture::new();let preset_id=state::id();let asset="a".repeat(64);
    state::atomic_json(&f.state.data_dir().join("settings.json"),&json!({"schemaVersion":1,"revision":7,"global":{"editor.fontSize":16,"editor.fontFamily":"PRIVATE_FONT /Users/qa/project","git.path":"/private/local/bin/git","connections":[{"accessToken":"PRIVATE_FAKE_TOKEN","notes":"PRIVATE_SOURCE at /private/source.ts"}],"unknownConfiguration":"PRIVATE_FIELD","shortcuts":{"file.save":"Meta+s","file.open":"/private/path","PRIVATE_COMMAND":"Ctrl+p"}},"projects":{f.project.clone():{"editor.tabSize":4,"connections":[{"accessToken":"PRIVATE_PROJECT_TOKEN"}]},"/private/project":{"editor.fontSize":17}}})).unwrap();
    state::atomic_json(&f.state.data_dir().join("appearance.json"),&json!({"schemaVersion":1,"revision":3,"global":{"mode":"dark","themeId":"horizon.theme.mist","color:horizon.theme.mist:dark:accent":"#abc","geometry:horizon.layout.mist:sidebarWidth":260,"unknown":"PRIVATE_APPEARANCE","background":{"assetId":asset,"region":"editor","fit":"cover","position":{"x":0.5,"y":0.5,"unknown":"PRIVATE_POSITION"},"opacity":0.1,"overlay":0.8,"path":"/private/image.png"}},"projects":{},"presets":[{"id":preset_id,"revision":1,"name":"Preview","values":{"layoutId":"horizon.layout.mist","themeId":"horizon.theme.mist","mode":"system","geometryByLayout":{"horizon.layout.mist":{"sidebarWidth":250,"unknown":"PRIVATE_GEOMETRY"}},"colorsByTheme":{"horizon.theme.mist":{"dark":{"accent":"#abcdef","unknown":"PRIVATE_COLOR"}}},"unknown":"PRIVATE_PRESET"},"packageRefs":[{"id":"horizon.theme.mist","apiVersion":1,"secret":"PRIVATE_PACKAGE"}],"assetRefs":[asset,"/private/asset"],"unknown":"PRIVATE_PRESET_FIELD"},{"id":state::id(),"name":"PRIVATE_NAME C:\\Users\\qa","values":{}},{"id":state::id(),"name":"PRIVATE_UNC \\\\server\\share","values":{}}],"assets":{asset.clone():{"id":asset,"revision":1,"mediaType":"image/png","width":16,"height":8,"bytes":"99","path":"/private/image.png","unknown":"PRIVATE_ASSET"}}})).unwrap();
    let current=app_settings(&f,"settings_get",json!({})).unwrap();assert!(current["global"].get("connections").is_none());assert!(current["effective"].get("connections").is_none());
    let preview=app_settings(&f,"data_export_preview",json!({"categories":["settings"]})).unwrap();assert_eq!(preview["suggestedName"],"horizon-settings.json");let snapshot=serde_json::to_string_pretty(&preview["data"]).unwrap();assert_eq!(preview["byteCount"],snapshot.len().to_string());assert!(!snapshot.contains("PRIVATE_"));assert!(!snapshot.contains("/private/"));
    assert_eq!(preview["data"]["settings"]["global"]["editor.fontSize"],16);assert!(preview["data"]["settings"]["global"].get("editor.fontFamily").is_none());assert_eq!(preview["data"]["appearance"]["presets"].as_array().unwrap().len(),1);assert_eq!(preview["data"]["settings"]["global"]["shortcuts"],json!({"file.save":"Meta+s"}));assert_eq!(preview["data"]["appearance"]["presets"][0]["values"]["geometryByLayout"]["horizon.layout.mist"]["sidebarWidth"],250);
    let changed=app_settings(&f,"settings_patch",json!({"scope":"global","expectedRevision":current["revision"],"set":{"editor.fontSize":18},"unset":[]})).unwrap();
    let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());let receipt=app_settings(&f,"data_export",json!({"planId":preview["planId"],"destinationSelectionToken":token,"name":"frozen.json"})).unwrap();assert_eq!(fs::read_to_string(output.path().join("frozen.json")).unwrap(),snapshot);assert_eq!(receipt["bytesWritten"],preview["byteCount"]);assert!(f.state.plans.lock().unwrap().get(preview["planId"].as_str().unwrap()).is_none());
    assert_eq!(app_settings(&f,"settings_patch",json!({"scope":"global","expectedRevision":changed["revision"],"set":{"connections":[{"accessToken":"secret"}]},"unset":[]})).unwrap_err().code,"INVALID_ARGUMENT");
}

#[test]fn export_preview_limits_discard_expiry_and_failed_write_allow_retry(){
    let f=Fixture::new();let first=app_settings(&f,"data_export_preview",json!({"categories":["diagnostics"]})).unwrap();for _ in 0..3{app_settings(&f,"data_export_preview",json!({"categories":["diagnostics"]})).unwrap();}assert_eq!(app_settings(&f,"data_export_preview",json!({"categories":["diagnostics"]})).unwrap_err().code,"RESOURCE_LIMIT");
    assert_eq!(app_settings(&f,"data_export_discard",json!({"planId":first["planId"]})).unwrap()["discarded"],true);let preview=app_settings(&f,"data_export_preview",json!({"categories":["diagnostics"]})).unwrap();let plan_id=preview["planId"].as_str().unwrap();
    let output=tempfile::tempdir().unwrap();let token=f.state.register_selection(output.path().into());fs::write(output.path().join("existing.json"),"keep").unwrap();assert!(app_settings(&f,"data_export",json!({"planId":plan_id,"destinationSelectionToken":token,"name":"existing.json"})).is_err());assert_eq!(fs::read_to_string(output.path().join("existing.json")).unwrap(),"keep");assert_eq!(f.state.plans.lock().unwrap()[plan_id]["exporting"],false);
    app_settings(&f,"data_export",json!({"planId":plan_id,"destinationSelectionToken":token,"name":"retry.json"})).unwrap();let expired=app_settings(&f,"data_export_preview",json!({"categories":["diagnostics"]})).unwrap();f.state.plans.lock().unwrap().get_mut(expired["planId"].as_str().unwrap()).unwrap()["expiresAt"]=json!("2000-01-01T00:00:00Z");assert_eq!(app_settings(&f,"data_export",json!({"planId":expired["planId"],"destinationSelectionToken":token,"name":"expired.json"})).unwrap_err().code,"STALE_VERSION");assert!(!output.path().join("expired.json").exists());
}

#[test]fn export_preview_rejects_oversized_snapshot_before_allocating_a_plan(){
    let f=Fixture::new();let mut projects=serde_json::Map::new();for _ in 0..25_000{projects.insert(state::id(),json!({"editor.fontSize":14}));}state::atomic_json(&f.state.data_dir().join("settings.json"),&json!({"schemaVersion":1,"revision":1,"global":{},"projects":projects})).unwrap();assert_eq!(app_settings(&f,"data_export_preview",json!({"categories":["settings"]})).unwrap_err().code,"RESOURCE_LIMIT");assert!(f.state.plans.lock().unwrap().is_empty());
}
