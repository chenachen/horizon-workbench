import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ripgrepAsset } from './prepare-ripgrep.mjs';

test('GNU Linux x64 uses the pinned static upstream rg asset', () => {
  assert.deepEqual(ripgrepAsset('x86_64-unknown-linux-gnu'), {
    target: 'x86_64-unknown-linux-musl',
    hash: '33e15bcf1624b25cdd2a55813a47a2f95dbe126268203e76aa6a585d1e7b149c',
  });
});
test('Linux ARM64 and existing desktop targets remain pinned', () => {
  for (const target of ['aarch64-unknown-linux-gnu', 'aarch64-apple-darwin', 'x86_64-apple-darwin', 'x86_64-pc-windows-msvc']) {
    const asset = ripgrepAsset(target);
    assert.equal(asset.target, target);
    assert.match(asset.hash, /^[a-f0-9]{64}$/);
  }
});
test('unknown targets fail closed instead of downloading another platform', () => {
  for (const target of ['riscv64-unknown-linux-gnu', 'aarch64-pc-windows-msvc', undefined]) {
    assert.throws(() => ripgrepAsset(target), /Unsupported Ripgrep packaging target/);
  }
});
test('Linux targets are isolated from the macOS and Windows defaults', async () => {
  const config = name => readFile(new URL(`../apps/desktop/src-tauri/${name}`, import.meta.url), 'utf8').then(JSON.parse);
  assert.deepEqual((await config('tauri.linux.conf.json')).bundle.targets, ['deb', 'appimage']);
  assert.deepEqual((await config('tauri.conf.json')).bundle.targets, ['app', 'dmg']);
  assert.deepEqual((await config('tauri.windows.conf.json')).bundle.targets, ['nsis', 'msi']);
});
