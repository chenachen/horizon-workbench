/** Tests the actual checked-in Pi policy transport; schema constructors are irrelevant stubs. */
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import ts from 'typescript';
const root = await mkdtemp(path.join(tmpdir(), 'horizon-pi-policy-'));
const socketPath = path.join(root, 'broker.sock');
const expected = '逐字节分包：中文🙂不会损坏。';
const source = await readFile('packages/pi-policy/horizon-policy.ts', 'utf8');
const schemaStub = "const Type = { Object: x => x, String: x => x, Array: x => x, Optional: x => x };";
const script = ts.transpileModule(source.replace("import { Type } from '@sinclair/typebox';", schemaStub), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
let chunks = 0;
const server = createServer(socket => {
  socket.once('data', async input => {
    const request = JSON.parse(input.toString());
    assert.equal(request.operation.kind, 'read');
    assert.equal(request.token, 'fixture-token');
    const response = Buffer.from(JSON.stringify({ ok: true, text: expected }) + '\n');
    for (const byte of response) { if (socket.destroyed) break; socket.write(Buffer.from([byte])); chunks++; await delay(2); }
    socket.end();
  });
});
await new Promise(resolve => server.listen(socketPath, resolve));
const oldSocket = process.env.HORIZON_BROKER_SOCKET, oldToken = process.env.HORIZON_BROKER_TOKEN;
process.env.HORIZON_BROKER_SOCKET = socketPath; process.env.HORIZON_BROKER_TOKEN = 'fixture-token';
try {
  const module = await import('data:text/javascript;base64,' + Buffer.from(script).toString('base64'));
  const tools = new Map(); module.default({ on() {}, setActiveTools() {}, registerTool(tool) { tools.set(tool.name, tool); } });
  const response = await tools.get('horizon_read').execute('test', { path: 'example.txt' });
  assert.equal(response.content[0].text, expected);
  const previous = ts.transpileModule(source.replace("import { Type } from '@sinclair/typebox';", schemaStub).replace("    socket.setEncoding('utf8');\n", ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const oldModule = await import('data:text/javascript;base64,' + Buffer.from(previous).toString('base64'));
  const oldTools = new Map(); oldModule.default({ on() {}, setActiveTools() {}, registerTool(tool) { oldTools.set(tool.name, tool); } });
  const broken = await oldTools.get('horizon_read').execute('test', { path: 'example.txt' });
  assert.notEqual(broken.content[0].text, expected);
  const result = { date: new Date().toISOString(), source: 'packages/pi-policy/horizon-policy.ts', checks: { actualPolicyTransport: true, oneByteUnicodeChunks: true, chineseAndSurrogatePairIntact: true, previousDecoderReproducesCorruption: true }, byteChunks: chunks, text: response.content[0].text };
  await writeFile('research/verification/pi-policy-unicode.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  if (oldSocket === undefined) delete process.env.HORIZON_BROKER_SOCKET; else process.env.HORIZON_BROKER_SOCKET = oldSocket;
  if (oldToken === undefined) delete process.env.HORIZON_BROKER_TOKEN; else process.env.HORIZON_BROKER_TOKEN = oldToken;
  await new Promise(resolve => server.close(resolve)); await rm(root, { recursive: true, force: true });
}
