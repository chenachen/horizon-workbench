import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Reuses the repository's actual-component/esbuild/Playwright route pattern.
// App, bridge and LauncherToolbar/useLauncher remain real. Unrelated product surfaces
// use the existing boundary-mock pattern; no native process/app data/product build.
const repository = '/Users/chenpengxiang/Desktop/Horizon';
const resultPath = path.join(repository, '.work/navigation-activation-component-result.json');
const appPath = 'apps/desktop/src/App.tsx';
const originalApp = await readFile(path.join(repository, appPath), 'utf8');
const oldLine = "  const activate = useCallback(async (id: string) => { setMainPage(null); const opened = await activateProject(id); if (opened) setSleepingSnapshot(undefined); return opened; }, [activateProject]);";
const newLine = "  const activate = useCallback(async (id: string) => { const opened = await activateProject(id); if (opened) { setMainPage(null); setSleepingSnapshot(undefined); } return opened; }, [activateProject]);";
assert.equal(originalApp.split(oldLine).length, 2, 'exact current App activation line');
const patchedApp = originalApp.replace(oldLine, newLine);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sourcePaths = [appPath, 'apps/desktop/src/bridge.ts', 'apps/desktop/src/features/processes/index.tsx'];
const sources = await Promise.all(sourcePaths.map(async file => ({ path: file, sha256: sha256(await readFile(path.join(repository, file))) })));
const report = { kind: 'actual App + LauncherToolbar + bridge; held Tauri activation reply after host epoch increment', startedAt: new Date().toISOString(), sources, scenarios: [], passed: false };
const core = `export const isTauri=()=>true; export class Channel { onmessage=()=>{}; } export const invoke=(command,args)=>window.navigationHarness.invoke(command,args);`;
const event = `export const listen=async(topic,callback)=>window.navigationHarness.listen(topic,callback);`;
const appearance = `
import React from 'react';
export const AppearanceProvider=({children})=>children;
export const useAppearance=()=>({snapshot:{effective:{layoutId:'horizon.layout.mist'},effectiveGeometry:{}},layouts:[{id:'horizon.layout.mist',navigation:'sidebar'}],themes:[],extensions:[],refresh:async()=>{},setGeometry:async()=>{},composing:{current:false}});
export const useSettings=()=>({settings:{effective:{},sources:{}}});
export const appearanceTarget=()=>({kind:'global'});export const windowGeometry=()=>({width:1280,height:800,scale:1});`;
const plugins = `
export const pluginRuntime={getSnapshot:()=>[]};export const usePlugins=()=>[];
export const usePluginEnabled=id=>id==='horizon.launch';export const activatePlugin=async()=>{};
export const registerPluginLifecycle=()=>()=>{};export const useSlot=()=>[];export const refreshPlugins=async()=>{};export const initializePlugins=async()=>()=>{};export const usePluginError=()=>'';`;
const editor = `export const editorStore={setProject:()=>{}}; export const FileExplorer=()=>null;export const SearchPanel=()=>null;export const EditorWorkbench=()=>null;export const QuickOpen=()=>null;export const getEditorDiagnostics=()=>({});`;
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './apps/desktop/src/App.tsx';
const h=window.navigationHarness={
  calls:[],listeners:new Map(),hostEpoch:0,phase:'boot',holdNextActivation:false,pending:null,
  project:{id:'owned-aurora',workspaceId:'owned-workspace',displayName:'Aurora Web',rootDisplayPath:'/owned/aurora',pinned:false,revision:1,state:'registered'},
  session:{schemaVersion:1,revision:1,tabs:[],activeFileId:null,expandedEntryIds:[],searchDraft:'',commitDraft:'',layout:{panels:{},focusMode:false,focusRestore:null}},
  listen(topic,callback){const group=h.listeners.get(topic)||new Set();group.add(callback);h.listeners.set(topic,group);return ()=>group.delete(callback);},
  reply(call,data){return {ok:true,requestId:call.requestId,data};},
  failure(call,code,message){return {ok:false,requestId:call.requestId,error:{code,message,retryable:true}};},
  release(){if(!h.pending)throw Error('No held activation');const pending=h.pending;h.pending=null;h.phase='completed';pending.resolve(h.reply(pending.call,pending.result));pending.record.outcome='released';},
  reject(){if(!h.pending)throw Error('No held activation');const pending=h.pending;h.pending=null;h.phase='failed';pending.resolve(h.failure(pending.call,'IO_ERROR','受控项目激活失败'));pending.record.outcome='rejected';},
  invoke(command,{call}){
    const record={command,phase:h.phase,method:call.method,scope:structuredClone(call.scope),hostEpoch:h.hostEpoch,outcome:'ok'};h.calls.push(record);
    if(call.scope.kind==='project'&&call.scope.projectEpoch!==h.hostEpoch){record.outcome='STALE_SCOPE';return Promise.resolve(h.failure(call,'STALE_SCOPE','项目上下文已过期'));}
    let data;
    switch(call.method){
      case 'app_bootstrap':data={protocolVersion:1,schemaHash:'controlled',workspaces:[{id:'owned-workspace',name:'Owned workspace',projectIds:[h.project.id],revision:1}],projects:[structuredClone(h.project)],availableServices:[],activeProjectId:h.project.id,activeWorkspaceId:'owned-workspace'};break;
      case 'project_activate':{
        const hold=h.holdNextActivation;h.holdNextActivation=false;
        if(hold!=='reject')h.hostEpoch++;
        h.project.state='active';
        const result={project:structuredClone(h.project),projectEpoch:h.hostEpoch,session:structuredClone(h.session)};
        if(hold){record.outcome='held';record.hostEpochAfter=h.hostEpoch;return new Promise(resolve=>{h.pending={call,result,resolve,record};});}
        data=result;break;
      }
      case 'resource_list':data={items:[]};break;
      case 'launch_profile_list':data={items:[{profileId:'owned-profile',projectId:h.project.id,name:'Owned ready profile',revision:1,steps:[]}]};break;
      case 'launch_list':data={items:[]};break;
      default:record.outcome='unexpected';throw Error('Unexpected production RPC: '+call.method);
    }
    return Promise.resolve(h.reply(call,data));
  },
  capture(){return {hostEpoch:h.hostEpoch,phase:h.phase,pending:!!h.pending,overviewVisible:!!document.querySelector('.overview'),toolbarCount:document.querySelectorAll('.process-launch-compact').length,launcherError:document.querySelector('.process-launch-compact .process-error')?.textContent||'',globalError:document.querySelector('.error-notification')?.textContent||'',calls:structuredClone(h.calls)};}
};
createRoot(document.getElementById('root')).render(<App/>);
`;

const bundle = async (variant, appSource) => {
  const output = await build({stdin:{contents:entry,resolveDir:repository,loader:'tsx'},bundle:true,write:false,outfile:variant+'.js',jsx:'automatic',format:'iife',target:'es2022',logLevel:'silent',plugins:[{name:'owned-tauri-boundary',setup(builder){
    builder.onResolve({filter:/^@tauri-apps\/api\/(core|event)$/},args=>({path:args.path.endsWith('/core')?'core':'event',namespace:'controlled-tauri'}));
    builder.onLoad({filter:/.*/,namespace:'controlled-tauri'},args=>({contents:args.path==='core'?core:event,loader:'js'}));
    builder.onLoad({filter:/\/apps\/desktop\/src\/App\.tsx$/},()=>({contents:appSource,loader:'tsx',resolveDir:path.join(repository,'apps/desktop/src')}));
    builder.onLoad({filter:/\/features\/settings\/AppearanceProvider\.tsx$/},()=>({contents:appearance,loader:'jsx'}));
    builder.onLoad({filter:/\/features\/plugins\/service\.ts$/},()=>({contents:plugins,loader:'js'}));
    builder.onLoad({filter:/\/features\/editor\/index\.ts$/},()=>({contents:editor,loader:'js'}));
  }}]});
  return { js: output.outputFiles.find(file=>file.path.endsWith('.js')).text, css: output.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'', warnings: output.warnings.map(warning=>warning.text) };
};
let browser;
try {
  browser=await chromium.launch({headless:true});
  for(const [variant,source] of [['before',originalApp],['after',patchedApp]]){
    const asset=await bundle(variant,source);
    const scenario={variant,inMemoryAppSha256:sha256(source),bundleSha256:sha256(asset.js),warnings:asset.warnings,browserErrors:[],consoleErrors:[],passed:false};
    report.scenarios.push(scenario);
    const page=await browser.newPage({viewport:{width:1280,height:800}});
    page.on('pageerror',error=>scenario.browserErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')scenario.consoleErrors.push(message.text());});
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const capture=()=>page.evaluate(()=>window.navigationHarness.capture());
    const launcherCalls=snapshot=>snapshot.calls.filter(call=>['launch_profile_list','launch_list'].includes(call.method));
    try {
      await page.route('http://127.0.0.1:42759/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>'+asset.css+'</style></head><body><div id="root"></div><script>'+asset.js+'</script></body></html>'}));
      await page.goto('http://127.0.0.1:42759/');
      await page.waitForFunction(()=>document.querySelector('.process-launch-compact option[value="owned-profile"]'),null,{timeout:5000});
      scenario.initial=await capture();
      assert.equal(scenario.initial.hostEpoch,1);
      assert.ok(launcherCalls(scenario.initial).every(call=>call.scope.projectEpoch===1&&call.outcome==='ok'));
      await page.getByRole('button',{name:'项目总览',exact:true}).click();
      await page.locator('.overview').waitFor();
      await settle();
      assert.equal(await page.locator('.process-launch-compact').count(),0,'overview unmounts real LauncherToolbar');
      await page.evaluate(()=>{window.navigationHarness.phase='pending';window.navigationHarness.holdNextActivation=true;});
      await page.getByRole('button',{name:'切换到项目 Aurora Web',exact:true}).click();
      await page.waitForFunction(()=>window.navigationHarness.pending,null,{timeout:5000});
      if(variant==='before')await page.waitForFunction(()=>document.querySelector('.process-launch-compact .process-error')?.textContent==='项目上下文已过期',null,{timeout:5000});
      await settle();
      scenario.pending=await capture();
      const pendingCalls=launcherCalls(scenario.pending).filter(call=>call.phase==='pending');
      assert.equal(scenario.pending.hostEpoch,2);
      assert.equal(scenario.pending.pending,true);
      if(variant==='before'){
        assert.equal(scenario.pending.overviewVisible,false);
        assert.equal(scenario.pending.toolbarCount,1);
        assert.equal(scenario.pending.launcherError,'项目上下文已过期');
        assert.ok(scenario.pending.globalError.includes('项目上下文已过期'));
        assert.deepEqual(pendingCalls.map(call=>call.method),['launch_profile_list','launch_list']);
        assert.ok(pendingCalls.every(call=>call.scope.projectEpoch===1&&call.hostEpoch===2&&call.outcome==='STALE_SCOPE'));
      }else{
        assert.equal(scenario.pending.overviewVisible,true);
        assert.equal(scenario.pending.toolbarCount,0);
        assert.equal(scenario.pending.globalError,'');
        assert.deepEqual(pendingCalls,[]);
      }
      await page.evaluate(()=>window.navigationHarness.release());
      if(variant==='after')await page.waitForFunction(()=>document.querySelector('.process-launch-compact option[value="owned-profile"]'),null,{timeout:5000});
      await settle();
      scenario.completed=await capture();
      assert.equal(scenario.completed.pending,false);
      assert.equal(scenario.completed.overviewVisible,false);
      if(variant==='after'){
        const completedCalls=launcherCalls(scenario.completed).filter(call=>call.phase==='completed');
        assert.deepEqual(completedCalls.map(call=>call.method),['launch_profile_list','launch_list']);
        assert.ok(completedCalls.every(call=>call.scope.projectEpoch===2&&call.hostEpoch===2&&call.outcome==='ok'));
        assert.equal(scenario.completed.launcherError,'');
        assert.equal(scenario.completed.globalError,'');
        assert.equal(await page.locator('.process-launch-compact button').first().isEnabled(),true,'new-epoch profile loaded by actual useLauncher');
        await page.getByRole('button',{name:'项目总览',exact:true}).click();
        await page.locator('.overview').waitFor();
        await page.evaluate(()=>{window.navigationHarness.phase='failure-pending';window.navigationHarness.holdNextActivation='reject';});
        await page.getByRole('button',{name:'切换到项目 Aurora Web',exact:true}).click();
        await page.waitForFunction(()=>window.navigationHarness.pending,null,{timeout:5000});
        await settle();
        scenario.failurePending=await capture();
        assert.equal(scenario.failurePending.overviewVisible,true);
        assert.deepEqual(launcherCalls(scenario.failurePending).filter(call=>call.phase==='failure-pending'),[]);
        await page.evaluate(()=>window.navigationHarness.reject());
        await page.getByLabel('关闭错误提示',{exact:true}).waitFor();
        await settle();
        scenario.failed=await capture();
        assert.equal(scenario.failed.overviewVisible,true);
        assert.equal(scenario.failed.toolbarCount,0);
        assert.ok(scenario.failed.globalError.includes('受控项目激活失败'),'activation failure still reports original error');
      }
      assert.deepEqual(scenario.browserErrors,[]);
      assert.deepEqual(scenario.consoleErrors,[]);
      scenario.passed=true;
    }finally{if(!scenario.passed)scenario.failureCapture=await page.evaluate(()=>({h:window.navigationHarness?.capture(),text:document.body.innerText})).catch(error=>({captureError:String(error)}));await page.close();}
  }
  report.passed=true;
}catch(error){report.error=String(error);report.stack=error.stack;process.exitCode=1;}
finally{
  if(browser)await browser.close();
  report.sourcesUnchanged=await Promise.all(sources.map(async source=>({path:source.path,unchanged:sha256(await readFile(path.join(repository,source.path)))===source.sha256})));
  report.completedAt=new Date().toISOString();
  report.durationMs=Date.now()-Date.parse(report.startedAt);
  await writeFile(resultPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,scenarios:report.scenarios.map(({variant,passed})=>({variant,passed})),sourcesUnchanged:report.sourcesUnchanged.every(source=>source.unchanged),error:report.error,durationMs:report.durationMs,resultPath}));
}
