/** Fetch a pinned official Pi runtime for offline protocol tests, never provider credentials. */
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const assets = {
  'linux-x64': ['pi-linux-x64.tar.gz', 'f2e4e4329603223d03260cdb8bd5033dbdc1f73ba58ab8939db2e56546e115d2', 42645744],
  'linux-arm64': ['pi-linux-arm64.tar.gz', 'fa5829c7ef83ffeaebba015715c8306220f89b2aa8a00154efbba98dd5440156', 42745801],
  'darwin-arm64': ['pi-darwin-arm64.tar.gz', '79d9979d76a2a5adb7c28e27e9b44629928ccd0dc9fbb6ae7217860bd5e8be5d', 31098931],
  'darwin-x64': ['pi-darwin-x64.tar.gz', '1bdefc9e1074c1de458ea9f2e43e6013ce49cd05326009b3de144037036585e2', 33558360],
};
const entry = assets[`${process.platform}-${process.arch}`];
if (!entry) throw new Error(`No verified Pi fixture asset for ${process.platform}/${process.arch}`);
const [name, sha256, size] = entry;
const parent = process.argv[2] ? path.resolve(process.argv[2]) : tmpdir();
await mkdir(parent, { recursive: true });
const directory = await mkdtemp(path.join(parent, 'horizon-pi-fixture-'));
try {
  const url = `https://github.com/earendil-works/pi/releases/download/v1.4.0/${name}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Pi fixture download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Official Pi fixture size/checksum mismatch');
  const archive = path.join(directory, name); await writeFile(archive, bytes);
  const extracted = spawnSync('tar', ['-xzf', archive, '-C', directory], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (extracted.error) throw extracted.error;
  if (extracted.status !== 0) throw new Error('Official Pi fixture extraction failed');
  const binary = path.join(directory, 'pi/pi');
  if (!(await stat(binary)).isFile()) throw new Error('Pi executable missing from verified archive');
  await rm(archive);
  await mkdir('research/verification', { recursive: true });
  await writeFile('research/verification/pi-fixture-asset.json', JSON.stringify({ version: '1.4.0', url, sha256, size, binary, platform: process.platform, arch: process.arch, scope: 'Official runtime with local deterministic model fixture only; not real model inference' }, null, 2) + '\n');
  // stdout contains only the absolute executable path, suitable for HORIZON_PI_BINARY.
  console.log(binary);
} catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
