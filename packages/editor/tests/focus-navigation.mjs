import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Production React panels and EditorStore in Chromium. Native shortcut routing and
// CodeMirror are outside this component suite; the editable surface is a textarea.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.argv[2];
const evidence = { kind: 'Search and document-tab focus regression', phases: [] };
const bundled = await build({
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false,
  outfile: '/tmp/focus-navigation.js',
  plugins: [{
    name: 'focus-navigation-fixtures',
    setup(builder) {
      builder.onResolve({ filter: /\/bridge$/ }, () => ({ path: 'bridge', namespace: 'fixture' }));
      builder.onResolve({ filter: /^\.\/CodeSurface$/ }, () => ({ path: 'surface', namespace: 'fixture' }));
      builder.onResolve({ filter: /^\.\/commands$/ }, () => ({ path: 'commands', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/settings\/AppearanceProvider$/ }, () => ({ path: 'settings', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/plugins\/service$/ }, () => ({ path: 'plugins', namespace: 'fixture' }));
      builder.onResolve({ filter: /\/platform$/ }, () => ({ path: 'platform', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: fixture }) => ({
        resolveDir: repository,
        loader: 'tsx',
        contents: fixture === 'bridge' ? `
          export const call = (...args) => window.focusHarness.request(...args);
          export const subscribe = async () => ({ close: async () => {} });
          export const start = async () => ({
            result: Promise.resolve({ matches: 0, files: 0, truncated: false, elapsedMs: 1 }),
            cancel: async () => {},
          });
        ` : fixture === 'surface' ? `
          import React from 'react';
          import { editorStore, useEditor } from './apps/desktop/src/features/editor/store.ts';
          export default function EditableSurface({ projectId }) {
            useEditor();
            const buffer = editorStore.getActive(projectId);
            return buffer ? <textarea key={buffer.key} aria-label="Fixture document"
              defaultValue={buffer.getText()} onChange={event => {
                const text = event.target.value;
                editorStore.edited(projectId, buffer.fileId, () => text,
                  { anchor: event.target.selectionStart, head: event.target.selectionEnd }, text);
              }} /> : null;
          }
        ` : fixture === 'commands' ? `export const editorCommands = { focus: () => document.querySelector('[aria-label="Fixture document"]')?.focus(), find: () => {}, gotoLine: () => {}, definition: () => {} };`
          : fixture === 'settings' ? 'export const useSettings = () => ({ settings: { effective: {} } });'
            : fixture === 'plugins' ? 'export const usePluginEnabled = () => true;'
              : 'export const platform = "macos";',
      }));
    },
  }],
  stdin: {
    resolveDir: repository,
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { SearchPanel } from './apps/desktop/src/features/editor/SearchPanel.tsx';
      import { EditorWorkbench } from './apps/desktop/src/features/editor/EditorWorkbench.tsx';
      import { editorStore } from './apps/desktop/src/features/editor/store.ts';

      const root = createRoot(document.getElementById('root'));
      const projectId = 'focus-project';
      const h = window.focusHarness = {
        searchOpen: false, focusRequest: 0,
        request: async (method, params = {}, scope = projectId) => {
          if (method === 'document_open') {
            const text = 'const ' + params.fileId.split('.')[0] + ' = 1;\\n';
            return { mode: 'editor', text, simplified: false, meta: {
              documentId: 'doc-' + params.fileId,
              file: { projectId: scope, fileId: params.fileId, displayPath: params.fileId },
              editorRevision: 0,
              baseDiskRevision: { token: 'disk', contentHash: 'disk', byteLength: String(text.length), modifiedAt: '2026-11-15' },
              encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false,
            } };
          }
          if (method === 'recovery_list') return { items: [] };
          if (method === 'document_checkpoint') return { checkpointId: params.documentId, editorRevision: params.editorRevision };
          return {};
        },
        showSearch() { this.searchOpen = true; this.focusRequest++; render(); },
        hideSearch() { this.searchOpen = false; render(); },
        render,
        documents: () => [...editorStore.getSnapshot().buffers.values()].map(buffer => ({
          fileId: buffer.fileId, text: buffer.getText(), dirty: buffer.dirty,
          version: buffer.version, selection: { ...buffer.selection },
        })),
        active: () => editorStore.getActive(projectId)?.fileId,
        draft: () => editorStore.getSnapshot().projects.get(projectId)?.searchDraft,
      };
      function render() {
        root.render(<>
          {h.searchOpen && <SearchPanel projectId={projectId} projectEpoch={1} focusRequest={h.focusRequest} />}
          <EditorWorkbench projectId={projectId} projectEpoch={1} previewEnabled={false} />
        </>);
      }
      editorStore.setProject(projectId, 1);
      for (const fileId of ['alpha.ts', 'beta.ts', 'gamma.ts', 'delta.ts']) {
        await editorStore.openFile(fileId, { projectId, preview: false });
      }
      editorStore.activate('alpha.ts', projectId);
      render();
    `,
    loader: 'tsx',
  },
});
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : request.url.endsWith('.css') ? 'text/css' : 'text/html');
  response.end(assets.get(request.url.slice(1)) ?? '<!doctype html><html><head><link rel="stylesheet" href="/focus-navigation.css"></head><body><div id="root"></div><script type="module" src="/focus-navigation.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const editor = page.getByRole('textbox', { name: 'Fixture document', exact: true });
const query = page.getByRole('textbox', { name: '搜索文本', exact: true });
const phase = name => evidence.phases.push({ name, passed: true });
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const activeElement = locator => locator.evaluate(element => element === document.activeElement);
const documents = () => page.evaluate(() => window.focusHarness.documents());
const expectTab = async fileId => {
  await page.waitForFunction(fileId => window.focusHarness.active() === fileId &&
    document.activeElement?.id === 'tab-' + fileId &&
    document.activeElement.getAttribute('aria-selected') === 'true', fileId);
  assert.equal(await page.getByRole('tab', { selected: true }).count(), 1);
  assert.deepEqual(await page.getByRole('tab').evaluateAll(tabs => tabs.map(tab => tab.tabIndex)),
    ['alpha.ts', 'beta.ts', 'gamma.ts', 'delta.ts'].map(id => id === fileId ? 0 : -1));
  assert.equal(await page.getByRole('tabpanel').getAttribute('aria-labelledby'), 'tab-' + fileId);
};

try {
  await page.goto('http://127.0.0.1:' + server.address().port);
  await editor.waitFor();
  await editor.fill('const keep = "unsaved draft";\n');
  assert.equal((await documents())[0].dirty, true);
  const beforeSearch = await documents();
  await editor.focus();
  await page.evaluate(() => window.focusHarness.showSearch());
  await query.waitFor();
  assert.equal(await activeElement(query), true);
  await page.keyboard.type('original query');
  assert.equal(await query.inputValue(), 'original query');
  assert.equal(await page.evaluate(() => window.focusHarness.draft()), 'original query');
  assert.deepEqual(await documents(), beforeSearch);
  phase('first search request focuses query; keyboard typing changes search draft and leaves all document text, dirty state, version and selection unchanged');

  await editor.focus();
  await page.evaluate(() => window.focusHarness.showSearch());
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === '搜索文本');
  assert.deepEqual(await query.evaluate(input => [input.selectionStart, input.selectionEnd]), [0, 'original query'.length]);
  await page.keyboard.type('replacement');
  assert.equal(await query.inputValue(), 'replacement');
  assert.deepEqual(await documents(), beforeSearch);
  phase('repeat request on mounted search restores focus and selects existing query; typing replaces query without editing document');

  await editor.focus();
  await page.evaluate(() => window.focusHarness.render());
  await settle();
  assert.equal(await activeElement(editor), true);
  await page.evaluate(() => window.focusHarness.hideSearch());
  await query.waitFor({ state: 'detached' });
  await page.evaluate(() => window.focusHarness.showSearch());
  await query.waitFor();
  assert.equal(await activeElement(query), true);
  assert.equal(await query.inputValue(), 'replacement');
  assert.deepEqual(await query.evaluate(input => [input.selectionStart, input.selectionEnd]), [0, 'replacement'.length]);
  phase('unchanged request does not steal focus on rerender; remounted search preserves and selects query');

  await page.evaluate(() => window.focusHarness.hideSearch());
  await query.waitFor({ state: 'detached' });
  await page.getByRole('tab', { name: 'alpha.ts', exact: false }).focus();
  await expectTab('alpha.ts');
  for (const [key, target] of [
    ['ArrowRight', 'beta.ts'], ['ArrowRight', 'gamma.ts'], ['ArrowRight', 'delta.ts'],
    ['ArrowRight', 'alpha.ts'], ['ArrowLeft', 'delta.ts'], ['ArrowLeft', 'gamma.ts'],
    ['ArrowLeft', 'beta.ts'], ['Home', 'alpha.ts'], ['End', 'delta.ts'],
    ['Home', 'alpha.ts'], ['ArrowLeft', 'delta.ts'], ['ArrowRight', 'alpha.ts'],
  ]) {
    await page.keyboard.press(key);
    await expectTab(target);
  }
  phase('four tabs keep focus, selected tab, roving tabIndex and labelled panel aligned through repeated arrows, Home/End and wrapping');

  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
    await page.getByRole('tab', { selected: true }).dispatchEvent('keydown', { key, isComposing: true });
    await settle();
    await expectTab('alpha.ts');
  }
  await page.keyboard.press('ArrowRight');
  await expectTab('beta.ts');
  phase('IME composition navigation leaves focus and active tab unchanged; ordinary arrow resumes navigation');
  assert.deepEqual(await documents(), beforeSearch);
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
