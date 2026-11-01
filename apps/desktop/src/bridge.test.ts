import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }));

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); });

describe('native event listener diagnostics', () => {
  it('counts only established listeners and forwards transport payloads', async () => {
    let resolveListen!: (off: () => Promise<void>) => void;
    mocks.listen.mockImplementationOnce(() => new Promise(resolve => { resolveListen = resolve; }));
    const { onEvent, getBridgeDiagnostics } = await import('./bridge');
    const callback = vi.fn();
    const pending = onEvent('horizon.worker.v1', callback, { owner: 'workerHost' });
    expect(getBridgeDiagnostics().eventListeners).toBe(0);
    expect(mocks.listen.mock.calls[0][0]).toBe('horizon:worker:v1');
    mocks.listen.mock.calls[0][1]({ payload: { state: 'active' } });
    expect(callback).toHaveBeenCalledWith({ state: 'active' });
    resolveListen(async () => {});
    const off = await pending;
    expect(getBridgeDiagnostics()).toEqual({ eventListeners: 1, eventListenersDisposing: 0, eventListenerDisposalFailures: 0, workerEventListeners: 1 });
    await off();
    expect(getBridgeDiagnostics().eventListeners).toBe(0);
  });

  it('keeps pending native removals counted and shares concurrent disposal', async () => {
    let finish!: () => void;
    const nativeOff = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    mocks.listen.mockResolvedValue(nativeOff);
    const { onEvent, getBridgeDiagnostics } = await import('./bridge');
    const off = await onEvent('horizon.project.v1', () => {});
    const first = off();
    expect(off()).toBe(first);
    expect(getBridgeDiagnostics()).toEqual({ eventListeners: 1, eventListenersDisposing: 1, eventListenerDisposalFailures: 0, workerEventListeners: 0 });
    await Promise.resolve();
    expect(nativeOff).toHaveBeenCalledTimes(1);
    finish(); await first; await off();
    expect(nativeOff).toHaveBeenCalledTimes(1);
    expect(getBridgeDiagnostics().eventListeners).toBe(0);
  });

  it('retains failed removals until a later native retry actually succeeds', async () => {
    const nativeOff = vi.fn().mockRejectedValueOnce(new Error('native removal failed')).mockResolvedValue(undefined);
    mocks.listen.mockResolvedValue(nativeOff);
    const { onEvent, getBridgeDiagnostics } = await import('./bridge');
    const off = await onEvent('horizon.worker.v1', () => {}, { owner: 'workerHost' });
    await expect(off()).rejects.toThrow('native removal failed');
    expect(getBridgeDiagnostics()).toEqual({ eventListeners: 1, eventListenersDisposing: 0, eventListenerDisposalFailures: 1, workerEventListeners: 1 });
    await off();
    expect(nativeOff).toHaveBeenCalledTimes(2);
    expect(getBridgeDiagnostics()).toEqual({ eventListeners: 0, eventListenersDisposing: 0, eventListenerDisposalFailures: 0, workerEventListeners: 0 });
  });
});
