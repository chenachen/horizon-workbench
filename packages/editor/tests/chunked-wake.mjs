import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { build } from 'esbuild';

// Production Workbench/LargeFile and EditorStore; only native RPC and outer providers are fixtures.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.argv[2], evidence = { kind: 'Same-file chunked wake mount regression', phases: [] };
const bundled = await build({ bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false, outfile: '/tmp/chunked-wake.js', plugins: [{ name: 'chunked-wake-fixture', setup(builder) {
  builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$/ }, args => args.importer.includes('/features/editor/') ? { path: 'bridge', namespace: 'fixture' } : undefined);
  builder.onResolve({ filter: /^\.\.\/settings\/AppearanceProvider$|^\.\.\/plugins\/service$/ }, args => args.importer.endsWith('/EditorWorkbench.tsx') ? { path: args.path.includes('Appearance') ? 'settings' : 'plugins', namespace: 'fixture' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'bridge' ? `export const call = (...args) => window.chunkHarness.request(...args); export const subscribe = async () => ({ close: async () => {} });` : args.path === 'settings' ? `export const useSettings = () => ({ settings: { effective: {} } });` : `export const usePluginEnabled = () => true;` }));
} }], stdin: { resolveDir: repository, contents: `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { EditorWorkbench } from './apps/desktop/src/features/editor/EditorWorkbench.tsx';
  import { editorStore } from './apps/desktop/src/features/editor/store.ts';
  const root = createRoot(document.getElementById('root'));
  const revision = { token: 'disk', contentHash: 'disk', byteLength: '105906176', modifiedAt: '2026-11-01' };
  const opened = cursor => ({ mode: 'chunked', file: { projectId: 'a', fileId: 'large', displayPath: 'large.log' }, revision, cursor });
  const h = window.chunkHarness = { calls: [], opens: 0, deferOpen: false, pendingOpen: undefined, epoch: 1,
    request: (method, params, projectId) => {
      h.calls.push({ method, params, projectId });
      if (method === 'document_open') { h.opens++; return h.deferOpen ? new Promise(resolve => { h.pendingOpen = resolve; }) : Promise.resolve(opened('reader-1')); }
      if (method === 'file_read_chunk') return Promise.resolve({ text: 'automatic first chunk from ' + params.cursor, byteStart: '0', byteEnd: '262144', nextCursor: params.cursor + '-next', revision });
      if (method === 'recovery_list') return Promise.resolve({ items: [] });
      return Promise.resolve({});
    },
    render: () => root.render(React.createElement(EditorWorkbench, { projectId: 'a', projectEpoch: h.epoch })),
    sleep: () => { editorStore.hostClosedProject('a'); root.render(null); },
    wake: () => { h.deferOpen = true; h.epoch = 2; editorStore.setProject('a', 2); h.render(); h.restoring = editorStore.restoreProjectSession('a'); },
    finishOpen: () => { h.pendingOpen(opened('reader-2')); },
    inspect: () => { const b = editorStore.getActive(); return { fileId: b.fileId, evicted: !!b.evicted, cursor: b.cursor, text: b.getText(), byteStart: b.byteStart, byteEnd: b.byteEnd, largeFileCount: document.querySelectorAll('.large-file').length, loadingMessage: document.body.textContent.includes('正在读取文件…'), chunkCalls: h.calls.filter(x => x.method === 'file_read_chunk') }; },
  };
  editorStore.setProject('a', 1); await editorStore.openFile('large'); h.render();
` } });
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => { response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : request.url.endsWith('.css') ? 'text/css' : 'text/html'); response.end(assets.get(request.url.slice(1)) ?? '<!doctype html><html><head><link rel="stylesheet" href="/chunked-wake.css"></head><body><div id="root" style="width:900px;height:600px"></div><div id="editor-status-slot"></div><script type="module" src="/chunked-wake.js"></script></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true }), page = await browser.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.getByText('automatic first chunk from reader-1', { exact: true }).waitFor();
  evidence.phases.push({ name: 'initial mount automatically loads first chunk', passed: true, state: await page.evaluate(() => window.chunkHarness.inspect()) });
  await page.evaluate(() => window.chunkHarness.sleep());
  await page.locator('.editor-workbench').waitFor({ state: 'detached' });
  await page.evaluate(() => window.chunkHarness.wake());
  await page.waitForFunction(() => Boolean(window.chunkHarness.pendingOpen));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  evidence.pendingWake = await page.evaluate(() => window.chunkHarness.inspect());
  await page.evaluate(() => window.chunkHarness.finishOpen());
  // No Next Chunk click: the fresh same-file buffer must cause LargeFile's initial effect to run.
  await page.getByText('automatic first chunk from reader-2', { exact: true }).waitFor({ timeout: 1500 });
  const restored = await page.evaluate(() => window.chunkHarness.inspect());
  assert.equal(evidence.pendingWake.fileId, 'large'); assert.equal(evidence.pendingWake.evicted, true);
  assert.equal(evidence.pendingWake.largeFileCount, 0); assert.equal(evidence.pendingWake.loadingMessage, true);
  assert.equal(evidence.pendingWake.chunkCalls.length, 1);
  assert.equal(restored.fileId, 'large'); assert.equal(restored.evicted, false); assert.equal(restored.largeFileCount, 1);
  assert.equal(restored.byteStart, '0'); assert.equal(restored.byteEnd, '262144'); assert.equal(restored.cursor, 'reader-2-next');
  assert.deepEqual(restored.chunkCalls.map(call => call.params.cursor), ['reader-1', 'reader-2']);
  evidence.phases.push({ name: 'evicted transition unmounts the old reader; fresh same-file open automatically loads first chunk', passed: true, state: restored });
  assert.deepEqual(errors, []); evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = String(error); evidence.errors = errors; evidence.finalState = await page.evaluate(() => window.chunkHarness?.inspect()).catch(() => null); process.exitCode = 1; }
finally { if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, output })); await browser.close(); await new Promise(resolve => server.close(resolve)); }
