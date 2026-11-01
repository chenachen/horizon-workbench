use crate::{protocol::{allowed,revision,string},state::{atomic_json,digest,id,now},Call,HostError,HostState};
use serde_json::{json,Map,Value};
use std::{fs,io::Write,sync::Arc};

pub fn defaults()->Value{json!({
    "editor.fontSize":14,"editor.fontFamily":"Menlo","editor.tabSize":2,"editor.insertSpaces":true,"editor.wordWrap":"off","editor.lineNumbers":true,"editor.autoSave":"off","editor.autoSaveDelay":1000,
    "files.showHidden":true,"files.showIgnored":false,"git.autoFetch":false,"git.path":"git","git.diffView":"inline","git.autoRefresh":true,"git.pullStrategy":"ff-only",
    "resources.idleMinutes":5,"resources.profile":"review","resources.keepRunning":false,"ui.fontSize":13,"ui.density":"theme","ui.reduceMotion":"system","shortcuts":{}
})}
const GLOBAL_SETTINGS: &[&str] = &["ui.fontSize", "ui.density", "ui.reduceMotion", "editor.fontSize", "editor.fontFamily", "git.path", "git.diffView", "shortcuts"];
fn global_only(key: &str) -> bool { GLOBAL_SETTINGS.contains(&key) }
fn load(state:&HostState)->Result<Value,HostError>{
    static MIGRATION_LOCK:std::sync::Mutex<()>=std::sync::Mutex::new(());let _lock=MIGRATION_LOCK.lock().unwrap();
    let path=state.data_dir().join("settings.json");let bytes=if path.exists(){Some(fs::read(&path)?)}else{None};
    let mut value=if let Some(bytes)=&bytes{serde_json::from_slice(bytes)?}else{json!({"schemaVersion":2,"revision":1,"global":{},"projects":{}})};
    if value["schemaVersion"]!=1&&value["schemaVersion"]!=2{return Err(HostError::new("CONFIG_VERSION_UNSUPPORTED","设置版本高于此应用支持范围"));}
    if value["schemaVersion"]==1 {
        let active=state.registry.lock().unwrap().sessions.get("__app").and_then(|session|session["activeProjectId"].as_str()).map(str::to_owned);
        let appearance_path=state.data_dir().join("appearance.json");
        let appearance:Value=if appearance_path.exists(){serde_json::from_slice(&fs::read(appearance_path)?)?}else{json!({})};
        migrate_global_settings(&mut value,active.as_deref(),&appearance);
        let backup=state.data_dir().join("settings-v1.backup.json");if let Some(bytes)=bytes{if !backup.exists(){fs::write(backup,bytes)?;}}
        atomic_json(&path,&value)?;
    }
    // Agent connections have their own typed store. Retired legacy objects are
    // neither exposed as effective settings nor copied into future saves.
    if let Some(global)=value["global"].as_object_mut(){global.remove("connections");}
    if let Some(projects)=value["projects"].as_object_mut(){for fields in projects.values_mut(){if let Some(fields)=fields.as_object_mut(){fields.remove("connections");}}}Ok(value)
}
fn migrate_global_settings(value:&mut Value,active:Option<&str>,appearance:&Value){
    let current=active.and_then(|id|value["projects"][id].as_object()).cloned().unwrap_or_default();
    for key in GLOBAL_SETTINGS {if let Some(setting)=current.get(*key){value["global"][*key]=setting.clone();}}
    if let Some(projects)=value["projects"].as_object_mut(){for fields in projects.values_mut(){if let Some(fields)=fields.as_object_mut(){fields.retain(|key,_|!global_only(key));}}}
    let mut fields=appearance["global"].as_object().cloned().unwrap_or_default();
    if let Some(project)=active.and_then(|id|appearance["projects"][id].as_object()){fields.extend(project.clone());}
    let layout=fields.get("layoutId").and_then(Value::as_str).unwrap_or("horizon.layout.mist");
    for (legacy,key) in [("uiFontSize","ui.fontSize"),("codeFontSize","editor.fontSize")] {
        if let Some(font)=fields.get(&format!("geometry:{layout}:{legacy}")){value["global"][key]=font.clone();}
    }
    value["schemaVersion"]=json!(2);value["revision"]=json!(value["revision"].as_u64().unwrap_or(0)+1);
}
fn credential_index(state:&HostState)->Result<Value,HostError>{let path=state.data_dir().join("credential-index.json");if path.exists(){Ok(serde_json::from_slice(&fs::read(path)?)?)}else{Ok(json!({"schemaVersion":1,"items":[]}))}}
pub(crate) fn credential_secret(state:&HostState,credential_ref:&str)->Result<String,HostError>{
    let credentials=state.credentials.lock().unwrap();let index=credential_index(state)?;
    let item=index["items"].as_array().and_then(|items|items.iter().find(|item|item["credentialRef"]==credential_ref)).ok_or_else(||HostError::new("CREDENTIAL_UNAVAILABLE","凭据未配置"))?;
    match item["persistence"].as_str(){
        Some("session")=>credentials.get(credential_ref).cloned().ok_or_else(||HostError::new("CREDENTIAL_UNAVAILABLE","本次会话凭据已过期，请重新填写")),
        Some("system")=>keyring::Entry::new("dev.horizon.desktop",credential_ref).and_then(|entry|entry.get_password()).map_err(|_|HostError::new("CREDENTIAL_UNAVAILABLE","系统凭据不可用")),
        _=>Err(HostError::new("CREDENTIAL_UNAVAILABLE","凭据持久化方式无效")),
    }
}
fn commit_session_index(state:&HostState,index:&Value,credential_ref:&str)->Result<(),HostError>{
    let path=state.data_dir().join("credential-index.json");let mut staged=tempfile::NamedTempFile::new_in(state.data_dir())?;staged.write_all(&serde_json::to_vec_pretty(index)?)?;staged.as_file().sync_all()?;
    let entry=keyring::Entry::new("dev.horizon.desktop",credential_ref).map_err(|_|HostError::new("CREDENTIAL_UNAVAILABLE","无法访问原系统凭据，尚未切换持久化方式"))?;
    let previous=match entry.get_password(){Ok(secret)=>Some(secret),Err(keyring::Error::NoEntry)=>None,Err(_)=>return Err(HostError::new("CREDENTIAL_UNAVAILABLE","无法读取原系统凭据，尚未切换持久化方式"))};
    match entry.delete_credential(){Ok(())|Err(keyring::Error::NoEntry)=>{},Err(_)=>return Err(HostError::new("CREDENTIAL_UNAVAILABLE","无法移除原系统凭据，尚未切换持久化方式"))}
    if let Err(error)=staged.persist(&path){
        if previous.as_ref().is_some_and(|secret|entry.set_password(secret).is_err()){return Err(HostError::new("OUTCOME_UNKNOWN","设置未保存且原系统凭据恢复失败，请重新配置该连接凭据"));}
        return Err(HostError::from(error.error));
    }
    Ok(())
}
fn commit_system_index(state:&HostState,index:&Value,credential_ref:&str,secret:&str)->Result<(),HostError>{
    let path=state.data_dir().join("credential-index.json");let mut staged=tempfile::NamedTempFile::new_in(state.data_dir())?;staged.write_all(&serde_json::to_vec_pretty(index)?)?;staged.as_file().sync_all()?;
    let entry=keyring::Entry::new("dev.horizon.desktop",credential_ref).map_err(|_|HostError::new("CREDENTIAL_UNAVAILABLE","无法访问系统钥匙串；可改为仅本次会话"))?;entry.set_password(secret).map_err(|_|HostError::new("CREDENTIAL_UNAVAILABLE","无法保存至系统钥匙串；可改为仅本次会话"))?;
    if let Err(error)=staged.persist(&path){
        if !matches!(entry.delete_credential(),Ok(())|Err(keyring::Error::NoEntry)){return Err(HostError::new("OUTCOME_UNKNOWN","凭据索引未保存且新系统凭据清理失败，请重试保存该连接凭据").details(json!({"credentialRef":credential_ref,"effect":"unknown"})));}
        return Err(HostError::from(error.error));
    }
    Ok(())
}
fn effective(settings:&Value,project:Option<&str>)->Value{
    let mut values=defaults();for(key,value)in settings["global"].as_object().into_iter().flatten(){values[key]=value.clone();}
    if let Some(project)=project{for(key,value)in settings["projects"][project].as_object().into_iter().flatten(){if !global_only(key){values[key]=value.clone();}}}values
}
pub fn effective_for(state:&HostState,project:Option<&str>)->Result<Value,HostError>{let mut values=effective(&load(state)?,project);values["resources.profile"]=crate::extensions::resource_profile(state,project)?["profile"].clone();Ok(values)}
fn validate(key:&str,value:&Value)->Result<(),HostError>{
    let valid=match key{
        "editor.fontSize"=>value.as_u64().is_some_and(|n|(8..=40).contains(&n)),
        "ui.fontSize"=>value.as_u64().is_some_and(|n|(11..=20).contains(&n)),
        "editor.tabSize"=>value.as_u64().is_some_and(|n|(1..=8).contains(&n)),
        "editor.autoSaveDelay"=>value.as_u64().is_some_and(|n|(500..=60_000).contains(&n)),
        "resources.idleMinutes"=>value.as_u64().is_some_and(|n|(1..=120).contains(&n)),
        "editor.fontFamily"=>value.as_str().is_some_and(|s|!s.is_empty()&&s.len()<=128&&!s.chars().any(|c|c.is_control())),
        "git.path"=>value.as_str().is_some_and(|s|s=="git"||(std::path::Path::new(s).is_absolute()&&s.len()<4096)),
        "editor.wordWrap"=>["on","off"].contains(&value.as_str().unwrap_or("")),
        "editor.autoSave"=>["off","afterDelay","onFocusChange"].contains(&value.as_str().unwrap_or("")),
        "git.diffView"=>["split","inline"].contains(&value.as_str().unwrap_or("")),
        "git.pullStrategy"=>value=="ff-only",
        "ui.density"=>["theme","compact","comfortable","spacious"].contains(&value.as_str().unwrap_or("")),
        "ui.reduceMotion"=>["system","on","off"].contains(&value.as_str().unwrap_or("")),
        "resources.profile"=>["minimal","review","development","custom"].contains(&value.as_str().unwrap_or("")),
        "editor.lineNumbers"|"editor.insertSpaces"|"files.showHidden"|"files.showIgnored"|"git.autoFetch"|"git.autoRefresh"|"resources.keepRunning"=>value.is_boolean(),
        "shortcuts"=>value.as_object().is_some_and(|m|m.len()<200&&m.values().all(|v|v.as_str().is_some_and(|s|s.len()<100))),
        _=>false,
    };
    if valid{Ok(())}else{Err(HostError::new("INVALID_ARGUMENT",format!("设置 {key} 的值不受支持")))}
}
const SHORTCUT_COMMANDS:&[&str]=&["file.open","command.open","file.save","file.saveAll","file.close","settings.open","sidebar.toggle","search.open","agent.toggle","terminal.toggle","focus.toggle"];
fn safe_shortcut(value:&Value)->bool{let Some(value)=value.as_str()else{return false};if value.is_empty(){return true;}let parts=value.split('+').collect::<Vec<_>>();let Some((key,modifiers))=parts.split_last()else{return false};modifiers.iter().all(|part|["Meta","Ctrl","Alt","Shift"].contains(part))&&(key.chars().count()==1||["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown","Backspace","Delete","Enter","Escape","Tab","Space"].contains(key)||key.strip_prefix('F').and_then(|number|number.parse::<u8>().ok()).is_some_and(|number|(1..=24).contains(&number)))}
fn contains_absolute_path(text:&str)->bool{
    static PATH:std::sync::OnceLock<regex::Regex>=std::sync::OnceLock::new();
    std::path::Path::new(text).is_absolute()||PATH.get_or_init(||regex::Regex::new(r#"(?i)(?:^|[\s\"'(\[{:=>：])(?:/[^\s/]|[a-z]:[\\/]|\\\\[^\s\\])"#).unwrap()).is_match(text)
}
fn export_settings_fields(fields:&Value)->Value{
    let mut result=Map::new();for key in defaults().as_object().unwrap().keys(){let Some(value)=fields.get(key)else{continue};if key=="shortcuts"{let shortcuts=value.as_object().into_iter().flatten().filter(|(command,value)|SHORTCUT_COMMANDS.contains(&command.as_str())&&safe_shortcut(value)).map(|(key,value)|(key.clone(),value.clone())).collect();result.insert(key.clone(),Value::Object(shortcuts));}else if validate(key,value).is_ok()&&!value.as_str().is_some_and(contains_absolute_path){result.insert(key.clone(),value.clone());}}
    Value::Object(result)
}
fn export_settings(settings:&Value)->Value{let projects=settings["projects"].as_object().into_iter().flatten().filter(|(id,_)|uuid::Uuid::parse_str(id).is_ok()).map(|(id,fields)|(id.clone(),export_settings_fields(fields))).collect::<Map<_,_>>();json!({"schemaVersion":2,"revision":settings["revision"].as_u64().unwrap_or(0),"global":export_settings_fields(&settings["global"]),"projects":projects})}

const APPEARANCE_GEOMETRY:&[&str]=&["sidebarWidth","navigationWidth","topbarHeight","tabHeight","tabMinWidth","auxiliaryWidth","bottomHeight","statusHeight","uiFontSize","codeFontSize"];
const APPEARANCE_COLORS:&[&str]=&["background","surface","text","muted","border","accent","onAccent","selection","success","warning","error"];
fn resource_id(value:&str)->bool{!value.is_empty()&&value.len()<=160&&value.chars().all(|ch|ch.is_ascii_alphanumeric()||matches!(ch,'.'|'-'|'_'))}
fn asset_id(value:&Value)->bool{value.as_str().is_some_and(|id|id.len()==64&&id.chars().all(|ch|ch.is_ascii_hexdigit()))}
fn export_color(value:&Value)->Option<Value>{let color=value.as_str()?.trim();if let Some(hex)=color.strip_prefix('#'){if [3,6,8].contains(&hex.len())&&hex.chars().all(|ch|ch.is_ascii_hexdigit()){return Some(json!(color));}}let rgb=color.strip_prefix("rgb(")?.strip_suffix(')')?.split(',').map(|part|part.trim().parse::<u8>()).collect::<Result<Vec<_>,_>>().ok()?;if rgb.len()==3{Some(json!(format!("#{:02x}{:02x}{:02x}",rgb[0],rgb[1],rgb[2])))}else{None}}
fn export_background(value:&Value)->Option<Value>{
    if !value["assetId"].is_null()&&!asset_id(&value["assetId"]){return None;}if !["workbench","sidebar","editor"].contains(&value["region"].as_str().unwrap_or(""))||!["cover","contain"].contains(&value["fit"].as_str().unwrap_or("")){return None;}
    for(field,min,max)in [(&value["position"]["x"],0.0,1.0),(&value["position"]["y"],0.0,1.0),(&value["opacity"],0.0,0.4),(&value["overlay"],0.4,1.0)]{if !field.as_f64().is_some_and(|number|number.is_finite()&&number>=min&&number<=max){return None;}}
    Some(json!({"assetId":value["assetId"],"region":value["region"],"fit":value["fit"],"position":{"x":value["position"]["x"],"y":value["position"]["y"]},"opacity":value["opacity"],"overlay":value["overlay"]}))
}
fn export_appearance_field(key:&str,value:&Value)->Option<Value>{match key.split(':').collect::<Vec<_>>().as_slice(){
    ["layoutId"|"themeId"]if value.as_str().is_some_and(resource_id)=>Some(value.clone()),
    ["mode"]if ["system","light","dark"].contains(&value.as_str().unwrap_or(""))=>Some(value.clone()),
    ["background"]=>export_background(value),
    ["geometry",layout,metric]if resource_id(layout)&&APPEARANCE_GEOMETRY.contains(metric)&&value.as_f64().is_some_and(|number|number.is_finite()&&(0.0..=10_000.0).contains(&number))=>Some(value.clone()),
    ["color",theme,mode,token]if resource_id(theme)&&["light","dark"].contains(mode)&&APPEARANCE_COLORS.contains(token)=>export_color(value),_=>None}}
fn export_appearance_fields(fields:&Value)->Value{Value::Object(fields.as_object().into_iter().flatten().filter_map(|(key,value)|export_appearance_field(key,value).map(|value|(key.clone(),value))).collect())}
fn export_appearance_values(values:&Value)->Value{
    let mut result=json!({"geometryByLayout":{},"colorsByTheme":{}});for key in ["layoutId","themeId","mode","background"]{if let Some(value)=export_appearance_field(key,&values[key]){result[key]=value;}}
    for(layout,geometry)in values["geometryByLayout"].as_object().into_iter().flatten(){for(metric,value)in geometry.as_object().into_iter().flatten(){if let Some(value)=export_appearance_field(&format!("geometry:{layout}:{metric}"),value){result["geometryByLayout"][layout][metric]=value;}}}
    for(theme,modes)in values["colorsByTheme"].as_object().into_iter().flatten(){for(mode,colors)in modes.as_object().into_iter().flatten(){for(token,value)in colors.as_object().into_iter().flatten(){if let Some(value)=export_appearance_field(&format!("color:{theme}:{mode}:{token}"),value){result["colorsByTheme"][theme][mode][token]=value;}}}}result
}
fn export_appearance(appearance:&Value)->Value{
    let projects=appearance["projects"].as_object().into_iter().flatten().filter(|(id,_)|uuid::Uuid::parse_str(id).is_ok()).map(|(id,fields)|(id.clone(),export_appearance_fields(fields))).collect::<Map<_,_>>();
    let presets=appearance["presets"].as_array().into_iter().flatten().filter(|preset|preset["id"].as_str().is_some_and(|id|uuid::Uuid::parse_str(id).is_ok())&&preset["name"].as_str().is_some_and(|name|!name.is_empty()&&name.chars().count()<=48&&!contains_absolute_path(name))).map(|preset|{let packages=preset["packageRefs"].as_array().into_iter().flatten().filter(|reference|reference["id"].as_str().is_some_and(resource_id)&&reference["apiVersion"]==1).map(|reference|json!({"id":reference["id"],"apiVersion":1})).collect::<Vec<_>>();let assets=preset["assetRefs"].as_array().into_iter().flatten().filter(|id|asset_id(id)).cloned().collect::<Vec<_>>();json!({"id":preset["id"],"revision":preset["revision"].as_u64().unwrap_or(0),"name":preset["name"],"values":export_appearance_values(&preset["values"]),"packageRefs":packages,"assetRefs":assets})}).collect::<Vec<_>>();
    let assets=appearance["assets"].as_object().into_iter().flatten().filter(|(id,asset)|asset_id(&json!(id))&&asset["id"]==id.as_str()&&asset["mediaType"]=="image/png"&&["width","height"].iter().all(|field|asset[*field].as_u64().is_some_and(|number|number>0&&number<=2560))&&asset["bytes"].as_str().is_some_and(|bytes|bytes.parse::<u64>().is_ok())).map(|(id,asset)|(id.clone(),json!({"id":id,"revision":asset["revision"].as_u64().unwrap_or(0),"contentHash":id,"mediaType":"image/png","width":asset["width"],"height":asset["height"],"bytes":asset["bytes"],"previewToken":id}))).collect::<Map<_,_>>();
    json!({"schemaVersion":appearance["schemaVersion"].as_u64().unwrap_or(1),"revision":appearance["revision"].as_u64().unwrap_or(0),"global":export_appearance_fields(&appearance["global"]),"projects":projects,"presets":presets,"assets":assets})
}

const EDITOR_MEASUREMENT:&str="durationMs: open intent to CodeMirror layout followed by next visible frame; languageReadyMs: language module ready from same start; highlightReadyMs: viewport syntax tree complete followed by next visible frame. Pixel paint is not directly observed.";
fn diagnostic_number(value:&Value)->bool{value.as_f64().is_some_and(|n|n.is_finite()&&n>=0.0&&n<=9_007_199_254_740_991.0)}
fn diagnostic_integer(value:&Value)->bool{value.as_u64().is_some_and(|n|n<=9_007_199_254_740_991)}
fn validate_frontend_diagnostics(frontend:&Value)->Result<(),HostError>{
    allowed(frontend,&["editor","runtime"])?;
    if let Some(runtime)=frontend.get("runtime"){
        const FIELDS:[&str;15]=["schemaVersion","eventListeners","eventListenersDisposing","eventListenerDisposalFailures","workerEventListeners","workerAbortListeners","workerCommandObservers","workerCommands","workerViews","pluginInstances","pluginInstancesDisposing","cordisRootListeners","cordisPluginListeners","pluginStoreObservers","activationErrorObservers"];
        allowed(runtime,&FIELDS)?;
        if runtime["schemaVersion"]!=1||runtime.as_object().unwrap().len()!=FIELDS.len()||FIELDS[1..].iter().any(|field|!diagnostic_integer(&runtime[*field])){return Err(HostError::new("INVALID_ARGUMENT","运行时诊断需要schemaVersion 1及完整的非负安全整数计数"));}
    }
    let editor=frontend["editor"].as_object().ok_or_else(||HostError::new("INVALID_ARGUMENT","前端诊断必须为编辑器统计"))?;
    if editor.len()>32{return Err(HostError::new("INVALID_ARGUMENT","编辑器诊断字段超过上限"));}
    for(key,value)in editor{
        if key=="opens"{
            let samples=value.as_array().filter(|samples|samples.len()<=200).ok_or_else(||HostError::new("INVALID_ARGUMENT","编辑器采样必须为最多200条的数组"))?;
            for sample in samples{
                allowed(sample,&["id","cache","startedAtMs","durationMs","languageReadyMs","highlightReadyMs","byteLength","editorRevision","viewId","language"])?;
                if !diagnostic_integer(&sample["id"])||!diagnostic_integer(&sample["startedAtMs"])||!["cold","warm"].contains(&sample["cache"].as_str().unwrap_or("")){return Err(HostError::new("INVALID_ARGUMENT","编辑器采样缺少有效id、cache或startedAtMs"));}
                for field in ["durationMs","languageReadyMs","highlightReadyMs"]{if sample.get(field).is_some_and(|value|!diagnostic_number(value)){return Err(HostError::new("INVALID_ARGUMENT","编辑器耗时必须为有限非负数"));}}
                for field in ["byteLength","editorRevision","viewId"]{if sample.get(field).is_some_and(|value|!diagnostic_integer(value)){return Err(HostError::new("INVALID_ARGUMENT","编辑器计数必须为非负安全整数"));}}
                if let Some(language)=sample.get("language"){if !["plain","ts","tsx","js","mjs","cjs","jsx","json","jsonc","md","mdx","markdown","css","html","htm","svg","xml","py","rs","sql"].contains(&language.as_str().unwrap_or("")){return Err(HostError::new("INVALID_ARGUMENT","编辑器语言不在诊断白名单内"));}}
            }
        }else if key.is_empty()||key.len()>64||!key.chars().next().unwrap().is_ascii_alphabetic()||!key.chars().all(|c|c.is_ascii_alphanumeric())||!(value.is_null()||value.is_boolean()||diagnostic_number(value)){
            return Err(HostError::new("INVALID_ARGUMENT","诊断只允许有界数值统计及匿名编辑器采样"));
        }
    }
    Ok(())
}
fn host_diagnostics(state:&HostState,frontend:&Value)->Value{
    let tasks={let tasks=state.tasks.lock().unwrap();let completed=tasks.values().filter(|task|task.terminal.is_some()).count();json!({"total":tasks.len(),"active":tasks.len()-completed,"completedCached":completed})};
    let(path_projects,path_count)={let paths=state.path_search_cache.lock().unwrap();(paths.len(),paths.values().map(|(paths,_)|paths.len()).sum::<usize>())};
    let(search_tasks,search_items)={let results=state.search_results.lock().unwrap();(results.len(),results.values().map(Vec::len).sum::<usize>())};
    json!({"version":env!("CARGO_PKG_VERSION"),"platform":std::env::consts::OS,"architecture":std::env::consts::ARCH,
        "taskRecords":tasks,"openDocuments":state.documents.lock().unwrap().len(),"watchers":state.watchers.lock().unwrap().len(),"subscriptions":state.subscriptions.lock().unwrap().len(),"cursors":state.cursors.lock().unwrap().len(),
        "caches":{"pathSearchProjects":path_projects,"pathSearchPaths":path_count,"searchResultTasks":search_tasks,"searchResultItems":search_items,"idempotencyEntries":state.idempotency.lock().unwrap().len(),"operationPlans":state.plans.lock().unwrap().len(),"entityRevisionEntries":state.entity_revisions.lock().unwrap().len()},"frontend":frontend})
}
const EXPORT_LIMIT:usize=1024*1024;
fn export_snapshot(state:&HostState,p:&Value)->Result<(Value,String),HostError>{
    let categories=p["categories"].as_array().filter(|items|!items.is_empty()).ok_or_else(||HostError::new("INVALID_ARGUMENT","请选择导出类别"))?;if categories.iter().any(|category|category!="settings"&&category!="diagnostics"){return Err(HostError::new("INVALID_ARGUMENT","未知导出类别"));}
    if let Some(frontend)=p.get("frontendDiagnostics"){validate_frontend_diagnostics(frontend)?;}
    let mut data=json!({"schemaVersion":1,"exportedAt":now()});if categories.contains(&json!("settings")){data["settings"]=export_settings(&load(state)?);let appearance=state.data_dir().join("appearance.json");if appearance.exists(){data["appearance"]=export_appearance(&serde_json::from_slice::<Value>(&fs::read(appearance)?)?);}}
    if categories.contains(&json!("diagnostics")){data["diagnostics"]=host_diagnostics(state,&p["frontendDiagnostics"]);if p.get("frontendDiagnostics").is_some(){data["diagnostics"]["frontend"]["editor"]["measurement"]=json!(EDITOR_MEASUREMENT);}}
    let name=if categories.len()==1&&categories[0]=="settings"{"horizon-settings.json"}else if categories.len()==1&&categories[0]=="diagnostics"{"horizon-diagnostics.json"}else{"horizon-export.json"};Ok((data,name.into()))
}
fn write_export(state:&HostState,p:&Value,bytes:&[u8])->Result<Value,HostError>{
    let name=string(p,"name")?;crate::files::validate_name(name)?;let directory=state.resolve_selection(string(p,"destinationSelectionToken")?)?;let path=if directory.is_dir(){directory.join(name)}else{directory};
    let mut file=fs::OpenOptions::new().create_new(true).write(true).open(path)?;file.write_all(bytes)?;file.sync_all()?;Ok(json!({"exportReceiptId":id(),"excludedFields":["secrets","credentials","documentText","absolutePaths","legacyConnections","unknownConfigurationFields"],"bytesWritten":bytes.len().to_string()}))
}

pub fn dispatch(state:Arc<HostState>,call:Call)->Result<Value,HostError>{
    let p=&call.params;
    match call.method.as_str(){
        "settings_get"=>{
            allowed(p,&["projectId"])?;let project=p["projectId"].as_str();if let Some(id)=project{state.project_root(id)?;if call.scope["kind"]=="project"&&call.project_id()?!=id{return Err(HostError::new("PERMISSION_DENIED","设置项目不匹配"));}}
            let settings=load(&state)?;let mut values=effective(&settings,project);let profile=crate::extensions::resource_profile(&state,project)?;values["resources.profile"]=profile["profile"].clone();let mut sources=Map::new();for key in values.as_object().unwrap().keys(){sources.insert(key.clone(),json!(if !global_only(key)&&project.is_some_and(|p|settings["projects"][p].get(key).is_some()){"project"}else if settings["global"].get(key).is_some(){"global"}else{"default"}));}
            sources.insert("resources.profile".into(),profile["source"].clone());Ok(json!({"revision":settings["revision"],"global":settings["global"],"overrides":project.map(|id|settings["projects"][id].clone()).unwrap_or(json!({})),"effective":values,"sources":sources}))
        }
        "settings_patch"=>{
            allowed(p,&["scope","projectId","expectedRevision","set","unset"])?;let mut settings=load(&state)?;
            if settings["revision"].as_u64()!=Some(revision(p,"expectedRevision")?){return Err(HostError::new("STALE_VERSION","设置已更新，请刷新"));}
            let global=string(p,"scope")?=="global";if !global&&p["scope"]!="project"{return Err(HostError::new("INVALID_ARGUMENT","未知设置范围"));}
            let project=if global{if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","全局设置需应用作用域"));}None}else{let id=string(p,"projectId")?;if call.project_id()?!=id{return Err(HostError::new("PERMISSION_DENIED","项目范围不匹配"));}Some(id)};
            let set=p["set"].as_object().ok_or_else(||HostError::new("INVALID_ARGUMENT","set必须是对象"))?;let unset=p["unset"].as_array().ok_or_else(||HostError::new("INVALID_ARGUMENT","unset必须是数组"))?;
            if set.contains_key("resources.profile")||unset.contains(&json!("resources.profile")){return Err(HostError::new("INVALID_ARGUMENT","请在插件中心的能力预设中确认启停影响后应用"));}
            if !global&&(set.keys().any(|key|global_only(key))||unset.iter().filter_map(Value::as_str).any(global_only)){return Err(HostError::new("INVALID_ARGUMENT","界面外观、字体、Git 程序、差异视图和快捷键仅支持全局设置"));}
            for(key,value)in set{validate(key,value)?;}let default=defaults();for key in unset{if !key.as_str().is_some_and(|k|default.get(k).is_some()){return Err(HostError::new("INVALID_ARGUMENT","未知设置项"));}}
            let target=if let Some(project)=project{if settings["projects"].get(project).is_none(){settings["projects"][project]=json!({});}&mut settings["projects"][project]}else{&mut settings["global"]};
            for(key,value)in set{target[key]=value.clone();}for key in unset{target.as_object_mut().unwrap().remove(key.as_str().unwrap());}
            settings["revision"]=json!(settings["revision"].as_u64().unwrap()+1);atomic_json(&state.data_dir().join("settings.json"),&settings)?;
            state.notify("horizon.settings.v1",project.unwrap_or("global"),settings["revision"].as_u64().unwrap(),"upsert");Ok(json!({"revision":settings["revision"],"effective":effective_for(&state,project)?}))
        }
        "credential_set"=>{
            allowed(p,&["connectionId","secret","persistence"])?;let connection=string(p,"connectionId")?;let secret=string(p,"secret")?;if secret.is_empty()||secret.len()>64*1024{return Err(HostError::new("INVALID_ARGUMENT","凭据不可为空或超过64 KiB"));}
            let persistence=string(p,"persistence")?;if !["session","system"].contains(&persistence){return Err(HostError::new("INVALID_ARGUMENT","未知凭据持久化方式"));}
            let credential_ref=digest(format!("horizon-credential:{connection}"));let mut credentials=state.credentials.lock().unwrap();let mut index=credential_index(&state)?;let original=index.clone();let items=index["items"].as_array_mut().ok_or_else(||HostError::new("IO_ERROR","凭据索引损坏"))?;let was_system=items.iter().any(|item|item["credentialRef"]==credential_ref&&item["persistence"]=="system");
            let item=json!({"credentialRef":credential_ref,"connectionId":connection,"persistence":persistence});if let Some(existing)=items.iter_mut().find(|item|item["credentialRef"]==credential_ref){existing["connectionId"]=json!(connection);existing["persistence"]=json!(persistence);}else{items.push(item);}
            // The index is authoritative. A session entry never falls back to a
            // legacy system credential, including after an application restart.
            // Remove this connection's old system key before committing session mode.
            if persistence=="system"{if index!=original{commit_system_index(&state,&index,&credential_ref,secret)?;}else{keyring::Entry::new("dev.horizon.desktop",&credential_ref).and_then(|entry|entry.set_password(secret)).map_err(|_|HostError::new("CREDENTIAL_UNAVAILABLE","无法保存至系统钥匙串；可改为仅本次会话"))?;}}
            else if was_system{commit_session_index(&state,&index,&credential_ref)?;}else if index!=original{atomic_json(&state.data_dir().join("credential-index.json"),&index)?;}
            if persistence=="session"{credentials.insert(credential_ref.clone(),secret.to_owned());}else{credentials.remove(&credential_ref);}
            Ok(json!({"credentialRef":credential_ref,"configured":true}))
        }
        "credential_list"=>{allowed(p,&[])?;let mut index=credential_index(&state)?;for item in index["items"].as_array_mut().ok_or_else(||HostError::new("IO_ERROR","凭据索引损坏"))?{let credential_ref=item["credentialRef"].as_str().unwrap_or("");item["configured"]=json!(item["persistence"]=="system"||state.credentials.lock().unwrap().contains_key(credential_ref));}Ok(json!({"items":index["items"]}))}
        "credential_remove"=>{
            allowed(p,&["credentialRef"])?;let credential_ref=string(p,"credentialRef")?;let mut credentials=state.credentials.lock().unwrap();let mut index=credential_index(&state)?;let items=index["items"].as_array_mut().ok_or_else(||HostError::new("IO_ERROR","凭据索引损坏"))?;if !items.iter().any(|item|item["credentialRef"]==credential_ref){return Ok(json!({"removed":false}));}
            let system=match keyring::Entry::new("dev.horizon.desktop",credential_ref).and_then(|entry|entry.delete_credential()){Ok(())=>true,Err(keyring::Error::NoEntry)=>false,Err(_)=>return Err(HostError::new("CREDENTIAL_UNAVAILABLE","无法移除系统凭据"))};items.retain(|item|item["credentialRef"]!=credential_ref);atomic_json(&state.data_dir().join("credential-index.json"),&index)?;let memory=credentials.remove(credential_ref).is_some();Ok(json!({"removed":memory||system}))
        }
        "data_export_preview"=>{
            allowed(p,&["categories","frontendDiagnostics"])?;if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","导出预览需应用作用域"));}
            let(data,suggested_name)=export_snapshot(&state,p)?;let snapshot=serde_json::to_string_pretty(&data)?;if snapshot.len()>EXPORT_LIMIT{return Err(HostError::new("RESOURCE_LIMIT","导出预览超过1 MiB，请分别导出配置与诊断"));}
            let plan_id=id();let expires=(chrono::Utc::now()+chrono::Duration::minutes(5)).to_rfc3339();let mut plans=state.plans.lock().unwrap();let current=now();plans.retain(|_,plan|plan["kind"]!="dataExport"||plan["exporting"]==true||plan["expiresAt"].as_str().is_some_and(|expires|expires>=current.as_str()));if plans.values().filter(|plan|plan["kind"]=="dataExport").count()>=4{return Err(HostError::new("RESOURCE_LIMIT","最多保留4份导出预览，请取消旧预览"));}
            plans.insert(plan_id.clone(),json!({"kind":"dataExport","planId":plan_id,"expiresAt":expires,"snapshotJson":snapshot,"exporting":false}));Ok(json!({"planId":plan_id,"expiresAt":expires,"byteCount":snapshot.len().to_string(),"suggestedName":suggested_name,"data":data}))
        }
        "data_export_discard"=>{
            allowed(p,&["planId"])?;if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","取消预览需应用作用域"));}let plan_id=string(p,"planId")?;let mut plans=state.plans.lock().unwrap();if let Some(plan)=plans.get(plan_id){if plan["kind"]!="dataExport"{return Err(HostError::new("INVALID_ARGUMENT","计划不是导出预览"));}if plan["exporting"]==true{return Err(HostError::new("RESOURCE_BUSY","正在写入导出文件"));}}Ok(json!({"discarded":plans.remove(plan_id).is_some()}))
        }
        "data_export"=>{
            if p.get("planId").is_some(){
                allowed(p,&["planId","destinationSelectionToken","name"])?;if call.scope["kind"]!="app"{return Err(HostError::new("PERMISSION_DENIED","导出预览需应用作用域"));}let plan_id=string(p,"planId")?;
                let snapshot={let mut plans=state.plans.lock().unwrap();let plan=plans.get_mut(plan_id).ok_or_else(||HostError::new("STALE_VERSION","导出预览已过期，请重新预览"))?;if plan["kind"]!="dataExport"||plan["expiresAt"].as_str().unwrap_or("")<now().as_str(){return Err(HostError::new("STALE_VERSION","导出预览已过期，请重新预览"));}if plan["exporting"]==true{return Err(HostError::new("RESOURCE_BUSY","正在写入导出文件"));}plan["exporting"]=json!(true);string(plan,"snapshotJson")?.to_owned()};
                let result=write_export(&state,p,snapshot.as_bytes());let mut plans=state.plans.lock().unwrap();if result.is_ok(){plans.remove(plan_id);}else if let Some(plan)=plans.get_mut(plan_id){plan["exporting"]=json!(false);}result
            }else{allowed(p,&["categories","destinationSelectionToken","name","frontendDiagnostics"])?;let(data,_)=export_snapshot(&state,p)?;write_export(&state,p,&serde_json::to_vec_pretty(&data)?)}
        }
        "data_clear_prepare"=>{
            allowed(p,&["categories","projectId","itemIds"])?;let categories=p["categories"].as_array().ok_or_else(||HostError::new("INVALID_ARGUMENT","categories必须为数组"))?;let ids=p["itemIds"].as_array();let mut items=vec![];let mut blocked=vec![];
            for category in categories{
                if category=="agentHistory"{for mut item in crate::agent::history_items(&state,p["projectId"].as_str())?{if ids.is_some_and(|ids|!ids.contains(&item["id"])){continue;}if item["blocked"]==true{blocked.push(item["id"].as_str().unwrap_or("").to_owned());continue;}item["category"]=json!("agentHistory");items.push(item);}continue;}
                if category=="cache"{let bytes:usize=state.path_search_cache.lock().unwrap().values().map(|(paths,_)|paths.iter().map(|p|p.as_os_str().len()).sum::<usize>()).sum();if bytes>0{items.push(json!({"id":"memory-path-cache","category":"cache","bytes":bytes.to_string(),"memory":true}));}}
                let dir=match category.as_str(){Some("cache")=>state.data_dir().join("cache"),Some("recoveryDrafts")=>{if ids.is_none_or(Vec::is_empty){return Err(HostError::new("INVALID_ARGUMENT","请单独选择要删除的恢复稿"));}state.data_dir().join("recovery")},_=>return Err(HostError::new("INVALID_ARGUMENT","未知清理类别"))};
                if !dir.exists(){continue;}
                for entry in fs::read_dir(dir)?{let entry=entry?;let path=entry.path();if !path.is_file(){continue;}let item_id=path.file_stem().unwrap_or_default().to_string_lossy().into_owned();if ids.is_some_and(|ids|!ids.contains(&json!(item_id))){continue;}
                    if category=="recoveryDrafts"{let data:Value=serde_json::from_slice(&fs::read(&path)?)?;if p["projectId"].as_str().is_some_and(|id|data["projectId"]!=id){continue;}if state.documents.lock().unwrap().contains_key(data["documentId"].as_str().unwrap_or("")){blocked.push(item_id);continue;}}
                    items.push(json!({"id":item_id,"category":category,"bytes":entry.metadata()?.len().to_string(),"fingerprint":crate::files::disk_revision(&path)?["token"],"nativePath":crate::state::native_encode(&path)}));
                }
            }
            let plan_id=id();let plan=json!({"planId":plan_id,"digest":digest(serde_json::to_vec(&items)?),"expiresAt":(chrono::Utc::now()+chrono::Duration::minutes(5)).to_rfc3339(),"items":items,"blockedIds":blocked,"externalUntouched":["Pi OAuth","外部Agent历史"],"kind":"dataClear"});state.plans.lock().unwrap().insert(plan_id,plan.clone());let mut visible=plan;for item in visible["items"].as_array_mut().unwrap(){item.as_object_mut().unwrap().remove("nativePath");item.as_object_mut().unwrap().remove("fingerprint");}Ok(visible)
        }
        "data_clear_apply"=>{
            allowed(p,&["planId","digest"])?;let plan=state.plans.lock().unwrap().get(string(p,"planId")?).cloned().ok_or_else(||HostError::new("STALE_VERSION","清理计划已过期"))?;
            if plan["kind"]!="dataClear"||plan["digest"]!=p["digest"]||plan["expiresAt"].as_str().unwrap_or("")<now().as_str(){return Err(HostError::new("STALE_VERSION","清理计划已变化"));}
            let mut cleared=vec![];let mut failed=vec![];for item in plan["items"].as_array().unwrap(){let item_id=item["id"].as_str().unwrap();
                let result=(||->Result<(),HostError>{if item["category"]=="agentHistory"{return crate::agent::clear_history(&state,item_id,string(item,"fingerprint")?);}if item["memory"]==true{state.path_search_cache.lock().unwrap().clear();return Ok(());}let path=crate::state::native_decode(string(item,"nativePath")?)?;crate::state::ensure_inside(state.data_dir(),&path)?;if state.documents.lock().unwrap().contains_key(item_id){return Err(HostError::new("RESOURCE_BUSY","恢复稿正在使用"));}if crate::files::disk_revision(&path)?["token"]!=item["fingerprint"]{return Err(HostError::new("STALE_VERSION","清理条目已更新"));}fs::remove_file(&path)?;Ok(())})();match result{Ok(())=>cleared.push(item_id),Err(error)=>failed.push(json!({"id":item_id,"error":error}))};
            }state.plans.lock().unwrap().remove(string(p,"planId")?);Ok(json!({"clearedIds":cleared,"failed":failed,"externalUntouched":plan["externalUntouched"]}))
        }
        _=>Err(HostError::new("NOT_FOUND","未知设置方法")),
    }
}

#[cfg(test)]mod tests{
use super::*;
#[test]fn project_behavior_inherits_without_overriding_global_ui(){
    let settings=json!({"global":{"editor.tabSize":2,"editor.fontSize":15,"ui.density":"compact","git.path":"git","shortcuts":{}},"projects":{"a":{"editor.tabSize":4,"editor.fontSize":20,"ui.density":"spacious","git.path":"/other/git","shortcuts":{"file.save":"Meta+X"}}}});
    let values=effective(&settings,Some("a"));
    assert_eq!(values["editor.tabSize"],4);assert_eq!(values["editor.fontSize"],15);assert_eq!(values["ui.density"],"compact");assert_eq!(values["git.path"],"git");assert_eq!(values["shortcuts"],json!({}));
}
#[test]fn global_migration_preserves_active_fonts_and_project_behavior(){
    let mut settings=json!({"schemaVersion":1,"revision":3,"global":{"editor.fontSize":14},"projects":{"a":{"ui.density":"compact","editor.tabSize":4},"b":{"ui.density":"spacious","editor.tabSize":8}}});
    let appearance=json!({"global":{"layoutId":"horizon.layout.mist"},"projects":{"a":{"layoutId":"horizon.layout.iris","geometry:horizon.layout.iris:codeFontSize":17,"geometry:horizon.layout.iris:uiFontSize":15}}});
    migrate_global_settings(&mut settings,Some("a"),&appearance);
    assert_eq!(settings["schemaVersion"],2);assert_eq!(settings["global"]["editor.fontSize"],17);assert_eq!(settings["global"]["ui.fontSize"],15);
    assert_eq!(settings["global"]["ui.density"],"compact");assert!(settings["projects"]["b"].get("ui.density").is_none());
    assert_eq!(settings["projects"]["a"]["editor.tabSize"],4);assert_eq!(settings["projects"]["b"]["editor.tabSize"],8);
}
#[test]fn reject_unknown_or_invalid(){assert!(validate("editor.fontSize",&json!(100)).is_err());assert!(validate("unknown",&json!(1)).is_err());}
}
