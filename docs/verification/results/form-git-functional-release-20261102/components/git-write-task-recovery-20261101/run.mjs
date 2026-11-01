import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(directory, 'source-sha.json'), 'utf8')), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { kind: 'real GitPanel/GitModal/bridge, controlled Tauri task channels and repo-lock wait; no native Git/GUI', startedAt: new Date().toISOString(), sources: metadata, scenarios: [], passed: false };
const cases = ['pending-return-stop', 'pending-ack-return', 'hidden-success', 'newer-draft', 'hidden-failure', 'history-split', 'late-status'];
async function bundle(variant) {
  const source = await readFile(path.join(directory, variant, metadata.change.path), 'utf8'), entry = await readFile(path.join(directory, 'entry.tsx'), 'utf8');
  const built = await build({ stdin: { contents: entry, resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, outfile: variant + '.js', jsx: 'automatic', format: 'iife', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'real-write-task-component-boundary', setup(b) {
    b.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, a => ({ path: a.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
    b.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, a => ({ contents: a.path === 'core' ? 'export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.gitWriteHarness.invoke(...args);' : 'export const listen=async()=>()=>{};', loader: 'js' }));
    b.onLoad({ filter: /\/features\/git\/GitPanel\.tsx$/ }, () => ({ contents: source, loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/features/git') }));
    b.onLoad({ filter: /\/features\/plugins\/service\.ts$/ }, () => ({ contents: 'export const usePluginEnabled=()=>true;', loader: 'js' }));
    b.onLoad({ filter: /\/features\/editor\/store\.ts$/ }, () => ({ contents: 'export const editorStore={getSnapshot:()=>({buffers:new Map()}),save:()=>{throw Error("Unexpected editor save");}};', loader: 'js' }));
    b.onLoad({ filter: /\/features\/git\/(DiffViewer|ConflictViewer)\.tsx$/ }, a => ({ contents: 'export const ' + path.basename(a.path, '.tsx') + '=()=>null;', loader: 'js' }));
  } }] });
  return { js: built.outputFiles.find(f => f.path.endsWith('.js')).text, css: built.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '', warnings: built.warnings.map(w => w.text) };
}
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const variant of ['before', 'after']) {
    const asset = await bundle(variant);
    for (const kind of cases) {
      const s = { variant, kind, warnings: asset.warnings, browserErrors: [], consoleErrors: [], observations: [], passed: false }; report.scenarios.push(s);
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(5000); page.on('pageerror', e => s.browserErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') s.consoleErrors.push(m.text()); });
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const capture = async label => { await settle(); const value = await page.evaluate(() => window.gitWriteHarness.capture()); s.observations.push({ label, ...value }); assert.ok(value.calls.every(c => ['git_status', 'git_mutate', 'git_branches', 'git_history', 'settings_get', 'session_get', 'session_update', 'task_cancel', 'stream_ack', 'service_subscribe', 'subscription_close'].includes(c.method))); return value; };
      const fill = async text => { await page.locator('#git-commit-message').fill(text); await settle(); };
      const start = async () => { await page.locator('form.git-commit').evaluate(form => { form.requestSubmit(); form.requestSubmit(); }); await page.waitForFunction(() => window.gitWriteHarness.writes.length === 1); await settle(); };
      const render = async p => { await page.evaluate(p => window.gitWriteHarness.render(p), p); await settle(); };
      const stopButton = snapshot => snapshot.buttons.find(b => b.text === '停止');
      const clearCalls = snapshot => snapshot.calls.filter(c => c.method === 'session_update' && c.scope.projectId === 'A' && c.params.commitDraft === '');
      try {
        await page.route('http://127.0.0.1:42766/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>' + asset.css + '.git-panel{height:100vh;width:600px}</style></head><body><div id="root"></div><script>' + asset.js + '</script></body></html>' })); await page.goto('http://127.0.0.1:42766/'); await page.locator('#git-commit-message').waitFor(); await settle();
        if (kind === 'history-split') {
          await page.evaluate(() => { window.gitWriteHarness.holdHistory = true; }); await page.getByRole('button', { name: '历史', exact: true }).click(); await page.waitForFunction(() => window.gitWriteHarness.historyReads.length === 1); for (let i = 0; i < 2; i++) { await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await settle(); } const history = await capture('same-repo status refresh while initial history pending'); assert.equal(history.historyReads, variant === 'after' ? 1 : 3);
        } else if (kind === 'late-status') {
          await page.evaluate(() => { window.gitWriteHarness.holdStatus = true; }); await page.getByRole('button', { name: '刷新 Git 状态', exact: true }).click(); await page.waitForFunction(() => window.gitWriteHarness.reads.length === 2); await fill('Owned foreground commit'); await start(); await page.evaluate(() => window.gitWriteHarness.complete('owned-write-1', 'success')); await settle(); await page.evaluate(() => window.gitWriteHarness.finishRead(window.gitWriteHarness.reads[1])); const late = await capture('pre-write status arrives after confirmed commit'); assert.equal(late.snapshot.snapshot.files.length, variant === 'after' ? 0 : 1); assert.equal(late.writes.length, 1);
        } else {
          const submitted = 'Owned commit ' + kind; if (kind === 'pending-ack-return') await page.evaluate(() => { window.gitWriteHarness.holdAck = true; }); await fill(submitted); await start(); const begun = await capture('one claimed write before any navigation'); assert.equal(begun.writes.length, 1);
          if (kind === 'pending-return-stop' || kind === 'pending-ack-return') {
            await render('B'); await page.getByText('尚未发现 Git 仓库', { exact: true }).waitFor(); await render('A');
            if (kind === 'pending-return-stop') { await page.evaluate(() => window.gitWriteHarness.unmount()); await settle(); await render('A'); }
            const returned = await capture('return/remount while original owned write remains active'); assert.equal(returned.writes[0].terminal, null); assert.equal(returned.writes.length, 1); assert.equal(!!stopButton(returned), variant === 'after'); assert.equal(returned.reads.filter(r => r.projectId === 'A').length, variant === 'after' ? 1 : kind === 'pending-return-stop' ? 3 : 2);
            if (variant === 'after') { assert.equal(returned.draft, submitted); assert.equal(stopButton(returned).disabled, kind === 'pending-ack-return'); await page.locator('form.git-commit').evaluate(form => form.requestSubmit()); assert.equal((await capture('single write remains locked across return')).writes.length, 1); }
            if (kind === 'pending-ack-return') { await page.evaluate(() => window.gitWriteHarness.ack('owned-write-1')); await settle(); if (variant === 'after') assert.equal((await capture('late ack restores same handle Stop')).buttons.find(b => b.text === '停止')?.disabled, false); }
            if (variant === 'after') { await page.getByRole('button', { name: '停止', exact: true }).click(); const stopping = await capture('Stop requests only same project task; no premature terminal'); assert.equal(stopping.writes[0].terminal, null); const cancels = stopping.calls.filter(c => c.method === 'task_cancel'); assert.equal(cancels.length, 1); assert.equal(cancels[0].params.taskId, 'owned-write-1'); assert.equal(cancels[0].scope.projectId, 'A'); assert.equal(cancels[0].scope.projectEpoch, stopping.epochs.A); assert.ok(stopping.buttons.some(b => b.text === '正在停止…' && b.disabled)); }
            await page.evaluate(() => window.gitWriteHarness.complete('owned-write-1', 'unknown')); const ended = await capture('actual task terminal unlocks and preserves unknown outcome/draft'); assert.equal(!!stopButton(ended), false); assert.equal(ended.storageA, submitted); assert.equal(ended.errors.some(e => e.includes('操作结果需要核对') || e.includes('可能已生效')), variant === 'after');
          } else {
            if (kind === 'newer-draft') await fill('Owned newer A draft'); await page.evaluate(() => { window.gitWriteHarness.nonrepoB = false; }); await render('B'); await page.locator('#git-commit-message').waitFor(); await fill('Owned independent B draft'); await page.evaluate(mode => window.gitWriteHarness.complete('owned-write-1', mode), kind === 'hidden-failure' ? 'failure' : 'success'); const hidden = await capture('completion while B remains visible'); assert.equal(hidden.projectId, 'B'); assert.equal(hidden.draft, 'Owned independent B draft'); assert.deepEqual(hidden.errors, []); assert.equal(hidden.notice, null); assert.equal(hidden.storageA, kind === 'newer-draft' ? 'Owned newer A draft' : variant === 'after' && kind === 'hidden-success' ? '' : submitted);
            await render('A'); await page.locator('#git-commit-message').waitFor(); const returned = await capture('return after hidden terminal uses fresh status and true outcome'); assert.equal(returned.draft, kind === 'newer-draft' ? 'Owned newer A draft' : variant === 'after' && kind === 'hidden-success' ? '' : submitted); assert.equal(returned.storageB, 'Owned independent B draft'); assert.equal(returned.errors.some(e => e.includes('受控提交失败')), variant === 'after' && kind === 'hidden-failure'); if (kind !== 'hidden-failure') assert.equal(!!returned.notice?.includes('已提交'), variant === 'after');
            if (variant === 'after' && kind === 'hidden-success') await page.waitForFunction(() => window.gitWriteHarness.calls.some(c => c.method === 'session_update' && c.scope.projectId === 'A' && c.params.commitDraft === ''));
            const persisted = await capture('submitted draft clear is conditional and at most once'); assert.equal(clearCalls(persisted).length, variant === 'after' && kind === 'hidden-success' ? 1 : 0); assert.equal(persisted.writes.length, 1);
            if (kind === 'hidden-success') { await render('B'); await render('A'); await page.locator('#git-commit-message').waitFor(); const consumed = await capture('consumed terminal is released rather than replayed/cached'); assert.equal(consumed.notice, null); assert.equal(clearCalls(consumed).length, variant === 'after' ? 1 : 0); }
          }
        }
        assert.deepEqual(s.browserErrors, []); assert.deepEqual(s.consoleErrors, []); s.passed = true;
      } finally { if (!s.passed) s.failure = await page.evaluate(() => ({ capture: window.gitWriteHarness?.capture(), text: document.body.innerText })).catch(e => ({ error: String(e) })); await page.close(); }
    }
  }
  report.passed = true;
} catch (error) { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close(); report.sourcesUnchanged = await Promise.all([{ path: metadata.change.path, sha256: metadata.change.productBeforeSha256 }, ...metadata.support].map(async s => ({ path: s.path, unchanged: sha(await readFile(path.join(repository, s.path))) === s.sha256 })));
  report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt); await writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, states: report.scenarios.map(({ variant, kind, passed }) => ({ variant, kind, passed })), durationMs: report.durationMs, sourcesUnchanged: report.sourcesUnchanged.every(s => s.unchanged), error: report.error, result: path.join(directory, 'result.json') }));
}
