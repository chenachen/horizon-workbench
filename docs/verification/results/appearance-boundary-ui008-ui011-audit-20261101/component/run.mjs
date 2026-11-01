import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon';
const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
const resultPath = path.join(outputDirectory, 'result.json');
const startedAt = new Date().toISOString();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['apps/desktop/src/features/settings/AppearanceProvider.tsx', 'apps/desktop/src/features/settings/SettingsPanel.tsx', 'apps/desktop/src/features/settings/background.ts', 'apps/desktop/src/bridge.ts', 'packages/appearance/src/index.ts', 'packages/plugins/src/builtins.ts', 'apps/desktop/src/App.tsx'];
const sources = [];
for (const relative of sourcePaths) {
  const bytes = await readFile(path.join(repository, relative));
  const target = path.join(outputDirectory, 'source', relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
  sources.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
}
const report = { kind: 'real AppearanceProvider + SettingsPanel/backgroundObjectUrl/applyAppearance/bridge; controlled Tauri only', startedAt, sources, phases: [], browserErrors: [], consoleErrors: [], passed: false };
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AppearanceProvider,useAppearance} from './apps/desktop/src/features/settings/AppearanceProvider.tsx';
import {SettingsPanel} from './apps/desktop/src/features/settings/SettingsPanel.tsx';
import {builtinPackages,builtinLayouts,builtinThemes} from './packages/plugins/src/builtins.ts';
import './apps/desktop/src/styles.css';
const base=builtinLayouts.find(item=>item.id==='horizon.layout.mist');
const target=builtinLayouts.find(item=>item.id==='horizon.layout.orbit');
const theme=builtinThemes.find(item=>item.id==='horizon.theme.mist');
const root=createRoot(document.getElementById('root'));
const h=window.appearanceHarness={
  root,target,base,phase:'loaded-image',calls:[],reads:[],created:[],revoked:[],errors:[],plans:new Map(),commits:[],assetIndices:{},resolvingRead:null,failApply:false,
  host:{revision:10,effective:{layoutId:base.id,themeId:theme.id,mode:'light',geometryByLayout:{},colorsByTheme:{},background:{assetId:'owned-image',region:'workbench',fit:'cover',opacity:.12,overlay:.85,position:{x:.5,y:.5}}},effectiveGeometry:{},sources:[],layoutSource:'global',notices:[]},
  reportError(error){h.errors.push({code:error.code,message:error.message});},
  snapshot(){return structuredClone(h.host);},
  reply(call,data){return {ok:true,requestId:call.requestId,data};},
  findFiber(name){const visit=fiber=>{if(!fiber)return; if(fiber.type?.name===name)return fiber; return visit(fiber.child)||visit(fiber.sibling);};return visit(root._internalRoot.current);},
  hookValues(name){const values=[];let hook=h.findFiber(name)?.memoizedState;while(hook){values.push(hook.memoizedState);hook=hook.next;}return values;},
  assetState(name){const values=h.hookValues(name);const index=values.findIndex(value=>value&&typeof value.assetId==='string'&&typeof value.url==='string');if(index>=0)h.assetIndices[name]=index;const saved=h.assetIndices[name];return saved===undefined?'unobserved':structuredClone(values[saved]);},
  panelSnapshot(){return structuredClone(h.hookValues('SettingsPanel').find(value=>value?.effective?.layoutId));},
  resolveRead(id){const read=h.reads.find(item=>item.id===id);if(!read||read.state!=='pending')throw Error('No pending read '+id);h.resolvingRead={id,owner:read.owner};read.state='resolved';read.resolve(h.reply(read.call,{dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG3sAAAAASUVORK5CYII='}));},
  invoke(command,{call}){
    const record={phase:h.phase,command,method:call.method,params:structuredClone(call.params),scope:structuredClone(call.scope),outcome:'ok'};h.calls.push(record);
    let data;
    switch(call.method){
      case 'appearance_get':data=h.snapshot();break;
      case 'extension_list':data={items:builtinPackages.map(manifest=>({id:manifest.id,manifest,installState:'installed',revision:1,enabledGlobal:true,effectiveEnabled:true,effectivePaused:false,runState:'active'}))};break;
      case 'settings_get':data={revision:1,global:{},overrides:{},effective:{'ui.fontSize':13,'editor.fontSize':14,'editor.fontFamily':'Menlo'},sources:{}};break;
      case 'appearance_preset_list':data={items:[]};break;
      case 'appearance_background_read':return new Promise(resolve=>h.reads.push({id:h.reads.length+1,owner:call.params.thumbnail?'SettingsPanel':'AppearanceProvider',assetId:call.params.previewToken,state:'pending',resolve,call}));
      case 'appearance_patch':for(const change of call.params.changes){if(change.field.kind!=='background'||change.operation!=='set')throw Error('Unexpected patch');h.host.effective.background=structuredClone(change.value);}h.host.revision++;data=h.snapshot();break;
      case 'appearance_layout_prepare':{const planId='owned-plan-'+h.plans.size;h.plans.set(planId,{layoutId:call.params.layoutId});data={planId,digest:'owned-digest'};break;}
      case 'appearance_layout_apply':{
        if(h.failApply){h.failApply=false;record.outcome='rejected-before-commit';return Promise.resolve({ok:false,requestId:call.requestId,error:{code:'IO_ERROR',message:'受控 apply 在提交前失败',retryable:true}});}
        const plan=h.plans.get(call.params.planId);if(!plan)throw Error('Unknown plan');h.host.effective.layoutId=plan.layoutId;h.host.revision++;h.commits.push({phase:h.phase,layoutId:plan.layoutId,revision:h.host.revision});data={snapshot:h.snapshot()};break;
      }
      default:record.outcome='unexpected';throw Error('Unexpected production RPC '+call.method);
    }
    return Promise.resolve(h.reply(call,data));
  },
  capture(){const element=document.documentElement,preview=document.querySelector('.background-upload');return {phase:h.phase,providerSnapshot:structuredClone(h.appearance?.snapshot),panelSnapshot:h.panelSnapshot(),composing:h.appearance?.composing.current,assetState:{AppearanceProvider:h.assetState('AppearanceProvider'),SettingsPanel:h.assetState('SettingsPanel')},rootStyle:element.getAttribute('style'),layout:element.dataset.layout,background:element.dataset.background,backgroundCss:element.style.getPropertyValue('--background-image'),previewInline:preview?.style.backgroundImage??null,previewComputed:preview?getComputedStyle(preview).backgroundImage:null,created:structuredClone(h.created),revoked:[...h.revoked],reads:h.reads.map(({id,owner,assetId,state})=>({id,owner,assetId,state})),calls:structuredClone(h.calls),commits:structuredClone(h.commits),errors:structuredClone(h.errors)};},
  render(mounted=true,section='background'){root.render(mounted?<AppearanceProvider onError={h.reportError}><Capture/><SettingsPanel initialSection={section} onError={h.reportError}/></AppearanceProvider>:null);}
};
const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
URL.createObjectURL=blob=>{const url=create(blob);h.created.push({url,owner:h.resolvingRead?.owner,readId:h.resolvingRead?.id,bytes:blob.size,type:blob.type});return url;};
URL.revokeObjectURL=url=>{h.revoked.push(url);revoke(url);};
function Capture(){h.appearance=useAppearance();return null;}
h.render();
`;
let browser, page;
const phase = (name, observations) => report.phases.push({ name, passed: true, ...observations });
try {
  const bundled = await build({stdin:{contents:entry,resolveDir:repository,loader:'tsx'},bundle:true,write:false,outfile:'appearance-boundary.js',jsx:'automatic',format:'iife',target:'es2022',logLevel:'silent',plugins:[{name:'controlled-tauri-only',setup(builder){
    builder.onResolve({filter:/^@tauri-apps\/api\/(core|event)$/},args=>({path:args.path.endsWith('/core')?'core':'event',namespace:'controlled-tauri'}));
    builder.onLoad({filter:/.*/,namespace:'controlled-tauri'},args=>({contents:args.path==='core'?`export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.appearanceHarness.invoke(...args);`:`export const listen=async()=>()=>{};`,loader:'js'}));
  }}]});
  report.bundleSha256=sha256(bundled.outputFiles.find(file=>file.path.endsWith('.js')).contents);
  report.bundleWarnings=bundled.warnings.map(warning=>warning.text);
  const js=bundled.outputFiles.find(file=>file.path.endsWith('.js')).text,css=bundled.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'';
  browser=await chromium.launch({headless:true});
  page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',error=>report.browserErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
  await page.route('http://127.0.0.1:42760/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>'+css+' .settings-panel{height:100vh}</style></head><body><div id="root"></div><script>'+js+'</script></body></html>'}));
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const capture=()=>page.evaluate(()=>window.appearanceHarness.capture());
  const assertCleared=snapshot=>{
    assert.equal(snapshot.providerSnapshot.effective.background.assetId,null);
    assert.equal(snapshot.panelSnapshot.effective.background.assetId,null);
    assert.deepEqual(snapshot.assetState,{AppearanceProvider:null,SettingsPanel:null});
    assert.equal(snapshot.backgroundCss,'none');assert.equal(snapshot.background,'none');
    assert.equal(snapshot.previewInline,'');assert.equal(snapshot.previewComputed.includes('blob:'),false);
  };
  await page.goto('http://127.0.0.1:42760/');
  await page.getByRole('button',{name:'关闭背景',exact:true}).waitFor();
  await page.waitForFunction(()=>window.appearanceHarness.reads.filter(read=>read.state==='pending').length===2);
  const readIds=await page.evaluate(()=>window.appearanceHarness.reads.map(read=>read.id));
  for(let index=0;index<readIds.length;index++){
    await page.evaluate(id=>window.appearanceHarness.resolveRead(id),readIds[index]);
    await page.waitForFunction(count=>window.appearanceHarness.created.length===count,index+1);
    await settle();
  }
  const loaded=await capture();
  assert.equal(loaded.created.length,2);assert.equal(loaded.revoked.length,0);
  for(const name of ['AppearanceProvider','SettingsPanel']){
    const created=loaded.created.find(item=>item.owner===name);assert.ok(created?.url.startsWith('blob:'));
    assert.equal(loaded.assetState[name].url,created.url);
  }
  assert.ok(loaded.backgroundCss.includes(loaded.assetState.AppearanceProvider.url));
  assert.ok(loaded.previewInline.includes(loaded.assetState.SettingsPanel.url));
  await page.getByRole('button',{name:'关闭背景',exact:true}).click();await settle();
  const cleared=await capture();assertCleared(cleared);
  assert.deepEqual([...cleared.revoked].sort(),loaded.created.map(item=>item.url).sort());
  await page.waitForFunction(()=>window.appearanceHarness.calls.filter(call=>call.method==='appearance_patch').length===1);
  phase('UI008 loaded images -> actual close action clears both React states/CSS and revokes every created URL once',{loaded,cleared});

  await page.evaluate(()=>window.appearanceHarness.render(false));await settle();
  await page.evaluate(()=>{const h=window.appearanceHarness;h.phase='late-read';h.host.effective.background.assetId='owned-late-image';h.host.revision++;h.render();});
  await page.getByRole('button',{name:'关闭背景',exact:true}).waitFor();
  await page.waitForFunction(()=>window.appearanceHarness.reads.filter(read=>read.assetId==='owned-late-image'&&read.state==='pending').length===2);
  const pending=await capture();
  await page.getByRole('button',{name:'关闭背景',exact:true}).click();await settle();
  const lateCleared=await capture();assertCleared(lateCleared);
  await page.waitForFunction(()=>window.appearanceHarness.calls.filter(call=>call.method==='appearance_patch').length===2);
  await page.evaluate(()=>{const h=window.appearanceHarness;for(const read of h.reads.filter(read=>read.state==='pending'))h.resolveRead(read.id);});await settle();
  const afterLateRead=await capture();assertCleared(afterLateRead);
  assert.deepEqual(afterLateRead.created,cleared.created);assert.deepEqual(afterLateRead.revoked,cleared.revoked);
  assert.equal(afterLateRead.reads.filter(read=>read.state==='pending').length,0);
  phase('UI008 both reads resolved after assetId null create zero new object URLs',{pending,lateCleared,afterLateRead});

  await page.getByRole('button',{name:'布局与尺寸',exact:true}).click();
  const targetLabel=await page.evaluate(()=>window.appearanceHarness.target.label);
  await page.evaluate(()=>{window.appearanceHarness.phase='composition-held';document.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'ni'}));});
  await page.locator('.layout-choice').filter({hasText:targetLabel}).click();
  await page.waitForFunction(()=>document.querySelector('.layout-choice')?.disabled===true);await settle();
  const composing=await capture();
  assert.equal(composing.composing,true);assert.equal(composing.providerSnapshot.effective.layoutId,'horizon.layout.mist');
  assert.equal(composing.calls.filter(call=>call.phase==='composition-held'&&/^appearance_layout_(prepare|apply)$/.test(call.method)).length,0);
  await page.evaluate(()=>{window.appearanceHarness.phase='composition-ended';document.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你'}));});
  await page.waitForFunction(()=>window.appearanceHarness.appearance.snapshot?.effective.layoutId==='horizon.layout.orbit'&&document.querySelector('.layout-choice')?.disabled===false);await settle();
  await page.evaluate(()=>document.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你'})));await settle();
  const switched=await capture();
  assert.equal(switched.composing,false);assert.equal(switched.layout,'tabs');
  const layoutCalls=switched.calls.filter(call=>/^appearance_layout_(prepare|apply)$/.test(call.method));
  assert.deepEqual(layoutCalls.map(call=>call.method),['appearance_layout_prepare','appearance_layout_apply']);
  assert.ok(layoutCalls.every(call=>call.phase==='composition-ended'));
  assert.equal(switched.commits.length,1);assert.equal(switched.panelSnapshot.effective.layoutId,'horizon.layout.orbit');
  phase('UI011 actual selectLayout waits for provider compositionend then prepares/applies exactly once',{composing,switched});

  const baseLabel=await page.evaluate(()=>window.appearanceHarness.base.label);
  await page.evaluate(()=>{window.appearanceHarness.phase='apply-rejected-before-commit';window.appearanceHarness.failApply=true;});
  await page.locator('.layout-choice').filter({hasText:baseLabel}).click();
  await page.getByRole('heading',{name:'布局未能启用',exact:true}).waitFor();await settle();
  const rejected=await capture();
  assert.deepEqual(rejected.providerSnapshot,switched.providerSnapshot);
  assert.deepEqual(rejected.panelSnapshot,switched.panelSnapshot);
  assert.equal(rejected.rootStyle,switched.rootStyle);assert.equal(rejected.layout,switched.layout);
  assert.deepEqual(rejected.commits,switched.commits);
  const rejectedCalls=rejected.calls.filter(call=>call.phase==='apply-rejected-before-commit'&&/^appearance_layout_(prepare|apply)$/.test(call.method));
  assert.deepEqual(rejectedCalls.map(call=>call.method),['appearance_layout_prepare','appearance_layout_apply']);
  assert.equal(rejectedCalls[1].outcome,'rejected-before-commit');
  assert.deepEqual(rejected.errors,[]);
  phase('UI011 rejected apply before commit preserves exact provider/panel snapshot and root style; no post-commit rollback claimed',{rejected});
  await page.evaluate(()=>window.appearanceHarness.render(false));await settle();
  report.final=await capture();
  assert.deepEqual(report.final.created.map(item=>item.url).sort(),[...report.final.revoked].sort());
  assert.deepEqual(report.browserErrors,[]);assert.deepEqual(report.consoleErrors,[]);
  report.passed=true;
}catch(error){report.error=String(error);report.stack=error.stack;process.exitCode=1;}
finally{
  if(page&&!report.passed)report.failureCapture=await page.evaluate(()=>({state:window.appearanceHarness?.capture(),text:document.body.innerText})).catch(error=>({error:String(error)}));
  if(browser)await browser.close();
  report.sourcesUnchanged=await Promise.all(sources.map(async source=>({path:source.path,unchanged:sha256(await readFile(path.join(repository,source.path)))===source.sha256})));
  report.completedAt=new Date().toISOString();report.durationMs=Date.now()-Date.parse(startedAt);
  await writeFile(resultPath,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,phases:report.phases.map(phase=>({name:phase.name,passed:phase.passed})),sourcesUnchanged:report.sourcesUnchanged.every(source=>source.unchanged),error:report.error,durationMs:report.durationMs,resultPath}));
}
