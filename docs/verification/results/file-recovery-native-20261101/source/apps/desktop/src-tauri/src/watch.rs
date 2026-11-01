use crate::{HostError,HostState};
use notify::{Watcher,RecursiveMode,EventKind};
use serde_json::json;
use std::sync::Arc;

pub fn ensure(state:&Arc<HostState>,project:&str)->Result<(),HostError>{
    let mut watchers=state.watchers.lock().unwrap();if watchers.contains_key(project){return Ok(());}
    let root=state.project_root(project)?;let weak=Arc::downgrade(state);let owner=project.to_owned();
    let mut watcher=notify::recommended_watcher(move|result:notify::Result<notify::Event>|{
        let Some(state)=weak.upgrade()else{return};
        let event=match result{Ok(event)=>event,Err(_)=>{state.notify_project("horizon.files.v1",&owner,0,"invalidate",Some(&owner));return;}};
        if matches!(event.kind,EventKind::Access(_)){return;}
        // Observe an app-owned save/rename only after its disk and document
        // revisions have both committed; otherwise its own event looks external.
        let _file_guard=state.file_lock.lock().unwrap();
        if matches!(event.kind,EventKind::Create(_)|EventKind::Remove(_)|EventKind::Modify(notify::event::ModifyKind::Name(_))|EventKind::Any){state.path_search_cache.lock().unwrap().remove(&owner);}
        let documents=state.open_documents(Some(&owner));
        for path in &event.paths{
            if path.components().any(|p|p.as_os_str()==".git"){continue;}
            if let Ok(file)=state.file_ref(&owner,path){state.notify_project("horizon.files.v1",file["fileId"].as_str().unwrap(),0,"invalidate",Some(&owner));}
        }
        for meta in documents{
            let file_id=meta["file"]["fileId"].as_str().unwrap_or("");
            // Match the registered identity even when its disk path has become
            // inaccessible. Reading still requires the normal scope check.
            let path={let registry=state.registry.lock().unwrap();match registry.paths.get(file_id){Some((project,path))if project==&owner=>crate::state::native_decode(path).ok(),_=>None}};
            let Some(path)=path else{continue};
            if !event.paths.iter().any(|changed|path==*changed||path.starts_with(changed)){continue;}
            let current=state.resolve_file(&owner,file_id).and_then(|path|crate::files::disk_revision(&path));
            if current.as_ref().is_ok_and(|revision|revision["token"]==meta["baseDiskRevision"]["token"]){continue;}
            let document_id=meta["documentId"].as_str().unwrap();
            if let Some(document)=state.documents.lock().unwrap().get_mut(document_id){
                if current.is_ok()&&document.meta["state"]!="clean"{document.meta["state"]=json!("conflict");}
            }
            state.notify_project("horizon.document.v1",document_id,0,"invalidate",Some(&owner));
        }
    }).map_err(|e|HostError::new("IO_ERROR",format!("无法监听目录：{e}")))?;
    watcher.watch(&root,RecursiveMode::Recursive).map_err(|e|HostError::new("IO_ERROR",format!("无法监听目录：{e}")))?;
    watchers.insert(project.to_owned(),watcher);Ok(())
}
