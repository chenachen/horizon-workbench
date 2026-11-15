import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { EditorState, type Extension } from '@codemirror/state';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Registry, type IGrammar, type IRawGrammar } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { createTextmateLanguage, disposeTextmateLanguage, TextmateDocument } from './textmate';
import type { TokenColorRule } from '../../../../../packages/plugins/src/types';

const grammarDefinition: IRawGrammar = {
  scopeName: 'source.fixture',
  repository: { $self: {}, $base: {} },
  patterns: [
    { name: 'comment.block.fixture', begin: '/\\*', end: '\\*/' },
    { name: 'string.quoted.double.fixture', begin: '"', end: '"' },
    { name: 'keyword.control.fixture', match: '\\b(?:let|const)\\b' },
    { name: 'constant.numeric.fixture', match: '\\b\\d+\\b' },
  ],
};
const registries: Registry[] = [];
const languageExtensions: Extension[] = [];
let wasmBytes: ArrayBuffer;

beforeAll(async () => {
  const require = createRequire(import.meta.url);
  const bytes = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'));
  wasmBytes = Uint8Array.from(bytes).buffer;
  await loadWASM(wasmBytes);
});
afterEach(() => {
  registries.splice(0).forEach(registry => registry.dispose());
  languageExtensions.splice(0).forEach(disposeTextmateLanguage);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function fixture(source: string) {
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: patterns => new OnigScanner(patterns),
      createOnigString: text => new OnigString(text),
    }),
    theme: { settings: [
      { settings: { foreground: '#111111', background: '#ffffff' } },
      { scope: 'comment', settings: { foreground: '#778899' } },
      { scope: 'string', settings: { foreground: '#008800' } },
      { scope: 'keyword', settings: { foreground: '#aa00aa', fontStyle: 'bold italic underline strikethrough' } },
    ] },
    loadGrammar: async scope => scope === grammarDefinition.scopeName ? grammarDefinition : null,
  });
  registries.push(registry);
  const grammar = (await registry.loadGrammar(grammarDefinition.scopeName))!;
  const tokenize = vi.fn(grammar.tokenizeLine2.bind(grammar));
  const trackedGrammar: IGrammar = { tokenizeLine: grammar.tokenizeLine.bind(grammar), tokenizeLine2: tokenize };
  const state = EditorState.create({ doc: source });
  const cache = new TextmateDocument(trackedGrammar, state.doc);
  const color = (line: number, offset = 0) => {
    const tokens = cache.tokensFor(line)!;
    let metadata = tokens[1];
    for (let index = 2; index < tokens.length && tokens[index] <= offset; index += 2) metadata = tokens[index + 1];
    return registry.getColorMap()[(metadata >>> 15) & 0x1ff].toLowerCase();
  };
  return { state, cache, tokenize, color, grammar: trackedGrammar };
}

describe('TextMate document highlighting', () => {
  it('uses a supplied token palette independently from fallback scope rules', async () => {
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '#aa0000' }));
    vi.stubGlobal('fetch', async () => new Response(wasmBytes));
    const loadGrammar = Registry.prototype.loadGrammar;
    const loaded: Array<{ registry: Registry; grammar: IGrammar }> = [];
    vi.spyOn(Registry.prototype, 'loadGrammar').mockImplementation(async function (this: Registry, scope: string) {
      const grammar = await loadGrammar.call(this, scope);
      if (grammar) loaded.push({ registry: this, grammar });
      return grammar;
    });
    const palettes: Array<TokenColorRule[] | undefined> = [
      undefined,
      [{ scope: 'constant', settings: { foreground: '#0000aa' } }],
      [],
    ];
    const colors: string[] = [];
    for (const tokenColors of palettes) {
      languageExtensions.push(await createTextmateLanguage({
        scopeName: grammarDefinition.scopeName,
        foreground: '#111111', background: '#ffffff', tokenColors,
        loadGrammar: async scope => scope === grammarDefinition.scopeName ? grammarDefinition : null,
        getInjections: () => [],
      }));
      const current = loaded.at(-1)!;
      const tokens = current.grammar.tokenizeLine2('123', null).tokens;
      colors.push(current.registry.getColorMap()[(tokens[1] >>> 15) & 0x1ff].toLowerCase());
    }
    expect(colors).toEqual(['#aa0000', '#0000aa', '#111111']);
  });

  it('propagates multiline comment changes to downstream lines', async () => {
    const { state, cache, color } = await fixture('const a = 1;\n/* note\nstill comment */\nconst b = 2;');
    cache.tokenizeThrough(state.doc.lines);
    expect(color(2)).toBe('#778899');
    expect(color(3)).toBe('#778899');
    const edit = state.update({ changes: { from: state.doc.line(2).from, to: state.doc.line(2).from + 2 } });
    cache.update(edit.state.doc, edit.changes);
    cache.tokenizeThrough(edit.state.doc.lines);
    expect(color(3)).toBe('#111111');
    expect(color(4)).toBe('#aa00aa');
  });

  it('reuses the unchanged suffix when an edit preserves the grammar state', async () => {
    const { state, cache, tokenize, color } = await fixture(Array.from({ length: 500 }, (_, index) => `const a${index} = 1;`).join('\n'));
    cache.tokenizeThrough(state.doc.lines);
    tokenize.mockClear();
    const number = state.doc.line(1).text.indexOf('1');
    const edit = state.update({ changes: { from: number, to: number + 1, insert: '99' } });
    cache.update(edit.state.doc, edit.changes);
    cache.tokenizeThrough(edit.state.doc.lines);
    expect(tokenize).toHaveBeenCalledTimes(1);
    expect(cache.readyThrough).toBe(500);
    expect(color(500)).toBe('#aa00aa');
  });

  it('keeps a retained document cache independent when an edited view forks it', async () => {
    const { state, cache, tokenize, color } = await fixture('const a = 1;\nconst b = 2;\nconst c = 3;');
    cache.tokenizeThrough(state.doc.lines);
    const retained = Array.from(cache.tokensFor(2)!);
    const edit = state.update({ changes: { from: state.doc.line(1).from, insert: '/* ' } });
    const edited = cache.fork(edit.state.doc, edit.changes);
    edited.tokenizeThrough(edit.state.doc.lines);
    expect(edited.tokensFor(2)).not.toEqual(cache.tokensFor(2));
    expect(Array.from(cache.tokensFor(2)!)).toEqual(retained);
    expect(color(2)).toBe('#aa00aa');
    tokenize.mockClear();
    cache.tokenizeThrough(state.doc.lines);
    expect(tokenize).not.toHaveBeenCalled();
  });

  it('maps cached suffixes after inserting and removing line breaks', async () => {
    const { state, cache, color } = await fixture('const a = 1;\nconst b = 2;\nconst c = 3;');
    cache.tokenizeThrough(state.doc.lines);
    const insert = state.update({ changes: { from: state.doc.line(2).from, insert: '/* note\ncontinued */\n' } });
    cache.update(insert.state.doc, insert.changes);
    cache.tokenizeThrough(insert.state.doc.lines);
    expect(color(2)).toBe('#778899');
    expect(color(3)).toBe('#778899');
    expect(color(4)).toBe('#aa00aa');
    expect(color(5)).toBe('#aa00aa');
    const remove = insert.state.update({ changes: { from: insert.state.doc.line(2).from, to: insert.state.doc.line(4).from } });
    cache.update(remove.state.doc, remove.changes);
    cache.tokenizeThrough(remove.state.doc.lines);
    expect(cache.readyThrough).toBe(3);
    expect(color(2)).toBe('#aa00aa');
    expect(color(3)).toBe('#aa00aa');
  });

  it('keeps pending multiline state invalidation through another edit', async () => {
    const { state, cache, color } = await fixture(Array.from({ length: 12 }, (_, index) => `const a${index} = 1;`).join('\n'));
    cache.tokenizeThrough(state.doc.lines);
    const openComment = state.update({ changes: { from: state.doc.line(2).from, insert: '/* ' } });
    cache.update(openComment.state.doc, openComment.changes);
    cache.tokenizeThrough(3);
    expect(cache.readyThrough).toBe(3);
    expect(cache.tokensFor(4)).toBeUndefined();
    const closeComment = openComment.state.update({ changes: { from: openComment.state.doc.line(8).from, insert: '*/ ' } });
    cache.update(closeComment.state.doc, closeComment.changes);
    cache.tokenizeThrough(closeComment.state.doc.lines);
    expect(color(7)).toBe('#778899');
    expect(color(8, 3)).toBe('#aa00aa');
    expect(color(9)).toBe('#aa00aa');
  });

  it('carries multiline string state and encoded font styles', async () => {
    const { state, cache, color } = await fixture('const a = "first\nsecond";\nconst b = 2;');
    cache.tokenizeThrough(state.doc.lines);
    expect(color(2)).toBe('#008800');
    const metadata = cache.tokensFor(1)![1];
    expect((metadata >>> 11) & 0xf).toBe(15);
    const edit = state.update({ changes: { from: state.doc.line(1).text.indexOf('"'), to: state.doc.line(1).text.indexOf('"') + 1 } });
    cache.update(edit.state.doc, edit.changes);
    cache.tokenizeThrough(edit.state.doc.lines);
    expect(color(2)).toBe('#111111');
    expect(color(3)).toBe('#008800');
  });

  it('matches a fresh parse after edits during partial background parsing', async () => {
    const fixtureState = await fixture('const a = 1;\n/* note */\nconst b = "hello";\nconst c = 3;');
    const { cache, grammar } = fixtureState;
    let state = fixtureState.state;
    let seed = 41;
    const random = (limit: number) => { seed = (seed * 16807) % 2147483647; return seed % limit; };
    const inserts = ['/*', '*/', '"', '\n', 'const ', '', 'note'];
    for (let attempt = 0; attempt < 80; attempt++) {
      cache.tokenizeThrough(Math.max(1, random(state.doc.lines + 1)));
      const from = random(state.doc.length + 1);
      const to = Math.min(state.doc.length, from + random(4));
      const edit = state.update({ changes: { from, to, insert: inserts[random(inserts.length)] } });
      state = edit.state;
      cache.update(state.doc, edit.changes);
      if (attempt % 3) continue;
      cache.tokenizeThrough(state.doc.lines);
      const fresh = new TextmateDocument(grammar, state.doc);
      fresh.tokenizeThrough(state.doc.lines);
      for (let line = 1; line <= state.doc.lines; line++) expect(cache.tokensFor(line)).toEqual(fresh.tokensFor(line));
    }
  });
});
