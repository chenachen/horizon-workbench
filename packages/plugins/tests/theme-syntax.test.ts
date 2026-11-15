import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { before, test } from 'node:test';
import type { IGrammar, IRawGrammar, Registry } from 'vscode-textmate';
import { builtinPackages, builtinThemes } from '../src/builtins';
import { validateTheme } from '../src/validation';
import type { ThemeDefinition } from '../src/types';

const require = createRequire(import.meta.url);
const textmate: typeof import('vscode-textmate') = require('vscode-textmate');
const oniguruma: typeof import('vscode-oniguruma') = require('vscode-oniguruma');
const grammars = new Map<string, IRawGrammar>();
type Mode = 'light' | 'dark';

before(async () => {
  const bytes = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  for (const manifest of builtinPackages) {
    for (const definition of manifest.contributes.grammars ?? []) {
      const path = new URL(`../builtins/${manifest.id}/${definition.path}`, import.meta.url);
      grammars.set(definition.scopeName, JSON.parse(await readFile(path, 'utf8')));
    }
  }
});

function contrast(foreground: string, background: string): number {
  const luminance = (color: string) => {
    const [red, green, blue] = [1, 3, 5]
      .map(index => Number.parseInt(color.slice(index, index + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const a = luminance(foreground), b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function roleColor(theme: ThemeDefinition, mode: Mode, name: string): string {
  const rule = theme.tokenColors?.[mode]?.find(rule => rule.name === name);
  assert.ok(rule?.settings.foreground, `${theme.id} ${mode} declares ${name}`);
  return rule.settings.foreground.toLowerCase();
}

function registryFor(theme: ThemeDefinition, mode: Mode): Registry {
  return new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new oniguruma.OnigScanner(patterns),
      createOnigString: source => new oniguruma.OnigString(source),
    }),
    theme: { settings: [
      { settings: { foreground: theme[mode].text, background: theme[mode].surface } },
      ...theme.tokenColors![mode]!,
    ] },
    loadGrammar: async scope => grammars.get(scope) ?? null,
  });
}

function tokenAt(registry: Registry, grammar: IGrammar, line: string, needle: string) {
  const position = line.indexOf(needle);
  assert.ok(position >= 0, `Sample contains ${needle}`);
  const result = grammar.tokenizeLine2(line, null);
  let metadata = result.tokens[1];
  for (let index = 2; index < result.tokens.length && result.tokens[index] <= position; index += 2) {
    metadata = result.tokens[index + 1];
  }
  return { color: registry.getColorMap()[(metadata >>> 15) & 0x1ff].toLowerCase(), fontStyle: (metadata >>> 11) & 0xf };
}

test('all built-in themes declare readable light and dark syntax palettes', () => {
  assert.equal(builtinThemes.length, 8);
  for (const theme of builtinThemes) {
    validateTheme(theme);
    for (const mode of ['light', 'dark'] as const) {
      const rules = theme.tokenColors?.[mode];
      assert.ok(rules && rules.length >= 16, `${theme.id} ${mode} has a complete palette`);
      const colors = rules.flatMap(rule => rule.settings.foreground ? [rule.settings.foreground] : []);
      assert.ok(new Set(colors).size >= 10, `${theme.id} ${mode} distinguishes syntax roles`);
      for (const color of colors) {
        assert.ok(contrast(color, theme[mode].surface) >= 4.5, `${theme.id} ${mode} ${color} contrasts with editor surface`);
      }
    }
  }
});

test('all built-in palettes distinguish TypeScript functions, parameters, properties and literals', async () => {
  const source = 'export function greet(user: User) { const message = "hello"; return user.name + message + 42; }';
  const roles = [
    ['export', 'Keywords'], ['greet', 'Functions'], ['user', 'Parameters'], ['User', 'Types'],
    ['message', 'Variables'], ['hello', 'Strings'], ['name', 'Properties'], ['42', 'Numbers and constants'],
  ];
  for (const theme of builtinThemes) {
    for (const mode of ['light', 'dark'] as const) {
      const registry = registryFor(theme, mode);
      try {
        const grammar = await registry.loadGrammar('source.ts');
        assert.ok(grammar);
        for (const [needle, role] of roles) {
          const token = tokenAt(registry, grammar, source, needle);
          assert.equal(token.color, roleColor(theme, mode, role), `${theme.id} ${mode} ${needle} uses ${role}`);
          assert.notEqual(token.color, theme[mode].text.toLowerCase(), `${theme.id} ${mode} ${needle} receives syntax color`);
        }
      } finally { registry.dispose(); }
    }
  }
});

test('Aurora palettes cover JSX, HTML, JSON, CSS and Markdown syntax', async () => {
  const theme = builtinThemes.find(theme => theme.id === 'horizon.theme.aurora')!;
  for (const mode of ['light', 'dark'] as const) {
    const registry = registryFor(theme, mode);
    try {
      const jsx = await registry.loadGrammar('source.tsx');
      const html = await registry.loadGrammar('text.html.basic');
      const json = await registry.loadGrammar('source.json');
      const css = await registry.loadGrammar('source.css');
      const markdown = await registry.loadGrammar('text.html.markdown');
      assert.ok(jsx && html && json && css && markdown);
      const jsxSource = 'const View = () => <Widget title="hello" />;';
      assert.equal(tokenAt(registry, jsx, jsxSource, 'Widget').color, roleColor(theme, mode, 'Tags'));
      assert.equal(tokenAt(registry, jsx, jsxSource, 'title').color, roleColor(theme, mode, 'Attributes'));
      const htmlSource = '<button disabled title="hello">Ready</button>';
      assert.equal(tokenAt(registry, html, htmlSource, 'button').color, roleColor(theme, mode, 'Tags'));
      assert.equal(tokenAt(registry, html, htmlSource, 'disabled').color, roleColor(theme, mode, 'Attributes'));
      const jsonSource = '{"name": "hello", "count": 42}';
      assert.equal(tokenAt(registry, json, jsonSource, 'name').color, roleColor(theme, mode, 'Properties'));
      assert.equal(tokenAt(registry, json, jsonSource, 'hello').color, roleColor(theme, mode, 'Strings'));
      const cssSource = '#card.primary { color: red; width: 42px; }';
      assert.equal(tokenAt(registry, css, cssSource, 'card').color, roleColor(theme, mode, 'CSS selectors'));
      assert.equal(tokenAt(registry, css, cssSource, 'color').color, roleColor(theme, mode, 'Properties'));
      const heading = tokenAt(registry, markdown, '# Heading', 'Heading');
      assert.equal(heading.color, roleColor(theme, mode, 'Headings'));
      assert.ok(heading.fontStyle & 2);
      assert.ok(tokenAt(registry, markdown, '**bold**', 'bold').fontStyle & 2);
      assert.ok(tokenAt(registry, markdown, '*italic*', 'italic').fontStyle & 1);
      const link = tokenAt(registry, markdown, '[label](https://example.com)', 'https');
      assert.equal(link.color, roleColor(theme, mode, 'Links'));
      assert.ok(link.fontStyle & 4);
    } finally { registry.dispose(); }
  }
});
