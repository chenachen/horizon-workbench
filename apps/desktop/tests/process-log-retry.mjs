import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

// Mount the production component with deferred native reads; no real project or process is used.
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.argv[2];
const evidence = { kind: 'ProcessLog interrupted-read recovery regression', phases: [] };
const bundled = await build({
  bundle: true, format: 'esm', platform: 'browser', target: 'es2022', jsx: 'automatic',
  write: false, outfile: '/tmp/process-log-retry.js', loader: { '.css': 'empty' },
  plugins: [{ name: 'process-log-fixture', setup(builder) {
    builder.onLoad({ filter: /\/features\/processes\/index\.tsx$/ }, async args => ({
      contents: await readFile(args.path, 'utf8') + '\nexport { ProcessLog };\n',
      loader: 'tsx', resolveDir: path.dirname(args.path),
    }));
    builder.onResolve({ filter: /^\.\.\/\.\.\/bridge$/ }, args =>
      /\/features\/processes\/index\.tsx$/.test(args.importer)
        ? { path: args.path, namespace: 'fixture' } : undefined);
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const call = (...args) => window.processLogHarness.request(...args);
      export const start = () => { throw new Error('unexpected task'); };
      export const onEvent = () => { throw new Error('unexpected subscription'); };
      export const errorMessage = error => error instanceof Error ? error.message : String(error);
    ` }));
  } }],
  stdin: { resolveDir: repository, contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { ProcessLog } from './apps/desktop/src/features/processes/index.tsx';
    const root = createRoot(document.getElementById('root'));
    const h = window.processLogHarness = {
      reads: [], reports: [], pending: 0, peakPending: 0,
      projectId: 'project-a', processId: 'process-a', reportVersion: 0,
      request(method, params, projectId) {
        if (method !== 'process_output_read') throw new Error('unexpected method: ' + method);
        h.pending++; h.peakPending = Math.max(h.peakPending, h.pending);
        return new Promise((resolve, reject) => h.reads.push({ method, params, projectId,
          resolve(value) { h.pending--; resolve(value); },
          reject(error) { h.pending--; reject(error); },
        }));
      },
      reply(index, bytes, nextOffset, bufferEnd = nextOffset, gap = false) {
        h.reads[index].resolve({ data: btoa(String.fromCharCode(...bytes)), nextOffset, bufferEnd, gap });
      },
      fail(index, message = 'temporary read failure') { h.reads[index].reject(new Error(message)); },
      render() {
        const reportVersion = ++h.reportVersion;
        flushSync(() => root.render(React.createElement(ProcessLog, {
          projectId: h.projectId, processId: h.processId,
          report: error => h.reports.push({ message: error.message, reportVersion }),
        })));
      },
      switchTo(projectId, processId) { h.projectId = projectId; h.processId = processId; h.render(); },
      close() { flushSync(() => root.render(null)); },
    };
    h.render();
  ` },
});
const assets = new Map(bundled.outputFiles.map(file => [path.basename(file.path), file.contents]));
const server = createServer((request, response) => {
  response.setHeader('Content-Type', request.url.endsWith('.js') ? 'text/javascript' : 'text/html');
  response.end(assets.get(request.url.slice(1)) ?? '<!doctype html><html><body><div id="root"></div><script type="module" src="/process-log-retry.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
const phase = name => evidence.phases.push({ name, passed: true });
const waitFor = async (predicate, argument) => {
  const deadline = Date.now() + 1500;
  while (!await page.evaluate(predicate, argument)) {
    if (Date.now() >= deadline) throw new Error('timed out waiting for harness state');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};
const waitReads = count => waitFor(count => window.processLogHarness.reads.length === count, count);
const snapshot = () => page.evaluate(() => ({
  reads: window.processLogHarness.reads.map(read => ({ params: read.params, projectId: read.projectId })),
  reports: window.processLogHarness.reports,
  pending: window.processLogHarness.pending, peakPending: window.processLogHarness.peakPending,
}));
const log = () => page.locator('.process-log').textContent();
const reply = (index, bytes, nextOffset, bufferEnd = nextOffset, gap = false) =>
  page.evaluate(args => window.processLogHarness.reply(...args), [index, bytes, nextOffset, bufferEnd, gap]);
try {
  await page.clock.install({ time: new Date('2026-11-15T00:00:00Z') });
  await page.goto('http://127.0.0.1:' + server.address().port);
  await waitReads(1);
  await page.clock.pauseAt(new Date('2026-11-15T00:01:00Z'));
  assert.deepEqual((await snapshot()).reads[0], { params: { processInstanceId: 'process-a', offset: '0' }, projectId: 'project-a' });

  // First byte of a multibyte character is buffered by the same streaming decoder across failure.
  await reply(0, [65, 228], '2');
  await waitFor(() => document.querySelector('.process-log').textContent === 'A');
  await page.clock.runFor(800);
  await waitReads(2);
  await page.evaluate(() => window.processLogHarness.fail(1));
  await page.getByRole('alert').waitFor();
  assert.match(await page.getByRole('alert').textContent(), /日志读取已中断/);
  assert.match(await page.getByRole('alert').textContent(), /temporary read failure/);
  assert.equal(await log(), 'A');
  await page.clock.runFor(5000);
  assert.equal((await snapshot()).reads.length, 2);
  assert.equal((await snapshot()).reports.length, 1);
  phase('read failure keeps existing output and exposes manual retry without automatic polling');

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent === '重试读取');
    button.click(); button.click();
  });
  await waitReads(3);
  assert.equal((await snapshot()).reads[2].params.offset, '2');
  await page.clock.runFor(2000);
  assert.equal((await snapshot()).reads.length, 3);
  assert.equal((await snapshot()).peakPending, 1);
  await reply(2, [184, 173, 66], '5');
  await waitFor(() => document.querySelector('.process-log').textContent === 'A中B');
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.equal((await log()).includes('\uFFFD'), false);
  phase('double retry starts one read at original offset and preserves streaming UTF-8 state');

  // A new report callback must not restart the stream from offset zero.
  await page.evaluate(() => window.processLogHarness.render());
  await page.clock.runFor(799);
  assert.equal((await snapshot()).reads.length, 3);
  await page.clock.runFor(1);
  await waitReads(4);
  assert.equal((await snapshot()).reads[3].params.offset, '5');
  await reply(3, [67], '6');
  await waitFor(() => document.querySelector('.process-log').textContent === 'A中BC');
  phase('successful retry resumes one poll chain despite callback identity changes');

  // Closing before the next due poll clears the timer.
  await page.evaluate(() => window.processLogHarness.close());
  await page.clock.runFor(5000);
  assert.equal((await snapshot()).reads.length, 4);
  assert.equal(await page.locator('.process-log').count(), 0);
  phase('unmount clears scheduled polling');

  await page.evaluate(() => window.processLogHarness.render());
  await waitReads(5);
  await page.evaluate(() => window.processLogHarness.close());
  await reply(4, [88], '1');
  await page.clock.runFor(5000);
  assert.equal((await snapshot()).reads.length, 5);
  assert.equal(await page.locator('.process-log').count(), 0);
  phase('late success after unmount cannot restore output or polling');

  await page.evaluate(() => window.processLogHarness.render());
  await waitReads(6);
  await page.evaluate(() => window.processLogHarness.close());
  await page.evaluate(() => window.processLogHarness.fail(5, 'late failure'));
  await page.clock.runFor(5000);
  assert.equal((await snapshot()).reads.length, 6);
  assert.equal((await snapshot()).reports.length, 1);
  phase('late failure after unmount cannot report or poll');

  await page.evaluate(() => window.processLogHarness.render());
  await waitReads(7);
  await page.evaluate(() => window.processLogHarness.switchTo('project-b', 'process-b'));
  await waitReads(8);
  assert.deepEqual((await snapshot()).reads[7], { params: { processInstanceId: 'process-b', offset: '0' }, projectId: 'project-b' });
  await reply(6, [79, 76, 68], '3');
  await reply(7, [78, 69, 87], '3');
  await waitFor(() => document.querySelector('.process-log').textContent === 'NEW');
  await page.clock.runFor(800);
  await waitReads(9);
  assert.deepEqual((await snapshot()).reads[8], { params: { processInstanceId: 'process-b', offset: '3' }, projectId: 'project-b' });
  assert.equal((await snapshot()).reports.length, 1);
  await page.evaluate(() => window.processLogHarness.close());
  await page.evaluate(() => window.processLogHarness.fail(8, 'closed new stream'));
  await page.clock.runFor(5000);
  assert.equal((await snapshot()).reads.length, 9);
  assert.equal((await snapshot()).reports.length, 1);
  phase('project/process switch ignores old completion and starts an isolated stream');

  assert.deepEqual(pageErrors, []);
  evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.error = String(error); evidence.pageErrors = pageErrors;
  process.exitCode = 1;
} finally {
  if (output) await writeFile(output, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ passed: evidence.passed, phases: evidence.phases.length, error: evidence.error, output }));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
