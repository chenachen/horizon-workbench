import type { Extension } from '@codemirror/state';
import type { IRawGrammar } from 'vscode-textmate';
import { builtinPackages } from '../../../../../packages/plugins/src/builtins';
import type { ExtensionState, GrammarDefinition, LanguageDefinition, PluginManifest, TokenColorRule } from '../../../../../packages/plugins/src/types';
import { normalizeColor } from '../../../../../packages/appearance/src';
import { call, nativeAvailable } from '../../bridge';
import { activatePlugin, pluginRuntime, refreshPlugins } from '../plugins/service';
import { createTextmateLanguage, disposeTextmateLanguage } from './textmate';
import { editorStore } from './store';

type LanguageContribution = { extensionId: string; definition: LanguageDefinition };
type GrammarContribution = { extensionId: string; definition: GrammarDefinition };
type LoadedLanguage = { extension: Extension; highlighter: Extension };
type Catalog = {
  lifetime: { active: boolean };
  revision: number;
  fingerprint: string;
  languages: LanguageContribution[];
  grammars: Map<string, GrammarContribution>;
  tokenColors?: TokenColorRule[];
  foreground: string;
  background: string;
  loads: Map<string, Promise<LoadedLanguage>>;
};

const projects = new Map<string, Catalog>();
const listeners = new Set<() => void>();
const bundledGrammars = import.meta.env
  ? import.meta.glob<IRawGrammar>('../../../../../packages/plugins/builtins/horizon.language.*/syntaxes/*.json', { import: 'default' })
  : {};
const structuralLanguages = new Map<string, Promise<Extension>>();
let revision = 0;

function available(state: ExtensionState) {
  return state.installState === 'installed' && state.effectiveEnabled && !state.effectivePaused
    && state.runState !== 'failed' && state.runState !== 'cleanupFailed';
}

function palette() {
  if (typeof document === 'undefined') return { mode: 'light' as const, themeId: 'mist', foreground: '#24334c', background: '#ffffff', accent: '#4b6fa5', green: '#39825f', muted: '#73829a' };
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const color = (variable: string, fallback: string) => normalizeColor(style.getPropertyValue(variable)) ?? fallback;
  return {
    mode: root.dataset.mode === 'dark' ? 'dark' as const : 'light' as const,
    themeId: root.dataset.theme ?? 'mist',
    foreground: color('--h-ink', '#24334c'),
    background: color('--h-surface', '#ffffff'),
    accent: color('--h-accent', '#4b6fa5'),
    green: color('--h-green', '#39825f'),
    muted: color('--h-muted', '#73829a'),
  };
}

function manifests(projectId: string): PluginManifest[] {
  const states = pluginRuntime.getSnapshot(projectId);
  if (!nativeAvailable() && !states.length) return builtinPackages;
  return states.filter(available).flatMap(state => state.manifest ? [state.manifest] : []);
}

function catalog(projectId: string, refresh = false): Catalog {
  const previous = projects.get(projectId);
  if (previous && !refresh) return previous;
  const packages = manifests(projectId);
  const colors = palette();
  const theme = packages.flatMap(manifest => manifest.contributes.themes ?? [])
    .find(theme => theme.id.replace(/^horizon\.theme\./, '') === colors.themeId);
  const tokenColors = theme?.tokenColors?.[colors.mode];
  const contributions = packages.map(manifest => ({
    id: manifest.id,
    version: manifest.version,
    languages: manifest.contributes.languages ?? [],
    grammars: manifest.contributes.grammars ?? [],
  })).filter(item => item.languages.length || item.grammars.length);
  const contentRevisions = pluginRuntime.getSnapshot(projectId)
    .filter(state => available(state) && contributions.some(item => item.id === state.id))
    .map(state => [state.id, state.revision]);
  const fingerprint = JSON.stringify({ contributions, contentRevisions, colors, tokenColors });
  if (previous?.fingerprint === fingerprint) return previous;
  const next: Catalog = {
    lifetime: previous?.lifetime ?? { active: true },
    revision: ++revision,
    fingerprint,
    languages: contributions.flatMap(item => item.languages.map(definition => ({ extensionId: item.id, definition }))),
    grammars: new Map(contributions.flatMap(item => item.grammars.map(definition => [definition.scopeName, { extensionId: item.id, definition }] as const))),
    tokenColors,
    foreground: colors.foreground,
    background: colors.background,
    loads: new Map(),
  };
  projects.set(projectId, next);
  if (previous) queueMicrotask(() => retire(previous));
  return next;
}

function retire(entry: Catalog) {
  for (const promise of entry.loads.values()) void promise.then(result => disposeTextmateLanguage(result.highlighter)).catch(() => {});
  entry.loads.clear();
}

function languageFor(entry: Catalog, path: string): LanguageContribution | undefined {
  const filename = path.replaceAll('\\', '/').split('/').pop() ?? path;
  const exact = entry.languages.find(language => language.definition.filenames?.includes(filename));
  if (exact) return exact;
  const lower = filename.toLowerCase();
  // Longest suffix lets a language claim compound extensions such as .d.ts.
  let match: LanguageContribution | undefined;
  let length = 0;
  for (const language of entry.languages) {
    for (const extension of language.definition.extensions ?? []) {
      if (extension.length > length && lower.endsWith(extension.toLowerCase())) {
        match = language;
        length = extension.length;
      }
    }
  }
  return match;
}

function grammarFor(entry: Catalog, language: LanguageContribution) {
  return [...entry.grammars.values()].find(item => item.definition.language === language.definition.id);
}

function structuralLanguage(id: string): Promise<Extension> {
  const cached = structuralLanguages.get(id);
  if (cached) return cached;
  let extension: Promise<Extension>;
  switch (id) {
    case 'javascript': case 'javascriptreact': case 'typescript': case 'typescriptreact':
      extension = import('@codemirror/lang-javascript').then(module => module.javascript({ typescript: id.startsWith('typescript'), jsx: id.endsWith('react') }));
      break;
    case 'json': case 'jsonc': extension = import('@codemirror/lang-json').then(module => module.json()); break;
    case 'markdown': case 'mdx': extension = import('@codemirror/lang-markdown').then(module => module.markdown()); break;
    case 'css': extension = import('@codemirror/lang-css').then(module => module.css()); break;
    case 'html': case 'xml': extension = import('@codemirror/lang-html').then(module => module.html()); break;
    case 'python': extension = import('@codemirror/lang-python').then(module => module.python()); break;
    case 'rust': extension = import('@codemirror/lang-rust').then(module => module.rust()); break;
    case 'sql': extension = import('@codemirror/lang-sql').then(module => module.sql()); break;
    default: return Promise.resolve([]);
  }
  structuralLanguages.set(id, extension);
  void extension.catch(() => structuralLanguages.delete(id));
  return extension;
}

async function readGrammar(projectId: string, contribution: GrammarContribution): Promise<IRawGrammar> {
  if (nativeAvailable()) return call<IRawGrammar>('extension_read_grammar', { extensionId: contribution.extensionId, scopeName: contribution.definition.scopeName }, projectId);
  const key = `../../../../../packages/plugins/builtins/${contribution.extensionId}/${contribution.definition.path}`;
  const load = bundledGrammars[key];
  if (!load) throw new Error(`语法资源不可用：${contribution.definition.scopeName}`);
  return load();
}

async function load(projectId: string, path: string): Promise<Extension> {
  const lifetime = catalog(projectId).lifetime;
  if (nativeAvailable() && !pluginRuntime.getSnapshot(projectId).length) await refreshPlugins(projectId);
  if (!lifetime.active) return [];
  let entry = catalog(projectId);
  let language = languageFor(entry, path);
  if (!language) return [];
  const extensionId = language.extensionId;
  const state = pluginRuntime.getSnapshot(projectId).find(state => state.id === extensionId);
  if (nativeAvailable() && state?.runState !== 'active' && state?.runState !== 'activating') {
    await activatePlugin(language.extensionId, projectId, { kind: 'language', id: language.definition.id });
    if (!lifetime.active) return [];
    entry = catalog(projectId);
    language = languageFor(entry, path);
    if (!language) return [];
  }
  const grammar = grammarFor(entry, language);
  if (!grammar) return [];
  const key = `${language.definition.id}:${grammar.definition.scopeName}`;
  let pending = entry.loads.get(key);
  if (!pending) {
    pending = (async () => {
      const [structure, highlighter] = await Promise.allSettled([
        structuralLanguage(language.definition.id),
        createTextmateLanguage({
          scopeName: grammar.definition.scopeName,
          foreground: entry.foreground,
          background: entry.background,
          tokenColors: entry.tokenColors,
          onError: error => { if (lifetime.active && projects.get(projectId) === entry) editorStore.reportError(error); },
          loadGrammar: scopeName => {
            const contribution = entry.grammars.get(scopeName);
            return contribution ? readGrammar(projectId, contribution) : Promise.resolve(null);
          },
          getInjections: scopeName => [...entry.grammars.values()]
            .filter(item => item.definition.injectTo?.includes(scopeName))
            .map(item => item.definition.scopeName),
        }),
      ]);
      if (structure.status === 'rejected') {
        if (highlighter.status === 'fulfilled') disposeTextmateLanguage(highlighter.value);
        throw structure.reason;
      }
      if (highlighter.status === 'rejected') throw highlighter.reason;
      return { extension: [structure.value, highlighter.value], highlighter: highlighter.value };
    })();
    entry.loads.set(key, pending);
    void pending.catch(() => entry.loads.delete(key));
  }
  return (await pending).extension;
}

function refreshCatalogs() {
  let changed = false;
  for (const [projectId, previous] of projects) if (catalog(projectId, true) !== previous) changed = true;
  if (changed) for (const listener of listeners) listener();
}

pluginRuntime.subscribe(refreshCatalogs);
if (typeof document !== 'undefined') {
  const observer = new MutationObserver(refreshCatalogs);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'data-mode'] });
}

export const syntaxService = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  languageId(projectId: string, path: string) {
    const entry = catalog(projectId);
    const language = languageFor(entry, path);
    return language && grammarFor(entry, language) ? language.definition.id : 'plain';
  },
  getRevision(projectId: string) { return catalog(projectId).revision; },
  load,
  release(projectId?: string) {
    for (const [id, entry] of projects) if (!projectId || id === projectId) { entry.lifetime.active = false; projects.delete(id); retire(entry); }
  },
};
