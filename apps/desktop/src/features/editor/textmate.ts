import { Facet, RangeSetBuilder, StateEffect, type ChangeDesc, type Extension, type Text } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, logException, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { INITIAL, Registry, type IGrammar, type IOnigLib, type IRawGrammar, type IRawTheme, type StateStack } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import onigurumaUrl from 'vscode-oniguruma/release/onig.wasm?url';
import type { TokenColorRule } from '../../../../../packages/plugins/src/types';

export interface TextmateLanguageInput {
  scopeName: string;
  loadGrammar(scopeName: string): Promise<IRawGrammar | null>;
  getInjections(scopeName: string): string[];
  tokenColors?: TokenColorRule[];
  foreground: string;
  background: string;
  onError?(error: unknown): void;
}

let oniguruma: Promise<IOnigLib> | undefined;
function loadOniguruma(): Promise<IOnigLib> {
  if (!oniguruma) {
    oniguruma = fetch(onigurumaUrl).then(async response => {
      if (!response.ok) throw new Error(`无法加载 TextMate 正则引擎 (${response.status})`);
      await loadWASM(await response.arrayBuffer());
      return {
        createOnigScanner: (patterns: string[]) => new OnigScanner(patterns),
        createOnigString: (text: string) => new OnigString(text),
      };
    }).catch(error => { oniguruma = undefined; throw error; });
  }
  return oniguruma;
}

function textmateTheme(input: TextmateLanguageInput): IRawTheme {
  const base = { settings: { foreground: input.foreground, background: input.background } };
  if (input.tokenColors !== undefined) return { settings: [base, ...input.tokenColors] };
  const styles = getComputedStyle(document.documentElement);
  const color = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
  const accent = color('--h-accent', '#4b6fa5');
  const green = color('--h-green', '#338261');
  const muted = color('--h-muted', '#73829a');
  return { settings: [
    base,
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: accent } },
    { scope: ['string', 'constant.other.symbol'], settings: { foreground: green } },
    { scope: ['comment', 'meta.preprocessor'], settings: { foreground: muted } },
    { scope: ['constant.numeric', 'constant.language', 'entity.name.type', 'entity.name.class', 'support.type'], settings: { foreground: accent } },
    { scope: 'markup.heading', settings: { fontStyle: 'bold' } },
    { scope: 'markup.italic', settings: { fontStyle: 'italic' } },
    { scope: 'markup.bold', settings: { fontStyle: 'bold' } },
  ] };
}

type CachedLine = { text: string; incoming: StateStack; outgoing: StateStack; tokens: Uint32Array };

/** Line states let edits stop propagating once a multiline grammar returns to its cached state. */
export class TextmateDocument {
  private lines: Array<CachedLine | undefined> = [];
  private nextLine = 1;
  private dirtyThrough = 0;

  constructor(private grammar: IGrammar, private document: Text) {}

  get readyThrough(): number { return this.nextLine - 1; }

  tokensFor(line: number): Uint32Array | undefined {
    return line <= this.readyThrough ? this.lines[line - 1]?.tokens : undefined;
  }

  fork(document: Text, changes: ChangeDesc): TextmateDocument {
    const result = new TextmateDocument(this.grammar, this.document);
    result.lines = this.lines;
    result.nextLine = this.nextLine;
    result.dirtyThrough = this.dirtyThrough;
    result.update(document, changes);
    return result;
  }

  update(document: Text, changes: ChangeDesc): void {
    const previous = this.document;
    let firstOldLine = previous.lines + 1;
    let lastOldLine = 0;
    let firstNewLine = document.lines + 1;
    let lastNewLine = 0;
    changes.iterChangedRanges((fromA, toA, fromB, toB) => {
      firstOldLine = Math.min(firstOldLine, previous.lineAt(fromA).number);
      lastOldLine = Math.max(lastOldLine, previous.lineAt(toA).number);
      firstNewLine = Math.min(firstNewLine, document.lineAt(fromB).number);
      lastNewLine = Math.max(lastNewLine, document.lineAt(toB).number);
    });
    if (!lastOldLine) return;
    const previousDirtyEnd = previous.line(Math.max(1, Math.min(previous.lines, this.dirtyThrough))).to;
    const mappedDirtyLine = this.dirtyThrough ? document.lineAt(changes.mapPos(previousDirtyEnd, 1)).number : 0;
    const tail = this.lines.slice(lastOldLine);
    const replacement: Array<CachedLine | undefined> = tail.length ? new Array(lastNewLine - firstNewLine + 1) : [];
    this.lines = this.lines.slice(0, firstOldLine - 1).concat(replacement, tail);
    this.nextLine = Math.min(this.nextLine, firstNewLine);
    this.dirtyThrough = Math.max(mappedDirtyLine, lastNewLine);
    this.document = document;
  }

  tokenizeThrough(line: number, deadline = Infinity): void {
    const target = Math.min(line, this.document.lines);
    while (this.nextLine <= target && performance.now() < deadline) {
      const index = this.nextLine - 1;
      const text = this.document.line(this.nextLine).text;
      const incoming = index ? this.lines[index - 1]!.outgoing : INITIAL;
      let cached = this.lines[index];
      if (!cached || cached.text !== text || !cached.incoming.equals(incoming)) {
        const result = this.grammar.tokenizeLine2(text, incoming);
        cached = { text, incoming, outgoing: result.ruleStack, tokens: result.tokens };
        this.lines[index] = cached;
      }
      this.nextLine++;
      const next = this.lines[index + 1];
      if (this.nextLine > this.dirtyThrough && next?.incoming.equals(cached.outgoing)) {
        this.nextLine = this.lines.length + 1;
        this.dirtyThrough = 0;
      }
    }
  }
}

type Configuration = {
  grammar: IGrammar;
  registry: Registry;
  marks: Map<number, Decoration>;
  documents: WeakMap<Text, TextmateDocument>;
  disposed: boolean;
  failed: boolean;
  onError?: TextmateLanguageInput['onError'];
};
const configuration = Facet.define<Configuration, Configuration>({ combine: values => values[0] });
const languageConfigurations = new WeakMap<Extension, Configuration>();
const tokenizationProgress = StateEffect.define<null>();

function cachedDocument(config: Configuration, document: Text): TextmateDocument {
  let cached = config.documents.get(document);
  if (!cached) {
    cached = new TextmateDocument(config.grammar, document);
    config.documents.set(document, cached);
  }
  return cached;
}

function tokenMark(config: Configuration, metadata: number): Decoration {
  let mark = config.marks.get(metadata);
  if (mark) return mark;
  const foreground = (metadata >>> 15) & 0x1ff;
  const fontStyle = (metadata >>> 11) & 0xf;
  const classes = [`cm-tm-fg-${foreground}`];
  if (fontStyle & 1) classes.push('cm-tm-italic');
  if (fontStyle & 2) classes.push('cm-tm-bold');
  if (fontStyle & 4) classes.push('cm-tm-underline');
  if (fontStyle & 8) classes.push('cm-tm-strikethrough');
  mark = Decoration.mark({ class: classes.join(' ') });
  config.marks.set(metadata, mark);
  return mark;
}

class TextmateView {
  decorations: DecorationSet = Decoration.none;
  private config: Configuration;
  private document: TextmateDocument;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private view: EditorView) {
    this.config = view.state.facet(configuration);
    this.document = cachedDocument(this.config, view.state.doc);
    this.refresh();
  }

  get ready(): boolean {
    return !this.config.disposed && !this.config.failed && this.document.readyThrough >= this.view.state.doc.lineAt(this.view.viewport.to).number;
  }

  update(update: ViewUpdate): void {
    const config = update.state.facet(configuration);
    const configurationChanged = config !== this.config;
    if (configurationChanged) {
      this.config = config;
      this.document = cachedDocument(config, update.state.doc);
    } else if (update.docChanged) {
      this.document = config.documents.get(update.state.doc) ?? this.document.fork(update.state.doc, update.changes);
      config.documents.set(update.state.doc, this.document);
    }
    const backgroundProgress = update.transactions.some(transaction => transaction.effects.some(effect => effect.is(tokenizationProgress)));
    if (configurationChanged || update.docChanged || update.viewportChanged || backgroundProgress || !this.ready) this.refresh();
  }

  private refresh(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
    if (this.config.disposed || this.config.failed) { this.decorations = Decoration.none; return; }
    try {
      const lastLine = this.view.state.doc.lineAt(this.view.viewport.to).number;
      this.document.tokenizeThrough(lastLine, performance.now() + 8);
      const builder = new RangeSetBuilder<Decoration>();
      let previousLine = 0;
      for (const range of this.view.visibleRanges) {
        const first = Math.max(previousLine + 1, this.view.state.doc.lineAt(range.from).number);
        const last = this.view.state.doc.lineAt(range.to).number;
        for (let number = first; number <= last; number++) {
          const line = this.view.state.doc.line(number);
          const tokens = this.document.tokensFor(number);
          if (!tokens) continue;
          for (let index = 0; index < tokens.length; index += 2) {
            const from = line.from + tokens[index];
            const to = line.from + Math.min(line.length, index + 2 < tokens.length ? tokens[index + 2] : line.length);
            if (from < to) builder.add(from, to, tokenMark(this.config, tokens[index + 1]));
          }
        }
        previousLine = last;
      }
      this.decorations = builder.finish();
      if (!this.ready) this.timer = setTimeout(() => {
        this.timer = undefined;
        this.view.dispatch({ effects: tokenizationProgress.of(null) });
      }, 0);
    } catch (error) {
      this.config.failed = true;
      this.decorations = Decoration.none;
      if (this.config.onError) this.config.onError(error);
      else logException(this.view.state, error, 'TextMate highlighting');
    }
  }

  destroy(): void { if (this.timer !== undefined) clearTimeout(this.timer); }
}

const textmateView = ViewPlugin.fromClass(TextmateView, { decorations: plugin => plugin.decorations });

export function textmateHighlightReady(view: EditorView): boolean {
  return view.plugin(textmateView)?.ready ?? true;
}

export async function createTextmateLanguage(input: TextmateLanguageInput): Promise<Extension> {
  const registry = new Registry({
    onigLib: loadOniguruma(),
    theme: textmateTheme(input),
    loadGrammar: input.loadGrammar,
    getInjections: input.getInjections,
  });
  try {
    const grammar = await registry.loadGrammar(input.scopeName);
    if (!grammar) throw new Error(`无法加载 TextMate 语法 ${input.scopeName}`);
    const styles: Record<string, Record<string, string>> = {
      '.cm-tm-italic': { fontStyle: 'italic' },
      '.cm-tm-bold': { fontWeight: 'bold' },
      '.cm-tm-underline': { textDecoration: 'underline' },
      '.cm-tm-strikethrough': { textDecoration: 'line-through' },
      '.cm-tm-underline.cm-tm-strikethrough': { textDecoration: 'underline line-through' },
    };
    registry.getColorMap().forEach((color, index) => { if (color) styles[`.cm-tm-fg-${index}`] = { color }; });
    const config: Configuration = { grammar, registry, marks: new Map(), documents: new WeakMap(), disposed: false, failed: false, onError: input.onError };
    const extension: Extension = [configuration.of(config), textmateView, EditorView.theme(styles)];
    languageConfigurations.set(extension, config);
    return extension;
  } catch (error) { registry.dispose(); throw error; }
}

export function disposeTextmateLanguage(extension: Extension): void {
  const config = languageConfigurations.get(extension);
  if (config && !config.disposed) {
    config.disposed = true;
    config.registry.dispose();
    config.marks.clear();
    config.documents = new WeakMap();
  }
  languageConfigurations.delete(extension);
}
