import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
const root = await mkdtemp(path.join(tmpdir(), 'horizon-pi-rpc-'));
const binary = process.env.HORIZON_PI_BINARY || '/tmp/horizon-pi/pi/pi';
const log = path.join(root, 'requests.jsonl');
const fixture = spawn(process.execPath, ['scripts/test-pi-server.mjs'], { env: { ...process.env, HORIZON_TEST_LOG: log }, stdio: ['ignore', 'pipe', 'inherit'] });
const [serverLine] = await Promise.race([new Promise(resolve => fixture.stdout.once('data', b => resolve(b.toString().trim().split('\n')))), new Promise((_, reject) => setTimeout(() => reject(new Error('fixture timeout')), 10_000))]);
const { port } = JSON.parse(serverLine);
const config = path.join(root, 'agent'); await mkdir(config);
await writeFile(path.join(root, 'AGENTS.md'), 'UNSELECTED_PROJECT_CONTEXT_MUST_NOT_LEAVE_DEVICE');
await mkdir(path.join(root, '.pi', 'extensions'), { recursive: true });
await writeFile(path.join(root, '.pi', 'extensions', 'unsafe.ts'), "import { writeFileSync } from 'node:fs'; writeFileSync('automatic-extension-was-loaded', 'bad'); export default function(){}");
await writeFile(path.join(config, 'models.json'), JSON.stringify({ providers: { horizon: { baseUrl: `http://127.0.0.1:${port}/v1`, api: 'openai-completions', apiKey: 'fixture-only', models: [{ id: 'horizon-fixture', reasoning: false, input: ['text'], contextWindow: 32768, maxTokens: 4096 }] } } }));
await writeFile(path.join(config, 'settings.json'), JSON.stringify({ retry: { enabled: false }, cacheWarming: { enabled: false } }));
const flags = ['--mode','rpc','--provider','horizon','--model','horizon-fixture','--thinking','off','--no-tools','--no-extensions','--no-mcp','--no-skills','--no-prompt-templates','--no-themes','--no-context-files','--no-approve','--offline'];
const results=[];
async function run(label, prompt, session, cancel=false) {
  const child=spawn(binary,[...flags,'--session',session],{cwd:root,env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,PI_CODING_AGENT_DIR:config,PI_OFFLINE:'1',PI_TELEMETRY:'0'},stdio:['pipe','pipe','pipe']});
  const events=[];let errors='';child.stderr.on('data',b=>errors+=b);
  const start=Date.now();let settled=false;let aborted=false;
  const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  const finished = new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error(`${label}: timeout ${errors.slice(0,500)}`));},20_000);
    createInterface({input:child.stdout}).on('line',line=>{
      let v;try{v=JSON.parse(line);}catch{clearTimeout(timer);reject(new Error('invalid JSONL '+line));return;}events.push(v);
      if(v.type==='response'&&v.id==='ready')child.stdin.write(JSON.stringify({id:'submission',type:'prompt',message:prompt})+'\n');
      if(cancel&&!aborted&&v.type==='message_update'){aborted=true;child.stdin.write(JSON.stringify({id:'clear',type:'clear_queue'})+'\n'+JSON.stringify({id:'abort',type:'abort'})+'\n');}
      if(v.type==='agent_settled'){settled=true;clearTimeout(timer);child.stdin.end();resolve(v);}
    });child.once('exit',code=>{if(!settled){clearTimeout(timer);reject(new Error(`${label}: early exit ${code} ${errors.slice(0,500)}`));}});
  });
  child.stdin.write(JSON.stringify({id:'ready',type:'get_state'})+'\n');
  const terminal=await finished;const status=await exit;
  assert.equal(status.code,0);assert(events.some(v=>v.type==='response'&&v.id==='submission'&&v.data?.disposition==='started'));
  const final=events.filter(v=>v.type==='message_end'&&v.message?.role==='assistant').at(-1)?.message;
  results.push({label,eventTypes:[...new Set(events.map(v=>v.type))],terminal,stopReason:final?.stopReason,elapsedMs:Date.now()-start});
  return {events,final,terminal};
}
try{
 const session=path.join(root,'session.jsonl');
 const first=await run('chat no tools','HORIZON_TEST_WRITE: This is a fixture. Do not perform project actions.',session);
 assert.equal(first.final.stopReason,'stop');
 const second=await run('resume without replay','HORIZON_TEST_RESUME',session);
 assert(second.final.content.some(c=>c.text?.includes('Prior user turns: 2')));
 const cancellation=await run('clear queue then abort','HORIZON_TEST_CANCEL',path.join(root,'cancel.jsonl'),true);
 assert.equal(cancellation.terminal.aborted,true);
 const long=await run('long Unicode response','HORIZON_TEST_LONG_MESSAGE',path.join(root,'long.jsonl'));
 const expectedLong='长消息分页🙂\n'.repeat(16384);
 const longFinal=long.final.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
 const longStream=long.events.filter(e=>e.type==='message_update'&&e.assistantMessageEvent?.type==='text_delta').map(e=>e.assistantMessageEvent.delta).join('');
 assert.equal(longFinal,expectedLong);assert.equal(longStream,expectedLong);
 results.push({label:'long Unicode response integrity',utf8Bytes:Buffer.byteLength(longFinal),sha256:createHash('sha256').update(longFinal).digest('hex'),streamMatchesFinal:true});
 const failure=await run('provider authentication failure','HORIZON_TEST_AUTH_FAILURE',path.join(root,'error.jsonl'));
 assert.equal(failure.final.stopReason,'error');
 const requests=(await readFile(log,'utf8')).trim().split('\n').map(JSON.parse);
 assert(requests.every(r=>!r.body.tools?.length));
 assert(requests.every(r=>!JSON.stringify(r.body).includes('UNSELECTED_PROJECT_CONTEXT_MUST_NOT_LEAVE_DEVICE')));
 await assert.rejects(readFile(path.join(root, 'automatic-extension-was-loaded')));
 results.push({label:'chat tools disabled',requests:requests.length,noTools:true,noAutomaticContext:true,noAutomaticExtensions:true});
 await mkdir('research/verification',{recursive:true});
 await writeFile('research/verification/pi-rpc.json',JSON.stringify({date:new Date().toISOString(),platform:process.platform,arch:process.arch,binary,version:'1.4.0',modelService:'controlled local OpenAI protocol fixture; no real provider credentials',results},null,2)+'\n');
 console.log(JSON.stringify(results,null,2));
}finally{fixture.kill();await rm(root,{recursive:true,force:true});}
