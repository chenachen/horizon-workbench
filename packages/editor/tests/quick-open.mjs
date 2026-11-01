import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { build } from 'esbuild';

// Real React QuickOpen/SearchPanel interactions with controllable RPC responses; no native acceptance claim.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = { kind: 'React quick-open and search task regression', phases: [] }, output = process.argv[2];
const bundled = await build({ bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false, outfile: '/tmp/quick-open-regression.js', plugins: [{ name: 'quick-open-fixture', setup(builder) {
  builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$|^\.\/store$|^\.\/commands$/ }, args => args.importer.endsWith('/SearchPanel.tsx') ? { path: args.path, namespace: 'fixture' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('/bridge') ? `export const call = (method, params, projectId) => window.quickHarness.request(method, params, projectId); export const start = (...args) => window.quickHarness.startSearch(...args);` : args.path === './store' ? `export const editorStore = { getSnapshot: () => ({ projects: new Map() }), setSearchDraft: () => {}, openFile: async (fileId, options) => { window.quickHarness.opened.push({ fileId, options }); if (fileId === 'fail') throw new Error('OPEN_FAILED'); }, saveActive: async () => { window.quickHarness.saved++; }, reportError: error => window.quickHarness.errors.push(error.message) };` : `export const editorCommands = { find: async () => { window.quickHarness.found++; }, gotoLine: async () => { window.quickHarness.went++; }, focus: async () => {} };` }));
} }], stdin: { resolveDir: repository, contents: `
  import React from 'react';
  import { createRoot } from 'react-dom/client';
  import { QuickOpen, SearchPanel } from './apps/desktop/src/features/editor/SearchPanel.tsx';
  import './apps/desktop/src/features/editor/editor.css';
  const root = createRoot(document.getElementById('root'));
  let props = { projectId: 'a', projectEpoch: 1, initialMode: 'files', host: true, open: false };
  const h = window.quickHarness = { pending: [], opened: [], commands: [], errors: [], saved: 0, found: 0, went: 0, closed: 0, searchStarts: [], searchCancelled: 0,
    request: (method, params, projectId) => new Promise((resolve, reject) => h.pending.push({ method, params, projectId, resolve, reject })),
    startSearch: (method, params) => new Promise(resolveHandle => h.searchStarts.push({ method, params, resolveHandle })),
    resolveSearchHandle: () => { let rejectResult; const result = new Promise((_, reject) => { rejectResult = reject; }); h.searchStarts.at(-1).resolveHandle({ result, cancel: async () => { h.searchCancelled++; rejectResult(Object.assign(new Error('cancelled'), { code: 'CANCELLED' })); } }); },
    showSearch: () => { props.search = true; render(); },
    show: next => { props = { ...props, ...next, open: true }; render(); }, hide: () => { props.open = false; render(); },
    resolve: (query, fileId, projectId = props.projectId) => { const request = [...h.pending].reverse().find(item => !item.done && item.params.query === query && item.projectId === projectId); if (!request) throw new Error('Missing query ' + query); request.done = true; request.resolve({ items: [{ file: { projectId, fileId, displayPath: fileId + '.ts' }, score: 1 }], generation: request.params.generation, truncated: false }); },
  };
  function render() { if (props.search) { root.render(React.createElement(SearchPanel, { projectId: 'search', projectEpoch: 1 })); return; } root.render(React.createElement(QuickOpen, { ...props,
    commands: props.host ? [{ id: 'file.save', title: 'Save file', shortcut: 'Custom+S' }, { id: 'blocked', title: 'Unavailable', disabled: true, disabledReason: 'Extension disabled' }] : undefined,
    onClose: () => { h.closed++; props.open = false; render(); },
    onCommand: props.host ? async id => { h.commands.push(id); if (props.hostError) throw new Error('HOST_FAILED'); } : undefined,
  })); }
  render();
` } });
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => { response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : request.url.endsWith('.css') ? 'text/css' : 'text/html'); response.end(assets.get(request.url.slice(1)) ?? '<!doctype html><html><head><link rel="stylesheet" href="/quick-open-regression.css"></head><body><button id="origin">Origin</button><div id="root"></div><script type="module" src="/quick-open-regression.js"></script></body></html>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true }), page = await browser.newPage(), pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const input = page.getByRole('combobox'), options = page.getByRole('option');
const show = async props => { await page.evaluate(props => window.quickHarness.show(props), props); await input.waitFor(); };
const waitQuery = query => page.waitForFunction(query => window.quickHarness.pending.some(item => !item.done && item.params.query === query), query);
const resolve = async (query, fileId, projectId) => { await page.evaluate(args => window.quickHarness.resolve(...args), [query, fileId, projectId]); };
const phase = name => evidence.phases.push({ name, passed: true });
try {
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => Boolean(window.quickHarness));
  await page.locator('#origin').focus(); await show({ projectId: 'a', initialMode: 'files' });
  assert.equal(await input.inputValue(), ''); await waitQuery(''); await resolve('', 'recent'); await options.first().waitFor();
  assert.deepEqual(await page.evaluate(() => window.quickHarness.opened), []);
  await input.fill('alpha'); await waitQuery('alpha'); await input.fill('beta'); await waitQuery('beta');
  await resolve('beta', 'newest'); await resolve('alpha', 'stale');
  await page.waitForFunction(() => document.querySelector('[role=option]')?.textContent.includes('newest.ts'));
  assert.equal(await options.count(), 1); assert.ok(!(await options.first().textContent()).includes('stale'));
  phase('only newest file response survives; initialization opens no file');

  await input.fill('slow'); await waitQuery('slow'); await input.fill('>');
  assert.equal(await input.inputValue(), '>'); assert.ok(!(await page.locator('.quick-open footer').textContent()).includes('正在查询'));
  await resolve('slow', 'late-file'); assert.equal(await options.count(), 2); assert.ok(!(await page.locator('.quick-open').textContent()).includes('late-file'));
  await input.fill('>save'); await input.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'origin');
  await show({ initialMode: 'files' }); assert.equal(await input.inputValue(), 'slow');
  await input.fill('>'); assert.equal(await input.inputValue(), '>save');
  await input.fill('>explicit'); assert.equal(await input.inputValue(), '>explicit');
  await input.fill('>save'); await input.press('Escape');
  await show({ projectId: 'b', initialMode: 'files' }); assert.equal(await input.inputValue(), ''); await input.fill('b-only');
  await show({ projectId: 'a', initialMode: 'commands' }); assert.equal(await input.inputValue(), '>save');
  await show({ initialMode: 'files' }); await input.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'origin');
  await show({ initialMode: 'commands' }); assert.equal(await input.inputValue(), '>save');
  assert.equal(await page.locator('.quick-open kbd').first().textContent(), 'Custom+S');
  phase('loading to commands rejects old result; separate query memories and project isolation; Escape restores focus');

  await input.dispatchEvent('compositionstart', { data: '保' }); await input.press('Enter');
  await options.first().dispatchEvent('click'); assert.deepEqual(await page.evaluate(() => window.quickHarness.commands), []);
  await input.dispatchEvent('compositionend', { data: '保' }); await input.press('Enter');
  await page.waitForFunction(() => window.quickHarness.commands.length === 1);
  assert.equal(await page.evaluate(() => window.quickHarness.commands[0]), 'file.save');
  assert.equal(await page.evaluate(() => window.quickHarness.saved), 0); assert.equal(await input.count(), 0);
  phase('IME Enter and click do not execute; host receives file.save and custom shortcut is rendered');

  await show({ initialMode: 'files' }); await waitQuery('slow'); await resolve('slow', 'fail'); await options.first().waitFor(); await options.first().click();
  await page.waitForFunction(() => window.quickHarness.errors.includes('OPEN_FAILED'));
  await show({ initialMode: 'commands', hostError: true }); await input.press('Enter');
  await page.waitForFunction(() => window.quickHarness.errors.includes('HOST_FAILED'));
  phase('file open and host command promise failures reach error reporter');

  await show({ host: false, hostError: false, initialMode: 'commands' }); await input.fill('>查找'); await input.press('Enter');
  await page.waitForFunction(() => window.quickHarness.found === 1);
  await show({ initialMode: 'commands' }); await input.fill('>跳转'); await input.press('Enter'); await page.waitForFunction(() => window.quickHarness.went === 1);
  await show({ host: true, initialMode: 'commands' }); await input.fill('>Unavailable');
  assert.equal(await options.first().isDisabled(), true); assert.ok((await options.first().textContent()).includes('Extension disabled'));
  const commandCount = await page.evaluate(() => window.quickHarness.commands.length); await input.press('Enter');
  assert.equal(await page.evaluate(() => window.quickHarness.commands.length), commandCount);
  phase('standalone find/goto remain; disabled command cannot execute and explains why');

  await page.evaluate(() => window.quickHarness.showSearch());
  const searchInput = page.getByRole('textbox', { name: '搜索文本', exact: true });
  await searchInput.fill('no-matches'); await searchInput.press('Enter');
  await page.waitForFunction(() => window.quickHarness.searchStarts.length === 1);
  await page.getByText('正在搜索…', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '停止', exact: true }).count(), 0);
  await page.evaluate(() => window.quickHarness.resolveSearchHandle());
  // No match event or parent update follows this acknowledgement.
  await page.getByRole('button', { name: '停止', exact: true }).waitFor({ timeout: 1500 });
  await page.getByRole('button', { name: '停止', exact: true }).click();
  await page.getByText('已取消，保留已有结果。', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.quickHarness.searchCancelled), 1);
  assert.equal(await searchInput.inputValue(), 'no-matches');
  phase('delayed search handle with no matches renders Stop; cancellation reaches confirmed terminal state');
  assert.deepEqual(pageErrors, []); evidence.passed = true;
} catch (error) { evidence.passed = false; evidence.error = String(error); evidence.pageErrors = pageErrors; process.exitCode = 1; }
finally { if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n'); console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, output })); await browser.close(); await new Promise(resolve => server.close(resolve)); }
