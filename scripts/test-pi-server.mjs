/** Deterministic local OpenAI protocol fixture. Never shipped as a model connection. */
import http from 'node:http';
import { appendFile } from 'node:fs/promises';
const port = Number(process.env.HORIZON_TEST_PORT || 0);
const log = process.env.HORIZON_TEST_LOG;
let requests = 0;
const server = http.createServer(async (req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end(JSON.stringify({ fixture: true, requests })); return; }
  let raw = ''; for await (const chunk of req) raw += chunk;
  let body; try { body = JSON.parse(raw); } catch { res.writeHead(400); res.end('{}'); return; }
  requests++;
  if (log) await appendFile(log, JSON.stringify({ path: req.url, body, headers: { authorization: req.headers.authorization ? '[present]' : '[absent]' } }) + '\n');
  const messages = body.messages || [];
  const user = [...messages].reverse().find(x => x.role === 'user');
  const prompt = typeof user?.content === 'string' ? user.content : JSON.stringify(user?.content);
  const expectedAuthorization = prompt.includes('HORIZON_TEST_AUTH_RUNTIME') ? 'Bearer fixture-runtime-owned' : prompt.includes('HORIZON_TEST_AUTH_HORIZON') ? 'Bearer fixture-key-not-a-real-provider-secret' : prompt.includes('HORIZON_TEST_AUTH_EXTERNAL') ? 'Bearer horizon-local' : null;
  if (expectedAuthorization && req.headers.authorization !== expectedAuthorization) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Controlled authentication ownership mismatch', type: 'invalid_api_key' } })); return; }
  if (prompt.includes('HORIZON_TEST_AUTH_FAILURE')) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Controlled 401 authentication failure', type: 'invalid_api_key' } })); return; }
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const cid = `chatcmpl-horizon-fixture-${requests}`;
  const send = (delta, finish_reason = null) => res.write(`data: ${JSON.stringify({ id: cid, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: body.model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
  send({ role: 'assistant', content: '' });
  if (prompt.includes('HORIZON_TEST_CANCEL') || prompt.includes('HORIZON_TEST_RESOURCE_STREAM')) {
    let n = 0; const timer = setInterval(() => { send({ content: 'controlled streaming ' }); if (++n > (prompt.includes('HORIZON_TEST_RESOURCE_STREAM') ? 6000 : 300)) { clearInterval(timer); send({}, 'stop'); res.end('data: [DONE]\n\n'); } }, 100);
    req.on('close', () => clearInterval(timer)); res.on('close', () => clearInterval(timer)); return;
  }
  const last = messages.at(-1);
  let tool;
  if (last?.role !== 'tool' && body.tools?.length) {
    if (prompt.includes('HORIZON_TEST_WRITE')) tool = { name: 'horizon_write', arguments: JSON.stringify({ path: 'example.txt', content: 'changed by real Pi through Horizon broker\n' }) };
    if (prompt.includes('HORIZON_TEST_EXEC')) tool = { name: 'horizon_exec', arguments: JSON.stringify({ executable: '/usr/bin/env', argv: [], cwd: '.' }) };
    if (prompt.includes('HORIZON_TEST_UNKNOWN_TOOL')) tool = { name: 'bash', arguments: JSON.stringify({ command: 'touch should-never-exist' }) };
  }
  if (tool) { send({ tool_calls: [{ index: 0, id: `tool-${requests}`, type: 'function', function: tool }] }); send({}, 'tool_calls'); }
  else {
    const answer = prompt.includes('HORIZON_TEST_LONG_MESSAGE') ? '长消息分页🙂\n'.repeat(16384) : prompt.includes('HORIZON_TEST_VISUAL') ? '这段代码把每个项目的会话分开保存。\n\n切换时先保存当前项目的标签与阅读位置，再恢复目标项目的 `tabs` 和 `layout`。\n\n你可以把它理解为：切换项目，也一起切换阅读上下文。' : last?.role === 'tool' ? `Controlled fixture observed actual tool result: ${typeof last.content === 'string' ? last.content : JSON.stringify(last.content)}` : `Horizon controlled protocol fixture response. Prior user turns: ${messages.filter(x => x.role === 'user').length}.`;
    const chunkSize = prompt.includes('HORIZON_TEST_LONG_MESSAGE') ? 1024 : 24;
    for (let offset = 0; offset < answer.length; offset += chunkSize) send({ content: answer.slice(offset, offset + chunkSize) });
    send({}, 'stop');
  }
  res.end('data: [DONE]\n\n');
});
server.listen(port, '127.0.0.1', () => process.stdout.write(JSON.stringify({ port: server.address().port, fixture: true }) + '\n'));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
