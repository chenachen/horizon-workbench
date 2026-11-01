import { spawn } from 'node:child_process';
import { copyFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareRipgrep } from './prepare-ripgrep.mjs';
import { packageMacOS } from './package-macos.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] ?? 'dev';
const env = { ...process.env, PATH: `${path.join(homedir(), '.cargo', 'bin')}${path.delimiter}${process.env.PATH}` };
function run(command, args, cwd = root, capture = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit' });
    let output = ''; if (capture) child.stdout.on('data', chunk => { output += chunk; });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited ${code}`)));
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    child.once('exit', () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); });
  });
}
try {
  const release = mode === 'build';
  const details = await run('rustc', ['-vV'], root, true);
  const target = details.match(/^host:\s*(.+)$/m)?.[1];
  if (!target) throw new Error('Cannot identify the native Rust target');
  if (process.platform === 'darwin') {
    const picker = path.join(root, 'apps/picker-service');
    const contents = path.join(picker, 'target/HorizonPicker.app/Contents');
    await mkdir(path.join(contents, 'MacOS'), { recursive: true });
    await copyFile(path.join(picker, 'Info.plist'), path.join(contents, 'Info.plist'));
    await run('xcrun', ['swiftc', '-swift-version', '5', '-parse-as-library', '-O',
      '-target', `${target.startsWith('aarch64') ? 'arm64' : 'x86_64'}-apple-macosx12.0`,
      path.join(picker, 'Picker.swift'), '-o', path.join(contents, 'MacOS/HorizonPicker')]);
    await run('codesign', ['--force', '--sign', '-', path.dirname(contents)]);
  }
  await prepareRipgrep(target);
  await run('cargo', ['build', '--manifest-path', 'apps/git-service/Cargo.toml', ...(release ? ['--release'] : [])]);
  await run('cargo', ['build', '--manifest-path', 'apps/extension-host/Cargo.toml', ...(release ? ['--release'] : [])]);
  const binaries = path.join(root, 'apps/desktop/src-tauri/binaries');
  await mkdir(binaries, { recursive: true });
  const suffix = process.platform === 'win32' ? '.exe' : '';
  await copyFile(path.join(root, `apps/git-service/target/${release ? 'release' : 'debug'}/horizon-git${suffix}`), path.join(binaries, `horizon-git-${target}${suffix}`));
  await copyFile(path.join(root, `apps/extension-host/target/${release ? 'release' : 'debug'}/horizon-extension-host${suffix}`), path.join(binaries, `horizon-extension-host-${target}${suffix}`));
  const extra = process.argv.slice(3);
  const packageMac = release && process.platform === 'darwin' && !extra.includes('--bundles') && !extra.includes('--no-bundle');
  await run(path.join(root, 'node_modules/.bin/tauri'), [mode, ...extra, ...(packageMac ? ['--bundles', 'app'] : [])], path.join(root, 'apps/desktop'));
  if (release && process.platform === 'darwin' && !extra.includes('--no-bundle')) {
    const app = path.join(root, 'apps/desktop/src-tauri/target/release/bundle/macos/Horizon.app');
    await run('codesign', ['--force', '--sign', '-', app]);
    await run('codesign', ['--verify', '--deep', '--strict', app]);
  }
  if (packageMac) await packageMacOS();
} catch (error) { console.error(error.message); process.exitCode = 1; }
