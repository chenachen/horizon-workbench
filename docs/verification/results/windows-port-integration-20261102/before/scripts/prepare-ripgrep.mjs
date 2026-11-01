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
};

export async function prepareRipgrep(target = process.arch === 'arm64' ? 'aarch64-apple-darwin' : 'x86_64-apple-darwin') {
  if (!hashes[target]) throw new Error(`Ripgrep packaging is available for macOS targets only: ${target}`);
  const destination = join(root, 'apps/desktop/src-tauri/binaries', `horizon-rg-${target}`);
  const stamp = `${destination}.version`;
  if (existsSync(destination) && existsSync(stamp) && (await readFile(stamp, 'utf8')).trim() === `${version}:${hashes[target]}`) return destination;
  const directory = await mkdtemp(join(tmpdir(), 'horizon-rg-'));
  try {
    const name = `ripgrep-${version}-${target}`;
    const response = await fetch(`https://github.com/BurntSushi/ripgrep/releases/download/${version}/${name}.tar.gz`);
    if (!response.ok) throw new Error(`Ripgrep download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== hashes[target]) throw new Error('Ripgrep checksum mismatch');
    const archive = join(directory, 'ripgrep.tar.gz');
    await writeFile(archive, bytes);
    const extract = spawnSync('/usr/bin/tar', ['-xzf', archive, '-C', directory], { stdio: 'inherit' });
    if (extract.status !== 0) throw new Error('Ripgrep extraction failed');
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(join(directory, name, 'rg'), destination);
    await chmod(destination, 0o755);
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
