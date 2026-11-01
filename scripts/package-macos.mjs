import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export async function packageMacOS() {
  if (process.platform !== 'darwin') throw new Error('macOS packaging must run on macOS');
  const app = path.join(root, 'apps/desktop/src-tauri/target/release/bundle/macos/Horizon.app');
  await access(app);
  const output = path.join(root, 'artifacts/macos');
  await mkdir(output, { recursive: true });
  const stage = await mkdtemp(path.join(tmpdir(), 'horizon-package-'));
  const run = (command, args) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)));
  });
  try {
    await run('/usr/bin/ditto', [app, path.join(stage, 'Horizon.app')]);
    await symlink('/Applications', path.join(stage, 'Applications'));
    const stem = `Horizon-0.1.0-macOS-${process.arch}`;
    await run('/usr/bin/hdiutil', ['create', '-volname', 'Horizon', '-srcfolder', stage, '-ov', '-format', 'UDZO', path.join(output, `${stem}.dmg`)]);
    await run('/usr/bin/ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, path.join(output, `${stem}.zip`)]);
    console.log(`macOS application: ${app}\nInstallers: ${output}/${stem}.{dmg,zip}`);
  } finally { await rm(stage, { recursive: true, force: true }); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  packageMacOS().catch(error => { console.error(error.message); process.exitCode = 1; });
}
