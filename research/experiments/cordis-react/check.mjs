import { build } from 'esbuild';
import { chromium } from '../../../node_modules/playwright/index.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import os from 'node:os';

const here = new URL('./', import.meta.url);
const bundle = await build({ absWorkingDir: here.pathname, entryPoints: ['main.jsx'], bundle: true,
  platform: 'browser', format: 'iife', target: 'es2022', minify: true, write: false, metafile: true,
  define: { 'process.env.NODE_ENV': '"production"' } });
const js = bundle.outputFiles[0].contents;
const server = createServer((req, res) => {
  if (req.url === '/app.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(js); }
  else { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><div id="app"></div><script src="/app.js"></script>'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => window.research || window.researchError);
  assert.equal(await page.evaluate(() => window.researchError), undefined);
  await page.waitForFunction(() => window.research.metrics.mounts === 1);
  assert.deepEqual(await page.evaluate(() => window.research.environment), { nodeProcess: 'undefined', require: 'undefined' });
  assert.equal(await page.evaluate(() => window.research.metrics.activations), 0);
  await page.evaluate(() => window.research.provide());
  await page.evaluate(() => window.research.ping());
  assert.equal(await page.evaluate(() => window.research.metrics.activations), 1);
  assert.equal(await page.evaluate(() => window.research.metrics.events), 1);
  await page.getByRole('textbox', { name: 'document' }).fill('uncommitted user edits');
  await page.evaluate(() => { window.documentBefore = document.querySelector('textarea'); window.research.patch({ layout: 'top', theme: 'dark', sidebarWidth: 300 }); });
  await page.waitForSelector('[data-layout="top"][data-theme="dark"]');
  assert.equal(await page.evaluate(() => window.documentBefore === document.querySelector('textarea')), true);
  assert.equal(await page.getByRole('textbox', { name: 'document' }).inputValue(), 'uncommitted user edits');
  assert.equal(await page.evaluate(() => window.research.metrics.mounts), 1);
  await page.evaluate(() => window.research.removeProvider());
  const stopped = await page.evaluate(() => ({ ...window.research.metrics }));
  await page.evaluate(() => window.research.ping());
  await page.waitForTimeout(60);
  assert.equal(await page.evaluate(() => window.research.metrics.cleanups), 1);
  assert.equal(await page.evaluate(() => window.research.metrics.events), stopped.events);
  assert.equal(await page.evaluate(() => window.research.metrics.timers), stopped.timers);
  await page.evaluate(() => window.research.provide());
  assert.equal(await page.evaluate(() => window.research.metrics.activations), 2);
  await page.evaluate(() => window.research.shutdown());
  assert.equal(await page.evaluate(() => window.research.subscribers()), 0);
  const metrics = await page.evaluate(() => ({ ...window.research.metrics }));
  assert.equal(metrics.cleanups, 2);
  assert.equal(metrics.unmounts, 1);
  assert.deepEqual(errors, []);
  const lock = JSON.parse(await readFile(new URL('package-lock.json', here), 'utf8'));
  const result = { observedOn: new Date().toISOString(), platform: `${os.platform()} ${os.arch()}`, browser: browser.version(),
    status: 'passed', checks: ['browser_without_node_globals', 'dependency_wait_and_resume', 'provider_teardown_stops_consumer',
      'effect_timer_and_event_cleanup', 'theme_and_geometry_preserve_document_element', 'react_subscription_cleanup'],
    packages: Object.fromEntries(['cordis','react','react-dom','cosmokit','esbuild'].map(name => [name, lock.packages[`node_modules/${name}`]?.version])),
    bundleBytes: js.byteLength, metrics,
    limits: ['Chromium research experiment, not native Tauri WebView', 'No desktop memory/CPU benchmark',
      'No arbitrary-layout-tree/CodeMirror/IME validation', 'No Node Loader, QuickJS or DSH plugin compatibility test'] };
  await writeFile(new URL('result.json', here), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
