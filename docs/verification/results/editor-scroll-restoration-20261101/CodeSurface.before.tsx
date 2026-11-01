import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compartment, EditorState, Text, Transaction, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo, isolateHistory } from '@codemirror/commands';
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, syntaxTreeAvailable, HighlightStyle, foldGutter, foldKeymap } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches, openSearchPanel, gotoLine } from '@codemirror/search';
import type { EditorBuffer, EditorPreferences } from '../../../../../packages/editor/src/types';
import { clampSelection } from '../../../../../packages/editor/src/selection';
import { editorLanguageReady, editorHighlightReady, editorViewCreated, editorViewDestroyed, finishEditorOpen, hasPendingEditorOpen } from '../../../../../packages/editor/src/metrics';
import { call } from '../../bridge';
import { editorStore, registerEditorDisposer, useEditor } from './store';

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--h-ink)', backgroundColor: 'var(--h-surface)', fontSize: 'var(--code-font-size, var(--h-font, 14px))' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.8' },
  '.cm-content': { padding: '12px 0', caretColor: 'var(--h-accent)' },
  '.cm-gutters': { color: 'var(--h-muted)', backgroundColor: 'var(--h-surface)', border: 'none', paddingRight: '6px', fontSize: '10px' },
  '.cm-lineNumbers .cm-gutterElement': { paddingLeft: '18px', minWidth: '32px' },
  '.cm-activeLine,.cm-activeLineGutter': { backgroundColor: 'var(--h-low)' },
  '&.cm-focused .cm-selectionBackground,.cm-selectionBackground': { backgroundColor: 'var(--h-tonal) !important' },
  '.cm-cursor': { borderLeftColor: 'var(--h-accent)' },
  '.cm-panels': { backgroundColor: 'var(--h-low)', color: 'var(--h-ink)', borderColor: 'var(--h-line)' },
  '.cm-textfield': { backgroundColor: 'var(--h-surface)', color: 'var(--h-ink)', border: '1px solid var(--h-line)', borderRadius: '4px' },
  '.cm-button': { color: 'var(--h-ink)', background: 'var(--h-high)', border: '1px solid var(--h-line)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--h-high)', borderColor: 'var(--h-line)', color: 'var(--h-muted)' },
});
const highlightStyle = HighlightStyle.define([{ tag: tags.keyword, color: 'var(--h-accent)' }, { tag: [tags.string, tags.regexp], color: 'var(--h-green, #338261)' }, { tag: [tags.comment, tags.meta], color: 'var(--h-muted)' }, { tag: [tags.number, tags.bool, tags.null, tags.typeName, tags.className], color: 'var(--h-accent)' }, { tag: tags.heading, fontWeight: '600' }, { tag: tags.emphasis, fontStyle: 'italic' }]);
const languageCache = new Map<string, Promise<Extension>>();
function languageFor(path: string): Promise<Extension> {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (languageCache.has(ext)) return languageCache.get(ext)!;
  let result: Promise<Extension>;
  if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'].includes(ext)) result = import('@codemirror/lang-javascript').then(m => m.javascript({ typescript: ['ts', 'tsx'].includes(ext), jsx: ['jsx', 'tsx'].includes(ext) }));
  else if (['json', 'jsonc'].includes(ext)) result = import('@codemirror/lang-json').then(m => m.json());
  else if (['md', 'mdx', 'markdown'].includes(ext)) result = import('@codemirror/lang-markdown').then(m => m.markdown());
  else if (ext === 'css') result = import('@codemirror/lang-css').then(m => m.css());
  else if (['html', 'htm', 'svg', 'xml'].includes(ext)) result = import('@codemirror/lang-html').then(m => m.html());
  else if (ext === 'py') result = import('@codemirror/lang-python').then(m => m.python());
  else if (ext === 'rs') result = import('@codemirror/lang-rust').then(m => m.rust());
  else if (ext === 'sql') result = import('@codemirror/lang-sql').then(m => m.sql());
  else return Promise.resolve([]);
  languageCache.set(ext, result); return result;
}
type CachedState = { state: EditorState; contentVersion: number; path: string; documentInfo: Compartment; language: Compartment; languageId: string; languageReady: boolean; preferences: Compartment; used: number };
const cachedStates = new Map<string, CachedState>();
const preferencesByProject = new Map<string, EditorPreferences>();
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const autoSaveArmed = new Set<string>();
let activeView: EditorView | undefined, activeKey: string | undefined, activeViewProjectId: string | undefined;
let activeViewId = 0;
let disposeActiveView: (() => void) | undefined;
let updatePosition: ((line: number, column: number) => void) | undefined;
registerEditorDisposer(target => {
  for (const key of cachedStates.keys()) if (!target || key.startsWith(`${target}\u0000`)) cachedStates.delete(key);
  for (const [key, timer] of autoSaveTimers) if (!target || key.startsWith(`${target}\u0000`)) { clearTimeout(timer); autoSaveTimers.delete(key); autoSaveArmed.delete(key); }
  for (const id of preferencesByProject.keys()) if (!target || id === target) preferencesByProject.delete(id);
  if (!target || activeViewProjectId === target) disposeActiveView?.();
});
const defaultPreferences: EditorPreferences = { autoSave: 'off', autoSaveDelay: 1000, wordWrap: 'off', tabSize: 2, lineNumbers: true, fontFamily: 'Menlo' };
function languageId(path: string) { const ext = path.split('.').pop()?.toLowerCase() ?? ''; return ['ts', 'tsx', 'js', 'mjs', 'cjs', 'jsx', 'json', 'jsonc', 'md', 'mdx', 'markdown', 'css', 'html', 'htm', 'svg', 'xml', 'py', 'rs', 'sql'].includes(ext) ? ext : 'plain'; }
function measureOpen(instance: EditorView, buffer: EditorBuffer) {
  if (!hasPendingEditorOpen(buffer.projectId, buffer.fileId)) return;
  instance.requestMeasure({ key: `open:${buffer.key}`, read: view => { const cached = cachedStates.get(buffer.key); return { visible: view.dom.getBoundingClientRect().width > 0, language: cached?.languageId ?? 'plain', highlighted: cached?.languageReady && (cached.languageId === 'plain' || syntaxTreeAvailable(view.state, view.viewport.to)) }; }, write: result => {
    if (!result.visible) return;
    requestAnimationFrame(() => { if (activeKey !== buffer.key || activeView !== instance) return; if (result.highlighted && result.language !== 'plain') editorHighlightReady(buffer.projectId, buffer.fileId); finishEditorOpen(buffer.projectId, buffer.fileId, buffer.meta?.baseDiskRevision.byteLength ?? '0', buffer.version, activeViewId, result.language); });
  } });
}
function preferenceExtensions(prefs: EditorPreferences): Extension[] {
  const tabSize = Math.max(1, Math.min(8, prefs.tabSize ?? 2));
  const font = prefs.fontFamily === 'system' ? 'SFMono-Regular, Menlo, monospace' : `"${(prefs.fontFamily ?? 'Menlo').replace(/["\\]/g, '')}", SFMono-Regular, monospace`;
  return [prefs.lineNumbers !== false ? lineNumbers() : [], prefs.wordWrap === 'on' ? EditorView.lineWrapping : [], EditorState.tabSize.of(tabSize), indentUnit.of(prefs.insertSpaces === false ? '\t' : ' '.repeat(tabSize)), EditorView.theme({ '.cm-scroller': { fontFamily: font } })];
}
function documentAttributes(buffer: EditorBuffer) { return EditorView.contentAttributes.of({ 'aria-label': `${buffer.path}${buffer.meta?.readOnly ? '，只读' : '，代码编辑器'}`, 'aria-describedby': 'editor-keyboard-help' }); }
function refreshPath(buffer: EditorBuffer, cached: CachedState, view: EditorView) {
  if (cached.path === buffer.path) return;
  cached.path = buffer.path; cached.languageId = buffer.simplified ? 'plain' : languageId(buffer.path); cached.languageReady = cached.languageId === 'plain';
  view.dispatch({ effects: [cached.documentInfo.reconfigure(documentAttributes(buffer)), cached.language.reconfigure([])] });
  const path = buffer.path;
  if (!buffer.simplified) void languageFor(path).then(extension => { if (cachedStates.get(buffer.key) !== cached || cached.path !== path) return; cached.languageReady = true; if (activeKey === buffer.key && activeView) activeView.dispatch({ effects: cached.language.reconfigure(extension) }); else cached.state = cached.state.update({ effects: cached.language.reconfigure(extension) }).state; }).catch(editorStore.reportError);
}
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
  const language = new Compartment(), preferences = new Compartment(), documentInfo = new Compartment();
  const extensions: Extension[] = [theme, highlightSpecialChars(), history(), drawSelection(), dropCursor(), EditorState.allowMultipleSelections.of(true), indentOnInput(), bracketMatching(), closeBrackets(), rectangularSelection(), crosshairCursor(), highlightActiveLine(), highlightActiveLineGutter(), highlightSelectionMatches(), syntaxHighlighting(highlightStyle), language.of([]), preferences.of(preferenceExtensions(preferencesByProject.get(buffer.projectId) ?? defaultPreferences)), EditorState.readOnly.of(!!buffer.meta?.readOnly), EditorView.editable.of(!buffer.meta?.readOnly), documentInfo.of(documentAttributes(buffer)), keymap.of([{ key: 'Mod-s', run: view => { if (!view.composing) void editorStore.save(buffer.fileId, buffer.projectId); return true; } }, ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, indentWithTab]), EditorView.updateListener.of(update => {
    const selection = { anchor: update.state.selection.main.anchor, head: update.state.selection.main.head };
    if (update.docChanged) { const text = update.state.doc; editorStore.edited(buffer.projectId, buffer.fileId, () => text.toString(), selection, text); scheduleAutoSave(buffer); }
    if (update.selectionSet || update.docChanged) { editorStore.position(buffer.projectId, buffer.fileId, selection); if (activeKey === buffer.key) { const line = update.state.doc.lineAt(selection.head); updatePosition?.(line.number, selection.head - line.from + 1); } }
    const cached = cachedStates.get(buffer.key); if (cached) cached.state = update.state;
    measureOpen(update.view, buffer);
  }), EditorView.domEventHandlers({
    scroll: (_event, view) => { editorStore.position(buffer.projectId, buffer.fileId, { anchor: view.state.selection.main.anchor, head: view.state.selection.main.head }, view.scrollDOM.scrollTop); },
    compositionstart: () => { buffer.composing = true; },
    compositionend: () => { buffer.composing = false; if (autoSaveArmed.has(buffer.key)) scheduleAutoSave(buffer); },
    blur: () => { const prefs = preferencesByProject.get(buffer.projectId); if (prefs?.autoSave === 'onFocusChange' && autoSaveArmed.has(buffer.key) && !buffer.composing && !buffer.conflict && !buffer.proposalPending) void editorStore.save(buffer.fileId, buffer.projectId); },
  })];
  if (!buffer.simplified) extensions.push(foldGutter());
  const text = buffer.getText();
  const id = buffer.simplified ? 'plain' : languageId(buffer.path);
  const doc = Text.of(text.split(/\r\n?|\n/));
  buffer.selection = clampSelection(buffer.selection, doc.length);
  const entry: CachedState = { state: EditorState.create({ doc, selection: buffer.selection, extensions }), contentVersion: buffer.contentVersion, path: buffer.path, documentInfo, language, languageId: id, languageReady: id === 'plain', preferences, used: Date.now() };
  buffer.contentIdentity = entry.state.doc;
  buffer.contentEquals = (left, right) => left instanceof Text && right instanceof Text && left.eq(right);
  if (!buffer.dirty) buffer.savedContentIdentity = entry.state.doc;
  const initialDocument = entry.state.doc; buffer.getText = () => initialDocument.toString();
  cachedStates.set(buffer.key, entry);
  if (!buffer.simplified) void languageFor(buffer.path).then(extension => { if (cachedStates.get(buffer.key) !== entry) return; entry.languageReady = true; editorLanguageReady(buffer.projectId, buffer.fileId); if (activeKey === buffer.key && activeView) activeView.dispatch({ effects: language.reconfigure(extension) }); else entry.state = entry.state.update({ effects: language.reconfigure(extension) }).state; }).catch(editorStore.reportError);
  return entry;
}
export const editorCommands = { find: () => activeKey && activeView && openSearchPanel(activeView), gotoLine: () => activeKey && activeView && gotoLine(activeView), undo: () => activeKey && activeView && undo(activeView), redo: () => activeKey && activeView && redo(activeView), focus: () => activeKey && activeView?.focus() };
export async function applyReviewedEdit(input: { projectId: string; fileId: string; expectedEditorRevision: number; text: string; proposalId?: string }): Promise<boolean> {
  const buffer = editorStore.getBuffer(input.projectId, input.fileId);
  if (!buffer || buffer.evicted || buffer.mode !== 'editor' || buffer.meta?.readOnly || buffer.composing || buffer.version !== input.expectedEditorRevision) return false;
  const cached = cachedStates.get(buffer.key) ?? makeState(buffer);
  buffer.proposalPending = true;
  const spec = { changes: { from: 0, to: cached.state.doc.length, insert: input.text }, annotations: [Transaction.userEvent.of('input.agent'), isolateHistory.of('full')] };
  if (activeKey === buffer.key && activeView) activeView.dispatch(spec);
  else { cached.state = cached.state.update(spec).state; const text = cached.state.doc; editorStore.edited(buffer.projectId, buffer.fileId, () => text.toString(), { anchor: cached.state.selection.main.anchor, head: cached.state.selection.main.head }, text); }
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
  const [statusTarget, setStatusTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setStatusTarget(document.getElementById('editor-status-slot')); });
  const releaseView = useCallback(() => {
    const instance = view.current; if (!instance) return;
    const b = current.current;
    if (b) { const entry = cachedStates.get(b.key); if (entry) entry.state = instance.state; b.scrollTop = instance.scrollDOM.scrollTop; }
    instance.destroy(); editorViewDestroyed(viewId.current); view.current = null; current.current = undefined;
    if (activeView === instance) { activeView = undefined; activeKey = undefined; activeViewProjectId = undefined; updatePosition = undefined; disposeActiveView = undefined; }
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
      updatePosition = (line, column) => setPosition({ line, column }); disposeActiveView = releaseView;
    }
    if (instance) activeViewProjectId = projectId;
    if (!instance || !buffer || buffer.mode !== 'editor' || buffer.evicted) { if (host.current) host.current.hidden = true; if (instance && current.current) { const previous = current.current, cached = cachedStates.get(previous.key); if (cached) cached.state = instance.state; previous.scrollTop = instance.scrollDOM.scrollTop; current.current = undefined; activeKey = undefined; instance.setState(EditorState.create({ extensions: [theme] })); } return; }
    if (host.current) host.current.hidden = false;
    measureOpen(instance, buffer);
    const reveal = () => { if (!buffer.reveal) return; const line = instance.state.doc.line(Math.max(1, Math.min(instance.state.doc.lines, buffer.reveal.line + 1))); const pos = Math.min(line.to, line.from + buffer.reveal.column); instance.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) }); buffer.reveal = undefined; instance.focus(); };
    if (current.current?.key === buffer.key && cachedStates.get(buffer.key)?.contentVersion === buffer.contentVersion) { refreshPath(buffer, cachedStates.get(buffer.key)!, instance); reveal(); return; }
    const old = current.current;
    if (old) { const entry = cachedStates.get(old.key); if (entry) entry.state = instance.state; old.scrollTop = instance.scrollDOM.scrollTop; }
    current.current = buffer; activeKey = buffer.key;
    let cached = cachedStates.get(buffer.key);
    if (!cached || cached.contentVersion !== buffer.contentVersion) cached = makeState(buffer);
    cached.used = Date.now(); instance.setState(cached.state); refreshPath(buffer, cached, instance); instance.scrollDOM.scrollTop = buffer.scrollTop;
    const line = instance.state.doc.lineAt(instance.state.selection.main.head); setPosition({ line: line.number, column: instance.state.selection.main.head - line.from + 1 }); reveal();
    const clean = [...cachedStates].filter(([key]) => key !== buffer.key && !snapshot.buffers.get(key)?.dirty).sort((a, b) => a[1].used - b[1].used);
    while (clean.length >= 20) cachedStates.delete(clean.shift()![0]);
  }, [snapshot.revision, projectId, releaseView]);
  const status = <footer className="editor-status"><span id="editor-keyboard-help">Esc 后按 Tab 离开编辑器</span>{buffer?.dirty && <span title={buffer.checkpointVersion === buffer.version ? '当前编辑已写入恢复草稿' : '停止输入 2 秒后写入恢复草稿'}>{buffer.checkpointVersion === buffer.version ? '恢复稿已存' : '未保存'}</span>}<button onClick={() => editorCommands.gotoLine()}>行 {position.line}，列 {position.column}</button><span>{buffer?.path.split('.').pop()?.toUpperCase() || '纯文本'}</span><span>{buffer?.meta?.encoding.toUpperCase()} · {buffer?.meta?.eol.toUpperCase()}</span></footer>;
  return <div className="code-surface"><div className="code-surface-host" ref={host} />{statusTarget ? createPortal(status, statusTarget) : status}</div>;
}
