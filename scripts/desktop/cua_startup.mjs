// Import from cua_repl only. No action runs at module load.
// App/quit/PID identity checks are coordinated by the native operator.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

export async function captureNativeStartup(cua, {
  iteration, output, bundle, executable, expectedHash,
}) {
  const prefix = path.join(output, `launch-${String(iteration).padStart(2, '0')}`);
  await mkdir(output, { recursive: true });
  const hash = createHash('sha256').update(await readFile(executable)).digest('hex');
  if (hash !== expectedHash) throw new Error('App executable changed before launch');
  const record = {
    iteration, appBundle: bundle, executableSha256: hash,
    startedAt: new Date().toISOString(), status: 'started',
    measurement: 'CUA getApp call through enabled Welcome control observed by native AX; automation overhead included',
  };
  await writeFile(`${prefix}-started.json`, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  let app;
  const began = performance.now();
  try {
    app = await cua.getApp(bundle);
    record.getAppReturnedMs = performance.now() - began;
    const ax = await app.getAXState({ emit: false, disableDiffing: true });
    const observed = performance.now();
    record.endpointObservedAt = new Date().toISOString();
    record.endpointLine = ax.split('\n').find(line => /^\s*\d+ button 打开本地项目(?:,|$)/.test(line)) ?? null;
    record.status = record.endpointLine && !/disabled|not enabled/i.test(record.endpointLine) ? 'ready' : 'endpoint_not_ready';
    record.observedMs = observed - began;
    record.readyMs = record.status === 'ready' ? record.observedMs : null;
    await writeFile(`${prefix}.txt`, ax, { flag: 'wx' });
    const bytes = await app.getScreenshot({ emit: false });
    if (!(bytes instanceof Uint8Array)) throw new Error('Expected one macOS window screenshot');
    const extension = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'jpg' : bytes[0] === 0x89 && bytes[1] === 0x50 ? 'png' : null;
    if (!extension) throw new Error('Unexpected native screenshot format');
    await writeFile(`${prefix}.${extension}`, bytes, { flag: 'wx' });
    record.screenshot = `${prefix}.${extension}`;
    record.screenshotSha256 = createHash('sha256').update(bytes).digest('hex');
    record.axSha256 = createHash('sha256').update(ax).digest('hex');
  } catch (error) {
    record.status = 'observation_failed';
    record.readyMs = null;
    record.error = String(error);
  }
  record.finishedAt = new Date().toISOString();
  await writeFile(`${prefix}.json`, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  return { app, record };
}
