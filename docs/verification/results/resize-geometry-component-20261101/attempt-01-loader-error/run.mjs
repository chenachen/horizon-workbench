import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const outputDirectory = path.dirname(fileURLToPath(import.meta.url));
const resultPath = path.join(outputDirectory, 'result.json');
const startedAt = new Date().toISOString();
const sourcePaths = [
  'apps/desktop/src/components/ResizeHandle.tsx',
  'apps/desktop/src/features/settings/AppearanceProvider.tsx',
  'apps/desktop/src/App.tsx',
  'packages/appearance/src/index.ts',
  'packages/plugins/src/builtins.ts',
];
const sha256 = value => createHash('sha256').update(value).digest('hex');
const sources = [];
for (const relative of sourcePaths) {
  const bytes = await readFile(path.join(repository, relative));
  const copy = path.join(outputDirectory, 'sources', relative);
  await mkdir(path.dirname(copy), { recursive: true });
  await writeFile(copy, bytes);
  sources.push({ path: relative, sha256: sha256(bytes), bytes: bytes.length });
}
const evidence = {
  kind: 'Production ResizeHandle + AppearanceProvider controlled component regression',
  scope: 'Real production React components, applyAppearance, layouts and themes. Only bridge RPC/events replaced with deferred host fixture. Headless Chromium; no Horizon/native GUI; no desktop build.',
  startedAt, sources, phases: [],
};
const browserErrors = [], consoleErrors = [];
let browser, server, page;

try {
  const bundled = await build({
    bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic',
    write: false, outfile: path.join(outputDirectory, 'component-fixture.js'),
    plugins: [{ name: 'appearance-rpc-fixture', setup(builder) {
      builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$/ }, args => args.importer.endsWith('/features/settings/AppearanceProvider.tsx') ? { path: args.path, namespace: 'fixture' } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
        export const nativeAvailable = () => true;
        export const call = (...args) => window.geometryHarness.request(...args);
        export const onEvent = (...args) => window.geometryHarness.onEvent(...args);
      ` }));
    } }],
    stdin: { resolveDir: repository, contents: `
      import React, { useCallback, useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { AppearanceProvider, useAppearance } from './apps/desktop/src/features/settings/AppearanceProvider.tsx';
      import { ResizeHandle } from './apps/desktop/src/components/ResizeHandle.tsx';
      import { builtinLayouts } from './packages/plugins/src/builtins.ts';

      const layout = builtinLayouts.find(item => item.id === 'horizon.layout.mist');
      const defaults = Object.fromEntries(Object.entries(layout.geometry).map(([key, rule]) => [key, rule.initial]));
      const h = window.geometryHarness = {
        width: 260, revision: 40, calls: [], patches: [], errors: [], rejected: [], events: [],
        listeners: new Map(), activePatches: 0, maxActivePatches: 0, visibleSnapshot: null,
        snapshot() {
          const geometry = { ...defaults, sidebarWidth: h.width };
          return {
            revision: h.revision,
            effective: {
              layoutId: layout.id, themeId: 'horizon.theme.mist', mode: 'light',
              geometryByLayout: { [layout.id]: geometry }, colorsByTheme: {},
              background: { assetId: null, region: 'editor', fit: 'cover', position: { x: 50, y: 50 }, opacity: 0, overlay: 0 },
            },
            effectiveGeometry: geometry, sources: [], layoutSource: 'global', notices: [],
          };
        },
        onEvent(name, listener) {
          const group = h.listeners.get(name) ?? new Set(); group.add(listener); h.listeners.set(name, group);
          return Promise.resolve(() => group.delete(listener));
        },
        emit(name) { h.events.push({ name, revision: h.revision }); for (const listener of h.listeners.get(name) ?? []) listener({ revision: h.revision }); },
        request(method, params) {
          h.calls.push({ method, params: structuredClone(params), revision: h.revision });
          if (method === 'appearance_get') return Promise.resolve(h.snapshot());
          if (method === 'extension_list') return Promise.resolve({ items: [] });
          if (method === 'settings_get') return Promise.resolve({ revision: 1, global: {}, overrides: {}, effective: {}, sources: {} });
          if (method === 'appearance_patch') {
            h.activePatches++; h.maxActivePatches = Math.max(h.maxActivePatches, h.activePatches);
            return new Promise((resolve, reject) => h.patches.push({ params: structuredClone(params), resolve, reject, state: 'pending' }));
          }
          throw new Error('Unexpected production RPC: ' + method);
        },
        resolvePatch(index) {
          const patch = h.patches[index]; if (patch.state !== 'pending') throw new Error('Patch already settled');
          h.activePatches--;
          if (patch.params.expectedRevision !== h.revision) {
            const error = Object.assign(new Error('外观已更新，请刷新后重试'), { code: 'STALE_VERSION' });
            patch.state = 'rejected'; patch.error = { code: error.code, message: error.message }; h.rejected.push(error); patch.reject(error); return;
          }
          const change = patch.params.changes[0];
          if (patch.params.target.kind !== 'global' || change.field.kind !== 'geometry' || change.field.key !== 'sidebarWidth' || change.field.layoutId !== layout.id || change.operation !== 'set') throw new Error('Unexpected geometry mutation');
          h.width = change.value; h.revision++; patch.state = 'resolved'; patch.resultRevision = h.revision;
          h.emit('appearance.changed'); patch.resolve(h.snapshot());
        },
        rejectWithAuthoritative(index, width) {
          const patch = h.patches[index]; if (patch.state !== 'pending') throw new Error('Patch already settled');
          h.width = width; h.revision++; h.activePatches--;
          const error = Object.assign(new Error('真实外观版本冲突（受控宿主）'), { code: 'STALE_VERSION', identity: 'original-write-error' });
          h.rejected.push(error); patch.state = 'rejected'; patch.error = { code: error.code, message: error.message };
          patch.reject(error);
        },
        capture() {
          const handle = document.querySelector('[role=separator]');
          return {
            css: Number.parseFloat(document.documentElement.style.getPropertyValue('--sidebar-width')),
            renderedWidth: document.querySelector('.fixture-sidebar').getBoundingClientRect().width,
            aria: Number(handle.getAttribute('aria-valuenow')),
            snapshotWidth: h.visibleSnapshot?.effectiveGeometry.sidebarWidth,
            snapshotRevision: h.visibleSnapshot?.revision,
            hostWidth: h.width, hostRevision: h.revision,
            patchCount: h.patches.length, activePatches: h.activePatches,
            errors: h.errors.map(error => ({ code: error.code, message: error.message, identity: error.identity })),
          };
        },
        export() {
          return {
            ...h.capture(), calls: h.calls, events: h.events, maxActivePatches: h.maxActivePatches,
            patches: h.patches.map(({ params, state, resultRevision, error }) => ({ params, state, resultRevision, error })),
            originalErrorIdentityPreserved: h.errors.length === 1 && h.errors[0] === h.rejected[0],
          };
        },
      };
      function GeometryFixture() {
        const appearance = useAppearance();
        const [, setError] = useState('');
        const reportError = useCallback(error => { h.errors.push(error); setError(error.message); }, []);
        const saveGeometry = (key, value) => appearance.setGeometry(key, value).catch(reportError);
        h.visibleSnapshot = appearance.snapshot;
        return <div className="fixture-sidebar">
          <ResizeHandle label="文件侧栏宽度" variable="--sidebar-width" currentValue={appearance.snapshot?.effectiveGeometry.sidebarWidth ?? 240} min={160} max={480} defaultValue={240} onCommit={value => saveGeometry('sidebarWidth', value)} />
        </div>;
      }
      const root = createRoot(document.getElementById('root'));
      root.render(<AppearanceProvider onError={error => h.errors.push(error)}><GeometryFixture /></AppearanceProvider>);
    ` },
  });
  const asset = bundled.outputFiles.find(file => file.path.endsWith('.js')).contents;
  evidence.inMemoryFixtureSha256 = sha256(asset);
  server = createServer((request, response) => {
    if (request.url === '/component-fixture.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(asset); return; }
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><html><head><style>body{margin:0}.fixture-sidebar{position:absolute;left:0;top:80px;width:var(--sidebar-width);height:400px;box-sizing:border-box}.resize-handle{position:absolute;right:-3px;top:0;width:6px;height:400px;background:#555;touch-action:none}</style></head><body><div id="root"></div><script type="module" src="/component-fixture.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const snapshot = () => page.evaluate(() => window.geometryHarness.capture());
  const waitPatches = count => page.waitForFunction(count => window.geometryHarness.patches.length === count, count, { timeout: 2000 });
  const resolvePatch = async index => { await page.evaluate(index => window.geometryHarness.resolvePatch(index), index); await settle(); };
  const equalGeometry = async (expected, message) => {
    await settle(); const actual = await snapshot();
    assert.equal(actual.css, expected, message + ' CSS');
    assert.equal(actual.aria, expected, message + ' ARIA');
    assert.equal(actual.renderedWidth, expected, message + ' rendered width');
    return actual;
  };
  const phase = (name, values) => evidence.phases.push({ name, passed: true, at: new Date().toISOString(), ...values });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.geometryHarness?.visibleSnapshot?.revision === 40, null, { timeout: 2000 });
  const handle = page.getByRole('separator', { name: '文件侧栏宽度' });
  await equalGeometry(260, 'initial authoritative geometry');

  await page.mouse.move(260, 200); await page.mouse.down();
  await page.mouse.move(285, 200, { steps: 5 });
  const dragPreview = await equalGeometry(285, 'active drag preview');
  assert.equal(dragPreview.patchCount, 0);
  await page.keyboard.press('Escape');
  const cancelledBeforeUp = await equalGeometry(260, 'Escape restores active drag');
  await page.mouse.up(); const cancelledAfterUp = await equalGeometry(260, 'late pointerup after Escape');
  assert.equal(cancelledAfterUp.patchCount, 0);
  phase('active drag Escape restores CSS/ARIA and later pointerup makes zero commits', { dragPreview, cancelledBeforeUp, cancelledAfterUp });

  await handle.focus(); await page.keyboard.press('ArrowRight'); await waitPatches(1);
  await equalGeometry(261, 'Right preview'); await resolvePatch(0);
  await page.keyboard.press('Shift+ArrowRight'); await waitPatches(2);
  await equalGeometry(271, 'Shift+Right preview'); await resolvePatch(1);
  const beforeEscape = await equalGeometry(271, 'committed keyboard geometry');
  await page.keyboard.press('Escape'); const afterEscape = await equalGeometry(271, 'ordinary Escape');
  assert.equal(afterEscape.patchCount, 2); assert.equal(afterEscape.hostWidth, 271);
  phase('ordinary Escape preserves committed Right + ShiftRight and adds no commit', { beforeEscape, afterEscape });

  await handle.dblclick(); await waitPatches(3); await settle();
  const resetPreview = await equalGeometry(240, 'doubleclick default preview');
  assert.equal(resetPreview.patchCount, 3, 'two no-move pointerup events do not submit');
  await resolvePatch(2); const resetSaved = await equalGeometry(240, 'doubleclick default saved');
  assert.equal(resetSaved.hostRevision - beforeEscape.hostRevision, 1);
  await handle.dblclick(); await settle(); const resetAgain = await snapshot();
  assert.equal(resetAgain.patchCount, 3); assert.equal(resetAgain.hostRevision, resetSaved.hostRevision);
  phase('real headless doubleclick submits default once; already-default doubleclick submits zero', { resetPreview, resetSaved, resetAgain });

  await page.mouse.move(240, 200); await page.mouse.down();
  await page.mouse.move(260, 200, { steps: 4 }); await page.mouse.move(275, 200, { steps: 3 });
  const moved = await equalGeometry(275, 'multi-move drag'); assert.equal(moved.patchCount, 3);
  await page.mouse.up(); await waitPatches(4); await resolvePatch(3);
  const dragSaved = await equalGeometry(275, 'single pointerup commit');
  assert.equal(dragSaved.patchCount, 4);
  phase('multiple pointermove previews produce one changed pointerup commit', { moved, dragSaved });

  await handle.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await waitPatches(5);
  const queued = await equalGeometry(287, 'latest queued keyboard preview');
  assert.equal(queued.activePatches, 1); assert.equal(queued.patchCount, 5);
  await resolvePatch(4); await waitPatches(6);
  const firstQueuedSaved = await equalGeometry(287, 'latest preview after first queued snapshot');
  await resolvePatch(5); await waitPatches(7);
  const secondQueuedSaved = await equalGeometry(287, 'latest preview after second queued snapshot');
  await resolvePatch(6); const queueDrained = await equalGeometry(287, 'all queued keyboard saves complete');
  const queueFacts = await page.evaluate(() => ({
    maxActive: window.geometryHarness.maxActivePatches,
    patches: window.geometryHarness.patches.slice(4, 7).map(item => ({ expectedRevision: item.params.expectedRevision, value: item.params.changes[0].value, state: item.state })),
    errors: window.geometryHarness.errors.length,
  }));
  assert.equal(queueFacts.maxActive, 1); assert.equal(queueFacts.errors, 0);
  assert.deepEqual(queueFacts.patches.map(item => item.value), [276, 277, 287]);
  assert.deepEqual(queueFacts.patches.map(item => item.expectedRevision), [44, 45, 46]);
  assert.ok(queueFacts.patches.every(item => item.state === 'resolved'));
  phase('rapid keyboard saves serialize fresh revisions while preserving latest preview', { queued, firstQueuedSaved, secondQueuedSaved, queueDrained, queueFacts });

  await page.keyboard.press('Shift+ArrowRight'); await waitPatches(8);
  const failedPreview = await equalGeometry(297, 'preview before real host rejection');
  await page.evaluate(() => window.geometryHarness.rejectWithAuthoritative(7, 283));
  await page.waitForFunction(() => window.geometryHarness.errors.length === 1, null, { timeout: 2000 });
  const failureRestored = await equalGeometry(283, 'authoritative geometry after failed patch');
  assert.equal(failureRestored.snapshotWidth, 283); assert.equal(failureRestored.hostWidth, 283);
  assert.equal(failureRestored.patchCount, 8); assert.equal(failureRestored.errors[0].identity, 'original-write-error');
  assert.equal(await page.evaluate(() => window.geometryHarness.errors[0] === window.geometryHarness.rejected[0]), true);
  await page.keyboard.press('ArrowRight'); await waitPatches(9); await resolvePatch(8);
  const afterFailureSave = await equalGeometry(284, 'queue continues after failed save');
  assert.equal(afterFailureSave.patchCount, 9); assert.equal(afterFailureSave.errors.length, 1);
  phase('real write error refreshes authoritative CSS/ARIA, preserves original error, never retries, and does not poison queue', { failedPreview, failureRestored, afterFailureSave });

  assert.deepEqual(browserErrors, []); assert.deepEqual(consoleErrors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.error = String(error); evidence.stack = error.stack;
  process.exitCode = 1;
} finally {
  if (page) {
    try { evidence.final = await page.evaluate(() => window.geometryHarness?.export()); } catch (error) { evidence.captureError = String(error); }
  }
  evidence.browserErrors = browserErrors; evidence.consoleErrors = consoleErrors;
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  evidence.sourcesUnchanged = await Promise.all(sources.map(async source => ({ path: source.path, unchanged: sha256(await readFile(path.join(repository, source.path))) === source.sha256 })));
  evidence.completedAt = new Date().toISOString();
  evidence.durationMs = Date.now() - Date.parse(startedAt);
  await writeFile(resultPath, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, durationMs: evidence.durationMs, resultPath }));
}
