pub mod agent;
pub mod appearance;
pub mod extensions;
pub mod extension_host;
pub mod files;
pub mod git;
mod macos;
pub mod picker;
pub mod processes;
#[cfg(windows)]
mod windows_process;
pub mod projects;
pub mod protocol;
pub mod search;
pub mod settings;
pub mod state;
pub mod watch;

pub use protocol::{Call,HostError};
pub use state::HostState;
use protocol::{allowed,reply,string};
use serde_json::{json,Value};
use std::{collections::VecDeque,sync::{atomic::{AtomicBool,Ordering},Arc}};
use tauri::{ipc::Channel,AppHandle,Emitter,Manager,WebviewWindow};

fn is_write(method:&str)->bool{
    matches!(method,"workspace_create"|"workspace_update"|"workspace_remove"|"project_register"|"project_update"|"project_close_apply"|"file_create"|"file_rename"|"file_trash"|"document_mark_dirty"|"document_checkpoint"|"document_reload"|"document_save"|"document_save_as"|"document_relocate_apply"|"document_close"|"settings_patch"|"credential_set"|"credential_remove"|"recovery_export"|"data_export"|"data_clear_apply"|"git_mutate"|"git_clone"|"app_exit_apply")
        || method.starts_with("extension_")&&["apply","enable","override","resume","restore","activate","set_policy"].iter().any(|suffix|method.ends_with(suffix))
        || method.starts_with("appearance_")&&["patch","apply","import","remove","save","delete","export"].iter().any(|suffix|method.ends_with(suffix))
        || method.starts_with("launch_")&&["save","delete","start","stop","restart"].iter().any(|suffix|method.ends_with(suffix))
        || method.starts_with("agent_")&&["save","create","submit","close","install","uninstall"].iter().any(|suffix|method.ends_with(suffix))
        || ["workspace_activate","project_activate","session_update","project_session_patch","data_export_discard","review_apply","review_editor_result","review_discard","agent_connection_remove","agent_interaction_answer","git_conflict_resolve","git_clone_cleanup","document_proposal_result","recovery_resolve","project_relocate","terminal_create","terminal_stop","process_stop","launch_profile_export"].contains(&method)
}
fn gate(state:&HostState,call:&Call)->Result<(),HostError>{
    let extension=if call.method.starts_with("git_"){Some("horizon.git")}
        else if call.method.starts_with("terminal_"){Some("horizon.terminal")}
        else if call.method.starts_with("launch_"){Some("horizon.launch")}
        else if call.method.starts_with("agent_")||call.method.starts_with("review_"){Some("horizon.agent")}
        else if ["directory_list","path_query"].contains(&call.method.as_str()){Some("horizon.files")}
        else if call.method.starts_with("search_"){Some("horizon.search")}
        else if ["document_open","document_reload","document_close","document_relocate_prepare","document_relocate_apply"].contains(&call.method.as_str()){Some("horizon.editor")}
        else{None};
    if let Some(extension)=extension{extensions::extension_gate(state,extension,call.scope["projectId"].as_str())?;}Ok(())
}
fn validate(state:&HostState,window:&WebviewWindow,call:&Call)->Result<(),HostError>{
    if window.label()!="main"{return Err(HostError::new("PERMISSION_DENIED","此窗口没有宿主权限"));}
    state.validate_scope(call)?;
    if is_write(&call.method)&&call.idempotency_key.as_ref().is_none_or(|k|k.is_empty()||k.len()>128){return Err(HostError::new("INVALID_ARGUMENT","写操作缺少 idempotencyKey"));}
    gate(state,call)
}
fn call_digest(call:&Call)->String{state::digest(serde_json::to_vec(&json!({"method":call.method,"scope":call.scope,"params":call.params})).unwrap())}
fn cached(state:&HostState,call:&Call)->Result<Option<Value>,HostError>{
    let Some(key)=&call.idempotency_key else{return Ok(None)};let mut cache=state.idempotency.lock().unwrap();cache.retain(|_,item|item.at.elapsed().as_secs()<600);
    if let Some(item)=cache.get(key){if item.digest!=call_digest(call){return Err(HostError::new("INVALID_ARGUMENT","同一幂等键不可用于不同操作"));}return Ok(Some(item.result.clone()));}Ok(None)
}
fn cache(state:&HostState,call:&Call,result:&Value){if let Some(key)=&call.idempotency_key{let mut cache=state.idempotency.lock().unwrap();cache.retain(|_,record|record.at.elapsed().as_secs()<600);let bytes=serde_json::to_vec(result).map_or(0,|bytes|bytes.len());cache.insert(key.clone(),state::IdempotencyRecord{digest:call_digest(call),result:result.clone(),bytes,at:std::time::Instant::now()});while cache.len()>2048||cache.values().map(|record|record.bytes).sum::<usize>()>8*1024*1024{let oldest=cache.iter().filter(|(id,_)|*id!=key).min_by_key(|(_,record)|record.at).map(|(id,_)|id.clone());if let Some(oldest)=oldest{cache.remove(&oldest);}else{break;}}}}

#[tauri::command]
async fn horizon_call(app:AppHandle,window:WebviewWindow,call:Call)->Value{
    let request_id=call.request_id.clone();let state=app.state::<Arc<HostState>>().inner().clone();
    let result=async{
        validate(&state,&window,&call)?;
        let _serial=if is_write(&call.method){Some(state.write_lock.lock().await)}else{None};
        if is_write(&call.method){validate(&state,&window,&call)?;}
        if is_write(&call.method){if let Some(data)=cached(&state,&call)?{return Ok(data);}}
        let result=dispatch(state.clone(),app,call.clone(),None).await?;if is_write(&call.method){cache(&state,&call,&result);}Ok(result)
    }.await;reply(&request_id,result)
}

#[tauri::command]
async fn horizon_start(app:AppHandle,window:WebviewWindow,call:Call,channel:Channel<Value>)->Value{
    let request_id=call.request_id.clone();let state=app.state::<Arc<HostState>>().inner().clone();
    let accepted=async{
        validate(&state,&window,&call)?;
        let _serial=state.write_lock.lock().await;
        validate(&state,&window,&call)?;
        if let Some(data)=cached(&state,&call)?{return Ok(data);}
        state.trim_task_cache();
        let task_id=state::id();
        {let mut tasks=state.tasks.lock().unwrap();tasks.retain(|_,t|t.terminal.is_none()||t.updated.elapsed().as_secs()<600);if tasks.values().filter(|t|t.terminal.is_none()).count()>=32{return Err(HostError::new("RESOURCE_LIMIT","并发任务数量已达上限"));}
            if tasks.values().any(|t|t.call.request_id==call.request_id){return Err(HostError::new("INVALID_ARGUMENT","requestId 已存在"));}
            tasks.insert(task_id.clone(),state::TaskRecord{id:task_id.clone(),call:call.clone(),state:"queued".into(),cancelled:false,seq:0,ack:0,events:VecDeque::new(),ring_bytes:0,channel:Some(channel),terminal:None,updated:std::time::Instant::now()});}
        let accepted=json!({"taskId":task_id,"requestId":call.request_id,"state":"queued","cancelMode":"cooperative"});cache(&state,&call,&accepted);
        let task_state=state.clone();tauri::async_runtime::spawn(async move{
            if task_state.is_cancelled(&call.request_id){let _=task_state.emit_task(&call.request_id,json!({"type":"terminal","state":"cancelled","effect":"none"}));return;}
            let _=task_state.emit_task(&call.request_id,json!({"type":"started"}));
            let result=dispatch(task_state.clone(),app,call.clone(),None).await;
            let payload=match result{
                Ok(result)=>{if task_state.is_cancelled(&call.request_id)&&!is_write(&call.method){json!({"type":"terminal","state":"cancelled","partialResult":result,"effect":"none"})}else{let partial=result["perFile"].as_array().is_some_and(|items|items.iter().any(|item|item["state"]=="failed"))||result["failed"].as_array().is_some_and(|items|!items.is_empty());json!({"type":"terminal","state":"succeeded","effect":if partial{"partial"}else if is_write(&call.method){"applied"}else{"none"},"result":result})}},
                Err(error)if error.code=="CANCELLED"=>json!({"type":"terminal","state":"cancelled","effect":if is_write(&call.method){"partial"}else{"none"}}),
                Err(error)=>{let effect=error.details.as_ref().and_then(|details|details["effect"].as_str()).filter(|effect|["none","partial","applied","unknown"].contains(effect)).unwrap_or(if error.code=="OUTCOME_UNKNOWN"{"unknown"}else{"none"});json!({"type":"terminal","state":"failed","effect":effect,"error":error})},
            };let _=task_state.emit_task(&call.request_id,payload);
        });Ok(accepted)
    }.await;reply(&request_id,accepted)
}

fn task_snapshot(task:&state::TaskRecord)->Value{let mut value=json!({"taskId":task.id,"requestId":task.call.request_id,"method":task.call.method,"scope":task.call.scope,"state":task.state,"cancelRequested":task.cancelled,"lastSeq":task.seq});if let Some(terminal)=&task.terminal{value["terminal"]=terminal.clone();}value}
fn task_scope(call:&Call,task:&state::TaskRecord)->Result<(),HostError>{if call.scope["kind"]=="project"&&call.scope["projectId"]!=task.call.scope["projectId"]{return Err(HostError::new("PERMISSION_DENIED","任务属于其他项目"));}Ok(())}

#[tauri::command]
async fn horizon_subscribe(app:AppHandle,window:WebviewWindow,call:Call,channel:Channel<Value>)->Value{
    let request_id=call.request_id.clone();let state=app.state::<Arc<HostState>>().inner().clone();
    let result=async{
        validate(&state,&window,&call)?;
        if call.method=="task_attach"{
            allowed(&call.params,&["taskId","afterSeq"])?;let mut tasks=state.tasks.lock().unwrap();let task=tasks.get_mut(string(&call.params,"taskId")?).ok_or_else(||HostError::new("NOT_FOUND","任务不存在或已过期"))?;task_scope(&call,task)?;
            let after=call.params["afterSeq"].as_u64().ok_or_else(||HostError::new("INVALID_ARGUMENT","缺少afterSeq"))?;if after>task.seq{return Err(HostError::new("INVALID_ARGUMENT","游标超过任务序列"));}
            let first=task.events.front().and_then(|e|e["seq"].as_u64()).unwrap_or(task.seq+1);let reset=after+1<first;
            if !reset{for event in task.events.iter().filter(|e|e["seq"].as_u64().unwrap()>after){channel.send(event.clone()).map_err(|e|HostError::new("IO_ERROR",e.to_string()))?;}}
            task.channel=Some(channel);task.ack=after;return Ok(json!({"subscriptionId":state::id(),"task":task_snapshot(task),"resetRequired":reset,"nextSeq":task.seq+1}));
        }
        if call.method!="service_subscribe"{return dispatch(state,app,call,Some(channel)).await;}
        allowed(&call.params,&["topics"])?;let topics=call.params["topics"].as_array().ok_or_else(||HostError::new("INVALID_ARGUMENT","topics必须为数组"))?;
        let supported=["horizon.project.v1","horizon.files.v1","horizon.document.v1","horizon.git.v1","horizon.agent.v1","horizon.extension.v1","horizon.launch.v1","horizon.process.v1","horizon.settings.v1"];
        let topics:Vec<String>=topics.iter().map(|t|t.as_str().filter(|s|supported.contains(s)).map(str::to_owned).ok_or_else(||HostError::new("INVALID_ARGUMENT","未知订阅主题"))).collect::<Result<_,_>>()?;
        for topic in &topics{let owner=match topic.as_str(){"horizon.git.v1"=>Some("horizon.git"),"horizon.agent.v1"=>Some("horizon.agent"),"horizon.launch.v1"=>Some("horizon.launch"),_=>None};if let Some(owner)=owner{extensions::extension_gate(&state,owner,call.scope["projectId"].as_str())?;}}
        let subscription_id=state::id();let mut subscriptions=state.subscriptions.lock().unwrap();
        if subscriptions.len()>=128{return Err(HostError::new("RESOURCE_LIMIT","订阅数量超过上限"));}
        let reg=state.registry.lock().unwrap();let snapshots:Vec<_>=topics.iter().map(|topic|json!({"topic":topic,"entityId":call.scope["projectId"].as_str().unwrap_or("app"),"revision":reg.revision,"data":if topic=="horizon.project.v1"{json!({"projects":reg.projects,"workspaces":reg.workspaces})}else{json!({})}})).collect();drop(reg);
        subscriptions.insert(subscription_id.clone(),state::Subscription{request_id:call.request_id.clone(),scope:call.scope.clone(),topics,channel,seq:0});Ok(json!({"subscriptionId":subscription_id,"snapshots":snapshots}))
    }.await;reply(&request_id,result)
}

pub async fn dispatch(state:Arc<HostState>,app:AppHandle,call:Call,channel:Option<Channel<Value>>)->Result<Value,HostError>{
    match call.method.as_str(){
        "task_get"|"task_cancel"|"stream_ack"|"task_detach"=>{
            allowed(&call.params,if call.method=="stream_ack"{&["taskId","throughSeq"]}else{&["taskId"]})?;
            let mut tasks=state.tasks.lock().unwrap();let task=tasks.get_mut(string(&call.params,"taskId")?).ok_or_else(||HostError::new("NOT_FOUND","任务不存在或已过期"))?;task_scope(&call,task)?;
            match call.method.as_str(){
                "task_get"=>Ok(task_snapshot(task)),
                "task_cancel"=>{let terminal=task.terminal.is_some();if !terminal{task.cancelled=true;}Ok(json!({"taskId":task.id,"cancelRequested":task.cancelled,"alreadyTerminal":terminal}))},
                "stream_ack"=>{let seq=call.params["throughSeq"].as_u64().ok_or_else(||HostError::new("INVALID_ARGUMENT","缺少throughSeq"))?;if seq>task.seq{return Err(HostError::new("INVALID_ARGUMENT","ack超过已发送序号"));}if task.channel.is_none(){return Err(HostError::new("PERMISSION_DENIED","任务没有活跃消费者"));}task.ack=task.ack.max(seq);Ok(json!({"acceptedThroughSeq":task.ack}))},
                _=>{task.channel=None;Ok(json!({"detached":true,"taskContinues":task.terminal.is_none()}))},
            }
        }
        "subscription_close"=>{allowed(&call.params,&["subscriptionId"])?;state.subscriptions.lock().unwrap().remove(string(&call.params,"subscriptionId")?);Ok(json!({"closed":true}))}
        "url_open_external"=>{allowed(&call.params,&["url"])?;let url=string(&call.params,"url")?;if url.len()>8192{return Err(HostError::new("INVALID_ARGUMENT","链接过长"));}let parsed=reqwest::Url::parse(url).map_err(|_|HostError::new("INVALID_ARGUMENT","链接无效"))?;if !["https","http","mailto"].contains(&parsed.scheme()){return Err(HostError::new("PERMISSION_DENIED","只允许HTTP、HTTPS或邮件链接"));}#[cfg(windows)] {
                let target = url.to_owned();
                tauri::async_runtime::spawn_blocking(move || tauri_plugin_opener::open_url(target, None::<&str>))
                    .await.map_err(|error| HostError::new("IO_ERROR", error.to_string()))?
                    .map_err(|error| HostError::new("IO_ERROR", format!("系统打开链接失败：{error}")))?;
            }
            #[cfg(not(windows))] {
                let status=tokio::process::Command::new("/usr/bin/open").arg(url).status().await?;if !status.success(){return Err(HostError::new("IO_ERROR","系统打开链接失败"));}
            }
            Ok(json!({"opened":true}))}
        "project_pick_directory"=>{allowed(&call.params,&[])?;let path=picker::pick(&app,&call,picker::Request::folder()).await?;match path{Some(path)=>{let display=path.to_string_lossy().into_owned();Ok(json!({"selectionToken":state.register_selection(path),"displayPath":display}))},None=>Ok(json!({"selectionToken":null}))}}
        "settings_pick_git"=>{allowed(&call.params,&[])?;let selected=picker::pick(&app,&call,picker::Request::file().title("选择 Git 可执行文件")).await?;let path=selected.map(|path|path.to_string_lossy().into_owned());Ok(json!({"path":path}))}
        "document_relocate_prepare"=>files::relocate_prepare(state,app,call).await,
        "app_exit_apply"|"project_close_apply"=>close_apply(state,app,call).await,
        method if method.starts_with("extension_runtime_")=>extension_host::dispatch(state,app,call,channel).await,
        method if method.starts_with("extension_")=>extensions::dispatch(state,app,call,channel).await,
        method if method.starts_with("appearance_")=>appearance::dispatch(state,app,call,channel).await,
        method if method.starts_with("git_")=>git::dispatch(state,app,call,channel).await,
        method if method.starts_with("terminal_")||method.starts_with("launch_")||method.starts_with("process_")=>processes::dispatch(state,app,call,channel).await,
        method if method.starts_with("agent_")||method.starts_with("review_")=>agent::dispatch(state,app,call,channel).await,
        method if method.starts_with("settings_")||method.starts_with("credential_")||method.starts_with("data_")=>tauri::async_runtime::spawn_blocking(move||settings::dispatch(state,call)).await.map_err(|e|HostError::new("IO_ERROR",e.to_string()))?,
        "search_start"=>search::start(state,call).await,
        method if method.starts_with("search_")||method=="path_query"=>tauri::async_runtime::spawn_blocking(move||search::dispatch(state,call)).await.map_err(|e|HostError::new("IO_ERROR",e.to_string()))?,
        method if method.starts_with("file_")||method.starts_with("document_")||method.starts_with("recovery_")||method=="directory_list"||method=="image_read"=>tauri::async_runtime::spawn_blocking(move||files::dispatch(state,call)).await.map_err(|e|HostError::new("IO_ERROR",e.to_string()))?,
        _=>tauri::async_runtime::spawn_blocking(move||projects::dispatch(state,call)).await.map_err(|e|HostError::new("IO_ERROR",e.to_string()))?,
    }
}

async fn close_apply(state:Arc<HostState>,app:AppHandle,call:Call)->Result<Value,HostError>{
    allowed(&call.params,&["planId","planDigest","decisions"])?;let plan=state.plans.lock().unwrap().get(string(&call.params,"planId")?).cloned().ok_or_else(||HostError::new("STALE_VERSION","关闭计划已过期"))?;
    if plan["digest"]!=call.params["planDigest"]||plan["expiresAt"].as_str().unwrap_or("")<state::now().as_str(){return Err(HostError::new("STALE_VERSION","关闭计划已变化"));}
    let exit=call.method=="app_exit_apply";if (exit&&plan["kind"]!="exit")||(!exit&&plan["kind"]!="projectClose"){return Err(HostError::new("INVALID_ARGUMENT","关闭计划类型错误"));}
    let project=plan["scope"]["projectId"].as_str();let decisions=call.params["decisions"].as_array().ok_or_else(||HostError::new("INVALID_ARGUMENT","decisions必须为数组"))?;
    projects::validate_close_decisions(&plan,decisions)?;state.validate_document_decisions(decisions)?;
    if let Some(project)=project{let registry=state.registry.lock().unwrap();if !registry.projects.iter().any(|p|p["id"]==project&&p["revision"]==plan["projectRevision"]){return Err(HostError::new("STALE_VERSION","项目记录已变化，请重新确认"));}}
    let dirty=state.dirty_documents(project);for document in &dirty{let decision=decisions.iter().find(|d|d["resourceId"]==document["documentId"]).ok_or_else(||HostError::new("RESOURCE_BUSY","仍有未保存文档未处理"))?;if !["save","discard","retainCheckpoint","export"].contains(&decision["action"].as_str().unwrap_or("")){return Err(HostError::new("INVALID_ARGUMENT","文档关闭决策无效"));}}
    for document in &dirty{if !plan["documents"].as_array().unwrap().iter().any(|previous|previous["documentId"]==document["documentId"]&&previous["editorRevision"]==document["editorRevision"]){return Err(HostError::new("STALE_VERSION","文档在关闭确认后继续编辑"));}}
    for resource in projects::resources(project){if !decisions.iter().any(|d|d["resourceId"]==resource["resourceId"]&&["stop","detach"].contains(&d["action"].as_str().unwrap_or(""))){return Err(HostError::new("RESOURCE_BUSY","运行资源已变化，请重新确认关闭计划"));}}
    {let mut tasks=state.tasks.lock().unwrap();for task in tasks.values_mut(){if task.terminal.is_none()&&project.is_none_or(|p|task.call.scope["projectId"]==p){task.cancelled=true;}}}
    // Stop owned resources before allowing the native window to disappear.
    picker::stop_resources(project).await?;
    crate::agent::stop_extension("horizon.agent",project).await?;
    crate::git::stop_resources(project).await?;
    crate::search::stop_resources(project).await?;
    if exit{crate::extension_host::stop_all().await?;}else if let Some(project)=project{crate::extension_host::stop_project(project).await?;}
    let project_owned=project.map(str::to_owned);tauri::async_runtime::spawn_blocking(move||->Result<(),HostError>{crate::processes::stop_extension("horizon.terminal",project_owned.as_deref())?;crate::processes::stop_extension("horizon.launch",project_owned.as_deref())?;Ok(())}).await.map_err(|e|HostError::new("IO_ERROR",e.to_string()))??;
    let deadline=std::time::Instant::now()+std::time::Duration::from_secs(3);loop{let pending=state.tasks.lock().unwrap().values().any(|task|task.terminal.is_none()&&project.is_none_or(|project|task.call.scope["projectId"]==project));if !pending{break;}if std::time::Instant::now()>=deadline{return Err(HostError::new("RESOURCE_BUSY","仍有任务正在结束，请稍后重试"));}tokio::time::sleep(std::time::Duration::from_millis(20)).await;}
    for document in state.dirty_documents(project){if !plan["documents"].as_array().unwrap().iter().any(|previous|previous["documentId"]==document["documentId"]&&previous["editorRevision"]==document["editorRevision"]){return Err(HostError::new("STALE_VERSION","停止资源期间文档继续编辑，请重新确认"));}}
    state.resolve_document_decisions(decisions)?;
    if !state.dirty_documents(project).is_empty(){return Err(HostError::new("RESOURCE_BUSY","仍有未保存文档"));}
    state.persist()?;
    state.plans.lock().unwrap().remove(string(&call.params,"planId")?);
    if exit{state.allow_shutdown();app.exit(0);return Ok(json!({"closed":true}));}
    let project=project.ok_or_else(||HostError::new("INVALID_ARGUMENT","缺少项目"))?;extensions::sleep_project(&state,project).await?;state.release_project_resources(project)?;let remove=plan["action"]=="remove";let mut reg=state.registry.lock().unwrap();
    if remove{reg.projects.retain(|p|p["id"]!=project);reg.roots.remove(project);reg.sessions.remove(project);let paths=reg.paths.iter().filter(|(_,record)|record.0==project).map(|(id,_)|id.clone()).collect::<std::collections::HashSet<_>>();reg.paths.retain(|id,_|!paths.contains(id));reg.external_file_grants.retain(|id|!paths.contains(id));state.path_index.lock().unwrap().retain(|(owner,_),_|owner!=project);for workspace in &mut reg.workspaces{let ids=workspace["projectIds"].as_array_mut().unwrap();let before=ids.len();ids.retain(|id|*id!=project);if before!=ids.len(){workspace["revision"]=json!(workspace["revision"].as_u64().unwrap_or(0)+1);}}if let Some(active)=reg.sessions.get_mut("__app"){if active["activeProjectId"]==project{active["activeProjectId"]=Value::Null;}if let Some(remembered)=active["workspaceProjects"].as_object_mut(){remembered.retain(|_,id|*id!=project);}}}
    else if let Some(p)=reg.projects.iter_mut().find(|p|p["id"]==project){p["state"]=json!("sleeping");}
    if let Some(active)=reg.sessions.get_mut("__app"){if active["activeProjectId"]==project{active["activeProjectId"]=Value::Null;}}
    drop(reg);state.invalidate_project_scope(project);state.persist()?;Ok(json!({"state":if remove{"removed"}else{"sleeping"},"remainingResources":[]}))
}

static CLOSE_REQUESTED:AtomicBool=AtomicBool::new(false);
pub(crate) fn close_requested()->bool{CLOSE_REQUESTED.load(Ordering::SeqCst)}
pub(crate) fn request_close(app:&AppHandle){
    if CLOSE_REQUESTED.swap(true,Ordering::SeqCst){return;}
    let app=app.clone();
    tauri::async_runtime::spawn(async move{
        let _=picker::stop_resources(None).await;
        let state=app.state::<Arc<HostState>>();
        if let Some(window)=app.get_webview_window("main"){let _=window.show();let _=window.set_focus();}
        let _=app.emit("horizon:closeRequested",json!({"dirtyDocuments":state.dirty_documents(None),"resources":projects::resources(None)}));
        CLOSE_REQUESTED.store(false,Ordering::SeqCst);
    });
}

#[cfg(target_os = "macos")]
fn install_page_zoom_menu(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    use std::sync::atomic::AtomicU16;
    use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem};
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

    let menu = Menu::default(app)?;
    let view = menu.items()?.into_iter().find_map(|item| match item {
        MenuItemKind::Submenu(view) if view.text().ok().as_deref() == Some("View") => Some(view),
        _ => None,
    }).ok_or("Tauri default View menu is missing")?;
    let status = MenuItem::with_id(app, "horizon.zoom.status", "网页缩放：100%", false, None::<&str>)?;
    let zoom_in = MenuItem::with_id(app, "horizon.zoom.in", "放大", true, Some("CmdOrCtrl+Equal"))?;
    let zoom_out = MenuItem::with_id(app, "horizon.zoom.out", "缩小", true, Some("CmdOrCtrl+Minus"))?;
    let reset = MenuItem::with_id(app, "horizon.zoom.reset", "实际大小（100%）", true, Some("CmdOrCtrl+Digit0"))?;
    view.prepend_items(&[&status, &zoom_in, &zoom_out, &reset, &PredefinedMenuItem::separator(app)?])?;
    app.set_menu(menu)?;

    let percent = AtomicU16::new(100);
    app.on_menu_event(move |app, event| {
        let current = percent.load(Ordering::Relaxed);
        let next = match event.id().as_ref() {
            "horizon.zoom.in" => current.saturating_add(25).min(200),
            "horizon.zoom.out" => current.saturating_sub(25).max(50),
            "horizon.zoom.reset" => 100,
            _ => return,
        };
        if next == current { return; }
        let Some(window) = app.get_webview_window("main") else { return; };
        match window.set_zoom(f64::from(next) / 100.0) {
            Ok(()) => {
                percent.store(next, Ordering::Relaxed);
                let _ = status.set_text(format!("网页缩放：{next}%"));
                let _ = zoom_in.set_enabled(next < 200);
                let _ = zoom_out.set_enabled(next > 50);
            }
            Err(error) => app.dialog()
                .message(format!("网页缩放未完成：{error}"))
                .title("Horizon")
                .kind(MessageDialogKind::Error)
                .show(|_| {}),
        }
    });
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default().plugin(tauri_plugin_dialog::init())
        .setup(|app|{
            let state=Arc::new(HostState::new(app.path().app_data_dir()?)?);
            extensions::initialize(&state)?;
            macos::install(app.handle(),&state)?;
            #[cfg(target_os = "macos")]
            install_page_zoom_menu(app.handle())?;
            start_maintenance(&state,app.handle().clone());
            app.manage(state);Ok(())
        })
        .invoke_handler(tauri::generate_handler![horizon_call,horizon_start,horizon_subscribe])
        .on_window_event(|window,event|{
            if let tauri::WindowEvent::CloseRequested{api,..}=event{
                let state=window.state::<Arc<HostState>>();
                if !state.shutdown_allowed.load(Ordering::SeqCst){api.prevent_close();request_close(window.app_handle());}
            }
        })
        .build(tauri::generate_context!()).expect("Horizon host initialization failed")
        .run(|app,event|{
            if let tauri::RunEvent::ExitRequested{api,..}=event{
                let state=app.state::<Arc<HostState>>();if !state.shutdown_allowed.load(Ordering::SeqCst){api.prevent_exit();request_close(app);}
            }
        });
}

fn start_maintenance(state:&Arc<HostState>,app:AppHandle){
    let weak=Arc::downgrade(state);tauri::async_runtime::spawn(async move{loop{
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;let Some(state)=weak.upgrade()else{break};
        state.trim_task_cache();
        state.idempotency.lock().unwrap().retain(|_,record|record.at.elapsed().as_secs()<600);
        state.plans.lock().unwrap().retain(|_,plan|plan["expiresAt"].as_str().is_none_or(|expires|expires>=state::now().as_str()));
        state.selections.lock().unwrap().retain(|_,(_,created)|created.elapsed().as_secs()<600);
        let projects={let registry=state.registry.lock().unwrap();registry.projects.iter().filter(|p|p["state"]=="idle").filter_map(|p|p["id"].as_str().map(str::to_owned)).collect::<Vec<_>>()};
        for project in projects{
            let _serial=state.write_lock.lock().await;
            if !state.registry.lock().unwrap().projects.iter().any(|p|p["id"]==project&&p["state"]=="idle"){continue;}
            let preferences=match settings::effective_for(&state,Some(&project)){Ok(p)=>p,Err(_)=>continue};if preferences["resources.keepRunning"]==true{continue;}
            let idle=state.last_activity.lock().unwrap().get(&project).map(|last|last.elapsed().as_secs()).unwrap_or(0);if idle<preferences["resources.idleMinutes"].as_u64().unwrap_or(5)*60{continue;}
            if !state.dirty_documents(Some(&project)).is_empty()||!processes::resources(Some(&project))["items"].as_array().is_none_or(Vec::is_empty)||!agent::resources(Some(&project)).as_array().is_none_or(Vec::is_empty)||!git::resource_snapshot(Some(&project)).is_empty()||!search::resources(Some(&project)).is_empty(){continue;}
            if state.tasks.lock().unwrap().values().any(|t|t.call.scope["projectId"]==project&&t.terminal.is_none()){continue;}
            if extensions::sleep_project(&state,&project).await.is_err(){continue;}
            if state.release_project_resources(&project).is_err(){continue;}state.invalidate_project_scope(&project);
            {let mut registry=state.registry.lock().unwrap();if let Some(p)=registry.projects.iter_mut().find(|p|p["id"]==project){p["state"]=json!("sleeping");p["revision"]=json!(p["revision"].as_u64().unwrap_or(0)+1);}}
            let _=state.persist();state.notify("horizon.project.v1",&project,0,"upsert");let _=app.emit("horizon:project:v1",json!({"projectId":project,"state":"sleeping","projectEpoch":state.epochs.lock().unwrap().get(&project).copied()}));let _=app.emit("horizon:extension:v1",json!({"projectId":project}));
        }
    }});
}
