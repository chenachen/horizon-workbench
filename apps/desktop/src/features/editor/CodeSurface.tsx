import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compartment, EditorState, Text, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, isolateHistory } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit, foldGutter, foldKeymap } from '@codemirror/language';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, openSearchPanel, gotoLine } from '@codemirror/search';
import type { EditorBuffer, EditorPreferences } from '../../../../../packages/editor/src/types';
import { clampSelection } from '../../../../../packages/editor/src/selection';
import { editorLanguageReady, editorHighlightReady, editorViewCreated, editorViewDestroyed, finishEditorOpen, hasPendingEditorOpen } from '../../../../../packages/editor/src/metrics';
import { call } from '../../bridge';
import { editorStore, registerEditorDisposer, useEditor } from './store';
import { syntaxService } from './syntax';
import { textmateHighlightReady } from './textmate';
import { platform } from '../../platform';
import { semanticExtension, getDefinitions, cancelDefinitionRequest, openDefinition, releaseLanguageServices, type DefinitionTarget } from './languageService';
import { DefinitionPicker, type DefinitionState } from './DefinitionPicker';

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--h-ink)', backgroundColor: 'var(--h-surface)', fontSize: 'var(--code-font-size, var(--h-font, 14px))' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.8' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--h-accent)' },
  '.cm-gutters': { color: 'var(--h-muted)', backgroundColor: 'var(--h-surface)', border: 'none', paddingRight: '6px', fontSize: '10px' },
  '.cm-lineNumbers .cm-gutterElement': { paddingLeft: '18px', minWidth: '32px' },
  // drawSelection paints behind the text, so line backgrounds must let it show through.
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--h-accent) 10%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--h-low)' },
  '&.cm-focused .cm-selectionBackground,.cm-selectionBackground': { backgroundColor: 'var(--h-tonal) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--h-accent)' },
  '.cm-panels': { backgroundColor: 'var(--h-low)', color: 'var(--h-ink)', borderColor: 'var(--h-line)' },
  '.cm-textfield': { backgroundColor: 'var(--h-surface)', color: 'var(--h-ink)', border: '1px solid var(--h-line)', borderRadius: '4px' },
  '.cm-button': { color: 'var(--h-ink)', background: 'var(--h-high)', border: '1px solid var(--h-line)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--h-high)', borderColor: 'var(--h-line)', color: 'var(--h-muted)' },
});
type CachedState = {
  state: EditorState;
  scroll?: ReturnType<EditorView['scrollSnapshot']>;
  contentVersion: number;
  path: string;
  documentInfo: Compartment;
  language: Compartment;
  semantic: Compartment;
  semanticKey: string;
  languageId: string;
  languageReady: boolean;
  syntaxRevision: number;
  syntaxRequest: number;
  simplified: boolean;
  preferences: Compartment;
  used: number;
};
const cachedStates = new Map<string, CachedState>();
function rememberView(buffer: EditorBuffer, view: EditorView) {
  const cached = cachedStates.get(buffer.key);
  if (cached) cached.state = view.state;
  // A hidden or detached editor reports zero geometry; keep its last visible position.
  if (!view.dom.clientHeight) return;
  buffer.scrollTop = view.scrollDOM.scrollTop;
  if (cached) cached.scroll = view.scrollSnapshot();
}
const preferencesByProject = new Map<string, EditorPreferences>();
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const autoSaveArmed = new Set<string>();
let activeView: EditorView | undefined, activeKey: string | undefined, activeViewProjectId: string | undefined;
let activeViewId = 0;
let disposeActiveView: (() => void) | undefined;
let updatePosition: ((line: number, column: number) => void) | undefined;
let updateDefinition: ((state: DefinitionState | null) => void) | undefined;
let definitionSequence = 0;
let definitionVisible = false;
function publishDefinition(state: DefinitionState | null) {
  definitionVisible = state !== null;
  updateDefinition?.(state);
}
function dismissDefinition(focus = true) {
  definitionSequence++;
  if (definitionVisible) { cancelDefinitionRequest(activeView); publishDefinition(null); }
  if (focus) activeView?.focus();
}
async function requestDefinition(view = activeView, position?: number) {
  const buffer = activeKey && editorStore.getSnapshot().buffers.get(activeKey);
  if (!view || view !== activeView || !buffer || view.composing || buffer.composing) return;
  const requestId = ++definitionSequence, sourceDoc = view.state.doc;
  const state: DefinitionState = { requestId, sourceKey: buffer.key, projectId: buffer.projectId, status: 'loading', targets: [] };
  const current = () => requestId === definitionSequence && activeView === view && activeKey === state.sourceKey && view.state.doc === sourceDoc;
  publishDefinition(state);
  try {
    const targets = await getDefinitions(view, position);
    if (!current()) return;
    if (!targets.length) publishDefinition({ ...state, status: 'empty' });
    else if (targets.length === 1) {
      await openDefinition(buffer.projectId, targets[0], current);
      if (requestId === definitionSequence) publishDefinition(null);
    } else publishDefinition({ ...state, status: 'ready', targets });
  } catch (error) {
    if (current()) publishDefinition({ ...state, status: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}
async function chooseDefinition(state: DefinitionState, target: DefinitionTarget) {
  const current = () => state.requestId === definitionSequence && activeKey === state.sourceKey && activeViewProjectId === state.projectId;
  if (!current()) return;
  publishDefinition({ ...state, status: 'loading' });
  try {
    await openDefinition(state.projectId, target, current);
    if (state.requestId === definitionSequence) publishDefinition(null);
  } catch (error) {
    if (state.requestId === definitionSequence && activeKey === state.sourceKey) publishDefinition({ ...state, status: 'error', message: error instanceof Error ? error.message : String(error) });
  }
}
editorStore.subscribeRekeys((previousKey, buffer, preserveHistory) => {
  const cached = cachedStates.get(previousKey); cachedStates.delete(previousKey);
  if (preserveHistory && cached) cachedStates.set(buffer.key, cached);
  const timer = autoSaveTimers.get(previousKey); if (timer) clearTimeout(timer);
  autoSaveTimers.delete(previousKey); autoSaveArmed.delete(previousKey);
  if (activeKey === previousKey) activeKey = preserveHistory ? buffer.key : undefined;
});
registerEditorDisposer(target => {
  for (const key of cachedStates.keys()) if (!target || key.startsWith(`${target}\u0000`)) cachedStates.delete(key);
  for (const [key, timer] of autoSaveTimers) if (!target || key.startsWith(`${target}\u0000`)) { clearTimeout(timer); autoSaveTimers.delete(key); autoSaveArmed.delete(key); }
  for (const id of preferencesByProject.keys()) if (!target || id === target) preferencesByProject.delete(id);
  if (!target || activeViewProjectId === target) disposeActiveView?.();
  syntaxService.release(target);
  releaseLanguageServices(target);
});
const defaultPreferences: EditorPreferences = { autoSave: 'off', autoSaveDelay: 1000, wordWrap: 'off', tabSize: 2, lineNumbers: true, fontFamily: 'Menlo' };
function measureOpen(instance: EditorView, buffer: EditorBuffer) {
  if (!hasPendingEditorOpen(buffer.projectId, buffer.fileId)) return;
  instance.requestMeasure({ key: `open:${buffer.key}`, read: view => { const cached = cachedStates.get(buffer.key); return { visible: view.dom.getBoundingClientRect().width > 0, language: cached?.languageId ?? 'plain', languageReady: cached?.languageReady, highlighted: cached?.languageReady && (cached.languageId === 'plain' || textmateHighlightReady(view)) }; }, write: result => {
    if (!result.visible || result.language === 'plain' && !result.languageReady) return;
    requestAnimationFrame(() => { if (activeKey !== buffer.key || activeView !== instance) return; if (result.highlighted && result.language !== 'plain') editorHighlightReady(buffer.projectId, buffer.fileId); finishEditorOpen(buffer.projectId, buffer.fileId, buffer.meta?.baseDiskRevision.byteLength ?? '0', buffer.version, activeViewId, result.language); });
  } });
}
function preferenceExtensions(prefs: EditorPreferences): Extension[] {
  const tabSize = Math.max(1, Math.min(8, prefs.tabSize ?? 2));
  const font = prefs.fontFamily === 'system' ? 'SFMono-Regular, Menlo, monospace' : `"${(prefs.fontFamily ?? 'Menlo').replace(/["\\]/g, '')}", SFMono-Regular, monospace`;
  return [prefs.lineNumbers !== false ? lineNumbers() : [], prefs.wordWrap === 'on' ? EditorView.lineWrapping : [], EditorState.tabSize.of(tabSize), indentUnit.of(prefs.insertSpaces === false ? '\t' : ' '.repeat(tabSize)), EditorView.theme({ '.cm-scroller': { fontFamily: font } })];
}
function documentAttributes(buffer: EditorBuffer) { return EditorView.contentAttributes.of({ 'aria-label': `${buffer.path}${buffer.meta?.readOnly ? '，只读' : '，代码编辑器'}`, 'aria-describedby': 'editor-keyboard-help' }); }
function configureLanguage(buffer: EditorBuffer, cached: CachedState, extension: Extension) {
  const effects = [
    cached.documentInfo.reconfigure(documentAttributes(buffer)),
    cached.language.reconfigure(extension),
  ];
  if (activeKey === buffer.key && activeView?.state === cached.state) activeView.dispatch({ effects });
  else cached.state = cached.state.update({ effects }).state;
}
function refreshLanguage(buffer: EditorBuffer, cached: CachedState) {
  const revision = syntaxService.getRevision(buffer.projectId);
  if (cached.semanticKey === buffer.key && cached.path === buffer.path && cached.syntaxRevision === revision && cached.simplified === buffer.simplified) return;
  if (cached.semanticKey !== buffer.key || cached.path !== buffer.path || cached.simplified !== buffer.simplified) {
    const effects = cached.semantic.reconfigure(buffer.simplified ? [] : semanticExtension(buffer));
    cached.semanticKey = buffer.key;
    if (activeKey === buffer.key && activeView?.state === cached.state) activeView.dispatch({ effects });
    else cached.state = cached.state.update({ effects }).state;
  }
  const path = buffer.path;
  const request = ++cached.syntaxRequest;
  cached.path = path;
  cached.syntaxRevision = revision;
  cached.simplified = buffer.simplified;
  cached.languageId = buffer.simplified ? 'plain' : syntaxService.languageId(buffer.projectId, path);
  cached.languageReady = buffer.simplified;
  configureLanguage(buffer, cached, []);
  if (buffer.simplified) return;
  const isCurrentRequest = () => cachedStates.get(buffer.key) === cached
    && cached.syntaxRequest === request
    && buffer.path === path
    && syntaxService.getRevision(buffer.projectId) === revision;
  void syntaxService.load(buffer.projectId, path).then(extension => {
    if (!isCurrentRequest()) return;
    cached.languageId = syntaxService.languageId(buffer.projectId, path);
    cached.languageReady = true;
    if (cached.languageId !== 'plain') editorLanguageReady(buffer.projectId, buffer.fileId);
    configureLanguage(buffer, cached, extension);
  }).catch(error => {
    if (!isCurrentRequest()) return;
    cached.languageId = 'plain';
    cached.languageReady = true;
    configureLanguage(buffer, cached, []);
    editorStore.reportError(error);
  });
}
syntaxService.subscribe(() => {
  const buffers = editorStore.getSnapshot().buffers;
  for (const [key, cached] of cachedStates) {
    const buffer = buffers.get(key);
    if (buffer?.mode === 'editor' && !buffer.evicted) refreshLanguage(buffer, cached);
  }
});
function scheduleAutoSave(buffer: EditorBuffer) {
  const prefs = preferencesByProject.get(buffer.projectId) ?? defaultPreferences;
  const timer = autoSaveTimers.get(buffer.key); if (timer) clearTimeout(timer); autoSaveTimers.delete(buffer.key);
  if (prefs.autoSave === 'off' || buffer.conflict || buffer.meta?.readOnly || buffer.proposalPending) { autoSaveArmed.delete(buffer.key); return; }
  autoSaveArmed.add(buffer.key);
  if (prefs.autoSave === 'afterDelay') autoSaveTimers.set(buffer.key, setTimeout(() => {
    autoSaveTimers.delete(buffer.key);
    if (buffer.dirty && !buffer.composing && !buffer.conflict && !buffer.proposalPending && editorStore.getBuffer(buffer.projectId, buffer.fileId) === buffer) void editorStore.save(buffer.fileId, buffer.projectId);
  }, Math.max(500, prefs.autoSaveDelay ?? 1000)));
}
function makeState(buffer: EditorBuffer): CachedState {
  const language = new Compartment(), semantic = new Compartment(), preferences = new Compartment(), documentInfo = new Compartment();
  const extensions: Extension[] = [theme, highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightActiveLineGutter(), highlightSelectionMatches(), language.of([]), semantic.of(buffer.simplified ? [] : semanticExtension(buffer)), preferences.of(preferenceExtensions(preferencesByProject.get(buffer.projectId) ?? defaultPreferences)), EditorState.readOnly.of(!!buffer.meta?.readOnly), EditorView.editable.of(!buffer.meta?.readOnly), documentInfo.of(documentAttributes(buffer)), keymap.of([{ key: 'F12', run: view => { if (view.composing) return false; void requestDefinition(view); return true; } }, { key: 'Escape', run: () => { dismissDefinition(false); return false; } }, { key: 'Mod-s', run: view => { if (!view.composing) void editorStore.save(buffer.fileId, buffer.projectId); return true; } }, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]), EditorView.updateListener.of(update => {
    const selection = { anchor: update.state.selection.main.anchor, head: update.state.selection.main.head };
    if (update.docChanged) { dismissDefinition(false); const text = update.state.doc; editorStore.edited(buffer.projectId, buffer.fileId, () => text.toString(), selection, text, update.changes); scheduleAutoSave(buffer); }
    if (update.selectionSet || update.docChanged) { editorStore.position(buffer.projectId, buffer.fileId, selection); if (activeKey === buffer.key) { const line = update.state.doc.lineAt(selection.head); updatePosition?.(line.number, selection.head - line.from + 1); } }
    const cached = cachedStates.get(buffer.key); if (cached) { cached.state = update.state; if (update.docChanged) cached.scroll = cached.scroll?.map(update.changes); }
    measureOpen(update.view, buffer);
  }), EditorView.domEventHandlers({
    mousedown: (event, view) => {
      const modifier = platform === 'macos' ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
      if (event.button !== 0 || !modifier || event.shiftKey || event.altKey || view.composing || !view.contentDOM.contains(event.target as Node)) return false;
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (position === null) return false;
      event.preventDefault();
      void requestDefinition(view, position);
      return true;
    },
    scroll: (_event, view) => { if (!view.dom.clientHeight) return; const cached = cachedStates.get(buffer.key); if (cached) cached.scroll = view.scrollSnapshot(); editorStore.position(buffer.projectId, buffer.fileId, { anchor: view.state.selection.main.anchor, head: view.state.selection.main.head }, view.scrollDOM.scrollTop); },
    compositionstart: () => { buffer.composing = true; },
    compositionend: () => { buffer.composing = false; if (autoSaveArmed.has(buffer.key)) scheduleAutoSave(buffer); },
    blur: () => { const prefs = preferencesByProject.get(buffer.projectId); if (prefs?.autoSave === 'onFocusChange' && autoSaveArmed.has(buffer.key) && !buffer.composing && !buffer.conflict && !buffer.proposalPending) void editorStore.save(buffer.fileId, buffer.projectId); },
  })];
  if (!buffer.simplified) extensions.push(foldGutter());
  const text = buffer.getText();
  const id = buffer.simplified ? 'plain' : syntaxService.languageId(buffer.projectId, buffer.path);
  const doc = Text.of(text.split(/\r\n?|\n/));
  buffer.selection = clampSelection(buffer.selection, doc.length);
  const entry: CachedState = { state: EditorState.create({ doc, selection: buffer.selection, extensions }), contentVersion: buffer.contentVersion, path: buffer.path, documentInfo, language, semantic, semanticKey: buffer.key, languageId: id, languageReady: buffer.simplified, syntaxRevision: -1, syntaxRequest: 0, simplified: buffer.simplified, preferences, used: Date.now() };
  buffer.contentIdentity = entry.state.doc;
  buffer.contentEquals = (left, right) => left instanceof Text && right instanceof Text && left.eq(right);
  if (!buffer.dirty) buffer.savedContentIdentity = entry.state.doc;
  const initialDocument = entry.state.doc; buffer.getText = () => initialDocument.toString();
  cachedStates.set(buffer.key, entry);
  refreshLanguage(buffer, entry);
  return entry;
}
export const editorCommands = { find: () => activeKey && activeView && openSearchPanel(activeView), gotoLine: () => activeKey && activeView && gotoLine(activeView), definition: () => requestDefinition(), undo: () => activeKey && activeView && undo(activeView), redo: () => activeKey && activeView && redo(activeView), focus: () => activeKey && activeView?.focus() };
export async function applyReviewedEdit(input: { projectId: string; fileId: string; expectedEditorRevision: number; text: string; proposalId?: string }): Promise<boolean> {
  const buffer = editorStore.getBuffer(input.projectId, input.fileId);
  if (!buffer || buffer.evicted || buffer.mode !== 'editor' || buffer.meta?.readOnly || buffer.composing || buffer.proposalPending || buffer.version !== input.expectedEditorRevision) return false;
  const cached = cachedStates.get(buffer.key) ?? makeState(buffer);
  buffer.proposalPending = true;
  const spec = { changes: { from: 0, to: cached.state.doc.length, insert: input.text }, annotations: [Transaction.userEvent.of('input.agent'), isolateHistory.of('full')] };
  if (activeKey === buffer.key && activeView) activeView.dispatch(spec);
  else { const transaction = cached.state.update(spec); cached.state = transaction.state; cached.scroll = cached.scroll?.map(transaction.changes); const text = cached.state.doc; editorStore.edited(buffer.projectId, buffer.fileId, () => text.toString(), { anchor: cached.state.selection.main.anchor, head: cached.state.selection.main.head }, text, transaction.changes); }
  try {
    await editorStore.flushDrafts(input.projectId);
    if (input.proposalId) await call('document_proposal_result', { proposalId: input.proposalId, expectedEditorRevision: input.expectedEditorRevision, editorRevision: buffer.version, applied: true }, input.projectId);
    return true;
  } catch (error) { editorStore.reportError(error); return false; }
  finally { buffer.proposalPending = false; }
}
export default function CodeSurface({ projectId, preferences = defaultPreferences }: { projectId: string; preferences?: EditorPreferences }) {
  const snapshot = useEditor(), buffer = editorStore.getActive(projectId);
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null), current = useRef<EditorBuffer | undefined>(undefined);
  const viewId = useRef(0);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const [definition, setDefinition] = useState<DefinitionState | null>(null);
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setStatusTarget(document.getElementById('editor-status-slot')); });
  const releaseView = useCallback(() => {
    const instance = view.current; if (!instance) return;
    const b = current.current;
    if (b) rememberView(b, instance);
    dismissDefinition(false);
    instance.destroy(); editorViewDestroyed(viewId.current); view.current = null; current.current = undefined;
    if (activeView === instance) { activeView = undefined; activeKey = undefined; activeViewProjectId = undefined; updatePosition = undefined; updateDefinition = undefined; disposeActiveView = undefined; }
  }, []);
  useEffect(() => releaseView, [releaseView]);
  useEffect(() => {
    preferencesByProject.set(projectId, preferences);
    for (const [key, cached] of cachedStates) if (key.startsWith(`${projectId}\u0000`)) { const effects = cached.preferences.reconfigure(preferenceExtensions(preferences)); if (activeKey === key && view.current) view.current.dispatch({ effects }); else cached.state = cached.state.update({ effects }).state; }
  }, [projectId, preferences.autoSave, preferences.autoSaveDelay, preferences.wordWrap, preferences.tabSize, preferences.insertSpaces, preferences.lineNumbers, preferences.fontFamily]);
  useEffect(() => {
    for (const [key] of cachedStates) if (!snapshot.buffers.has(key) || snapshot.buffers.get(key)?.evicted) { cachedStates.delete(key); const timer = autoSaveTimers.get(key); if (timer) clearTimeout(timer); autoSaveTimers.delete(key); autoSaveArmed.delete(key); }
    let instance = view.current;
    // A plugin can release its view while this React shell remains mounted (sleep/wake).
    if (!instance && host.current && buffer?.mode === 'editor' && !buffer.evicted) {
      instance = new EditorView({ parent: host.current, state: EditorState.create({ extensions: [theme] }) }); view.current = instance; activeView = instance; viewId.current = editorViewCreated(); activeViewId = viewId.current;
      updatePosition = (line, column) => setPosition({ line, column }); updateDefinition = setDefinition; disposeActiveView = releaseView;
    }
    if (instance) activeViewProjectId = projectId;
    if (!instance || !buffer || buffer.mode !== 'editor' || buffer.evicted) { if (instance && current.current) { dismissDefinition(false); rememberView(current.current, instance); current.current = undefined; activeKey = undefined; instance.setState(EditorState.create({ extensions: [theme] })); } if (host.current) host.current.hidden = true; return; }
    if (host.current) host.current.hidden = false;
    measureOpen(instance, buffer);
    const reveal = () => { if (!buffer.reveal) return; const line = instance.state.doc.line(Math.max(1, Math.min(instance.state.doc.lines, buffer.reveal.line + 1))); const pos = Math.min(line.to, line.from + buffer.reveal.column); instance.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) }); buffer.reveal = undefined; instance.focus(); };
    if (current.current?.key === buffer.key && cachedStates.get(buffer.key)?.contentVersion === buffer.contentVersion) { refreshLanguage(buffer, cachedStates.get(buffer.key)!); reveal(); return; }
    const old = current.current;
    dismissDefinition(false);
    if (old) rememberView(old, instance);
    current.current = buffer; activeKey = buffer.key;
    let cached = cachedStates.get(buffer.key);
    if (!cached || cached.contentVersion !== buffer.contentVersion) cached = makeState(buffer);
    cached.used = Date.now(); instance.setState(cached.state); refreshLanguage(buffer, cached);
    if (cached.scroll) instance.dispatch({ effects: cached.scroll });
    else {
      const scrollTop = buffer.scrollTop;
      // A restored session has only a pixel offset. Measure the new document first,
      // without carrying the outgoing document's estimated scroll anchor into it.
      instance.scrollDOM.scrollTop = 0;
      instance.requestMeasure({ key: 'restore-document-scroll', read: () => scrollTop, write: (top, measuredView) => { if (activeKey === buffer.key && activeView === measuredView) measuredView.scrollDOM.scrollTop = top; } });
    }
    const line = instance.state.doc.lineAt(instance.state.selection.main.head); setPosition({ line: line.number, column: instance.state.selection.main.head - line.from + 1 }); reveal();
    const clean = [...cachedStates].filter(([key]) => key !== buffer.key && !snapshot.buffers.get(key)?.dirty).sort((a, b) => a[1].used - b[1].used);
    while (clean.length >= 20) cachedStates.delete(clean.shift()![0]);
  }, [snapshot.revision, projectId, releaseView]);
  const status = <footer className="editor-status"><span id="editor-keyboard-help">{buffer?.mode === 'editor' ? 'Esc 后按 Tab 离开编辑器' : ''}</span>{buffer?.dirty && <span title={buffer.checkpointVersion === buffer.version ? '当前编辑已写入恢复草稿' : '停止输入 2 秒后写入恢复草稿'}>{buffer.checkpointVersion === buffer.version ? '恢复稿已存' : '未保存'}</span>}{buffer?.mode === 'editor' && <button onClick={() => editorCommands.gotoLine()}>行 {position.line}，列 {position.column}</button>}<span>{buffer?.mode === 'unavailable' ? '无法读取' : buffer?.path.split('.').pop()?.toUpperCase() || '纯文本'}</span>{buffer?.meta && <span>{buffer.meta.encoding.toUpperCase()} · {buffer.meta.eol.toUpperCase()}</span>}</footer>;
  return <div className="code-surface"><div className="code-surface-host" ref={host} />{definition?.projectId === projectId && definition.sourceKey === buffer?.key && <DefinitionPicker state={definition} onChoose={target => void chooseDefinition(definition, target)} onClose={() => dismissDefinition()} />}{statusTarget ? createPortal(status, statusTarget) : status}</div>;
}
