import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(directory, 'source-sha.json'), 'utf8')), sha = x => createHash('sha256').update(x).digest('hex');
const report = { kind: 'real GitPanel/GitModal/bridge; controlled Tauri branch/status data; no real repository or native GUI', startedAt: new Date().toISOString(), sources: metadata, scenarios: [], passed: false };
const cases = ['cached-current', 'refs-remotes-drafts', 'late-success', 'late-rejection', 'project-boundary', 'token-mismatch-recovery'];
async function bundle(variant) {
  const component = await readFile(path.join(directory, variant, metadata.change.path), 'utf8'), entry = await readFile(path.join(directory, 'entry.tsx'), 'utf8');
  const result = await build({ stdin: { contents: entry, resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, outfile: variant + '.js', format: 'iife', jsx: 'automatic', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'small-real-GitPanel-boundary', setup(b) {
    b.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, a => ({ path: a.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
    b.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, a => ({ contents: a.path === 'core' ? 'export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.gitBranchHarness.invoke(...args);' : 'export const listen=async()=>()=>{};', loader: 'js' }));
    b.onLoad({ filter: /\/features\/git\/GitPanel\.tsx$/ }, () => ({ contents: component, loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/features/git') }));
    b.onLoad({ filter: /\/features\/plugins\/service\.ts$/ }, () => ({ contents: 'export const usePluginEnabled=()=>true;', loader: 'js' }));
    b.onLoad({ filter: /\/features\/editor\/store\.ts$/ }, () => ({ contents: 'export const editorStore={getSnapshot:()=>({buffers:new Map()}),save:()=>{throw Error("No editor save permitted");}};', loader: 'js' }));
    b.onLoad({ filter: /\/features\/git\/(DiffViewer|ConflictViewer)\.tsx$/ }, a => ({ contents: 'export const ' + path.basename(a.path, '.tsx') + '=()=>null;', loader: 'js' }));
  } }] });
  return { js: result.outputFiles.find(f => f.path.endsWith('.js')).text, css: result.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '', warnings: result.warnings.map(x => x.text) };
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
      const capture = async label => { await settle(); const value = await page.evaluate(() => window.gitBranchHarness.capture()); s.observations.push({ label, ...value }); assert.equal(value.calls.some(c => !['git_status', 'git_branches', 'settings_get', 'session_get', 'stream_ack', 'service_subscribe', 'subscription_close'].includes(c.method)), false); return value; };
      const modal = page.locator('dialog.git-modal[open]'), open = async () => { await page.getByRole('button', { name: '同步', exact: true }).click(); await modal.waitFor(); await settle(); }, close = async () => { await modal.getByRole('button', { name: '关闭分支与同步', exact: true }).click(); await settle(); };
      const refresh = async () => { await page.getByRole('button', { name: '刷新 Git 状态', exact: true }).click(); await page.waitForFunction(() => document.querySelector('.git-refresh-button')?.getAttribute('aria-busy') === 'false'); await settle(); };
      const current = snapshot => snapshot.rows.filter(x => x.current).map(x => x.name);
      try {
        await page.route('http://127.0.0.1:42765/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>' + asset.css + ' .git-panel{height:100vh;width:600px}</style></head><body><div id="root"></div><script>' + asset.js + '</script></body></html>' })); await page.goto('http://127.0.0.1:42765/'); await page.getByRole('button', { name: '同步', exact: true }).waitFor(); await settle();
        if (kind === 'cached-current') {
          await open(); const initial = await capture('initial main/current'); assert.deepEqual(current(initial), ['main']); await close(); await page.evaluate(() => window.gitBranchHarness.switchHead()); await refresh(); await open(); const fresh = await capture('external switch then manual refresh'); assert.equal(fresh.snapshot.snapshot.head.name, 'gui/no-upstream'); assert.ok(fresh.upstreamHint.includes('尚未设置上游')); assert.deepEqual(current(fresh), [variant === 'after' ? 'gui/no-upstream' : 'main']); assert.ok(fresh.networkButtons.some(x => x.text === '推送 gui/no-upstream')); assert.equal(fresh.target, variant === 'after' ? 'gui/no-upstream' : 'main'); assert.equal(fresh.branchReads.length, variant === 'after' ? 2 : 1);
        } else if (kind === 'refs-remotes-drafts') {
          await open(); await modal.getByText('新建分支', { exact: true }).click(); await modal.getByText('比较两个引用', { exact: true }).click(); const create = modal.locator('details').filter({ hasText: '新建分支' }), compare = modal.locator('details').filter({ hasText: '比较两个引用' });
          await modal.getByLabel('远端', { exact: true }).selectOption('origin'); await modal.getByLabel('目标分支', { exact: true }).fill('explicit-target'); await create.getByLabel('新分支名', { exact: true }).fill('gui/keep-draft'); await create.getByLabel('起点', { exact: true }).fill('owned-start'); await compare.getByLabel('起点', { exact: true }).fill('explicit-compare-source'); await compare.getByLabel('终点', { exact: true }).fill('explicit-compare-target');
          await close(); await page.evaluate(() => window.gitBranchHarness.refsOnly()); await refresh(); await open(); const changed = await capture('same-token refs/remotes refresh preserves explicit draft'); assert.equal(changed.snapshot.snapshot.repoToken, 'token-A-1'); assert.equal(changed.rows.some(x => x.name === 'external-ref'), variant === 'after'); assert.equal(changed.remote, 'origin'); assert.equal(changed.target, 'explicit-target'); assert.equal(changed.newBranch, 'gui/keep-draft'); assert.equal(changed.startPoint, 'owned-start'); assert.equal(changed.compareSource, 'explicit-compare-source'); assert.equal(changed.compareTarget, 'explicit-compare-target'); assert.equal(changed.remoteOptions.some(x => x.label.includes('已移除')), variant === 'after'); assert.ok(changed.networkButtons.every(x => x.disabled === (variant === 'after')));
          await modal.getByLabel('远端', { exact: true }).selectOption(''); await modal.getByLabel('目标分支', { exact: true }).fill(''); await modal.locator('details').filter({ hasText: '比较两个引用' }).getByText('比较两个引用', { exact: true }).click(); await modal.locator('details').filter({ hasText: '比较两个引用' }).getByLabel('终点', { exact: true }).fill(''); await close(); await refresh(); await open(); const empty = await capture('explicit empty remote/target survives new branch data'); assert.equal(empty.remote, ''); assert.equal(empty.target, ''); assert.equal(empty.compareTarget, ''); assert.equal(empty.newBranch, 'gui/keep-draft'); assert.equal(empty.startPoint, 'owned-start');
        } else if (kind === 'late-success') {
          await page.evaluate(() => { window.gitBranchHarness.holdBranches = true; }); await open(); await page.waitForFunction(() => window.gitBranchHarness.branchReads.length === 1); await page.evaluate(() => { window.gitBranchHarness.switchHead(); window.dispatchEvent(new Event('focus')); }); await settle();
          if (variant === 'after') await page.waitForFunction(() => window.gitBranchHarness.branchReads.length === 2); await page.evaluate(() => window.gitBranchHarness.resolveBranch(1)); const late = await capture('old success after new status; newest read remains pending'); assert.equal(late.snapshot.snapshot.head.name, 'gui/no-upstream'); if (variant === 'after') { assert.deepEqual(late.rows, []); assert.equal(late.loading, true); await page.evaluate(() => window.gitBranchHarness.resolveBranch(2)); const fresh = await capture('fresh branch read accepted'); assert.deepEqual(current(fresh), ['gui/no-upstream']); assert.equal(fresh.loading, false); } else assert.deepEqual(current(late), ['main']);
        } else if (kind === 'late-rejection') {
          await page.evaluate(() => { window.gitBranchHarness.holdBranches = true; }); await open(); await close(); await page.evaluate(() => { window.gitBranchHarness.switchHead(); window.dispatchEvent(new Event('focus')); }); await settle(); await open(); await page.waitForFunction(() => window.gitBranchHarness.branchReads.length === 2); await page.evaluate(() => window.gitBranchHarness.resolveBranch(2)); await settle(); await page.evaluate(() => window.gitBranchHarness.resolveBranch(1, false)); const late = await capture('old rejection cannot overwrite fresh branch view'); assert.deepEqual(current(late), ['gui/no-upstream']); assert.equal(late.errors.some(x => x.includes('受控旧分支读取失败')), variant === 'before');
        } else if (kind === 'project-boundary') {
          await page.evaluate(() => { window.gitBranchHarness.holdBranches = true; }); await open(); await page.evaluate(() => window.gitBranchHarness.render('B')); await page.waitForFunction(() => window.gitBranchHarness.branchReads.length === 2); await page.evaluate(() => window.gitBranchHarness.resolveBranch(1)); const pending = await capture('old project read ignored while new project pending'); assert.equal(pending.snapshot.projectId, 'B'); assert.deepEqual(pending.rows, []); assert.equal(pending.loading, true); await page.evaluate(() => window.gitBranchHarness.resolveBranch(2)); const fresh = await capture('new project branch/defaults accepted'); assert.deepEqual(current(fresh), ['feature-B']); assert.equal(fresh.remote, 'remote-B'); assert.equal(fresh.target, 'feature-B'); assert.equal(fresh.branchReads[1].repoId, 'repo-B');
        } else if (kind === 'token-mismatch-recovery') {
          await page.evaluate(() => { const h = window.gitBranchHarness; h.world.A.branches.repoToken = 'token-A-moved'; }); await open(); const mismatch = await capture('branch status token differs from snapshot'); assert.equal(mismatch.stale, variant === 'after'); assert.equal(mismatch.errors.some(x => x.includes('仓库已变化')), variant === 'after'); await modal.getByLabel('目标分支', { exact: true }).fill('keep-recovery-target'); await close(); await page.evaluate(() => { const h = window.gitBranchHarness; h.world.A.snapshot.repoToken = 'token-A-moved'; }); await refresh(); await open(); const recovered = await capture('ordinary successful manual refresh clears local stale error'); assert.equal(recovered.stale, false); assert.deepEqual(recovered.errors, []); assert.equal(recovered.target, 'keep-recovery-target'); assert.deepEqual(current(recovered), ['main']); assert.equal(recovered.branchReads.length, variant === 'after' ? 2 : 1);
        }
        assert.deepEqual(s.browserErrors, []); assert.deepEqual(s.consoleErrors, []); s.passed = true;
      } finally { if (!s.passed) s.failure = await page.evaluate(() => ({ capture: window.gitBranchHarness?.capture(), text: document.body.innerText })).catch(e => ({ error: String(e) })); await page.close(); }
    }
  }
  report.passed = true;
} catch (error) { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close(); report.sourcesUnchanged = await Promise.all([{ path: metadata.change.path, sha256: metadata.change.beforeSha256 }, ...metadata.support].map(async s => ({ path: s.path, unchanged: sha(await readFile(path.join(repository, s.path))) === s.sha256 })));
  report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt); await writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, states: report.scenarios.map(({ variant, kind, passed }) => ({ variant, kind, passed })), durationMs: report.durationMs, sourcesUnchanged: report.sourcesUnchanged.every(s => s.unchanged), error: report.error, result: path.join(directory, 'result.json') }));
}
