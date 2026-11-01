import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const repository = '/Users/chenpengxiang/Desktop/Horizon';
const directory = path.dirname(fileURLToPath(import.meta.url));
const metadata = JSON.parse(await readFile(path.join(directory, 'source-sha.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = metadata.sources[0];
assert.equal(sha(await readFile(path.join(repository, source.path))), source.sha256);
const report = { startedAt: new Date().toISOString(), kind: 'real AgentSettings + Modal + bridge, controlled safe-metadata Tauri', source: metadata, scenarios: [], passed: false };
const kinds = ['expired', 'live-session', 'system', 'no-ref', 'new-system', 'new-session', 'scope-to-session', 'scope-to-system'];
const credentialCalls = snapshot => snapshot.calls.filter(c => c.method === 'credential_set');
const saveCalls = snapshot => snapshot.calls.filter(c => c.method === 'agent_connection_save');

async function bundle(variant) {
  const component = await readFile(path.join(directory, variant, source.path), 'utf8');
  const entry = await readFile(path.join(directory, 'entry.tsx'), 'utf8');
  const result = await build({
    stdin: { contents: entry, resolveDir: repository, loader: 'tsx' }, bundle: true, write: false,
    outfile: variant + '.js', jsx: 'automatic', format: 'iife', target: 'es2022', logLevel: 'silent',
    plugins: [{ name: 'reuse-controlled-component-boundaries', setup(builder) {
      builder.onResolve({ filter: /^@tauri-apps\/api\/(core|event)$/ }, args => ({ path: args.path.endsWith('/core') ? 'core' : 'event', namespace: 'controlled-tauri' }));
      builder.onLoad({ filter: /.*/, namespace: 'controlled-tauri' }, args => ({
        contents: args.path === 'core' ? 'export const isTauri=()=>true;export class Channel{onmessage=()=>{}};export const invoke=(...args)=>window.credentialHarness.invoke(...args);' : 'export const listen=async()=>()=>{};',
        loader: 'js',
      }));
      builder.onLoad({ filter: /\/features\/agent\/store\.ts$/ }, () => ({ contents: 'export const loadAgent=async()=>{};', loader: 'js' }));
      builder.onLoad({ filter: /\/features\/agent\/AgentSettings\.tsx$/ }, () => ({ contents: component, loader: 'tsx', resolveDir: path.join(repository, 'apps/desktop/src/features/agent') }));
    } }],
  });
  return { js: result.outputFiles.find(f => f.path.endsWith('.js')).text, warnings: result.warnings.map(w => w.text) };
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const variant of ['before', 'after']) {
    const asset = await bundle(variant);
    for (const kind of kinds) {
      const scenario = { variant, kind, passed: false, bundleSHA: sha(asset.js), warnings: asset.warnings, browserErrors: [], consoleErrors: [] };
      report.scenarios.push(scenario);
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      page.setDefaultTimeout(5000);
      page.on('pageerror', error => scenario.browserErrors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') scenario.consoleErrors.push(message.text()); });
      const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const capture = () => page.evaluate(() => window.credentialHarness.capture());
      const row = (snapshot, label) => snapshot.rows.find(r => r.label === label);
      const edit = async label => {
        await page.getByRole('button', { name: '编辑 ' + label, exact: true }).click();
        await page.getByRole('dialog').waitFor();
        return page.getByRole('dialog');
      };
      const save = async form => {
        await form.getByRole('button', { name: '保存连接', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('dialog'));
        await settle();
      };
      try {
        await page.route('http://127.0.0.1:42762/', route => route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html><body><div id="root"></div><script>window.scenarioKind=' + JSON.stringify(kind) + ';</script><script>' + asset.js + '</script></body></html>',
        }));
        await page.goto('http://127.0.0.1:42762/');
        await page.getByRole('button', { name: '添加连接', exact: true }).waitFor();
        await settle();
        scenario.initial = await capture();

        if (kind === 'expired') {
          assert.equal(row(scenario.initial, 'owned-expired').state, variant === 'after' ? '会话凭据已过期 · 需重新输入' : '已配置 · 未验证');
          assert.equal(row(scenario.initial, 'owned-expired-verified').state, variant === 'after' ? '会话凭据已过期 · 需重新输入' : '已验证');
          assert.equal(row(scenario.initial, 'owned-expired-verified').good, variant === 'before');
          const form = await edit('owned-expired');
          scenario.form = await capture();
          assert.equal(await form.getByLabel(/^凭据保存/).inputValue(), variant === 'after' ? 'session' : 'system');
          assert.equal(scenario.form.passwordValue, '');
          assert.equal(scenario.form.passwordPlaceholder, variant === 'after' ? '会话凭据已过期，请重新输入' : '已保存，留空保持原凭据');
          if (variant === 'after') assert.match(scenario.form.dialogText, /会话凭据已过期，请重新输入 API key/);
          await form.locator('input[type=password]').fill('owned-component-only');
          await save(form);
          scenario.saved = await capture();
          assert.equal(credentialCalls(scenario.saved).length, 1);
          assert.equal(credentialCalls(scenario.saved)[0].params.persistence, variant === 'after' ? 'session' : 'system');
          assert.equal(saveCalls(scenario.saved)[0].params.connection.provider.credentialRef, 'ref-owned-expired');
        } else if (kind === 'live-session' || kind === 'system') {
          const label = kind === 'live-session' ? 'owned-session' : 'owned-system';
          const persistence = kind === 'live-session' ? 'session' : 'system';
          assert.equal(row(scenario.initial, label).state, '已验证');
          const form = await edit(label);
          scenario.form = await capture();
          assert.equal(await form.getByLabel(/^凭据保存/).inputValue(), variant === 'after' ? persistence : 'system');
          assert.equal(scenario.form.passwordValue, '');
          assert.equal(scenario.form.passwordPlaceholder, '已保存，留空保持原凭据');
          await save(form);
          scenario.saved = await capture();
          assert.equal(credentialCalls(scenario.saved).length, 0, 'blank valid edit never reads or resets secret');
          assert.equal(saveCalls(scenario.saved).length, 1);
          assert.equal(saveCalls(scenario.saved)[0].params.connection.provider.credentialRef, 'ref-' + label);
          assert.equal(scenario.saved.credentials[0].persistence, persistence);
          assert.equal(row(scenario.saved, label).state, '已配置 · 未验证', 'config save does not claim verification');
        } else if (kind === 'no-ref') {
          assert.equal(row(scenario.initial, 'owned-missing').state, variant === 'after' ? '凭据未配置 · 需重新输入' : '已配置 · 未验证');
          assert.equal(row(scenario.initial, 'owned-external').state, '已验证');
          assert.equal(row(scenario.initial, 'owned-runtime').state, '已配置 · 未验证');
          const form = await edit('owned-missing');
          scenario.form = await capture();
          assert.equal(await form.getByLabel(/^凭据保存/).inputValue(), 'system');
          assert.equal(scenario.form.passwordPlaceholder, '输入凭据');
          assert.equal(scenario.form.passwordValue, '');
          assert.doesNotMatch(scenario.form.dialogText, /会话凭据已过期/);
          await form.getByRole('button', { name: '取消', exact: true }).click();
          scenario.saved = await capture();
          assert.equal(saveCalls(scenario.saved).length, 0);
          assert.equal(credentialCalls(scenario.saved).length, 0);
        } else if (kind.startsWith('new-')) {
          const persistence = kind === 'new-session' ? 'session' : 'system';
          await page.getByRole('button', { name: '添加连接', exact: true }).click();
          const form = page.getByRole('dialog');
          assert.equal(await form.getByLabel(/^凭据保存/).inputValue(), 'system');
          await form.getByLabel(/^连接名称/).fill('Owned new');
          await form.getByLabel(/^模型 ID/).fill('owned-new-model');
          await form.getByLabel(/^服务地址/).fill('http://127.0.0.1:1/v1');
          await form.locator('input[type=password]').fill('owned-component-only');
          await form.getByLabel(/^凭据保存/).selectOption(persistence);
          await save(form);
          scenario.saved = await capture();
          const credential = credentialCalls(scenario.saved);
          const connection = saveCalls(scenario.saved);
          assert.equal(credential.length, 1);
          assert.equal(connection.length, 1);
          assert.equal(credential[0].params.persistence, persistence);
          assert.equal(credential[0].params.connectionId, connection[0].params.connection.connectionId);
          assert.equal(connection[0].params.connection.provider.credentialRef, 'ref-' + credential[0].params.connectionId);
        } else {
          const target = kind === 'scope-to-session' ? 'session' : 'system';
          const original = target === 'session' ? 'system' : 'session';
          const form = await edit('owned-switch');
          await form.getByLabel(/^凭据保存/).selectOption(target);
          await form.getByRole('button', { name: '保存连接', exact: true }).click();
          await settle();
          scenario.blankScopeChange = await capture();
          assert.equal(credentialCalls(scenario.blankScopeChange).length, 0);
          assert.equal(scenario.blankScopeChange.credentials[0].persistence, original);
          if (variant === 'after') {
            assert.equal(saveCalls(scenario.blankScopeChange).length, 0);
            assert.match(scenario.blankScopeChange.dialogText, /更改凭据保存方式需要重新输入 API key/);
            await form.locator('input[type=password]').fill('owned-component-only');
            await save(form);
            scenario.saved = await capture();
            assert.equal(credentialCalls(scenario.saved).length, 1);
            assert.equal(credentialCalls(scenario.saved)[0].params.persistence, target);
            assert.equal(saveCalls(scenario.saved).length, 1);
            assert.equal(saveCalls(scenario.saved)[0].params.connection.provider.credentialRef, 'ref-owned-switch');
            assert.equal(scenario.saved.credentials[0].persistence, target);
          } else {
            assert.equal(saveCalls(scenario.blankScopeChange).length, 1);
            assert.equal(scenario.blankScopeChange.dialogText, null, 'before silently saved connection without migrating selected scope');
          }
        }
        const final = scenario.saved ?? scenario.blankScopeChange ?? scenario.initial;
        assert.equal(final.calls.filter(c => ['agent_submit', 'agent_context_prepare', 'agent_connection_test', 'credential_remove'].includes(c.method)).length, 0);
        assert.equal(final.calls.filter(c => c.method === 'credential_list').length > 0, variant === 'after');
        assert.deepEqual(scenario.browserErrors, []);
        assert.deepEqual(scenario.consoleErrors, []);
        scenario.passed = true;
      } finally {
        if (!scenario.passed) scenario.failure = await page.evaluate(() => ({ capture: window.credentialHarness?.capture(), text: document.body.innerText })).catch(error => ({ error: String(error) }));
        await page.close();
      }
    }
  }
  report.passed = true;
} catch (error) {
  report.error = String(error); report.stack = error.stack; process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  report.sourcesUnchanged = sha(await readFile(path.join(repository, source.path))) === source.sha256;
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.now() - Date.parse(report.startedAt);
  await writeFile(path.join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, cases: kinds.length, beforeAfterStates: report.scenarios.length, states: report.scenarios.map(({ variant, kind, passed }) => ({ variant, kind, passed })), sourcesUnchanged: report.sourcesUnchanged, error: report.error, durationMs: report.durationMs, result: path.join(directory, 'result.json') }));
}
