use crate::{protocol::{allowed, revision, string}, state::{atomic_json, atomic_write, digest, id, now, Document}, Call, HostError, HostState};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use std::{fs,io::{Read,Seek,SeekFrom,Write},path::{Path,PathBuf},sync::Arc};

const EDIT_LIMIT:u64=50*1024*1024;
const CHECKPOINT_LIMIT:usize=16*1024*1024;

pub fn disk_revision(path:&Path)->Result<Value,HostError>{
    let metadata=fs::symlink_metadata(path)?;
    let mut hasher=Sha256::new();
    if metadata.is_file(){let mut file=fs::File::open(path)?;let mut buf=[0u8;65536];loop{let n=file.read(&mut buf)?;if n==0{break;}hasher.update(&buf[..n]);}}
    else if metadata.is_symlink(){hasher.update(crate::state::native_encode(&fs::read_link(path)?));}
    let content_hash=format!("{:x}",hasher.finalize());
    let modified=metadata.modified().unwrap_or(std::time::UNIX_EPOCH);
    #[cfg(unix)] let identity={use std::os::unix::fs::MetadataExt;format!("{}:{}:{}:{}",metadata.dev(),metadata.ino(),metadata.mtime(),metadata.mtime_nsec())};
    #[cfg(not(unix))] let identity=format!("{:?}",modified);
    Ok(json!({"token":digest(format!("{identity}:{}:{content_hash}",metadata.len())),"contentHash":content_hash,"byteLength":metadata.len().to_string(),"modifiedAt":chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339()}))
}
fn check_revision(path:&Path,expected:&Value)->Result<Value,HostError>{
    let actual=disk_revision(path).map_err(|e|if e.code=="NOT_FOUND"{HostError::new("FILE_CHANGED","文件已被移除")}else{e})?;
    if actual["token"]!=expected["token"] || expected["token"].as_str().is_none(){return Err(HostError::new("FILE_CHANGED","磁盘内容已变化，请比较或重新加载").details(json!({"currentToken":actual["token"]})));}Ok(actual)
}
pub fn validate_name(name:&str)->Result<(),HostError>{
    if name.is_empty() || name=="." || name==".." || name.contains('/') || name.contains('\0') || name.chars().any(|c|c.is_control()) {return Err(HostError::new("INVALID_ARGUMENT","文件名不能为空或包含路径分隔符"));}Ok(())
}
fn rename_exclusive(from:&Path,to:&Path)->Result<(),HostError>{
    #[cfg(target_os="macos")]{use std::os::unix::ffi::OsStrExt;let from=std::ffi::CString::new(from.as_os_str().as_bytes()).map_err(|_|HostError::new("INVALID_ARGUMENT","路径包含NUL"))?;let to=std::ffi::CString::new(to.as_os_str().as_bytes()).map_err(|_|HostError::new("INVALID_ARGUMENT","路径包含NUL"))?;let result=unsafe{libc::renamex_np(from.as_ptr(),to.as_ptr(),libc::RENAME_EXCL)};if result!=0{return Err(std::io::Error::last_os_error().into());}Ok(())}
    #[cfg(not(target_os="macos"))]{if to.exists(){return Err(HostError::new("FILE_LOCKED","目标文件已存在"));}fs::rename(from,to)?;Ok(())}
}
pub fn decode(bytes:&[u8])->Result<(String,&'static str),HostError>{
    if bytes.starts_with(&[0xff,0xfe]) || bytes.starts_with(&[0xfe,0xff]){
        if bytes.len()%2!=0{return Err(HostError::new("ENCODING_UNSUPPORTED","UTF-16 字节不完整"));}
        let little=bytes[0]==0xff;
        let units:Vec<u16>=bytes[2..].chunks_exact(2).map(|c|if little{u16::from_le_bytes([c[0],c[1]])}else{u16::from_be_bytes([c[0],c[1]])}).collect();
        let text=String::from_utf16(&units).map_err(|_|HostError::new("ENCODING_UNSUPPORTED","UTF-16 字符无效"))?;
        return Ok((text,if little{"utf16le"}else{"utf16be"}));
    }
    let (content,encoding)=if bytes.starts_with(&[0xef,0xbb,0xbf]){(&bytes[3..],"utf8bom")}else{(bytes,"utf8")};
    let text=std::str::from_utf8(content).map_err(|_|HostError::new("ENCODING_UNSUPPORTED","文件不是支持的 Unicode 编码"))?;
    if text.contains('\0'){return Err(HostError::new("ENCODING_UNSUPPORTED","binary"));}
    Ok((text.to_owned(),encoding))
}
fn eol(text:&str)->&'static str{
    let crlf=text.matches("\r\n").count();let lf=text.matches('\n').count();
    if text.replace("\r\n","").contains('\r') || (crlf>0&&crlf<lf){"mixed"}else if crlf>0{"crlf"}else{"lf"}
}
pub fn encode(text:&str,encoding:&str,line_ending:&str)->Result<Vec<u8>,HostError>{
    if !["lf","crlf"].contains(&line_ending){return Err(HostError::new("INVALID_ARGUMENT","换行格式必须为 lf 或 crlf"));}
    let normalized=text.replace("\r\n","\n").replace('\r',"\n");
    let normalized=if line_ending=="crlf"{normalized.replace('\n',"\r\n")}else{normalized};
    match encoding{
        "utf8"=>Ok(normalized.into_bytes()),
        "utf8bom"=>{let mut out=vec![0xef,0xbb,0xbf];out.extend(normalized.as_bytes());Ok(out)},
        "utf16le"|"utf16be"=>{let mut out=if encoding=="utf16le"{vec![0xff,0xfe]}else{vec![0xfe,0xff]};for c in normalized.encode_utf16(){out.extend(if encoding=="utf16le"{c.to_le_bytes()}else{c.to_be_bytes()});}Ok(out)},
        _=>Err(HostError::new("ENCODING_UNSUPPORTED","不支持此编码")),
    }
}
fn entry(state:&HostState,project:&str,path:&Path)->Result<Value,HostError>{
    let meta=fs::symlink_metadata(path)?;let file=state.file_ref(project,path)?;
    let name=path.file_name().unwrap_or_default();
    Ok(json!({"entryId":file["fileId"],"file":file,"name":name.to_string_lossy(),"kind":if meta.is_symlink(){"symlink"}else if meta.is_dir(){"directory"}else if meta.is_file(){"file"}else{"other"},"nativeNameLossless":name.to_str().is_some(),"ignored":false}))
}
fn document(state:&HostState,call:&Call)->Result<(String,Value,PathBuf),HostError>{
    let document_id=string(&call.params,"documentId")?.to_owned();let meta=state.document_meta(&document_id)?;
    if meta["file"]["projectId"]!=call.project_id()?{return Err(HostError::new("PERMISSION_DENIED","文档不属于当前项目"));}
    let path=state.resolve_file(call.project_id()?,string(&meta["file"],"fileId")?)?;
    Ok((document_id,meta,path))
}
fn checkpoint_path(state:&HostState,checkpoint_id:&str)->Result<PathBuf,HostError>{
    if uuid::Uuid::parse_str(checkpoint_id).is_err(){return Err(HostError::new("INVALID_ARGUMENT","无效恢复稿标识"));}
    Ok(state.data_dir().join("recovery").join(format!("{checkpoint_id}.json")))
}
fn save_backup(state:&HostState,document_id:&str,path:&Path,revision:&Value)->Result<(),HostError>{
    let directory=state.data_dir().join("save-backups");fs::create_dir_all(&directory)?;let bytes=fs::read(path)?;
    if digest(&bytes)!=revision["contentHash"]{return Err(HostError::new("FILE_CHANGED","准备保存时磁盘再次变化"));}
    let backup_id=id();atomic_write(&directory.join(format!("{backup_id}.bin")),&bytes,None)?;
    atomic_json(&directory.join(format!("{backup_id}.json")),&json!({"versionId":backup_id,"documentId":document_id,"diskRevision":revision,"updatedAt":now(),"byteCount":bytes.len().to_string()}))?;
    let mut versions=Vec::new();for entry in fs::read_dir(&directory)?{let entry=entry?;let path=entry.path();if path.extension().is_some_and(|s|s=="json"){let meta:Value=serde_json::from_slice(&fs::read(&path)?)?;versions.push(meta);}}
    versions.sort_by(|a,b|b["updatedAt"].as_str().cmp(&a["updatedAt"].as_str()));let mut total=0u64;let mut per_document=std::collections::HashMap::<String,usize>::new();
    for version in versions{let count=per_document.entry(version["documentId"].as_str().unwrap_or("").into()).or_default();*count+=1;let size=version["byteCount"].as_str().and_then(|s|s.parse::<u64>().ok()).unwrap_or(0);total+=size;if *count>2||total>64*1024*1024{if let Some(id)=version["versionId"].as_str(){let _=fs::remove_file(directory.join(format!("{id}.bin")));let _=fs::remove_file(directory.join(format!("{id}.json")));}}}
    Ok(())
}
fn conditional_replace(state:&HostState,document_id:&str,path:&Path,bytes:&[u8],expected:Option<&Value>)->Result<(),HostError>{
    let parent=path.parent().ok_or_else(||HostError::new("INVALID_ARGUMENT","无效保存目标"))?.canonicalize()?;
    let target=parent.join(path.file_name().ok_or_else(||HostError::new("INVALID_ARGUMENT","无效文件名"))?);
    let mut temporary=tempfile::NamedTempFile::new_in(&parent)?;temporary.write_all(bytes)?;
    if let Some(expected)=expected{
        let metadata=fs::symlink_metadata(&target)?;if metadata.is_symlink(){return Err(HostError::new("PERMISSION_DENIED","保存不能替换符号链接"));}if metadata.permissions().readonly(){return Err(HostError::new("FILE_LOCKED","文件已设为只读"));}
        temporary.as_file().set_permissions(metadata.permissions())?;
        #[cfg(target_os="macos")]{use std::os::fd::AsRawFd;let source=fs::File::open(&target)?;let status=unsafe{libc::fcopyfile(source.as_raw_fd(),temporary.as_file().as_raw_fd(),std::ptr::null_mut(),libc::COPYFILE_ACL|libc::COPYFILE_XATTR)};if status!=0{return Err(std::io::Error::last_os_error().into());}}
        temporary.as_file().sync_all()?;let current=check_revision(&target,expected)?;save_backup(state,document_id,&target,&current)?;check_revision(&target,expected)?;
        temporary.persist(&target).map_err(|e|HostError::from(e.error))?;
    }else{temporary.as_file().sync_all()?;temporary.persist_noclobber(&target).map_err(|e|HostError::from(e.error))?;}
    fs::File::open(&parent)?.sync_all()?;Ok(())
}
pub fn open_document(state:&HostState,project:&str,file_id:&str,mode:&str)->Result<Value,HostError>{
    if !["auto","simplified"].contains(&mode){return Err(HostError::new("INVALID_ARGUMENT","未知打开模式"));}
    let path=state.resolve_file(project,file_id)?;let metadata=fs::metadata(&path)?;
    if !metadata.is_file(){return Err(HostError::new("INVALID_ARGUMENT","请选择普通文件"));}
    let file=state.authorized_file_ref(project,&path)?;let rev=disk_revision(&path)?;
    if metadata.len()>=EDIT_LIMIT{
        let mut sample=vec![0;8192];let n=fs::File::open(&path)?.read(&mut sample)?;sample.truncate(n);
        if !sample.starts_with(&[0xff,0xfe])&&!sample.starts_with(&[0xfe,0xff])&&sample.contains(&0){return Ok(json!({"mode":"unsupported","file":file,"reason":"binary"}));}
        let cursor=state.register_cursor(json!({"kind":"chunk","projectId":project,"fileId":file_id,"offset":0,"revision":rev}));
        return Ok(json!({"mode":"chunked","file":file,"revision":rev,"cursor":cursor}));
    }
    let bytes=fs::read(&path)?;
    let (text,encoding)=match decode(&bytes){Ok(v)=>v,Err(e)=>return Ok(json!({"mode":"unsupported","file":file,"reason":if e.message=="binary"{"binary"}else{"encoding"}}))};
    let line_ending=eol(&text);
    let long_line=text.lines().any(|line|line.encode_utf16().count()>=100_000);
    let simplified=mode=="simplified" || bytes.len()>=10*1024*1024 || long_line;
    let mut documents=state.documents.lock().unwrap();
    let old=documents.iter().find(|(_,d)|d.meta["file"]["fileId"]==file_id).map(|(id,d)|(id.clone(),d.meta.clone()));
    if let Some((_,meta))=&old {if meta["state"]!="clean"{return Err(HostError::new("RESOURCE_BUSY","文档存在未保存编辑，请使用已打开的标签"));}}
    let document_id=old.as_ref().map(|(id,_)|id.clone()).unwrap_or_else(id);
    let meta=json!({"documentId":document_id,"file":file,"editorRevision":old.map_or(0,|(_,m)|m["editorRevision"].as_u64().unwrap_or(0)),"baseDiskRevision":rev,"encoding":encoding,"eol":line_ending,"state":"clean","readOnly":metadata.permissions().readonly()||line_ending=="mixed"||simplified||encoding.starts_with("utf16")});
    documents.insert(document_id,Document{meta:meta.clone()});
    Ok(json!({"mode":"editor","meta":meta,"text":text,"simplified":simplified}))
}

pub fn dispatch(state:Arc<HostState>,call:Call)->Result<Value,HostError>{
    let params=&call.params;
    if ["directory_list","document_open"].contains(&call.method.as_str()){crate::watch::ensure(&state,call.project_id()?)?;}
    match call.method.as_str(){
        "directory_list"=>{
            allowed(params,&["directoryId","cursor","limit"])?;let project=call.project_id()?;
            let directory=match params["directoryId"].as_str(){Some(file)=>state.resolve_file(project,file)?,None=>state.project_root(project)?};
            let mut paths:Vec<PathBuf>=fs::read_dir(&directory)?.map(|e|e.map(|e|e.path())).collect::<Result<_,_>>()?;
            paths.sort_by(|a,b|{let ad=a.is_dir();let bd=b.is_dir();bd.cmp(&ad).then_with(||a.file_name().cmp(&b.file_name()))});
            let fingerprint=digest(paths.iter().map(|p|crate::state::native_encode(p)).collect::<Vec<_>>().join("\0"));
            let revision=u64::from_str_radix(&fingerprint[..12],16).unwrap();
            let offset=if let Some(cursor)=params["cursor"].as_str(){let cursors=state.cursors.lock().unwrap();let page=cursors.get(cursor).ok_or_else(||HostError::new("STALE_CURSOR","目录分页已失效"))?;if page["fingerprint"]!=fingerprint||page["projectId"]!=project||page["directory"]!=crate::state::native_encode(&directory){return Err(HostError::new("STALE_CURSOR","目录已变化"));}page["offset"].as_u64().unwrap_or(0) as usize}else{0};
            let limit=params["limit"].as_u64().unwrap_or(200).clamp(1,1000)as usize;
            let entries=paths.iter().skip(offset).take(limit).map(|p|entry(&state,project,p)).collect::<Result<Vec<_>,_>>()?;
            let next=if offset+entries.len()<paths.len(){Some(state.register_cursor(json!({"kind":"directory","fingerprint":fingerprint,"projectId":project,"directory":crate::state::native_encode(&directory),"offset":offset+entries.len()})))}else{None};
            state.persist()?;Ok(json!({"directoryRevision":revision,"entries":entries,"nextCursor":next,"truncated":false}))
        }
        "file_stat"=>{allowed(params,&["fileId"])?;let path=state.resolve_file(call.project_id()?,string(params,"fileId")?)?;let rev=disk_revision(&path)?;Ok(json!({"revision":rev,"kind":if path.is_dir(){"directory"}else{"file"},"confirmationDigest":digest(format!("{}:{}",params["fileId"],rev["token"]))}))}
        "file_create"=>{
            allowed(params,&["parentEntryId","name","kind"])?;let project=call.project_id()?;let name=string(params,"name")?;validate_name(name)?;
            let parent=match params["parentEntryId"].as_str(){Some(file)=>state.resolve_file(project,file)?,None=>state.project_root(project)?};
            let path=parent.join(name);crate::state::ensure_inside(&state.project_root(project)?,&path)?;
            match string(params,"kind")?{"file"=>{fs::OpenOptions::new().create_new(true).write(true).open(&path)?.sync_all()?;},"directory"=>fs::create_dir(&path)?,_=>return Err(HostError::new("INVALID_ARGUMENT","未知文件类型"))};
            let result=entry(&state,project,&path)?;state.persist()?;state.notify("horizon.files.v1",project,1,"invalidate");Ok(result)
        }
        "file_rename"=>{
            allowed(params,&["entryId","newName","expectedRevision"])?;let _guard=state.file_lock.lock().unwrap();let project=call.project_id()?;let file_id=string(params,"entryId")?;let path=state.resolve_file(project,file_id)?;
            let name=string(params,"newName")?;validate_name(name)?;check_revision(&path,&params["expectedRevision"])?;
            if state.dirty_documents(Some(project)).iter().any(|m|m["fileId"]==file_id){return Err(HostError::new("RESOURCE_BUSY","请先处理该文件的未保存编辑"));}
            let target=path.parent().ok_or_else(||HostError::new("PERMISSION_DENIED","不能重命名项目根目录"))?.join(name);
            if target==path{return entry(&state,project,&path);}
            let mut registry=state.registry.lock().unwrap();
            let same_file={#[cfg(unix)]{use std::os::unix::fs::MetadataExt;match(fs::symlink_metadata(&path),fs::symlink_metadata(&target)){(Ok(a),Ok(b))=>a.dev()==b.dev()&&a.ino()==b.ino(),_=>false}}#[cfg(not(unix))]{false}};
            if same_file{let temporary=path.with_file_name(format!(".horizon-rename-{}",id()));rename_exclusive(&path,&temporary)?;if let Err(error)=rename_exclusive(&temporary,&target){let _=rename_exclusive(&temporary,&path);return Err(error);}}
            else{rename_exclusive(&path,&target)?;}
            {let mut index=state.path_index.lock().unwrap();for(file_id,record)in registry.paths.iter_mut(){if record.0==project{let original=crate::state::native_decode(&record.1)?;if let Ok(relative)=original.strip_prefix(&path){index.remove(record);let relocated=if relative.as_os_str().is_empty(){target.clone()}else{target.join(relative)};record.1=crate::state::native_encode(&relocated);index.insert(record.clone(),file_id.clone());}}}}
            drop(registry);
            let result=entry(&state,project,&target)?;
            for d in state.documents.lock().unwrap().values_mut(){if d.meta["file"]["projectId"]==project{if let Ok(updated)=state.resolve_file(project,d.meta["file"]["fileId"].as_str().unwrap_or("")){if updated.starts_with(&target){d.meta["file"]=state.file_ref(project,&updated)?;}}}}
            state.persist()?;state.notify("horizon.files.v1",project,1,"invalidate");Ok(result)
        }
        "file_trash"=>{
            allowed(params,&["entryId","expectedRevision","confirmationDigest"])?;let _guard=state.file_lock.lock().unwrap();let project=call.project_id()?;let file_id=string(params,"entryId")?;let path=state.resolve_file(project,file_id)?;
            let rev=check_revision(&path,&params["expectedRevision"])?;
            if params["confirmationDigest"]!=digest(format!("{}:{}",json!(file_id),rev["token"])){return Err(HostError::new("STALE_VERSION","删除确认已失效"));}
            if path==state.project_root(project)?||state.dirty_documents(Some(project)).iter().any(|m|state.resolve_file(project,m["fileId"].as_str().unwrap_or("")).is_ok_and(|p|p.starts_with(&path))){return Err(HostError::new("RESOURCE_BUSY","不能删除项目根目录或未保存文档"));}
            let mut trash=trash::TrashContext::new();
            #[cfg(target_os="macos")]{use trash::macos::{DeleteMethod,TrashContextExtMacos};trash.set_delete_method(DeleteMethod::NsFileManager);}
            // Move through the native file manager; Finder AppleEvents can stall
            // for minutes while their automation request waits for a response.
            trash.delete(&path).map_err(|e|HostError::new("IO_ERROR",format!("移至废纸篓失败：{e}")))?;
            state.notify("horizon.files.v1",project,1,"invalidate");Ok(json!({"trashed":true}))
        }
        "document_open"=>{allowed(params,&["fileId","mode"])?;open_document(&state,call.project_id()?,string(params,"fileId")?,string(params,"mode")?)}
        "document_mark_dirty"=>{
            allowed(params,&["documentId","editorRevision","dirty"])?;let(doc_id,meta,_)=document(&state,&call)?;let rev=revision(params,"editorRevision")?;
            if rev<meta["editorRevision"].as_u64().unwrap(){return Err(HostError::new("STALE_VERSION","编辑版本已过期"));}
            let dirty=params["dirty"].as_bool().ok_or_else(||HostError::new("INVALID_ARGUMENT","dirty 必须为布尔值"))?;
            if !dirty{let checkpoint=checkpoint_path(&state,&doc_id)?;if checkpoint.exists(){let saved:Value=serde_json::from_slice(&fs::read(&checkpoint)?)?;if saved["editorRevision"].as_u64().unwrap_or(u64::MAX)<=rev{fs::remove_file(checkpoint)?;}}}
            let mut docs=state.documents.lock().unwrap();let d=docs.get_mut(&doc_id).unwrap();d.meta["editorRevision"]=json!(rev);d.meta["state"]=json!(if dirty{"dirty"}else{"clean"});Ok(json!({"revision":rev}))
        }
        "document_checkpoint"=>{
            allowed(params,&["documentId","editorRevision","baseDiskRevision","text","selection"])?;let(doc_id,meta,_)=document(&state,&call)?;let rev=revision(params,"editorRevision")?;let text=string(params,"text")?;
            if text.len()>CHECKPOINT_LIMIT{return Err(HostError::new("RESOURCE_LIMIT","恢复稿超过16 MiB"));}
            let used=fs::read_dir(state.data_dir().join("recovery"))?.try_fold(0u64,|sum,item|->Result<u64,HostError>{let entry=item?;let bytes=entry.metadata()?.len();Ok(sum+bytes)})?;
            let previous=fs::metadata(checkpoint_path(&state,&doc_id)?).map_or(0,|m|m.len());
            if used.saturating_sub(previous)+text.len()as u64>256*1024*1024{return Err(HostError::new("RESOURCE_LIMIT","恢复稿总空间达到256 MiB，请保存或明确清理旧稿"));}
            if rev<meta["editorRevision"].as_u64().unwrap(){return Err(HostError::new("STALE_VERSION","编辑版本已过期"));}
            let checkpoint_id=doc_id.clone();let value=json!({"checkpointId":checkpoint_id,"documentId":doc_id,"projectId":call.project_id()?,"fileId":meta["file"]["fileId"],"file":meta["file"],"editorRevision":rev,"baseDiskRevision":params["baseDiskRevision"],"text":text,"selection":params["selection"],"encoding":meta["encoding"],"eol":meta["eol"],"updatedAt":now(),"byteCount":text.len().to_string()});
            atomic_json(&checkpoint_path(&state,&checkpoint_id)?,&value)?;
            let mut docs=state.documents.lock().unwrap();if let Some(d)=docs.get_mut(&doc_id){if rev>=d.meta["editorRevision"].as_u64().unwrap(){d.meta["editorRevision"]=json!(rev);d.meta["state"]=json!("dirty");}}
            Ok(json!({"checkpointId":checkpoint_id,"editorRevision":rev}))
        }
        "document_save"|"document_save_as"=>{
            let save_as=call.method=="document_save_as";
            allowed(params,if save_as{&["documentId","editorRevision","text","encoding","eol","destinationSelectionToken","name","expectedDestinationRevision"]}else{&["documentId","editorRevision","expectedDiskRevision","text","encoding","eol"]})?;
            let _guard=state.file_lock.lock().unwrap();let(doc_id,meta,original)=document(&state,&call)?;let rev=revision(params,"editorRevision")?;
            if !save_as&&meta["readOnly"]==true{return Err(HostError::new("PERMISSION_DENIED","此文档只读，请规范化另存"));}
            let text=string(params,"text")?;if text.len()>CHECKPOINT_LIMIT{return Err(HostError::new("RESOURCE_LIMIT","保存内容超过16 MiB"));}
            let bytes=encode(text,string(params,"encoding")?,string(params,"eol")?)?;
            let target=if save_as{let name=string(params,"name")?;validate_name(name)?;let dir=state.resolve_selection(string(params,"destinationSelectionToken")?)?;let p=if dir.is_dir(){dir.join(name)}else{dir};if p.exists(){check_revision(&p,&params["expectedDestinationRevision"])?;}else if !params["expectedDestinationRevision"].is_null(){return Err(HostError::new("FILE_CHANGED","另存目标已变化"));}p}else{check_revision(&original,&params["expectedDiskRevision"])?;original.clone()};
            if fs::symlink_metadata(&target).is_ok_and(|m|m.is_symlink()){return Err(HostError::new("PERMISSION_DENIED","保存不能替换符号链接"));}
            let expected=if save_as{if params["expectedDestinationRevision"].is_null(){None}else{Some(&params["expectedDestinationRevision"])}}else{Some(&params["expectedDiskRevision"])};
            conditional_replace(&state,&doc_id,&target,&bytes,expected)?;let disk=disk_revision(&target)?;
            let file=state.authorized_file_ref(call.project_id()?,&target)?;
            if !save_as{let mut docs=state.documents.lock().unwrap();if let Some(d)=docs.get_mut(&doc_id){if d.meta["editorRevision"].as_u64().unwrap()<=rev{d.meta["editorRevision"]=json!(rev);d.meta["state"]=json!("clean");}d.meta["baseDiskRevision"]=disk.clone();d.meta["encoding"]=params["encoding"].clone();d.meta["eol"]=params["eol"].clone();}}
            let checkpoint=checkpoint_path(&state,&doc_id)?;if !save_as&&checkpoint.exists(){let saved:Value=serde_json::from_slice(&fs::read(&checkpoint)?)?;if saved["editorRevision"].as_u64().unwrap_or(u64::MAX)<=rev{fs::remove_file(checkpoint)?;}}
            state.persist()?;if !save_as{state.notify_project("horizon.document.v1",&doc_id,rev,"upsert",Some(call.project_id()?));}state.notify("horizon.files.v1",file["fileId"].as_str().unwrap(),rev,"invalidate");
            let result=json!({"savedEditorRevision":rev,"diskRevision":disk,"recoveryCheckpointId":null});if save_as{Ok(json!({"file":file,"result":result}))}else{Ok(result)}
        }
        "document_reload"=>{
            allowed(params,&["documentId","expectedEditorRevision","expectedDiskRevision","discardLocal"])?;let(doc_id,meta,path)=document(&state,&call)?;
            if meta["editorRevision"]!=params["expectedEditorRevision"]{return Err(HostError::new("STALE_VERSION","文档已继续编辑"));}
            if meta["state"]!="clean"&&params["discardLocal"]!=true{return Err(HostError::new("RESOURCE_BUSY","重载需要明确放弃本地编辑"));}
            check_revision(&path,&params["expectedDiskRevision"])?;let original=state.documents.lock().unwrap().remove(&doc_id);
            let mut result=match open_document(&state,call.project_id()?,string(&meta["file"],"fileId")?,"auto"){Ok(result)=>result,Err(error)=>{if let Some(original)=original{state.documents.lock().unwrap().insert(doc_id,original);}return Err(error);}};
            let checkpoint=checkpoint_path(&state,&doc_id)?;if checkpoint.exists(){fs::remove_file(checkpoint)?;}
            if result["mode"]=="editor"{let new_id=result["meta"]["documentId"].as_str().unwrap().to_owned();let mut docs=state.documents.lock().unwrap();let mut d=docs.remove(&new_id).unwrap();d.meta["documentId"]=json!(doc_id);d.meta["editorRevision"]=params["expectedEditorRevision"].clone();result["meta"]=d.meta.clone();docs.insert(doc_id,d);}Ok(result)
        }
        "document_close"=>{
            allowed(params,&["documentId","expectedEditorRevision","decision"])?;let(doc_id,meta,_)=document(&state,&call)?;
            if meta["editorRevision"]!=params["expectedEditorRevision"]{return Err(HostError::new("STALE_VERSION","文档已继续编辑"));}
            let decision=string(params,"decision")?;if decision!="discard"&&(decision!="saved"||meta["state"]!="clean"){return Err(HostError::new("RESOURCE_BUSY","文档尚未保存"));}
            state.documents.lock().unwrap().remove(&doc_id);if decision=="discard"{let path=checkpoint_path(&state,&doc_id)?;if path.exists(){fs::remove_file(path)?;}}Ok(json!({"closed":true}))
        }
        "file_read_chunk"=>read_chunk(&state,&call),
        "document_disk_read"=>{allowed(params,&["documentId"])?;let(_,_,path)=document(&state,&call)?;if fs::metadata(&path)?.len()>CHECKPOINT_LIMIT as u64{return Err(HostError::new("RESOURCE_LIMIT","磁盘内容超过可比较大小"));}let(text,encoding)=decode(&fs::read(&path)?)?;Ok(json!({"text":text,"revision":disk_revision(&path)?,"encoding":encoding,"eol":eol(&text)}))}
        "document_versions"=>{allowed(params,&["documentId"])?;let(document_id,_,_)=document(&state,&call)?;let directory=state.data_dir().join("save-backups");let mut items=Vec::new();if directory.exists(){for entry in fs::read_dir(directory)?{let path=entry?.path();if path.extension().is_some_and(|s|s=="json"){let meta:Value=serde_json::from_slice(&fs::read(path)?)?;if meta["documentId"]==document_id{items.push(meta);}}}}Ok(json!({"items":items}))}
        "document_version_read"=>{allowed(params,&["documentId","versionId"])?;let(document_id,_,_)=document(&state,&call)?;let version=string(params,"versionId")?;if uuid::Uuid::parse_str(version).is_err(){return Err(HostError::new("INVALID_ARGUMENT","无效保存版本"));}let directory=state.data_dir().join("save-backups");let meta:Value=serde_json::from_slice(&fs::read(directory.join(format!("{version}.json")))?)?;if meta["documentId"]!=document_id{return Err(HostError::new("PERMISSION_DENIED","保存版本不属于此文档"));}let(text,encoding)=decode(&fs::read(directory.join(format!("{version}.bin")))?)?;Ok(json!({"text":text,"encoding":encoding,"eol":eol(&text),"diskRevision":meta["diskRevision"]}))}
        "document_proposal_get"=>{allowed(params,&["proposalId"])?;let proposal=state.plans.lock().unwrap().get(string(params,"proposalId")?).cloned().ok_or_else(||HostError::new("NOT_FOUND","修改提案已过期"))?;let meta=state.document_meta(string(&proposal,"documentId")?)?;if meta["file"]["projectId"]!=call.project_id()?{return Err(HostError::new("PERMISSION_DENIED","提案属于其他项目"));}Ok(proposal)}
        "document_proposal_result"=>{allowed(params,&["proposalId","expectedEditorRevision","editorRevision","applied"])?;let mut plans=state.plans.lock().unwrap();let proposal=plans.get_mut(string(params,"proposalId")?).ok_or_else(||HostError::new("NOT_FOUND","修改提案已过期"))?;if proposal["expectedEditorRevision"]!=params["expectedEditorRevision"]{return Err(HostError::new("STALE_VERSION","提案编辑基线不同"));}let meta=state.document_meta(string(proposal,"documentId")?)?;if meta["file"]["projectId"]!=call.project_id()?{return Err(HostError::new("PERMISSION_DENIED","提案属于其他项目"));}let rev=revision(params,"editorRevision")?;if params["applied"]==true&&rev<=revision(params,"expectedEditorRevision")?{return Err(HostError::new("INVALID_ARGUMENT","应用后编辑版本必须递增"));}proposal["state"]=json!(if params["applied"]==true{"applied"}else{"rejected"});proposal["editorRevision"]=json!(rev);Ok(json!({"proposalId":params["proposalId"],"state":proposal["state"],"editorRevision":rev}))}
        "recovery_list"=>{
            allowed(params,&["projectId"])?;let mut items=vec![];
            for e in fs::read_dir(state.data_dir().join("recovery"))?{let path=e?.path();if path.extension().and_then(|s|s.to_str())!=Some("json"){continue;}let data:Value=serde_json::from_slice(&fs::read(path)?)?;if params["projectId"].as_str().is_some_and(|p|data["projectId"]!=p){continue;}items.push(json!({"checkpointId":data["checkpointId"],"documentId":data["documentId"],"projectId":data["projectId"],"file":data["file"],"editorRevision":data["editorRevision"],"updatedAt":data["updatedAt"],"byteCount":data["byteCount"]}));}Ok(json!({"items":items}))
        }
        "recovery_read"=>{allowed(params,&["checkpointId"])?;Ok(serde_json::from_slice(&fs::read(checkpoint_path(&state,string(params,"checkpointId")?)?)?)?)}
        "recovery_resolve"=>{allowed(params,&["checkpointId","replacementDocumentId"])?;let old_id=string(params,"checkpointId")?;let new_id=string(params,"replacementDocumentId")?;if old_id==new_id{return Ok(json!({"resolved":true}));}let old_path=checkpoint_path(&state,old_id)?;let old:Value=serde_json::from_slice(&fs::read(&old_path)?)?;let new:Value=serde_json::from_slice(&fs::read(checkpoint_path(&state,new_id)?)?)?;let meta=state.document_meta(new_id)?;if old["projectId"]!=new["projectId"]||old["fileId"]!=new["fileId"]||old["text"]!=new["text"]||old["baseDiskRevision"]!=new["baseDiskRevision"]||new["editorRevision"]!=meta["editorRevision"]{return Err(HostError::new("STALE_VERSION","新恢复稿尚未完整接替旧稿"));}fs::remove_file(old_path)?;Ok(json!({"resolved":true}))}
        "recovery_export"=>{
            allowed(params,&["checkpointId","expectedEditorRevision","destinationSelectionToken","name"])?;let checkpoint=string(params,"checkpointId")?;let data:Value=serde_json::from_slice(&fs::read(checkpoint_path(&state,checkpoint)?)?)?;
            if data["editorRevision"]!=params["expectedEditorRevision"]{return Err(HostError::new("STALE_VERSION","恢复稿已变化"));}let name=string(params,"name")?;validate_name(name)?;let directory=state.resolve_selection(string(params,"destinationSelectionToken")?)?;let path=if directory.is_dir(){directory.join(name)}else{directory};
            let text=string(&data,"text")?;let mut file=fs::OpenOptions::new().write(true).create_new(true).open(path)?;file.write_all(text.as_bytes())?;file.sync_all()?;
            let receipt=json!({"exportReceiptId":id(),"checkpointId":checkpoint,"editorRevision":data["editorRevision"],"bytesWritten":text.len().to_string()});atomic_json(&state.data_dir().join("exports").join(format!("{}.json",receipt["exportReceiptId"].as_str().unwrap())),&receipt)?;Ok(receipt)
        }
        "file_reveal"|"file_open_external"=>{
            allowed(params,&["fileId"])?;let path=state.resolve_file(call.project_id()?,string(params,"fileId")?)?;
            let mut cmd=std::process::Command::new("/usr/bin/open");if call.method=="file_reveal"{cmd.arg("-R");}let status=cmd.arg(&path).status()?;if !status.success(){return Err(HostError::new("IO_ERROR","系统打开操作失败"));}Ok(json!({"opened":true}))
        }
        "image_read"=>{
            allowed(params,&["fileId"])?;let path=state.resolve_file(call.project_id()?,string(params,"fileId")?)?;if fs::metadata(&path)?.len()>16*1024*1024{return Err(HostError::new("RESOURCE_LIMIT","图片超过16 MiB"));}let bytes=fs::read(&path)?;
            let format=image::guess_format(&bytes).map_err(|_|HostError::new("INVALID_ARGUMENT","图片格式不支持"))?;let media=match format{image::ImageFormat::Png=>"image/png",image::ImageFormat::Jpeg=>"image/jpeg",image::ImageFormat::WebP=>"image/webp",_=>return Err(HostError::new("INVALID_ARGUMENT","仅支持静态PNG/JPEG/WebP"))};
            let cursor=std::io::Cursor::new(&bytes);let animated=match format{image::ImageFormat::Png=>image::codecs::png::PngDecoder::new(cursor).map_err(|e|HostError::new("IO_ERROR",e.to_string()))?.is_apng().map_err(|e|HostError::new("IO_ERROR",e.to_string()))?,image::ImageFormat::WebP=>image::codecs::webp::WebPDecoder::new(cursor).map_err(|e|HostError::new("IO_ERROR",e.to_string()))?.has_animation(),_=>false};if animated{return Err(HostError::new("INVALID_ARGUMENT","仅支持静态PNG/JPEG/WebP"));}
            let(width,height)=image::ImageReader::with_format(std::io::Cursor::new(&bytes),format).into_dimensions().map_err(|e|HostError::new("IO_ERROR",e.to_string()))?;if u64::from(width)*u64::from(height)>16_777_216||width>8192||height>8192{return Err(HostError::new("RESOURCE_LIMIT","图片预览上限为1600万像素、单边8192像素"));}
            Ok(json!({"dataUrl":format!("data:{media};base64,{}",STANDARD.encode(bytes)),"mediaType":media,"width":width,"height":height}))
        }
        _=>Err(HostError::new("NOT_FOUND","未知文件方法")),
    }
}

fn read_chunk(state:&HostState,call:&Call)->Result<Value,HostError>{
    let params=&call.params;allowed(params,&["fileId","cursor","limitBytes"])?;
    let cursor=state.cursors.lock().unwrap().get(string(params,"cursor")?).cloned().ok_or_else(||HostError::new("STALE_CURSOR","读取位置已失效"))?;
    if cursor["fileId"]!=params["fileId"]||cursor["projectId"]!=call.project_id()?{return Err(HostError::new("PERMISSION_DENIED","读取位置不属于此文件"));}
    let path=state.resolve_file(call.project_id()?,string(params,"fileId")?)?;let rev=check_revision(&path,&cursor["revision"])?;let start=cursor["offset"].as_u64().unwrap_or(0);
    let length=params["limitBytes"].as_u64().unwrap_or(256*1024).clamp(16,1024*1024)as usize;let mut file=fs::File::open(path)?;
    let mut bom=[0;3];let header_len=file.read(&mut bom)?;let utf16=header_len>=2&&(bom[..2]==[0xff,0xfe]||bom[..2]==[0xfe,0xff]);
    file.seek(SeekFrom::Start(start))?;let mut bytes=vec![0;length+4];let count=file.read(&mut bytes)?;bytes.truncate(count.min(length));
    let(text,consumed)=if utf16{
        if bytes.len()%2!=0{bytes.pop();}let prefix=if start==0{2}else{0};let little=bom[0]==0xff;
        if bytes.len()>prefix+2{let n=bytes.len();let last=if little{u16::from_le_bytes([bytes[n-2],bytes[n-1]])}else{u16::from_be_bytes([bytes[n-2],bytes[n-1]])};if(0xd800..=0xdbff).contains(&last){bytes.truncate(n-2);}}
        let units:Vec<_>=bytes[prefix..].chunks_exact(2).map(|c|if little{u16::from_le_bytes([c[0],c[1]])}else{u16::from_be_bytes([c[0],c[1]])}).collect();(String::from_utf16(&units).map_err(|_|HostError::new("ENCODING_UNSUPPORTED","UTF-16 解码失败"))?,bytes.len())
    }else{
        let prefix=if start==0&&bytes.starts_with(&[0xef,0xbb,0xbf]){3}else{0};
        match std::str::from_utf8(&bytes[prefix..]){Ok(text)=>(text.to_owned(),bytes.len()),Err(e)if e.error_len().is_none()=>{let n=prefix+e.valid_up_to();(String::from_utf8(bytes[prefix..n].to_vec()).unwrap(),n)},Err(_)=>return Err(HostError::new("ENCODING_UNSUPPORTED","文本不是有效UTF-8"))}
    };
    let end=start+consumed as u64;let next=if end<rev["byteLength"].as_str().unwrap().parse::<u64>().unwrap(){let mut updated=cursor;updated["offset"]=json!(end);Some(state.register_cursor(updated))}else{None};
    Ok(json!({"text":text,"byteStart":start.to_string(),"byteEnd":end.to_string(),"nextCursor":next,"revision":rev}))
}

#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn unicode_round_trips(){for encoding in ["utf8","utf8bom","utf16le","utf16be"]{let bytes=encode("你好 😀\nend\n",encoding,"crlf").unwrap();let(text,actual)=decode(&bytes).unwrap();assert_eq!(actual,encoding);assert_eq!(text,"你好 😀\r\nend\r\n");}}
    #[test]fn detect_mixed_lines(){assert_eq!(eol("a\r\nb\n"),"mixed");assert_eq!(eol("a\r\n"),"crlf");}
    #[test]fn revision_detects_same_size_change(){let d=tempfile::tempdir().unwrap();let p=d.path().join("a");fs::write(&p,"one").unwrap();let old=disk_revision(&p).unwrap();fs::write(&p,"two").unwrap();assert_eq!(check_revision(&p,&old).unwrap_err().code,"FILE_CHANGED");}
    #[test]fn invalid_names_cannot_escape(){for name in ["../a","a/b","", "..","a\0b"]{assert!(validate_name(name).is_err());}}
}
