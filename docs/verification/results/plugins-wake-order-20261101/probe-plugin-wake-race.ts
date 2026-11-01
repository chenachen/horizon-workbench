import assert from 'node:assert/strict';
import { activatePlugin, refreshPlugins, pluginRuntime, registerPluginLifecycle } from '../apps/desktop/src/features/plugins/service';
import { EditorStore } from '../packages/editor/src/store';
import { builtinById } from '../packages/plugins/src/builtins';

const events: unknown[] = [];
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const nativeState = { id: 'horizon.editor', revision: 1, installedVersion: '0.1.0', installState: 'installed', pausedGlobal: false, pausedProject: false, effectivePaused: false, enabledGlobal: true, projectOverride: 'inherit', effectiveEnabled: true, runState: 'active', activationId: 'old-activation', dependents: [], ownedResourceCount: 0, uiReclaim: 'retainedModule', manifest: builtinById.get('horizon.editor') };
let listState = nativeState;
let documentOpens = 0;
let nativeActivations = 0;
let holdOpen = false;
const openEntered = deferred<void>();
const delayedDocument = deferred<unknown>();
const revision = { token: 'owned-revision', contentHash: 'owned-hash', byteLength: '104857601', modifiedAt: '2026-11-01T00:00:00Z' };
const document = (fileId: string, cursor: string) => fileId === 'large'
  ? { mode: 'chunked', file: { projectId: 'A', fileId, displayPath: 'owned-large.txt' }, revision, cursor }
  : { mode: 'editor', meta: { documentId: `doc-${fileId}`, file: { projectId: 'A', fileId, displayPath: `${fileId}.txt` }, editorRevision: 0, baseDiskRevision: revision, encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false }, text: 'owned text', simplified: false };
const controls = {
  async call(method: string, params: Record<string, unknown> = {}) {
    if (method === 'extension_list') return { items: [{ ...listState }] };
    if (method === 'document_open') {
      documentOpens++;
      if (holdOpen) { events.push({ event: 'wake document_open pending', fileId: params.fileId }); openEntered.resolve(); return delayedDocument.promise; }
      return document(String(params.fileId), 'old-cursor');
    }
    return {};
  },
  async start() { nativeActivations++; throw new Error('Unexpected activation in stale-active reproduction'); },
};
(globalThis as any).__wakeRace = controls;
const store = new EditorStore({ call: controls.call as any });
store.setProject('A', 1);
registerPluginLifecycle('horizon.editor', {
  activate: async ({ projectId, signal }) => { if (projectId && !signal.aborted) await store.restoreProjectSession(projectId); },
  dispose: ({ projectId }) => { events.push({ event: 'late runtime lifecycle.dispose', ticketBefore: store.captureRestoreTicket('A', 2) }); store.hostClosedProject(projectId); events.push({ event: 'late dispose completed', ticketAfter: store.captureRestoreTicket('A', 2) }); },
});
await refreshPlugins('A');
await store.openFile('other');
await store.openFile('large');
store.hostClosedProject('A');
store.setProject('A', 2);
const ticket = store.captureRestoreTicket('A', 2)!;
const enabledBefore = pluginRuntime.isEnabled('horizon.editor', 'A');
events.push({ event: 'wake epoch applied; cached plugin remains active', ticket, cachedRunState: pluginRuntime.getSnapshot('A')[0].runState, enabledBefore });
await activatePlugin('horizon.editor', 'A', 'view');
assert.equal(nativeActivations, 0);
holdOpen = true;
const restoring = store.restoreProjectSession('A', ticket);
await openEntered.promise;
listState = { ...nativeState, runState: 'sleeping', activationId: undefined } as any;
await refreshPlugins('A');
delayedDocument.resolve(document('large', 'new-cursor'));
await restoring;
const opensBeforeClick = documentOpens;
const other = await store.openFile('other');
const quickOpen = await store.openFile('brand-new-file');
const actual = { cachedRunState: pluginRuntime.getSnapshot('A')[0].runState, enabledAfter: pluginRuntime.isEnabled('horizon.editor', 'A'), nativeActivations, oldTicket: ticket, currentTicket: store.captureRestoreTicket('A', 2), active: { fileId: store.getActive()?.fileId, mode: store.getActive()?.mode, cursor: store.getActive()?.cursor, evicted: store.getActive()?.evicted }, tabOpenReturnedUndefined: other === undefined, quickOpenReturnedUndefined: quickOpen === undefined, additionalDocumentOpens: documentOpens - opensBeforeClick };
assert.equal(actual.enabledAfter, enabledBefore);
assert.notEqual(actual.active.cursor, 'new-cursor');
assert.equal(actual.active.evicted, true);
assert.equal(actual.tabOpenReturnedUndefined, true);
assert.equal(actual.quickOpenReturnedUndefined, true);
assert.equal(actual.additionalDocumentOpens, 0);
assert.notDeepEqual(actual.oldTicket, actual.currentTicket);
events.push({ event: 'reproduced detached no-op', ...actual });
await pluginRuntime.dispose();
console.log(JSON.stringify({ status: 'reproduced', productionImports: ['service.ts', 'runtime.ts', 'EditorStore'], controlledBoundary: 'bridge RPC only; lifecycle hook mirrors production editor index/store', events }, null, 2));
