import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root, '.work/plugin-wake-race.bundle.mjs');
await build({
  entryPoints: [path.join(root, '.work/probe-plugin-wake-race.ts')], outfile: output,
  bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
  plugins: [{ name: 'owned-rpc-boundary', setup(build) {
    build.onResolve({ filter: /(^|\/)bridge$/ }, args => ({ path: args.path, namespace: 'owned-rpc' }));
    build.onLoad({ filter: /.*/, namespace: 'owned-rpc' }, () => ({ contents: `export const nativeAvailable = () => true; export const call = (...args) => globalThis.__wakeRace.call(...args); export const start = (...args) => globalThis.__wakeRace.start(...args); export const onEvent = async () => () => {};`, loader: 'js' }));
    build.onResolve({ filter: /^\.\/workerHost$/ }, () => ({ path: 'workerHost', namespace: 'unused-worker' }));
    build.onLoad({ filter: /.*/, namespace: 'unused-worker' }, () => ({ contents: 'export const registerWorkerPackage = () => { throw new Error("No QuickJS in this probe"); };', loader: 'js' }));
  } }],
});
await import(pathToFileURL(output).href);
