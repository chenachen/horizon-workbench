import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const appRoot = path.join(repository, 'apps/desktop');
const desktopRequire = createRequire(path.join(appRoot, 'package.json'));
const { createServer } = await import(desktopRequire.resolve('vite'));
const { default: react } = await import(desktopRequire.resolve('@vitejs/plugin-react'));
const desktopConfig = JSON.parse(await readFile(path.join(appRoot, 'src-tauri/tauri.conf.json'), 'utf8'));
const mistManifest = JSON.parse(await readFile(path.join(repository, 'packages/plugins/builtins/horizon.theme.mist/manifest.json'), 'utf8'));
const mistTheme = mistManifest.contributes.themes[0];
function lightSyntaxColor(name) {
  const rule = mistTheme.tokenColors.light.find(rule => rule.name === name);
  assert.ok(rule?.settings.foreground, name + ' has a declared theme color');
  return rule.settings.foreground;
}
const bridgePath = path.join(appRoot, 'src/bridge.ts');
const entryId = '\0horizon-syntax-harness.js';
const output = process.argv[2];
const evidence = { kind: 'CodeSurface + plugin runtime + TextMate browser regression', contentSecurityPolicy: desktopConfig.app.security.csp, phases: [] };

const bridgeSource = `
export const nativeAvailable = () => true;
export const getProjectEpoch = () => 1;
export const call = (method, params = {}, projectId) => window.syntaxNative.call(method, params, projectId);
export async function start(method, params, onEvent, projectId) {
  const result = Promise.resolve().then(() => call(method, params, projectId));
  return { taskId: 'syntax-task', requestId: 'syntax-request', state: 'queued', result, completion: result, cancel: async () => {} };
}
export async function onEvent() { return async () => {}; }
export const errorMessage = error => error instanceof Error ? error.message : String(error);
`;

const entrySource = String.raw`
import React from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import CodeSurface, { editorCommands } from '/src/features/editor/CodeSurface.tsx';
import { editorStore, disposeEditorViews } from '/src/features/editor/store.ts';
import { pluginRuntime, refreshPlugins } from '/src/features/plugins/service.ts';
import { syntaxService } from '/src/features/editor/syntax.ts';
import { builtinPackages } from '/@fs/${repository}packages/plugins/src/builtins.ts';
import { getEditorDiagnostics } from '/@fs/${repository}packages/editor/src/metrics.ts';
import '/src/styles.css';
import '/src/features/editor/editor.css';

const projectId = 'syntax-project';
const javascriptId = 'horizon.language.javascript';
const customId = 'local.syntax.fixture';
const states = new Map();
const files = new Map();
const grammars = new Map();
const reads = [];
const activations = [];
const heldReads = [];
const holdNext = new Set();
let activationSequence = 0;
let documentSequence = 0;
let completedReads = 0;
const root = createRoot(document.getElementById('root'));
const clone = value => structuredClone(value);
const grammarKey = (id, scope) => id + ':' + scope;
const view = () => EditorView.findFromDOM(document.querySelector('.cm-editor'));

function stateFor(manifest) {
  return {
    id: manifest.id, revision: 1, installedVersion: manifest.version, installState: 'installed',
    pausedGlobal: false, pausedProject: false, effectivePaused: false,
    enabledGlobal: true, projectOverride: 'inherit', effectiveEnabled: true,
    runState: 'stopped', dependents: [], ownedResourceCount: 0, uiReclaim: 'released',
    manifest: clone(manifest),
  };
}

for (const id of [javascriptId, 'horizon.theme.mist']) {
  states.set(id, stateFor(builtinPackages.find(manifest => manifest.id === id)));
}

window.syntaxNative = {
  async call(method, params = {}, requestedProject) {
    if (method === 'extension_list') return { items: clone([...states.values()]) };
    if (method === 'extension_activate') {
      const state = states.get(params.extensionId);
      if (!state?.effectiveEnabled || state.effectivePaused) throw new Error('Extension is disabled');
      activations.push(clone(params));
      state.runState = 'active';
      state.activationId = state.id + ':' + (++activationSequence);
      state.revision++;
      return clone(state);
    }
    if (method === 'extension_read_grammar') {
      const state = states.get(params.extensionId);
      const declaration = state?.manifest.contributes.grammars?.find(grammar => grammar.scopeName === params.scopeName);
      if (!state?.effectiveEnabled || state.effectivePaused || !declaration) throw new Error('Grammar is unavailable');
      reads.push(clone(params));
      const key = grammarKey(params.extensionId, params.scopeName);
      const inline = grammars.get(key);
      const grammar = inline ? clone(inline) : await fetch('/__syntax_grammar?' + new URLSearchParams(params)).then(response => {
        if (!response.ok) throw new Error('Fixture grammar HTTP ' + response.status);
        return response.json();
      });
      if (holdNext.delete(key)) await new Promise(resolve => heldReads.push({ key, resolve }));
      completedReads++;
      return grammar;
    }
    if (method === 'document_open') {
      const text = files.get(params.fileId);
      if (text === undefined) throw new Error('Unknown fixture file ' + params.fileId);
      return {
        mode: 'editor', text, simplified: false,
        meta: {
          documentId: 'syntax-document-' + (++documentSequence),
          file: { projectId: requestedProject, fileId: params.fileId, displayPath: params.fileId },
          editorRevision: 0, baseDiskRevision: { token: 'fixture', contentHash: 'fixture', byteLength: String(text.length), modifiedAt: '2026-11-15' },
          encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false,
        },
      };
    }
    if (method === 'document_checkpoint') return { checkpointId: params.documentId, editorRevision: params.editorRevision };
    if (['session_update', 'document_mark_dirty', 'document_close', 'extension_report_error'].includes(method)) return {};
    throw new Error('Unhandled syntax fixture method ' + method);
  },
};

function applyMode(mode) {
  const element = document.documentElement;
  const colors = states.get('horizon.theme.mist').manifest.contributes.themes[0][mode];
  element.dataset.mode = mode;
  element.dataset.theme = 'mist';
  for (const [key, value] of Object.entries(colors)) element.style.setProperty('--' + (key === 'onAccent' ? 'on-accent' : key), value);
}

function colorOf(fragment) {
  const content = document.querySelector('.cm-content');
  if (!content) return null;
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent.includes(fragment)) continue;
    const element = walker.currentNode.parentElement;
    return { color: getComputedStyle(element).color, marked: !!element.closest('[class*="cm-tm-fg-"]'), text: walker.currentNode.textContent };
  }
  return null;
}

function bufferSnapshot() {
  const buffer = editorStore.getActive(projectId);
  return { fileId: buffer?.fileId, text: buffer?.getText(), selection: clone(buffer?.selection), dirty: buffer?.dirty };
}

function customGrammar(scope) {
  return {
    scopeName: 'source.horizon-fixture',
    patterns: [
      { match: '\\bMAGIC\\b', name: scope },
      { begin: '"', end: '"', name: 'string.quoted.double.fixture' },
    ],
  };
}

window.syntaxHarness = {
  projectId, javascriptId, customId,
  async initialize() {
    applyMode('light');
    await refreshPlugins(projectId);
    editorStore.setProject(projectId, 1);
    root.render(React.createElement(CodeSurface, { projectId }));
  },
  seed(fileId, text) { files.set(fileId, text); },
  open(fileId) { return editorStore.openFile(fileId, { projectId }); },
  async enabled(id, enabled) {
    const state = states.get(id);
    state.enabledGlobal = enabled;
    state.effectiveEnabled = enabled;
    state.runState = 'stopped';
    delete state.activationId;
    state.revision++;
    await refreshPlugins(projectId, true);
  },
  async tokenColors() {
    const state = states.get('horizon.theme.mist');
    state.manifest.contributes.themes[0].tokenColors = {
      light: [
        { scope: ['keyword', 'storage.type'], settings: { foreground: '#a21c44' } },
        { scope: 'string', settings: { foreground: '#39674e' } },
        { scope: 'comment', settings: { foreground: '#65738a' } },
        { scope: 'constant', settings: { foreground: '#b25410' } },
      ],
      dark: [
        { scope: ['keyword', 'storage.type'], settings: { foreground: '#d9b35f' } },
        { scope: 'string', settings: { foreground: '#9ad4b0' } },
        { scope: 'comment', settings: { foreground: '#a6b4cb' } },
        { scope: 'constant', settings: { foreground: '#e09d5d' } },
      ],
    };
    state.revision++;
    await refreshPlugins(projectId, true);
  },
  async emptyTokenColors() {
    const state = states.get('horizon.theme.mist');
    state.manifest.contributes.themes[0].tokenColors.dark = [];
    state.revision++;
    await refreshPlugins(projectId, true);
  },
  mode: applyMode,
  async installCustom() {
    const manifest = {
      id: customId, name: 'Fixture language', version: '0.1.0', description: 'Fixture syntax', author: 'Horizon tests',
      apiVersion: 1, engines: { horizon: '>=0.1.0 <0.2.0' }, runtime: { kind: 'declarative' },
      activation: ['onLanguage:fixture'], requires: {}, optional: {}, capabilities: [],
      contributes: {
        languages: [{ id: 'fixture', aliases: ['Fixture'], extensions: ['.fixture'] }],
        grammars: [{ language: 'fixture', scopeName: 'source.horizon-fixture', path: 'syntaxes/fixture.tmLanguage.json' }],
      },
    };
    states.set(customId, stateFor(manifest));
    grammars.set(grammarKey(customId, 'source.horizon-fixture'), customGrammar('keyword.control.fixture'));
    await refreshPlugins(projectId, true);
  },
  async reloadCustom(scope, hold = false) {
    const key = grammarKey(customId, 'source.horizon-fixture');
    grammars.set(key, customGrammar(scope));
    if (hold) holdNext.add(key);
    const before = clone(states.get(customId).manifest);
    states.get(customId).revision++;
    await refreshPlugins(projectId, true);
    return { before, after: clone(states.get(customId).manifest) };
  },
  async releaseReads() {
    const pending = heldReads.splice(0);
    for (const read of pending) read.resolve();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return pending.length;
  },
  select(anchor, head = anchor) { view().dispatch({ selection: { anchor, head } }); },
  undo: editorCommands.undo,
  redo: editorCommands.redo,
  colorOf,
  bufferSnapshot,
  diagnostics: getEditorDiagnostics,
  inspect() {
    return {
      ...bufferSnapshot(), marked: document.querySelectorAll('[class*="cm-tm-fg-"]').length,
      reads: clone(reads), activations: clone(activations), heldReads: heldReads.length, completedReads,
      diagnostics: getEditorDiagnostics(), errors: editorStore.getSnapshot().error,
      language: syntaxService.languageId(projectId, editorStore.getActive(projectId)?.path ?? ''),
      colors: Object.fromEntries(['const', 'hello', 'cached', '42', 'MAGIC', 'external', 'note'].map(fragment => [fragment, colorOf(fragment)])),
    };
  },
  async dispose() { root.unmount(); await disposeEditorViews(projectId); await pluginRuntime.dispose(); },
};
`;

const html = '<!doctype html><html><head><meta charset="utf-8"></head><body><main id="root" style="display:flex;flex-direction:column;width:900px;height:500px"></main><div id="editor-status-slot"></div><script type="module" src="/virtual:syntax-harness"></script></body></html>';

const fixturePlugin = {
  name: 'horizon-syntax-browser-fixture',
  enforce: 'pre',
  resolveId(id) { if (id === '/virtual:syntax-harness') return entryId; },
  load(id) {
    if (id === entryId) return entrySource;
    if (id.split('?')[0] === bridgePath) return bridgeSource;
  },
  configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      if (url.pathname === '/syntax-plugins') {
        response.setHeader('Content-Type', 'text/html');
        response.setHeader('Content-Security-Policy', desktopConfig.app.security.csp);
        response.end(await server.transformIndexHtml(url.pathname, html));
        return;
      }
      if (url.pathname !== '/__syntax_grammar') return next();
      try {
        const extensionId = url.searchParams.get('extensionId');
        const scopeName = url.searchParams.get('scopeName');
        const directory = path.join(repository, 'packages/plugins/builtins', extensionId);
        const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
        const grammar = manifest.contributes.grammars.find(item => item.scopeName === scopeName);
        if (!grammar) throw new Error('Undeclared fixture grammar');
        response.setHeader('Content-Type', 'application/json');
        response.end(await readFile(path.join(directory, grammar.path)));
      } catch (error) {
        response.statusCode = 404;
        response.end(String(error));
      }
    });
  },
};

function rgb(hex) {
  return 'rgb(' + [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ') + ')';
}

const pageErrors = [];
const cspErrors = [];
let browser;
let server;
let page;

async function waitColor(fragment, color) {
  await page.waitForFunction(({ fragment, color }) => {
    const token = window.syntaxHarness.colorOf(fragment);
    return token?.marked && token.color === color;
  }, { fragment, color: rgb(color) }, { timeout: 15000 });
}

async function waitPlain() {
  await page.waitForFunction(() => window.syntaxHarness.inspect().marked === 0 && window.syntaxHarness.inspect().language === 'plain');
}

async function observe(name) {
  const snapshot = await page.evaluate(() => window.syntaxHarness.inspect());
  assert.equal(snapshot.diagnostics.viewCount, 1, name + ' keeps one EditorView');
  assert.equal(snapshot.errors, null, name + ' has no editor error');
  evidence.phases.push({ name, ...snapshot });
  return snapshot;
}

async function append(text) {
  await page.evaluate(() => {
    const harness = window.syntaxHarness;
    harness.select(harness.bufferSnapshot().text.length);
  });
  await page.locator('.cm-content').focus();
  await page.keyboard.type(text);
  return page.evaluate(() => window.syntaxHarness.bufferSnapshot());
}

try {
  server = await createServer({
    configFile: false, root: appRoot, appType: 'custom', clearScreen: false, logLevel: 'warn',
    cacheDir: path.join(repository, '.work/vite-syntax-plugins'),
    plugins: [fixturePlugin, react()],
    server: { host: '127.0.0.1', port: 0, hmr: false, fs: { allow: [repository] } },
  });
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1100, height: 720 } });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => { if (/content security policy|violates.*policy/i.test(message.text())) cspErrors.push(message.text()); });
  await page.goto('http://127.0.0.1:' + address.port + '/syntax-plugins');
  await page.waitForFunction(() => !!window.syntaxHarness);

  const firstSource = 'const answer: string = "hello";\n// note\nconst count = 42;\nfunction greet(user: string) { return user.trim(); }';
  const secondSource = 'const second = "cached";\nconst amount = 42;\n// cached note';
  await page.evaluate(async ({ firstSource, secondSource }) => {
    const harness = window.syntaxHarness;
    harness.seed('first.ts', firstSource);
    harness.seed('second.ts', secondSource);
    harness.seed('custom.fixture', 'MAGIC "external"\nplain');
    await harness.initialize();
    await harness.open('first.ts');
  }, { firstSource, secondSource });
  await waitColor('const', lightSyntaxColor('Keywords'));
  await waitColor('hello', lightSyntaxColor('Strings'));
  await waitColor('note', lightSyntaxColor('Comments'));
  await waitColor('greet', lightSyntaxColor('Functions'));
  await waitColor('user', lightSyntaxColor('Parameters'));
  await waitColor('42', lightSyntaxColor('Numbers and constants'));
  await observe('TypeScript theme colors cover keywords, strings, comments, functions, parameters and numbers');
  const firstEdited = await append(' // retained-first');

  await page.evaluate(() => window.syntaxHarness.open('second.ts'));
  await waitColor('cached', lightSyntaxColor('Strings'));
  const secondEdited = await append(' // retained-second');
  await page.evaluate(() => window.syntaxHarness.select(2, 7));
  const secondSelected = await page.evaluate(() => window.syntaxHarness.bufferSnapshot());
  await page.evaluate(() => window.syntaxHarness.enabled(window.syntaxHarness.javascriptId, false));
  await waitPlain();
  const disabledSecond = await observe('Disabling language updates active file');
  assert.equal(disabledSecond.text, secondEdited.text);
  assert.deepEqual(disabledSecond.selection, secondSelected.selection);

  await page.evaluate(() => window.syntaxHarness.open('first.ts'));
  await page.waitForFunction(() => window.syntaxHarness.bufferSnapshot().fileId === 'first.ts');
  await waitPlain();
  const disabledFirst = await observe('Disabling language updates inactive cached file');
  assert.equal(disabledFirst.text, firstEdited.text);
  assert.deepEqual(disabledFirst.selection, firstEdited.selection);
  assert.equal(await page.evaluate(() => window.syntaxHarness.undo()), true);
  assert.equal(await page.evaluate(() => window.syntaxHarness.bufferSnapshot().text), firstSource);
  assert.equal(await page.evaluate(() => window.syntaxHarness.redo()), true);
  assert.equal(await page.evaluate(() => window.syntaxHarness.bufferSnapshot().text), firstEdited.text);

  await page.evaluate(() => window.syntaxHarness.enabled(window.syntaxHarness.javascriptId, true));
  await waitColor('hello', lightSyntaxColor('Strings'));
  const enabledFirst = await observe('Enabling language restores active highlight and undo');
  assert.equal(enabledFirst.text, firstEdited.text);
  assert.deepEqual(enabledFirst.selection, firstEdited.selection);
  await page.evaluate(() => window.syntaxHarness.open('second.ts'));
  await waitColor('cached', lightSyntaxColor('Strings'));
  assert.equal(await page.evaluate(() => window.syntaxHarness.bufferSnapshot().text), secondEdited.text);
  assert.deepEqual(await page.evaluate(() => window.syntaxHarness.bufferSnapshot().selection), secondSelected.selection);
  assert.equal(await page.evaluate(() => window.syntaxHarness.undo()), true);
  assert.equal(await page.evaluate(() => window.syntaxHarness.bufferSnapshot().text), secondSource);
  assert.equal(await page.evaluate(() => window.syntaxHarness.redo()), true);
  await observe('Enabling language restores inactive highlight and undo');

  await page.evaluate(() => window.syntaxHarness.tokenColors());
  await waitColor('const', '#a21c44');
  await waitColor('42', '#b25410');
  await observe('Light tokenColors parent scope colors numeric tokens');
  await page.evaluate(() => window.syntaxHarness.mode('dark'));
  await waitColor('const', '#d9b35f');
  await waitColor('cached', '#9ad4b0');
  await waitColor('42', '#e09d5d');
  await observe('Dark tokenColors and palette apply to open editor');
  await page.evaluate(() => window.syntaxHarness.emptyTokenColors());
  await waitColor('const', '#e0e8f5');
  await waitColor('cached', '#e0e8f5');
  await waitColor('42', '#e0e8f5');
  await observe('Explicit empty tokenColors uses theme base foreground');
  await page.evaluate(() => window.syntaxHarness.tokenColors());
  await waitColor('const', '#d9b35f');

  await page.evaluate(async () => { await window.syntaxHarness.installCustom(); await window.syntaxHarness.open('custom.fixture'); });
  await waitColor('MAGIC', '#d9b35f');
  await waitColor('external', '#9ad4b0');
  const custom = await observe('Third-party language activates and reads declared grammar');
  assert.ok(custom.reads.some(read => read.extensionId === 'local.syntax.fixture' && read.scopeName === 'source.horizon-fixture'));
  assert.ok(custom.activations.some(item => item.extensionId === 'local.syntax.fixture' && item.reason.kind === 'language' && item.reason.id === 'fixture'));

  const reload = await page.evaluate(() => window.syntaxHarness.reloadCustom('comment.line.fixture'));
  assert.deepEqual(reload.before, reload.after, 'Development reload keeps same manifest');
  await waitColor('MAGIC', '#a6b4cb');
  const reloaded = await observe('Same-manifest revision reloads grammar');
  assert.ok(reloaded.reads.filter(read => read.extensionId === 'local.syntax.fixture').length > custom.reads.filter(read => read.extensionId === 'local.syntax.fixture').length);

  const beforeDelay = await page.evaluate(() => window.syntaxHarness.bufferSnapshot());
  await page.evaluate(() => window.syntaxHarness.reloadCustom('keyword.control.fixture', true));
  await page.waitForFunction(() => window.syntaxHarness.inspect().heldReads > 0);
  await page.evaluate(() => window.syntaxHarness.enabled(window.syntaxHarness.customId, false));
  await waitPlain();
  assert.ok(await page.evaluate(() => window.syntaxHarness.releaseReads()) > 0);
  await waitPlain();
  const delayed = await observe('Delayed grammar completion after disable stays plain');
  assert.equal(delayed.text, beforeDelay.text);
  assert.deepEqual(delayed.selection, beforeDelay.selection);
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(cspErrors, []);

  await page.evaluate(() => window.syntaxHarness.dispose());
  const diagnostics = await page.evaluate(() => window.syntaxHarness.diagnostics());
  assert.equal(diagnostics.viewCount, 0);
  assert.equal(diagnostics.createdViews, diagnostics.destroyedViews);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.error = String(error);
  evidence.pageErrors = pageErrors;
  evidence.cspErrors = cspErrors;
  if (page) evidence.current = await page.evaluate(() => window.syntaxHarness?.inspect()).catch(() => undefined);
  process.exitCode = 1;
} finally {
  if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, pageErrors, cspErrors, output }));
  await browser?.close();
  await server?.close();
}
