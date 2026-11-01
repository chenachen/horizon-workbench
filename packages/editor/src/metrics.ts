export type EditorOpenMeasurement = { id: number; projectId: string; fileId: string; cache: 'cold' | 'warm'; startedAt: string; durationMs?: number; languageReadyMs?: number; highlightReadyMs?: number; language?: string; byteLength?: string; editorRevision?: number; viewId?: number };
type Pending = { entry: EditorOpenMeasurement; started: number };
const pending = new Map<string, Pending>();
const measurements: EditorOpenMeasurement[] = [];
const views = new Set<number>();
let sequence = 0, viewSequence = 0, destroyedViews = 0;
const now = () => typeof performance === 'undefined' ? Date.now() : performance.now();
const keyOf = (projectId: string, fileId: string) => `${projectId}\u0000${fileId}`;
export function beginEditorOpen(projectId: string, fileId: string, cache: 'cold' | 'warm') {
  const key = keyOf(projectId, fileId), entry = { id: ++sequence, projectId, fileId, cache, startedAt: new Date().toISOString() };
  pending.set(key, { entry, started: now() });
  while (pending.size > 200) pending.delete(pending.keys().next().value!);
}
export function editorLanguageReady(projectId: string, fileId: string) { const current = pending.get(keyOf(projectId, fileId)); if (current) current.entry.languageReadyMs = now() - current.started; }
export function hasPendingEditorOpen(projectId: string, fileId: string) { return pending.has(keyOf(projectId, fileId)); }
function notify(entry: EditorOpenMeasurement) { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('horizon:editor-timing', { detail: { ...entry } })); }
export function editorHighlightReady(projectId: string, fileId: string) {
  const key = keyOf(projectId, fileId), current = pending.get(key); if (!current) return;
  current.entry.highlightReadyMs ??= now() - current.started;
  if (current.entry.durationMs !== undefined) { pending.delete(key); notify(current.entry); }
}
export function finishEditorOpen(projectId: string, fileId: string, byteLength: string, editorRevision: number, viewId: number, language: string) {
  const key = keyOf(projectId, fileId), current = pending.get(key); if (!current) return;
  if (current.entry.durationMs !== undefined) return;
  Object.assign(current.entry, { durationMs: now() - current.started, byteLength, editorRevision, viewId, language });
  measurements.push(current.entry); if (measurements.length > 200) measurements.shift();
  if (language === 'plain' || current.entry.highlightReadyMs !== undefined) pending.delete(key);
  notify(current.entry);
}
export function editorViewCreated() { const id = ++viewSequence; views.add(id); return id; }
export function editorViewDestroyed(id: number) { if (views.delete(id)) destroyedViews++; }
export function getEditorDiagnostics() { return { schemaVersion: 1, measurement: 'durationMs: open intent to CodeMirror layout followed by next visible frame; languageReadyMs: language module ready from same start; highlightReadyMs: viewport syntax tree complete followed by next visible frame. Pixel paint is not directly observed.', viewCount: views.size, createdViews: viewSequence, destroyedViews, opens: measurements.map(item => ({ ...item })) }; }
