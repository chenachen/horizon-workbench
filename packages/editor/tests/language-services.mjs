import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Real CodeMirror + official LSP client; the native pipe is a deterministic
// fixture. Native framing/process ownership is covered by the Rust tests.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const source = String.raw`
import { EditorState, Text, ChangeSet } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { EditorStore } from './packages/editor/src/store.ts';
import { semanticExtension, getDefinitions, releaseLanguageServices } from './apps/desktop/src/features/editor/languageService.ts';
const states = [
  { id:'language.typescript', installState:'installed', effectiveEnabled:true, effectivePaused:false, runState:'active', revision:1, installedVersion:'1', manifest:{contributes:{languages:[{id:'typescript',extensions:['.ts']}]}} },
  { id:'semantic.typescript', installState:'installed', effectiveEnabled:true, effectivePaused:false, runState:'stopped', revision:1, installedVersion:'1', manifest:{contributes:{languageServers:[{id:'typescript',languageIds:['typescript'],command:'fixture'}]}} }
];
const listeners = new Set(), files = new Map(), sent = [], sessions = [];
const disk = { token:'base',contentHash:'base',byteLength:'3000',modifiedAt:'2026-11-15' };
const turns = async () => { for(let i=0;i<20;i++)await Promise.resolve(); };
let session, sequence=0, view, held=[],writeLocked=false,queuedConnects=[],connectAttempts=0;
const uri = id => 'file:///project/' + id;
const publish = () => { for(const listener of listeners)listener(); };
function offset(text, position) {
  const lines=text.split('\n'); let from=0;
  for(let i=0;i<position.line;i++)from+=lines[i].length+1;
  return from+position.character;
}
function reply(channel, id, result) { queueMicrotask(()=>channel.onmessage({type:'message',message:JSON.stringify({jsonrpc:'2.0',id,result})})); }
async function nativeCall(method, params={}, projectId) {
  if(method==='document_open')return {mode:'editor',text:files.get(params.fileId),simplified:false,meta:{documentId:params.fileId,file:{fileId:params.fileId,projectId,displayPath:params.fileId},editorRevision:0,baseDiskRevision:disk,encoding:'utf8',eol:'lf',state:'clean',readOnly:false}};
  if(method==='language_server_send') {
    const current=sessions.find(s=>s.id===params.sessionId); if(!current||current.closed)throw new Error('Session closed');
    const message=JSON.parse(params.message);sent.push({sessionId:current.id,...message});
    if(message.method==='initialize'){
      if(window.__languageNative.delayedWake){
        const revision=window.__languageNative.wakeRevision;
        publish(); // An unrelated extension event republishes the cached sleeping snapshot.
        setTimeout(()=>{states[1].runState='active';states[1].revision=revision;publish();},20);
        window.__languageNative.delayedWake=false;
      }
      const answer=()=>reply(current.channel,message.id,{capabilities:{definitionProvider:true,textDocumentSync:2,positionEncoding:'utf-16'}});
      if(window.__languageNative.holdInitialization)window.__languageNative.initializationReply=answer;else answer();
    }
    else if(message.method==='textDocument/didOpen')current.docs.set(message.params.textDocument.uri,message.params.textDocument.text);
    else if(message.method==='textDocument/didChange') {
      const key=message.params.textDocument.uri;
      let text=current.docs.get(key);
      for(const change of message.params.contentChanges)text=change.range?text.slice(0,offset(text,change.range.start))+change.text+text.slice(offset(text,change.range.end)):change.text;
      current.docs.set(key,text);
    } else if(message.method==='textDocument/definition') {
      const target=message.params.textDocument.uri.endsWith('main.ts')?'lib.ts':'main.ts';
      const answer=()=>reply(current.channel,message.id,[{uri:uri(target),range:{start:{line:1,character:4},end:{line:1,character:9}}},{targetUri:uri('other.ts'),targetRange:{start:{line:0,character:0},end:{line:0,character:6}},targetSelectionRange:{start:{line:0,character:1},end:{line:0,character:4}}}]);
      if(window.languageHarness.hold)held.push(answer);else answer();
    }
    return {};
  }
  if(method==='language_server_stop') {
    const current=sessions.find(s=>s.id===params.sessionId);
    if(current&&!current.closed){current.closed=true;queueMicrotask(()=>current.channel.onmessage({type:'closed'}));}
    return {};
  }
  if(method==='language_server_document')return {fileUri:uri(params.fileId),languageId:'typescript'};
  return {};
}
async function connect(call, channel) {
  connectAttempts++;
  if(writeLocked)await new Promise(resolve=>queuedConnects.push(resolve));
  if(window.__languageNative.staleOnce){window.__languageNative.staleOnce=false;return{ok:false,requestId:call.requestId,error:{code:'STALE_VERSION',message:'fixture lifecycle revision changed'}};}
  const semantic=states[1];if(!semantic.effectiveEnabled)throw new Error('Disabled');
  if(call.params.expectedRevision!==semantic.revision)throw new Error('STALE_VERSION');
  if(!session||session.closed){session={id:'session-'+(++sequence),channel,docs:new Map(),closed:false};sessions.push(session);}
  let revision=semantic.revision;
  if(semantic.runState!=='active'){
    revision++;
    if(window.__languageNative.delayWakeSnapshot){window.__languageNative.delayWakeSnapshot=false;window.__languageNative.delayedWake=true;window.__languageNative.wakeRevision=revision;}
    else{semantic.runState='active';semantic.revision=revision;queueMicrotask(publish);}
  }
  const result={ok:true,requestId:call.requestId,data:{sessionId:session.id,serverId:'typescript',extensionId:'semantic.typescript',rootUri:'file:///project',fileUri:uri(call.params.fileId),languageId:'typescript',revision}};
  if(window.__languageNative.holdFirstReply&&session.channel===channel){window.__languageNative.holdFirstReply=false;return new Promise(resolve=>window.__languageNative.firstReply=()=>resolve(result));}
  return result;
}
const store=new EditorStore({call:nativeCall});
window.__languageNative={call:nativeCall,connect,store,states,listeners,refreshes:0};
function stateFor(buffer) {
  const state=EditorState.create({doc:buffer.getText(),extensions:[semanticExtension(buffer),EditorView.updateListener.of(update=>{
    if(update.docChanged){const doc=update.state.doc;store.edited(buffer.projectId,buffer.fileId,()=>doc.toString(),{anchor:update.state.selection.main.anchor,head:update.state.selection.main.head},doc,update.changes);}
  })]});
  buffer.contentIdentity=state.doc;return state;
}
window.languageHarness={store,sent,sessions,hold:false,
  async start(){for(const id of ['main.ts','lib.ts','other.ts'])files.set(id,'// '+id+'\n'+'let value = 1;\n'.repeat(150));store.setProject('A',1);await this.open('main.ts');},
  async open(id){const buffer=await store.openFile(id,{projectId:'A'});if(!view)view=new EditorView({parent:document.getElementById('root'),state:stateFor(buffer)});else view.setState(stateFor(buffer));await turns();},
  definitions(){return getDefinitions(view,3);},
  edit(id,text){const buffer=store.getBuffer('A',id),doc=buffer.contentIdentity instanceof Text?buffer.contentIdentity:Text.of(buffer.getText().split('\n'));const changes=ChangeSet.of({from:0,insert:text},doc.length),next=changes.apply(doc);store.edited('A',id,()=>next.toString(),buffer.selection,next,changes);},
  setRunState(runState){states[1].runState=runState;states[1].revision++;publish();},
  async sleepTransition(){
    const before=connectAttempts;writeLocked=true;
    await nativeCall('language_server_stop',{sessionId:session.id});await turns();
    states[1].runState='stopped';states[1].revision++;publish();await turns();
    const queued=queuedConnects.length;
    states[1].runState='sleeping';states[1].revision++;publish();await turns();
    writeLocked=false;for(const resolve of queuedConnects.splice(0))resolve();await turns();
    return{queued,attempts:connectAttempts-before};
  },
  enabled(value){states[1].effectiveEnabled=value;states[1].runState='stopped';states[1].revision++;publish();},
  release(){this.hold=false;for(const answer of held.splice(0))answer();},
  inspect(){return{initializes:sent.filter(m=>m.method==='initialize').length,live:sessions.filter(s=>!s.closed).length,sessions:sessions.length,docs:session?[...session.docs]:[],changes:sent.filter(m=>m.method==='textDocument/didChange'),closes:sent.filter(m=>m.method==='textDocument/didClose').length,held:held.length};},
  dispose(){view?.destroy();releaseLanguageServices('A');}
};
`;
const bundled = await build({
  stdin: { resolveDir: repository, contents: source }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', write: false,
  plugins: [{ name: 'native-fixture', setup(builder) {
    builder.onResolve({ filter: /^@tauri-apps\/api\/core$/ }, () => ({ path: 'tauri', namespace: 'fixture' }));
    builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$/ }, args => args.importer.endsWith('/languageService.ts') ? { path: 'bridge', namespace: 'fixture' } : null);
    builder.onResolve({ filter: /^\.\.\/plugins\/service$/ }, args => args.importer.endsWith('/languageService.ts') ? { path: 'plugins', namespace: 'fixture' } : null);
    builder.onResolve({ filter: /^\.\/store$/ }, args => args.importer.endsWith('/languageService.ts') ? { path: 'store', namespace: 'fixture' } : null);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: {
      tauri: `export class Channel {onmessage=()=>{}}; export const invoke=(_method,{call,channel})=>window.__languageNative.connect(call,channel);`,
      bridge: `export const nativeAvailable=()=>true;export const getProjectEpoch=()=>1;export const call=(...args)=>window.__languageNative.call(...args);`,
      plugins: `export const pluginRuntime={getSnapshot:()=>window.__languageNative.states,subscribe:fn=>{queueMicrotask(()=>window.__languageNative.listeners.add(fn));return()=>window.__languageNative.listeners.delete(fn)}};export const refreshPlugins=async()=>{window.__languageNative.refreshes++};`,
      store: `export const editorStore=new Proxy({}, {get:(_target,key)=>String(key).startsWith('subscribe')?(...args)=>{queueMicrotask(()=>window.__languageNative.store[key](...args));return()=>{}}:(...args)=>window.__languageNative.store[key](...args)});`,
    }[args.path], loader: 'js' }));
  } }],
});
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(bundled.outputFiles[0].contents); }
  else { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><div id="root"></div><script type="module" src="/fixture.js"></script>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
let phases = 0;
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => Boolean(window.languageHarness));
  await page.evaluate(() => {window.__languageNative.holdFirstReply=true;return window.languageHarness.start();});
  await page.waitForFunction(()=>Boolean(window.__languageNative.firstReply));
  await page.evaluate(()=>{window.languageHarness.store.getBuffer('A','main.ts').path='relocated-main.ts';return window.languageHarness.open('lib.ts');});
  await page.waitForFunction(() => window.languageHarness.inspect().initializes === 1);
  await page.evaluate(()=>window.__languageNative.firstReply());
  const coldDefinition=await page.evaluate(()=>Promise.race([window.languageHarness.definitions().then(targets=>({count:targets.length})),new Promise(resolve=>setTimeout(()=>resolve({timeout:true}),500))]));
  assert.equal(coldDefinition.count,2,'the first native channel must forward early initialize responses even when its original buffer binding was invalidated');
  assert.equal((await page.evaluate(() => window.languageHarness.definitions())).length, 2); phases++;
  const warmRefreshes=await page.evaluate(()=>window.__languageNative.refreshes);
  assert.equal((await page.evaluate(() => window.languageHarness.definitions())).length,2);
  assert.equal(await page.evaluate(()=>window.__languageNative.refreshes),warmRefreshes,'warm F12 must not refresh the entire extension registry');

  await page.evaluate(() => window.languageHarness.open('lib.ts'));
  await page.waitForFunction(() => window.languageHarness.inspect().docs.length === 2);
  assert.equal(await page.evaluate(() => window.languageHarness.inspect().initializes), 1, 'two files share one LSP client initialization');
  assert.equal(await page.evaluate(() => window.languageHarness.inspect().closes), 0, 'tab switch retains open document'); phases++;

  await page.evaluate(() => window.languageHarness.edit('main.ts', '// 😀 unsaved background\n'));
  await page.waitForFunction(() => window.languageHarness.inspect().changes.length > 0);
  const update = await page.evaluate(() => window.languageHarness.inspect());
  assert.ok(update.docs.find(([uri]) => uri.endsWith('main.ts'))[1].startsWith('// 😀 unsaved background'));
  assert.ok(update.changes.at(-1).params.contentChanges.every(change => change.range), 'background file sends deltas'); phases++;

  await page.evaluate(() => { const h=window.languageHarness;h.hold=true;window.pendingDefinition=h.definitions().then(()=> 'unexpected success',error=>error.message); });
  await page.waitForFunction(() => window.languageHarness.inspect().held === 1);
  await page.evaluate(() => {window.languageHarness.edit('main.ts','// target moved\n');window.languageHarness.release();});
  assert.match(await page.evaluate(() => window.pendingDefinition), /重新跳转/, 'target edit invalidates pending locations'); phases++;

  const sleepTransition=await page.evaluate(() => window.languageHarness.sleepTransition());
  assert.equal(sleepTransition.queued,0,'intermediate stopped notification must not enqueue a new connect behind the native stop lock');
  assert.equal(sleepTransition.attempts,0,'runtime notifications alone must not start another client');
  await page.waitForFunction(() => window.languageHarness.inspect().live === 0);
  const sleepingInitializes = await page.evaluate(() => window.languageHarness.inspect().initializes);
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => window.languageHarness.inspect().initializes), sleepingInitializes, 'sleep does not immediately restart itself');
  const wakeRefreshes=await page.evaluate(()=>{window.__languageNative.staleOnce=true;window.__languageNative.delayWakeSnapshot=true;return window.__languageNative.refreshes;});
  assert.equal((await page.evaluate(() => window.languageHarness.definitions())).length, 2);
  assert.equal(await page.evaluate(()=>window.__languageNative.refreshes),wakeRefreshes+2,'cold wake refreshes once and retries a stale lifecycle revision once');
  assert.equal(await page.evaluate(() => window.languageHarness.inspect().initializes), sleepingInitializes + 1, 'explicit navigation wakes sleeping plugin'); phases++;

  await page.evaluate(() => window.languageHarness.enabled(false));
  await page.waitForFunction(() => window.languageHarness.inspect().live === 0);
  await page.evaluate(() => {window.__languageNative.holdInitialization=true;window.languageHarness.enabled(true);});
  await page.waitForFunction(() => window.languageHarness.inspect().live === 1);
  await page.waitForFunction(()=>Boolean(window.__languageNative.initializationReply));
  await page.evaluate(()=>{window.initializingDefinition=window.languageHarness.definitions().then(()=> 'unexpected success',error=>error.message);});
  await page.evaluate(()=>window.languageHarness.setRunState('sleeping'));
  await page.waitForFunction(()=>window.languageHarness.inspect().live===0);
  assert.match(await page.evaluate(()=>window.initializingDefinition),/停用|休眠|变化/,'a newer real sleep must close a session even before initialization finishes');
  await page.evaluate(()=>{window.__languageNative.holdInitialization=false;window.__languageNative.initializationReply();});
  phases++;
  assert.equal((await page.evaluate(() => window.languageHarness.definitions())).length, 2); phases++;

  await page.evaluate(() => window.languageHarness.dispose());
  await page.waitForFunction(() => window.languageHarness.inspect().live === 0);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, phases }));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
