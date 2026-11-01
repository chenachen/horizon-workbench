import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { build } from 'esbuild';

// Production React notice and EditorStore; deferred RPCs expose cleanup races.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = { kind: 'RecoveryNotice and EditorStore async cleanup regression', phases: [] }, output = process.argv[2];
const bundled = await build({ bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false, outfile: '/tmp/recovery-notice-regression.js', plugins: [{ name: 'recovery-rpc-fixture', setup(builder) {
  builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$/ }, args => /\/features\/editor\/(RecoveryNotice\.tsx|store\.ts)$/.test(args.importer) ? { path: args.path, namespace: 'fixture' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const call = (...args) => window.recoveryHarness.request(...args);' }));
} }], stdin: { resolveDir: repository, contents: `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { RecoveryNotice } from './apps/desktop/src/features/editor/RecoveryNotice.tsx';
  import { editorStore } from './apps/desktop/src/features/editor/store.ts';
  const file = { projectId: 'a', fileId: 'file-a', displayPath: 'example.txt' };
  const revision = { token: 'disk-1', size: '5', modifiedAt: '2026-11-01T00:00:00Z' };
  const h = window.recoveryHarness = { lists: [], reads: [], cleanMarks: [], calls: [], epoch: 1,
    request: (method, params, projectId) => {
      h.calls.push({ method, params, projectId });
      if (method === 'recovery_list') return new Promise((resolve, reject) => h.lists.push({ params, resolve, reject }));
      if (method === 'recovery_read') return new Promise((resolve, reject) => h.reads.push({ params, resolve, reject }));
      if (method === 'document_mark_dirty' && !params.dirty) return new Promise(resolve => h.cleanMarks.push({ params, resolve }));
      if (method === 'document_checkpoint') return Promise.resolve({ checkpointId: 'draft-a', editorRevision: params.editorRevision });
      if (method === 'document_open') return Promise.resolve({ mode: 'editor', text: 'saved', simplified: false, meta: { documentId: 'doc-a', file, editorRevision: 0, baseDiskRevision: revision, encoding: 'utf8', eol: 'lf', readOnly: false } });
      return Promise.resolve({});
    },
    edit: identity => { editorStore.edited('a', 'file-a', () => identity, { anchor: 0, head: 0 }, identity); },
    buffer: () => { const b = editorStore.getBuffer('a', 'file-a'); return { dirty: b.dirty, checkpointId: b.checkpointId, checkpointVersion: b.checkpointVersion, version: b.version }; },
    rejectList: index => h.lists[index].reject(Object.assign(new Error('missing recovery file'), { code: 'NOT_FOUND' })),
    resolveList: (index, items) => h.lists[index].resolve({ items }),
    nextEpoch: () => { h.epoch++; editorStore.setProject('a', h.epoch); render(); },
    publish: () => editorStore.activate('file-a', 'a'),
  };
  editorStore.setProject('a', 1);
  await editorStore.openFile('file-a', { projectId: 'a', preview: false });
  const buffer = editorStore.getBuffer('a', 'file-a');
  buffer.savedContentIdentity = 'saved'; buffer.contentEquals = (a, b) => a === b;
  h.edit('dirty'); await editorStore.flushDrafts('a');
  const root = createRoot(document.getElementById('root'));
  function render() { root.render(React.createElement(RecoveryNotice, { projectId: 'a', projectEpoch: h.epoch })); }
  render();
` } });
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => { response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/html'); response.end(assets.get(request.url.slice(1)) ?? '<!doctype html><html><body><div id="root"></div><script type="module" src="/recovery-notice-regression.js"></script></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true }), page = await browser.newPage(), pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const waitLists = count => page.waitForFunction(count => window.recoveryHarness.lists.length === count, count, { timeout: 1500 });
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const phase = name => evidence.phases.push({ name, passed: true });
const item = { checkpointId: 'draft-a', documentId: 'doc-a', projectId: 'a', file: { projectId: 'a', fileId: 'file-a', displayPath: 'example.txt' }, editorRevision: 1, updatedAt: '2026-11-01T00:00:00Z', byteCount: '5' };
try {
  await page.goto('http://127.0.0.1:' + server.address().port);
  await waitLists(1);
  await page.evaluate(() => { window.recoveryHarness.edit('dirty-again'); window.recoveryHarness.publish(); });
  await settle();
  assert.equal(await page.evaluate(() => window.recoveryHarness.lists.length), 1);
  phase('continuous dirty edits do not query recovery list again');

  await page.evaluate(() => window.recoveryHarness.edit('saved'));
  await waitLists(2);
  await page.waitForFunction(() => window.recoveryHarness.cleanMarks.length === 1);
  assert.equal((await page.evaluate(() => window.recoveryHarness.buffer())).checkpointId, 'draft-a');
  await page.evaluate(() => window.recoveryHarness.rejectList(0)); await settle();
  assert.equal(await page.getByRole('alert').count(), 0);
  phase('Undo invalidates older list error while checkpoint remains until native clean receipt');

  await page.evaluate(() => window.recoveryHarness.cleanMarks[0].resolve({}));
  await waitLists(3);
  assert.deepEqual(await page.evaluate(() => window.recoveryHarness.buffer()), { dirty: false, checkpointId: undefined, checkpointVersion: -1, version: 3 });
  await page.evaluate(item => { window.recoveryHarness.resolveList(1, [item]); window.recoveryHarness.resolveList(2, []); }, item);
  await settle(); assert.equal(await page.getByRole('status').count(), 0);
  phase('native cleanup receipt refreshes list and rejects older draft result without leaving a recovery notice');

  await page.evaluate(() => window.recoveryHarness.nextEpoch()); await waitLists(4);
  await page.evaluate(() => window.recoveryHarness.rejectList(3));
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').textContent()).includes('missing recovery file'));
  phase('current recovery list NOT_FOUND remains visible rather than being swallowed');

  await page.getByRole('button', { name: '重新读取' }).click(); await waitLists(5);
  await page.evaluate(item => window.recoveryHarness.resolveList(4, [item]), item);
  await page.getByRole('button', { name: '比较草稿与磁盘' }).click();
  await page.waitForFunction(() => window.recoveryHarness.reads.length === 1);
  await page.evaluate(() => window.recoveryHarness.reads[0].reject(Object.assign(new Error('actual draft is missing'), { code: 'NOT_FOUND' })));
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').textContent()).includes('actual draft is missing'));
  assert.equal(await page.getByRole('button', { name: '恢复到编辑器' }).count(), 1);
  phase('a genuinely missing selected draft remains an actionable recovery error');
  assert.deepEqual(pageErrors, []); evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = String(error); evidence.pageErrors = pageErrors; process.exitCode = 1; }
finally { if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, output })); await browser.close(); await new Promise(resolve => server.close(resolve)); }
