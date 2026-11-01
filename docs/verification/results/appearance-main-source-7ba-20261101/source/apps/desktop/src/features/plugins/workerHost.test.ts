import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActivationContext, PluginLifecycle, PluginManifest } from '../../../../../packages/plugins/src/types';

const mocks = vi.hoisted(() => ({ call: vi.fn(), onEvent: vi.fn(), off: vi.fn(), refresh: vi.fn(), registerLifecycle: vi.fn(), getSnapshot: vi.fn(), registerSlot: vi.fn() }));
vi.mock('../../bridge', () => ({ call: mocks.call, onEvent: mocks.onEvent }));
vi.mock('./service', () => ({
  refreshPlugins: mocks.refresh, registerPluginLifecycle: mocks.registerLifecycle,
  pluginRuntime: { getSnapshot: mocks.getSnapshot, registerSlot: mocks.registerSlot },
}));
const manifest: PluginManifest = {
  id: 'local.metrics', name: 'Metrics test', version: '0.1.0', description: 'Test fixture', author: 'test', apiVersion: 1,
  engines: { horizon: '>=0.1.0 <0.2.0' }, runtime: { kind: 'quickjs', entry: 'index.js' }, activation: [], requires: {}, optional: {}, capabilities: [],
  contributes: { commands: [{ id: 'local.metrics.command', title: 'Command' }], views: [{ id: 'local.metrics.view', slot: 'primarySidebar', renderer: 'declarative' }] },
};
function context(controller: AbortController): ActivationContext { return { activationId: 'activation-a', projectId: 'A', signal: controller.signal, own: resource => resource }; }
function emit(event: string, data: object) { const callback = mocks.onEvent.mock.calls[0][1] as (payload: unknown) => void; callback({ extensionId: manifest.id, activationId: 'activation-a', projectId: 'A', event, data }); }
async function prepare() {
  const worker = await import('./workerHost'); worker.registerWorkerPackage(manifest);
  return { worker, lifecycle: mocks.registerLifecycle.mock.calls[0][1] as PluginLifecycle };
}
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks();
  mocks.call.mockResolvedValue({}); mocks.off.mockResolvedValue(undefined); mocks.onEvent.mockImplementation(async () => mocks.off);
  mocks.refresh.mockResolvedValue(undefined); mocks.getSnapshot.mockReturnValue([{ id: manifest.id, manifest }]);
  mocks.registerSlot.mockImplementation(() => ({ dispose: vi.fn() }));
});

describe('worker ownership diagnostics', () => {
  it('counts actual abort, observer, command and view registrations, then releases each once', async () => {
    const { worker, lifecycle } = await prepare(); const controller = new AbortController();
    const cleanup = await lifecycle.activate!(context(controller));
    const stopObserver = worker.subscribeWorkerCommands(() => {});
    emit('command', { id: 'local.metrics.command' }); emit('view', { id: 'local.metrics.view', view: { kind: 'text', title: 'View', items: [] } });
    expect(mocks.onEvent.mock.calls[0][2]).toEqual({ owner: 'workerHost' });
    expect(worker.getWorkerDiagnostics()).toEqual({ workerAbortListeners: 1, workerCommandObservers: 1, workerCommands: 1, workerViews: 1 });
    if (typeof cleanup !== 'function') throw new Error('Expected activation disposer');
    await cleanup(); await cleanup();
    expect(worker.getWorkerDiagnostics()).toEqual({ workerAbortListeners: 0, workerCommandObservers: 1, workerCommands: 0, workerViews: 0 });
    expect(mocks.off).toHaveBeenCalledTimes(1);
    stopObserver(); stopObserver(); expect(worker.getWorkerDiagnostics().workerCommandObservers).toBe(0);
  });

  it('cleans a native listener that resolves after the activation was already aborted', async () => {
    let resolveListen!: (off: () => Promise<void>) => void;
    mocks.onEvent.mockImplementationOnce(() => new Promise(resolve => { resolveListen = resolve; }));
    const { worker, lifecycle } = await prepare(); const controller = new AbortController();
    const activating = lifecycle.activate!(context(controller));
    expect(worker.getWorkerDiagnostics().workerAbortListeners).toBe(1);
    controller.abort(); expect(worker.getWorkerDiagnostics().workerAbortListeners).toBe(0);
    resolveListen(mocks.off); await activating;
    expect(mocks.off).toHaveBeenCalledTimes(1);
    expect(worker.getWorkerDiagnostics()).toEqual({ workerAbortListeners: 0, workerCommandObservers: 0, workerCommands: 0, workerViews: 0 });
  });

  it('runtime failure removes every worker contribution and its abort listener', async () => {
    const { worker, lifecycle } = await prepare(); const controller = new AbortController();
    const cleanup = await lifecycle.activate!(context(controller));
    emit('command', { id: 'local.metrics.command' }); emit('view', { id: 'local.metrics.view', view: { kind: 'text', title: 'View', items: [] } });
    emit('failed', { message: 'Fixture failed' });
    expect(worker.getWorkerDiagnostics()).toEqual({ workerAbortListeners: 0, workerCommandObservers: 0, workerCommands: 0, workerViews: 0 });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    if (typeof cleanup !== 'function') throw new Error('Expected activation disposer');
    await cleanup(); expect(mocks.off).toHaveBeenCalledTimes(1);
  });

  it('does not report completed disposal while native unlisten is pending or rejected', async () => {
    let rejectOff!: (reason: Error) => void;
    mocks.off.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOff = reject; }));
    const { lifecycle } = await prepare(); const cleanup = await lifecycle.activate!(context(new AbortController()));
    if (typeof cleanup !== 'function') throw new Error('Expected activation disposer');
    let settled = false; const disposing = Promise.resolve(cleanup()).finally(() => { settled = true; });
    const rejected = expect(disposing).rejects.toThrow('扩展部分资源清理失败');
    await Promise.resolve(); expect(settled).toBe(false);
    rejectOff(new Error('native unlisten rejected')); await rejected;
    expect(mocks.call).toHaveBeenCalledWith('extension_runtime_stop', { extensionId: manifest.id, activationId: 'activation-a' }, 'A');
  });
});
