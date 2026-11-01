use crate::{protocol::{allowed,revision,string},state::{default_session,digest,id},Call,HostError,HostState};
use serde_json::{json,Value};
use std::sync::Arc;

fn check_version(item:&Value,params:&Value)->Result<(),HostError>{if item["revision"].as_u64()!=Some(revision(params,"expectedRevision")?){Err(HostError::new("STALE_VERSION","内容已变化，请刷新"))}else{Ok(())}}
fn name(params:&Value)->Result<&str,HostError>{let value=string(params,"name")?.trim();if value.is_empty()||value.len()>256{return Err(HostError::new("INVALID_ARGUMENT","名称应为1到256个字符"));}Ok(value)}

fn inaccessible_project(state:&HostState,project_id:&str,error:std::io::Error)->Result<HostError,HostError>{
    let(code,message)=match error.kind(){
        std::io::ErrorKind::PermissionDenied=>("PERMISSION_DENIED","没有读取这个项目目录的权限。检查文件夹权限后重试，或重新选择可访问的目录。"),
        std::io::ErrorKind::NotFound=>("NOT_FOUND","项目目录已不存在或磁盘未连接。连接磁盘后重试，或重新定位已移动的目录。"),
        std::io::ErrorKind::NotADirectory=>("INVALID_ARGUMENT","项目路径已不再是文件夹，请重新定位项目目录。"),
        _=>("IO_ERROR","暂时无法读取项目目录。检查磁盘状态后重试，或重新定位目录。"),
    };
    let revision={let mut reg=state.registry.lock().unwrap();let project=reg.projects.iter_mut().find(|p|p["id"]==project_id).ok_or_else(||HostError::new("NOT_FOUND","项目不存在"))?;project["state"]=json!("unavailable");project["accessError"]=json!({"code":code,"message":message});project["revision"].as_u64().unwrap_or(1)};
    state.persist()?;state.notify("horizon.project.v1",project_id,revision,"upsert");
    Ok(HostError::new(code,message).details(json!({"kind":"projectDirectory","projectId":project_id,"cause":error.to_string()})))
}

pub fn dispatch(state:Arc<HostState>,call:Call)->Result<Value,HostError>{
    let p=&call.params;
    match call.method.as_str(){
        "resource_list"=>{allowed(p,&["projectId"])?;if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","资源概览需应用作用域"));}let project=p["projectId"].as_str();if let Some(project)=project{state.project_root(project)?;}Ok(json!({"items":resources(project)}))}
        "project_reveal"=>{
            allowed(p,&["projectId"])?;if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","显示项目目录需应用作用域"));}
            let root=state.project_root(string(p,"projectId")?)?;if !std::fs::metadata(&root)?.is_dir(){return Err(HostError::new("INVALID_ARGUMENT","项目路径不是目录，请重新定位"));}
            #[cfg(target_os="macos")]{let status=std::process::Command::new("/usr/bin/open").arg("-R").arg(&root).status()?;if !status.success(){return Err(HostError::new("IO_ERROR","在Finder中显示项目目录失败"));}Ok(json!({"opened":true}))}
            #[cfg(windows)] {
                tauri_plugin_opener::reveal_item_in_dir(&root)
                    .map_err(|error| HostError::new("IO_ERROR", format!("在资源管理器中显示项目目录失败：{error}")))?;
                Ok(json!({"opened":true}))
            }
            #[cfg(not(any(target_os="macos", windows)))]{Err(HostError::new("PLATFORM_UNSUPPORTED","当前平台暂不支持显示项目目录"))}
        }
        "app_bootstrap"=>{
            allowed(p,&["clientVersion","protocolVersion"])?;
            if p["protocolVersion"]!=1{return Err(HostError::new("PROTOCOL_UNSUPPORTED","协议版本不受支持"));}
            let reg=state.registry.lock().unwrap();
            let mut services=vec!["kernel","projects","files","recovery","settings","extensions","appearance"];
            for (extension,service) in [("horizon.files","explorer"),("horizon.editor","editor"),("horizon.search","search"),("horizon.git","git"),("horizon.terminal","terminal"),("horizon.launch","launch"),("horizon.agent","agent")]{if crate::extensions::extension_gate(&state,extension,None).is_ok(){services.push(service);}}
            let active=reg.sessions.get("__app").cloned().unwrap_or(json!({}));
            Ok(json!({"protocolVersion":1,"schemaHash":"horizon-v1-0.4.0","workspaces":reg.workspaces,"projects":reg.projects,"availableServices":services,"activeProjectId":active["activeProjectId"],"activeWorkspaceId":active["activeWorkspaceId"]}))
        }
        "workspace_create"=>{allowed(p,&["name"])?;let workspace=json!({"id":id(),"name":name(p)?,"projectIds":[],"revision":1});state.registry.lock().unwrap().workspaces.push(workspace.clone());state.persist()?;state.notify("horizon.project.v1",workspace["id"].as_str().unwrap(),1,"upsert");Ok(workspace)}
        "workspace_activate"=>{
            allowed(p,&["workspaceId"])?;if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","切换工作区需应用作用域"));}let workspace_id=string(p,"workspaceId")?;
            let mut reg=state.registry.lock().unwrap();let workspace=reg.workspaces.iter().find(|w|w["id"]==workspace_id).ok_or_else(||HostError::new("NOT_FOUND","工作区不存在"))?;
            let mut active=reg.sessions.get("__app").cloned().unwrap_or(json!({}));let remembered=active["workspaceProjects"][workspace_id].clone();let candidates=workspace["projectIds"].as_array().unwrap();let project=if candidates.contains(&remembered){remembered}else{candidates.first().cloned().unwrap_or(Value::Null)};
            for item in &mut reg.projects{if item["state"]=="active"{item["state"]=json!("idle");}}
            active["activeWorkspaceId"]=json!(workspace_id);active["activeProjectId"]=project.clone();reg.sessions.insert("__app".into(),active);drop(reg);state.persist()?;
            Ok(json!({"workspaceId":workspace_id,"activeProjectId":project}))
        }
        "workspace_update"=>{
            allowed(p,&["workspaceId","expectedRevision","name","projectOrder"])?;let workspace_id=string(p,"workspaceId")?;let mut reg=state.registry.lock().unwrap();let workspace=reg.workspaces.iter_mut().find(|w|w["id"]==workspace_id).ok_or_else(||HostError::new("NOT_FOUND","工作区不存在"))?;check_version(workspace,p)?;
            if p.get("name").is_some(){workspace["name"]=json!(name(p)?);}
            if let Some(order)=p.get("projectOrder"){
                let old=workspace["projectIds"].as_array().unwrap();let order=order.as_array().ok_or_else(||HostError::new("INVALID_ARGUMENT","项目排序必须是数组"))?;
                let unique:std::collections::HashSet<_>=order.iter().filter_map(Value::as_str).collect();if order.len()!=old.len()||unique.len()!=old.len()||old.iter().any(|item|!order.contains(item)){return Err(HostError::new("INVALID_ARGUMENT","项目排序必须包含原工作区的全部项目"));}
                workspace["projectIds"]=json!(order);
            }
            workspace["revision"]=json!(workspace["revision"].as_u64().unwrap()+1);let result=workspace.clone();drop(reg);state.persist()?;Ok(result)
        }
        "workspace_remove"=>{
            allowed(p,&["workspaceId","expectedRevision","moveToWorkspaceId"])?;let workspace_id=string(p,"workspaceId")?;let target=string(p,"moveToWorkspaceId")?;let mut reg=state.registry.lock().unwrap();
            if workspace_id==reg.default_workspace_id{return Err(HostError::new("PERMISSION_DENIED","默认工作区不能移除"));}
            let workspace=reg.workspaces.iter().find(|w|w["id"]==workspace_id).ok_or_else(||HostError::new("NOT_FOUND","工作区不存在"))?;check_version(workspace,p)?;let moved=workspace["projectIds"].clone();
            if workspace_id==target||!reg.workspaces.iter().any(|w|w["id"]==target){return Err(HostError::new("INVALID_ARGUMENT","目标工作区无效"));}
            reg.workspaces.retain(|w|w["id"]!=workspace_id);
            for w in &mut reg.workspaces{if w["id"]==target{w["projectIds"].as_array_mut().unwrap().extend(moved.as_array().unwrap().iter().cloned());w["revision"]=json!(w["revision"].as_u64().unwrap()+1);}}
            for project in &mut reg.projects{if project["workspaceId"]==workspace_id{project["workspaceId"]=json!(target);project["revision"]=json!(project["revision"].as_u64().unwrap()+1);}}
            if let Some(active)=reg.sessions.get_mut("__app"){if active["activeWorkspaceId"]==workspace_id{active["activeWorkspaceId"]=json!(target);}if let Some(remembered)=active["workspaceProjects"].as_object_mut(){let previous=remembered.remove(workspace_id);if let Some(previous)=previous{remembered.entry(target).or_insert(previous);}}}
            drop(reg);state.persist()?;Ok(json!({"removedId":workspace_id,"movedProjects":moved}))
        }
        "project_register"=>{allowed(p,&["selectionToken","workspaceId","displayName"])?;let path=state.resolve_selection(string(p,"selectionToken")?)?;state.register_project(path,Some(string(p,"workspaceId")?),p["displayName"].as_str())}
        "project_relocate"=>{
            allowed(p,&["projectId","selectionToken","expectedRevision"])?;let project_id=string(p,"projectId")?;let old_root=state.project_root(project_id)?;let new_root=state.resolve_selection(string(p,"selectionToken")?)?.canonicalize()?;std::fs::read_dir(&new_root)?;let encoded=crate::state::native_encode(&new_root);
            let mut reg=state.registry.lock().unwrap();let project=reg.projects.iter().find(|p|p["id"]==project_id).ok_or_else(||HostError::new("NOT_FOUND","项目不存在"))?;check_version(project,p)?;
            if reg.roots.iter().any(|(id,path)|id!=project_id&&*path==encoded){return Err(HostError::new("RESOURCE_BUSY","此目录已登记为另一个项目"));}
            reg.roots.insert(project_id.into(),encoded);let mut index=state.path_index.lock().unwrap();for(file_id,record)in reg.paths.iter_mut(){if record.0==project_id{let old=crate::state::native_decode(&record.1)?;if let Ok(relative)=old.strip_prefix(&old_root){index.remove(record);let new=if relative.as_os_str().is_empty(){new_root.clone()}else{new_root.join(relative)};record.1=crate::state::native_encode(&new);index.insert(record.clone(),file_id.clone());}}}drop(index);
            let project=reg.projects.iter_mut().find(|p|p["id"]==project_id).unwrap();project["rootDisplayPath"]=json!(new_root.to_string_lossy());project["state"]=json!("registered");project.as_object_mut().unwrap().remove("accessError");project["revision"]=json!(project["revision"].as_u64().unwrap()+1);let result=project.clone();drop(reg);state.watchers.lock().unwrap().remove(project_id);state.invalidate_project_scope(project_id);state.persist()?;state.notify("horizon.project.v1",project_id,result["revision"].as_u64().unwrap(),"upsert");Ok(result)
        }
        "project_update"=>{
            allowed(p,&["projectId","expectedRevision","displayName","pinned","workspaceId"])?;let project_id=string(p,"projectId")?;let mut reg=state.registry.lock().unwrap();
            if let Some(target)=p["workspaceId"].as_str(){if !reg.workspaces.iter().any(|w|w["id"]==target){return Err(HostError::new("NOT_FOUND","目标工作区不存在"));}}
            let project=reg.projects.iter_mut().find(|w|w["id"]==project_id).ok_or_else(||HostError::new("NOT_FOUND","项目不存在"))?;check_version(project,p)?;let previous=project["workspaceId"].clone();
            for field in ["displayName","pinned","workspaceId"]{if let Some(value)=p.get(field){if field=="pinned"&&!value.is_boolean(){return Err(HostError::new("INVALID_ARGUMENT","pinned必须为布尔值"));}if field!="pinned"&&value.as_str().is_none_or(|s|s.trim().is_empty()){return Err(HostError::new("INVALID_ARGUMENT","项目字段不可为空"));}project[field]=value.clone();}}
            project["revision"]=json!(project["revision"].as_u64().unwrap()+1);let result=project.clone();
            if previous!=result["workspaceId"]{for workspace in &mut reg.workspaces{if workspace["id"]==previous{workspace["projectIds"].as_array_mut().unwrap().retain(|id|*id!=project_id);workspace["revision"]=json!(workspace["revision"].as_u64().unwrap()+1);}if workspace["id"]==result["workspaceId"]{workspace["projectIds"].as_array_mut().unwrap().push(json!(project_id));workspace["revision"]=json!(workspace["revision"].as_u64().unwrap()+1);}}}
            if let Some(active)=reg.sessions.get_mut("__app"){if active["activeProjectId"]==project_id{active["activeWorkspaceId"]=result["workspaceId"].clone();let target=result["workspaceId"].as_str().unwrap();active["workspaceProjects"][target]=json!(project_id);}if let Some(previous)=previous.as_str(){if previous!=result["workspaceId"].as_str().unwrap()&&active["workspaceProjects"][previous]==project_id{active["workspaceProjects"].as_object_mut().unwrap().remove(previous);}}}
            drop(reg);state.persist()?;Ok(result)
        }
        "project_activate"=>{
            allowed(p,&["projectId"])?;let project_id=string(p,"projectId")?;let root=state.project_root(project_id)?;if let Err(error)=std::fs::read_dir(&root){return Err(inaccessible_project(&state,project_id,error)?);}
            let epoch={let mut epochs=state.epochs.lock().unwrap();let e=epochs.entry(project_id.into()).or_insert(0);*e+=1;*e};
            state.last_activity.lock().unwrap().insert(project_id.into(),std::time::Instant::now());
            let mut reg=state.registry.lock().unwrap();for project in &mut reg.projects{if project["state"]=="active"{project["state"]=json!("idle");}}
            let project=reg.projects.iter_mut().find(|p|p["id"]==project_id).ok_or_else(||HostError::new("NOT_FOUND","项目不存在"))?;project["state"]=json!("active");project.as_object_mut().unwrap().remove("accessError");project["lastOpenedAt"]=json!(crate::state::now());let project=project.clone();
            let session=reg.sessions.entry(project_id.into()).or_insert_with(default_session).clone();let active=reg.sessions.entry("__app".into()).or_insert(json!({}));active["activeProjectId"]=json!(project_id);active["activeWorkspaceId"]=project["workspaceId"].clone();active["workspaceProjects"][project["workspaceId"].as_str().unwrap()]=json!(project_id);drop(reg);state.persist()?;
            Ok(json!({"project":project,"projectEpoch":epoch,"session":session}))
        }
        "session_get"|"project_session_get"=>{allowed(p,&[])?;let project=call.project_id()?;let reg=state.registry.lock().unwrap();Ok(reg.sessions.get(project).cloned().unwrap_or_else(default_session))}
        "session_update"|"project_session_patch"=>{
            allowed(p,&["expectedRevision","tabs","activeFileId","expandedEntryIds","searchDraft","commitDraft","layout"])?;let project=call.project_id()?;
            if let Some(tabs)=p.get("tabs"){let tabs=tabs.as_array().ok_or_else(||HostError::new("INVALID_ARGUMENT","tabs必须为数组"))?;if tabs.len()>100{return Err(HostError::new("RESOURCE_LIMIT","标签数超过限制"));}
                // Persist references even while a volume is disconnected or a root
                // has moved. File access still performs the full containment check.
                let reg=state.registry.lock().unwrap();for tab in tabs{let file_id=string(tab,"fileId")?;let(owner,_)=reg.paths.get(file_id).ok_or_else(||HostError::new("NOT_FOUND","文件标识已失效，请刷新目录"))?;if owner!=project{return Err(HostError::new("PERMISSION_DENIED","文件不属于当前项目"));}}
            }
            let mut reg=state.registry.lock().unwrap();let session=reg.sessions.entry(project.into()).or_insert_with(default_session);
            if p.get("expectedRevision").is_some()&&p["expectedRevision"]!=session["revision"]{return Err(HostError::new("STALE_VERSION","项目会话已更新"));}
            for key in ["tabs","activeFileId","expandedEntryIds","searchDraft","commitDraft","layout"]{if let Some(value)=p.get(key){session[key]=value.clone();}}
            session["revision"]=json!(session["revision"].as_u64().unwrap()+1);let result=session.clone();drop(reg);state.persist()?;Ok(result)
        }
        "project_close_plan"|"app_exit_plan"=>{
            let app=call.method=="app_exit_plan";allowed(p,if app{&[]}else{&["projectId","action"]})?;
            let project=if app{None}else{Some(string(p,"projectId")?)};
            if !app&&!["sleep","remove"].contains(&string(p,"action")?){return Err(HostError::new("INVALID_ARGUMENT","未知项目操作"));}
            let dirty=state.dirty_documents(project);let resources=resources(project);
            let project_revision=project.and_then(|id|state.registry.lock().unwrap().projects.iter().find(|p|p["id"]==id).map(|p|p["revision"].clone()));
            let plan_id=id();let plan=json!({"planId":plan_id,"digest":digest(format!("{}:{:?}:{:?}",plan_id,dirty,resources)),"scope":if let Some(p)=project{json!({"kind":"project","projectId":p})}else{json!({"kind":"app"})},"expiresAt":(chrono::Utc::now()+chrono::Duration::minutes(5)).to_rfc3339(),"resources":resources,"dirtyDocuments":dirty.iter().map(|d|d["documentId"].clone()).collect::<Vec<_>>(),"dependentExtensions":[],"kind":if app{"exit"}else{"projectClose"},"action":p["action"],"documents":dirty,"projectRevision":project_revision});
            state.plans.lock().unwrap().insert(plan_id,plan.clone());Ok(plan)
        }
        _=>Err(HostError::new("NOT_FOUND","未知项目方法")),
    }
}

pub fn resources(project:Option<&str>)->Vec<Value>{
    let mut values=vec![];
    for group in [crate::processes::resources(project),crate::agent::resources(project)]{
        if let Some(items)=group.as_array(){values.extend(items.iter().cloned());}else if let Some(items)=group["items"].as_array(){values.extend(items.iter().cloned());}else if let Some(items)=group["resources"].as_array(){values.extend(items.iter().cloned());}
    }
    values.extend(crate::git::resource_snapshot(project));values.extend(crate::search::resources(project));values.extend(crate::extension_host::resources(project));values.extend(crate::picker::resources(project));
    for resource in &mut values{if resource["resourceId"].is_null(){resource["resourceId"]=resource["id"].clone();}if resource["kind"].is_null(){resource["kind"]=resource["type"].clone();}if resource["actions"].is_null(){resource["actions"]=json!(["stop"]);}}
    values
}

pub fn validate_close_decisions(plan:&Value,decisions:&[Value])->Result<(),HostError>{
    let mut seen=std::collections::HashSet::new();
    for decision in decisions{
        allowed(decision,&["resourceId","action","checkpointId","exportReceiptId"])?;let resource=string(decision,"resourceId")?;let action=string(decision,"action")?;
        if !seen.insert(resource){return Err(HostError::new("INVALID_ARGUMENT","同一资源只能选择一个关闭动作"));}
        if plan["documents"].as_array().is_some_and(|items|items.iter().any(|item|item["documentId"]==resource)){
            if !["save","discard","retainCheckpoint","export"].contains(&action){return Err(HostError::new("INVALID_ARGUMENT","文档关闭决策无效"));}
        }else if let Some(item)=plan["resources"].as_array().and_then(|items|items.iter().find(|item|item["resourceId"]==resource)){
            if !item["actions"].as_array().is_some_and(|actions|actions.contains(&json!(action))){return Err(HostError::new("INVALID_ARGUMENT","资源不支持此关闭动作"));}
        }else{return Err(HostError::new("PERMISSION_DENIED","关闭决策包含计划之外的资源"));}
    }
    Ok(())
}
