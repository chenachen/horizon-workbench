use horizon_host::{search,state::{id,TaskRecord},Call,HostState};
use serde_json::{json,Value};
use std::{collections::VecDeque,fs,sync::Arc,time::{Duration,Instant}};

fn setup()->(tempfile::TempDir,tempfile::TempDir,Arc<HostState>,String){let data=tempfile::tempdir().unwrap();let project=tempfile::tempdir().unwrap();let state=Arc::new(HostState::new(data.path().into()).unwrap());let registered=state.register_project(project.path().into(),None,None).unwrap();let project_id=registered["project"]["id"].as_str().unwrap().to_owned();(data,project,state,project_id)}
fn task(state:&HostState,project:&str,params:Value)->(String,Call){let call=Call{protocol_version:1,request_id:id(),method:"search_start".into(),scope:json!({"kind":"project","projectId":project,"projectEpoch":1}),params,idempotency_key:None};let task_id=id();state.tasks.lock().unwrap().insert(task_id.clone(),TaskRecord{id:task_id.clone(),call:call.clone(),state:"running".into(),cancelled:false,seq:0,ack:0,events:VecDeque::new(),ring_bytes:0,channel:None,terminal:None,updated:Instant::now()});(task_id,call)}
fn params(query:&str)->Value{json!({"query":query,"regex":false,"caseSensitive":true,"wholeWord":false,"includeGlobs":[],"excludeGlobs":[],"includeIgnored":false})}

#[tokio::test]async fn ripgrep_reports_utf16_positions_and_respects_ignore(){
    let(_data,root,state,project)=setup();fs::write(root.path().join("中文.txt"),"😀 你好 world\n").unwrap();fs::write(root.path().join(".gitignore"),"ignored.txt\n").unwrap();fs::write(root.path().join("ignored.txt"),"你好").unwrap();
    let(task_id,call)=task(&state,&project,params("你好"));let result=search::start(state.clone(),call).await.unwrap();assert_eq!(result["matches"],1);let results=state.search_results.lock().unwrap();assert_eq!(results[&task_id][0]["ranges"][0],json!({"unit":"utf16","from":3,"to":5}));assert_eq!(results[&task_id][0]["file"]["displayPath"],"中文.txt");assert!(search::resources(Some(&project)).is_empty());
}

#[tokio::test]async fn invalid_utf8_search_uses_absolute_byte_ranges(){
    let(_data,root,state,project)=setup();fs::write(root.path().join("bytes.txt"),[0xff,0xfe,b' ',b'n',b'e',b'e',b'd',b'l',b'e',b'\n']).unwrap();
    // A leading UTF-16 BOM is decoded by rg, so put the invalid byte after an ASCII prefix.
    fs::write(root.path().join("bytes.txt"),b"x\xff needle\n").unwrap();
    let(task_id,call)=task(&state,&project,params("needle"));let result=search::start(state.clone(),call).await.unwrap();assert_eq!(result["matches"],1);assert_eq!(state.search_results.lock().unwrap()[&task_id][0]["ranges"][0],json!({"unit":"byte","from":"3","to":"9"}));
}

#[tokio::test]async fn ripgrep_limits_results_and_preserves_readable_pages(){
    let(_data,root,state,project)=setup();fs::write(root.path().join("hits.txt"),"hit\n".repeat(20_000)).unwrap();let mut query=params("hit");query["maxMatches"]=json!(125);
    let(task_id,call)=task(&state,&project,query);let result=search::start(state.clone(),call.clone()).await.unwrap();assert_eq!(result["matches"],125);assert_eq!(result["truncated"],true);
    let mut page=call;page.method="search_results_read".into();page.params=json!({"taskId":task_id,"limit":100});let first=search::dispatch(state.clone(),page.clone()).unwrap();assert_eq!(first["items"].as_array().unwrap().len(),100);page.params["cursor"]=first["nextCursor"].clone();let second=search::dispatch(state.clone(),page).unwrap();assert_eq!(second["items"].as_array().unwrap().len(),25);assert!(search::resources(Some(&project)).is_empty());
}

#[tokio::test]async fn cancellation_reaps_the_owned_search_process(){
    let(_data,root,state,project)=setup();fs::write(root.path().join("hits.txt"),"hit\n".repeat(500_000)).unwrap();let(task_id,call)=task(&state,&project,params("hit"));let control=state.clone();
    let cancel=tokio::spawn(async move{tokio::time::sleep(Duration::from_millis(1)).await;control.tasks.lock().unwrap().get_mut(&task_id).unwrap().cancelled=true;});
    let started=Instant::now();let result=search::start(state.clone(),call).await;cancel.await.unwrap();assert!(started.elapsed()<Duration::from_secs(3));match result{Ok(result)=>assert!(result["matches"].as_u64().unwrap()<10_000),Err(error)=>assert_eq!(error.code,"CANCELLED")};assert!(search::resources(Some(&project)).is_empty());
}

#[tokio::test]async fn invalid_regex_does_not_spawn_a_process(){let(_data,_root,state,project)=setup();let mut query=params("[");query["regex"]=json!(true);let(_,call)=task(&state,&project,query);assert_eq!(search::start(state,call).await.unwrap_err().code,"INVALID_ARGUMENT");assert!(search::resources(Some(&project)).is_empty());}

#[test]fn fuzzy_paths_reuse_a_bounded_index(){let(_data,root,state,project)=setup();fs::create_dir(root.path().join("src")).unwrap();fs::write(root.path().join("src/LongComponent.tsx"),"x").unwrap();let call=Call{protocol_version:1,request_id:id(),method:"path_query".into(),scope:json!({"kind":"project","projectId":project,"projectEpoch":1}),params:json!({"query":"lcp","generation":7}),idempotency_key:None};let result=search::dispatch(state.clone(),call).unwrap();assert_eq!(result["items"].as_array().unwrap().len(),1);assert_eq!(result["generation"],7);assert_eq!(state.path_search_cache.lock().unwrap().len(),1);}

#[tokio::test]async fn completed_search_and_path_caches_are_bounded_across_projects(){
    let(_data,root,state,project)=setup();let mut oldest=None;
    for _ in 0..8{let(task_id,call)=task(&state,&project,params(""));search::start(state.clone(),call).await.unwrap();if oldest.is_none(){oldest=Some(task_id.clone());}state.tasks.lock().unwrap().get_mut(&task_id).unwrap().terminal=Some(json!({"state":"succeeded"}));}
    assert_eq!(state.search_results.lock().unwrap().len(),4);assert!(!state.search_results.lock().unwrap().contains_key(&oldest.unwrap()));
    for index in 0..8{state.cache_paths(&format!("project-{index}"),Arc::new(vec![root.path().join("file")]),false);}assert_eq!(state.path_search_cache.lock().unwrap().len(),4);
    for _ in 0..40{let(task_id,_)=task(&state,&project,params(""));state.tasks.lock().unwrap().get_mut(&task_id).unwrap().terminal=Some(json!({"state":"succeeded"}));}
    let(active,_)=task(&state,&project,params("active"));state.trim_task_cache();let tasks=state.tasks.lock().unwrap();assert_eq!(tasks.values().filter(|task|task.terminal.is_some()).count(),32);assert!(tasks.contains_key(&active));
}
