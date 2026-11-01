//! Pi 1.4.0 subprocess adapter. Pi owns model calls and the agent/tool loop.
use crate::{Call, HostError, HostState};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{collections::{BTreeMap, HashMap, HashSet}, fs, path::{Component, Path, PathBuf}, process::Stdio, sync::{Arc, Mutex, OnceLock, atomic::{AtomicBool, Ordering}}, time::{Duration, SystemTime, UNIX_EPOCH}};
use tauri::{AppHandle, ipc::Channel};
use tokio::{io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader}, net::UnixListener, process::Command, sync::{mpsc, oneshot}};
use uuid::Uuid;

const VERSION: &str = "1.4.0";
const POLICY: &str = include_str!("../../../../packages/pi-policy/horizon-policy.ts");
const MAX_FILE: usize = 16 * 1024 * 1024;
const MAX_CONTEXT: usize = 256 * 1024;
const MESSAGE_PAGE_BYTES: usize = 32 * 1024;
const MAX_PI_RECORD_BYTES: usize = 4 * 1024 * 1024;
const MAX_SESSION_BYTES: u64 = 32 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES: usize = 128 * 1024 * 1024;
const RESOURCE_FLAGS: &[&str] = &["--no-extensions", "--no-mcp", "--no-skills", "--no-prompt-templates", "--no-themes", "--no-context-files", "--no-approve", "--offline"];
type Result<T> = std::result::Result<T, HostError>;
fn err(code: &str, message: impl Into<String>) -> HostError { HostError::new(code, message) }
fn id() -> String { Uuid::new_v4().to_string() }
fn hash(data: impl AsRef<[u8]>) -> String { format!("{:x}", Sha256::digest(data.as_ref())) }
fn now_ms()->u64{SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64}
fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() }
fn field<'a>(v: &'a Value, k: &str) -> Result<&'a str> { v[k].as_str().ok_or_else(|| err("INVALID_ARGUMENT", format!("缺少 {k}"))) }
fn save_json(path: &Path, value: &impl Serialize) -> Result<()> { let tmp = path.with_extension("tmp"); fs::write(&tmp, serde_json::to_vec_pretty(value)?)?; fs::rename(tmp, path)?; Ok(()) }
fn private_dir(path: &Path) -> Result<()> { fs::create_dir_all(path)?; #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(path, fs::Permissions::from_mode(0o700))?; } Ok(()) }
fn disk_hash(path: &Path) -> Result<Option<String>> { match fs::read(path) { Ok(b) => Ok(Some(hash(b))), Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None), Err(e) => Err(e.into()) } }
fn confined(root: &Path, relative: &str) -> Result<PathBuf> {
    let p = Path::new(relative);
    if p.is_absolute() || p.components().any(|c| matches!(c, Component::ParentDir | Component::Prefix(_) | Component::RootDir)) || p.components().any(|c| c.as_os_str() == ".git") { return Err(err("PERMISSION_DENIED", "路径必须位于任务副本内，且不能访问 .git")); }
    let target = root.join(p);
    let mut check = target.as_path();
    while !check.exists() { check = check.parent().ok_or_else(|| err("PERMISSION_DENIED", "无效路径"))?; }
    if !fs::canonicalize(check)?.starts_with(fs::canonicalize(root)?) { return Err(err("PERMISSION_DENIED", "符号链接越过任务边界")); }
    if fs::symlink_metadata(&target).map(|m| m.file_type().is_symlink()).unwrap_or(false) { return Err(err("PERMISSION_DENIED", "不通过工具读取或覆盖符号链接")); }
    Ok(target)
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Connection { connection_id: String, adapter_id: String, runtime: Value, provider: Value, auth_owner: String, revision: u64, auth_state: String }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Session { #[serde(default)] created_at:u64, session_id: String, project_id: String, connection_id: String, profile: String, state: String, instance_id: Option<String>, instance_epoch: u64, resume_available: bool, pi_file: String, review_id: Option<String>, messages: Vec<Value> }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Baseline { #[serde(default)] buffer_selected: bool, relative: String, original_hash: Option<String>, baseline_hash: Option<String>, disk_revision: Value, editor_revision: Option<u64>, document_id: Option<String>, file_id: String }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Review { #[serde(default)] completed: bool, review_id: String, project_id: String, session_id: String, copy: PathBuf, baseline_dir: PathBuf, baseline: BTreeMap<String, Baseline>, discarded: bool, applied: HashSet<String> }
#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
struct Preferences { revision:u64, default_connection:Option<String>, project_connections:HashMap<String,String> }
#[derive(Default, Serialize, Deserialize)]
struct Store { #[serde(default)] preferences:Preferences, connections: BTreeMap<String, Connection>, sessions: BTreeMap<String, Session>, reviews: BTreeMap<String, Review> }
#[derive(Clone)]
struct Snapshot { session_id: String, digest: String, items: Vec<Value>, texts: Vec<String>, created: u64, buffer_bases: HashMap<String,String> }
struct EditorApplication { review_id:String, relative:String, document_id:String, content_hash:String, expected_revision:u64 }
struct BrokerGuard { task: Option<tokio::task::JoinHandle<()>>, socket: PathBuf }
impl BrokerGuard { async fn shutdown(&mut self){if let Some(task)=self.task.take(){task.abort();let _=task.await;}} }
struct ProcessGroupGuard(u32,String);
impl Drop for ProcessGroupGuard {fn drop(&mut self){kill_group(self.0);if let Some(run)=memory().lock().unwrap().runs.get_mut(&self.1){run.execution_pids.remove(&self.0);}}}
impl Drop for BrokerGuard { fn drop(&mut self) { if let Some(task)=&self.task {task.abort();}let _=fs::remove_file(&self.socket); } }
struct Permission { session_id: String, digest: String, expires: u64, answer: oneshot::Sender<bool> }
struct Running { session_id: String, connection_id: String, project_id: String, request_id: String, instance_id: String, cancel: Arc<AtomicBool>, input: mpsc::UnboundedSender<Value>, pid: u32, execution_pids:HashSet<u32> }
#[derive(Default)]
struct Memory { store: Store, loaded_from: Option<PathBuf>, snapshots: HashMap<String, Snapshot>, permissions: HashMap<String, Permission>, applications: HashMap<String,EditorApplication>, runs: HashMap<String, Running> }
fn memory() -> &'static Mutex<Memory> { static MEMORY: OnceLock<Mutex<Memory>> = OnceLock::new(); MEMORY.get_or_init(|| Mutex::new(Memory::default())) }
fn data(state: &HostState) -> Result<PathBuf> { let d = state.data_dir().join("agent"); private_dir(&d)?; Ok(d) }
fn load(state: &HostState) -> Result<()> { let d = data(state)?; let mut m = memory().lock().unwrap(); if m.loaded_from.as_ref() != Some(&d) { let p = d.join("state.json"); m.store = if p.exists() { serde_json::from_slice(&fs::read(p)?)? } else { Store::default() }; for s in m.store.sessions.values_mut() { s.state = "dormant".into(); s.instance_id = None; } m.loaded_from = Some(d); } Ok(()) }
fn persist(state: &HostState) -> Result<()> { let d = data(state)?; let m = memory().lock().unwrap(); save_json(&d.join("state.json"), &m.store) }
fn connection(cid: &str) -> Result<Connection> { memory().lock().unwrap().store.connections.get(cid).cloned().ok_or_else(|| err("NOT_FOUND", "模型连接不存在")) }
fn session(call: &Call) -> Result<Session> { let sid = field(&call.params, "sessionId")?; let s = memory().lock().unwrap().store.sessions.get(sid).cloned().ok_or_else(|| err("NOT_FOUND", "会话不存在"))?; if call.scope["projectId"].as_str() != Some(&s.project_id) { return Err(err("STALE_SCOPE", "会话不属于当前项目")); } Ok(s) }
fn capabilities(profile: &str) -> Value { json!({"protocol":"pi-rpc","structuredMessages":true,"tools":if profile=="task" {"gated"} else {"none"},"permissions":if profile=="task" {"horizonBroker"} else {"none"},"sessionResume":true,"attach":false,"modelSelection":true,"auth":["horizonApiKey","runtimeOwned","external"],"input":["text","textSnippets"],"changes":if profile=="task" {"versionedReview"} else {"none"},"cancel":"protocol"}) }
fn asset() -> (&'static str, &'static str, u64) { if cfg!(target_arch="aarch64") { ("pi-darwin-arm64.tar.gz", "79d9979d76a2a5adb7c28e27e9b44629928ccd0dc9fbb6ae7217860bd5e8be5d", 31098931) } else { ("pi-darwin-x64.tar.gz", "1bdefc9e1074c1de458ea9f2e43e6013ce49cd05326009b3de144037036585e2", 33558360) } }
fn managed_executable(state: &HostState) -> PathBuf { state.data_dir().join("runtimes/pi/1.4.0").join(if cfg!(target_arch="aarch64") {"darwin-arm64"} else {"darwin-x64"}).join("pi/pi") }
fn executable(state: &HostState, runtime: &Value) -> PathBuf { runtime["executablePath"].as_str().or(runtime["executableRef"].as_str()).map(PathBuf::from).unwrap_or_else(|| managed_executable(state)) }
async fn detect(state: &HostState, runtime: &Value) -> Result<Value> {
    let path = executable(state, runtime); let (name, digest, bytes) = asset();
    let mut result = json!({"adapterId":"pi","installed":path.is_file(),"supported":false,"path":path,"version":null,"requiredVersion":VERSION,"source":"https://github.com/earendil-works/pi/releases/tag/v1.4.0","ownership":if runtime["executablePath"].is_string()||runtime["executableRef"].is_string(){"userInstalled"}else{"managed"},"downloadBytes":bytes,"asset":name,"sha256":digest,"diagnostics":[]});
    if !path.is_file() { return Ok(result); }
    let output = tokio::time::timeout(Duration::from_secs(10), Command::new(&path).arg("--version").env("PI_OFFLINE","1").env("PI_TELEMETRY","0").kill_on_drop(true).output()).await.map_err(|_| err("TIMEOUT", "Pi 版本检测超时"))??;
    let version = String::from_utf8_lossy(&output.stdout).trim().to_string(); result["version"] = json!(version); result["supported"] = json!(output.status.success() && version == VERSION);
    if result["supported"] != true { result["diagnostics"] = json!(["此版本尚未通过 Horizon 适配验证；仅支持 Pi 1.4.0"]); } Ok(result)
}
async fn install(state: &HostState, request: &str) -> Result<Value> {
    let (name, digest, _) = asset();
    install_from(state, request, &format!("https://github.com/earendil-works/pi/releases/download/v{VERSION}/{name}"), digest).await
}
async fn install_from(state: &HostState, request: &str, url: &str, digest: &str) -> Result<Value> {
    if !cfg!(target_os="macos") { return Err(err("CAPABILITY_UNSUPPORTED", "首版运行时安装仅支持 macOS")); }
    let path = managed_executable(state); if path.exists() { return detect(state, &json!({})).await; }
    let (name, _, _) = asset(); let target = path.parent().unwrap().parent().unwrap(); let parent = target.parent().unwrap(); private_dir(parent)?;
    let staging = parent.join(format!("download-{}",id())); private_dir(&staging)?;
    let result = async { state.emit_task_data(request,"agent.install",json!({"phase":"downloading","version":VERSION}))?;
        let response = reqwest::Client::builder().timeout(Duration::from_secs(180)).build().map_err(|e| err("NETWORK_ERROR",e.to_string()))?.get(url).send().await.map_err(|e|err("NETWORK_ERROR",e.to_string()))?.error_for_status().map_err(|e|err("NETWORK_ERROR",e.to_string()))?;
        let bytes = response.bytes().await.map_err(|e|err("NETWORK_ERROR",e.to_string()))?; if hash(&bytes) != digest { return Err(err("INTEGRITY_ERROR","Pi 官方发行文件摘要不匹配，未激活")); }
        if state.is_cancelled(request) { return Err(err("CANCELLED","已取消安装")); }
        fs::write(staging.join(name), &bytes)?;
        let out = Command::new("/usr/bin/tar").args(["-xzf"]).arg(staging.join(name)).arg("-C").arg(&staging).output().await?; if !out.status.success() { return Err(err("INSTALL_FAILED","无法解压 Pi 运行时")); }
        fs::remove_file(staging.join(name))?; let probe = detect(state, &json!({"executablePath":staging.join("pi/pi")})).await?; if probe["supported"] != true { return Err(err("INSTALL_FAILED","运行时版本检测失败")); }
        fs::rename(&staging, target)?; state.emit_task_data(request,"agent.install",json!({"phase":"installed","version":VERSION}))?; detect(state,&json!({})).await
    }.await;
    if staging.exists() { let _ = fs::remove_dir_all(&staging); } result
}
fn validate_connection(c: &Connection) -> Result<()> {
    if !["horizon","runtime","external"].contains(&c.auth_owner.as_str()){return Err(err("INVALID_ARGUMENT","无效认证归属"));}
    if c.adapter_id != "pi" && c.adapter_id != "horizon.agent.pi" { return Err(err("CAPABILITY_UNSUPPORTED","首版只实现 Pi；其他 Agent 仅保留接口")); }
    let api = field(&c.provider,"api")?; if !["openai-completions","openai-responses","anthropic-messages","google-generative-ai"].contains(&api) { return Err(err("INVALID_ARGUMENT","不支持的 Pi provider 协议")); }
    let endpoint = field(&c.provider,"endpoint")?;
    let url = reqwest::Url::parse(endpoint).map_err(|_|err("INVALID_ARGUMENT","无效模型地址"))?;
    if !["https","http"].contains(&url.scheme()) || url.username() != "" || url.password().is_some() || url.query().is_some() { return Err(err("INVALID_ARGUMENT","地址须为 HTTP(S)，不得含凭据或查询参数")); }
    if url.scheme()=="http" && !matches!(url.host_str(), Some("localhost"|"127.0.0.1"|"[::1]"|"::1")) { return Err(err("INVALID_ARGUMENT","非本地模型地址须用 HTTPS")); }
    for k in ["id","model"] { let v=field(&c.provider,k)?; if v.is_empty() || v.contains('\n') || v.starts_with('!') { return Err(err("INVALID_ARGUMENT","无效模型或提供商 ID")); } }
    Ok(())
}
fn configure(state: &HostState, c: &Connection) -> Result<PathBuf> {
    validate_connection(c)?;
    let base = data(state)?.join("connections").join(&c.connection_id);private_dir(&base)?;let dir=base.join(&c.auth_owner);private_dir(&dir)?;
    // Pi gives stored auth precedence over configured API keys. Keep each ownership mode in its own directory.
    if c.auth_owner=="runtime"&&base.join("auth.json").is_file()&&!dir.join("auth.json").exists(){fs::copy(base.join("auth.json"),dir.join("auth.json"))?;}
    let provider = field(&c.provider,"id")?;
    let mut config=json!({"baseUrl":c.provider["endpoint"],"api":c.provider["api"],"models":[{"id":c.provider["model"],"reasoning":false,"input":["text"],"contextWindow":c.provider["contextWindow"].as_u64().unwrap_or(32768),"maxTokens":4096}]});
    if c.auth_owner=="horizon"&&c.provider["credentialRef"].is_string(){config["apiKey"]=json!("$HORIZON_MODEL_KEY");}else if c.auth_owner=="external"{config["apiKey"]=json!("horizon-local");}
    let mut providers = serde_json::Map::new(); providers.insert(provider.into(),config);
    save_json(&dir.join("models.json"), &json!({"providers":providers}))?;
    save_json(&dir.join("settings.json"), &json!({"defaultProvider":provider,"defaultModel":c.provider["model"],"quietStartup":true,"enableSkillCommands":false,"packages":[],"extensions":[],"retry":{"enabled":false},"cacheWarming":{"enabled":false}}))?;
    Ok(dir)
}
async fn git(root: &Path, args: &[&str]) -> Result<Vec<u8>> { let out=Command::new("/usr/bin/git").args(["-c","core.fsmonitor=false","-c","core.hooksPath=/dev/null"]).arg("-C").arg(root).args(args).env("GIT_TERMINAL_PROMPT","0").output().await?; if !out.status.success() { return Err(err("GIT_ERROR",String::from_utf8_lossy(&out.stderr).trim().to_string())); } Ok(out.stdout) }
async fn tracked(root: &Path) -> Result<HashSet<String>> { let mut paths=HashSet::new(); for args in [vec!["ls-tree","-r","--name-only","-z","HEAD"],vec!["ls-files","-z"]] { for p in git(root,&args).await?.split(|b|*b==0).filter(|s|!s.is_empty()) { paths.insert(String::from_utf8(p.to_vec()).map_err(|_|err("UNSUPPORTED_PATH","任务需要 UTF-8 文件名"))?); } } Ok(paths) }
fn copy_file(source: &Path, target: &Path) -> Result<()> { if let Some(parent)=target.parent() { fs::create_dir_all(parent)?; } fs::copy(source,target)?; fs::set_permissions(target,fs::metadata(source)?.permissions())?; Ok(()) }
async fn prepare_copy(state: &HostState, s: &Session, snapshot: &Snapshot, selected: &[String]) -> Result<Review> {
    if let Some(rid)=&s.review_id { let m=memory().lock().unwrap(); if let Some(r)=m.store.reviews.get(rid) { if !r.discarded&&!r.completed {
        if !r.applied.is_empty(){return Err(err("REVIEW_PENDING","已有部分修改应用到原项目，请先完成审查或新建任务"));}
        for item in &snapshot.items {if item["source"]=="buffer"{let rel=field(item,"relativePath")?;let text=snapshot.buffer_bases.get(rel).ok_or_else(||err("STALE_VERSION","缓冲区快照缺失"))?;if r.baseline.get(rel).and_then(|b|b.baseline_hash.as_deref())!=Some(hash(text).as_str()){return Err(err("STALE_VERSION","此任务副本基线已冻结。使用新缓冲区基线时请新建任务"));}}}
        return Ok(r.clone());
    } } }
    let root=state.project_root(&s.project_id)?; git(&root,&["rev-parse","--verify","HEAD"]).await.map_err(|_|err("CAPABILITY_UNSUPPORTED","此项目没有有效 Git HEAD，首版仅支持聊天"))?;
    let rid=id(); let dir=data(state)?.join("reviews").join(&rid); private_dir(&dir)?; let baseline_dir=dir.join("baseline"); private_dir(&baseline_dir)?; let copy=dir.join("worktree");
    let mut paths=tracked(&root).await?; for p in selected { confined(&root,p)?; let check=Command::new("/usr/bin/git").arg("-C").arg(&root).args(["check-ignore","-q","--",p]).status().await?; if check.success() { return Err(err("PERMISSION_DENIED","默认不复制 ignored 文件")); } paths.insert(p.clone()); }
    for item in &snapshot.items { if item["source"]=="buffer" || item["source"]=="disk" { if let Some(rel)=item["relativePath"].as_str() { if !paths.contains(rel){let ignored=Command::new("/usr/bin/git").arg("-C").arg(&root).args(["check-ignore","-q","--",rel]).status().await?;if ignored.success(){return Err(err("PERMISSION_DENIED","默认不复制 ignored 附件到任务副本"));}}paths.insert(rel.into()); } } }
    let open_documents=state.open_documents(Some(&s.project_id));let mut baseline=BTreeMap::new(); let mut total=0usize;
    for rel in paths {
        let original=confined(&root,&rel)?; let bytes=match fs::read(&original) { Ok(b)=>Some(b),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>None,Err(e)=>return Err(e.into()) };
        if bytes.as_ref().is_some_and(|b|b.len()>MAX_FILE) { return Err(err("FILE_TOO_LARGE",format!("任务基线文件过大：{rel}"))); }
        total+=bytes.as_ref().map_or(0,Vec::len); if total>128*1024*1024 { return Err(err("CONTEXT_TOO_LARGE","任务基线超过 128 MiB")); }
        let original_hash=bytes.as_ref().map(hash); let mut value=bytes; let mut editor_revision=None; let mut document_id=None;let mut buffer_selected=false;
        for item in &snapshot.items { if item["source"]=="buffer" && item["relativePath"].as_str()==Some(&rel) { value=Some(snapshot.buffer_bases.get(&rel).ok_or_else(||err("STALE_VERSION","缺少缓冲区全文基线"))?.as_bytes().to_vec()); buffer_selected=true;editor_revision=item["editorRevision"].as_u64(); document_id=item["documentId"].as_str().map(str::to_owned); } }
        let base=baseline_dir.join(&rel); if let Some(b)=&value { if let Some(p)=base.parent() { fs::create_dir_all(p)?; } fs::write(&base,b)?; }
        let file=state.file_ref(&s.project_id,&original)?;
        if document_id.is_none(){if let Some(doc)=open_documents.iter().find(|d|d["file"]["fileId"]==file["fileId"]){document_id=doc["documentId"].as_str().map(str::to_owned);editor_revision=doc["editorRevision"].as_u64();}}
        baseline.insert(rel.clone(),Baseline{buffer_selected,relative:rel,original_hash,baseline_hash:value.as_ref().map(hash),disk_revision:if original.exists(){crate::files::disk_revision(&original)?}else{Value::Null},editor_revision,document_id,file_id:field(&file,"fileId")?.into()});
    }
    git(&root,&["-c","core.hooksPath=/dev/null","worktree","add","--no-checkout","--detach",copy.to_str().ok_or_else(||err("INVALID_PATH","路径无效"))?,"HEAD"]).await?;
    if let Err(error)=git(&copy,&["read-tree","HEAD"]).await {let _=git(&root,&["worktree","remove","--force",copy.to_str().unwrap()]).await;return Err(error);}
    let result=(|| -> Result<()> { for b in baseline.values() { let original=confined(&root,&b.relative)?; if disk_hash(&original)? != b.original_hash { return Err(err("FILE_CHANGED","准备任务副本时源文件改变，请重试")); } let target=confined(&copy,&b.relative)?; if b.baseline_hash.is_some() { copy_file(&baseline_dir.join(&b.relative),&target)?; if original.exists() { fs::set_permissions(&target,fs::metadata(original)?.permissions())?; } } else if target.exists() { fs::remove_file(target)?; } }
        for b in baseline.values(){let original=confined(&root,&b.relative)?;if disk_hash(&original)?!=b.original_hash || (original.exists()&&crate::files::disk_revision(&original)?!=b.disk_revision){return Err(err("FILE_CHANGED","复制期间源项目发生变化，请重试"));}if b.buffer_selected{let doc=state.document_meta(b.document_id.as_deref().unwrap())?;if doc["editorRevision"].as_u64()!=b.editor_revision{return Err(err("STALE_VERSION","复制期间编辑内容发生变化，请重新冻结"));}}}Ok(()) })();
    if let Err(e)=result { let _=git(&root,&["worktree","remove","--force",copy.to_str().unwrap()]).await; return Err(e); }
    let r=Review{completed:false,review_id:rid.clone(),project_id:s.project_id.clone(),session_id:s.session_id.clone(),copy,baseline_dir,baseline,discarded:false,applied:HashSet::new()};
    { let mut m=memory().lock().unwrap(); m.store.reviews.insert(rid.clone(),r.clone()); if let Some(s)=m.store.sessions.get_mut(&s.session_id) { s.review_id=Some(rid); } } persist(state)?; Ok(r)
}
fn delta_window_available(state:&HostState,request:&str)->bool {
    let tasks=state.tasks.lock().unwrap();let pending=|task:&crate::state::TaskRecord|->usize{if task.channel.is_none(){return 0;}task.events.iter().filter(|e|e["seq"].as_u64().unwrap_or(0)>task.ack&&e["payload"]["type"]=="data").map(|e|serde_json::to_vec(e).map_or(0,|v|v.len())).sum()};
    tasks.values().find(|t|t.call.request_id==request).is_some_and(|t|pending(t)<256*1024)&&tasks.values().map(pending).sum::<usize>()<3*1024*1024
}
fn emit(state: &HostState, request: &str, s: &Session, seq: &mut u64, run: &str, mut payload: Value) -> Result<()> {
    if payload["type"] == "textDelta" {
        // The run retains canonical text and persists it at settlement; a slow view receives the final content reference.
        if !delta_window_available(state,request){return Ok(());}
        if let Some(text) = payload["text"].as_str().filter(|t|t.len()>32*1024).map(str::to_owned) {
            let mut offset=0; while offset<text.len() { let mut end=(offset+32*1024).min(text.len());while !text.is_char_boundary(end){end-=1;}let mut chunk=payload.clone();chunk["text"]=json!(&text[offset..end]);emit(state,request,s,seq,run,chunk)?;offset=end;} return Ok(());
        }
    }
    if payload["type"] == "messageFinal" && payload["text"].as_str().is_some_and(|t|t.len()>32*1024) {
        let message_id=field(&payload,"messageId")?;let dir=data(state)?.join("messages").join(&s.session_id);private_dir(&dir)?;
        ensure_session_budget(state,&s.session_id,payload["text"].as_str().unwrap().len() as u64)?;fs::write(dir.join(format!("{message_id}.txt")),payload["text"].as_str().unwrap())?;
        payload["contentRef"]=json!({"messageId":message_id,"sessionId":s.session_id});payload["text"]=Value::Null;
    }
    *seq+=1; state.emit_task_data(request,"agent.event",json!({"sessionId":s.session_id,"instanceEpoch":s.instance_epoch,"seq":*seq,"runId":run,"payload":payload}))
}
fn kill_group(pid: u32) { #[cfg(unix)] unsafe { libc::kill(-(pid as i32),libc::SIGKILL); } }
pub fn resources(project_id: Option<&str>) -> Value {
    let m=memory().lock().unwrap();let mut resources=Vec::new();for r in m.runs.values().filter(|r|project_id.map_or(true,|p|p==r.project_id)){
        resources.push(json!({"id":r.instance_id,"type":"agent","ownerExtensionId":"horizon.agent","projectId":r.project_id,"sessionId":r.session_id,"requestId":r.request_id,"pid":r.pid,"state":"running"}));
        for pid in &r.execution_pids{resources.push(json!({"id":format!("{}-command-{pid}",r.instance_id),"type":"agentCommand","ownerExtensionId":"horizon.agent","projectId":r.project_id,"sessionId":r.session_id,"pid":pid,"state":"running"}));}
    }json!(resources)
}
pub async fn stop_extension(_extension_id: &str, project_id: Option<&str>) -> Result<Value> {
    let targets={ let mut m=memory().lock().unwrap(); let targets=m.runs.values().filter(|r|project_id.map_or(true,|p|p==r.project_id)).map(|r|{r.cancel.store(true,Ordering::SeqCst); let _=r.input.send(json!({"id":id(),"type":"clear_queue"}));let _=r.input.send(json!({"id":id(),"type":"abort"}));(r.session_id.clone(),r.pid)}).collect::<Vec<_>>(); let sessions=targets.iter().map(|t|t.0.clone()).collect::<HashSet<_>>(); m.permissions.retain(|_,p|!sessions.contains(&p.session_id)); targets };
    for _ in 0..30 { if targets.iter().all(|(sid,_)|!memory().lock().unwrap().runs.contains_key(sid)) { return Ok(json!({"closed":true,"forced":false})); } tokio::time::sleep(Duration::from_millis(100)).await; }
    for (_,pid) in &targets { kill_group(*pid); }
    for _ in 0..60 {if targets.iter().all(|(sid,_)|!memory().lock().unwrap().runs.contains_key(sid)){return Ok(json!({"closed":true,"forced":!targets.is_empty(),"effect":"unknown"}));}tokio::time::sleep(Duration::from_millis(50)).await;}
    Err(err("OUTCOME_UNKNOWN","Pi 终止尚未获得完整回收证据，保留资源记录"))
}

async fn broker_operation(state: Arc<HostState>, s: &Session, request: &str, root: &Path, operation: Value, cancelled: Arc<AtomicBool>) -> Result<String> {
    if cancelled.load(Ordering::SeqCst) { return Err(err("CANCELLED","任务已取消")); }
    let kind=field(&operation,"kind")?;
    if kind=="read" { let p=confined(root,field(&operation,"path")?)?; if fs::metadata(&p)?.len()>MAX_CONTEXT as u64 { return Err(err("FILE_TOO_LARGE","单次读取上限 256 KiB")); } return fs::read_to_string(p).map_err(Into::into); }
    if kind=="list" { let p=confined(root,field(&operation,"path")?)?; let mut names=Vec::new(); for e in fs::read_dir(p)?.take(2000) { let e=e?; if e.file_name()!=".git" { names.push(format!("{}{}",e.file_name().to_string_lossy(),if e.file_type()?.is_dir(){"/"}else{""})); } } names.sort(); return Ok(names.join("\n")); }
    if kind!="write" && kind!="exec" { return Err(err("PERMISSION_DENIED","未知工具操作")); }
    let (permission_operation, before)=if kind=="write" {
        let p=confined(root,field(&operation,"path")?)?; let text=field(&operation,"content")?; if text.len()>MAX_FILE { return Err(err("FILE_TOO_LARGE","工具写入超过 16 MiB")); } let before=disk_hash(&p)?;
        (json!({"kind":"write","files":[{"file":{"displayPath":operation["path"]},"beforeHash":before,"bytes":text.len().to_string()}]}),before)
    } else { let cwd=confined(root,operation["cwd"].as_str().unwrap_or("."))?; if !cwd.is_dir() { return Err(err("INVALID_ARGUMENT","命令工作目录不存在")); }
        let exe=field(&operation,"executable")?; if exe.is_empty() || exe.contains('\0') { return Err(err("INVALID_ARGUMENT","无效可执行文件")); }
        if operation["argv"].as_array().is_none_or(|a|a.iter().any(|v|v.as_str().is_none())) { return Err(err("INVALID_ARGUMENT","argv 必须为字符串数组")); }
        (json!({"kind":"exec","executable":exe,"argv":operation["argv"],"cwd":cwd,"network":[],"networkScope":"unknown"}),None)
    };
    let digest=hash(serde_json::to_vec(&json!({"session":s.session_id,"epoch":s.instance_epoch,"operation":operation}))?); let iid=id(); let (tx,rx)=oneshot::channel(); let expires=now()+120;
    memory().lock().unwrap().permissions.insert(iid.clone(),Permission{session_id:s.session_id.clone(),digest:digest.clone(),expires,answer:tx});
    state.emit_task_data(request,"agent.event",json!({"sessionId":s.session_id,"instanceEpoch":s.instance_epoch,"runId":request,"payload":{"type":"interaction","request":{"interactionId":iid,"sessionId":s.session_id,"runId":request,"kind":"permission","title":if kind=="write"{"写入任务副本"}else{"执行命令"},"message":"经 Horizon 工具请求授权。命令拥有当前用户系统权限；任务副本不是 OS 沙箱。","permission":{"permissionRequestId":iid,"taskId":state.task_id_for_request(request),"ownerExtensionId":"horizon.agent","operationDigest":digest,"expiresAt":expires,"operation":permission_operation}}}}))?;
    let approved=tokio::time::timeout(Duration::from_secs(120),rx).await.ok().and_then(|v|v.ok()).unwrap_or(false);
    memory().lock().unwrap().permissions.remove(&iid);
    state.emit_task_data(request,"agent.interactionResolved",json!({"interactionId":iid,"approved":approved}))?;
    if !approved || cancelled.load(Ordering::SeqCst) { return Err(err("PERMISSION_DENIED","操作被拒绝、已取消或授权已过期")); }
    if kind=="write" { let p=confined(root,field(&operation,"path")?)?; if disk_hash(&p)? != before { return Err(err("FILE_CHANGED","授权期间任务文件发生变化，请重新请求")); } if let Some(parent)=p.parent(){fs::create_dir_all(parent)?;} fs::write(p,field(&operation,"content")?)?; return Ok("Written to the task copy. Original project unchanged.".into()); }
    let cwd=confined(root,operation["cwd"].as_str().unwrap_or("."))?;
    let mut cmd=Command::new(field(&operation,"executable")?); cmd.args(operation["argv"].as_array().unwrap().iter().map(|v|v.as_str().unwrap())).current_dir(cwd).env_clear().env("PATH","/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin").env("LANG","en_US.UTF-8").env("TMPDIR",std::env::temp_dir());
    if let Some(home)=std::env::var_os("HOME") { cmd.env("HOME",home); }
    cmd.stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true); #[cfg(unix)] { cmd.process_group(0); }
    let mut child=cmd.spawn()?; let pid=child.id().unwrap_or_default();let _group=ProcessGroupGuard(pid,s.session_id.clone());if let Some(run)=memory().lock().unwrap().runs.get_mut(&s.session_id){run.execution_pids.insert(pid);} let stdout=child.stdout.take().unwrap();let stderr=child.stderr.take().unwrap();
    let output=tokio::spawn(async move { let mut out=Vec::new();let mut errors=Vec::new(); let mut stdout=stdout.take(512*1024);let mut stderr=stderr.take(128*1024);let (a,b)=tokio::join!(stdout.read_to_end(&mut out),stderr.read_to_end(&mut errors)); let _=(a,b); (out,errors) });
    let deadline=tokio::time::Instant::now()+Duration::from_secs(60);
    let status=loop { tokio::select! { r=child.wait()=>break r?, _=tokio::time::sleep(Duration::from_millis(50))=>{if cancelled.load(Ordering::SeqCst)||tokio::time::Instant::now()>deadline {kill_group(pid);let _=child.wait().await;output.abort();return Err(err("CANCELLED","命令已停止或超过 60 秒上限"));}} } };
    // Descendants belong to this tool invocation, including ones that outlived their leader.
    kill_group(pid);
    let (out,errors)=tokio::time::timeout(Duration::from_secs(1),output).await.ok().and_then(|v|v.ok()).unwrap_or_default();
    Ok(format!("Exit code: {:?}\n{}\n{}",status.code(),String::from_utf8_lossy(&out),String::from_utf8_lossy(&errors)))
}
async fn start_broker(state: Arc<HostState>, s: Session, request: String, root: PathBuf, socket: PathBuf, token: String, cancelled: Arc<AtomicBool>) -> Result<tokio::task::JoinHandle<()>> {
    let listener=UnixListener::bind(&socket)?; #[cfg(unix)] { use std::os::unix::fs::PermissionsExt;fs::set_permissions(&socket,fs::Permissions::from_mode(0o600))?; }
    Ok(tokio::spawn(async move { loop { let Ok((stream,_))=listener.accept().await else{break}; let (reader,mut writer)=stream.into_split();let mut line=String::new();let read=tokio::time::timeout(Duration::from_secs(3),BufReader::new(reader).take((MAX_FILE+65536) as u64).read_line(&mut line)).await;
        let reply=if read.is_err(){Err(err("PERMISSION_DENIED","策略桥超时"))}else{match serde_json::from_str::<Value>(&line){Ok(v) if v["version"]==1 && v["token"]==token=>broker_operation(state.clone(),&s,&request,&root,v["operation"].clone(),cancelled.clone()).await,_=>Err(err("PERMISSION_DENIED","策略桥身份验证失败"))}};
        let response=match reply{Ok(text)=>json!({"ok":true,"text":text}),Err(e)=>json!({"ok":false,"error":e.message})};let _=writer.write_all(format!("{response}\n").as_bytes()).await;
    }}))
}
fn assistant_text(message: &Value) -> String { message["content"].as_array().map(|a|a.iter().filter(|v|v["type"]=="text").filter_map(|v|v["text"].as_str()).collect::<Vec<_>>().join("\n")).unwrap_or_default() }
fn directory_bytes(path:&Path)->Result<u64>{
    if !path.exists(){return Ok(0);}let meta=fs::symlink_metadata(path)?;if !meta.is_dir(){return Ok(meta.len());}
    let mut size=0u64;for entry in fs::read_dir(path)?{size=size.saturating_add(directory_bytes(&entry?.path())?);}Ok(size)
}
fn session_storage_bytes(state:&HostState,sid:&str)->Result<u64>{
    let base=data(state)?;Ok(directory_bytes(&base.join("sessions").join(sid))?+directory_bytes(&base.join("messages").join(sid))?+directory_bytes(&base.join("transcripts").join(format!("{sid}.jsonl")))?)
}
fn ensure_session_budget(state:&HostState,sid:&str,additional:u64)->Result<()> {
    if session_storage_bytes(state,sid)?.saturating_add(additional)>MAX_SESSION_BYTES{return Err(err("RESOURCE_LIMIT","此会话记录已达 32 MiB 上限。已有记录保留，请新建会话或在设置中清理历史。"));}Ok(())
}
async fn next_pi_record<R:tokio::io::AsyncBufRead+Unpin>(reader:&mut R,pending:&mut Vec<u8>)->Result<Option<String>> {
    loop {
        let chunk=reader.fill_buf().await?;
        if chunk.is_empty(){if pending.is_empty(){return Ok(None);}return String::from_utf8(std::mem::take(pending)).map(Some).map_err(|_|err("AGENT_PROTOCOL_ERROR","Pi stdout 不是 UTF-8"));}
        let newline=chunk.iter().position(|b|*b==b'\n');let take=newline.map_or(chunk.len(),|i|i+1);
        if pending.len()+take>MAX_PI_RECORD_BYTES{return Err(err("RESOURCE_LIMIT","Pi 单条记录超过 4 MiB 上限"));}
        pending.extend_from_slice(&chunk[..take]);reader.consume(take);
        if newline.is_some(){return String::from_utf8(std::mem::take(pending)).map(Some).map_err(|_|err("AGENT_PROTOCOL_ERROR","Pi stdout 不是 UTF-8"));}
    }
}
async fn run_pi(state: Arc<HostState>, call: &Call, mut s: Session, c: Connection, prompt: String, snapshot: Option<Snapshot>, is_test: bool) -> Result<Value> {
    if !is_test{ensure_session_budget(&state,&s.session_id,0)?;}
    let probe=detect(&state,&c.runtime).await?; if probe["supported"]!=true {return Err(err("AGENT_UNAVAILABLE","请安装或定位经过验证的 Pi 1.4.0"));}
    let agent_dir=configure(&state,&c)?; let project=if is_test { let p=data(&state)?.join("connection-test-cwd");private_dir(&p)?;p } else { state.project_root(&s.project_id)? }; let mut review=None;
    if s.profile=="task" { let empty=Snapshot{session_id:s.session_id.clone(),digest:String::new(),items:vec![],texts:vec![],created:now(),buffer_bases:HashMap::new()}; let selected=call.params["selectedUntracked"].as_array().map(|a|a.iter().filter_map(|v|v.as_str().map(str::to_owned)).collect::<Vec<_>>()).unwrap_or_default(); review=Some(prepare_copy(&state,&s,snapshot.as_ref().unwrap_or(&empty),&selected).await?); }
    s.review_id=review.as_ref().map(|r|r.review_id.clone());
    let cwd=review.as_ref().map(|r|r.copy.clone()).unwrap_or(project); let work_dir=data(&state)?.join("sessions").join(&s.session_id);private_dir(&work_dir)?;
    s.instance_epoch+=1; s.instance_id=Some(id());s.state="running".into();
    let run_id=call.request_id.clone();let cancelled=Arc::new(AtomicBool::new(false));let socket=std::env::temp_dir().join(format!("hzn-{}.sock",id()));let token=id()+&id();
    let mut broker=BrokerGuard{task:if s.profile=="task" {Some(start_broker(state.clone(),s.clone(),run_id.clone(),cwd.clone(),socket.clone(),token.clone(),cancelled.clone()).await?)}else{None},socket:socket.clone()};
    let policy_path=agent_dir.join("horizon-policy.ts");fs::write(&policy_path,POLICY)?;
    let mut cmd=Command::new(executable(&state,&c.runtime));cmd.args(["--mode","rpc"]).args(RESOURCE_FLAGS).args(["--provider",field(&c.provider,"id")?,"--model",field(&c.provider,"model")?,"--thinking","off"]).current_dir(&cwd).env_clear();
    if is_test{cmd.arg("--no-session");}else{cmd.args(["--session",&s.pi_file]);}
    for k in ["HOME","TMPDIR","LANG","LC_ALL","SSL_CERT_FILE","SSL_CERT_DIR"] {if let Some(v)=std::env::var_os(k){cmd.env(k,v);}}
    cmd.env("PATH","/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin").env("PI_CODING_AGENT_DIR",&agent_dir).env("PI_OFFLINE","1").env("PI_SKIP_VERSION_CHECK","1").env("PI_TELEMETRY","0");
    let secret=if c.auth_owner=="horizon"{c.provider["credentialRef"].as_str().map(|key|state.credential_secret(key)).transpose()?}else{None};if let Some(key)=&secret{cmd.env("HORIZON_MODEL_KEY",key);}
    if s.profile=="task"{cmd.args(["--no-builtin-tools","--tools","horizon_read,horizon_list,horizon_write,horizon_exec","-e"]).arg(&policy_path).env("HORIZON_BROKER_SOCKET",&socket).env("HORIZON_BROKER_TOKEN",&token);}else{cmd.arg("--no-tools");}
    cmd.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).kill_on_drop(true);#[cfg(unix)]{cmd.process_group(0);}
    state.validate_scope(call)?;crate::extensions::extension_gate(&state,"horizon.agent",if is_test {None}else{Some(&s.project_id)})?;if state.is_cancelled(&run_id){return Err(err("CANCELLED","任务在启动前已取消"));}
    // Reserve one run per project, at most two instances; reservation and spawn are atomic.
    let mut child={let mut m=memory().lock().unwrap();if !is_test&&!m.store.sessions.contains_key(&s.session_id){return Err(err("NOT_FOUND","会话已移除"));}if m.runs.values().any(|r|r.project_id==s.project_id){if let Some(b)=&broker.task{b.abort();}return Err(err("AGENT_BUSY","此项目已有运行任务"));}if m.runs.len()>=2{if let Some(b)=&broker.task{b.abort();}return Err(err("RESOURCE_BUSY","最多同时运行两个 Pi 实例"));}let child=cmd.spawn()?;let (input,_) = mpsc::unbounded_channel();m.runs.insert(s.session_id.clone(),Running{session_id:s.session_id.clone(),connection_id:s.connection_id.clone(),project_id:s.project_id.clone(),request_id:run_id.clone(),instance_id:s.instance_id.clone().unwrap(),cancel:cancelled.clone(),input,pid:child.id().unwrap_or_default(),execution_pids:HashSet::new()});child};
    let pid=child.id().unwrap_or_default();let mut stdin=child.stdin.take().unwrap();let stdout=child.stdout.take().unwrap();let stderr=child.stderr.take().unwrap();let (input,mut receiver)=mpsc::unbounded_channel::<Value>();
    {let mut m=memory().lock().unwrap();m.runs.get_mut(&s.session_id).unwrap().input=input.clone();if !is_test {m.store.sessions.insert(s.session_id.clone(),s.clone());}}
    let mut writer=tokio::spawn(async move{while let Some(v)=receiver.recv().await{if v["__horizonClose"]==true{break;}if stdin.write_all(format!("{v}\n").as_bytes()).await.is_err(){break;}}let _=stdin.shutdown().await;});
    let diagnostic=tokio::spawn(async move{let mut buf=Vec::new();let _=stderr.take(64*1024).read_to_end(&mut buf).await;String::from_utf8_lossy(&buf).to_string()});
    let ready_id=id();input.send(json!({"id":ready_id,"type":"get_state"})).map_err(|_|err("PROCESS_EXITED","Pi 已退出"))?;
    let mut reader=BufReader::new(stdout);let mut pending_record=Vec::new();let mut seq=0;let mut disposition=String::new();let mut failed=None;let mut settled=false;let mut cancelled_sent=false;let mut current_message=id();let mut current_text=String::new();let mut current_recorded=false;let mut final_text=String::new();let mut message_final_count=0;let mut startup=true;let started=tokio::time::Instant::now();let mut cancel_at=None;
    let result: Result<Value>=async{loop{tokio::select!{
        line=next_pi_record(&mut reader,&mut pending_record)=>{
            let Some(line)=line? else{return Err(err("PROCESS_EXITED","Pi 在终态前退出；任务效果未知"));};
            let v:Value=serde_json::from_str(&line).map_err(|_|err("AGENT_PROTOCOL_ERROR","Pi stdout 含无效 JSONL"))?;let kind=field(&v,"type")?;
            if kind=="response"{
                if v["id"]==ready_id {if v["success"]!=true{return Err(err("AGENT_PROTOCOL_ERROR","Pi 状态检查失败"));}startup=false;if cancelled.load(Ordering::SeqCst)||state.is_cancelled(&run_id){return Err(err("CANCELLED","输入在发送给 Pi 前已取消"));}let _=input.send(json!({"id":run_id,"type":"prompt","message":prompt}));}
                if v["id"]==run_id {if v["success"]!=true{return Err(err("AGENT_REJECTED",v["error"].as_str().unwrap_or("Pi 拒绝输入")));} disposition=field(&v["data"],"disposition")?.into();state.emit_task_data(&run_id,"agent.accepted",json!({"submissionId":call.params["submissionId"],"disposition":disposition,"runId":if disposition=="handled"{Value::Null}else{json!(run_id)}}))?;if disposition=="handled"{break;}if disposition=="queued"{return Err(err("AGENT_PROTOCOL_ERROR","本版不接受排队输入；已关闭实例"));}if disposition!="started"{return Err(err("AGENT_PROTOCOL_ERROR","未知输入 disposition"));}}
                continue;
            }
            if !is_test&&matches!(kind,"message_end"|"compaction_end"|"auto_compaction_end"){ensure_session_budget(&state,&s.session_id,0)?;}
            match kind {
                "agent_start"=>{if seq==0{emit(&state,&run_id,&s,&mut seq,&run_id,json!({"type":"runStarted","submissionId":call.params["submissionId"]}))?;}},
                "message_start"=>{if v["message"]["role"]=="assistant"{current_message=id();current_text.clear();current_recorded=false;}},
                "message_update"=>{let e=&v["assistantMessageEvent"];if e["type"]=="text_delta"{let delta=e["delta"].as_str().unwrap_or("");if current_text.len()+delta.len()>MAX_PI_RECORD_BYTES{return Err(err("RESOURCE_LIMIT","Pi 单条消息超过 4 MiB 上限；已有内容保留"));}current_text.push_str(delta);emit(&state,&run_id,&s,&mut seq,&run_id,json!({"type":"textDelta","messageId":current_message,"blockIndex":e["contentIndex"],"text":e["delta"]}))?;}},
                "message_end"=>{let message=&v["message"];if message["role"]=="assistant" {let text=assistant_text(message);final_text=text.clone();message_final_count+=1;let stop=message["stopReason"].as_str().unwrap_or("");if stop=="error"{failed=Some(message["errorMessage"].as_str().unwrap_or("模型调用失败").to_string());}if stop=="aborted"{cancelled.store(true,Ordering::SeqCst);}emit(&state,&run_id,&s,&mut seq,&run_id,json!({"type":"messageFinal","messageId":current_message,"text":text,"stopReason":stop}))?;if !is_test{append_message(&state,&s.session_id,json!({"messageId":current_message,"role":"assistant","text":text,"state":stop}))?;current_recorded=true;}}},
                "tool_execution_start"|"tool_execution_end"=>emit(&state,&run_id,&s,&mut seq,&run_id,json!({"type":"toolState","toolCallId":v["toolCallId"],"name":v["toolName"],"state":if kind=="tool_execution_start"{"requested"}else if v["isError"]==true{"failed"}else{"succeeded"}}))?,
                "auto_retry_start"|"auto_compaction_start"=>emit(&state,&run_id,&s,&mut seq,&run_id,json!({"type":"phase","phase":if kind=="auto_retry_start"{"retrying"}else{"compacting"}}))?,
                "extension_ui_request"=>{let method=v["method"].as_str().unwrap_or("");if !["notify","setStatus","setWidget","setTitle","set_editor_text"].contains(&method){let _=input.send(json!({"type":"extension_ui_response","id":v["id"],"cancelled":true}));}},
                "agent_settled"=>{settled=true;if v["aborted"]==true{cancelled.store(true,Ordering::SeqCst);}break;},
                _=>{}
            }
        },
        _=tokio::time::sleep(Duration::from_millis(50))=>{
            if startup&&started.elapsed()>Duration::from_secs(20){return Err(err("TIMEOUT","Pi 启动超时"));}
            if state.is_cancelled(&run_id){cancelled.store(true,Ordering::SeqCst);}
            if cancelled.load(Ordering::SeqCst)&&!cancelled_sent{cancelled_sent=true;cancel_at=Some(tokio::time::Instant::now());memory().lock().unwrap().permissions.retain(|_,p|p.session_id!=s.session_id);let _=input.send(json!({"id":id(),"type":"clear_queue"}));let _=input.send(json!({"id":id(),"type":"abort"}));}
            if cancel_at.is_some_and(|t|t.elapsed()>Duration::from_secs(3)){return Err(err("CANCELLED","Pi 中断超时，已终止自有进程组；效果未知"));}
        }
    }}
    if disposition=="handled"{return Ok(json!({"disposition":"handled","runId":null}));}
    if !settled{return Err(err("AGENT_PROTOCOL_ERROR","未观察到 agent_settled"));}
    let status=if cancelled.load(Ordering::SeqCst){"cancelled"}else if failed.is_some()||message_final_count==0{"failed"}else{"succeeded"};
    let safe_error=failed.map(|e|secret.as_ref().map_or(e.clone(),|key|e.replace(key,"[redacted]")));
    emit(&state,&run_id,&s,&mut seq,&run_id,json!({"type":"runSettled","state":status,"effect":if s.profile=="task"{"taskCopy"}else{"none"},"error":safe_error}))?;
    if status=="cancelled"{return Err(err("CANCELLED","Pi 已确认中断；已有任务副本结果仍可审查"));}
    if status=="failed"{let auth=safe_error.as_deref().is_some_and(|e|e.contains("401")||e.contains("403")||e.to_ascii_lowercase().contains("no api key")||e.to_ascii_lowercase().contains("no credentials"));if auth{if let Some(connection)=memory().lock().unwrap().store.connections.get_mut(&c.connection_id){connection.auth_state="needsAuthentication".into();}}return Err(err(if auth{"AUTH_REQUIRED"}else{"AGENT_FAILED"},safe_error.unwrap_or_else(||"Pi 未产生有效结果".into())));}
    Ok(json!({"state":status,"sessionId":s.session_id,"text":text_prefix(&final_text,MESSAGE_PAGE_BYTES),"contentRef":if final_text.len()>MESSAGE_PAGE_BYTES{json!({"sessionId":s.session_id,"messageId":current_message})}else{Value::Null},"reviewId":review.as_ref().map(|r|&r.review_id),"disposition":disposition,"runId":run_id}))}.await;
    if result.is_err()&&!is_test&&!current_recorded&&!current_text.is_empty(){let _=append_message(&state,&s.session_id,json!({"messageId":current_message,"role":"assistant","text":current_text,"state":"interrupted"}));}
    cancelled.store(true,Ordering::SeqCst);{let mut m=memory().lock().unwrap();m.permissions.retain(|_,p|p.session_id!=s.session_id);if let Some(session)=m.store.sessions.get_mut(&s.session_id){session.state="closing".into();}}
    let _=input.send(json!({"__horizonClose":true}));drop(input);if tokio::time::timeout(Duration::from_millis(200),&mut writer).await.is_err(){writer.abort();let _=writer.await;}
    if tokio::time::timeout(Duration::from_secs(3),child.wait()).await.is_err(){kill_group(pid);let _=child.wait().await;} kill_group(pid);
    for _ in 0..20{if memory().lock().unwrap().runs.get(&s.session_id).is_none_or(|r|r.execution_pids.is_empty()){break;}tokio::time::sleep(Duration::from_millis(50)).await;}broker.shutdown().await;drop(broker);diagnostic.abort();{let mut m=memory().lock().unwrap();m.runs.remove(&s.session_id);if let Some(session)=m.store.sessions.get_mut(&s.session_id){session.state="dormant".into();session.instance_id=None;session.resume_available=true;}}if !is_test{persist(&state)?;}else{let _=fs::remove_dir_all(&work_dir);}result
}

fn get_review(call: &Call) -> Result<Review> { let rid=field(&call.params,"reviewId")?;let r=memory().lock().unwrap().store.reviews.get(rid).cloned().ok_or_else(||err("NOT_FOUND","任务审查不存在"))?;if call.scope["projectId"].as_str()!=Some(&r.project_id){return Err(err("STALE_SCOPE","任务审查不属于当前项目"));}if r.discarded{return Err(err("NOT_FOUND","任务副本已放弃"));}Ok(r) }
async fn review_files(state: &HostState, r: &Review) -> Result<Vec<Value>> {
    let root=state.project_root(&r.project_id)?;let mut paths=r.baseline.keys().cloned().collect::<HashSet<_>>();
    for p in git(&r.copy,&["ls-files","--cached","--others","--exclude-standard","-z"]).await?.split(|b|*b==0).filter(|s|!s.is_empty()){if let Ok(s)=std::str::from_utf8(p){paths.insert(s.into());}}
    let mut files=Vec::new();for rel in paths{let target=match confined(&r.copy,&rel){Ok(p)=>p,Err(_)=>continue};if target.is_dir(){continue;}let after=disk_hash(&target)?;let b=r.baseline.get(&rel);let before=b.and_then(|b|b.baseline_hash.clone());if before==after{continue;}
        let original=confined(&root,&rel)?;let file=state.file_ref(&r.project_id,&original)?;let unchanged=disk_hash(&original)?==b.and_then(|b|b.original_hash.clone());let applied=r.applied.contains(&rel);
        files.push(json!({"file":file,"relativePath":rel,"baselineHash":before,"afterHash":after,"expectedDiskRevision":b.map(|b|b.disk_revision.clone()).unwrap_or(Value::Null),"expectedEditorRevision":b.and_then(|b|b.editor_revision),"kind":if before.is_none(){"added"}else if after.is_none(){"deleted"}else{"modified"},"canApply":unchanged&&!applied,"applied":applied,"reason":if applied{Some("已应用")}else if !unchanged{Some("原项目文件已改变，请手动合并")}else{None}}));}
    files.sort_by(|a,b|a["relativePath"].as_str().cmp(&b["relativePath"].as_str()));Ok(files)
}
async fn context_prepare(state: &HostState, call: &Call) -> Result<Value> {
    let s=session(call)?;let inputs=call.params["items"].as_array().ok_or_else(||err("INVALID_ARGUMENT","items 必须为数组"))?;if inputs.len()>20{return Err(err("CONTEXT_TOO_LARGE","最多附加 20 项"));}
    let root=state.project_root(&s.project_id)?;let mut items=Vec::new();let mut texts=Vec::new();let mut buffer_bases=HashMap::new();let mut total=0;
    for input in inputs {let source=field(input,"source")?;let (file,text,editor_revision,document_id)=match source{
        "disk"=>{let p=state.resolve_file(&s.project_id,field(input,"fileId")?)?;if fs::metadata(&p)?.len()>MAX_FILE as u64{return Err(err("CONTEXT_TOO_LARGE","文件超过 16 MiB"));}let revision=crate::files::disk_revision(&p)?;if input["expectedDiskRevision"]!=revision{return Err(err("STALE_VERSION","附件磁盘版本已变化"));}let text=fs::read_to_string(&p)?;if crate::files::disk_revision(&p)?!=revision{return Err(err("FILE_CHANGED","冻结附件时文件已变化"));}(state.file_ref(&s.project_id,&p)?,text,None,None)},
        "buffer"=>{let did=field(input,"documentId")?;let meta=state.document_meta(did)?;if meta["file"]["projectId"]!=s.project_id||meta["editorRevision"]!=input["editorRevision"]{return Err(err("STALE_VERSION","附件编辑版本或项目已变化"));}let text=field(input,"text")?;if text.len()>MAX_FILE{return Err(err("CONTEXT_TOO_LARGE","缓冲区超过 16 MiB"));}(meta["file"].clone(),text.into(),input["editorRevision"].as_u64(),Some(did.to_string()))},
        "gitDiff"=>{let diff=crate::git::read_diff_snapshot(state,&s.project_id,field(input,"diffId")?,field(input,"expectedRepoToken")?).await?;(diff["file"].clone(),field(&diff,"text")?.into(),None,None)},
        _=>return Err(err("INVALID_ARGUMENT","未知上下文来源"))};
        let path=state.resolve_file(&s.project_id,field(&file,"fileId")?)?;let relative=path.strip_prefix(&root).map_err(|_|err("STALE_SCOPE","附件不属于项目"))?.to_string_lossy().to_string();
        if source=="buffer"&&s.profile=="task" {buffer_bases.insert(relative.clone(),text.clone());if buffer_bases.values().map(String::len).sum::<usize>()>MAX_SNAPSHOT_BYTES{return Err(err("CONTEXT_TOO_LARGE","任务缓冲区全文基线超过 128 MiB，请减少附件"));}}
        let selected=if let Some(range)=input.get("range").filter(|v|!v.is_null()){let units=text.encode_utf16().collect::<Vec<_>>();let a=range["fromUtf16"].as_u64().ok_or_else(||err("INVALID_ARGUMENT","无效选区"))? as usize;let b=range["toUtf16"].as_u64().ok_or_else(||err("INVALID_ARGUMENT","无效选区"))? as usize;if a>b||b>units.len(){return Err(err("INVALID_ARGUMENT","附件选区越界"));}String::from_utf16(&units[a..b]).map_err(|_|err("INVALID_ARGUMENT","选区切断 Unicode 字符"))?}else{text};
        total+=selected.len();if total>MAX_CONTEXT{return Err(err("CONTEXT_TOO_LARGE","附件总计超过 256 KiB，请删减或分批"));}
        items.push(json!({"id":id(),"file":file,"source":source,"relativePath":relative,"documentId":document_id,"editorRevision":editor_revision,"diskRevision":input["expectedDiskRevision"],"range":input["range"],"diffId":input["diffId"],"repoToken":input["expectedRepoToken"],"byteLength":selected.len().to_string(),"contentHash":hash(&selected)}));texts.push(selected);
    }
    let sid=id();let digest=hash(serde_json::to_vec(&items)?);let expires=now()+3600;
    let mut m=memory().lock().unwrap();m.snapshots.retain(|_,cached|cached.session_id!=s.session_id&&now().saturating_sub(cached.created)<3600);
    let snapshot_bytes=buffer_bases.values().map(String::len).sum::<usize>()+texts.iter().map(String::len).sum::<usize>();
    while m.snapshots.len()>=8 || (!m.snapshots.is_empty()&&m.snapshots.values().map(|v|v.buffer_bases.values().map(String::len).sum::<usize>()+v.texts.iter().map(String::len).sum::<usize>()).sum::<usize>()+snapshot_bytes>MAX_SNAPSHOT_BYTES) {let oldest=m.snapshots.iter().min_by_key(|(_,v)|v.created).map(|(k,_)|k.clone()).unwrap();m.snapshots.remove(&oldest);}
    m.snapshots.insert(sid.clone(),Snapshot{session_id:s.session_id,digest:digest.clone(),items:items.clone(),texts,created:now(),buffer_bases});drop(m);Ok(json!({"snapshotId":sid,"manifestDigest":digest,"items":items,"totalBytes":total.to_string(),"expiresAt":expires}))
}
async fn finish_review_if_applied(state:&HostState,review_id:&str)->Result<()> {
    let r=memory().lock().unwrap().store.reviews.get(review_id).cloned().ok_or_else(||err("NOT_FOUND","审查不存在"))?;
    let files=review_files(state,&r).await?;if !files.is_empty()&&files.iter().all(|f|f["applied"]==true){let mut m=memory().lock().unwrap();if let Some(r)=m.store.reviews.get_mut(review_id){r.completed=true;}if let Some(s)=m.store.sessions.get_mut(&r.session_id){if s.review_id.as_deref()==Some(review_id){s.review_id=None;}}}Ok(())
}

async fn apply_review(state: &HostState, call: &Call, r: &Review) -> Result<Value> {
    if memory().lock().unwrap().runs.contains_key(&r.session_id){return Err(err("AGENT_BUSY","请等待任务结束后应用"));}
    let files=review_files(state,r).await?;let targets=call.params["targets"].as_array().ok_or_else(||err("INVALID_ARGUMENT","缺少应用目标"))?;let root=state.project_root(&r.project_id)?;let open=state.open_documents(Some(&r.project_id));let mut results=Vec::new();
    for target in targets {let fid=field(target,"fileId")?;let outcome=(||->Result<Value>{
        let _file_guard=state.file_lock.lock().unwrap();
        let item=files.iter().find(|f|f["file"]["fileId"]==fid).ok_or_else(||err("NOT_FOUND","审查文件不存在"))?;if item["canApply"]!=true{return Err(err("FILE_CHANGED","原文件已变化或该修改已应用"));}let rel=field(item,"relativePath")?;let original=confined(&root,rel)?;let b=r.baseline.get(rel);
        if target["expectedDiskRevision"]!=item["expectedDiskRevision"] {return Err(err("STALE_VERSION","应用请求未绑定审查基线"));}
        if disk_hash(&original)?!=b.and_then(|b|b.original_hash.clone()){return Err(err("FILE_CHANGED","原项目文件已经改变"));}
        if original.exists() && !item["expectedDiskRevision"].is_null() && crate::files::disk_revision(&original)?!=item["expectedDiskRevision"]{return Err(err("FILE_CHANGED","文件身份或时间已变化，请刷新审查"));}
        let after=confined(&r.copy,rel)?;if let Some(doc)=open.iter().find(|d|d["file"]["fileId"]==fid||d["fileId"]==fid){
            if !after.exists(){return Err(err("DOCUMENT_OPEN","关闭该文档并确认删除后重试"));}
            let expected=b.and_then(|b|b.editor_revision).or_else(||target["expectedEditorRevision"].as_u64()).unwrap_or(doc["editorRevision"].as_u64().unwrap_or(0));
            if doc["editorRevision"].as_u64()!=Some(expected){return Err(err("STALE_VERSION","文档编辑版本已变化"));}
            if doc["state"]!="clean" && !b.is_some_and(|b|b.buffer_selected){return Err(err("STALE_VERSION","文档含未包含在任务基线中的编辑，请手动合并"));}
            let text=fs::read_to_string(after)?;let document_id=field(doc,"documentId")?;let proposed=state.document_propose(document_id,expected,&text)?;
            memory().lock().unwrap().applications.insert(field(&proposed,"proposalId")?.into(),EditorApplication{review_id:r.review_id.clone(),relative:rel.into(),document_id:document_id.into(),content_hash:hash(&text),expected_revision:expected});
            return Ok(json!({"fileId":fid,"state":"proposed","applicationId":proposed["proposalId"],"detail":proposed}));
        }
        if after.exists(){if let Some(p)=original.parent(){fs::create_dir_all(p)?;}let tmp=original.with_file_name(format!(".horizon-{}",id()));copy_file(&after,&tmp)?;if disk_hash(&original)?!=b.and_then(|b|b.original_hash.clone()){let _=fs::remove_file(tmp);return Err(err("FILE_CHANGED","写入前原文件已变化"));}fs::rename(tmp,&original)?;}else if original.exists(){fs::remove_file(&original)?;}
        if let Some(stored)=memory().lock().unwrap().store.reviews.get_mut(&r.review_id){stored.applied.insert(rel.into());}Ok(json!({"fileId":fid,"state":"applied"}))})();
        results.push(outcome.unwrap_or_else(|e|json!({"fileId":fid,"state":"failed","error":e})));
    }finish_review_if_applied(state,&r.review_id).await?;persist(state)?;Ok(json!({"results":results}))
}

fn public_session(s:&Session)->Value { json!({"sessionId":s.session_id,"projectId":s.project_id,"connectionId":s.connection_id,"profile":s.profile,"state":s.state,"instanceId":s.instance_id,"instanceEpoch":s.instance_epoch,"resumeAvailable":s.resume_available,"reviewId":s.review_id,"createdAt":s.created_at}) }
fn text_prefix(text:&str,bytes:usize)->&str {let mut end=text.len().min(bytes);while !text.is_char_boundary(end){end-=1;}&text[..end]}
fn message_preview(state:&HostState,sid:&str,mut message:Value)->Result<Value> {
    if let Some(text)=message["text"].as_str().filter(|text|text.len()>MESSAGE_PAGE_BYTES).map(str::to_owned) {
        let mid=field(&message,"messageId")?.to_owned();let dir=data(state)?.join("messages").join(sid);private_dir(&dir)?;let path=dir.join(format!("{mid}.txt"));if !path.exists(){ensure_session_budget(state,sid,text.len() as u64)?;fs::write(path,&text)?;}
        message["text"]=json!(text_prefix(&text,MESSAGE_PAGE_BYTES));message["contentRef"]=json!({"sessionId":sid,"messageId":mid});message["truncated"]=json!(true);
    }Ok(message)
}
fn append_message(state:&HostState,sid:&str,message:Value)->Result<()> {
    use std::io::Write;
    let message=message_preview(state,sid,message)?;
    let dir=data(state)?.join("transcripts");private_dir(&dir)?;let path=dir.join(format!("{sid}.jsonl"));let exists=path.exists();let mut bytes=serde_json::to_vec(&message)?;bytes.push(b'\n');ensure_session_budget(state,sid,bytes.len() as u64)?;let mut file=fs::OpenOptions::new().create(true).append(true).open(path)?;
    let mut m=memory().lock().unwrap();if let Some(s)=m.store.sessions.get_mut(sid){if !exists{for old in &s.messages{let mut bytes=serde_json::to_vec(old)?;bytes.push(b'\n');file.write_all(&bytes)?;}}s.messages.clear();}drop(m);
    file.write_all(&bytes)?;
    // Transcript is authoritative; completed message bodies need no resident cache.
    Ok(())
}
fn transcript_page(state:&HostState,s:&Session,cursor:Option<&str>,limit:usize)->Result<Value>{
    use std::io::BufRead;
    let path=data(state)?.join("transcripts").join(format!("{}.jsonl",s.session_id));
    if !path.exists(){let end=cursor.and_then(|c|c.parse::<usize>().ok()).unwrap_or(s.messages.len()).min(s.messages.len());let begin=end.saturating_sub(limit);let items=s.messages[begin..end].iter().cloned().map(|m|message_preview(state,&s.session_id,m)).collect::<Result<Vec<_>>>()?;return Ok(json!({"items":items,"nextCursor":if begin>0{Some(begin.to_string())}else{None}}));}
    let total=std::io::BufReader::new(fs::File::open(&path)?).lines().count();let end=cursor.and_then(|c|c.parse::<usize>().ok()).unwrap_or(total).min(total);let begin=end.saturating_sub(limit);
    let mut items=Vec::new();for line in std::io::BufReader::new(fs::File::open(path)?).lines().skip(begin).take(end-begin){items.push(message_preview(state,&s.session_id,serde_json::from_str::<Value>(&line?)?)?);}
    Ok(json!({"items":items,"nextCursor":if begin>0{Some(begin.to_string())}else{None}}))
}
fn message_page(state:&HostState,s:&Session,mid:&str,cursor:Option<&str>)->Result<Value>{
    use std::io::{Read,Seek,SeekFrom};
    if Uuid::parse_str(mid).is_err(){return Err(err("INVALID_ARGUMENT","无效消息 ID"));}
    let mut file=fs::File::open(data(state)?.join("messages").join(&s.session_id).join(format!("{mid}.txt")))?;let size=file.metadata()?.len();let offset=cursor.and_then(|v|v.parse::<u64>().ok()).unwrap_or(0);if offset>size{return Err(err("INVALID_ARGUMENT","消息游标无效"));}file.seek(SeekFrom::Start(offset))?;
    let mut bytes=Vec::new();file.take(MESSAGE_PAGE_BYTES as u64).read_to_end(&mut bytes)?;let valid=match std::str::from_utf8(&bytes){Ok(_)=>bytes.len(),Err(e) if e.error_len().is_none()=>e.valid_up_to(),Err(_)=>return Err(err("INVALID_ARGUMENT","消息游标未落在 UTF-8 字符边界"))};let text=std::str::from_utf8(&bytes[..valid]).map_err(|_|err("INVALID_ARGUMENT","消息内容编码无效"))?;let next=offset+valid as u64;
    Ok(json!({"text":text,"nextCursor":if next<size{Some(next.to_string())}else{None},"totalBytes":size.to_string()}))
}
fn history_fingerprint(state:&HostState,s:&Session)->Result<(u64,String)> {
    let base=data(state)?;let mut entries=Vec::new();let mut bytes=0u64;
    fn walk(path:&Path,entries:&mut Vec<Value>,bytes:&mut u64)->Result<()> {if !path.exists(){return Ok(());}let meta=fs::symlink_metadata(path)?;if meta.is_dir(){for entry in fs::read_dir(path)?{walk(&entry?.path(),entries,bytes)?;}}else{*bytes+=meta.len();entries.push(json!({"path":path,"size":meta.len(),"modified":meta.modified().ok().and_then(|t|t.duration_since(UNIX_EPOCH).ok()).map(|d|d.as_nanos().to_string())}));}Ok(())}
    for path in [base.join("sessions").join(&s.session_id),base.join("transcripts").join(format!("{}.jsonl",s.session_id)),base.join("messages").join(&s.session_id)]{walk(&path,&mut entries,&mut bytes)?;}
    entries.sort_by(|a,b|a["path"].as_str().cmp(&b["path"].as_str()));Ok((bytes,hash(serde_json::to_vec(&json!({"session":public_session(s),"entries":entries}))?)))
}
pub fn history_items(state:&HostState,project:Option<&str>)->Result<Vec<Value>> {
    load(state)?;let m=memory().lock().unwrap();let mut items=Vec::new();for s in m.store.sessions.values().filter(|s|project.map_or(true,|p|p==s.project_id)) {let (bytes,fingerprint)=history_fingerprint(state,s)?;let active=m.runs.contains_key(&s.session_id);let pending=m.store.reviews.values().any(|r|r.session_id==s.session_id&&!r.discarded&&!r.completed);items.push(json!({"id":s.session_id,"projectId":s.project_id,"bytes":bytes.to_string(),"fingerprint":fingerprint,"blocked":active||pending,"reason":if active{Some("运行中")}else if pending{Some("请先审查并放弃任务副本")}else{None}}));}Ok(items)
}
pub fn clear_history(state:&HostState,session_id:&str,expected_fingerprint:&str)->Result<()> {
    load(state)?;let mut m=memory().lock().unwrap();let s=m.store.sessions.get(session_id).cloned().ok_or_else(||err("NOT_FOUND","会话记录不存在"))?;
    if m.runs.contains_key(session_id)||m.store.reviews.values().any(|r|r.session_id==session_id&&!r.discarded&&!r.completed){return Err(err("RESOURCE_BUSY","活动会话或未决任务审查不能清理"));}
    if history_fingerprint(state,&s)?.1!=expected_fingerprint{return Err(err("STALE_VERSION","会话记录已变化，请重新预览清理"));}
    let base=data(state)?;for path in [base.join("sessions").join(session_id),base.join("messages").join(session_id)]{if path.exists(){fs::remove_dir_all(path)?;}}let transcript=base.join("transcripts").join(format!("{session_id}.jsonl"));if transcript.exists(){fs::remove_file(transcript)?;}
    let reviews=m.store.reviews.values().filter(|r|r.session_id==session_id).cloned().collect::<Vec<_>>();for r in reviews{if r.copy.exists(){if let Ok(root)=state.project_root(&r.project_id){let output=std::process::Command::new("/usr/bin/git").args(["-c","core.fsmonitor=false","-c","core.hooksPath=/dev/null","-C"]).arg(root).args(["worktree","remove","--force"]).arg(&r.copy).output()?;if !output.status.success(){return Err(err("GIT_ERROR","任务副本清理失败，保留记录"));}}else{fs::remove_dir_all(&r.copy)?;}}if let Some(dir)=r.baseline_dir.parent(){if dir.exists(){fs::remove_dir_all(dir)?;}}m.store.reviews.remove(&r.review_id);}
    m.store.sessions.remove(session_id);m.snapshots.retain(|_,snapshot|snapshot.session_id!=session_id);drop(m);persist(state)
}

fn connection_impact(cid:&str)->Result<Value> {
    let m=memory().lock().unwrap();let c=m.store.connections.get(cid).ok_or_else(||err("NOT_FOUND","连接不存在"))?;
    let sessions=m.store.sessions.values().filter(|s|s.connection_id==cid).map(|s|json!({"sessionId":s.session_id,"projectId":s.project_id})).collect::<Vec<_>>();
    let projects=m.store.preferences.project_connections.iter().filter(|(_,id)|id.as_str()==cid).map(|(p,_)|p.clone()).collect::<Vec<_>>();
    let mut impact=json!({"connectionId":cid,"revision":c.revision,"sessions":sessions,"projects":projects,"isGlobalDefault":m.store.preferences.default_connection.as_deref()==Some(cid),"active":m.runs.values().any(|r|r.connection_id==cid)});
    impact["impactDigest"]=json!(hash(serde_json::to_vec(&impact)?));Ok(impact)
}

pub async fn dispatch(state: Arc<HostState>, _app: AppHandle, call: Call, _channel: Option<Channel<Value>>) -> Result<Value> {
    load(&state)?;
    match call.method.as_str(){
        "agent_detect"=>{if let Some(adapter)=call.params["adapterId"].as_str(){if !["pi","horizon.agent","horizon.agent.pi"].contains(&adapter){return Err(err("CAPABILITY_UNSUPPORTED","首版只实现 Pi 适配器"));}}detect(&state,&call.params).await},
        "agent_runtime_install"=>install(&state,&call.request_id).await,
        "agent_runtime_uninstall"=>{let p=managed_executable(&state);let managed=p.canonicalize().unwrap_or_else(|_|p.clone());let in_use={let m=memory().lock().unwrap();m.runs.values().any(|r|m.store.connections.get(&r.connection_id).is_none_or(|c|{let path=executable(&state,&c.runtime);path.canonicalize().unwrap_or(path)==managed}))};if in_use{return Err(err("AGENT_BUSY","运行实例仍在使用受管 Pi"));}let dir=p.parent().unwrap().parent().unwrap();if dir.exists(){fs::remove_dir_all(dir)?;}Ok(json!({"uninstalled":true,"preserved":"connections, credentials, sessions and user-installed Pi"}))},
        "agent_preferences_get"=>{let m=memory().lock().unwrap();let p=&m.store.preferences;let project=call.scope["projectId"].as_str();let own=project.and_then(|id|p.project_connections.get(id));Ok(json!({"revision":p.revision,"defaultConnectionId":p.default_connection,"projectConnectionId":own,"effectiveConnectionId":own.or(p.default_connection.as_ref()),"source":if own.is_some(){"project"}else{"global"}}))},
        "agent_preferences_save"=>{let mut m=memory().lock().unwrap();if call.params["expectedRevision"].as_u64()!=Some(m.store.preferences.revision){return Err(err("STALE_VERSION","连接偏好已变化"));}let cid=call.params["connectionId"].as_str();if cid.is_some_and(|id|!m.store.connections.contains_key(id)){return Err(err("NOT_FOUND","连接不存在"));}let p=&mut m.store.preferences;if let Some(project)=call.scope["projectId"].as_str(){if let Some(cid)=cid{p.project_connections.insert(project.into(),cid.into());}else{p.project_connections.remove(project);}}else{p.default_connection=cid.map(str::to_owned);}p.revision+=1;let revision=p.revision;drop(m);persist(&state)?;Ok(json!({"revision":revision}))},
        "agent_connection_remove_preview"=>connection_impact(field(&call.params,"connectionId")?),
        "agent_connection_remove"=>{let cid=field(&call.params,"connectionId")?;let impact=connection_impact(cid)?;if impact["impactDigest"]!=call.params["impactDigest"]{return Err(err("STALE_VERSION","连接影响范围已变化，请重新确认"));}if impact["active"]==true{return Err(err("AGENT_BUSY","此连接正在被实例使用"));}let mut m=memory().lock().unwrap();m.store.connections.remove(cid);m.store.preferences.project_connections.retain(|_,id|id!=cid);if m.store.preferences.default_connection.as_deref()==Some(cid){m.store.preferences.default_connection=None;}m.store.preferences.revision+=1;drop(m);persist(&state)?;Ok(json!({"removed":true,"sessionsPreserved":true,"runtimeAuthPreserved":true}))},
        "agent_auth_info"=>{let c=connection(field(&call.params,"connectionId")?)?;let dir=configure(&state,&c)?;let runtime=executable(&state,&c.runtime);let quote=|s:&str|format!("'{}'",s.replace('\'',"'\"'\"'"));let command=format!("PI_CODING_AGENT_DIR={} PI_OFFLINE=1 PI_TELEMETRY=0 {} --no-tools --no-extensions --no-mcp --no-skills --no-prompt-templates --no-themes --no-context-files --no-approve",quote(&dir.to_string_lossy()),quote(&runtime.to_string_lossy()));Ok(json!({"agentDirectory":dir,"authOwner":"runtime","command":command,"instructions":"在终端运行此命令，然后输入 /login 选择 Pi 支持的提供商。凭据由 Pi 存入此目录的 auth.json。"}))},
        "agent_connections_list"=>Ok(json!({"items":memory().lock().unwrap().store.connections.values().collect::<Vec<_>>()})),
        "agent_connection_save"=>{let input=&call.params["connection"];let cid=input["connectionId"].as_str().filter(|s|!s.is_empty()).map(str::to_owned).unwrap_or_else(id);let previous=memory().lock().unwrap().store.connections.get(&cid).cloned();if let Some(prev)=&previous{if memory().lock().unwrap().runs.values().any(|r|r.connection_id==cid){return Err(err("AGENT_BUSY","此连接正在使用，请等待当前实例结束"));}if call.params["expectedRevision"].as_u64()!=Some(prev.revision){return Err(err("STALE_VERSION","模型连接已改变"));}}
            if !cid.chars().all(|c|c.is_ascii_alphanumeric()||c=='-'){return Err(err("INVALID_ARGUMENT","无效连接 ID"));}
            let c=Connection{connection_id:cid.clone(),adapter_id:input["adapterId"].as_str().unwrap_or("pi").into(),runtime:input["runtime"].clone(),provider:input["provider"].clone(),auth_owner:input["authOwner"].as_str().unwrap_or("horizon").into(),revision:previous.map_or(1,|p|p.revision+1),auth_state:"configured".into()};validate_connection(&c)?;let revision=c.revision;configure(&state,&c)?;memory().lock().unwrap().store.connections.insert(cid.clone(),c);persist(&state)?;Ok(json!({"connectionId":cid,"revision":revision}))},
        "agent_connect"=>{let c=connection(field(&call.params,"connectionId")?)?;let d=detect(&state,&c.runtime).await?;if d["supported"]!=true{return Err(err("AGENT_UNAVAILABLE","Pi 未安装或版本不受支持"));}Ok(json!({"capabilities":capabilities("chat"),"authState":c.auth_state}))},
        "agent_models_list"=>{let c=connection(field(&call.params,"connectionId")?)?;Ok(json!({"items":[{"providerId":c.provider["id"],"modelId":c.provider["model"],"label":c.provider["model"]}],"source":"configured"}))},
        "agent_connection_test"=>{let mut c=connection(field(&call.params,"connectionId")?)?;if call.params["expectedRevision"].as_u64()!=Some(c.revision){return Err(err("STALE_VERSION","连接已改变，请重新测试"));}let sid=id();let dir=data(&state)?.join("tests");private_dir(&dir)?;let s=Session{created_at:now_ms(),session_id:sid.clone(),project_id:call.scope["projectId"].as_str().unwrap_or("__connection_test").into(),connection_id:c.connection_id.clone(),profile:"chat".into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:false,pi_file:dir.join(format!("{sid}.jsonl")).to_string_lossy().into(),review_id:None,messages:vec![]};let result=run_pi(state.clone(),&call,s,c.clone(),"Reply with exactly: Horizon connection verified. This is a connectivity test; no project content is included.".into(),None,true).await;c.auth_state=if result.as_ref().is_ok_and(|r|r["state"]=="succeeded"){"verified"}else if result.as_ref().is_err_and(|e|e.code=="AUTH_REQUIRED"){"needsAuthentication"}else{"configured"}.into();memory().lock().unwrap().store.connections.insert(c.connection_id.clone(),c.clone());persist(&state)?;result?;Ok(json!({"authState":c.auth_state,"modelAvailable":true}))},
        "agent_sessions_list"=>{let project=call.project_id()?;let mut sessions=memory().lock().unwrap().store.sessions.values().filter(|s|s.project_id==project).map(public_session).collect::<Vec<_>>();sessions.sort_by_key(|s|s["createdAt"].as_u64().unwrap_or(0));Ok(json!({"items":sessions}))},
        "agent_session_create"=>{let cid=field(&call.params,"connectionId")?;connection(cid)?;let profile=field(&call.params,"profile")?;if !["chat","task"].contains(&profile){return Err(err("INVALID_ARGUMENT","无效 Agent 模式"));}let project=call.project_id()?;let root=state.project_root(project)?;if profile=="task"{git(&root,&["rev-parse","--verify","HEAD"]).await.map_err(|_|err("CAPABILITY_UNSUPPORTED","此项目没有有效 Git HEAD，首版仅支持聊天"))?;}
            let sid=id();let dir=data(&state)?.join("sessions").join(&sid);private_dir(&dir)?;let s=Session{created_at:now_ms(),session_id:sid.clone(),project_id:project.into(),connection_id:cid.into(),profile:profile.into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:false,pi_file:dir.join("session.jsonl").to_string_lossy().into(),review_id:None,messages:vec![]};memory().lock().unwrap().store.sessions.insert(sid,s.clone());persist(&state)?;Ok(public_session(&s))},
        "agent_session_resume"=>{let s=session(&call)?;if !Path::new(&s.pi_file).exists(){return Err(err("NOT_FOUND","尚无可恢复的 Pi 会话文件"));}Ok(public_session(&s))},
        "agent_context_prepare"=>context_prepare(&state,&call).await,
        "agent_submit"=>{let s=session(&call)?;let text=field(&call.params,"text")?;if text.trim().is_empty()||text.len()>MAX_CONTEXT{return Err(err("INVALID_ARGUMENT","请输入 256 KiB 内的任务文本"));}let snapshot={let mut m=memory().lock().unwrap();m.snapshots.remove(field(&call.params,"snapshotId")?).ok_or_else(||err("STALE_VERSION","上下文快照已失效"))?};if snapshot.session_id!=s.session_id||snapshot.digest!=field(&call.params,"manifestDigest")?||now()-snapshot.created>3600{return Err(err("STALE_VERSION","上下文快照不匹配或已过期"));}
            let mut prompt=text.to_string();for (item,body) in snapshot.items.iter().zip(snapshot.texts.iter()){prompt.push_str(&format!("\n\nAttached context (source={}, file={}, SHA256={}):\n{}",item["source"],item["relativePath"],item["contentHash"],body));}
            append_message(&state,&s.session_id,json!({"messageId":id(),"role":"user","text":text,"state":"submitted"}))?;let c=connection(&s.connection_id)?;run_pi(state,&call,s,c,prompt,Some(snapshot),false).await},
        "agent_cancel"=>{let s=session(&call)?;let mut m=memory().lock().unwrap();if let (Some(expected),Some(active))=(call.params["runId"].as_str(),m.runs.get(&s.session_id)){if expected!=active.request_id{return Err(err("STALE_SCOPE","取消请求属于旧回合"));}}let active=m.runs.get(&s.session_id).map(|r|{r.cancel.store(true,Ordering::SeqCst);let _=r.input.send(json!({"id":id(),"type":"clear_queue"}));let _=r.input.send(json!({"id":id(),"type":"abort"}));true}).unwrap_or(false);m.permissions.retain(|_,p|p.session_id!=s.session_id);Ok(json!({"cancelRequested":active}))},
        "agent_session_close"=>{let s=session(&call)?;stop_extension("horizon.agent",Some(&s.project_id)).await},
        "agent_interaction_answer"=>{let s=session(&call)?;let iid=field(&call.params,"interactionId")?;let mut m=memory().lock().unwrap();let p=m.permissions.get(iid).ok_or_else(||err("PERMISSION_EXPIRED","授权已处理、过期或取消"))?;if p.session_id!=s.session_id||p.digest!=field(&call.params,"operationDigest")?{return Err(err("STALE_SCOPE","授权内容或会话不匹配"));}if p.expires<now(){m.permissions.remove(iid);return Err(err("PERMISSION_EXPIRED","授权已过期"));}let p=m.permissions.remove(iid).unwrap();let approved=call.params["decision"]=="allowOnce";let _=p.answer.send(approved);Ok(json!({"accepted":true}))},
        "agent_message_read"=>{let s=session(&call)?;message_page(&state,&s,field(&call.params,"messageId")?,call.params["cursor"].as_str())},
        "agent_transcript_read"=>{let s=session(&call)?;let limit=call.params["limit"].as_u64().unwrap_or(50).clamp(1,100) as usize;transcript_page(&state,&s,call.params["cursor"].as_str(),limit)},
        "review_get"=>{let r=get_review(&call)?;let files=review_files(&state,&r).await?;Ok(json!({"reviewId":r.review_id,"origin":"taskCopy","files":files,"baseline":"当前磁盘及显式选择的未保存快照","taskCopyPath":r.copy}))},
        "review_file_read"=>{let r=get_review(&call)?;let files=review_files(&state,&r).await?;let fid=field(&call.params,"fileId")?;let item=files.iter().find(|v|v["file"]["fileId"]==fid).ok_or_else(||err("NOT_FOUND","审查文件不存在"))?;let rel=field(item,"relativePath")?;let base=match field(&call.params,"side")?{"baseline"=>&r.baseline_dir,"after"=>&r.copy,_=>return Err(err("INVALID_ARGUMENT","无效审查侧"))};let bytes=fs::read(confined(base,rel)?)?;let digest=hash(&bytes);if bytes.contains(&0){return Ok(json!({"binary":true,"contentHash":digest,"nextCursor":null}));}let text=String::from_utf8(bytes).map_err(|_|err("BINARY_FILE","文件不是 UTF-8"))?;let offset=call.params["cursor"].as_str().and_then(|v|v.parse::<usize>().ok()).unwrap_or(0);let limit=call.params["limitBytes"].as_u64().unwrap_or(256*1024).min(1024*1024) as usize;if !text.is_char_boundary(offset){return Err(err("INVALID_ARGUMENT","无效分页游标"));}let mut end=(offset+limit).min(text.len());while !text.is_char_boundary(end){end-=1;}Ok(json!({"text":&text[offset..end],"binary":false,"contentHash":digest,"nextCursor":if end<text.len(){Some(end.to_string())}else{None}}))},
        "review_apply"=>{let r=get_review(&call)?;apply_review(&state,&call,&r).await},
        "review_editor_result"=>{
            let r=get_review(&call)?;let aid=field(&call.params,"applicationId")?;
            {let mut m=memory().lock().unwrap();let application=m.applications.get(aid).ok_or_else(||err("NOT_FOUND","编辑应用记录不存在"))?;
            if application.review_id!=r.review_id || call.params["documentId"]!=application.document_id {return Err(err("STALE_SCOPE","编辑应用不属于此任务或文档"));}
            if call.params["state"]=="applied" {
                let plans=state.plans.lock().unwrap();let proposal=plans.get(aid).ok_or_else(||err("NOT_FOUND","编辑提案不存在"))?;
                if proposal["state"]!="applied" || proposal["editorRevision"].as_u64().is_none_or(|v|v<=application.expected_revision) {return Err(err("STALE_VERSION","编辑器尚未确认应用"));}
                let checkpoint:Value=serde_json::from_slice(&fs::read(state.data_dir().join("recovery").join(format!("{}.json",application.document_id)))?)?;
                if hash(field(&checkpoint,"text")?)!=application.content_hash || checkpoint["editorRevision"]!=proposal["editorRevision"] {return Err(err("STALE_VERSION","当前编辑内容与提案不同"));}
                let relative=application.relative.clone();if let Some(review)=m.store.reviews.get_mut(&r.review_id){review.applied.insert(relative);}
            }
            m.applications.remove(aid);}finish_review_if_applied(&state,&r.review_id).await?;persist(&state)?;Ok(json!({"recorded":true}))
        },
        "review_discard"=>{let r=get_review(&call)?;if memory().lock().unwrap().runs.contains_key(&r.session_id){return Err(err("AGENT_BUSY","请先停止任务"));}if call.params["deleteTaskCopy"]==true{let root=state.project_root(&r.project_id)?;git(&root,&["worktree","remove","--force",r.copy.to_str().unwrap()]).await?;}if let Some(r)=memory().lock().unwrap().store.reviews.get_mut(&r.review_id){r.discarded=true;}persist(&state)?;Ok(json!({"discarded":true}))},
        _=>Err(err("METHOD_NOT_FOUND",format!("未知 Agent 方法 {}",call.method)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::TaskRecord;
    use std::collections::VecDeque;
    fn call_for(project:&str,method:&str,params:Value)->Call { Call{protocol_version:1,request_id:id(),method:method.into(),scope:json!({"kind":"project","projectId":project,"projectEpoch":1}),params,idempotency_key:Some(id())} }
    fn register_task(state:&HostState,call:&Call){let tid=id();state.tasks.lock().unwrap().insert(tid.clone(),TaskRecord{id:tid,call:call.clone(),state:"running".into(),cancelled:false,seq:0,ack:0,events:VecDeque::new(),ring_bytes:0,channel:None,terminal:None,updated:std::time::Instant::now()});}
    fn snapshot(sid:&str)->Snapshot{Snapshot{session_id:sid.into(),digest:String::new(),items:vec![],texts:vec![],created:now(),buffer_bases:HashMap::new()}}
    async fn execute(state:Arc<HostState>,s:Session,c:Connection,prompt:&str,allow:bool)->Result<Value>{
        let call=call_for(&s.project_id,"agent_submit",json!({"sessionId":s.session_id,"text":prompt,"submissionId":id()}));register_task(&state,&call);let snap=snapshot(&s.session_id);let cancelled=Arc::new(AtomicBool::new(false));let done=cancelled.clone();let session=s.session_id.clone();
        let approving=tokio::spawn(async move{while !done.load(Ordering::SeqCst){let pending={let mut m=memory().lock().unwrap();let keys=m.permissions.iter().filter(|(_,p)|p.session_id==session).map(|(k,_)|k.clone()).collect::<Vec<_>>();keys.into_iter().filter_map(|key|m.permissions.remove(&key)).collect::<Vec<_>>()};for permission in pending{let _=permission.answer.send(allow);}tokio::time::sleep(Duration::from_millis(20)).await;}});
        let result=run_pi(state,&call,s,c,prompt.into(),Some(snap),false).await;cancelled.store(true,Ordering::SeqCst);approving.await.unwrap();result
    }
    fn launch_chat(state:Arc<HostState>,project_id:String,c:Connection)->tokio::task::JoinHandle<Result<Value>>{
        let sid=id();let dir=data(&state).unwrap().join("sessions").join(&sid);private_dir(&dir).unwrap();let s=Session{created_at:now_ms(),session_id:sid.clone(),project_id:project_id.clone(),connection_id:c.connection_id.clone(),profile:"chat".into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:false,pi_file:dir.join("session.jsonl").to_string_lossy().into_owned(),review_id:None,messages:vec![]};memory().lock().unwrap().store.sessions.insert(sid.clone(),s.clone());let call=call_for(&project_id,"agent_submit",json!({"sessionId":sid,"submissionId":id()}));register_task(&state,&call);tokio::spawn(async move{run_pi(state,&call,s,c,"HORIZON_TEST_CANCEL instance limit".into(),None,false).await})
    }
    async fn wait_instances(count:usize){let deadline=tokio::time::Instant::now()+Duration::from_secs(10);loop{if memory().lock().unwrap().runs.len()==count{break;}assert!(tokio::time::Instant::now()<deadline,"instance count did not reach {count}");tokio::time::sleep(Duration::from_millis(20)).await;}}
    #[cfg(target_os="macos")]
    #[tokio::test]
    async fn runtime_install_rejects_corrupt_archive_before_extract_or_execute(){
        let tmp=tempfile::tempdir().unwrap();let state=HostState::new(tmp.path().join("data")).unwrap();
        let call=call_for("fixture-project","agent_runtime_install",json!({}));register_task(&state,&call);
        let corrupt=b"corrupt Pi archive bytes";let digest=hash(b"known expected Pi archive bytes");assert_ne!(hash(corrupt),digest);
        let listener=tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();let url=format!("http://{}/pi.tar.gz",listener.local_addr().unwrap());
        let server=tokio::spawn(async move{
            let (mut socket,_)=listener.accept().await.unwrap();let mut headers=Vec::new();
            while !headers.windows(4).any(|part|part==b"\r\n\r\n"){
                let mut buffer=[0u8;1024];let count=socket.read(&mut buffer).await.unwrap();assert!(count>0);headers.extend_from_slice(&buffer[..count]);
            }
            let head=format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",corrupt.len());
            socket.write_all(head.as_bytes()).await.unwrap();socket.write_all(corrupt).await.unwrap();
        });
        let error=install_from(&state,&call.request_id,&url,&digest).await.unwrap_err();server.await.unwrap();
        assert_eq!(error.code,"INTEGRITY_ERROR");assert_eq!(error.message,"Pi 官方发行文件摘要不匹配，未激活");
        let managed=managed_executable(&state);assert!(!managed.exists(),"corrupt archive must not activate an executable");
        let parent=managed.parent().unwrap().parent().unwrap().parent().unwrap();
        assert!(fs::read_dir(parent).unwrap().next().is_none(),"digest rejection must clean staging and leave no extracted files");
        // INTEGRITY_ERROR returns before archive write, tar extraction, or the executable version probe.
    }
    #[test]
    fn path_boundary_rejects_escape_and_symlinks(){let root=tempfile::tempdir().unwrap();assert!(confined(root.path(),"../secret").is_err());assert!(confined(root.path(),"/etc/passwd").is_err());assert!(confined(root.path(),".git/config").is_err());#[cfg(unix)]{std::os::unix::fs::symlink("/tmp",root.path().join("escape")).unwrap();assert!(confined(root.path(),"escape/file").is_err());}assert!(confined(root.path(),"nested/new.txt").is_ok());}
    #[test]
    fn long_message_pages_keep_utf8_and_history_windows_bounded(){
        let tmp=tempfile::tempdir().unwrap();let state=HostState::new(tmp.path().join("data")).unwrap();let sid=id();let mid=id();
        let s=Session{created_at:now_ms(),session_id:sid.clone(),project_id:"fixture-project".into(),connection_id:"fixture-connection".into(),profile:"chat".into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:true,pi_file:String::new(),review_id:None,messages:vec![]};
        let body="长消息分页🙂\n".repeat(16384);let preview=message_preview(&state,&sid,json!({"messageId":mid,"role":"assistant","text":body,"state":"stop"})).unwrap();
        assert!(preview["text"].as_str().unwrap().len()<=MESSAGE_PAGE_BYTES);assert_eq!(preview["truncated"],true);assert_eq!(preview["contentRef"]["messageId"],mid);
        let mut restored=String::new();let mut cursor=None;let mut pages=0;
        loop{let page=message_page(&state,&s,&mid,cursor.as_deref()).unwrap();let text=page["text"].as_str().unwrap();assert!(text.len()<=MESSAGE_PAGE_BYTES);assert!(!text.is_empty());restored.push_str(text);pages+=1;cursor=page["nextCursor"].as_str().map(str::to_owned);if cursor.is_none(){break;}}
        assert_eq!(restored,body);assert!(pages>1);assert_eq!(message_page(&state,&s,&mid,Some("1")).unwrap_err().code,"INVALID_ARGUMENT");
        for n in 0..205{append_message(&state,&sid,json!({"messageId":id(),"role":"user","text":format!("message {n}"),"state":"submitted"})).unwrap();}
        append_message(&state,&sid,json!({"messageId":mid,"role":"assistant","text":body,"state":"stop"})).unwrap();
        let last=transcript_page(&state,&s,None,100).unwrap();assert_eq!(last["items"].as_array().unwrap().len(),100);assert_eq!(last["nextCursor"],"106");assert_eq!(last["items"][99]["truncated"],true);
        let previous=transcript_page(&state,&s,Some("106"),100).unwrap();assert_eq!(previous["items"].as_array().unwrap().len(),100);assert_eq!(previous["items"][0]["text"],"message 6");assert_eq!(previous["nextCursor"],"6");
        let earliest=transcript_page(&state,&s,Some("6"),100).unwrap();assert_eq!(earliest["items"].as_array().unwrap().len(),6);assert_eq!(earliest["nextCursor"],Value::Null);
    }
    #[tokio::test]
    async fn bounded_pi_record_survives_cancelled_poll_and_rejects_oversize(){
        let bytes="prefix中文🙂\n".as_bytes().to_vec();let expected=String::from_utf8(bytes.clone()).unwrap();let (mut tx,rx)=tokio::io::duplex(64);
        let writing=tokio::spawn(async move{tx.write_all(&bytes[..8]).await.unwrap();tokio::time::sleep(Duration::from_millis(30)).await;tx.write_all(&bytes[8..]).await.unwrap();});
        let mut reader=BufReader::new(rx);let mut pending=Vec::new();assert!(tokio::time::timeout(Duration::from_millis(5),next_pi_record(&mut reader,&mut pending)).await.is_err());assert_eq!(pending.len(),8);
        assert_eq!(next_pi_record(&mut reader,&mut pending).await.unwrap(),Some(expected));writing.await.unwrap();assert!(next_pi_record(&mut reader,&mut pending).await.unwrap().is_none());
        let huge=vec![b'x';MAX_PI_RECORD_BYTES+1];let mut reader=BufReader::new(huge.as_slice());let error=next_pi_record(&mut reader,&mut pending).await.unwrap_err();assert_eq!(error.code,"RESOURCE_LIMIT");assert!(pending.len()<=MAX_PI_RECORD_BYTES);
    }
    #[test]
    fn session_disk_budget_rejects_append_without_erasing_history(){
        let tmp=tempfile::tempdir().unwrap();let state=HostState::new(tmp.path().join("data")).unwrap();let sid=id();let dir=data(&state).unwrap().join("sessions").join(&sid);private_dir(&dir).unwrap();let path=dir.join("session.jsonl");let file=fs::File::create(&path).unwrap();file.set_len(MAX_SESSION_BYTES-1).unwrap();
        ensure_session_budget(&state,&sid,1).unwrap();assert_eq!(ensure_session_budget(&state,&sid,2).unwrap_err().code,"RESOURCE_LIMIT");assert_eq!(append_message(&state,&sid,json!({"messageId":id(),"role":"user","text":"must not append","state":"submitted"})).unwrap_err().code,"RESOURCE_LIMIT");assert_eq!(fs::metadata(path).unwrap().len(),MAX_SESSION_BYTES-1);
    }
    #[tokio::test]
    #[ignore = "Requires HORIZON_PI_BINARY official Pi 1.4.0 and Node; run scripts/test-pi-native.mjs"]
    async fn real_pi_broker_review_and_secret_isolation(){
        let binary=std::env::var("HORIZON_PI_BINARY").expect("HORIZON_PI_BINARY is required");let tmp=tempfile::tempdir().unwrap();let root=tmp.path().join("project");fs::create_dir(&root).unwrap();
        git(&root,&["init","-q"]).await.unwrap();fs::write(root.join("example.txt"),"head baseline\n").unwrap();fs::write(root.join(".gitattributes"),"example.txt filter=horizon-fixture\n").unwrap();git(&root,&["add","example.txt",".gitattributes"]).await.unwrap();git(&root,&["-c","user.name=Horizon Test","-c","user.email=horizon@test.invalid","commit","-qm","fixture baseline"]).await.unwrap();
        fs::write(root.join("example.txt"),"user staged change\n").unwrap();git(&root,&["add","example.txt"]).await.unwrap();fs::write(root.join("example.txt"),"user unstaged change\n").unwrap();let index_before=fs::read(root.join(".git/index")).unwrap();let smudge_marker=tmp.path().join("smudge-must-not-run");git(&root,&["config","filter.horizon-fixture.smudge",&format!("touch {}; cat",smudge_marker.display())]).await.unwrap();
        let state=Arc::new(HostState::new(tmp.path().join("data")).unwrap());let project=state.register_project(root.clone(),None,Some("Pi fixture")).unwrap();let project_id=field(&project["project"],"id").unwrap().to_string();state.epochs.lock().unwrap().insert(project_id.clone(),1);crate::extensions::initialize(&state).unwrap();let registry_path=state.data_dir().join("extensions/registry.json");let mut registry:Value=serde_json::from_slice(&fs::read(&registry_path).unwrap()).unwrap();registry["records"]["horizon.agent"]["enabledGlobal"]=json!(true);save_json(&registry_path,&registry).unwrap();load(&state).unwrap();
        let log=tmp.path().join("provider.jsonl");let server_script=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../scripts/test-pi-server.mjs");let mut server=Command::new("node").arg(server_script).env("HORIZON_TEST_LOG",&log).stdout(Stdio::piped()).kill_on_drop(true).spawn().unwrap();let mut line=String::new();BufReader::new(server.stdout.take().unwrap()).read_line(&mut line).await.unwrap();let port:Value=serde_json::from_str(&line).unwrap();
        let credential="fixture-key-not-a-real-provider-secret";let connection_id=id();
        let saved=crate::settings::dispatch(state.clone(),Call{protocol_version:1,request_id:id(),method:"credential_set".into(),scope:json!({"kind":"app"}),params:json!({"connectionId":connection_id,"secret":credential,"persistence":"session"}),idempotency_key:Some(id())}).unwrap();
        let c=Connection{connection_id,adapter_id:"pi".into(),runtime:json!({"source":"userInstalled","executablePath":binary}),provider:json!({"id":"horizon-fixture","api":"openai-completions","endpoint":format!("http://127.0.0.1:{}/v1",port["port"]),"model":"horizon-fixture","credentialRef":saved["credentialRef"]}),auth_owner:"horizon".into(),revision:1,auth_state:"configured".into()};
        let sid=id();let session_dir=data(&state).unwrap().join("sessions").join(&sid);private_dir(&session_dir).unwrap();let s=Session{created_at:now_ms(),session_id:sid.clone(),project_id:project_id.clone(),connection_id:c.connection_id.clone(),profile:"task".into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:false,pi_file:session_dir.join("session.jsonl").to_string_lossy().into_owned(),review_id:None,messages:vec![]};memory().lock().unwrap().store.sessions.insert(sid.clone(),s.clone());
        let denied=execute(state.clone(),s.clone(),c.clone(),"HORIZON_TEST_WRITE denial",false).await.unwrap();assert_eq!(denied["state"],"succeeded");let review_id=field(&denied,"reviewId").unwrap();let r=memory().lock().unwrap().store.reviews[review_id].clone();assert_eq!(fs::read_to_string(r.copy.join("example.txt")).unwrap(),"user unstaged change\n");assert!(review_files(&state,&r).await.unwrap().is_empty());assert!(!smudge_marker.exists(),"task preparation must not execute repository smudge filters");
        let s=memory().lock().unwrap().store.sessions[&sid].clone();let accepted=execute(state.clone(),s,c.clone(),"HORIZON_TEST_WRITE allow",true).await.unwrap();assert_eq!(accepted["state"],"succeeded");assert_eq!(fs::read_to_string(root.join("example.txt")).unwrap(),"user unstaged change\n");assert_eq!(fs::read(root.join(".git/index")).unwrap(),index_before);
        let files=review_files(&state,&r).await.unwrap();assert_eq!(files.len(),1);let applying=call_for(&project_id,"review_apply",json!({"reviewId":review_id,"targets":[{"fileId":files[0]["file"]["fileId"],"expectedDiskRevision":files[0]["expectedDiskRevision"]}]}));let applied=apply_review(&state,&applying,&r).await.unwrap();assert_eq!(applied["results"][0]["state"],"applied");assert_eq!(fs::read_to_string(root.join("example.txt")).unwrap(),"changed by real Pi through Horizon broker\n");assert_eq!(fs::read(root.join(".git/index")).unwrap(),index_before);
        let s=memory().lock().unwrap().store.sessions[&sid].clone();let command=execute(state.clone(),s,c.clone(),"HORIZON_TEST_EXEC environment",true).await.unwrap();let text=field(&command,"text").unwrap();assert!(text.contains("PATH="));assert!(!text.contains("HORIZON_MODEL_KEY"));assert!(!text.contains(credential));assert!(!text.contains("HORIZON_BROKER_TOKEN"));
        let s=memory().lock().unwrap().store.sessions[&sid].clone();let unknown=execute(state.clone(),s,c.clone(),"HORIZON_TEST_UNKNOWN_TOOL",true).await.unwrap();assert_eq!(unknown["state"],"succeeded");assert!(!root.join("should-never-exist").exists());assert!(!r.copy.join("should-never-exist").exists());
        // A selected UTF-16 excerpt must not replace the full buffer task baseline.
        let fid=state.file_ref(&project_id,&root.join("example.txt")).unwrap();
        let opened=crate::files::dispatch(state.clone(),call_for(&project_id,"document_open",json!({"fileId":fid["fileId"],"mode":"auto"}))).unwrap();
        let document_id=field(&opened["meta"],"documentId").unwrap();let buffer_text="unsaved complete buffer baseline\nsecond line outside selection\n";
        crate::files::dispatch(state.clone(),call_for(&project_id,"document_checkpoint",json!({"documentId":document_id,"editorRevision":1,"baseDiskRevision":opened["meta"]["baseDiskRevision"],"text":buffer_text,"selection":{"anchor":0,"head":8}}))).unwrap();
        let sid_buffer=id();let dir=data(&state).unwrap().join("sessions").join(&sid_buffer);private_dir(&dir).unwrap();
        let s_buffer=Session{created_at:now_ms(),session_id:sid_buffer.clone(),project_id:project_id.clone(),connection_id:c.connection_id.clone(),profile:"task".into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:false,pi_file:dir.join("session.jsonl").to_string_lossy().into_owned(),review_id:None,messages:vec![]};memory().lock().unwrap().store.sessions.insert(sid_buffer.clone(),s_buffer.clone());
        let too_many=context_prepare(&state,&call_for(&project_id,"agent_context_prepare",json!({"sessionId":sid_buffer,"items":vec![json!({});21]}))).await.unwrap_err();assert_eq!(too_many.code,"CONTEXT_TOO_LARGE");
        let attachment=root.join("attachment.txt");fs::write(&attachment,"x".repeat(MAX_CONTEXT)).unwrap();let attached=state.file_ref(&project_id,&attachment).unwrap();let exact_revision=crate::files::disk_revision(&attachment).unwrap();
        let exact=context_prepare(&state,&call_for(&project_id,"agent_context_prepare",json!({"sessionId":sid_buffer,"items":[{"source":"disk","fileId":attached["fileId"],"expectedDiskRevision":exact_revision}]}))).await.unwrap();assert_eq!(exact["totalBytes"],MAX_CONTEXT.to_string());
        fs::write(&attachment,"x".repeat(MAX_CONTEXT+1)).unwrap();let stale_context=context_prepare(&state,&call_for(&project_id,"agent_context_prepare",json!({"sessionId":sid_buffer,"items":[{"source":"disk","fileId":attached["fileId"],"expectedDiskRevision":exact_revision}]}))).await.unwrap_err();assert_eq!(stale_context.code,"STALE_VERSION");
        let oversized=context_prepare(&state,&call_for(&project_id,"agent_context_prepare",json!({"sessionId":sid_buffer,"items":[{"source":"disk","fileId":attached["fileId"],"expectedDiskRevision":crate::files::disk_revision(&attachment).unwrap()}]}))).await.unwrap_err();assert_eq!(oversized.code,"CONTEXT_TOO_LARGE");
        fs::write(&attachment,"🙂").unwrap();let split_surrogate=context_prepare(&state,&call_for(&project_id,"agent_context_prepare",json!({"sessionId":sid_buffer,"items":[{"source":"disk","fileId":attached["fileId"],"expectedDiskRevision":crate::files::disk_revision(&attachment).unwrap(),"range":{"fromUtf16":0,"toUtf16":1}}]}))).await.unwrap_err();assert_eq!(split_surrogate.code,"INVALID_ARGUMENT");
        let stale_editor_context=context_prepare(&state,&call_for(&project_id,"agent_context_prepare",json!({"sessionId":sid_buffer,"items":[{"source":"buffer","fileId":fid["fileId"],"documentId":document_id,"editorRevision":999,"text":buffer_text}]}))).await.unwrap_err();assert_eq!(stale_editor_context.code,"STALE_VERSION");
        let mut buffer_snapshot=snapshot(&sid_buffer);buffer_snapshot.items=vec![json!({"source":"buffer","file":fid,"relativePath":"example.txt","editorRevision":1,"documentId":document_id,"range":{"fromUtf16":0,"toUtf16":8}})];buffer_snapshot.texts=vec!["unsaved ".into()];buffer_snapshot.buffer_bases.insert("example.txt".into(),buffer_text.into());
        let br=prepare_copy(&state,&s_buffer,&buffer_snapshot,&[]).await.unwrap();assert_eq!(fs::read_to_string(br.copy.join("example.txt")).unwrap(),buffer_text);assert_eq!(state.document_meta(document_id).unwrap()["editorRevision"],1);
        fs::write(br.copy.join("example.txt"),"task result for dirty buffer\n").unwrap();let bf=review_files(&state,&br).await.unwrap();
        let ba=call_for(&project_id,"review_apply",json!({"reviewId":br.review_id,"targets":[{"fileId":bf[0]["file"]["fileId"],"expectedDiskRevision":bf[0]["expectedDiskRevision"],"expectedEditorRevision":1}]}));
        let proposed=apply_review(&state,&ba,&br).await.unwrap();assert_eq!(proposed["results"][0]["state"],"proposed");assert_eq!(fs::read_to_string(root.join("example.txt")).unwrap(),"changed by real Pi through Horizon broker\n");assert_eq!(state.document_meta(document_id).unwrap()["state"],"dirty");
        state.documents.lock().unwrap().get_mut(document_id).unwrap().meta["editorRevision"]=json!(2);let stale=apply_review(&state,&ba,&br).await.unwrap();assert_eq!(stale["results"][0]["error"]["code"],"STALE_VERSION");
        state.documents.lock().unwrap().remove(document_id);
        fs::write(root.join("example.txt"),"concurrent original change\n").unwrap();let changed=apply_review(&state,&ba,&br).await.unwrap();assert_eq!(changed["results"][0]["error"]["code"],"FILE_CHANGED");assert_eq!(fs::read_to_string(root.join("example.txt")).unwrap(),"concurrent original change\n");
        // Cancellation while waiting for permission rejects the pending tool and reaps the real process.
        let sid_cancel=id();let dir=data(&state).unwrap().join("sessions").join(&sid_cancel);private_dir(&dir).unwrap();let sc=Session{created_at:now_ms(),session_id:sid_cancel.clone(),project_id:project_id.clone(),connection_id:c.connection_id.clone(),profile:"task".into(),state:"dormant".into(),instance_id:None,instance_epoch:0,resume_available:false,pi_file:dir.join("session.jsonl").to_string_lossy().into_owned(),review_id:None,messages:vec![]};memory().lock().unwrap().store.sessions.insert(sid_cancel.clone(),sc.clone());let cancel_call=call_for(&project_id,"agent_submit",json!({"sessionId":sid_cancel,"submissionId":id()}));register_task(&state,&cancel_call);let cancel_state=state.clone();let cancel_connection=c.clone();let cancel_run=tokio::spawn(async move{run_pi(cancel_state,&cancel_call,sc,cancel_connection,"HORIZON_TEST_WRITE wait for permission".into(),None,false).await});
        let deadline=tokio::time::Instant::now()+Duration::from_secs(10);while memory().lock().unwrap().permissions.is_empty(){assert!(tokio::time::Instant::now()<deadline,"permission did not arrive");tokio::time::sleep(Duration::from_millis(20)).await;}
        let stopped=stop_extension("horizon.agent",Some(&project_id)).await.unwrap();assert_eq!(stopped["closed"],true);assert_eq!(cancel_run.await.unwrap().unwrap_err().code,"CANCELLED");assert!(memory().lock().unwrap().permissions.is_empty());assert_eq!(fs::read_to_string(root.join("example.txt")).unwrap(),"concurrent original change\n");
        // A stored Pi credential must not override the Horizon key after switching ownership.
        let legacy=data(&state).unwrap().join("connections").join(&c.connection_id).join("auth.json");let legacy_auth=json!({"horizon-fixture":{"type":"api_key","key":"fixture-runtime-owned"}});save_json(&legacy,&legacy_auth).unwrap();let legacy_bytes=fs::read(&legacy).unwrap();
        for (owner,prompt) in [("runtime","HORIZON_TEST_AUTH_RUNTIME"),("horizon","HORIZON_TEST_AUTH_HORIZON"),("external","HORIZON_TEST_AUTH_EXTERNAL")]{let mut auth_connection=c.clone();auth_connection.auth_owner=owner.into();let configured=configure(&state,&auth_connection).unwrap();assert_eq!(configured.file_name().unwrap().to_str().unwrap(),owner);let mut auth_session=s_buffer.clone();auth_session.session_id=id();auth_session.profile="chat".into();auth_session.review_id=None;auth_session.pi_file=data(&state).unwrap().join("sessions").join(&auth_session.session_id).join("session.jsonl").to_string_lossy().into_owned();memory().lock().unwrap().store.sessions.insert(auth_session.session_id.clone(),auth_session.clone());assert_eq!(execute(state.clone(),auth_session,auth_connection,prompt,false).await.unwrap()["state"],"succeeded");}
        assert_eq!(fs::read(&legacy).unwrap(),legacy_bytes);assert_eq!(serde_json::from_slice::<Value>(&fs::read(legacy.parent().unwrap().join("runtime/auth.json")).unwrap()).unwrap(),legacy_auth);
        // Stop acknowledging a real Channel. Pi still consumes stdout and persists canonical long Unicode text.
        let mut long_session=s_buffer.clone();long_session.session_id=id();long_session.profile="chat".into();long_session.review_id=None;long_session.pi_file=data(&state).unwrap().join("sessions").join(&long_session.session_id).join("session.jsonl").to_string_lossy().into_owned();memory().lock().unwrap().store.sessions.insert(long_session.session_id.clone(),long_session.clone());
        let long_call=call_for(&project_id,"agent_submit",json!({"sessionId":long_session.session_id,"submissionId":id()}));register_task(&state,&long_call);state.tasks.lock().unwrap().values_mut().find(|t|t.call.request_id==long_call.request_id).unwrap().channel=Some(Channel::new(|_|Ok(())));
        let long_result=run_pi(state.clone(),&long_call,long_session.clone(),c.clone(),"HORIZON_TEST_LONG_MESSAGE".into(),None,false).await.unwrap();assert_eq!(long_result["state"],"succeeded");assert!(long_result["text"].as_str().unwrap().len()<=MESSAGE_PAGE_BYTES);
        let long_id=field(&long_result["contentRef"],"messageId").unwrap();let expected="长消息分页🙂\n".repeat(16384);assert_eq!(fs::read_to_string(data(&state).unwrap().join("messages").join(&long_session.session_id).join(format!("{long_id}.txt"))).unwrap(),expected);
        let transcript=transcript_page(&state,&long_session,None,100).unwrap();assert_eq!(transcript["items"][0]["truncated"],true);assert!(memory().lock().unwrap().store.sessions[&long_session.session_id].messages.is_empty());
        {let mut tasks=state.tasks.lock().unwrap();let task=tasks.values_mut().find(|t|t.call.request_id==long_call.request_id).unwrap();let streamed=task.events.iter().filter(|e|e["payload"]["data"]["payload"]["type"]=="textDelta").map(|e|e["payload"]["data"]["payload"]["text"].as_str().unwrap_or("").len()).sum::<usize>();assert!(streamed<expected.len(),"slow view should receive a final reference rather than unbounded deltas");assert!(task.ring_bytes<=512*1024);task.channel=None;}
        let first=launch_chat(state.clone(),project_id.clone(),c.clone());wait_instances(1).await;
        let duplicate=launch_chat(state.clone(),project_id.clone(),c.clone()).await.unwrap().unwrap_err();assert_eq!(duplicate.code,"AGENT_BUSY");
        let mut other_projects=Vec::new();for n in 2..=3{let root=tmp.path().join(format!("project-{n}"));fs::create_dir(&root).unwrap();let project=state.register_project(root,None,Some("additional Pi fixture")).unwrap();let pid=field(&project["project"],"id").unwrap().to_string();state.epochs.lock().unwrap().insert(pid.clone(),1);other_projects.push(pid);}
        let second=launch_chat(state.clone(),other_projects[0].clone(),c.clone());wait_instances(2).await;
        let third=launch_chat(state.clone(),other_projects[1].clone(),c).await.unwrap().unwrap_err();assert_eq!(third.code,"RESOURCE_BUSY");
        let all_stopped=stop_extension("horizon.agent",None).await.unwrap();assert_eq!(all_stopped["closed"],true);assert_eq!(all_stopped["forced"],false);assert_eq!(first.await.unwrap().unwrap_err().code,"CANCELLED");assert_eq!(second.await.unwrap().unwrap_err().code,"CANCELLED");
        let requests=fs::read_to_string(&log).unwrap();for line in requests.lines(){let request:Value=serde_json::from_str(line).unwrap();let Some(tools)=request["body"]["tools"].as_array() else {continue;};let names=tools.iter().map(|v|v["function"]["name"].as_str().unwrap()).collect::<HashSet<_>>();assert_eq!(names,HashSet::from(["horizon_read","horizon_list","horizon_write","horizon_exec"]));}
        assert!(resources(None).as_array().unwrap().is_empty());let result=json!({"date":crate::state::now(),"version":VERSION,"platform":std::env::consts::OS,"modelService":"controlled local OpenAI protocol fixture; no real provider credentials","checks":{"realPiRpc":true,"actualRustBroker":true,"deniedWriteNoEffect":true,"approvedWriteOnlyTaskCopy":true,"dirtyDiskBaseline":true,"originalIndexPreserved":true,"conditionalReviewApplied":true,"commandSecretEnvironmentAbsent":true,"unknownToolNoEffect":true,"exactToolAllowlist":true,"noRepositoryCheckoutFiltersExecuted":true,"fullBufferBaselineFromSelectedExcerpt":true,"openDirtyDocumentProposedWithoutSaving":true,"staleEditorRejected":true,"concurrentDiskChangeRejected":true,"cancelPendingPermission":true,"oneRunPerProject":true,"twoExplicitInstancesMaximum":true,"gracefulOwnedInstanceStop":true,"ownedProcessesReaped":true,"context21ItemsRejected":true,"contextExact256KiBAccepted":true,"contextOver256KiBRejected":true,"staleDiskContextRejected":true,"staleEditorContextRejected":true,"splitSurrogateContextRejected":true,"slowConsumerLongUnicodePreserved":true,"boundedFinalMessageReference":true,"completedTranscriptBodiesNotResident":true,"authenticationOwnerDirectoriesIsolated":true,"legacyRuntimeAuthenticationPreserved":true,"horizonKeyNotOverriddenByRuntimeAuth":true}});let evidence=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../research/verification/pi-native.json");save_json(&evidence,&result).unwrap();server.kill().await.unwrap();
    }
}
