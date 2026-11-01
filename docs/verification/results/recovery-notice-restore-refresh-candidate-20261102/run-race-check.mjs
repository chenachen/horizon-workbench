import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const variant = process.argv[2]; if (!['before', 'after'].includes(variant)) throw Error('Expected before or after');
const sourcePath = 'apps/desktop/src/features/editor/RecoveryNotice.tsx';
const source = await readFile(path.join(directory, variant, sourcePath), 'utf8');
const report = { kind: 'real RecoveryNotice and EditorStore; controlled RPC completion order only; no native app/Rust/disk fixture/crash execution', variant, sourceSHA256: createHash('sha256').update(source).digest('hex'), startedAt: new Date().toISOString(), phases: [], pageErrors: [], consoleErrors: [], passed: false };
const bundle = await build({ stdin: { contents: await readFile(path.join(directory, 'entry.tsx'), 'utf8'), resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, format: 'iife', jsx: 'automatic', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'actual-component-store-controlled-rpc', setup(builder) {
  builder.onLoad({ filter: /\/apps\/desktop\/src\/features\/editor\/RecoveryNotice\.tsx$/ }, () => ({ contents: source, loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/features/editor') }));
  builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$/ }, args => /\/features\/editor\/(RecoveryNotice\.tsx|store\.ts)$/.test(args.importer) ? { path: 'controlled-rpc', namespace: 'controlled-rpc' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'controlled-rpc' }, () => ({ contents: 'export const call = (...args) => window.recoveryRestoreHarness.request(...args);', loader: 'js' }));
} }] });
let browser, currentPage;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capture = async (page, label) => { const state = await page.evaluate(() => window.recoveryRestoreHarness.capture()); report.phases.push({ label, ...state }); return state; };
const waitLists = (page, count) => page.waitForFunction(count => window.recoveryRestoreHarness.lists.length === count, count, { timeout: 3000 });
try {
  browser = await chromium.launch({ headless: true });
  const prepare = async () => {
    const page = currentPage = await browser.newPage(); page.setDefaultTimeout(3000);
    page.on('pageerror', error => report.pageErrors.push(error.message)); page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    await page.route('http://127.0.0.1:42767/', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><div id="root"></div><script>' + bundle.outputFiles[0].text + '</script></body></html>' }));
    await page.goto('http://127.0.0.1:42767/'); await waitLists(page, 1); await page.evaluate(() => window.recoveryRestoreHarness.releaseList(0));
    await page.getByRole('button', { name: '比较草稿与磁盘', exact: true }).click();
    const comparison = page.getByRole('dialog', { name: '恢复草稿与磁盘内容比较', exact: true }); await comparison.waitFor();
    await comparison.getByRole('button', { name: '恢复到编辑器', exact: true }).click();
    await page.waitForFunction(() => !!window.recoveryRestoreHarness.pendingMark); await waitLists(page, 2);
    await page.evaluate(() => window.recoveryRestoreHarness.releaseMark()); await page.waitForFunction(() => !!window.recoveryRestoreHarness.pendingCheckpoint);
    await page.evaluate(() => window.recoveryRestoreHarness.releaseCheckpoint()); await page.waitForFunction(() => !!window.recoveryRestoreHarness.pendingCleanup); await waitLists(page, 3);
    return page;
  };

  const page = await prepare();
  const pending = await capture(page, 'real restore emitted old checkpoint then new checkpoint; old list responses held while recovery_resolve pending');
  assert.deepEqual(pending.lists[1].checkpointIds, ['cp-old']); assert.deepEqual(pending.lists[2].checkpointIds, ['cp-old', 'cp-new']); assert.equal(pending.buffer.checkpointId, 'cp-new');
  await page.evaluate(() => window.recoveryRestoreHarness.releaseCleanup()); await settle(page);
  const completed = await capture(page, 'store restore completed after old checkpoint deletion, before delayed old list replies');
  if (completed.lists.length > 3) await page.evaluate(() => window.recoveryRestoreHarness.releaseList(3));
  await page.evaluate(() => { const h = window.recoveryRestoreHarness; h.releaseList(1); h.releaseList(2); }); await settle(page);
  const final = await capture(page, 'delayed pre-cleanup list replies delivered after successful restore');
  assert.deepEqual(final.retainedCheckpointIds, ['cp-new']); assert.deepEqual(final.buffer, { projectId: 'a', checkpointId: 'cp-new', checkpointVersion: 1, version: 1, dirty: true, text: 'recovered draft text\n', selection: { anchor: 6, head: 6 } });
  assert.equal(final.candidateIds.length, 0, 'successful restore must invalidate stale old-checkpoint list responses');
  assert.equal(final.noticeText, ''); assert.equal(final.comparisonPresent, false); assert.equal(final.lists.length, 4, 'success explicitly refreshes after recovery_resolve');
  await page.close();

  const switched = await prepare(); await switched.evaluate(() => window.recoveryRestoreHarness.switchProject()); await waitLists(switched, 4); await switched.evaluate(() => window.recoveryRestoreHarness.releaseList(3)); await switched.getByRole('option', { name: /beta\.txt/ }).waitFor({ state: 'attached' });
  await switched.evaluate(() => { const h = window.recoveryRestoreHarness; h.releaseCleanup(); h.releaseList(1); h.releaseList(2); }); await settle(switched);
  const switchState = await capture(switched, 'project switched while restore pending: old completion cannot clear or refresh new project notice'); assert.equal(switchState.projectId, 'b'); assert.deepEqual(switchState.candidateIds, ['cp-beta']); assert.equal(switchState.lists.length, 4); assert.equal(switchState.comparisonPresent, false); await switched.close();

  const unmounted = await prepare(); await unmounted.evaluate(() => window.recoveryRestoreHarness.unmount()); await unmounted.evaluate(() => { const h = window.recoveryRestoreHarness; h.releaseCleanup(); h.releaseList(1); h.releaseList(2); }); await settle(unmounted);
  const unmountState = await capture(unmounted, 'unmounted notice: late restore/list completion performs no refresh or UI revival'); assert.equal(unmountState.rootHTML, ''); assert.equal(unmountState.lists.length, 3); await unmounted.close();
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); report.passed = true;
} catch (error) {
  report.error = String(error); report.stack = error.stack;
  if (currentPage && !currentPage.isClosed()) await capture(currentPage, 'failure state').catch(error => { report.captureError = String(error); });
  process.exitCode = 1;
} finally {
  if (browser) await browser.close(); report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt);
  await writeFile(path.join(directory, variant + '-race-result.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ variant, passed: report.passed, phases: report.phases.length, durationMs: report.durationMs, error: report.error, result: path.join(directory, variant + '-race-result.json') }));
}
