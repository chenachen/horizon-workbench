import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.join(directory, 'after/apps/desktop/src/components/UnsavedChanges.tsx'), 'utf8');
const report = { kind: 'single failed-browser-fallback follow-up, unchanged real hook/bridge/Modal; no Rust/native dialog execution', startedAt: new Date().toISOString(), observations: [], browserErrors: [], consoleErrors: [], passed: false };
const bundle = await build({ stdin: { contents: await readFile(path.join(directory, 'entry.tsx'), 'utf8'), resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, outfile: 'native-discard.js', format: 'iife', jsx: 'automatic', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'real-hook-and-bridge-controlled-tauri', setup(build) {
  build.onLoad({ filter: /\/apps\/desktop\/src\/components\/UnsavedChanges\.tsx$/ }, () => ({ contents: source, loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/components') }));
  build.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, args => ({ path: args.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
  build.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, args => ({ contents: args.path === 'core' ? `export const isTauri=()=>window.nativeDiscardHarness.native;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.nativeDiscardHarness.invoke(...args);` : `export const listen=async()=>{throw Error('Unexpected native listener');};`, loader: 'js' }));
} }] });
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text, css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
let browser, page;
try {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(5000);
  page.on('pageerror', error => report.browserErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.route('http://127.0.0.1:42766/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>' + css + '</style></head><body><div id="root"></div><script>' + js + '</script></body></html>' }));
  await page.goto('http://127.0.0.1:42766/#browser');
  await page.waitForFunction(() => window.nativeDiscardHarness.owners.has('A') && window.nativeDiscardHarness.owners.has('B') && document.querySelector('dialog:modal'));
  await page.evaluate(() => {
    window.fallbackEvents = [];
    for (const type of ['keydown', 'click', 'cancel', 'close', 'focusin']) document.addEventListener(type, event => {
      const target = event.target;
      window.fallbackEvents.push({ type, key: event.key, target: target.id || target.getAttribute?.('aria-label') || target.textContent?.slice(0, 80), title: target.closest?.('dialog')?.querySelector('h2')?.textContent, active: document.activeElement?.id || document.activeElement?.textContent?.slice(0, 80), time: performance.now() });
    }, true);
  });
  const confirmation = page.getByRole('dialog', { name: '放弃未保存的修改？', exact: true });
  const capture = async label => { const value = await page.evaluate(() => ({ ...window.nativeDiscardHarness.capture(), domDialogs: [...document.querySelectorAll('dialog')].map(dialog => ({ open: dialog.open, modal: dialog.matches(':modal'), connected: dialog.isConnected, title: dialog.querySelector('h2')?.textContent })), focusedText: document.activeElement?.textContent })); report.observations.push({ label, ...value }); return value; };
  const ready = async () => { await confirmation.waitFor(); await page.waitForFunction(() => document.activeElement?.textContent === '继续编辑'); };
  const continued = async label => { await page.waitForFunction(label => window.nativeDiscardHarness.results[label] === false && ![...document.querySelectorAll('dialog')].some(dialog => dialog.querySelector('h2')?.textContent === '放弃未保存的修改？') && document.querySelector('#owned-model') === document.activeElement, label); const state = await capture(label); assert.equal(state.formPresent, true); assert.equal(state.model, 'owned-no-request'); assert.deepEqual(state.dialogs, ['Owned model form']); };
  await page.locator('#owned-model').focus(); await page.keyboard.press('Escape'); await ready(); await page.keyboard.press('Escape'); await continued('parent-close-0');
  await page.keyboard.press('Escape'); await ready(); await capture('second popup before Enter'); await page.keyboard.press('Enter'); await capture('immediate second Enter snapshot'); await continued('parent-close-1');
  await page.keyboard.press('Escape'); await ready(); await confirmation.getByRole('button', { name: '放弃修改', exact: true }).click(); await page.waitForFunction(() => window.nativeDiscardHarness.results['parent-close-2'] === true && !document.querySelector('#owned-model'));
  const discarded = await capture('browser explicit Discard'); assert.equal(discarded.calls.length, 0); assert.equal(discarded.formPresent, false); assert.deepEqual(Object.values(discarded.results), [false, false, true]);
  assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.consoleErrors, []); report.passed = true;
} catch (error) { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }
finally {
  if (page && !page.isClosed()) { report.finalState = await page.evaluate(() => ({ ...window.nativeDiscardHarness.capture(), events: window.fallbackEvents, html: document.body.innerHTML })).catch(error => ({ captureError: String(error) })); }
  if (browser) await browser.close(); report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt); await writeFile(path.join(directory, 'browser-fallback-result.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, observations: report.observations.length, durationMs: report.durationMs, error: report.error, result: path.join(directory, 'browser-fallback-result.json') }));
}
