import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon', directory = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(directory, 'source-sha.json'), 'utf8'));
const sha256 = b => createHash('sha256').update(b).digest('hex');
const report = { kind: 'real App/SettingsPanel/AgentSettings/LauncherPanel/Modal/bridge/AppearanceProvider; controlled Tauri and unrelated modules', startedAt: new Date().toISOString(), sources: metadata, scenarios: [], passed: false };
const scenarios = ['connection-close', 'outer-close-and-hidden', 'navigation', 'settings-forms', 'connection-validation-save-retry', 'connection-busy', 'launcher-cancel-save-busy', 'project-change-and-quit', 'clean-quit-error-locality'];
const codeText = 'OWNED_CODE_DRAFT_UNSAVED', ownedKey = 'OWNED_ONLY_NO_SECRET', aggregate = '仍有文档未保存成功。请先处理保存错误，再继续。';
const configWrites = s => s.calls.filter(c => ['credential_set', 'agent_connection_save', 'launch_profile_save', 'settings_patch', 'appearance_preset_save'].includes(c.method));
const editorWrites = s => s.editorCalls.filter(c => c.method !== 'setProject');

async function bundle(variant) {
  const entry = await readFile(path.join(directory, 'entry.tsx'), 'utf8');
  const productSources = new Map(await Promise.all(metadata.sources.map(async s => [path.join(repository, s.path), await readFile(path.join(directory, variant, s.path), 'utf8')])));
  const compiled = await build({ stdin: { contents: entry, resolveDir: repository, loader: 'tsx' }, bundle: true, write: false, outfile: variant + '.js', format: 'iife', jsx: 'automatic', target: 'es2022', logLevel: 'silent', plugins: [{ name: 'reuse-real-App-component-boundaries', setup(b) {
    b.onResolve({ filter: /UnsavedChanges$/ }, () => ({ path: 'UnsavedChanges', namespace: 'prepared-component' }));
    b.onLoad({ filter: /.*/, namespace: 'prepared-component' }, async () => ({ contents: await readFile(path.join(directory, 'after/apps/desktop/src/components/UnsavedChanges.tsx'), 'utf8'), loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/components') }));
    b.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, a => ({ path: a.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
    b.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, a => ({ contents: a.path === 'core' ? `export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.formHarness.invoke(...args);` : `export const listen=async(topic,callback)=>{const h=window.formHarness;let set=h.listeners.get(topic);if(!set)h.listeners.set(topic,set=new Set());set.add(callback);return ()=>{set.delete(callback);};};`, loader: 'js' }));
    b.onLoad({ filter: /\/apps\/desktop\/src\/(App\.tsx|features\/(settings\/SettingsPanel\.tsx|agent\/AgentSettings\.tsx|processes\/index\.tsx))$/ }, a => ({ contents: productSources.get(a.path), loader: 'tsx', resolveDir: path.dirname(a.path) }));
    b.onLoad({ filter: /\/features\/agent\/index\.tsx?$/ }, () => ({ contents: `export {AgentSettings} from './AgentSettings';export const AgentPanel=()=>null;`, loader: 'js', resolveDir: path.join(repository, 'apps/desktop/src/features/agent') }));
    b.onLoad({ filter: /\/features\/agent\/store\.ts$/ }, () => ({ contents: `export const loadAgent=async projectId=>{window.formHarness.editorCalls.push({method:'agent-list-refresh',projectId});};`, loader: 'js' }));
    b.onLoad({ filter: /\/features\/plugins\/service\.ts$/ }, () => ({ contents: `export const pluginRuntime={getSnapshot:()=>[],isEnabled:()=>false};export const usePlugins=()=>[];export const usePluginEnabled=()=>false;export const activatePlugin=async()=>{};export const registerPluginLifecycle=()=>()=>{};export const useSlot=()=>[];export const refreshPlugins=async()=>{};export const initializePlugins=async()=>()=>{};export const usePluginError=()=>'';`, loader: 'js' }));
    b.onLoad({ filter: /\/features\/plugins\/PluginCenter\.tsx$/ }, () => ({ contents: `export const PluginCenter=()=> <p>Owned plugin center boundary</p>;`, loader: 'jsx' }));
    b.onLoad({ filter: /\/components\/RecoveryPanel\.tsx$/ }, () => ({ contents: `export const RecoveryPanel=()=> <p>Owned recovery boundary</p>;`, loader: 'jsx' }));
    b.onLoad({ filter: /\/features\/editor\/index\.ts$/ }, () => ({ contents: `const record=method=>(...args)=>{window.formHarness.editorCalls.push({method});};export const editorStore={setProject:record('setProject'),flushDrafts:async()=>record('flushDrafts')(),saveAll:async()=>{record('saveAll')();return false;},hostClosedProject:async()=>record('hostClosedProject')(),getSnapshot:()=>({projects:new Map()}),getBuffer:()=>undefined,clearError:()=>{throw Error('Must not clear editor errors');}};export const FileExplorer=()=>null;export const SearchPanel=()=>null;export const EditorWorkbench=()=>null;export const QuickOpen=()=>null;export const getEditorDiagnostics=()=>({});`, loader: 'js' }));
  } }] });
  return { js: compiled.outputFiles.find(f => f.path.endsWith('.js')).text, css: compiled.outputFiles.find(f => f.path.endsWith('.css'))?.text ?? '', warnings: compiled.warnings.map(w => w.text) };
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const variant of ['before', 'after']) {
    const assets = await bundle(variant);
    for (const kind of scenarios) {
      const s = { variant, kind, warnings: assets.warnings, browserErrors: [], consoleErrors: [], observations: [], nativeConfirms: [], passed: false }; report.scenarios.push(s);
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(5000);
      page.on('pageerror', e => s.browserErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') s.consoleErrors.push(m.text()); });
      let acceptBrowserConfirm = false;
      page.on('dialog', async d => { s.nativeConfirms.push({ type: d.type(), message: d.message() }); if (acceptBrowserConfirm) await d.accept(); else await d.dismiss(); });
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const capture = async label => { await settle(); const value = await page.evaluate(() => window.formHarness.capture()); s.observations.push({ label, ...value }); assert.equal(value.codeBuffer.text, codeText); assert.equal(value.storageContainsKey, false); return value; };
      const settings = page.getByRole('dialog', { name: '设置', exact: true }), confirm = page.getByRole('dialog', { name: '放弃未保存的修改？', exact: true });
      const nav = name => settings.getByRole('navigation', { name: '设置分类' }).getByRole('button', { name, exact: true });
      const connection = () => page.getByRole('dialog', { name: '添加模型连接', exact: true });
      const openSettings = async () => { await page.getByRole('button', { name: '设置', exact: true }).click(); await settings.waitFor(); await page.locator('.settings-loading').waitFor({ state: 'hidden' }); await settle(); };
      const openNew = async () => { await nav('AI 连接').click(); await settings.getByRole('button', { name: '添加连接', exact: true }).click(); await connection().waitFor(); };
      const fillNew = async () => { const form = connection(); await form.getByLabel(/^连接名称/).fill('Owned unsaved connection'); await form.getByLabel(/^模型 ID/).fill('owned-model-new'); await form.locator('input[type=password]').fill(ownedKey); };
      const openLaunch = async () => { await nav('项目与资源').click(); await settings.getByRole('button', { name: '新建方案', exact: true }).click(); await settings.getByLabel('方案名称', { exact: true }).fill('Owned unsaved profile'); await settle(); };
      const presets = async () => { await nav('外观').click(); await settings.getByRole('navigation', { name: '外观分类' }).getByRole('button', { name: '外观方案', exact: true }).click(); await settle(); };
      const discard = async () => { await confirm.getByRole('button', { name: '放弃修改', exact: true }).click(); await settle(); };
      const keep = async () => { await confirm.getByRole('button', { name: '继续编辑', exact: true }).click(); await settle(); };
      const closeOuter = async way => { if (way === 'Escape') await page.keyboard.press('Escape'); else if (way === 'done') await settings.locator('.settings-footer button').click(); else await settings.locator(':scope > .modal-header button').click(); await settle(); };
      try {
        await page.route('http://127.0.0.1:42764/', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><style>' + assets.css + '</style></head><body><div id="root"></div><script>' + assets.js + '</script></body></html>' }));
        await page.goto('http://127.0.0.1:42764/'); await page.waitForFunction(() => window.formHarness.calls.some(c => c.method === 'project_activate') && window.formHarness.listeners.get('horizon:closeRequested')?.size); await settle(); await openSettings();

        if (kind === 'connection-close') {
          for (const way of ['X', 'Escape', 'cancel']) {
            await openNew(); await fillNew();
            const trigger = async () => { if (way === 'Escape') await page.keyboard.press('Escape'); else await connection().getByRole('button', { name: way === 'X' ? '关闭弹窗' : '取消', exact: true }).click(); await settle(); };
            await trigger();
            if (variant === 'after') {
              assert.equal(await confirm.count(), 1); await page.keyboard.press('Escape'); const escaped = await capture(way + ' confirmation Escape keeps both parent dialogs'); assert.deepEqual(escaped.dialogs, ['设置', '添加模型连接']); assert.equal(await connection().getByLabel(/^模型 ID/).inputValue(), 'owned-model-new'); assert.equal(await connection().locator('input[type=password]').inputValue(), ownedKey);
              await trigger(); await keep(); assert.equal(await connection().locator('input[type=password]').inputValue(), ownedKey); await trigger(); await discard();
            }
            const closed = await capture(way + ' final closure'); assert.deepEqual(closed.dialogs, ['设置']); assert.equal(configWrites(closed).length, 0); assert.deepEqual(editorWrites(closed), []);
          }
          await openNew(); await connection().getByRole('button', { name: '取消', exact: true }).click(); const clean = await capture('unchanged connection form closes directly'); assert.deepEqual(clean.dialogs, ['设置']);
        } else if (kind === 'outer-close-and-hidden') {
          for (const way of ['done', 'X', 'Escape']) {
            if (!await settings.count()) await openSettings(); await openLaunch();
            await page.evaluate(() => { window.formHarness.launcherInput = document.querySelector('.profile-editor label input'); }); await nav('编辑器').click(); assert.equal(await confirm.count(), 0); await nav('项目与资源').click(); assert.equal(await page.evaluate(() => window.formHarness.launcherInput === document.querySelector('.profile-editor label input')), true); assert.equal(await settings.getByLabel('方案名称', { exact: true }).inputValue(), 'Owned unsaved profile');
            await closeOuter(way);
            if (variant === 'after') { await keep(); assert.equal(await settings.getByLabel('方案名称', { exact: true }).inputValue(), 'Owned unsaved profile'); await closeOuter(way); await page.keyboard.press('Escape'); assert.equal(await settings.count(), 1); await closeOuter(way); await discard(); }
            const closed = await capture(way + ' outer closure'); assert.deepEqual(closed.dialogs, []); assert.equal(configWrites(closed).length, 0); assert.deepEqual(editorWrites(closed), []);
          }
        } else if (kind === 'navigation') {
          for (const target of ['plugins', 'recovery']) {
            if (!await settings.count()) await openSettings(); await openLaunch(); await nav(target === 'plugins' ? '编辑器' : '数据与隐私').click(); const button = settings.getByRole('button', { name: target === 'plugins' ? '管理扩展' : '查看恢复草稿', exact: true }); await button.click(); await settle();
            if (variant === 'after') { await keep(); assert.equal(await settings.count(), 1); await nav('项目与资源').click(); assert.equal(await settings.getByLabel('方案名称', { exact: true }).inputValue(), 'Owned unsaved profile'); await nav(target === 'plugins' ? '编辑器' : '数据与隐私').click(); await button.click(); await discard(); }
            const navigated = await capture(target + ' confirmed settings unmount'); assert.equal(navigated.section, null); assert.equal(configWrites(navigated).length, 0); assert.deepEqual(editorWrites(navigated), []);
            if (target === 'plugins') await page.getByText('Owned plugin center boundary', { exact: true }).waitFor(); else { await page.getByText('Owned recovery boundary', { exact: true }).waitFor(); await page.getByRole('dialog', { name: '恢复草稿', exact: true }).getByRole('button', { name: '关闭弹窗', exact: true }).click(); }
          }
        } else if (kind === 'settings-forms') {
          await presets(); await settings.getByLabel('外观组合名称', { exact: true }).fill('Owned unsaved preset'); await nav('编辑器').click(); assert.equal(await confirm.count(), 0); await presets(); assert.equal(await settings.getByLabel('外观组合名称', { exact: true }).inputValue(), 'Owned unsaved preset'); await closeOuter('X');
          if (variant === 'after') { await keep(); assert.equal(await settings.getByLabel('外观组合名称', { exact: true }).inputValue(), 'Owned unsaved preset'); await settings.getByRole('button', { name: '保存当前组合', exact: true }).click(); await page.waitForFunction(() => document.querySelector('[aria-label="外观组合名称"]')?.value === ''); await closeOuter('X'); }
          await capture('preset outer close / successful save removes dirty'); await openSettings(); await nav('快捷键').click(); await settings.getByRole('button', { name: '修改保存文件快捷键', exact: true }).click(); await settings.getByRole('textbox', { name: '保存文件快捷键录入', exact: true }).press('Meta+Alt+S'); await settings.getByText('快捷键冲突', { exact: true }).waitFor(); await page.evaluate(() => { window.formHarness.failSettings = true; }); await settings.getByRole('button', { name: '替换绑定', exact: true }).click(); await page.getByText('受控快捷键保存失败', { exact: true }).first().waitFor(); const failed = await capture('shortcut conflict save failure keeps draft'); assert.equal(failed.conflict, variant === 'after');
          if (variant === 'after') { await closeOuter('done'); await keep(); await page.evaluate(() => { window.formHarness.failSettings = false; }); await settings.getByRole('button', { name: '替换绑定', exact: true }).click(); await page.waitForFunction(() => ![...document.querySelectorAll('.settings-error strong')].some(el => el.textContent === '快捷键冲突')); await closeOuter('X'); assert.equal(await confirm.count(), 0); }
        } else if (kind === 'connection-validation-save-retry') {
          await nav('AI 连接').click(); await settings.getByRole('button', { name: '编辑 Owned existing', exact: true }).click(); const edit = page.getByRole('dialog', { name: '编辑模型连接', exact: true }); assert.equal(await edit.getByLabel(/^凭据保存/).inputValue(), 'session'); await edit.getByLabel(/^凭据保存/).selectOption('system'); await edit.getByRole('button', { name: '保存连接', exact: true }).click(); await edit.getByText('更改凭据保存方式需要重新输入 API key。', { exact: true }).waitFor(); const validation = await capture('credential-scope validation preserves editable form'); assert.equal(configWrites(validation).length, 0); await edit.getByRole('button', { name: '取消', exact: true }).click(); if (variant === 'after') { await keep(); assert.equal(await edit.getByLabel(/^凭据保存/).inputValue(), 'system'); await edit.getByRole('button', { name: '取消', exact: true }).click(); await discard(); }
          await openNew(); await fillNew(); await page.evaluate(() => { window.formHarness.failConnection = true; }); await connection().getByRole('button', { name: '保存连接', exact: true }).click(); await connection().getByText('受控连接保存失败', { exact: true }).waitFor(); const failed = await capture('connection save failure retains fields and candidate key'); assert.equal(await connection().getByLabel(/^连接名称/).inputValue(), 'Owned unsaved connection'); assert.equal(await connection().locator('input[type=password]').inputValue(), variant === 'after' ? ownedKey : '');
          await page.evaluate(() => { window.formHarness.failConnection = false; }); await connection().getByRole('button', { name: '保存连接', exact: true }).click(); await connection().waitFor({ state: 'hidden' }); const retried = await capture('explicit retry succeeds'); const saves = retried.calls.filter(c => c.method === 'agent_connection_save'); assert.equal(saves.length, 2); assert.equal(saves[0].params.connection.connectionId === saves[1].params.connection.connectionId, variant === 'after'); if (variant === 'after') assert.equal(saves[1].params.connection.provider.credentialRef, 'ref-' + saves[0].params.connection.connectionId); await closeOuter('done'); assert.equal(await confirm.count(), 0);
        } else if (kind === 'connection-busy') {
          await openNew(); await fillNew(); await page.evaluate(() => { window.formHarness.holdConnection = true; }); await connection().getByRole('button', { name: '保存连接', exact: true }).click(); await page.waitForFunction(() => window.formHarness.pending); await settle(); await page.evaluate(() => window.formHarness.emit('horizon.closeRequested')); const busy = await capture('OS close while connection save pending'); assert.equal(busy.planCount, variant === 'after' ? 0 : 1); assert.equal(busy.fields !== null, variant === 'after'); assert.equal(busy.dialogs.includes('放弃未保存的修改？'), false); await page.evaluate(() => window.formHarness.resolvePending(false)); if (variant === 'after') { await connection().getByText('受控保存失败', { exact: true }).waitFor(); assert.equal(await connection().locator('input[type=password]').inputValue(), ownedKey); } await capture('pending failure remains editable in candidate');
        } else if (kind === 'launcher-cancel-save-busy') {
          await openLaunch(); const cancel = settings.locator('.profile-editor').getByRole('button', { name: '取消', exact: true }); await cancel.click(); await settle(); if (variant === 'after') { await keep(); await cancel.click(); await page.keyboard.press('Escape'); assert.equal(await settings.getByLabel('方案名称', { exact: true }).inputValue(), 'Owned unsaved profile'); await cancel.click(); await discard(); } else { assert.equal(await settings.getByLabel('方案名称', { exact: true }).inputValue(), 'Owned unsaved profile'); acceptBrowserConfirm = true; await cancel.click(); }
          assert.equal(await settings.locator('.profile-editor').count(), 0); await openLaunch(); await page.evaluate(() => { window.formHarness.failProfile = true; }); await settings.getByRole('button', { name: '保存方案', exact: true }).click(); await settings.getByText('受控方案保存失败', { exact: true }).waitFor(); await capture('profile save failure preserves draft'); assert.equal(await settings.getByLabel('方案名称', { exact: true }).inputValue(), 'Owned unsaved profile'); await page.evaluate(() => { window.formHarness.failProfile = false; window.formHarness.holdProfile = true; }); await settings.getByRole('button', { name: '保存方案', exact: true }).click(); await page.waitForFunction(() => window.formHarness.pending); await closeOuter('done'); const busy = await capture('outer Done cannot remove saving profile in candidate'); assert.equal(busy.section !== null, variant === 'after'); assert.equal(await confirm.count(), 0); await page.evaluate(() => window.formHarness.resolvePending(true)); if (variant === 'after') { await settings.locator('.profile-editor').waitFor({ state: 'hidden' }); await closeOuter('done'); assert.equal(await confirm.count(), 0); } await capture('profile save success clears dirty');
        } else if (kind === 'project-change-and-quit') {
          await openLaunch(); await settings.getByLabel('设置对象', { exact: true }).selectOption('owned-two'); await settle(); if (variant === 'after') { await keep(); const cancelled = await capture('Continue editing cancels project change without false error'); assert.equal(cancelled.activeProjectId, 'owned-one'); assert.equal(cancelled.globalError, null); assert.equal(cancelled.profileName, 'Owned unsaved profile'); await settings.getByLabel('设置对象', { exact: true }).selectOption('owned-two'); await discard(); }
          await page.waitForFunction(() => window.formHarness.activeProjectId === 'owned-two'); await settings.locator('.profile-editor').waitFor({ state: 'hidden' }); await presets(); await settings.getByLabel('外观组合名称', { exact: true }).fill('Owned quit draft'); await settle(); await page.evaluate(() => window.formHarness.emit('horizon.closeRequested')); await settle(); if (variant === 'after') { await page.keyboard.press('Escape'); const kept = await capture('quit confirmation Escape preserves settings and defers native plan'); assert.equal(kept.planCount, 0); assert.equal(kept.presetName, 'Owned quit draft'); assert.deepEqual(editorWrites(kept), []); await page.evaluate(() => window.formHarness.emit('horizon.closeRequested')); await discard(); } await page.getByRole('dialog', { name: '退出 Horizon', exact: true }).waitFor(); const plan = await capture('discard then actual stop plan'); assert.equal(plan.planCount, 1); assert.equal(plan.section, null);
        } else if (kind === 'clean-quit-error-locality') {
          await closeOuter('X'); await page.evaluate(() => { window.formHarness.failSession = true; }); await page.getByRole('button', { name: '切换侧栏', exact: true }).click(); await page.getByText('其他独立操作错误', { exact: true }).waitFor(); await page.evaluate(() => { window.formHarness.failSession = false; }); await openSettings(); await page.evaluate(() => window.formHarness.emit('horizon.closeRequested')); const stop = page.getByRole('dialog', { name: '退出 Horizon', exact: true }); await stop.waitFor(); assert.equal(await confirm.count(), 0); await stop.getByRole('button', { name: '处理并退出', exact: true }).click(); await stop.getByText(aggregate, { exact: true }).waitFor(); const failed = await capture('clean settings enter old stop plan and retain local operation error'); assert.equal(failed.globalError, '其他独立操作错误'); assert.equal(await stop.locator('.form-stack > .editor-error').textContent(), aggregate); await stop.getByRole('button', { name: '取消', exact: true }).click(); await page.evaluate(() => { window.formHarness.codeBuffer.dirty = false; window.formHarness.emit('horizon.closeRequested'); }); await stop.waitFor(); await stop.getByText('没有未保存文档', { exact: true }).waitFor(); assert.equal(await stop.locator('.form-stack > .editor-error').count(), 0); const clean = await capture('Cancel/new clean stop plan cannot inherit local error'); assert.equal(clean.globalError, '其他独立操作错误');
        }
        assert.deepEqual(s.browserErrors, []); assert.deepEqual(s.consoleErrors, []); s.passed = true;
      } finally {
        if (!s.passed) s.failure = await page.evaluate(() => ({ capture: window.formHarness?.capture(), text: document.body.innerText })).catch(e => ({ error: String(e) }));
        await page.close();
      }
    }
  }
  report.passed = true;
} catch (error) { report.error = String(error); report.stack = error.stack; process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.sourcesUnchanged = await Promise.all(metadata.sources.map(async s => ({ path: s.path, unchanged: sha256(await readFile(path.join(repository, s.path))) === s.beforeSha256 })));
  report.completedAt = new Date().toISOString(); report.durationMs = Date.now() - Date.parse(report.startedAt);
  await writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, states: report.scenarios.map(({ variant, kind, passed }) => ({ variant, kind, passed })), durationMs: report.durationMs, sourcesUnchanged: report.sourcesUnchanged.every(s => s.unchanged), error: report.error, result: path.join(directory, 'result.json') }));
}
