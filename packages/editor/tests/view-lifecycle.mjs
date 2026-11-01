import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { chromium } from 'playwright';
import { build } from 'esbuild';

// Browser regression harness only; this does not claim native desktop acceptance.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.argv[2];
const evidence = { kind: 'React + real CodeMirror browser regression', phases: [] };
const bundled = await build({ bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false, outfile: '/tmp/editor-lifecycle.js', stdin: { resolveDir: repository, contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import CodeSurface, { editorCommands } from './apps/desktop/src/features/editor/CodeSurface.tsx';
      import { editorStore, disposeEditorViews } from './apps/desktop/src/features/editor/store.ts';
      import { getEditorDiagnostics } from './packages/editor/src/metrics.ts';
      import './apps/desktop/src/features/editor/editor.css';
      const root = createRoot(document.getElementById('root'));
      const drafts = new Map(), files = new Map(), handles = new Map();
      let sequence = 0, relocationSource;
      const disk = { token: 'base', contentHash: 'base', byteLength: '20', modifiedAt: '2026-10-31' };
      editorStore.transport = { call: async (method, params = {}, projectId) => {
        if (method === 'document_open') {
          const documentId = 'document-' + (++sequence), fileId = params.fileId;
          handles.set(documentId, { fileId, projectId });
          return { mode: 'editor', meta: { documentId, file: { fileId, projectId, displayPath: fileId + '.txt' }, editorRevision: 0, baseDiskRevision: disk, encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false }, text: files.get(projectId + ':' + fileId) ?? 'content for ' + projectId, simplified: false };
        }
        if (method === 'document_relocate_prepare') {
          relocationSource = editorStore.getBuffer(projectId, params.fileId);
          return { plan: { planId: 'relocate', digest: 'digest', expiresAt: '2099-01-01', source: { projectId, fileId: params.fileId, displayPath: relocationSource.path }, hasBuffer: true, dirty: true, candidate: { displayPath: 'relocated.txt', fileId: 'relocated', mode: 'editor', diskRevision: { ...disk, token: 'new-target' }, readOnly: false, simplified: false, canKeepBuffer: true, text: 'different candidate text', previewTruncated: false } } };
        }
        if (method === 'document_relocate_apply') {
          const file = { projectId, fileId: 'relocated', displayPath: 'relocated.txt' };
          return { previousFileId: relocationSource.fileId, choice: params.choice, file, opened: { mode: 'editor', meta: { ...relocationSource.meta, file, editorRevision: relocationSource.version, state: 'dirty', baseDiskRevision: { ...disk, token: 'new-target' } }, text: relocationSource.getText(), simplified: false } };
        }
        if (method === 'document_checkpoint') { const file = handles.get(params.documentId); drafts.set(params.documentId, { ...params, ...file, file, checkpointId: params.documentId }); return { checkpointId: params.documentId, editorRevision: params.editorRevision }; }
        if (method === 'recovery_read') return drafts.get(params.checkpointId);
        if (method === 'recovery_resolve') { drafts.delete(params.checkpointId); return {}; }
        return {};
      } };
      window.editorHarness = { store: editorStore, dispose: disposeEditorViews, diagnostics: getEditorDiagnostics, commands: editorCommands,
        seed: (projectId, fileId, text) => files.set(projectId + ':' + fileId, text),
        render: projectId => root.render(React.createElement(CodeSurface, { projectId })), unmount: () => root.unmount() };
` } });
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => {
  const asset = assets.get(request.url.slice(1));
  response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : request.url.endsWith('.css') ? 'text/css' : 'text/html');
  response.end(asset ?? '<!doctype html><html><head><link rel="stylesheet" href="/editor-lifecycle.css"></head><body><div id="root" style="width:800px;height:500px"></div><div id="editor-status-slot"></div><script type="module" src="/editor-lifecycle.js"></script></body></html>');
});
await new Promise(resolve => server.listen(1437, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

async function observe(name, expectedText, expectedViews = 1) {
  await page.waitForTimeout(80);
  const result = await page.evaluate(() => ({ editors: document.querySelectorAll('.cm-editor').length, text: document.querySelector('.cm-content')?.textContent ?? '', status: document.querySelector('#editor-status-slot')?.textContent ?? '', diagnostics: window.editorHarness.diagnostics() }));
  evidence.phases.push({ name, ...result });
  assert.equal(result.editors, expectedViews, `${name}: live EditorView DOM count`);
  assert.equal(result.diagnostics.viewCount, expectedViews, `${name}: diagnostic live view count`);
  if (expectedText !== undefined) assert.ok(result.text.includes(expectedText), `${name}: readable document text`);
  return result;
}

try {
  await page.goto('http://127.0.0.1:1437/editor-lifecycle');
  await page.waitForFunction(() => Boolean(window.editorHarness));
  await page.evaluate(async () => { const h = window.editorHarness; h.store.setProject('a', 1); await h.store.openFile('one'); h.render('a'); });
  await observe('initial mount', 'content for a');
  await page.locator('.cm-content').click();
  await page.keyboard.press('End'); await page.keyboard.type(' retained draft');
  await page.evaluate(async () => { const h = window.editorHarness; await h.store.flushDrafts('a'); await h.dispose('a'); await h.store.restoreProjectSession('a'); });
  await observe('dispose then reactivate while React stays mounted', 'retained draft');
  await page.evaluate(async () => { const h = window.editorHarness; h.store.setProject('b', 2); await h.store.openFile('two'); h.render('b'); });
  await observe('project B uses its own document', 'content for b');
  await page.evaluate(() => window.editorHarness.dispose('a'));
  await observe('late project A disposal leaves project B readable', 'content for b');
  await page.evaluate(async () => { const h = window.editorHarness; await h.dispose('b'); await h.dispose('b'); await h.store.restoreProjectSession('b'); });
  await observe('duplicate disposal then reactivation', 'content for b');
  const scrollBefore = [];
  for (const [index, projectId] of ['scroll-a', 'scroll-b', 'scroll-c'].entries()) {
    await page.evaluate(({ projectId, index }) => {
      const h = window.editorHarness;
      h.seed(projectId, 'long', Array.from({ length: 400 }, (_, line) => projectId + ' line ' + (line + 1)).join('\n'));
      h.store.setProject(projectId, index + 10); h.render(projectId);
    }, { projectId, index });
    // Real project activation may render before its first document has opened.
    await page.waitForTimeout(80);
    await page.evaluate(() => window.editorHarness.store.openFile('long'));
    await observe(projectId + ' opened', projectId);
    await page.locator('.cm-scroller').evaluate((scroller, top) => { scroller.scrollTop = top; }, [700, 1450, 2300][index]);
    await page.waitForTimeout(80);
    scrollBefore.push(await page.evaluate(() => {
      const h = window.editorHarness, buffer = h.store.getActive();
      return { projectId: buffer.projectId, top: document.querySelector('.cm-scroller').scrollTop, savedTop: buffer.scrollTop, selection: buffer.selection };
    }));
  }
  const scrollAfter = [];
  for (const [index, before] of scrollBefore.entries()) {
    await page.evaluate(({ projectId, index }) => {
      const h = window.editorHarness; h.store.setProject(projectId, index + 10); h.render(projectId);
    }, { projectId: before.projectId, index });
    await observe(before.projectId + ' restored', before.projectId);
    scrollAfter.push(await page.evaluate(() => {
      const h = window.editorHarness, buffer = h.store.getActive();
      return { projectId: buffer.projectId, top: document.querySelector('.cm-scroller').scrollTop, savedTop: buffer.scrollTop, selection: buffer.selection };
    }));
  }
  evidence.phases.push({ name: 'three project viewport restoration', before: scrollBefore, after: scrollAfter });
  for (const [index, before] of scrollBefore.entries()) {
    assert.ok(before.top > 0, before.projectId + ': nonzero initial viewport');
    assert.ok(Math.abs(scrollAfter[index].top - before.top) <= 1, before.projectId + ': restored viewport offset');
    assert.deepEqual(scrollAfter[index].selection, before.selection, before.projectId + ': retained selection');
  }
  await page.evaluate(async () => {
    const h = window.editorHarness;
    h.seed('restored-scroll', 'long', Array.from({ length: 400 }, (_, line) => 'restored line ' + (line + 1)).join('\n'));
    h.store.setProject('restored-scroll', 20, { schemaVersion: 1, revision: 1, tabs: [{ fileId: 'long', pinned: true, selection: { anchor: 200, head: 205 }, scrollTop: 1800 }], activeFileId: 'long', expandedEntryIds: [], searchDraft: '' });
    h.render('restored-scroll'); await h.store.restoreProjectSession('restored-scroll');
  });
  await observe('persisted session creates a fresh editor state', 'restored line');
  const restoredScroll = await page.evaluate(() => ({ top: document.querySelector('.cm-scroller').scrollTop, selection: window.editorHarness.store.getActive().selection }));
  evidence.phases.push({ name: 'persisted session viewport restoration', expected: 1800, ...restoredScroll });
  assert.ok(Math.abs(restoredScroll.top - 1800) <= 1, 'persisted session: restored viewport offset');
  assert.deepEqual(restoredScroll.selection, { anchor: 200, head: 205 });
  const beforeRelocate = await page.evaluate(() => ({ text: window.editorHarness.store.getActive().getText(), views: window.editorHarness.diagnostics().createdViews }));
  await page.locator('.cm-content').focus(); await page.keyboard.type(' relocation-marker');
  const relocation = await page.evaluate(async () => {
    const h = window.editorHarness, original = h.store.getActive(), text = original.getText();
    const plan = await h.store.prepareFileRelocation(original.fileId, original.projectId);
    const moved = await h.store.applyFileRelocation(plan, 'keepBuffer');
    return { sameBuffer: moved === original, sameText: moved.getText() === text, fileId: moved.fileId };
  });
  await observe('relocated buffer retains CodeMirror content', 'relocation-marker');
  assert.deepEqual(relocation, { sameBuffer: true, sameText: true, fileId: 'relocated' });
  const undone = await page.evaluate(() => {
    const h = window.editorHarness, didUndo = h.commands.undo(), buffer = h.store.getActive();
    return { didUndo, text: buffer.getText(), dirty: buffer.dirty, views: h.diagnostics().createdViews };
  });
  evidence.phases.push({ name: 'relocation preserves real CodeMirror undo and does not reuse the old saved baseline', relocation, undone: { didUndo: undone.didUndo, dirty: undone.dirty, views: undone.views } });
  assert.equal(undone.didUndo, true); assert.equal(undone.text, beforeRelocate.text); assert.equal(undone.dirty, true); assert.equal(undone.views, beforeRelocate.views);
  await page.evaluate(() => window.editorHarness.unmount());
  const ended = await observe('React unmount releases view and portal', undefined, 0);
  assert.equal(ended.status, '');
  assert.equal(ended.diagnostics.createdViews, ended.diagnostics.destroyedViews);
  assert.deepEqual(errors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.error = String(error); evidence.pageErrors = errors;
  process.exitCode = 1;
} finally {
  if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, output }));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
