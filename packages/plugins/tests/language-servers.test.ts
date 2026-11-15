import assert from 'node:assert/strict';
import test from 'node:test';
import { builtinById } from '../src/builtins';
import { validateManifest } from '../src/validation';
import type { LanguageServerDefinition, PluginManifest } from '../src/types';

const manifest = (): PluginManifest => ({
  id: 'local.semantic.example', name: 'Example navigation', version: '0.1.0', description: 'Example language server', author: 'Example',
  apiVersion: 1, engines: { horizon: '>=0.1.0 <0.2.0' }, runtime: { kind: 'declarative' },
  activation: ['onLanguage:example'], requires: {}, optional: {}, capabilities: ['language.server'],
  contributes: {
    languageServers: [{ id: 'example', languageIds: ['example'], rootMarkers: ['Examplefile'], command: 'example-server', args: ['--stdio'], initializationOptions: { indexing: true }, settings: { example: { diagnostics: false } } }],
  },
});

test('semantic builtins reuse language families without making syntax depend on a server', () => {
  const typescript = builtinById.get('horizon.semantic.typescript')!;
  const rust = builtinById.get('horizon.semantic.rust')!;
  for (const plugin of [typescript, rust]) {
    assert.doesNotThrow(() => validateManifest(plugin));
    assert.equal(plugin.runtime.kind, 'declarative');
    assert.deepEqual(plugin.capabilities, ['language.server']);
    assert.ok(plugin.activation.every(event => event.startsWith('onLanguage:')));
    assert.equal(plugin.contributes.languages, undefined, 'semantic packages reuse the syntax package language IDs');
    const server = plugin.contributes.languageServers![0];
    for (const suffix of ['command', 'args']) assert.ok(plugin.contributes.settings!.some(setting => setting.key === `server.${server.id}.${suffix}`));
  }
  assert.deepEqual(typescript.contributes.languageServers![0].languageIds, ['javascript', 'javascriptreact', 'typescript', 'typescriptreact']);
  assert.deepEqual(Object.keys(typescript.requires), ['horizon.editor', 'horizon.language.javascript']);
  assert.deepEqual(Object.keys(rust.requires), ['horizon.editor', 'horizon.language.rust']);
  for (const id of ['horizon.language.javascript', 'horizon.language.rust']) {
    const syntax = builtinById.get(id)!;
    assert.equal(syntax.contributes.languageServers, undefined);
    assert.ok(Object.keys(syntax.requires).every(dependency => !dependency.startsWith('horizon.semantic.')));
    assert.equal(syntax.requires['horizon.editor'], undefined, 'syntax packages remain independent of the editor lifecycle');
  }
});

test('third-party declarative plugins can declare a language server with explicit process capability', () => {
  assert.doesNotThrow(() => validateManifest(manifest()));
  const noPermission = manifest();
  noPermission.capabilities = [];
  assert.throws(() => validateManifest(noPermission), /language.server/);
  for (const kind of ['quickjs', 'trusted-main'] as const) {
    const executable = manifest();
    executable.runtime = { kind, entry: 'index.js' };
    assert.throws(() => validateManifest(executable), /declarative/);
  }
});

test('server declarations reject ambiguous IDs, malformed argv and root traversal', () => {
  const invalidServers: Partial<LanguageServerDefinition>[] = [
    { id: '' },
    { languageIds: [] },
    { languageIds: ['example', 'example'] },
    { languageIds: ['../example'] },
    { command: '' },
    { command: 'server\0--stdio' },
    { args: ['--stdio\0'] },
    { rootMarkers: ['../outside'] },
    { rootMarkers: ['/absolute'] },
    { rootMarkers: ['subdir\\Examplefile'] },
  ];
  for (const patch of invalidServers) {
    const invalid = manifest();
    Object.assign(invalid.contributes.languageServers![0], patch);
    assert.throws(() => validateManifest(invalid), /语言服务器/);
  }
  for (const patch of [{ args: '--stdio' }, { settings: [] }, { initializationOptions: null }]) {
    const invalid = manifest();
    Object.assign(invalid.contributes.languageServers![0], patch);
    assert.throws(() => validateManifest(invalid), /语言服务器/);
  }
  const duplicate = manifest();
  duplicate.contributes.languageServers!.push({ id: 'example', languageIds: ['another'], command: 'another-server' });
  assert.throws(() => validateManifest(duplicate), /语言服务器 ID 重复/);
  const invalidArray = manifest();
  Object.assign(invalidArray.contributes, { languageServers: {} });
  assert.throws(() => validateManifest(invalidArray), /必须为数组/);
});
