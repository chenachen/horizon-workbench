import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const sources = new Map(await Promise.all(['UnsavedChanges', 'Modal'].map(async name => [name, await readFile(path.join(directory, 'after/apps/desktop/src/components/' + name + '.tsx'), 'utf8')])));
const report = { kind: 'real useDiscardConfirmation/bridge/Modal/ErrorNotice; controlled Tauri invoke; no Rust/native dialog execution', startedAt: new Date().toISOString(), observations: [], browserErrors: [], consoleErrors: [], passed: false };
const bundle = await build({ stdin: { contents: await readFile(path.join(directory, 'entry.tsx'), 'utf8'), resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, outfile: 'native-discard.js', format: 'iife', jsx: 'automatic', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'real-hook-and-bridge-controlled-tauri', setup(build) {
  build.onLoad({ filter: /\/apps\/desktop\/src\/components\/(UnsavedChanges|Modal)\.tsx$/ }, args => ({ contents: sources.get(path.basename(args.path, '.tsx')), loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/components') }));
  build.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, args => ({ path: args.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
  build.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, args => ({ contents: args.path === 'core' ? `export const isTauri=()=>window.nativeDiscardHarness.native;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.nativeDiscardHarness.invoke(...args);` : `export const listen=async()=>{throw Error('Unexpected native listener');};`, loader: 'js' }));
} }] });
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text, css = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? '';
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); page.setDefaultTimeout(5000);
  const observeErrors = page => { page.on('pageerror', error => report.browserErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); }); };
  const open = async (page, hash = '') => { observeErrors(page); await page.route('http://127.0.0.1:42766/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>' + css + '</style></head><body><div id="root"></div><script>' + js + '</script></body></html>' })); await page.goto('http://127.0.0.1:42766/' + hash); await page.waitForFunction(() => window.nativeDiscardHarness.owners.has('A') && window.nativeDiscardHarness.owners.has('B') && document.querySelector('dialog:modal')); };
  const capture = async (page, label) => { const value = await page.evaluate(() => window.nativeDiscardHarness.capture()); report.observations.push({ label, ...value }); return value; };
  const result = async (page, label) => { await page.waitForFunction(label => Object.hasOwn(window.nativeDiscardHarness.results, label), label); return page.evaluate(label => window.nativeDiscardHarness.results[label], label); };
  await open(page);
  await page.evaluate(() => { const h = window.nativeDiscardHarness; h.ask('A', 'clean', false); h.ask('A', 'busy', true, true); });
  assert.equal(await result(page, 'clean'), true); assert.equal(await result(page, 'busy'), false); assert.equal((await capture(page, 'clean and busy require no RPC')).calls.length, 0);
  await page.locator('#owned-model').focus();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.nativeDiscardHarness.calls.length === 1);
  await page.locator('#owned-other').focus();
  await page.evaluate(() => { const h = window.nativeDiscardHarness; h.ask('A', 'same-owner-pending'); h.ask('B', 'other-owner-cancel'); });
  assert.equal(await result(page, 'same-owner-pending'), false); await page.waitForFunction(() => window.nativeDiscardHarness.calls.length === 2);
  await page.evaluate(() => window.nativeDiscardHarness.reply(1, false)); assert.equal(await result(page, 'other-owner-cancel'), false);
  assert.equal(await page.evaluate(() => Object.hasOwn(window.nativeDiscardHarness.results, 'parent-close-2')), false);
  await page.evaluate(() => window.nativeDiscardHarness.reply(0, false)); assert.equal(await result(page, 'parent-close-2'), false);
  const continued = await capture(page, 'native false restores element captured at call time; same-owner pending guarded; second hook false does not settle first');
  assert.equal(continued.focusedId, 'owned-model'); assert.equal(continued.model, 'owned-no-request'); assert.deepEqual(continued.dialogs, ['Owned model form']); assert.deepEqual(continued.nativeCalls.map(call => call.operation), ['showModal']);
  assert.equal(continued.calls.every(call => call.method === 'form_discard_confirm' && call.scope.kind === 'app' && Object.keys(call.params).length === 0), true);
  await page.locator('#owned-model').focus(); await page.evaluate(() => window.nativeDiscardHarness.ask('A', 'native-error')); await page.waitForFunction(() => window.nativeDiscardHarness.calls.length === 3); await page.locator('#owned-other').focus(); await page.evaluate(() => window.nativeDiscardHarness.fail(2));
  assert.equal(await result(page, 'native-error'), false); await page.getByRole('alert').getByText(/确认未完成，修改已保留/).waitFor();
  const failed = await capture(page, 'native failure is false and visible ErrorNotice; no HTML confirmation fallback');
  assert.equal(failed.focusedId, 'owned-model'); assert.equal(failed.model, 'owned-no-request'); assert.deepEqual(failed.dialogs, ['Owned model form']); assert.equal(await page.getByRole('dialog', { name: '放弃未保存的修改？', exact: true }).count(), 0);
  await page.getByRole('button', { name: '关闭错误提示', exact: true }).click();
  await page.locator('#owned-model').focus(); await page.evaluate(() => window.nativeDiscardHarness.ask('A', 'unmounted', true, false, true)); await page.waitForFunction(() => window.nativeDiscardHarness.calls.length === 4); await page.locator('#owned-other').focus(); await page.evaluate(() => window.nativeDiscardHarness.setOwnerA(false));
  assert.equal(await result(page, 'unmounted'), false); assert.equal(await page.locator('#owned-other').evaluate(element => document.activeElement === element), true);
  await page.evaluate(() => window.nativeDiscardHarness.reply(3, true)); await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const unmounted = await capture(page, 'unmount resolves false without focus; late true reply cannot discard or resurrect'); assert.equal(unmounted.results.unmounted, false); assert.equal(unmounted.focusedId, 'owned-other'); assert.equal(unmounted.formPresent, true); assert.equal(unmounted.alerts.length, 0);
  await page.evaluate(() => window.nativeDiscardHarness.setOwnerA(true)); await page.waitForFunction(() => window.nativeDiscardHarness.owners.has('A')); await page.locator('#owned-model').focus(); await page.evaluate(() => window.nativeDiscardHarness.ask('A', 'native-true', true, false, true)); await page.waitForFunction(() => window.nativeDiscardHarness.calls.length === 5); await page.evaluate(() => window.nativeDiscardHarness.reply(4, true));
  assert.equal(await result(page, 'native-true'), true); await page.waitForFunction(() => !document.querySelector('#owned-model'));
  const discarded = await capture(page, 'explicit native true reaches caller; caller unmounts form without helper revival'); assert.equal(discarded.formPresent, false); assert.deepEqual(discarded.dialogs, []); assert.equal(discarded.calls.every(call => call.scope.kind === 'app' && Object.keys(call.params).length === 0), true);
  await page.close();

  const browserPage = await browser.newPage({ viewport: { width: 1280, height: 800 } }); await open(browserPage, '#browser'); const parent = browserPage.getByRole('dialog', { name: 'Owned model form', exact: true }), confirmation = browserPage.getByRole('dialog', { name: '放弃未保存的修改？', exact: true });
  await browserPage.locator('#owned-model').focus(); await browserPage.keyboard.press('Escape'); await confirmation.waitFor(); assert.equal(await confirmation.getByRole('button', { name: '继续编辑', exact: true }).evaluate(button => document.activeElement === button), true); await browserPage.keyboard.press('Escape'); await confirmation.waitFor({ state: 'hidden' }); assert.equal(await browserPage.locator('#owned-model').evaluate(input => document.activeElement === input), true); assert.equal(await parent.count(), 1);
  await browserPage.keyboard.press('Escape'); await confirmation.waitFor(); await browserPage.keyboard.press('Enter'); await confirmation.waitFor({ state: 'hidden' }); assert.equal(await parent.count(), 1); assert.equal(await browserPage.locator('#owned-model').evaluate(input => document.activeElement === input), true);
  await browserPage.keyboard.press('Escape'); await confirmation.waitFor(); await confirmation.getByRole('button', { name: '放弃修改', exact: true }).click(); await browserPage.waitForFunction(() => !document.querySelector('#owned-model'));
  const fallback = await capture(browserPage, 'browser-only original Modal fallback: default Continue/Enter and Escape false, explicit discard true'); assert.equal(fallback.calls.length, 0); assert.equal(fallback.formPresent, false); assert.deepEqual(Object.values(fallback.results), [false, false, true]); await browserPage.close();
  assert.deepEqual(report.browserErrors, []); assert.deepEqual(report.consoleErrors, []); report.passed = true;
} catch (error) { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }
finally { if (browser) await browser.close(); report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt); await writeFile(path.join(directory, 'modal-escape-hook-result.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, observations: report.observations.length, durationMs: report.durationMs, error: report.error, result: path.join(directory, 'modal-escape-hook-result.json') })); }
