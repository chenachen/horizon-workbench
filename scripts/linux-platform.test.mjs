import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Evaluate the tiny pure platform module without requiring a TypeScript test runner.
const source = (await readFile(new URL('../apps/desktop/src/platform.ts', import.meta.url), 'utf8'))
  .replace(/^export type DesktopPlatform = .*;\n/m, '')
  .replace(/\): DesktopPlatform \{/, ') {')
  .replace(/\bexport /g, '');
function platformFor(platform, userAgent = '') {
  const context = vm.createContext({ navigator: { platform, userAgent } });
  vm.runInContext(`${source}\nthis.result = { platform, defaultLaunchShell, revealFileLabel, trashFileLabel };`, context);
  return context.result;
}
test('Linux launch profiles default to portable sh, not optional zsh', () => {
  for (const machine of ['Linux x86_64', 'Linux aarch64']) {
    assert.equal(platformFor(machine).platform, 'linux');
    assert.equal(platformFor(machine).defaultLaunchShell, '/bin/sh');
  }
});
test('existing desktop shell defaults remain unchanged', () => {
  assert.equal(platformFor('MacIntel').defaultLaunchShell, '/bin/zsh');
  assert.equal(platformFor('Win32').defaultLaunchShell, 'powershell.exe');
});

test('file actions use actual platform names without Linux Finder fallback', () => {
  assert.equal(platformFor('Linux x86_64').revealFileLabel, '在文件管理器中显示');
  assert.equal(platformFor('Linux x86_64').trashFileLabel, '移到回收站');
  assert.equal(platformFor('MacIntel').revealFileLabel, '在 Finder 中显示');
  assert.equal(platformFor('MacIntel').trashFileLabel, '移到废纸篓');
  assert.equal(platformFor('Win32').revealFileLabel, '在资源管理器中显示');
  assert.equal(platformFor('Win32').trashFileLabel, '移到回收站');
});
