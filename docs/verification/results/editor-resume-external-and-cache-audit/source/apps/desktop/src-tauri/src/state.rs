use crate::{protocol::{allowed, string}, Call, HostError};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::HashMap, fs, io::Write, path::{Path, PathBuf}, sync::{atomic::{AtomicBool, Ordering}, Mutex}};
use tauri::ipc::Channel;

pub fn id() -> String { uuid::Uuid::new_v4().to_string() }
pub fn digest(bytes: impl AsRef<[u8]>) -> String { format!("{:x}", Sha256::digest(bytes)) }
pub fn now() -> String { chrono::Utc::now().to_rfc3339() }
pub fn native_encode(path: &Path) -> String {
    #[cfg(unix)] { use std::os::unix::ffi::OsStrExt; STANDARD.encode(path.as_os_str().as_bytes()) }
    #[cfg(not(unix))] { STANDARD.encode(path.to_string_lossy().as_bytes()) }
}
pub fn native_decode(value: &str) -> Result<PathBuf, HostError> {
    let bytes = STANDARD.decode(value).map_err(|_| HostError::new("IO_ERROR","路径记录损坏"))?;
    #[cfg(unix)] { use std::os::unix::ffi::OsStringExt; Ok(std::ffi::OsString::from_vec(bytes).into()) }
    #[cfg(not(unix))] { Ok(String::from_utf8(bytes).map_err(|_|HostError::new("IO_ERROR","路径记录损坏"))?.into()) }
}
fn normalized_entry(path:&Path)->Result<PathBuf,HostError>{
    if path.components().any(|c|matches!(c,std::path::Component::ParentDir)){return Err(HostError::new("PERMISSION_DENIED","路径不能包含父级跳转"));}
    let mut suffix=Vec::new();let mut parent=path;
    while let Some(name)=parent.file_name(){suffix.push(name.to_os_string());parent=parent.parent().unwrap();if parent.exists(){let mut normalized=parent.canonicalize()?;for part in suffix.into_iter().rev(){normalized.push(part);}return Ok(normalized);}}
    Ok(path.canonicalize()?)
}
pub fn atomic_json(path: &Path, value: &impl Serialize) -> Result<(), HostError> {
    atomic_write(path, &serde_json::to_vec_pretty(value)?, None)
}
pub fn atomic_write(path: &Path, bytes: &[u8], permissions: Option<fs::Permissions>) -> Result<(), HostError> {
    let parent = path.parent().ok_or_else(||HostError::new("INVALID_ARGUMENT","缺少父目录"))?;
    fs::create_dir_all(parent)?;
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    tmp.write_all(bytes)?;
    if let Some(permissions) = permissions { tmp.as_file().set_permissions(permissions)?; }
    tmp.as_file().sync_all()?;
    tmp.persist(path).map_err(|e|HostError::from(e.error))?;
    fs::File::open(parent)?.sync_all()?;
    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all="camelCase")]
pub struct Registry {
    pub schema_version: u32,
    pub revision: u64,
    pub default_workspace_id: String,
    pub workspaces: Vec<Value>,
    pub projects: Vec<Value>,
    pub roots: HashMap<String, String>,
    pub paths: HashMap<String, (String, String)>,
    pub sessions: HashMap<String, Value>,
    #[serde(default)]
    pub external_file_grants: std::collections::HashSet<String>,
}
impl Default for Registry {
    fn default() -> Self {
        let default_id = id();
        Self {schema_version:1, revision:1, default_workspace_id:default_id.clone(),
            workspaces:vec![json!({"id":default_id,"name":"默认工作区","projectIds":[],"revision":1})],
            projects:vec![],roots:HashMap::new(),paths:HashMap::new(),sessions:HashMap::new(),external_file_grants:Default::default()}
    }
}

#[derive(Clone)]
pub struct Document { pub meta: Value }
pub struct Subscription { pub request_id:String, pub scope:Value, pub topics:Vec<String>, pub channel:Channel<Value>, pub seq:u64 }
pub struct TaskRecord {
    pub id:String, pub call:Call, pub state:String, pub cancelled:bool, pub seq:u64,
    pub ack:u64, pub events:std::collections::VecDeque<Value>, pub ring_bytes:usize,
    pub channel:Option<Channel<Value>>, pub terminal:Option<Value>, pub updated:std::time::Instant,
}
pub struct IdempotencyRecord { pub digest:String, pub result:Value, pub bytes:usize, pub at:std::time::Instant }

pub struct HostState {
    data_dir: PathBuf,
    pub registry:Mutex<Registry>,
    pub epochs:Mutex<HashMap<String,u64>>,
    pub documents:Mutex<HashMap<String,Document>>,
    pub selections:Mutex<HashMap<String,(PathBuf,std::time::Instant)>>,
    pub tasks:Mutex<HashMap<String,TaskRecord>>,
    pub subscriptions:Mutex<HashMap<String,Subscription>>,
    pub idempotency:Mutex<HashMap<String,IdempotencyRecord>>,
    pub plans:Mutex<HashMap<String,Value>>,
    pub cursors:Mutex<HashMap<String,Value>>,
    pub search_results:Mutex<HashMap<String,Vec<Value>>>,
    pub write_lock:tokio::sync::Mutex<()>,
    pub file_lock:Mutex<()>,
    pub credentials:Mutex<HashMap<String,String>>,
    pub shutdown_allowed:AtomicBool,
    pub watchers:Mutex<HashMap<String,notify::RecommendedWatcher>>,
    pub entity_revisions:Mutex<HashMap<String,u64>>,
    pub path_index:Mutex<HashMap<(String,String),String>>,
    pub last_activity:Mutex<HashMap<String,std::time::Instant>>,
    pub path_search_cache:Mutex<HashMap<String,(ArcPaths,bool)>>,
}
pub type ArcPaths=std::sync::Arc<Vec<PathBuf>>;
impl HostState {
    pub fn new(data_dir:PathBuf) -> Result<Self,HostError> {
        fs::create_dir_all(&data_dir)?;
        let data_dir=data_dir.canonicalize()?;
        #[cfg(unix)]{use std::os::unix::fs::PermissionsExt;fs::set_permissions(&data_dir,fs::Permissions::from_mode(0o700))?;}
        let registry_path=data_dir.join("registry.json");
        let mut registry:Registry=if registry_path.exists(){serde_json::from_slice(&fs::read(&registry_path)?)?}else{Registry::default()};
        if registry.schema_version!=1 {return Err(HostError::new("CONFIG_VERSION_UNSUPPORTED","项目配置版本不受支持"));}
        for project in &mut registry.projects { project["state"]=json!("registered"); }
        atomic_json(&registry_path,&registry)?;
        let path_index=registry.paths.iter().map(|(id,record)|(record.clone(),id.clone())).collect();
        for d in ["recovery","cache","exports","assets"] { fs::create_dir_all(data_dir.join(d))?; }
        Ok(Self {data_dir,registry:Mutex::new(registry),epochs:Mutex::new(HashMap::new()),documents:Mutex::new(HashMap::new()),selections:Mutex::new(HashMap::new()),tasks:Mutex::new(HashMap::new()),subscriptions:Mutex::new(HashMap::new()),idempotency:Mutex::new(HashMap::new()),plans:Mutex::new(HashMap::new()),cursors:Mutex::new(HashMap::new()),search_results:Mutex::new(HashMap::new()),write_lock:tokio::sync::Mutex::new(()),file_lock:Mutex::new(()),credentials:Mutex::new(HashMap::new()),shutdown_allowed:AtomicBool::new(false),watchers:Mutex::new(HashMap::new()),entity_revisions:Mutex::new(HashMap::new()),path_index:Mutex::new(path_index),last_activity:Mutex::new(HashMap::new()),path_search_cache:Mutex::new(HashMap::new())})
    }
    pub fn data_dir(&self)->&Path { &self.data_dir }
    pub fn persist(&self)->Result<(),HostError> { atomic_json(&self.data_dir.join("registry.json"),&*self.registry.lock().unwrap()) }
    pub fn project_root(&self,project_id:&str)->Result<PathBuf,HostError> {
        let reg=self.registry.lock().unwrap();
        native_decode(reg.roots.get(project_id).ok_or_else(||HostError::new("NOT_FOUND","项目不存在"))?)
    }
    pub fn resolve_file(&self,project_id:&str,file_id:&str)->Result<PathBuf,HostError> {
        let reg=self.registry.lock().unwrap();
        let (owner,path)=reg.paths.get(file_id).ok_or_else(||HostError::new("NOT_FOUND","文件标识已失效，请刷新目录"))?;
        if owner!=project_id {return Err(HostError::new("PERMISSION_DENIED","文件不属于当前项目"));}
        let path=native_decode(path)?;
        let root=native_decode(reg.roots.get(project_id).ok_or_else(||HostError::new("NOT_FOUND","项目不存在"))?)?;
        let external=reg.external_file_grants.contains(file_id);drop(reg);
        if !external{ensure_inside(&root,&path)?;}else if fs::symlink_metadata(&path).is_ok_and(|m|m.is_symlink()){return Err(HostError::new("PERMISSION_DENIED","已授权外部文件被替换为符号链接"));}
        Ok(path)
    }
    pub fn file_ref(&self,project_id:&str,path:&Path)->Result<Value,HostError> {
        let root=self.project_root(project_id)?;
        let absolute=normalized_entry(&if path.is_absolute(){path.to_owned()}else{root.join(path)})?;
        if !absolute.starts_with(&root) || absolute.components().any(|c|matches!(c,std::path::Component::ParentDir)) {return Err(HostError::new("PERMISSION_DENIED","文件超出项目范围"));}
        let encoded=native_encode(&absolute);
        let mut registry=self.registry.lock().unwrap();
        let key=(project_id.to_owned(),encoded);let mut index=self.path_index.lock().unwrap();
        let file_id=index.get(&key).cloned().unwrap_or_else(||{let stable=digest(format!("{project_id}\0{}",key.1));if registry.paths.get(&stable).is_some_and(|previous|previous!=&key){id()}else{stable}});
        registry.paths.insert(file_id.clone(),key.clone());index.insert(key,file_id.clone());
        Ok(json!({"projectId":project_id,"fileId":file_id,"displayPath":absolute.strip_prefix(root).unwrap_or(&absolute).to_string_lossy()}))
    }
    pub fn authorized_file_ref(&self,project_id:&str,path:&Path)->Result<Value,HostError>{
        let path=normalized_entry(path)?;let root=self.project_root(project_id)?;if path.starts_with(&root){return self.file_ref(project_id,&path);}
        let encoded=native_encode(&path);let file_id=digest(format!("{project_id}\0{encoded}"));let mut reg=self.registry.lock().unwrap();let key=(project_id.into(),encoded);reg.paths.insert(file_id.clone(),key.clone());reg.external_file_grants.insert(file_id.clone());self.path_index.lock().unwrap().insert(key,file_id.clone());
        Ok(json!({"projectId":project_id,"fileId":file_id,"displayPath":path.to_string_lossy()}))
    }
    pub fn register_selection(&self,path:PathBuf)->String {
        let token=id();let mut selections=self.selections.lock().unwrap();selections.retain(|_,(_,created)|created.elapsed().as_secs()<600);if selections.len()>=128{if let Some(oldest)=selections.iter().min_by_key(|(_,(_,at))|*at).map(|(id,_)|id.clone()){selections.remove(&oldest);}}selections.insert(token.clone(),(path,std::time::Instant::now()));token
    }
    pub fn register_cursor(&self,mut value:Value)->String{
        let token=id();value["createdAt"]=json!(chrono::Utc::now().timestamp_millis());let mut cursors=self.cursors.lock().unwrap();let oldest_allowed=chrono::Utc::now().timestamp_millis()-600_000;cursors.retain(|_,value|value["createdAt"].as_i64().unwrap_or(0)>=oldest_allowed);
        if cursors.len()>=1024{if let Some(oldest)=cursors.iter().min_by_key(|(_,value)|value["createdAt"].as_i64().unwrap_or(0)).map(|(id,_)|id.clone()){cursors.remove(&oldest);}}
        cursors.insert(token.clone(),value);token
    }
    pub fn resolve_selection(&self,token:&str)->Result<PathBuf,HostError> {
        let selections=self.selections.lock().unwrap();
        let (path,at)=selections.get(token).ok_or_else(||HostError::new("NOT_FOUND","文件选择已失效，请重新选择"))?;
        if at.elapsed().as_secs()>600 {return Err(HostError::new("NOT_FOUND","文件选择已过期"));} Ok(path.clone())
    }
    pub fn register_project(&self,path:PathBuf,workspace_id:Option<&str>,display_name:Option<&str>)->Result<Value,HostError> {
        let root=path.canonicalize()?;
        if !root.is_dir() {return Err(HostError::new("INVALID_ARGUMENT","请选择目录"));}
        let mut reg=self.registry.lock().unwrap();
        let encoded=native_encode(&root);
        if let Some((existing,_))=reg.roots.iter().find(|(_,v)|**v==encoded){
            let project=reg.projects.iter().find(|p|p["id"]==*existing).cloned().unwrap();
            return Ok(json!({"project":project,"reused":true}));
        }
        let workspace=workspace_id.unwrap_or(&reg.default_workspace_id).to_owned();
        if !reg.workspaces.iter().any(|w|w["id"]==workspace){return Err(HostError::new("NOT_FOUND","工作区不存在"));}
        let project_id=id();
        let name=display_name.map(str::to_owned).unwrap_or_else(||root.file_name().unwrap_or_default().to_string_lossy().into_owned());
        let project=json!({"id":project_id,"workspaceId":workspace,"displayName":name,"rootDisplayPath":root.to_string_lossy(),"pinned":false,"revision":1,"state":"registered"});
        reg.projects.push(project.clone()); reg.roots.insert(project_id.clone(),encoded);
        for w in &mut reg.workspaces {if w["id"]==workspace {w["projectIds"].as_array_mut().unwrap().push(json!(project_id));w["revision"]=json!(w["revision"].as_u64().unwrap()+1);}}
        reg.revision+=1; drop(reg); self.persist()?;
        Ok(json!({"project":project,"reused":false}))
    }
    pub fn validate_scope(&self,call:&Call)->Result<(),HostError> {
        if call.protocol_version!=1 {return Err(HostError::new("PROTOCOL_UNSUPPORTED","仅支持 protocolVersion 1"));}
        if call.request_id.is_empty() || call.request_id.len()>128 {return Err(HostError::new("INVALID_ARGUMENT","无效 requestId"));}
        match call.scope["kind"].as_str() {
            Some("app")=>allowed(&call.scope,&["kind"]),
            Some("project")=>{
                allowed(&call.scope,&["kind","projectId","projectEpoch"])?;
                let project=string(&call.scope,"projectId")?;
                self.project_root(project)?;
                let epoch=call.scope["projectEpoch"].as_u64().ok_or_else(||HostError::new("INVALID_ARGUMENT","缺少项目epoch"))?;
                if self.epochs.lock().unwrap().get(project).copied()!=Some(epoch){return Err(HostError::new("STALE_SCOPE","项目上下文已过期"));} if self.registry.lock().unwrap().projects.iter().any(|p|p["id"]==project&&p["state"]=="active"){self.last_activity.lock().unwrap().insert(project.into(),std::time::Instant::now());}Ok(())
            }
            _=>Err(HostError::new("INVALID_ARGUMENT","未知作用域")),
        }
    }
    pub fn dirty_documents(&self,project_id:Option<&str>)->Vec<Value> {
        self.documents.lock().unwrap().values().filter(|d|d.meta["state"]!="clean" && project_id.map_or(true,|p|d.meta["file"]["projectId"]==p)).map(|d|{
            let mut meta=d.meta.clone();meta["fileId"]=meta["file"]["fileId"].clone();meta["projectId"]=meta["file"]["projectId"].clone();meta
        }).collect()
    }
    pub fn dirty_file_ids(&self,project_id:&str)->Vec<String>{self.dirty_documents(Some(project_id)).iter().filter_map(|d|d["fileId"].as_str().map(str::to_owned)).collect()}
    pub fn open_documents(&self,project_id:Option<&str>)->Vec<Value>{self.documents.lock().unwrap().values().filter(|d|project_id.map_or(true,|p|d.meta["file"]["projectId"]==p)).map(|d|{let mut meta=d.meta.clone();meta["fileId"]=meta["file"]["fileId"].clone();meta["projectId"]=meta["file"]["projectId"].clone();meta}).collect()}
    pub fn document_meta(&self,document_id:&str)->Result<Value,HostError> {
        self.documents.lock().unwrap().get(document_id).map(|d|d.meta.clone()).ok_or_else(||HostError::new("NOT_FOUND","文档已关闭"))
    }
    pub fn document_propose(&self,document_id:&str,expected_revision:u64,text:&str)->Result<Value,HostError> {
        let meta=self.document_meta(document_id)?;
        if meta["editorRevision"].as_u64()!=Some(expected_revision){return Err(HostError::new("STALE_VERSION","文档已继续编辑"));}
        let proposal=json!({"proposalId":id(),"documentId":document_id,"expectedEditorRevision":expected_revision,"text":text,"state":"proposed"});
        self.plans.lock().unwrap().insert(proposal["proposalId"].as_str().unwrap().into(),proposal.clone());
        self.notify("horizon.document.v1",document_id,expected_revision,"invalidate"); Ok(proposal)
    }
    pub fn validate_document_decisions(&self,decisions:&[Value])->Result<(),HostError> {
        let docs=self.documents.lock().unwrap();
        for decision in decisions {
            allowed(decision,&["resourceId","action","checkpointId","exportReceiptId"])?;
            let resource=string(decision,"resourceId")?;
            let Some(doc)=docs.get(resource) else {continue};
            if doc.meta["state"]=="clean" {continue;}
            match decision["action"].as_str(){
                Some("discard")=>{},
                Some("retainCheckpoint")=>{
                    let checkpoint=string(decision,"checkpointId")?;
                    if checkpoint!=resource{return Err(HostError::new("INVALID_ARGUMENT","恢复稿不属于此文档"));}
                    let data:Value=serde_json::from_slice(&fs::read(self.data_dir.join("recovery").join(format!("{checkpoint}.json")))?)?;
                    if data["documentId"]!=resource || data["editorRevision"]!=doc.meta["editorRevision"] {return Err(HostError::new("STALE_VERSION","恢复稿不是最新编辑版本"));}
                }
                Some("export")=>{
                    let receipt_id=string(decision,"exportReceiptId")?;
                    if uuid::Uuid::parse_str(receipt_id).is_err(){return Err(HostError::new("INVALID_ARGUMENT","导出回执无效"));}
                    let receipt:Value=serde_json::from_slice(&fs::read(self.data_dir.join("exports").join(format!("{receipt_id}.json")))?)?;
                    if receipt["checkpointId"]!=resource || receipt["editorRevision"]!=doc.meta["editorRevision"]{return Err(HostError::new("STALE_VERSION","导出内容不是最新版本"));}
                }
                _=>return Err(HostError::new("RESOURCE_BUSY","未保存文档尚未处理")),
            }
        }
        Ok(())
    }
    pub fn resolve_document_decisions(&self,decisions:&[Value])->Result<(),HostError> {
        self.validate_document_decisions(decisions)?;
        let mut docs=self.documents.lock().unwrap();
        for decision in decisions {if let Some(resource)=decision["resourceId"].as_str(){if decision["action"]=="discard"&&docs.contains_key(resource){let checkpoint=self.data_dir.join("recovery").join(format!("{resource}.json"));if checkpoint.exists(){fs::remove_file(checkpoint)?;}}docs.remove(resource);}}
        Ok(())
    }
    pub fn release_project_resources(&self,project:&str)->Result<(),HostError>{
        if !self.dirty_documents(Some(project)).is_empty(){return Err(HostError::new("RESOURCE_BUSY","未保存文档尚未处理"));}
        let task_ids={let tasks=self.tasks.lock().unwrap();if tasks.values().any(|task|task.call.scope["projectId"]==project&&task.terminal.is_none()){return Err(HostError::new("RESOURCE_BUSY","项目任务尚未结束"));}tasks.values().filter(|task|task.call.scope["projectId"]==project).map(|task|task.id.clone()).collect::<std::collections::HashSet<_>>()};
        self.documents.lock().unwrap().retain(|_,document|document.meta["file"]["projectId"]!=project);
        self.watchers.lock().unwrap().remove(project);
        self.subscriptions.lock().unwrap().retain(|_,subscription|subscription.scope["projectId"]!=project);
        self.cursors.lock().unwrap().retain(|_,cursor|cursor["projectId"]!=project);
        self.path_search_cache.lock().unwrap().remove(project);
        self.search_results.lock().unwrap().retain(|task_id,_|!task_ids.contains(task_id));
        self.tasks.lock().unwrap().retain(|task_id,_|!task_ids.contains(task_id));
        self.last_activity.lock().unwrap().remove(project);
        Ok(())
    }
    pub fn invalidate_project_scope(&self,project:&str){let mut epochs=self.epochs.lock().unwrap();let epoch=epochs.entry(project.into()).or_default();*epoch=epoch.saturating_add(1);}
    pub fn trim_task_cache(&self){
        let removed={let mut tasks=self.tasks.lock().unwrap();let mut completed=tasks.iter().filter(|(_,task)|task.terminal.is_some()).map(|(id,task)|(id.clone(),task.updated)).collect::<Vec<_>>();completed.sort_by_key(|(_,updated)|std::cmp::Reverse(*updated));let removed=completed.into_iter().enumerate().filter(|(index,(_,updated))|*index>=32||updated.elapsed().as_secs()>=600).map(|(_, (id,_))|id).collect::<std::collections::HashSet<_>>();tasks.retain(|id,_|!removed.contains(id));removed};
        self.search_results.lock().unwrap().retain(|id,_|!removed.contains(id));
        self.idempotency.lock().unwrap().retain(|_,record|!record.result["taskId"].as_str().is_some_and(|id|removed.contains(id)));
    }
    pub fn cache_paths(&self,project:&str,paths:ArcPaths,truncated:bool){
        let activity=self.last_activity.lock().unwrap();let mut cache=self.path_search_cache.lock().unwrap();cache.insert(project.into(),(paths,truncated));
        loop{let bytes=cache.values().map(|(paths,_)|paths.iter().map(|path|path.as_os_str().len()).sum::<usize>()).sum::<usize>();if cache.len()<=4&&bytes<=64*1024*1024{break;}let oldest=cache.keys().filter(|id|id.as_str()!=project).min_by_key(|id|activity.get(*id)).cloned();if let Some(oldest)=oldest{cache.remove(&oldest);}else{break;}}
    }
    pub fn credential_secret(&self,credential_ref:&str)->Result<String,HostError> {
        crate::settings::credential_secret(self,credential_ref)
    }
    pub fn notify(&self,topic:&str,entity_id:&str,revision:u64,change:&str) {
        let project={let registry=self.registry.lock().unwrap();registry.paths.get(entity_id).map(|record|record.0.clone()).or_else(||registry.roots.contains_key(entity_id).then(||entity_id.to_owned()))};
        self.notify_project(topic,entity_id,revision,change,project.as_deref());
    }
    pub fn notify_project(&self,topic:&str,entity_id:&str,revision:u64,change:&str,project:Option<&str>){
        let revision={let mut revisions=self.entity_revisions.lock().unwrap();let next=revisions.entry(format!("{topic}:{entity_id}")).or_default();*next=(*next+1).max(revision);*next};
        let mut subs=self.subscriptions.lock().unwrap();
        subs.retain(|subscription_id,s|{
            if !s.topics.iter().any(|t|t==topic){return true;}
            if s.scope["kind"]=="project" && project.is_some_and(|p|s.scope["projectId"]!=p){return true;}
            s.seq+=1;
            s.channel.send(json!({"protocolVersion":1,"event":"horizon.subscription.v1","requestId":s.request_id,"subscriptionId":subscription_id,"scope":s.scope,"seq":s.seq,"topic":topic,"entityId":entity_id,"entityRevision":revision,"change":change})).is_ok()
        });
    }
    pub fn release_extension_resources(&self,extension_id:&str,project:Option<&str>){
        if ["horizon.files","horizon.editor","horizon.search"].contains(&extension_id){self.watchers.lock().unwrap().retain(|id,_|project.is_some_and(|p|p!=id));}
        if ["horizon.files","horizon.editor","horizon.search"].contains(&extension_id){self.cursors.lock().unwrap().retain(|_,cursor|project.is_some_and(|p|cursor["projectId"]!=p));}
        if extension_id=="horizon.files"{self.path_search_cache.lock().unwrap().retain(|id,_|project.is_some_and(|p|id!=p));}
        let mut tasks=self.tasks.lock().unwrap();for task in tasks.values_mut(){let owned=match extension_id{"horizon.search"=>task.call.method.starts_with("search_"),"horizon.files"=>task.call.method=="path_query",_=>false};if owned&&project.is_none_or(|p|task.call.scope["projectId"]==p)&&task.terminal.is_none(){task.cancelled=true;}}
    }
    pub fn task_id_for_request(&self,request_id:&str)->Option<String> {self.tasks.lock().unwrap().values().find(|t|t.call.request_id==request_id).map(|t|t.id.clone())}
    pub fn is_cancelled(&self,request_id:&str)->bool {self.tasks.lock().unwrap().values().find(|t|t.call.request_id==request_id).is_some_and(|t|t.cancelled)}
    pub fn emit_task_data(&self,request_id:&str,kind:&str,data:Value)->Result<(),HostError>{self.emit_task(request_id,json!({"type":"data","kind":kind,"data":data}))}
    pub fn emit_task(&self,request_id:&str,payload:Value)->Result<(),HostError> {
        let payload_size=serde_json::to_vec(&payload)?.len();
        if payload["type"]=="data"{
            if payload_size>65_536{return Err(HostError::new("RESOURCE_LIMIT","任务数据批次超过64 KiB"));}
            let started=std::time::Instant::now();
            loop{
                let (waiting,cancelled)={let tasks=self.tasks.lock().unwrap();let task=tasks.values().find(|t|t.call.request_id==request_id).ok_or_else(||HostError::new("NOT_FOUND","任务不存在"))?;
                    let pending=|task:&TaskRecord|->usize{if task.channel.is_none(){return 0;}task.events.iter().filter(|e|e["seq"].as_u64().unwrap_or(0)>task.ack&&e["payload"]["type"]=="data").map(|e|serde_json::to_vec(e).map_or(0,|v|v.len())).sum()};
                    (task.channel.is_some()&&(pending(task)+payload_size>500*1024||tasks.values().map(pending).sum::<usize>()+payload_size>4*1024*1024),task.cancelled)};
                if !waiting{break;}if cancelled{return Err(HostError::new("CANCELLED","任务已请求停止"));}
                if started.elapsed().as_secs()>15{return Err(HostError::new("RESOURCE_LIMIT","前端未确认数据，请重新附着任务或读取结果页"));}
                if tokio::runtime::Handle::try_current().is_ok_and(|handle|handle.runtime_flavor()==tokio::runtime::RuntimeFlavor::MultiThread){tokio::task::block_in_place(||std::thread::sleep(std::time::Duration::from_millis(5)));}else{std::thread::sleep(std::time::Duration::from_millis(5));}
            }
        }
        let mut tasks=self.tasks.lock().unwrap();
        let task=tasks.values_mut().find(|t|t.call.request_id==request_id).ok_or_else(||HostError::new("NOT_FOUND","任务不存在"))?;
        if task.terminal.is_some(){return Ok(());}
        let size=payload_size;
        if size>65_536 && payload["type"]=="data"{return Err(HostError::new("RESOURCE_LIMIT","任务数据批次超过64 KiB"));}
        if payload["type"]=="terminal"{task.state=payload["state"].as_str().unwrap_or("failed").into();task.terminal=Some(payload.clone());}
        if payload["type"]=="started"{task.state="running".into();}
        task.seq+=1; task.updated=std::time::Instant::now();
        let event=json!({"protocolVersion":1,"event":"horizon.task.v1","taskId":task.id,"requestId":task.call.request_id,"scope":task.call.scope,"seq":task.seq,"payload":payload});
        let event_size=serde_json::to_vec(&event)?.len();task.events.push_back(event.clone());task.ring_bytes+=event_size;
        while task.ring_bytes>512*1024 && task.events.len()>1 {if let Some(front)=task.events.pop_front(){task.ring_bytes=task.ring_bytes.saturating_sub(serde_json::to_vec(&front).map_or(0,|b|b.len()));}}
        if let Some(channel)=&task.channel {if channel.send(event).is_err(){task.channel=None;}}
        Ok(())
    }
    pub fn allow_shutdown(&self){self.shutdown_allowed.store(true,Ordering::SeqCst);}
}

pub fn ensure_inside(root:&Path,path:&Path)->Result<(),HostError>{
    if !path.starts_with(root) || path.components().any(|c|matches!(c,std::path::Component::ParentDir)){return Err(HostError::new("PERMISSION_DENIED","路径超出项目范围"));}
    let check=if path.exists(){path.canonicalize()?}else{let mut parent=path.parent().ok_or_else(||HostError::new("INVALID_ARGUMENT","无效路径"))?;while !parent.exists(){parent=parent.parent().ok_or_else(||HostError::new("NOT_FOUND","路径不存在"))?;}parent.canonicalize()?};
    if !check.starts_with(root){return Err(HostError::new("PERMISSION_DENIED","符号链接指向项目外部"));} Ok(())
}

pub fn default_session()->Value {json!({"schemaVersion":1,"revision":1,"tabs":[],"activeFileId":null,"expandedEntryIds":[],"searchDraft":"","commitDraft":"","layout":{"panels":{},"focusMode":false,"focusRestore":null}})}
