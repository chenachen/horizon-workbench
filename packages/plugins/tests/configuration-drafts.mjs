import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { build } from 'esbuild';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const bundled = await build({
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic', write: false,
  plugins: [{ name: 'configuration-bridge', setup(builder) {
    builder.onResolve({ filter: /^(\.\.\/\.\.\/bridge|\.\/service|\.\/PluginSlot)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path.endsWith('bridge')
      ? 'export const call = (...args) => window.fixtureBridge.call(...args); export const errorMessage = error => error.message;'
      : args.path.endsWith('service') ? 'export const refreshPlugins = async () => {};' : 'export const PluginSlot = () => null;' }));
  } }],
  stdin: { resolveDir: repository, contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { PluginDetails } from './apps/desktop/src/features/plugins/PluginDetails.tsx';
    const root = createRoot(document.getElementById('root'));
    const configs = new Map(), requests = [], pending = [];
    let saveMode = 'normal';
    const config = (extensionId, projectId) => {
      const key = JSON.stringify([extensionId, projectId]);
      if (!configs.has(key)) configs.set(key, { revision: 1, global: { path: '/saved/server', options: '{}' }, project: {}, schema: [
        { key: 'path', label: '程序路径', type: 'path' }, { key: 'options', label: '启动 JSON', type: 'string' },
      ] });
      return configs.get(key);
    };
    window.fixtureBridge = { call: async (method, params, projectId) => {
      requests.push({ method, params: structuredClone(params), projectId });
      const current = config(params.extensionId, projectId);
      if (method === 'extension_config_get') return structuredClone(current);
      if (method !== 'extension_config_set') throw new Error('Unexpected method: ' + method);
      const mode = saveMode; saveMode = 'normal';
      if (mode === 'fail') throw new Error('Fixture save failed');
      if (mode === 'hold') await new Promise(resolve => pending.push(resolve));
      if (params.value === null) delete current[params.scope][params.key];
      else current[params.scope][params.key] = params.value;
      current.revision++;
    } };
    const noop = () => {};
    window.configurationHarness = {
      requests,
      open(projectId = 'A', extensionId = 'local.fixture') {
        const state = { id: extensionId, installState: 'installed', installedVersion: '1.0.0', enabledGlobal: true,
          effectiveEnabled: true, effectivePaused: false, runState: 'stopped', projectOverride: 'inherit', ownedResourceCount: 0,
          manifest: { id: extensionId, name: '配置测试', version: '1.0.0', author: 'Fixture', description: '',
            runtime: { kind: 'declarative' }, contributes: {}, activation: [], engines: { horizon: '*' }, capabilities: [] } };
        root.render(React.createElement(PluginDetails, { key: extensionId + ':' + projectId, state, projectId,
          busy: false, logs: null, status: '待激活', actionScope: 'project', initialTab: 'settings',
          onBack: noop, onToggle: noop, onUninstall: noop, onInherit: noop, onLogs: noop, onUpdate: noop, onRollback: noop, onActivate: noop }));
      },
      close: () => root.render(null), failSave: () => { saveMode = 'fail'; },
      holdSave: () => { saveMode = 'hold'; }, finishSave: () => pending.shift()(),
    };
    window.configurationHarness.open();
  ` },
});
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url === '/fixture.js' ? 'text/javascript' : 'text/html');
  response.end(request.url === '/fixture.js' ? bundled.outputFiles[0].contents : '<!doctype html><div id="root"></div><script type="module" src="/fixture.js"></script>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const pathInput = page.getByRole('textbox', { name: '程序路径', exact: true });
const jsonInput = page.getByRole('textbox', { name: '启动 JSON', exact: true });
const scope = page.getByRole('combobox', { name: '设置范围' });
const savePath = page.getByRole('button', { name: '保存 程序路径', exact: true });
const saveJson = page.getByRole('button', { name: '保存 启动 JSON', exact: true });
const phases = [];

async function value(label, expected) {
  await page.waitForFunction(({ label, expected }) => [...document.querySelectorAll('input')].some(input => input.getAttribute('aria-label') === label && input.value === expected), { label, expected });
}
async function enabled(button, expected) {
  await button.waitFor({ state: 'visible' });
  await page.waitForFunction(({ label, expected }) => [...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === label && !button.disabled === expected), { label: await button.getAttribute('aria-label'), expected });
}
async function reopen(projectId = 'A', extensionId = 'local.fixture') {
  await page.evaluate(() => window.configurationHarness.close());
  await pathInput.waitFor({ state: 'detached' });
  await page.evaluate(({ projectId, extensionId }) => window.configurationHarness.open(projectId, extensionId), { projectId, extensionId });
  await pathInput.waitFor({ state: 'visible' });
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await value('程序路径', '/saved/server');
  await pathInput.fill('/draft/project-server');
  await jsonInput.fill('{"args":["--draft"]}');
  await page.getByRole('status').filter({ hasText: '未保存' }).waitFor();
  assert.equal(await page.evaluate(() => window.configurationHarness.requests.filter(request => request.method === 'extension_config_set').length), 0);
  phases.push('input stays unsaved');

  await scope.selectOption('global'); await value('程序路径', '/saved/server');
  await pathInput.fill('/draft/global-server');
  await scope.selectOption('project'); await value('程序路径', '/draft/project-server');
  await value('启动 JSON', '{"args":["--draft"]}');
  await scope.selectOption('global'); await value('程序路径', '/draft/global-server');
  phases.push('scope drafts remain separate');

  await page.getByRole('button', { name: '返回 配置测试', exact: true }).click();
  await pathInput.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: '插件设置', exact: true }).click();
  await value('程序路径', '/draft/global-server');
  await reopen(); await value('程序路径', '/draft/global-server');
  assert.equal(await scope.inputValue(), 'global');
  phases.push('overview return and parent unmount retain draft and scope');

  await reopen('B'); await value('程序路径', '/saved/server');
  await pathInput.fill('/draft/project-b');
  await reopen('A', 'local.other'); await value('程序路径', '/saved/server');
  await reopen(); await value('程序路径', '/draft/global-server');
  await scope.selectOption('project'); await value('程序路径', '/draft/project-server');
  phases.push('project and extension drafts remain separate');

  await savePath.click(); await enabled(savePath, false); await enabled(saveJson, true);
  await value('程序路径', '/draft/project-server');
  await value('启动 JSON', '{"args":["--draft"]}');
  const saved = await page.evaluate(() => window.configurationHarness.requests.filter(request => request.method === 'extension_config_set'));
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], { method: 'extension_config_set', params: { extensionId: 'local.fixture', expectedRevision: 1, scope: 'project', key: 'path', value: '/draft/project-server' }, projectId: 'A' });
  phases.push('saving one field preserves other drafts');

  await page.evaluate(() => window.configurationHarness.failSave());
  await saveJson.click();
  await page.getByRole('alert').filter({ hasText: 'Fixture save failed' }).waitFor();
  await value('启动 JSON', '{"args":["--draft"]}'); await enabled(saveJson, true);
  phases.push('failed save retains draft');

  await page.evaluate(() => window.configurationHarness.holdSave());
  await saveJson.click(); await enabled(saveJson, false);
  await jsonInput.fill('{"args":["--newer"]}');
  await page.evaluate(() => window.configurationHarness.finishSave());
  await enabled(saveJson, true); await value('启动 JSON', '{"args":["--newer"]}');
  phases.push('save completion retains edits made during save');

  await page.getByRole('button', { name: '放弃此范围草稿', exact: true }).click();
  await value('启动 JSON', '{"args":["--draft"]}'); await enabled(saveJson, false);
  await scope.selectOption('global'); await value('程序路径', '/draft/global-server');
  await page.getByRole('button', { name: '放弃此范围草稿', exact: true }).click();
  await value('程序路径', '/saved/server');
  await reopen('B'); await value('程序路径', '/draft/project-b');
  phases.push('explicit discard clears only current scope');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, phases }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
