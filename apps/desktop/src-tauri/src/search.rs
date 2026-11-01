use crate::{protocol::{allowed,string},Call,HostError,HostState};
use serde_json::{json,Value};
use std::{collections::HashSet,sync::Arc,time::Instant};
use base64::Engine;
use tokio::io::{AsyncBufReadExt,AsyncReadExt};

struct SearchProcess {
    project: String,
    pid: u32,
    #[cfg(windows)]
    job: Option<Arc<crate::windows_process::OwnedJob>>,
}
type SearchProcesses=std::sync::Mutex<std::collections::HashMap<String,SearchProcess>>;
static PROCESSES:std::sync::OnceLock<SearchProcesses>=std::sync::OnceLock::new();
fn processes()->&'static SearchProcesses{PROCESSES.get_or_init(Default::default)}
struct ProcessLease(String);
impl Drop for ProcessLease {
    fn drop(&mut self) {
        #[cfg(windows)]
        {
            let job = processes().lock().unwrap().get(&self.0).and_then(|p| p.job.clone());
            if let Some(job) = job.filter(|job| !job.is_empty().unwrap_or(false)) {
                let _ = job.terminate();
                let key = self.0.clone();
                if let Ok(runtime) = tokio::runtime::Handle::try_current() {
                    runtime.spawn(async move {
                        while !job.is_empty().unwrap_or(false) { tokio::time::sleep(std::time::Duration::from_millis(50)).await; }
                        processes().lock().unwrap().remove(&key);
                    });
                }
                return;
            }
        }
        processes().lock().unwrap().remove(&self.0);
    }
}
async fn reserve_search(state:&HostState,call:&Call,task_id:&str,project:&str)->Result<ProcessLease,HostError>{
    loop{
        if state.is_cancelled(&call.request_id){return Err(HostError::new("CANCELLED","搜索已取消"));}
        let previous={let mut running=processes().lock().unwrap();let previous=running.iter().filter(|(_, process)|process.project==project).map(|(id,_)|id.clone()).collect::<Vec<_>>();if previous.is_empty()&&running.len()<2{running.insert(task_id.into(),SearchProcess{project:project.into(),pid:0,#[cfg(windows)]job:None});return Ok(ProcessLease(task_id.into()));}previous};
        if !previous.is_empty(){let mut tasks=state.tasks.lock().unwrap();for id in previous{if let Some(task)=tasks.get_mut(&id){task.cancelled=true;}}}
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
}
pub fn resources(project:Option<&str>)->Vec<Value>{processes().lock().unwrap().iter().filter(|(_,v)|project.is_none_or(|p|v.project==p)).map(|(id,process)|json!({"resourceId":id,"ownerExtensionId":"horizon.search","kind":"search","state":"running","projectId":process.project,"pid":process.pid,"actions":["stop"]})).collect()}
#[cfg(unix)]
pub async fn stop_resources(project:Option<&str>)->Result<(),HostError>{
    let pids:Vec<_>=processes().lock().unwrap().values().filter(|v|project.is_none_or(|p|v.project==p)).map(|v|v.pid).collect();
    for pid in pids.iter().filter(|pid|**pid!=0){unsafe{libc::kill(-(*pid as i32),libc::SIGTERM);}}
    let deadline=Instant::now()+std::time::Duration::from_secs(3);
    loop{let running=processes().lock().unwrap().values().any(|v|pids.contains(&v.pid));if !running{return Ok(());}if Instant::now()>deadline{for pid in pids.iter().filter(|pid|**pid!=0){unsafe{libc::kill(-(*pid as i32),libc::SIGKILL);}}return Err(HostError::new("RESOURCE_BUSY","搜索进程尚未确认退出"));}tokio::time::sleep(std::time::Duration::from_millis(20)).await;}
}

#[cfg(windows)]
pub async fn stop_resources(project:Option<&str>)->Result<(),HostError>{
    let entries:Vec<_>=processes().lock().unwrap().iter().filter(|(_,p)|project.is_none_or(|id|p.project==id)).map(|(id,p)|(id.clone(),p.job.clone())).collect();
    for (_,job) in &entries { if let Some(job)=job { job.terminate().map_err(|e|HostError::new("CLEANUP_FAILED",e.to_string()))?; } }
    let deadline=Instant::now()+std::time::Duration::from_secs(3);
    loop {
        if !processes().lock().unwrap().keys().any(|id|entries.iter().any(|(target,_)|id==target)) { return Ok(()); }
        if Instant::now()>=deadline { return Err(HostError::new("RESOURCE_BUSY","Windows搜索自有Job尚未确认退出，资源记录已保留")); }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
}
fn executable()->Result<std::path::PathBuf,HostError>{
    let current=std::env::current_exe()?;let sibling=current.parent().unwrap().join(format!("horizon-rg{}",std::env::consts::EXE_SUFFIX));if sibling.exists(){return Ok(sibling);}
    #[cfg(windows)] let target=if cfg!(target_arch="aarch64"){"aarch64-pc-windows-msvc"}else{"x86_64-pc-windows-msvc"};
    #[cfg(not(windows))] let target=if cfg!(target_arch="aarch64"){"aarch64-apple-darwin"}else{"x86_64-apple-darwin"};
    let bundled=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("binaries").join(format!("horizon-rg-{target}{}",std::env::consts::EXE_SUFFIX));
    if bundled.exists(){Ok(bundled)}else{Err(HostError::new("DEPENDENCY_UNAVAILABLE","搜索程序缺失，请修复Horizon安装"))}
}
async fn next_record(reader:&mut tokio::io::BufReader<tokio::process::ChildStdout>,data:&mut Vec<u8>,oversized:&mut bool)->Result<Option<(Vec<u8>,bool)>,HostError>{
    loop{let available=reader.fill_buf().await?;if available.is_empty(){return if data.is_empty()&&!*oversized{Ok(None)}else{Ok(Some((std::mem::take(data),std::mem::take(oversized))))};}
        let end=available.iter().position(|b|*b==b'\n').map(|i|i+1);let n=end.unwrap_or(available.len());
        if data.len()+n<=2*1024*1024&&!*oversized{data.extend_from_slice(&available[..n]);}else{*oversized=true;data.clear();}
        reader.consume(n);if end.is_some(){return Ok(Some((std::mem::take(data),std::mem::take(oversized))));}
    }
}
fn raw_field(value:&Value)->Result<Vec<u8>,HostError>{if let Some(text)=value["text"].as_str(){return Ok(text.as_bytes().to_vec());}if let Some(bytes)=value["bytes"].as_str(){return base64::engine::general_purpose::STANDARD.decode(bytes).map_err(|_|HostError::new("IO_ERROR","搜索服务返回无效字节"));}Err(HostError::new("IO_ERROR","搜索服务缺少文本字段"))}

pub async fn start(state:Arc<HostState>,call:Call)->Result<Value,HostError>{
    let p=&call.params;allowed(p,&["query","regex","caseSensitive","wholeWord","includeGlobs","excludeGlobs","includeIgnored","maxMatches"])?;
    let query=string(p,"query")?;let project=call.project_id()?;let root=state.project_root(project)?;let task_id=state.task_id_for_request(&call.request_id).ok_or_else(||HostError::new("INVALID_ARGUMENT","搜索必须使用horizon_start"))?;
    let max=p["maxMatches"].as_u64().unwrap_or(10_000).clamp(1,10_000)as usize;
    let pattern=if p["regex"]==true{query.to_owned()}else{regex::escape(query)};
    regex::RegexBuilder::new(&pattern).size_limit(2*1024*1024).build().map_err(|e|HostError::new("INVALID_ARGUMENT",format!("正则表达式无效：{e}")))?;
    let _lease=reserve_search(&state,&call,&task_id,project).await?;
    {let tasks=state.tasks.lock().unwrap();let mut results=state.search_results.lock().unwrap();let mut completed=results.keys().filter(|id|tasks.get(*id).is_none_or(|task|task.terminal.is_some())).cloned().collect::<Vec<_>>();completed.sort_by_key(|id|tasks.get(id).map(|task|task.updated));for id in completed{if results.len()<4{break;}results.remove(&id);}}
    state.search_results.lock().unwrap().insert(task_id.clone(),vec![]);
    if query.is_empty(){return Ok(json!({"matches":0,"files":0,"truncated":false,"elapsedMs":0}));}
    let mut command=tokio::process::Command::new(executable()?);command.current_dir(&root).args(["--no-config","--json","--line-buffered","--no-messages","--no-require-git","--threads","2","--glob","!.git/**"]);
    if p["regex"]!=true{command.arg("--fixed-strings");}if p["caseSensitive"]!=true{command.arg("--ignore-case");}if p["wholeWord"]==true{command.arg("--word-regexp");}if p["includeIgnored"]==true{command.args(["--hidden","--no-ignore"]);}
    for key in ["includeGlobs","excludeGlobs"]{if let Some(globs)=p[key].as_array(){for glob in globs{let glob=glob.as_str().ok_or_else(||HostError::new("INVALID_ARGUMENT","路径范围必须为字符串"))?;globset::Glob::new(glob).map_err(|e|HostError::new("INVALID_ARGUMENT",e.to_string()))?;command.arg("--glob").arg(if key=="excludeGlobs"{format!("!{glob}")}else{glob.to_owned()});}}}
    command.arg("-e").arg(query).arg(".").stdin(std::process::Stdio::null()).stdout(std::process::Stdio::piped()).stderr(std::process::Stdio::piped()).kill_on_drop(true);
    #[cfg(unix)]{use std::os::unix::process::CommandExt;command.as_std_mut().process_group(0);}
    #[cfg(windows)] crate::windows_process::prepare_command(command.as_std_mut());
    let mut child=command.spawn()?;let pid=child.id().unwrap();
    processes().lock().unwrap().insert(task_id.clone(),SearchProcess{project:project.into(),pid,#[cfg(windows)]job:None});
    #[cfg(windows)]
    let job = {
        let handle = child.raw_handle().ok_or_else(||HostError::new("CLEANUP_FAILED","搜索进程句柄缺失"))?;
        match unsafe { crate::windows_process::attach_suspended(handle,pid) } {
            Ok(job) => { processes().lock().unwrap().get_mut(&task_id).unwrap().job=Some(job.clone()); job },
            Err(error) => {
                if matches!(child.try_wait(), Ok(Some(_))) { return Err(HostError::new("IO_ERROR",error.to_string())); }
                // Keep the real Child/lease while its handle cleanup is pending.
                tokio::spawn(async move {
                    let _lease=_lease;
                    loop {
                        if matches!(child.try_wait(), Ok(Some(_))) { break; }
                        let _=child.start_kill();
                        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                    }
                });
                return Err(HostError::new("CLEANUP_FAILED",format!("{error}; 自有搜索PID {pid} 清退未确认，记录已保留")));
            }
        }
    };
    let stdout=child.stdout.take().unwrap();let mut stderr=child.stderr.take().unwrap();let error_reader=tokio::spawn(async move{let mut output=Vec::new();let mut buffer=[0;4096];while let Ok(n)=stderr.read(&mut buffer).await{if n==0{break;}let keep=(64*1024usize).saturating_sub(output.len()).min(n);output.extend_from_slice(&buffer[..keep]);}output});
    let mut reader=tokio::io::BufReader::with_capacity(65536,stdout);let mut event_buffer=vec![];let mut oversized=false;let started=Instant::now();let mut batch=vec![];let mut batch_bytes=0usize;let mut result_bytes=0usize;let mut matched=0usize;let mut files=HashSet::new();let mut truncated=false;let mut cancelled=false;
    loop{
        if state.is_cancelled(&call.request_id){cancelled=true;break;}
        let record=tokio::select!{record=next_record(&mut reader,&mut event_buffer,&mut oversized)=>record?,_=tokio::time::sleep(std::time::Duration::from_millis(50))=>continue};
        let Some((bytes,oversized))=record else{break};if oversized{truncated=true;continue;}
        let record:Value=serde_json::from_slice(&bytes).map_err(|e|HostError::new("IO_ERROR",format!("搜索输出解析失败：{e}")))?;if record["type"]!="match"{continue;}
        let data=&record["data"];let path_bytes=raw_field(&data["path"])?;
        #[cfg(unix)]let relative={use std::os::unix::ffi::OsStringExt;std::path::PathBuf::from(std::ffi::OsString::from_vec(path_bytes))};
        #[cfg(not(unix))]let relative=std::path::PathBuf::from(String::from_utf8(path_bytes).map_err(|_|HostError::new("IO_ERROR","路径编码不受支持"))?);
        let file=state.file_ref(project,&root.join(relative))?;let line_bytes=raw_field(&data["lines"])?;let line_text=std::str::from_utf8(&line_bytes).ok();let mut ranges=vec![];
        for found in data["submatches"].as_array().into_iter().flatten(){let start=found["start"].as_u64().unwrap_or(0)as usize;let end=found["end"].as_u64().unwrap_or(0)as usize;
            if matched>=max{truncated=true;break;}let range=if let Some(text)=line_text{if start>text.len()||end>text.len()||!text.is_char_boundary(start)||!text.is_char_boundary(end){return Err(HostError::new("IO_ERROR","搜索偏移无效"));}json!({"unit":"utf16","from":text[..start].encode_utf16().count(),"to":text[..end].encode_utf16().count()})}else{let absolute=data["absolute_offset"].as_u64().unwrap_or(0);json!({"unit":"byte","from":(absolute+start as u64).to_string(),"to":(absolute+end as u64).to_string()})};ranges.push(range);matched+=1;
        }
        files.insert(file["fileId"].as_str().unwrap().to_owned());
        for group in ranges.chunks(100){let mut item=json!({"file":file,"line":data["line_number"].as_u64().unwrap_or(1).saturating_sub(1),"ranges":group});if let Some(text)=line_text.filter(|text|text.len()<24*1024){item["lineText"]=json!(text.trim_end_matches(['\r','\n']));}
            let size=serde_json::to_vec(&item)?.len();if result_bytes+size>10*1024*1024{truncated=true;result_bytes=10*1024*1024;break;}result_bytes+=size;
            if batch_bytes+size>48*1024||batch.len()>=100{state.emit_task_data(&call.request_id,"search.matches",json!({"items":batch}))?;batch=vec![];batch_bytes=0;}
            batch_bytes+=size;batch.push(item.clone());state.search_results.lock().unwrap().get_mut(&task_id).unwrap().push(item);
        }
        if truncated&&matched>=max||result_bytes>=10*1024*1024{break;}
    }
    if cancelled||truncated{
        #[cfg(unix)] {let _=child.start_kill();}
        #[cfg(windows)] job.terminate().map_err(|e|HostError::new("CLEANUP_FAILED",e.to_string()))?;
    }
    let status=child.wait().await?;
    #[cfg(windows)]
    {
        job.terminate().map_err(|e|HostError::new("CLEANUP_FAILED",e.to_string()))?;
        let stopped=Instant::now();
        while !job.is_empty().map_err(|e|HostError::new("CLEANUP_FAILED",e.to_string()))? {
            if stopped.elapsed()>=std::time::Duration::from_secs(2) { return Err(HostError::new("CLEANUP_FAILED","搜索Job清退尚未确认，资源记录已保留")); }
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
    }
    let errors=error_reader.await.unwrap_or_default();
    if !status.success()&&status.code()!=Some(1)&&!cancelled&&!truncated{return Err(HostError::new("IO_ERROR",String::from_utf8_lossy(&errors).into_owned()));}
    if !batch.is_empty(){state.emit_task_data(&call.request_id,"search.matches",json!({"items":batch}))?;}
    state.persist()?;Ok(json!({"matches":matched,"files":files.len(),"truncated":truncated,"elapsedMs":started.elapsed().as_millis()}))
}

pub fn dispatch(state:Arc<HostState>,call:Call)->Result<Value,HostError>{
    let p=&call.params;let project=call.project_id()?;
    if call.method=="search_results_read"{
        allowed(p,&["taskId","cursor","limit"])?;let task_id=string(p,"taskId")?;
        {let tasks=state.tasks.lock().unwrap();let task=tasks.get(task_id).ok_or_else(||HostError::new("NOT_FOUND","搜索任务已过期"))?;if task.call.scope["projectId"]!=project{return Err(HostError::new("PERMISSION_DENIED","搜索结果属于其他项目"));}}
        let offset=if let Some(cursor)=p["cursor"].as_str(){let cursors=state.cursors.lock().unwrap();let c=cursors.get(cursor).ok_or_else(||HostError::new("STALE_CURSOR","搜索分页过期"))?;if c["taskId"]!=task_id{return Err(HostError::new("PERMISSION_DENIED","游标不属于此搜索"));}c["offset"].as_u64().unwrap_or(0) as usize}else{0};
        let results=state.search_results.lock().unwrap();let all=results.get(task_id).ok_or_else(||HostError::new("NOT_FOUND","搜索结果已过期"))?;
        let limit=p["limit"].as_u64().unwrap_or(200).clamp(1,1000)as usize;let items:Vec<_>=all.iter().skip(offset).take(limit).cloned().collect();
        let next=if offset+items.len()<all.len(){Some(state.register_cursor(json!({"taskId":task_id,"projectId":project,"offset":offset+items.len()})))}else{None};return Ok(json!({"items":items,"nextCursor":next}));
    }
    if call.method!="path_query"{return Err(HostError::new("NOT_FOUND","未知搜索方法"));}
    allowed(p,&["query","generation","limit"])?;let query=string(p,"query")?.to_lowercase();let max=p["limit"].as_u64().unwrap_or(100).clamp(1,1000)as usize;
    if query.is_empty(){return Ok(json!({"items":[],"generation":p["generation"],"truncated":false}));}
    let root=state.project_root(project)?;
    let cached=state.path_search_cache.lock().unwrap().get(project).cloned();
    let(paths,index_truncated)=if let Some(cached)=cached{cached}else{
        let walker=ignore::WalkBuilder::new(&root).hidden(false).require_git(false).follow_links(false).filter_entry(|entry|entry.file_name()!=".git").build();
        let mut paths=Vec::new();let mut bytes=0usize;let mut truncated=false;
        for result in walker{if state.is_cancelled(&call.request_id){return Err(HostError::new("CANCELLED","路径查询已取消"));}let entry=match result{Ok(entry)=>entry,Err(_)=>continue};if !entry.file_type().is_some_and(|kind|kind.is_file()){continue;}let path=entry.into_path();bytes+=path.as_os_str().len();if paths.len()>=100_000||bytes>32*1024*1024{truncated=true;break;}paths.push(path);}
        let paths=Arc::new(paths);state.cache_paths(project,paths.clone(),truncated);(paths,truncated)
    };
    let mut candidates=Vec::new();let mut total=0usize;
    for path in paths.iter(){if state.is_cancelled(&call.request_id){return Err(HostError::new("CANCELLED","路径查询已取消"));}let display=path.strip_prefix(&root).unwrap_or(path).to_string_lossy().to_lowercase();if let Some(score)=fuzzy_score(&display,&query){total+=1;candidates.push((score,path));if candidates.len()>max*2{candidates.sort_by(|a,b|b.0.cmp(&a.0).then_with(||a.1.cmp(b.1)));candidates.truncate(max);}}}
    candidates.sort_by(|a,b|b.0.cmp(&a.0).then_with(||a.1.cmp(b.1)));candidates.truncate(max);
    let items=candidates.into_iter().map(|(score,path)|state.file_ref(project,path).map(|file|json!({"file":file,"score":score}))).collect::<Result<Vec<_>,_>>()?;
    state.persist()?;Ok(json!({"items":items,"generation":p["generation"],"truncated":index_truncated||total>max}))
}
fn fuzzy_score(path:&str,query:&str)->Option<i64>{
    if let Some(position)=path.find(query){return Some(10_000-position as i64-path.len()as i64);}
    let mut chars=path.chars().enumerate();let mut first=None;let mut last=0usize;
    for target in query.chars(){let(index,_)=chars.find(|(_,ch)|*ch==target)?;first.get_or_insert(index);last=index;}
    Some(5_000-(last-first.unwrap_or(0))as i64-path.len()as i64)
}
