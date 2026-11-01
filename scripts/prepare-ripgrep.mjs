import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = '15.2.0';
const hashes = {
  'aarch64-apple-darwin': '3750b2e93f37e0c692657da574d7019a101c0084da05a790c83fd335bad973e4',
  'x86_64-apple-darwin': 'af7825fcc69a2afc7a7aea55fc9af90e26421d8f20fe59df32e233c0b8a231c1',
  'x86_64-pc-windows-msvc': '71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5',
};

const defaultTarget = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
}[`${process.platform}-${process.arch}`];

export async function prepareRipgrep(target = defaultTarget) {
  if (!hashes[target]) throw new Error(`Unsupported Ripgrep packaging target: ${target ?? `${process.platform}-${process.arch}`}`);
  const windows = target.endsWith('-windows-msvc');
  const suffix = windows ? '.exe' : '';
  const extension = windows ? 'zip' : 'tar.gz';
  const destination = join(root, 'apps/desktop/src-tauri/binaries', `horizon-rg-${target}${suffix}`);
  const stamp = `${destination}.version`;
  if (existsSync(destination) && existsSync(stamp) && (await readFile(stamp, 'utf8')).trim() === `${version}:${hashes[target]}`) return destination;
  const directory = await mkdtemp(join(tmpdir(), 'horizon-rg-'));
  try {
    const name = `ripgrep-${version}-${target}`;
    const response = await fetch(`https://github.com/BurntSushi/ripgrep/releases/download/${version}/${name}.${extension}`);
    if (!response.ok) throw new Error(`Ripgrep download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== hashes[target]) throw new Error('Ripgrep checksum mismatch');
    const archive = join(directory, `ripgrep.${extension}`);
    await writeFile(archive, bytes);
    const extract = windows
      ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
        'Expand-Archive -LiteralPath $env:HORIZON_RG_ARCHIVE -DestinationPath $env:HORIZON_RG_DESTINATION -Force -ErrorAction Stop'],
      { stdio: 'inherit', env: { ...process.env, HORIZON_RG_ARCHIVE: archive, HORIZON_RG_DESTINATION: directory } })
      : spawnSync('/usr/bin/tar', ['-xzf', archive, '-C', directory], { stdio: 'inherit' });
    if (extract.error) throw extract.error;
    if (extract.status !== 0) throw new Error('Ripgrep extraction failed');
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(directory, name, `rg${suffix}`), destination);
    if (!windows) await chmod(destination, 0o755);
    await writeFile(stamp, `${version}:${hashes[target]}\n`);
    const licenses = join(root, 'apps/desktop/src-tauri/licenses/ripgrep');
    await mkdir(licenses, { recursive: true });
    for (const filename of ['COPYING', 'LICENSE-MIT', 'UNLICENSE']) {
      const source = join(directory, name, filename);
      if (existsSync(source)) await copyFile(source, join(licenses, filename));
    }
    return destination;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await prepareRipgrep(process.argv[2]));
}
