import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.argv[2];
const evidence = { kind: 'Definition navigation with React and real CodeMirror', phases: [] };
const bundled = await build({
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  write: false,
  outfile: '/tmp/semantic-navigation.js',
  plugins: [{
    name: 'semantic-navigation-fixtures',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/languageService$/ }, () => ({ path: 'language-service', namespace: 'fixture' }));
      builder.onResolve({ filter: /^\.\/syntax$/ }, () => ({ path: 'syntax', namespace: 'fixture' }));
      builder.onResolve({ filter: /^\.\/textmate$/ }, () => ({ path: 'textmate', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/bridge$/ }, () => ({ path: 'bridge', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: fixture }) => ({
        contents: fixture === 'language-service' ? `
          export const semanticExtension = () => [];
          export const getDefinitions = (view, pos) => window.semanticHarness.definitions(view, pos);
          export const cancelDefinitionRequest = view => window.semanticHarness.cancelled.push(view?.state.doc.toString());
          export const openDefinition = (projectId, target, isCurrent) => window.semanticHarness.open(projectId, target, isCurrent);
          export const releaseLanguageServices = projectId => window.semanticHarness.released.push(projectId);
        ` : fixture === 'syntax' ? `
          export const syntaxService = { getRevision: () => 1, languageId: () => 'typescript', load: async () => [], subscribe: () => () => {}, release: () => {} };
        ` : fixture === 'textmate' ? `
          export const textmateHighlightReady = () => true;
        ` : `
          export const call = async () => ({});
        `,
      }));
    },
  }],
  stdin: {
    resolveDir: repository,
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { EditorView } from '@codemirror/view';
      import CodeSurface, { editorCommands } from './apps/desktop/src/features/editor/CodeSurface.tsx';
      import { editorStore, disposeEditorViews } from './apps/desktop/src/features/editor/store.ts';
      import './apps/desktop/src/features/editor/editor.css';

      const root = createRoot(document.getElementById('root'));
      const target = (name, line = 2) => ({
        uri: 'file:///project/' + name + '.ts', label: name + '.ts',
        range: { start: { line, character: 3 }, end: { line, character: 9 } },
      });
      const harness = window.semanticHarness = {
        mode: 'single', requests: [], opened: [], released: [], pending: [], cancelled: [],
        holdOpen: false, pendingOpens: [],
        targets: [target('target')],
        target,
        store: editorStore,
        commands: editorCommands,
        view: () => EditorView.findFromDOM(document.querySelector('.cm-editor')),
        definitions(view, position = view.state.selection.main.head) {
          this.requests.push({ position, text: view.state.doc.toString(), projectId: editorStore.getActive()?.projectId });
          if (this.mode === 'error') return Promise.reject(new Error('Fixture language server unavailable'));
          if (this.mode === 'empty') return Promise.resolve([]);
          if (this.mode === 'pending') return new Promise(resolve => this.pending.push(resolve));
          return Promise.resolve(structuredClone(this.targets));
        },
        async open(projectId, target, isCurrent) {
          if (this.holdOpen) await new Promise(resolve => this.pendingOpens.push(resolve));
          if (!isCurrent || isCurrent()) this.opened.push({ projectId, target: structuredClone(target) });
        },
        resolveOpen() { this.pendingOpens.shift()?.(); },
        resolvePending() { for (const resolve of this.pending.splice(0)) resolve(structuredClone(this.targets)); },
        render: projectId => root.render(React.createElement(CodeSurface, { projectId })),
        async dispose(projectId) { await disposeEditorViews(projectId); },
        unmount: () => root.unmount(),
      };
      let sequence = 0;
      editorStore.transport = { call: async (method, params = {}, projectId) => {
        if (method === 'document_open') {
          const text = params.fileId === 'source.ts' ? 'function source() { return target(); }\\nconst value = 1;\\n' : 'function other() { return 2; }\\n';
          return {
            mode: 'editor', text, simplified: false,
            meta: {
              documentId: 'semantic-document-' + (++sequence),
              file: { projectId, fileId: params.fileId, displayPath: params.fileId },
              editorRevision: 0,
              baseDiskRevision: { token: 'disk', contentHash: 'disk', byteLength: String(text.length), modifiedAt: '2026-11-15' },
              encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false,
            },
          };
        }
        if (method === 'document_checkpoint') return { checkpointId: params.documentId, editorRevision: params.editorRevision };
        return {};
      } };
    `,
  },
});
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => {
  const asset = assets.get(request.url.slice(1));
  response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : request.url.endsWith('.css') ? 'text/css' : 'text/html');
  response.end(asset ?? '<!doctype html><html><head><link rel="stylesheet" href="/semantic-navigation.css"></head><body style="--h-ink:#24334c;--h-surface:#fff;--h-low:#f6f7fa;--h-high:#eef1f6;--h-line:#dce1ea;--h-muted:#73829a;--h-accent:#4b6fa5;--h-tonal:#e4ebf8;--h-on-tonal:#24334c;font-family:system-ui;margin:24px;background:#f6f7fa"><div id="root" class="editor-workbench" style="display:flex;flex-direction:column;width:800px;height:500px"></div><div id="editor-status-slot"></div><script type="module" src="/semantic-navigation.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

const count = property => page.evaluate(property => window.semanticHarness[property].length, property);
const waitOpened = expected => page.waitForFunction(expected => window.semanticHarness.opened.length === expected, expected);
const focusEditor = () => page.locator('.cm-content').focus();

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => Boolean(window.semanticHarness));
  await page.evaluate(async () => {
    const h = window.semanticHarness;
    h.store.setProject('project-a', 1);
    await h.store.openFile('source.ts');
    h.render('project-a');
  });
  await page.locator('.cm-content').waitFor();

  await focusEditor();
  await page.keyboard.press('F12');
  await waitOpened(1);
  const first = await page.evaluate(() => window.semanticHarness.opened[0]);
  assert.equal(first.projectId, 'project-a');
  assert.equal(first.target.uri, 'file:///project/target.ts');
  evidence.phases.push({ name: 'F12 opens the returned definition', first });

  const beforeClick = await count('requests');
  const point = await page.evaluate(() => {
    const coords = window.semanticHarness.view().coordsAtPos(28);
    return { x: coords.left + 2, y: (coords.top + coords.bottom) / 2 };
  });
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(50);
  assert.equal(await count('requests'), beforeClick);
  const modifier = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Control');
  await page.keyboard.down(modifier);
  await page.mouse.click(point.x, point.y);
  await page.keyboard.up(modifier);
  await waitOpened(2);
  const clicked = await page.evaluate(() => window.semanticHarness.requests.at(-1));
  assert.ok(clicked.position >= 25 && clicked.position <= 35, 'modified click queries the clicked symbol');
  evidence.phases.push({ name: 'ordinary click preserves selection and modified click navigates', modifier, clicked });

  await page.evaluate(() => { const h = window.semanticHarness; h.targets = [h.target('first'), h.target('second', 9)]; });
  await focusEditor();
  await page.keyboard.press('F12');
  await page.getByRole('dialog', { name: '选择定义' }).waitFor();
  await mkdir(path.join(repository, '.work'), { recursive: true });
  await page.screenshot({ path: path.join(repository, '.work/semantic-navigation.png') });
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await waitOpened(3);
  assert.equal(await page.evaluate(() => window.semanticHarness.opened.at(-1).target.uri), 'file:///project/second.ts');
  await page.getByRole('dialog', { name: '选择定义' }).waitFor({ state: 'detached' });
  evidence.phases.push({ name: 'multiple definitions support keyboard choice' });

  await focusEditor();
  await page.keyboard.press('F12');
  await page.getByRole('dialog', { name: '选择定义' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: '选择定义' }).waitFor({ state: 'detached' });
  assert.equal(await count('opened'), 3);
  await page.waitForFunction(() => document.activeElement?.classList.contains('cm-content'));
  evidence.phases.push({ name: 'Escape dismisses candidates and returns editor focus' });

  await page.evaluate(() => { window.semanticHarness.mode = 'empty'; });
  await focusEditor();
  await page.keyboard.press('F12');
  await page.getByRole('status').filter({ hasText: /没有.*定义|未找到.*定义/ }).waitFor();
  await page.evaluate(() => { window.semanticHarness.mode = 'error'; });
  await focusEditor();
  await page.keyboard.press('F12');
  await page.getByRole('alert').filter({ hasText: 'Fixture language server unavailable' }).waitFor();
  evidence.phases.push({ name: 'empty results and server failures remain visible' });

  await page.evaluate(() => {
    const h = window.semanticHarness;
    h.mode = 'single'; h.targets = [h.target('cancelled-open')]; h.holdOpen = true;
  });
  await focusEditor();
  await page.keyboard.press('F12');
  await page.waitForFunction(() => window.semanticHarness.pendingOpens.length === 1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.semanticHarness.resolveOpen());
  await page.waitForTimeout(30);
  assert.equal(await count('opened'), 3);
  evidence.phases.push({ name: 'Escape cancels a definition while its target file is opening' });

  await page.evaluate(() => { window.semanticHarness.targets = [window.semanticHarness.target('superseded-open')]; });
  await focusEditor();
  await page.keyboard.press('F12');
  await page.waitForFunction(() => window.semanticHarness.pendingOpens.length === 1);
  await page.evaluate(() => { window.semanticHarness.targets = [window.semanticHarness.target('fresh-open')]; });
  await page.keyboard.press('F12');
  await page.waitForFunction(() => window.semanticHarness.pendingOpens.length === 2);
  await page.evaluate(() => window.semanticHarness.resolveOpen());
  await page.waitForTimeout(30);
  assert.equal(await count('opened'), 3);
  await page.evaluate(() => window.semanticHarness.resolveOpen());
  await waitOpened(4);
  assert.equal(await page.evaluate(() => window.semanticHarness.opened.at(-1).target.uri), 'file:///project/fresh-open.ts');
  await page.evaluate(() => { window.semanticHarness.holdOpen = false; });
  evidence.phases.push({ name: 'new F12 request supersedes an earlier target file opening' });

  await page.evaluate(() => { const h = window.semanticHarness; h.mode = 'pending'; h.targets = [h.target('late')]; });
  await focusEditor();
  await page.keyboard.press('F12');
  await page.waitForFunction(() => window.semanticHarness.pending.length === 1);
  await page.evaluate(async () => { await window.semanticHarness.store.openFile('other.ts'); });
  await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent.includes('other'));
  await page.evaluate(() => window.semanticHarness.resolvePending());
  await page.waitForTimeout(50);
  assert.equal(await count('opened'), 4);
  evidence.phases.push({ name: 'late response after switching files cannot navigate' });

  await page.evaluate(() => window.semanticHarness.unmount());
  assert.deepEqual(errors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.error = String(error);
  evidence.pageErrors = errors;
  process.exitCode = 1;
} finally {
  if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, output }));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
