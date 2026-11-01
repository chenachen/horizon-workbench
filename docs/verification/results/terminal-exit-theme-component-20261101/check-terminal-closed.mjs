import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Existing component-harness pattern: actual React TerminalPanel and actual xterm;
// controlled bridge only. This is not native GUI or OS-process acceptance.
const repository = '/Users/chenpengxiang/Desktop/Horizon';
const require = createRequire(path.join(repository, 'apps/desktop/package.json'));
const output = process.argv[2] || path.join(repository, '.work/terminal-closed-component-result.json');
const report = { kind: 'actual TerminalPanel/xterm component regression with controlled RPC', phases: [], themeChecks: [], passed: false };
report.sourceSha256 = createHash('sha256').update(await readFile(path.join(repository, 'apps/desktop/src/features/processes/index.tsx'))).digest('hex');
const bridge = `export const call=(...args)=>window.terminalHarness.request(...args); export const start=async()=>({result:Promise.resolve({})}); export const errorMessage=e=>e.message||String(e); export const onEvent=async(topic,callback)=>{const h=window.terminalHarness;const listeners=h.listeners.get(topic)||new Set();listeners.add(callback);h.listeners.set(topic,listeners);return async()=>listeners.delete(callback);};`;
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {TerminalPanel} from './apps/desktop/src/features/processes/index.tsx';
const root=createRoot(document.getElementById('root'));
const h=window.terminalHarness={calls:[],errors:[],instances:[],listeners:new Map(),views:0,holdNextInput:false,resolveInput:null,
  process:{processInstanceId:'owned-terminal-1',terminalSessionId:'owned-terminal-1',revision:1,title:'QA shell',cwd:'/owned/qa',pid:51343,state:'running',exitCode:null,owner:{projectId:'qa'}},
  emit(topic,payload){for(const listener of h.listeners.get(topic)||[])listener(payload);},
  close(){h.process={...h.process,revision:h.process.revision+1,state:'exited',exitCode:1};h.emit('horizon.process.v1',h.process);},
  render(mounted=true){root.render(mounted?<TerminalPanel projectId="qa" onError={message=>h.errors.push(message)}/>:null);},
  request(method,params,projectId){
    h.calls.push({method,params,projectId});
    if(method==='process_list')return Promise.resolve({items:[structuredClone(h.process)]});
    if(method==='terminal_create'){h.process={...h.process,processInstanceId:'owned-terminal-2',terminalSessionId:'owned-terminal-2',revision:1,pid:51344,state:'running',exitCode:null};return Promise.resolve({terminalSessionId:h.process.terminalSessionId});}
    if(method==='terminal_attach_view'){
      const viewSubscriptionId='view-'+(++h.views);
      const bytes=new TextEncoder().encode('HORIZON_HISTORY 中文\\r\\n');
      queueMicrotask(()=>h.emit('horizon.terminal.v1',{viewSubscriptionId,terminalSessionId:params.terminalSessionId,byteOffset:'0',bufferStart:'0',data:btoa(String.fromCharCode(...bytes)),gap:false}));
      return Promise.resolve({viewSubscriptionId});
    }
    if(method==='terminal_resize'&&h.process.state==='exited')return Promise.reject(new Error('此进程没有 PTY'));
    if(method==='terminal_input'){
      if(h.process.state==='exited')return Promise.reject(new Error('终端已结束'));
      if(h.holdNextInput){h.holdNextInput=false;return new Promise(resolve=>{h.resolveInput=()=>resolve({acceptedBytes:params.data.length});});}
    }
    return Promise.resolve({});
  }
};h.render();
`;
const bundled = await build({stdin:{contents:entry,resolveDir:repository,loader:'tsx'},bundle:true,write:false,outfile:'terminal-closed.js',jsx:'automatic',format:'iife',target:'es2022',plugins:[{name:'terminal-test-boundaries',setup(builder){
  builder.onResolve({filter:/^\.\.\/\.\.\/bridge$/},args=>args.importer.endsWith('/features/processes/index.tsx')?{path:args.path,namespace:'fixture-bridge'}:undefined);
  builder.onLoad({filter:/.*/,namespace:'fixture-bridge'},()=>({contents:bridge,loader:'js'}));
  builder.onResolve({filter:/^@xterm\/xterm$/},()=>({path:'xterm-probe',namespace:'fixture-xterm'}));
  builder.onResolve({filter:/^xterm-real$/},()=>({path:require.resolve('@xterm/xterm')}));
  builder.onLoad({filter:/.*/,namespace:'fixture-xterm'},()=>({contents:`import {Terminal as ActualTerminal} from 'xterm-real'; export class Terminal extends ActualTerminal { constructor(options){super(options);window.terminalHarness.instances.push(this);} }`,loader:'js'}));
}}]});
const js=bundled.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=bundled.outputFiles.find(file=>file.path.endsWith('.css'))?.text||'';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1000,height:700}}), pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
const phase=name=>report.phases.push({name,passed:true});
const callCount=method=>page.evaluate(method=>window.terminalHarness.calls.filter(call=>call.method===method).length,method);
const history=()=>page.evaluate(()=>{const buffer=window.terminalHarness.instances.at(-1).buffer.active;return Array.from({length:buffer.length},(_,i)=>buffer.getLine(i)?.translateToString(true)||'').join('\n');});
try{
  await page.route('http://horizon.test/',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>'+css+' :root{--surface:#ffffff;--h-low:#f3f6fb;--text:#17233b;--accent:#4b72ad;--selection:#d8e4f7} #root{height:500px;width:900px}.process-xterm{height:350px;min-height:350px}</style></head><body><button data-editor-focus>Editor</button><div id="root"></div><script>'+js+'</script></body></html>'}));
  await page.goto('http://horizon.test/');
  await page.waitForFunction(()=>window.terminalHarness.instances.length===1&&window.terminalHarness.calls.some(call=>call.method==='terminal_resize'));
  await page.waitForFunction(()=>window.terminalHarness.calls.some(call=>call.method==='terminal_output_ack'));
  assert.ok((await history()).includes('HORIZON_HISTORY 中文'));
  const palettes=[
    {name:'orbit-dark',surface:'#1b2636',low:'#202d40',text:'#e2ebf7',rgb:'rgb(32, 45, 64)'},
    {name:'celadon-light',surface:'#fbfffc',low:'#f1f7f3',text:'#243e33',rgb:'rgb(241, 247, 243)'},
    {name:'aurora-dark',surface:'#202b2e',low:'#263337',text:'#e1f1f1',rgb:'rgb(38, 51, 55)'}
  ];
  for(const [index,palette] of palettes.entries()){
    await page.evaluate(palette=>{const root=document.getElementById('root');root.style.display='none';document.documentElement.style.setProperty('--surface',palette.surface);document.documentElement.style.setProperty('--h-low',palette.low);document.documentElement.style.setProperty('--text',palette.text);},palette);
    await page.waitForTimeout(100);
    await page.evaluate(width=>{const root=document.getElementById('root');root.style.width=width+'px';root.style.display='block';},index%2?820:760);
    await page.waitForFunction(palette=>{const theme=window.terminalHarness.instances.at(-1).options.theme;return theme.background===palette.low&&theme.foreground===palette.text;},palette,{timeout:2500});
    const actual=await page.evaluate(()=>({instances:window.terminalHarness.instances.length,theme:window.terminalHarness.instances.at(-1).options.theme,panel:getComputedStyle(document.querySelector('.terminal-panel')).backgroundColor,xterm:getComputedStyle(document.querySelector('.process-xterm')).backgroundColor}));
    assert.equal(actual.instances,1);assert.equal(actual.panel,palette.rgb);assert.equal(actual.xterm,palette.rgb);
    assert.ok((await history()).includes('HORIZON_HISTORY 中文'));
    report.themeChecks.push({palette:palette.name,actual});
  }
  phase('same real xterm hidden dark to light to dark reopens with current low surface and retained history');
  await page.evaluate(()=>{const h=window.terminalHarness;h.originalElement=h.instances[0].element;h.holdNextInput=true;h.instances[0].input('first',true);h.instances[0].input('queued-after-first',true);});
  await page.waitForFunction(()=>Boolean(window.terminalHarness.resolveInput));
  assert.equal(await callCount('terminal_input'),1);
  await page.evaluate(()=>window.terminalHarness.close());
  await page.getByLabel('终端历史输出（只读）；F6 返回编辑器',{exact:true}).waitFor({timeout:2500});
  assert.equal(await page.evaluate(()=>{const h=window.terminalHarness;return h.instances.length===1&&h.instances[0].element===h.originalElement&&h.instances[0].options.disableStdin===true&&h.instances[0].options.cursorBlink===false;}),true);
  await page.evaluate(()=>window.terminalHarness.resolveInput());
  await page.waitForTimeout(100);
  assert.equal(await callCount('terminal_input'),1);
  assert.ok((await history()).includes('HORIZON_HISTORY 中文'));
  phase('running to exited updates read-only options without remount; queued input is not sent; history remains');

  const closedResize=await callCount('terminal_resize'),closedInput=await callCount('terminal_input');
  await page.evaluate(()=>{document.getElementById('root').style.display='none';document.documentElement.style.setProperty('--surface','#fefbff');document.documentElement.style.setProperty('--h-low','#f7f0fd');document.documentElement.style.setProperty('--text','#38254b');});
  await page.waitForTimeout(100);
  await page.evaluate(()=>{const root=document.getElementById('root');root.style.display='block';root.style.width='720px';window.terminalHarness.instances.at(-1).input('closed-input',true);});
  await page.waitForTimeout(200);
  assert.equal(await callCount('terminal_resize'),closedResize);
  assert.equal(await callCount('terminal_input'),closedInput);
  assert.equal(await page.evaluate(()=>window.terminalHarness.instances.at(-1).options.theme.background),'#f7f0fd');
  assert.equal(await page.evaluate(()=>window.terminalHarness.instances.at(-1).options.theme.foreground),'#38254b');
  assert.ok((await history()).includes('HORIZON_HISTORY 中文'));
  assert.deepEqual(await page.evaluate(()=>window.terminalHarness.errors),[]);
  phase('closed history hide/reopen refreshes current theme while real ResizeObserver fit sends no native resize/input');

  await page.evaluate(()=>window.terminalHarness.render(false));
  await page.locator('.terminal-panel').waitFor({state:'detached'});
  await page.evaluate(()=>window.terminalHarness.render(true));
  await page.getByLabel('终端历史输出（只读）；F6 返回编辑器',{exact:true}).waitFor();
  await page.waitForFunction(()=>window.terminalHarness.calls.filter(call=>call.method==='terminal_output_ack').length>=2);
  assert.equal(await callCount('terminal_resize'),closedResize);
  assert.equal(await callCount('terminal_input'),closedInput);
  assert.ok((await history()).includes('HORIZON_HISTORY 中文'));
  assert.equal(await page.evaluate(()=>window.terminalHarness.instances.at(-1).options.disableStdin),true);
  phase('fresh mount of exited session replays retained output read-only without a PTY call');

  await page.getByRole('button',{name:'新建终端',exact:true}).click();
  await page.getByLabel('交互式终端；F6 返回编辑器',{exact:true}).waitFor();
  await page.waitForFunction(()=>window.terminalHarness.calls.some(call=>call.method==='terminal_resize'&&call.params.terminalSessionId==='owned-terminal-2'));
  await page.evaluate(()=>window.terminalHarness.instances.at(-1).input('new-session-input',true));
  await page.waitForFunction(()=>window.terminalHarness.calls.some(call=>call.method==='terminal_input'&&call.params.terminalSessionId==='owned-terminal-2'&&call.params.data==='new-session-input'));
  assert.equal(await page.evaluate(()=>window.terminalHarness.instances.at(-1).options.disableStdin),false);
  assert.deepEqual(await page.evaluate(()=>window.terminalHarness.errors),[]);
  assert.deepEqual(pageErrors,[]);
  phase('new terminal remains interactive with real xterm input and native resize dispatch');
  report.passed=true;
}catch(error){report.error=String(error);report.pageErrors=pageErrors;process.exitCode=1;}
finally{
  report.calls=await page.evaluate(()=>window.terminalHarness?.calls||[]).catch(()=>[]);
  report.errors=await page.evaluate(()=>window.terminalHarness?.errors||[]).catch(()=>[]);
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({passed:report.passed,phases:report.phases.length,error:report.error,output}));
  await browser.close();
}
