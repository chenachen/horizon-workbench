import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const executable = process.env.HORIZON_TEST_TYPESCRIPT_LSP;
assert.ok(executable, 'Set HORIZON_TEST_TYPESCRIPT_LSP to a TypeScript 7 native LSP executable');
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const directory = await mkdtemp(join(tmpdir(), 'horizon-real-lsp-'));
const main = "import { unsaved } from './lib';\nconst value = unsaved();\n";
const disk = 'export function diskOnly() { return 1; }\n';
const edited = '// 未保存内容😀\nexport function unsaved() { return 42; }\n';
await writeFile(join(directory, 'main.ts'), main);
await writeFile(join(directory, 'lib.ts'), disk);
await writeFile(join(directory, 'tsconfig.json'), '{"compilerOptions":{"module":"esnext","target":"esnext","moduleResolution":"bundler","strict":true},"include":["*.ts"]}');
const rootUri = pathToFileURL(directory).toString();
const sent = [], received = [], children = [], streams = [], queued = [];
let child, input = Buffer.alloc(0), bundle, sessionSequence = 0;
function emit(message) {
  received.push(JSON.parse(message));
  if (streams.length) for (const stream of streams) stream.write(`data: ${JSON.stringify({ type: 'message', message })}\n\n`);
  else queued.push(message);
}
function start() {
  sessionSequence++; input = Buffer.alloc(0);
  child = spawn(executable, ['--lsp', '--stdio'], { cwd: directory, stdio: ['pipe', 'pipe', 'pipe'] }); children.push(child);
  child.stderr.resume();
  child.stdout.on('data', chunk => {
    input = Buffer.concat([input, chunk]);
    for (;;) {
      const end = input.indexOf('\r\n\r\n'); if (end < 0) break;
      const length = Number(/Content-Length:\s*(\d+)/i.exec(input.subarray(0, end).toString())[1]);
      if (input.length < end + 4 + length) break;
      const body = input.subarray(end + 4, end + 4 + length).toString(); input = input.subarray(end + 4 + length); emit(body);
    }
  });
}
const source = `
import React from 'react';import {createRoot} from 'react-dom/client';import {EditorView} from '@codemirror/view';
import CodeSurface,{editorCommands} from './apps/desktop/src/features/editor/CodeSurface.tsx';
import {editorStore} from './apps/desktop/src/features/editor/store.ts';
const states=[{id:'language.typescript',installState:'installed',effectiveEnabled:true,effectivePaused:false,runState:'active',revision:1,installedVersion:'1',manifest:{contributes:{languages:[{id:'typescript',extensions:['.ts']}]}}},{id:'semantic.typescript',installState:'installed',effectiveEnabled:true,effectivePaused:false,runState:'active',revision:1,installedVersion:'1',manifest:{contributes:{languageServers:[{id:'typescript',languageIds:['typescript'],command:'fixture'}]}}}];
let eventStream,eventSession;
const request=async(method,params={})=>{const result=await fetch('/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,params})}).then(r=>r.json());if(result.error)throw new Error(result.error);return result;};
window.__realNative={states,call:request,async connect(call,channel){const info=await request('connect',call.params);if(!eventStream||eventSession!==info.sessionId){eventStream?.close();eventSession=info.sessionId;eventStream=new EventSource('/events');eventStream.onmessage=event=>channel.onmessage(JSON.parse(event.data));await new Promise(resolve=>eventStream.onopen=resolve);}return{ok:true,requestId:call.requestId,data:info};}};
const root=createRoot(document.getElementById('root'));
window.realHarness={store:editorStore,commands:editorCommands,
  async start(){editorStore.setProject('A',1);await editorStore.openFile('lib.ts',{projectId:'A'});root.render(React.createElement(CodeSurface,{projectId:'A'}));},
  async open(id){await editorStore.openFile(id,{projectId:'A'});},
  view(){return EditorView.findFromDOM(document.querySelector('.cm-editor'));},
  edit(text){const view=this.view();view.dispatch({changes:{from:0,to:view.state.doc.length,insert:text}});},
  jump(){const view=this.view();const line=view.state.doc.line(2);view.dispatch({selection:{anchor:line.from+20}});return editorCommands.definition();},
  restart(){return request('restart');},
  inspect(){const buffer=editorStore.getActive('A');return{active:buffer?.fileId,text:buffer?.getText(),selection:buffer?.selection,buffers:[...editorStore.getSnapshot().buffers.values()].map(b=>({fileId:b.fileId,dirty:b.dirty,text:b.getText()})),error:editorStore.getSnapshot().error,picker:document.querySelector('.definition-picker')?.textContent};}
};
`;
bundle = await build({ stdin: { resolveDir: repository, contents: source }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false,
  plugins: [{ name: 'native', setup(builder) {
    builder.onResolve({filter:/^@tauri-apps\/api\/core$/},()=>({path:'tauri',namespace:'fixture'}));
    builder.onResolve({filter:/\/bridge$/},()=>({path:'bridge',namespace:'fixture'}));
    builder.onResolve({filter:/^\.\.\/plugins\/service$/},()=>({path:'plugins',namespace:'fixture'}));
    builder.onResolve({filter:/^\.\/syntax$/},()=>({path:'syntax',namespace:'fixture'}));
    builder.onResolve({filter:/^\.\/textmate$/},()=>({path:'textmate',namespace:'fixture'}));
    builder.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({contents:{
      tauri:'export class Channel{onmessage=()=>{}};export const invoke=(_,{call,channel})=>window.__realNative.connect(call,channel);',
      bridge:'export const nativeAvailable=()=>true;export const getProjectEpoch=()=>1;export const call=(...args)=>window.__realNative.call(...args);export const errorMessage=e=>e.message||String(e);',
      plugins:'const listeners=new Set();export const pluginRuntime={getSnapshot:()=>window.__realNative.states,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}};export const refreshPlugins=async()=>{};',
      syntax:"export const syntaxService={getRevision:()=>1,languageId:()=> 'typescript',load:async()=>[],subscribe:()=>()=>{},release:()=>{}};",
      textmate:'export const textmateHighlightReady=()=>true;',
    }[path],loader:'js'}));
  }}] });
const server = createServer(async(request,response)=>{
  if(request.url==='/fixture.js'){response.setHeader('Content-Type','text/javascript');response.end(bundle.outputFiles[0].contents);return;}
  if(request.url==='/events'){response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});response.write(': ready\n\n');streams.push(response);response.on('close',()=>{const index=streams.indexOf(response);if(index>=0)streams.splice(index,1);});for(const message of queued.splice(0))response.write(`data: ${JSON.stringify({type:'message',message})}\n\n`);return;}
  if(request.url==='/call'){
    try{
      const chunks=[];for await(const chunk of request)chunks.push(chunk);const {method,params}=JSON.parse(Buffer.concat(chunks));let result={};
      if(method==='connect'){if(!child)start();result={sessionId:'native-session-'+sessionSequence,serverId:'typescript',extensionId:'semantic.typescript',rootUri,fileUri:pathToFileURL(join(directory,params.fileId)).toString(),languageId:'typescript',revision:1};}
      else if(method==='restart'){child?.kill();child=undefined;for(const stream of streams)stream.write(`data: ${JSON.stringify({type:'closed',error:'fixture restart'})}\n\n`);}
      else if(method==='language_server_send'){const data=JSON.parse(params.message);sent.push(data);await new Promise((resolve,reject)=>child.stdin.write(`Content-Length: ${Buffer.byteLength(params.message)}\r\n\r\n${params.message}`,error=>error?reject(error):resolve()));}
      else if(method==='document_open'){const text=await readFile(join(directory,params.fileId),'utf8');result={mode:'editor',text,simplified:false,meta:{documentId:params.fileId,file:{fileId:params.fileId,projectId:'A',displayPath:params.fileId},editorRevision:0,baseDiskRevision:{token:'base',contentHash:'base',byteLength:String(text.length),modifiedAt:'2026-11-15'},encoding:'utf8',eol:'lf',state:'clean',readOnly:false}};}
      else if(method==='language_server_resolve')result={fileId:basename(fileURLToPath(params.uri)),projectId:'A',displayPath:basename(fileURLToPath(params.uri))};
      else if(method==='language_server_document')result={fileUri:pathToFileURL(join(directory,params.fileId)).toString(),languageId:'typescript'};
      else if(method==='document_checkpoint')result={checkpointId:'checkpoint',editorRevision:params.editorRevision};
      response.setHeader('Content-Type','application/json');response.end(JSON.stringify(result));
    }catch(error){response.end(JSON.stringify({error:error.message}));}return;
  }
  response.setHeader('Content-Type','text/html');response.end('<!doctype html><div id="root" style="height:600px"></div><script type="module" src="/fixture.js"></script>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>Boolean(window.realHarness));
  await page.evaluate(()=>window.realHarness.start());await page.waitForSelector('.cm-editor');
  await page.waitForFunction(()=>window.realHarness.view());
  await page.evaluate(text=>window.realHarness.edit(text),edited);
  await page.evaluate(()=>window.realHarness.open('main.ts'));
  await page.waitForFunction(()=>window.realHarness.inspect().active==='main.ts');
  await page.waitForTimeout(150);
  await page.evaluate(()=>window.realHarness.jump());
  await page.waitForTimeout(300);
  const state=await page.evaluate(()=>window.realHarness.inspect());
  assert.equal(state.active,'lib.ts','unsaved overlay definition must resolve to lib.ts');
  assert.equal(await readFile(join(directory,'lib.ts'),'utf8'),disk,'navigation does not save the overlay');
  await page.evaluate(()=>window.realHarness.open('main.ts'));await page.waitForFunction(()=>window.realHarness.inspect().active==='main.ts');
  await page.evaluate(()=>window.realHarness.restart());await page.waitForTimeout(100);
  await page.evaluate(()=>window.realHarness.jump());await page.waitForTimeout(300);
  const restarted=await page.evaluate(()=>window.realHarness.inspect());
  if(process.env.HORIZON_TEST_LSP_TRACE)console.log(JSON.stringify({state,restarted,sent:sent.filter(message=>['initialize','textDocument/didOpen','textDocument/didChange','textDocument/didClose','textDocument/definition'].includes(message.method)),definitions:received.filter(message=>message.result&&JSON.stringify(message.result).includes('targetUri')),errors},null,2));
  assert.equal(restarted.active,'lib.ts','a restarted server must recover other unsaved buffers');
  assert.equal(state.selection.anchor,edited.indexOf('unsaved'),'first jump uses UTF-16 coordinates');
  assert.equal(restarted.selection.anchor,edited.indexOf('unsaved'),'reconnected jump uses the unsaved definition location');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,phases:2,initializations:sent.filter(message=>message.method==='initialize').length,diskUnchanged:true}));
}finally{await browser.close();for(const stream of streams)stream.end();for(const process of children)process.kill();await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
