import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorStore } from '../../../../../packages/editor/src/store';
import { builtinById } from '../../../../../packages/plugins/src/builtins';
import type { ExtensionState } from '../../../../../packages/plugins/src/types';
import type { EditorTransport, OpenDocument } from '../../../../../packages/editor/src/types';

const bridge = vi.hoisted(() => ({ call: vi.fn(), start: vi.fn(), onEvent: vi.fn() }));
vi.mock('../../bridge', () => ({ ...bridge, nativeAvailable: () => true }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const active = (activationId: string): ExtensionState => ({
  id: 'horizon.editor', revision: 1, installedVersion: '0.1.0', installState: 'installed',
  pausedGlobal: false, pausedProject: false, effectivePaused: false, enabledGlobal: true,
  projectOverride: 'inherit', effectiveEnabled: true, runState: 'active', activationId,
  dependents: [], ownedResourceCount: 0, uiReclaim: 'retainedModule', manifest: builtinById.get('horizon.editor'),
});
const revision = { token: 'fixture-revision', contentHash: 'fixture-hash', byteLength: '104857601', modifiedAt: '2026-11-01T00:00:00Z' };
function opened(fileId: string, cursor: string): OpenDocument {
  const file = { projectId: 'A', fileId, displayPath: `${fileId}.txt` };
  return fileId === 'large' ? { mode: 'chunked', file, revision, cursor } : {
    mode: 'editor', meta: { documentId: `document-${fileId}`, file, editorRevision: 0, baseDiskRevision: revision, encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false }, text: 'owned fixture text', simplified: false,
  };
}
const turn = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let service: typeof import('./service');
let store: EditorStore | undefined;

beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  bridge.onEvent.mockResolvedValue(() => {});
  service = await import('./service');
});
afterEach(async () => { store?.hostClosedProject(); store = undefined; await service.pluginRuntime.dispose(); });

describe('native activation refresh ordering', () => {
  it('drains a stale refresh and old disposal before waking the editor with a fresh activation', async () => {
    let native = active('old-activation');
    let listCount = 0;
    let documentCount = 0;
    const oldList = deferred<{ items: ExtensionState[] }>();
    const disposing = deferred<void>();
    const release = deferred<void>();
    bridge.call.mockImplementation(async (method: string, params: Record<string, unknown> = {}) => {
      if (method === 'extension_list') {
        listCount++;
        return listCount === 2 ? oldList.promise : { items: [{ ...native }] };
      }
      if (method === 'document_open') { documentCount++; return opened(String(params.fileId), native.activationId === 'new-activation' ? 'new-cursor' : 'old-cursor'); }
      return {};
    });
    bridge.start.mockImplementation(async () => { native = active('new-activation'); return { result: Promise.resolve(native) }; });
    store = new EditorStore({ call: bridge.call } as EditorTransport);
    store.setProject('A', 1);
    service.registerPluginLifecycle('horizon.editor', {
      activate: async context => {
        if (context.activationId === 'old-activation') context.own(async () => { disposing.resolve(); await release.promise; });
        if (context.projectId && !context.signal.aborted) await store!.restoreProjectSession(context.projectId);
      },
      dispose: ({ projectId }) => store!.hostClosedProject(projectId),
    });
    await service.refreshPlugins('A');
    await store.openFile('other'); await store.openFile('large');
    const olderRefresh = service.refreshPlugins('A');
    store.hostClosedProject('A'); store.setProject('A', 2);
    const priorTicket = store.captureRestoreTicket('A', 2)!;
    let activationSettled = false;
    const waking = service.activatePlugin('horizon.editor', 'A', 'view').finally(() => { activationSettled = true; });
    const sleeping: ExtensionState = { ...native, runState: 'sleeping', activationId: undefined };
    try {
      await turn();
      expect(activationSettled).toBe(false);
      expect(bridge.start).not.toHaveBeenCalled();
      native = sleeping; oldList.resolve({ items: [sleeping] });
      await disposing.promise;
      expect(activationSettled).toBe(false);
      expect(bridge.start).not.toHaveBeenCalled();
      expect(listCount).toBe(2);
      release.resolve();
      await olderRefresh; await waking;
      expect(listCount).toBe(4);
      expect(bridge.start).toHaveBeenCalledTimes(1);
      expect(store.captureRestoreTicket('A', 2)).not.toEqual(priorTicket);
      await store.restoreProjectSession('A', priorTicket);
      expect(store.getActive()).toMatchObject({ fileId: 'large', mode: 'chunked', cursor: 'new-cursor' });
      expect(store.getActive()?.evicted).not.toBe(true);
      const beforeClick = documentCount;
      expect(await store.openFile('other')).toMatchObject({ fileId: 'other', mode: 'editor' });
      expect(await store.openFile('quick-open-file')).toMatchObject({ fileId: 'quick-open-file', mode: 'editor' });
      expect(documentCount - beforeClick).toBe(2);
      expect(service.pluginRuntime.getSnapshot('A')[0].activationId).toBe('new-activation');
      expect(service.pluginRuntime.getDiagnostics().pluginInstances).toBe(1);
    } finally {
      oldList.resolve({ items: [sleeping] }); release.resolve();
      await Promise.allSettled([olderRefresh, waking]);
    }
  });

  it('keeps an already-current activation without starting a second instance', async () => {
    const state = active('same-activation');
    bridge.call.mockResolvedValue({ items: [state] });
    await service.refreshPlugins('A');
    await service.activatePlugin('horizon.editor', 'A', 'view');
    expect(bridge.call).toHaveBeenCalledTimes(2);
    expect(bridge.start).not.toHaveBeenCalled();
    expect(service.pluginRuntime.getDiagnostics().pluginInstances).toBe(1);
  });

  it('respects a newly paused native policy instead of reviving the cached active instance', async () => {
    let state = active('before-pause');
    bridge.call.mockImplementation(async () => ({ items: [state] }));
    await service.refreshPlugins('A');
    state = { ...state, pausedGlobal: true, effectivePaused: true, runState: 'paused', activationId: undefined };
    await service.activatePlugin('horizon.editor', 'A', 'view');
    expect(bridge.start).not.toHaveBeenCalled();
    expect(service.pluginRuntime.getSnapshot('A')[0]).toMatchObject({ effectivePaused: true, runState: 'paused' });
    expect(service.pluginRuntime.getDiagnostics().pluginInstances).toBe(0);
  });
});
