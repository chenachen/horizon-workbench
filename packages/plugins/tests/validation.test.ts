import assert from 'node:assert/strict';
import test from 'node:test';
import { validateManifest, validateTheme } from '../src/validation';
import type { PluginManifest, ThemeDefinition } from '../src/types';

const manifest = (): PluginManifest => ({
  id: 'local.language.example', name: 'Example', version: '0.1.0', description: 'Example language', author: 'Example',
  apiVersion: 1, engines: { horizon: '>=0.1.0 <0.2.0' }, runtime: { kind: 'declarative' },
  activation: ['onLanguage:example'], requires: {}, optional: {}, capabilities: [],
  contributes: {
    languages: [{ id: 'example', aliases: ['Example'], extensions: ['.example'], filenames: ['Examplefile'] }],
    grammars: [
      { language: 'example', scopeName: 'source.example', path: 'syntaxes/example.tmLanguage.json' },
      { scopeName: 'example.injection', path: 'syntaxes/injection.json', injectTo: ['source.example'] },
    ],
  },
});
const theme = (): ThemeDefinition => {
  const colors = { background: '#ffffff', surface: '#ffffff', text: '#112233', muted: '#667788', border: '#ccddee', accent: '#345678', onAccent: '#ffffff', selection: '#ddeeff', success: '#227744', warning: '#997722', error: '#aa3333' };
  return { id: 'local.theme.example', apiVersion: 1, label: 'Example', light: colors, dark: colors, radius: 4, density: 'comfortable' };
};

test('language plugins accept standalone and injected TextMate grammars', () => {
  assert.doesNotThrow(() => validateManifest(manifest()));
  const legacy = manifest();
  legacy.contributes = {};
  assert.doesNotThrow(() => validateManifest(legacy));
});

test('language plugins reject duplicate IDs and scope names', () => {
  const duplicateLanguage = manifest();
  duplicateLanguage.contributes.languages!.push({ id: 'example', extensions: ['.another'] });
  assert.throws(() => validateManifest(duplicateLanguage), /语言 ID 重复/);
  const duplicateGrammar = manifest();
  duplicateGrammar.contributes.grammars!.push({ scopeName: 'source.example', path: 'syntaxes/another.json' });
  assert.throws(() => validateManifest(duplicateGrammar), /语法 scope 重复/);
});

test('grammar paths stay inside their package and point to JSON', () => {
  for (const path of ['../escape.json', '/absolute.json', 'syntaxes/../escape.json', 'syntaxes//empty.json', 'C:/grammar.json', 'syntaxes\\grammar.json', 'syntaxes/grammar.js', 'syntaxes/./grammar.json']) {
    const invalid = manifest();
    invalid.contributes.grammars![0].path = path;
    assert.throws(() => validateManifest(invalid), /语法路径/, path);
  }
});

test('language declarations reject paths as extensions or filenames', () => {
  const invalidExtension = manifest();
  invalidExtension.contributes.languages![0].extensions = ['.foo/bar'];
  assert.throws(() => validateManifest(invalidExtension), /文件后缀/);
  const invalidFilename = manifest();
  invalidFilename.contributes.languages![0].filenames = ['../Examplefile'];
  assert.throws(() => validateManifest(invalidFilename), /文件名/);
  const invalidArray = manifest();
  Object.assign(invalidArray.contributes, { grammars: null });
  assert.throws(() => validateManifest(invalidArray), /必须为数组/);
});

test('themes accept optional token colors and explicit font style resets', () => {
  assert.doesNotThrow(() => validateTheme(theme()));
  const withTokens = theme();
  withTokens.tokenColors = {
    light: [{ name: 'Comments', scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: '#667788', fontStyle: 'italic' } }],
    dark: [{ scope: 'entity.name.function', settings: { foreground: '#aabbcc', fontStyle: 'bold underline strikethrough' } }, { scope: 'string', settings: { fontStyle: '' } }],
  };
  assert.doesNotThrow(() => validateTheme(withTokens));
});

test('themes reject invalid token colors, styles and mode shapes', () => {
  for (const settings of [{ foreground: '#abc' }, { fontStyle: 'normal' }, { background: '#123456' }]) {
    const invalid = theme();
    invalid.tokenColors = { light: [{ scope: 'comment', settings }] };
    assert.throws(() => validateTheme(invalid), /语法/);
  }
  const emptyScopes = theme();
  emptyScopes.tokenColors = { light: [{ scope: [], settings: {} }] };
  assert.throws(() => validateTheme(emptyScopes), /scope/);
  const unknownMode = theme();
  Object.assign(unknownMode, { tokenColors: { system: [] } });
  assert.throws(() => validateTheme(unknownMode), /配色模式/);
});
