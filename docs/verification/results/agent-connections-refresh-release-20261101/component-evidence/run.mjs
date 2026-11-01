import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Existing real-App component harness pattern; only unrelated surfaces and Tauri
// are controlled. No product source write, native GUI, provider, or model request.
const repository='/Users/chenpengxiang/Desktop/Horizon';
const directory=path.dirname(fileURLToPath(import.meta.url));
const resultPath=path.join(directory,'result.json');
const metadata=JSON.parse(await readFile(path.join(directory,'source-sha.json'),'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const source of metadata.sources)assert.equal(sha256(await readFile(path.join(repository,source.path))),source.sha256,'frozen current source '+source.path);
const report={kind:'real App main-settings close + AgentSettings + AgentPanel + agent store + bridge; controlled Tauri',startedAt:new Date().toISOString(),sources:metadata.sources,preparedChange:metadata.preparedChange,scenarios:[],passed:false};
const appearance=`import React from 'react';export const AppearanceProvider=({children})=>children;export const useAppearance=()=>({snapshot:{effective:{layoutId:'horizon.layout.mist'},effectiveGeometry:{}},layouts:[{id:'horizon.layout.mist',navigation:'rail'}],themes:[],extensions:[],refresh:async()=>{},setGeometry:async()=>{},composing:{current:false}});export const useSettings=()=>({settings:{effective:{},sources:{}}});export const appearanceTarget=()=>({kind:'global'});export const windowGeometry=()=>({width:1280,height:800,scale:1});`;
const plugins=`export const pluginRuntime={getSnapshot:()=>[],isEnabled:id=>id==='horizon.agent'};export const usePlugins=()=>[];export const usePluginEnabled=id=>id==='horizon.agent';export const activatePlugin=async()=>{};export const registerPluginLifecycle=()=>()=>{};export const useSlot=()=>[];export const refreshPlugins=async()=>{};export const initializePlugins=async()=>()=>{};export const usePluginError=()=>'';`;
const editor=`export const editorStore={setProject:()=>{}};export const FileExplorer=()=>null;export const SearchPanel=()=>null;export const EditorWorkbench=()=>null;export const QuickOpen=()=>null;export const getEditorDiagnostics=()=>({});`;
const settingsShell=`import React from 'react';export function SettingsPanel({agentSettings,onClose,initialSection}){if(initialSection!=='ai')throw Error('Expected real App main AI settings route');return <section data-main-settings>{agentSettings}<button onClick={onClose}>完成</button></section>;}`;
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import App from './apps/desktop/src/App.tsx';
import {agentView} from './apps/desktop/src/features/agent/store.ts';
import './apps/desktop/src/styles.css';
const projectId='owned-project';
const makeConnection=(id,label)=>({connectionId:id,adapterId:'pi',revision:1,authState:'configured',authOwner:'external',runtime:{source:'managed',version:'1.4.0'},provider:{id:'owned',api:'openai-completions',model:id,endpoint:'http://127.0.0.1:1/v1',label}});
const h=window.agentRefreshHarness={
 projectId,phase:'boot',calls:[],connections:[makeConnection('owned-base','Owned base')],preferenceRevision:1,epoch:0,
 project:{id:projectId,workspaceId:'owned-workspace',displayName:'Owned project',rootDisplayPath:'/owned/project',pinned:false,revision:1,state:'registered'},
 projectSession:{schemaVersion:1,revision:1,tabs:[],activeFileId:null,expandedEntryIds:[],searchDraft:'',commitDraft:'',layout:{panels:{},focusMode:false,focusRestore:null}},
 session:{sessionId:'owned-session',projectId,connectionId:'owned-base',profile:'chat',state:'running',instanceId:'owned-running-instance',instanceEpoch:1,resumeAvailable:true,reviewId:null},
 task:{taskId:'owned-task',requestId:'owned-running-request',state:'queued',cancelMode:'cooperative',result:new Promise(()=>{}),cancel:async()=>{throw Error('Unexpected cancellation');}},
 setup(){if(window.scenarioKind==='delete')h.connections.push(makeConnection('owned-extra','Owned extra'));agentView.patch(projectId,{initialized:true,connections:structuredClone(h.connections),connectionId:'owned-base',session:structuredClone(h.session),sessions:[structuredClone(h.session)],draft:'保留当前项目草稿',attachments:[{key:'owned-attachment',label:'owned.ts',source:'buffer',fileId:'owned-file',text:'owned context',byteLength:13}],messages:[{messageId:'owned-message',role:'assistant',text:'保留会话内容',state:'streaming'}],status:'running',task:h.task,tools:[{id:'owned-tool',name:'owned tool',state:'requested'}]});},
 reply(call,data){return {ok:true,requestId:call.requestId,data};},
 preserve(){const v=agentView.get(projectId);return {draft:v.draft,attachments:structuredClone(v.attachments),messages:structuredClone(v.messages),session:structuredClone(v.session),profile:v.profile,status:v.status,tools:structuredClone(v.tools),reviewId:v.reviewId,permission:v.permission,historyCursor:v.historyCursor,cancelRequested:v.cancelRequested,taskIdentity:v.task===h.task,taskId:v.task?.taskId,connectionId:v.connectionId};},
 capture(){const v=agentView.get(projectId);return {phase:h.phase,hostConnections:structuredClone(h.connections),viewConnections:structuredClone(v.connections),viewRevision:v.revision,loading:v.loading,preserved:h.preserve(),options:[...document.querySelectorAll('.agent-panel select[aria-label="当前模型连接"] option')].map(option=>({value:option.value,label:option.textContent})),draft:document.querySelector('.agent-panel textarea')?.value,dialogOpen:!!document.querySelector('[data-main-settings]'),calls:structuredClone(h.calls)};},
 invoke(command,{call,channel}){
  const record={phase:h.phase,command,method:call.method,scope:structuredClone(call.scope),params:structuredClone(call.params)};h.calls.push(record);
  let data;
  switch(call.method){
   case 'app_bootstrap':data={protocolVersion:1,schemaHash:'controlled',workspaces:[{id:'owned-workspace',name:'Owned workspace',projectIds:[projectId],revision:1}],projects:[structuredClone(h.project)],availableServices:[],activeProjectId:projectId,activeWorkspaceId:'owned-workspace'};break;
   case 'project_activate':h.epoch++;h.project.state='active';data={project:structuredClone(h.project),projectEpoch:h.epoch,session:structuredClone(h.projectSession)};break;
   case 'resource_list':data={items:[]};break;
   case 'session_update':data={...h.projectSession,...call.params,revision:2};break;
   case 'agent_connections_list':data={items:structuredClone(h.connections)};break;
   case 'agent_sessions_list':data={items:[structuredClone(h.session)]};break;
   case 'agent_preferences_get':data={revision:h.preferenceRevision,effectiveConnectionId:'owned-base',projectConnectionId:null};break;
   case 'agent_detect':data={ownership:'managed',installed:true,supported:true,version:'1.4.0',path:'/owned/pi',requiredVersion:'1.4.0',downloadBytes:1,source:'owned',diagnostics:[]};break;
   case 'agent_connection_save':{const previous=h.connections.find(c=>c.connectionId===call.params.connection.connectionId);const saved={...structuredClone(call.params.connection),revision:(previous?.revision??0)+1,authState:'configured'};h.connections=[...h.connections.filter(c=>c.connectionId!==saved.connectionId),saved];data=saved;break;}
   case 'agent_connection_test':{
    if(command!=='horizon_start')throw Error('Connection test expected task boundary');
    const c=h.connections.find(c=>c.connectionId===call.params.connectionId);c.authState='verified';const taskId='owned-test-task';
    queueMicrotask(()=>channel.onmessage({protocolVersion:1,event:'task',taskId,requestId:call.requestId,scope:call.scope,seq:1,payload:{type:'terminal',state:'succeeded',result:{authState:'verified',modelAvailable:true}}}));
    data={taskId,requestId:call.requestId,state:'queued',cancelMode:'cooperative'};break;
   }
   case 'stream_ack':data={acknowledged:true};break;
   case 'agent_connection_remove_preview':data={impactDigest:'owned-impact',sessions:[],projects:[],active:false};break;
   case 'agent_connection_remove':h.connections=h.connections.filter(c=>c.connectionId!==call.params.connectionId);h.preferenceRevision++;data={removed:true,sessionsPreserved:true};break;
   default:throw Error('Unexpected production RPC '+call.method);
  }
  return Promise.resolve(h.reply(call,data));
 }
};h.setup();createRoot(document.getElementById('root')).render(<App/>);
`;
async function bundle(variant){
 const agentSource=await readFile(path.join(directory,variant,'apps/desktop/src/features/agent/AgentSettings.tsx'),'utf8');
 const output=await build({stdin:{contents:entry,resolveDir:repository,loader:'tsx'},bundle:true,write:false,outfile:variant+'.js',jsx:'automatic',format:'iife',target:'es2022',logLevel:'silent',plugins:[{name:'reuse-real-App-boundaries',setup(builder){
  builder.onResolve({filter:/^@tauri-apps\/api\/(core|event)$/},args=>({path:args.path.endsWith('/core')?'core':'event',namespace:'controlled-tauri'}));
  builder.onLoad({filter:/.*/,namespace:'controlled-tauri'},args=>({contents:args.path==='core'?`export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.agentRefreshHarness.invoke(...args);`:`export const listen=async()=>()=>{};`,loader:'js'}));
  builder.onLoad({filter:/\/features\/settings\/AppearanceProvider\.tsx$/},()=>({contents:appearance,loader:'jsx'}));
  builder.onLoad({filter:/\/features\/settings\/SettingsPanel\.tsx$/},()=>({contents:settingsShell,loader:'jsx'}));
  builder.onLoad({filter:/\/features\/plugins\/service\.ts$/},()=>({contents:plugins,loader:'js'}));
  builder.onLoad({filter:/\/features\/editor\/index\.ts$/},()=>({contents:editor,loader:'js'}));
  builder.onLoad({filter:/\/features\/agent\/AgentSettings\.tsx$/},()=>({contents:agentSource,loader:'tsx',resolveDir:path.join(repository,'apps/desktop/src/features/agent')}));
 }}]});
 return {js:output.outputFiles.find(f=>f.path.endsWith('.js')).text,css:output.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'',warnings:output.warnings.map(w=>w.text)};
}
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const variant of ['before','after']){
  const asset=await bundle(variant);
  for(const kind of ['add','verify','delete']){
   const scenario={variant,kind,bundleSha256:sha256(asset.js),warnings:asset.warnings,browserErrors:[],consoleErrors:[],passed:false};report.scenarios.push(scenario);
   const page=await browser.newPage({viewport:{width:1280,height:900}});page.setDefaultTimeout(5000);
   page.on('pageerror',error=>scenario.browserErrors.push(error.message));page.on('console',message=>{if(message.type()==='error')scenario.consoleErrors.push(message.text());});
   const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const capture=()=>page.evaluate(()=>window.agentRefreshHarness.capture());
   try{
    await page.route('http://127.0.0.1:42761/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>'+asset.css+'</style></head><body><div id="root"></div><script>window.scenarioKind='+JSON.stringify(kind)+'</script><script>'+asset.js+'</script></body></html>'}));
    await page.goto('http://127.0.0.1:42761/');
    await page.getByRole('button',{name:'AI 助手',exact:true}).click();
    await page.getByRole('textbox',{name:'向 Pi 提问',exact:true}).waitFor();
    await page.waitForFunction(()=>window.agentRefreshHarness.capture().loading===false);await settle();
    scenario.initial=await capture();
    await page.getByRole('button',{name:'AI 连接设置',exact:true}).click();
    await page.getByRole('button',{name:'添加连接',exact:true}).waitFor();
    await page.waitForFunction(()=>document.querySelector('.agent-settings .agent-connection-row'));
    await page.evaluate(kind=>{window.agentRefreshHarness.phase=kind;},kind);
    if(kind==='add'){
     await page.getByRole('button',{name:'添加连接',exact:true}).click();const form=page.getByRole('dialog',{name:'添加模型连接',exact:true});
     await form.getByLabel(/^连接名称/).fill('Owned new');await form.getByLabel(/^服务地址/).fill('http://127.0.0.1:1/v1');await form.getByLabel(/^模型 ID/).fill('owned-new-model');await form.getByLabel(/^认证归属/).selectOption('external');await form.getByRole('button',{name:'保存连接',exact:true}).click();
     await page.locator('.agent-settings .agent-connection-row').filter({hasText:'Owned new'}).waitFor();
    }else if(kind==='verify'){
     await page.locator('.agent-settings .agent-connection-row').filter({hasText:'Owned base'}).getByRole('button',{name:'测试',exact:true}).click();
     await page.locator('.agent-settings .agent-connection-row').filter({hasText:'Owned base'}).getByText('已验证',{exact:true}).waitFor();
    }else{
     await page.getByRole('button',{name:'删除连接 Owned extra',exact:true}).click();await page.getByRole('dialog',{name:'删除模型连接',exact:true}).getByRole('button',{name:'删除连接',exact:true}).click();
     await page.waitForFunction(()=>!document.querySelector('.agent-settings button[aria-label="删除连接 Owned extra"]'));
    }
    await page.getByRole('button',{name:'完成',exact:true}).click();await settle();
    await page.waitForFunction(()=>window.agentRefreshHarness.capture().loading===false);await settle();scenario.returned=await capture();
    assert.equal(scenario.returned.dialogOpen,false);
    assert.deepEqual(scenario.returned.preserved,scenario.initial.preserved,'draft/context/session/run and selected connection retained');
    assert.equal(scenario.returned.draft,scenario.initial.draft);
    const view=scenario.returned.viewConnections;
    if(kind==='add')assert.equal(view.some(c=>c.provider.label==='Owned new'),variant==='after');
    if(kind==='verify')assert.equal(view.find(c=>c.connectionId==='owned-base').authState,variant==='after'?'verified':'configured');
    if(kind==='delete')assert.equal(view.some(c=>c.connectionId==='owned-extra'),variant==='before');
    const refreshCalls=scenario.returned.calls.filter(call=>call.phase===kind&&call.method==='agent_sessions_list');
    assert.equal(refreshCalls.length,variant==='after'?1:0,'only changed settings trigger existing store refresh');
    assert.equal(scenario.returned.calls.filter(call=>['agent_submit','agent_context_prepare','agent_session_create','agent_cancel'].includes(call.method)).length,0);
    if(variant==='after'&&kind==='add'){
     await page.getByRole('button',{name:'AI 连接设置',exact:true}).click();await page.getByRole('button',{name:'添加连接',exact:true}).waitFor();await settle();
     await page.locator('.agent-runtime-details > summary').click();await page.locator('.agent-runtime-options > summary').click();
     scenario.beforeDetect=await capture();await page.evaluate(()=>{window.agentRefreshHarness.phase='detect';});await page.getByRole('button',{name:'检测',exact:true}).click();
     await page.waitForFunction(()=>window.agentRefreshHarness.calls.some(call=>call.phase==='detect'&&call.method==='agent_detect'));await settle();scenario.afterDetect=await capture();
     assert.equal(scenario.afterDetect.viewRevision,scenario.beforeDetect.viewRevision);
     assert.equal(scenario.afterDetect.calls.filter(call=>call.phase==='detect'&&call.method==='agent_sessions_list').length,0);
     await page.getByRole('button',{name:'完成',exact:true}).click();
    }
    assert.deepEqual(scenario.browserErrors,[]);assert.deepEqual(scenario.consoleErrors,[]);scenario.passed=true;
   }finally{if(!scenario.passed)scenario.failure=await page.evaluate(()=>({capture:window.agentRefreshHarness?.capture(),text:document.body.innerText})).catch(error=>({error:String(error)}));await page.close();}
  }
 }
 report.passed=true;
}catch(error){report.error=String(error);report.stack=error.stack;process.exitCode=1;}
finally{
 if(browser)await browser.close();
 report.sourcesUnchanged=await Promise.all(metadata.sources.map(async source=>({path:source.path,unchanged:sha256(await readFile(path.join(repository,source.path)))===source.sha256})));
 report.completedAt=new Date().toISOString();report.durationMs=Date.now()-Date.parse(report.startedAt);await writeFile(resultPath,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({passed:report.passed,scenarios:report.scenarios.map(({variant,kind,passed})=>({variant,kind,passed})),sourcesUnchanged:report.sourcesUnchanged.every(s=>s.unchanged),error:report.error,durationMs:report.durationMs,resultPath}));
}
