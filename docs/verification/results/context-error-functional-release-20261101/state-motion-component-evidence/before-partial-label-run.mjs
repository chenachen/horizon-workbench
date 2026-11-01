import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository='/Users/chenpengxiang/Desktop/Horizon';
const directory=path.dirname(fileURLToPath(import.meta.url));
const metadata=JSON.parse(await readFile(path.join(directory,'source-sha.json'),'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={kind:'real SearchPanel and AppearanceProvider + actual workbench CSS; controlled bridge boundary',startedAt:new Date().toISOString(),sources:metadata,variants:[],passed:false};
const bridge=`export const nativeAvailable=()=>true;export const call=(...args)=>window.functionalHarness.request(...args);export const start=(...args)=>window.functionalHarness.startSearch(...args);export const onEvent=async()=>async()=>{};`;
const store=`export const editorStore={getSnapshot:()=>({projects:new Map([[window.functionalHarness.projectId,{searchDraft:window.functionalHarness.drafts[window.functionalHarness.projectId]??'needle'}]])}),setSearchDraft:(id,text)=>{window.functionalHarness.drafts[id]=text;},openFile:async()=>{}};`;
const entry=`
import React from 'react';import {createRoot} from 'react-dom/client';
import {SearchPanel} from './apps/desktop/src/features/editor/SearchPanel.tsx';
import {AppearanceProvider} from './apps/desktop/src/features/settings/AppearanceProvider.tsx';
import {builtinLayouts,builtinThemes} from './packages/plugins/src/builtins.ts';
import './apps/desktop/src/styles.css';import './apps/desktop/src/features/editor/editor.css';import './apps/desktop/src/features/agent/agent.css';import './apps/desktop/src/features/git/git.css';import './apps/desktop/src/features/settings/settings.css';
const root=createRoot(document.getElementById('root'));
const h=window.functionalHarness={projectId:'cache',drafts:{},tasks:[],calls:[],preference:'system',holdNextStart:false,
 request(method,params={}){h.calls.push({method,params:structuredClone(params),preference:h.preference});if(method==='settings_get')return Promise.resolve({revision:1,global:{},overrides:{},effective:{'ui.reduceMotion':h.preference},sources:{}});if(method==='extension_list')return Promise.resolve({items:[]});if(method==='appearance_get')return Promise.resolve({revision:1,effective:{layoutId:builtinLayouts[0].id,themeId:builtinThemes[0].id,mode:'light',geometryByLayout:{},colorsByTheme:{},background:{assetId:null,region:'workbench',fit:'cover',opacity:0,overlay:0,position:{x:.5,y:.5}}},effectiveGeometry:{},sources:[],layoutSource:'global',notices:[]});throw Error('Unexpected RPC '+method);},
 startSearch(method,params,onEvent,projectId){if(method!=='search_start')throw Error('Unexpected task '+method);let resolveResult,rejectResult,resolveStart;const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});result.catch(()=>{});const task={id:h.tasks.length,params:structuredClone(params),projectId,requestedAt:Date.now(),onEvent,resolveResult,rejectResult,cancelRequests:0,held:h.holdNextStart};const handle={taskId:'owned-'+task.id,result,cancel:async()=>{task.cancelRequests++;return {requested:true};}};task.resolveStart=()=>{task.held=false;resolveStart(handle);};h.tasks.push(task);h.holdNextStart=false;return task.held?new Promise(resolve=>{resolveStart=resolve;}):Promise.resolve(handle);},
 matches(id,count=1,prefix='needle'){const task=h.tasks[id];const items=Array.from({length:count},(_,line)=>({file:{projectId:task.projectId,fileId:'owned-file',displayPath:'owned.ts'},line,lineText:prefix+' '+line,ranges:[{unit:'utf16',from:0,to:prefix.length}]}));task.onEvent({payload:{type:'data',kind:'search.matches',data:{items}}});},
 complete(id,truncated=false){h.tasks[id].resolveResult({matches:0,files:1,truncated,elapsedMs:1});},
 search(projectId){h.projectId=projectId;root.render(<SearchPanel key={projectId} projectId={projectId} projectEpoch={1}/>);},
 motion(){root.render(<AppearanceProvider><div className="motion-fixture"><span className="spinner"/><span className="agent-spin"/><span className="git-refresh-icon is-spinning"/><div className="plugin-switch"><span/></div><div className="settings-panel"><div className="settings-switch"><span/></div></div><div className="editor-workbench"><div className="editor-motion"/></div></div></AppearanceProvider>);},
 capture(){return {projectId:h.projectId,summary:document.querySelector('.search-summary')?.textContent,time:document.querySelector('.search-summary time')?.getAttribute('datetime')??null,query:document.querySelector('[aria-label="搜索文本"]')?.value,error:document.querySelector('.project-search .editor-error')?.textContent??'',empty:document.querySelector('.search-empty-state')?.textContent??'',scrollTop:document.querySelector('.search-results')?.scrollTop,rows:[...document.querySelectorAll('.search-match code')].map(el=>el.textContent),tasks:h.tasks.map(({id,params,projectId,requestedAt,cancelRequests,held})=>({id,params,projectId,requestedAt,cancelRequests,held}))};},
 captureMotion(){const style=(selector,pseudo)=>{const s=getComputedStyle(document.querySelector(selector),pseudo);return {name:s.animationName,duration:s.animationDuration,transition:s.transitionDuration,scroll:s.scrollBehavior};};return {preference:h.preference,system:matchMedia('(prefers-reduced-motion:reduce)').matches,resolved:document.documentElement.dataset.reducedMotion,spinner:style('.spinner'),agent:style('.agent-spin'),git:style('.git-refresh-icon'),plugin:style('.plugin-switch span','::before'),settings:style('.settings-switch span'),editor:style('.editor-motion')};}
};h.search('cache');
`;
async function bundle(variant){
 const replacements=new Map();for(const source of metadata.changes)replacements.set(path.join(repository,source.path),await readFile(path.join(directory,variant,source.path),'utf8'));
 const output=await build({stdin:{contents:entry,resolveDir:repository,loader:'tsx'},bundle:true,write:false,outfile:variant+'.js',jsx:'automatic',format:'iife',target:'es2022',logLevel:'silent',plugins:[{name:'real-component-boundaries',setup(builder){
  builder.onResolve({filter:/^\.\.\/\.\.\/bridge$/},args=>({path:args.path,namespace:'bridge-fixture'}));builder.onLoad({filter:/.*/,namespace:'bridge-fixture'},()=>({contents:bridge,loader:'js'}));
  builder.onResolve({filter:/^\.\/store$|^\.\/commands$/},args=>args.importer.endsWith('/features/editor/SearchPanel.tsx')?{path:args.path,namespace:'editor-fixture'}:undefined);builder.onLoad({filter:/.*/,namespace:'editor-fixture'},args=>({contents:args.path==='./store'?store:'export const editorCommands={find:async()=>{},gotoLine:async()=>{}};',loader:'js'}));
  builder.onLoad({filter:/\.(tsx|css)$/},args=>replacements.has(args.path)?{contents:replacements.get(args.path),loader:args.path.endsWith('.css')?'css':'tsx',resolveDir:path.dirname(args.path)}:undefined);
 }}]});return {js:output.outputFiles.find(f=>f.path.endsWith('.js')).text,css:output.outputFiles.find(f=>f.path.endsWith('.css'))?.text||'',warnings:output.warnings.map(w=>w.text)};
}
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const variant of ['before','after']){
  const asset=await bundle(variant),v={variant,bundleSha256:sha256(asset.js),warnings:asset.warnings,browserErrors:[],consoleErrors:[],phases:[],passed:false};report.variants.push(v);
  const page=await browser.newPage({viewport:{width:1100,height:850},reducedMotion:'no-preference'});page.setDefaultTimeout(5000);page.on('pageerror',e=>v.browserErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')v.consoleErrors.push(m.text());});
  const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const capture=()=>page.evaluate(()=>window.functionalHarness.capture());
  const submit=async()=>{const count=await page.evaluate(()=>window.functionalHarness.tasks.length);await page.locator('.search-actions button[type=submit]').click();await page.waitForFunction(count=>window.functionalHarness.tasks.length===count+1,count);return count;};
  try{
   await page.route('http://127.0.0.1:42762/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>'+asset.css+' .project-search{height:520px;width:450px}.editor-motion{scroll-behavior:smooth;transition:opacity .2s}</style></head><body><div id="root"></div><script>'+asset.js+'</script></body></html>'}));await page.goto('http://127.0.0.1:42762/');await page.getByRole('textbox',{name:'搜索文本',exact:true}).waitFor();
   const first=await submit();await settle();const pending=await capture();await page.evaluate(id=>{const h=window.functionalHarness;h.matches(id,100);h.complete(id);},first);await settle();const completed=await capture();
   if(variant==='after'){assert.ok(pending.time);assert.equal(completed.time,pending.time);assert.ok(Math.abs(Date.parse(pending.time)-pending.tasks[first].requestedAt)<1000);assert.ok(completed.summary.includes('搜索发起于'));}else assert.equal(completed.time,null);
   await page.locator('.search-options input').nth(0).check();await page.locator('.search-options input').nth(1).check();await page.locator('.search-options input').nth(2).check();await page.locator('.search-form summary').click();await page.getByLabel('包含路径',{exact:true}).fill('src/**');await page.getByLabel('排除路径',{exact:true}).fill('dist/**');await page.getByRole('checkbox',{name:'包含忽略项',exact:true}).check();await settle();
   await page.locator('.search-results').evaluate(el=>{el.scrollTop=300;el.dispatchEvent(new Event('scroll',{bubbles:true}));});await settle();const changed=await capture();assert.equal(changed.tasks.length,1);assert.equal(changed.summary.includes('搜索条件已更改'),variant==='after');assert.ok(changed.summary.includes('100 处匹配'));
   await page.evaluate(()=>window.functionalHarness.search('cache-other'));await settle();await page.evaluate(()=>window.functionalHarness.search('cache'));await settle();const cached=await capture();assert.equal(cached.query,'needle');assert.equal(cached.scrollTop,changed.scrollTop);assert.equal(cached.time,completed.time);assert.equal(cached.tasks.length,1);
   v.phases.push({name:'timestamp at request start; option changes keep explicit historical result; cache restores inputs/scroll without request',pending,completed,changed,cached,passed:true});

   await page.evaluate(()=>window.functionalHarness.search('race'));await settle();await page.evaluate(()=>{window.functionalHarness.holdNextStart=true;});const old=await submit();await page.evaluate(id=>window.functionalHarness.matches(id,1,'early-old'),old);await settle();await page.locator('.search-options input').nth(0).check();await page.evaluate(id=>window.functionalHarness.matches(id,1,'late-before-ack'),old);await settle();const beforeAck=await capture();assert.equal(beforeAck.rows.some(row=>row.includes('late-before-ack')),variant==='before');assert.ok(!beforeAck.summary.includes('已取消'));
   await page.evaluate(id=>window.functionalHarness.tasks[id].resolveStart(),old);await settle();const afterAck=await capture();assert.equal(afterAck.tasks[old].cancelRequests,variant==='after'?1:0);
   const fresh=await submit();await page.evaluate(id=>{const h=window.functionalHarness;h.matches(id,1,'new-generation');h.complete(id,false);},fresh);await settle();const newest=await capture();await page.evaluate(id=>{const h=window.functionalHarness;h.matches(id,1,'late-after-new');h.complete(id,true);},old);await settle();const afterOldResult=await capture();assert.ok(afterOldResult.rows.some(row=>row.includes('new-generation')));assert.ok(!afterOldResult.rows.some(row=>row.includes('late-after-new')));assert.ok(!afterOldResult.summary.includes('已达到上限'));assert.equal(afterOldResult.time,newest.time);
   v.phases.push({name:'pending start + old events/result isolation; cancellation request makes no OS-stopped claim',beforeAck,afterAck,newest,afterOldResult,passed:true});

   await page.evaluate(()=>window.functionalHarness.search('zero'));await settle();const input=page.getByRole('textbox',{name:'搜索文本',exact:true});await input.fill('[');await input.press('Enter');await page.waitForFunction(()=>window.functionalHarness.tasks.length===4);const zeroId=await page.evaluate(()=>window.functionalHarness.tasks.length-1);await page.evaluate(id=>window.functionalHarness.complete(id,false),zeroId);await settle();const zero=await capture();assert.ok(zero.empty.includes('“[”'));
   await page.locator('.search-options input').nth(2).check();await page.locator('.search-actions button[type=submit]').click();await settle();const invalid=await capture();assert.equal(invalid.tasks.length,zero.tasks.length);assert.ok(invalid.error.includes('正则表达式无效'));if(variant==='after'){assert.equal(invalid.time,zero.time);assert.equal(invalid.empty,'');assert.ok(invalid.summary.includes('搜索条件已更改'));}
   await input.fill('');await settle();const cleared=await capture();assert.equal(cleared.time,null);assert.equal(cleared.rows.length,0);if(variant==='after')assert.equal(cleared.error,'');
   v.phases.push({name:'zero result belongs to original plain-text request; invalid regex issues no task; new/empty query clears old metadata/error',zero,invalid,cleared,passed:true});

   await page.evaluate(()=>window.functionalHarness.motion());await page.locator('.motion-fixture').waitFor();await settle();const motion=[];
   for(const system of ['no-preference','reduce'])for(const preference of ['on','off','system']){
    await page.emulateMedia({reducedMotion:system});await page.evaluate(preference=>{window.functionalHarness.preference=preference;window.dispatchEvent(new Event('horizon:settings-changed'));},preference);await settle();const state=await page.evaluate(()=>window.functionalHarness.captureMotion());motion.push(state);const reduced=preference==='on'||preference==='system'&&system==='reduce';assert.equal(state.resolved,String(reduced));
    if(variant==='after'){
     for(const name of ['spinner','agent','git'])assert.equal(state[name].name==='none',reduced,name+' effective motion preference');
     for(const name of ['plugin','settings','editor'])assert.equal(parseFloat(state[name].transition)===0,reduced,name+' transition policy');assert.equal(state.editor.scroll,reduced?'auto':'smooth');
    }
   }
   if(variant==='before'){const on=motion.find(m=>m.preference==='on'&&!m.system),off=motion.find(m=>m.preference==='off'&&m.system);assert.notEqual(on.agent.name,'none');assert.notEqual(on.spinner.name,'none');assert.equal(off.agent.name,'none');assert.notEqual(off.plugin.transition,'0.15s');}
   v.phases.push({name:'real AppearanceProvider on/off/system with both OS settings; global/Agent/Git/settings/plugin pseudo/editor CSS',motion,passed:true});assert.deepEqual(v.browserErrors,[]);assert.deepEqual(v.consoleErrors,[]);v.passed=true;
  }finally{if(!v.passed)v.failure=await page.evaluate(()=>({search:window.functionalHarness?.capture(),text:document.body.innerText})).catch(e=>({error:String(e)}));await page.close();}
 }
 report.passed=true;
}catch(error){report.error=String(error);report.stack=error.stack;process.exitCode=1;}
finally{if(browser)await browser.close();report.sourcesUnchanged=await Promise.all([...metadata.changes.map(s=>({path:s.path,sha256:s.beforeSha256})),...metadata.support].map(async s=>({path:s.path,unchanged:sha256(await readFile(path.join(repository,s.path)))===s.sha256})));report.completedAt=new Date().toISOString();report.durationMs=Date.now()-Date.parse(report.startedAt);await writeFile(path.join(directory,'result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,variants:report.variants.map(v=>({variant:v.variant,passed:v.passed,phases:v.phases.length})),sourcesUnchanged:report.sourcesUnchanged.every(s=>s.unchanged),error:report.error,durationMs:report.durationMs,resultPath:path.join(directory,'result.json')}));}
