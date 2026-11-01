import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Reuses the existing agent-connections-refresh actual-component harness route.
// AgentPanel, agent store, and bridge remain production code. Only Tauri replies
// and unrelated appearance context are controlled; no native app/provider calls.
const repository = '/Users/chenpengxiang/Desktop/Horizon';
const directory = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(directory, 'source-sha.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const source of metadata.sources) assert.equal(sha(await readFile(path.join(repository, source.path))), source.sha256);
const report = { kind: 'real AgentPanel + store + bridge; controlled context_prepare rejection and transcript completion', startedAt: new Date().toISOString(), sources: metadata.sources, scenarios: [], passed: false };
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {AgentPanel} from './apps/desktop/src/features/agent/AgentPanel.tsx';
import {agentView} from './apps/desktop/src/features/agent/store.ts';
const kind=window.scenarioKind, projectId='owned-harness-project';
const session=id=>({sessionId:id,projectId,connectionId:'owned-connection',profile:'task',state:'dormant',instanceId:null,instanceEpoch:0,resumeAvailable:true,reviewId:null});
const old=session('current-empty'), target=session('target-history');
const h=window.agentRecoveryHarness={kind,projectId,calls:[],sessions:[],pending:null,active:null,seq:0,hold:kind==='late'||kind==='draft-edit',
 connection:{connectionId:'owned-connection',adapterId:'pi',revision:1,authState:'verified',authOwner:'external',runtime:{source:'managed',version:'1.4.0'},provider:{id:'fixture',api:'openai-completions',model:'fixture',endpoint:'http://127.0.0.1:1/v1',label:'Owned fixture'}},
 attachments:[{key:'git',label:'example.txt · 暂存区 → 磁盘文件',source:'gitDiff',fileId:'owned-example',diffId:'a'.repeat(64),expectedRepoToken:'b'.repeat(64),byteLength:100},{key:'buffer',label:'context.ts',source:'buffer',fileId:'owned-context',documentId:'owned-document',editorRevision:1,text:'owned text',byteLength:10}],
 setup(){
  const existing=['existing','cancel','late','draft-edit','restore','explicit','no-draft'].includes(kind);
  h.sessions=existing?[old]:[];if(kind==='explicit')h.sessions.push(target);
  const message={messageId:'retained',role:'assistant',text:'保留既有消息',state:'stop'};
  agentView.patch(projectId,{initialized:kind!=='restore',connections:[h.connection],connectionId:h.connection.connectionId,profile:'task',session:kind==='restore'?null:existing?old:null,sessions:[...h.sessions],draft:kind==='no-draft'?'':'保留待发送任务',attachments:h.attachments,messages:['explicit','no-draft'].includes(kind)?[message]:[],status:['explicit','no-draft'].includes(kind)?'failed':'idle',error:['explicit','no-draft'].includes(kind)?'差异缓存已过期，请重新打开差异':null});
 },
 reply(call,data){return {ok:true,requestId:call.requestId,data};},
 fail(call,code,message){return {ok:false,requestId:call.requestId,error:{code,message,retryable:true}};},
 transcript(id){return {items:(kind==='restore'||id==='target-history')?[{messageId:'history',role:'assistant',text:'恢复的历史消息',state:'stop'}]:[],nextCursor:null};},
 invoke(command,{call,channel}){
  h.calls.push({command,method:call.method,params:structuredClone(call.params),requestId:call.requestId});let data;
  switch(call.method){
   case 'agent_connections_list':data={items:[structuredClone(h.connection)]};break;
   case 'agent_sessions_list':data={items:structuredClone(h.sessions)};break;
   case 'agent_preferences_get':data={effectiveConnectionId:'owned-connection'};break;
   case 'agent_session_create':{const created=session('created-'+kind);h.sessions.push(created);data=structuredClone(created);break;}
   case 'agent_context_prepare':
    if(['fresh','existing','cancel','auth'].includes(kind)){h.hold=true;if(kind==='auth')h.connection.authState='needsAuthentication';return Promise.resolve(h.fail(call,kind==='cancel'?'CANCELLED':kind==='auth'?'AUTH_REQUIRED':'STALE_CURSOR',kind==='cancel'?'操作已取消':kind==='auth'?'401 controlled authentication':'差异缓存已过期，请重新打开差异'));}
    data={snapshotId:'owned-snapshot',manifestDigest:'owned-manifest'};break;
   case 'agent_transcript_read':
    if(h.hold)return new Promise(resolve=>{h.pending={call,resolve};});
    data=h.transcript(call.params.sessionId);break;
   case 'agent_submit':{
    if(command!=='horizon_start')throw Error('Expected real bridge task start');h.active={call,channel};h.seq=0;
    setTimeout(()=>h.emit({type:'data',kind:'agent.event',data:{payload:{type:'runStarted'}}}),0);
    data={taskId:'owned-task',requestId:call.requestId,state:'queued',cancelMode:'cooperative'};break;
   }
   case 'stream_ack':data={acknowledged:true};break;
   default:throw Error('Unexpected controlled RPC '+call.method);
  }
  return Promise.resolve(h.reply(call,data));
 },
 release(){const pending=h.pending;if(!pending)throw Error('No held transcript');h.pending=null;h.hold=false;pending.resolve(h.reply(pending.call,kind==='late'||kind==='draft-edit'?{items:[{messageId:'stale',role:'assistant',text:kind==='draft-edit'?'恢复的历史消息':'不应覆盖新发送的旧历史',state:'stop'}],nextCursor:null}:h.transcript(pending.call.params.sessionId)));},
 emit(payload){if(!h.active)throw Error('No task');const {call,channel}=h.active;channel.onmessage({protocolVersion:1,event:'horizon.task.v1',taskId:'owned-task',requestId:call.requestId,scope:call.scope,seq:++h.seq,payload});},
 finish(){h.emit({type:'data',kind:'agent.event',data:{payload:{type:'messageFinal',messageId:'owned-final',text:'正常完成的组件回复',stopReason:'stop'}}});h.emit({type:'terminal',state:'succeeded',result:{sessionId:h.sessions.at(-1).sessionId,state:'succeeded',text:'正常完成的组件回复',reviewId:null,disposition:'started',runId:h.active.call.requestId}});},
 capture(){const v=agentView.get(projectId),card=document.querySelector('.agent-error-card');return {status:v.status,error:v.error,draft:v.draft,attachments:structuredClone(v.attachments),messages:structuredClone(v.messages),sessionId:v.session?.sessionId,taskId:v.task?.taskId,loading:v.loading,uiText:document.body.innerText,errorParagraph:card?.querySelector('p')?.textContent||'',errorTitle:card?.querySelector('strong')?.textContent||'',detailsOpen:card?.querySelector('details')?.open||false,submitCount:h.calls.filter(c=>c.method==='agent_submit').length,contextCount:h.calls.filter(c=>c.method==='agent_context_prepare').length,sessionCreates:h.calls.filter(c=>c.method==='agent_session_create').length,calls:structuredClone(h.calls)};}
};h.setup();createRoot(document.getElementById('root')).render(<AgentPanel projectId={projectId} projectName="Owned fixture project"/>);
`;
const appearance = `export const useAppearance=()=>({composing:{current:false}});export const useSettings=()=>({settings:{effective:{},sources:{}}});`;
async function bundle(variant) {
  const store = await readFile(path.join(directory, variant, 'apps/desktop/src/features/agent/store.ts'), 'utf8');
  const panel = await readFile(path.join(directory, variant, 'apps/desktop/src/features/agent/AgentPanel.tsx'), 'utf8');
  const result = await build({ stdin: { contents: entry, resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, outfile: variant + '.js', jsx: 'automatic', format: 'iife', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'existing-controlled-tauri-pattern', setup(builder) {
    builder.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, args => ({ path: args.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
    builder.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, args => ({ contents: args.path === 'core' ? `export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.agentRecoveryHarness.invoke(...args);` : `export const listen=async()=>()=>{};`, loader: 'js' }));
    builder.onLoad({ filter: /\/features\/settings\/AppearanceProvider\.tsx$/ }, () => ({ contents: appearance, loader: 'js' }));
    builder.onLoad({ filter: /\/features\/agent\/store\.ts$/ }, () => ({ contents: store, loader: 'ts', resolveDir: path.join(repository, 'apps/desktop/src/features/agent') }));
    builder.onLoad({ filter: /\/features\/agent\/AgentPanel\.tsx$/ }, () => ({ contents: panel, loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/features/agent') }));
  } }] });
  return { js: result.outputFiles.find(file => file.path.endsWith('.js')).text, css: result.outputFiles.find(file => file.path.endsWith('.css'))?.text || '', warnings: result.warnings.map(w => w.text), storeSha256: sha(store), panelSha256: sha(panel) };
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const variant of ['before', 'after']) {
    const asset = await bundle(variant);
    for (const kind of ['fresh', 'existing', 'cancel', 'late', 'draft-edit', 'normal', 'restore', 'explicit', 'auth', 'no-draft']) {
      const scenario = { variant, kind, storeSha256: asset.storeSha256, panelSha256: asset.panelSha256, bundleSha256: sha(asset.js), warnings: asset.warnings, browserErrors: [], passed: false };
      report.scenarios.push(scenario);
      const page = await browser.newPage(); page.setDefaultTimeout(4000);
      page.on('pageerror', e => scenario.browserErrors.push(e.message));
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const capture = () => page.evaluate(() => window.agentRecoveryHarness.capture());
      try {
        await page.route('http://127.0.0.1:42765/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>' + asset.css + '</style></head><body><div id="root"></div><script>window.scenarioKind=' + JSON.stringify(kind) + '</script><script>' + asset.js + '</script></body></html>' }));
        await page.goto('http://127.0.0.1:42765/');
        await page.locator('.agent-composer textarea').waitFor();
        if (kind === 'late' || kind === 'draft-edit') await page.waitForFunction(() => !!window.agentRecoveryHarness.pending);
        else { await page.waitForFunction(() => !window.agentRecoveryHarness.capture().loading); await settle(); }
        scenario.initial = await capture();
        if (['fresh', 'existing', 'cancel', 'auth'].includes(kind)) {
          await page.getByRole('button', { name: '发送给 Pi', exact: true }).click();
          await page.waitForFunction(() => !!window.agentRecoveryHarness.pending);
          scenario.beforeTranscript = await capture();
          assert.equal(scenario.beforeTranscript.status, kind === 'cancel' ? 'cancelled' : 'failed');
          if (kind !== 'cancel') {
            assert.equal(scenario.beforeTranscript.detailsOpen, false);
            assert.equal(scenario.beforeTranscript.errorParagraph, kind === 'auth' || variant === 'before' ? '输入与上下文已保留。检查连接后，可以重新发送。' : '输入与上下文已保留。查看错误详情并处理后，可以重新发送。');
          }
          await page.evaluate(() => window.agentRecoveryHarness.release()); await settle();
          scenario.final = await capture();
          assert.equal(scenario.final.status, variant === 'before' ? 'idle' : kind === 'cancel' ? 'cancelled' : 'failed');
          assert.equal(scenario.final.error, variant === 'before' || kind === 'cancel' ? null : kind === 'auth' ? '401 controlled authentication' : '差异缓存已过期，请重新打开差异');
          assert.equal(scenario.final.draft, scenario.initial.draft);
          assert.deepEqual(scenario.final.attachments, scenario.initial.attachments);
          assert.equal(scenario.final.submitCount, 0);
          assert.equal(scenario.final.sessionCreates, kind === 'existing' || kind === 'cancel' ? 0 : 1);
          if (variant === 'after' && kind !== 'cancel') assert.ok(scenario.final.uiText.includes(kind === 'auth' ? '模型连接认证失败' : '这次请求未完成'));
        } else if (kind === 'draft-edit') {
          await page.locator('.agent-composer textarea').fill('历史加载期间的新草稿');
          await page.evaluate(() => window.agentRecoveryHarness.release()); await settle(); scenario.final = await capture();
          assert.equal(scenario.final.status, 'idle'); assert.equal(scenario.final.draft, '历史加载期间的新草稿');
          assert.ok(scenario.final.messages.some(m => m.text === '恢复的历史消息'), 'draft edits must not discard a valid history reply');
          assert.deepEqual(scenario.final.attachments, scenario.initial.attachments); assert.equal(scenario.final.submitCount, 0);
        } else if (kind === 'late' || kind === 'normal') {
          await page.getByRole('button', { name: '发送给 Pi', exact: true }).click();
          await page.waitForFunction(() => window.agentRecoveryHarness.capture().status === 'running');
          scenario.running = await capture();
          if (kind === 'late') {
            await page.evaluate(() => window.agentRecoveryHarness.release()); await settle(); scenario.lateReply = await capture();
            assert.equal(scenario.lateReply.status, variant === 'before' ? 'idle' : 'running');
            assert.equal(scenario.lateReply.messages.some(m => m.text === '不应覆盖新发送的旧历史'), variant === 'before');
            if (variant === 'after') assert.deepEqual(scenario.lateReply.messages, scenario.running.messages);
          }
          await page.evaluate(() => window.agentRecoveryHarness.finish());
          await page.waitForFunction(() => window.agentRecoveryHarness.capture().status === 'succeeded'); await settle(); scenario.final = await capture();
          assert.equal(scenario.final.submitCount, 1); assert.equal(scenario.final.taskId, undefined);
          assert.ok(scenario.final.messages.some(m => m.text === '正常完成的组件回复'));
          if (kind === 'normal' || variant === 'after') assert.ok(scenario.final.messages.some(m => m.role === 'user' && m.text === scenario.initial.draft));
        } else if (kind === 'restore') {
          scenario.final = await capture(); assert.equal(scenario.final.status, 'idle');
          assert.ok(scenario.final.messages.some(m => m.text === '恢复的历史消息'));
          assert.equal(scenario.final.submitCount, 0);
        } else if (kind === 'explicit') {
          await page.getByRole('button', { name: '历史会话', exact: true }).click();
          await page.getByRole('dialog', { name: '项目会话', exact: true }).getByRole('button').filter({ hasText: 'target-h' }).click(); await settle(); scenario.final = await capture();
          assert.equal(scenario.final.sessionId, 'target-history'); assert.equal(scenario.final.error, null); assert.equal(scenario.final.status, 'idle');
          assert.equal(scenario.final.draft, scenario.initial.draft); assert.deepEqual(scenario.final.attachments, scenario.initial.attachments);
        } else {
          scenario.final = await capture(); assert.equal(scenario.final.errorParagraph, variant === 'before' ? '已收到的内容仍在会话中。检查连接后可继续。' : '已收到的内容仍在会话中。查看错误详情并处理后可继续。');
          assert.equal(scenario.final.submitCount, 0);
        }
        assert.deepEqual(scenario.browserErrors, []); scenario.passed = true;
      } finally {
        if (!scenario.passed) scenario.failure = await page.evaluate(() => ({ state: window.agentRecoveryHarness?.capture(), text: document.body.innerText })).catch(e => ({ error: String(e) }));
        await page.close();
      }
    }
  }
  report.passed = true;
} catch (error) { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.sourcesUnchanged = await Promise.all(metadata.sources.map(async source => ({ path: source.path, unchanged: sha(await readFile(path.join(repository, source.path))) === source.sha256 })));
  report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt);
  await writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, scenarios: report.scenarios.map(({ variant, kind, passed }) => ({ variant, kind, passed })), sourcesUnchanged: report.sourcesUnchanged.every(s => s.unchanged), error: report.error, durationMs: report.durationMs, resultPath: path.join(directory, 'result.json') }));
}
