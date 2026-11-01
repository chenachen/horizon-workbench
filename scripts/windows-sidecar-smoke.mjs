import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run only on the native Windows CI runner, against the exact bundle inputs.
assert.equal(process.platform, 'win32');
assert.equal(process.arch, 'x64');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = 'x86_64-pc-windows-msvc';
const binary = name => path.join(root, 'apps/desktop/src-tauri/binaries', `${name}-${target}.exe`);
const hash = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const run = (file, args, input) => execFileSync(file, args, {
  input, encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true,
});
const temporary = await mkdtemp(path.join(tmpdir(), 'horizon-windows-smoke-'));
try {
  const rg = run(binary('horizon-rg'), ['--version']).trim();
  assert.match(rg, /^ripgrep 15\.2\.0\b/);
  const git = JSON.parse(run(binary('horizon-git'), [], JSON.stringify({
    method: 'git_detect', root: temporary, cacheDir: path.join(temporary, 'cache'), params: {},
  })));
  assert.equal(git.type, 'result');
  assert.match(git.data.version, /^git version /);
  const sidecars = [];
  for (const [name, project] of [['horizon-git', 'git-service'], ['horizon-extension-host', 'extension-host']]) {
    const bundleInput = await hash(binary(name));
    const nativeBuild = await hash(path.join(root, `apps/${project}/target/release/${name}.exe`));
    assert.equal(bundleInput, nativeBuild, `${name}: bundle input differs from native build`);
    sidecars.push({ name, sha256: bundleInput });
  }
  sidecars.push({ name: 'horizon-rg', sha256: await hash(binary('horizon-rg')) });
  console.log(JSON.stringify({ target, ripgrep: rg, git: git.data.version, sidecars,
    scope: 'native bundle inputs, ripgrep --version, horizon-git JSON git_detect; no GUI/provider/repository mutations' }, null, 2));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
