/** Official Pi process measurement. This is not an app/WebView combined benchmark. */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, appendFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
if (!['linux', 'darwin'].includes(process.platform)) throw new Error('Pi resource sampling supports Linux and macOS only');
const binary = process.env.HORIZON_PI_BINARY || '/tmp/horizon-pi/pi/pi';
const root = await mkdtemp(path.join(tmpdir(), 'horizon-pi-resource-'));
const output = path.resolve(`research/verification/pi-resource-${Date.now()}`);
let fixture, child; const timers = [];
try {
fixture = spawn(process.execPath, ['scripts/test-pi-server.mjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
const firstLine = await new Promise((resolve,reject) => { const timer=setTimeout(()=>reject(new Error('Fixture readiness timeout')),10000); fixture.once('error',reject); fixture.stdout.once('data',chunk=>{clearTimeout(timer);resolve(chunk.toString().trim().split('\n')[0]);}); });
const { port } = JSON.parse(firstLine);
const config = path.join(root, 'config'); await mkdir(config);
await writeFile(path.join(config, 'models.json'), JSON.stringify({ providers: { horizon: { baseUrl: `http://127.0.0.1:${port}/v1`, api: 'openai-completions', apiKey: 'fixture-only', models: [{ id: 'horizon-fixture', reasoning: false, input: ['text'], contextWindow: 32768, maxTokens: 4096 }] } } }));
const flags = ['--mode','rpc','--provider','horizon','--model','horizon-fixture','--thinking','off','--no-session','--no-tools','--no-extensions','--no-mcp','--no-skills','--no-prompt-templates','--no-themes','--no-context-files','--no-approve','--offline'];
child = spawn(binary, flags, { cwd: root, env: { PATH:'/usr/bin:/bin', HOME:root, PI_CODING_AGENT_DIR:config, PI_OFFLINE:'1', PI_TELEMETRY:'0' }, stdio:['pipe','pipe','pipe'], detached:true });
const exited = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal })));
child.on('error',error=>console.error('Pi startup failed:',error.message));
const lines = createInterface({ input: child.stdout });
await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('Pi readiness timed out')), 10_000); lines.on('line', line => { const event = JSON.parse(line); if (event.id === 'ready') { clearTimeout(timeout); resolve(event); } }); child.stdin.write(JSON.stringify({ id:'ready', type:'get_state' })+'\n'); });
const members=path.join(root,'members.json'), phase=path.join(root,'phase.txt'), actions=path.join(root,'actions.jsonl');
await writeFile(members, JSON.stringify({ [child.pid]: { group:'pi', reason:'explicit official Pi 1.4.0 protocol fixture instance' } }));
await writeFile(phase,'idle_before_request'); await writeFile(actions,'');
const action = async (name, value) => { await writeFile(phase,name); await appendFile(actions,JSON.stringify({at:new Date().toISOString(),action:name,source:'real Pi stdio driver; not GUI'})+'\n'); if(value) child.stdin.write(JSON.stringify(value)+'\n'); };
timers.push(setTimeout(() => void action('streaming_fixture', {id:'stream',type:'prompt',message:'HORIZON_TEST_CANCEL resource sample'}),15_000),setTimeout(() => { child.stdin.write(JSON.stringify({id:'clear',type:'clear_queue'})+'\n'); void action('aborting_fixture',{id:'abort',type:'abort'}); },40_000));
lines.on('line',line=>{const event=JSON.parse(line);if(event.type==='agent_settled')void action('idle_after_settled');});
  const sampler=spawn('python3',[process.platform === 'linux' ? 'scripts/desktop/sample_linux.py' : 'scripts/desktop/sample_macos.py','--pid',String(child.pid),'--output',output,'--scenario','standalone official Pi chat: idle / controlled local streaming / abort / idle; app and fixture excluded','--build','release','--build-id',`official Pi 1.4.0 ${process.platform}-${process.arch}; see pi-fixture-asset.json for verified archive`,'--members',members,'--phase-file',phase,'--activity-log',actions,'--duration','75','--interval','1'],{stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{sampler.once('error',reject);sampler.on('exit',resolve);});if(code!==0)throw new Error(`sampler failed ${code}`);
  child.stdin.end();const shutdown=await Promise.race([exited,new Promise(resolve=>setTimeout(()=>resolve(null),3000))]);if(!shutdown){process.kill(-child.pid,'SIGKILL');throw new Error('Pi did not exit orderly');}
  await writeFile(path.join(output,'driver.json'),JSON.stringify({binary,flags,fixture:'controlled local OpenAI protocol service',limits:'Standalone runtime only; excludes Horizon/WebView and fixture. Horizon adapter exits at settlement rather than retaining this idle process.',shutdown,finishedAt:new Date().toISOString()},null,2)+'\n');
  console.log(output);
} finally { timers.forEach(clearTimeout); fixture?.kill('SIGKILL'); if(child && child.exitCode===null){try{process.kill(-child.pid,'SIGKILL');}catch{child.kill('SIGKILL');}} await rm(root,{recursive:true,force:true}); }
