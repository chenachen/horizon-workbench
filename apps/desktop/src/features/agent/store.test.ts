import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskHandle } from '../../bridge';
import type { AgentSession, RunResult } from './types';

const bridge = vi.hoisted(() => ({ call: vi.fn(), start: vi.fn() }));
vi.mock('../../bridge', () => ({ ...bridge, errorMessage: (error: Error) => error.message }));

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const projectId = 'draft-project';
const draft = 'Original prompt';
const session: AgentSession = { sessionId: 'session', projectId, connectionId: 'connection', profile: 'chat', state: 'idle', instanceId: null, instanceEpoch: 0, resumeAvailable: false, reviewId: null };
const snapshot = { snapshotId: 'snapshot', manifestDigest: 'digest' };
const success: RunResult = { sessionId: session.sessionId, state: 'succeeded', text: 'Done', disposition: 'handled', runId: 'run' };
let store: typeof import('./store');

beforeEach(async () => {
  vi.resetModules(); vi.resetAllMocks();
  store = await import('./store');
  store.agentView.patch(projectId, { initialized: true, session, sessions: [session], connectionId: session.connectionId, draft });
});

function nativeRun(stage?: 'session' | 'context' | 'submit') {
  const waiting = deferred<void>(), release = deferred<void>(), result = deferred<RunResult>();
  const handle: TaskHandle<RunResult> = { taskId: 'task', requestId: 'request', state: 'queued', cancelMode: 'cooperative', result: result.promise, completion: result.promise, cancel: vi.fn().mockResolvedValue(undefined) };
  // Native bridge also handles terminal errors before callers await result.
  void result.promise.catch(() => {});
  if (stage === 'session') store.agentView.patch(projectId, { session: null, sessions: [] });
  bridge.call.mockImplementation(async (method: string) => {
    if (method === 'agent_session_create' || method === 'agent_context_prepare') {
      if ((stage === 'session' && method === 'agent_session_create') || (stage === 'context' && method === 'agent_context_prepare')) { waiting.resolve(); await release.promise; }
      return method === 'agent_session_create' ? session : snapshot;
    }
    if (method === 'agent_connections_list') return { items: [{ connectionId: session.connectionId }] };
    if (method === 'agent_sessions_list') return { items: [session] };
    if (method === 'agent_preferences_get') return { effectiveConnectionId: session.connectionId };
    if (method === 'agent_transcript_read') return { items: [], nextCursor: null };
    if (method === 'agent_cancel') return {};
    throw new Error(`Unexpected native call: ${method}`);
  });
  bridge.start.mockImplementation(async () => {
    if (stage === 'submit') { waiting.resolve(); await release.promise; }
    return handle;
  });
  return { waiting, release, result, handle };
}

const waitForTask = (handle: TaskHandle<RunResult>) => vi.waitFor(() => expect(store.agentView.get(projectId).task).toBe(handle));

describe('agent draft ownership during submission', () => {
  it.each(['session', 'context', 'submit'] as const)('keeps text entered while %s startup is pending and submits the original snapshot', async stage => {
    const run = nativeRun(stage), sending = store.sendAgent(projectId);
    await run.waiting.promise;
    store.agentView.patch(projectId, { draft: `${draft}\nNext thought` });
    run.release.resolve();
    await waitForTask(run.handle);
    expect(store.agentView.get(projectId).draft).toBe(`${draft}\nNext thought`);
    expect(bridge.start).toHaveBeenCalledWith('agent_submit', expect.objectContaining({ text: draft, ...snapshot }), expect.any(Function), projectId);
    expect(store.agentView.get(projectId).messages.at(-1)).toMatchObject({ role: 'user', text: draft });
    run.result.resolve(success); await sending;
    expect(store.agentView.get(projectId).draft).toBe(`${draft}\nNext thought`);
  });

  it('clears an unchanged draft once native submission is accepted', async () => {
    const run = nativeRun('context'), sending = store.sendAgent(projectId);
    await run.waiting.promise;
    expect(store.agentView.get(projectId).draft).toBe(draft);
    run.release.resolve(); await waitForTask(run.handle);
    expect(store.agentView.get(projectId).draft).toBe('');
    run.result.resolve(success); await sending;
    expect(store.agentView.get(projectId).draft).toBe('');
  });

  it('keeps a draft edited back to the same text during startup', async () => {
    const run = nativeRun('submit'), sending = store.sendAgent(projectId);
    await run.waiting.promise;
    store.agentView.patch(projectId, { draft: 'Rewritten prompt' });
    store.agentView.patch(projectId, { draft });
    run.release.resolve(); await waitForTask(run.handle);
    expect(store.agentView.get(projectId).draft).toBe(draft);
    run.result.resolve(success); await sending;
  });

  it.each(['failed', 'cancelled'] as const)('restores the consumed draft after a native %s terminal result', async state => {
    const run = nativeRun(), sending = store.sendAgent(projectId);
    await waitForTask(run.handle);
    expect(store.agentView.get(projectId).draft).toBe('');
    if (state === 'cancelled') await store.cancelAgent(projectId);
    run.result.reject(Object.assign(new Error('Native stopped'), { code: state === 'cancelled' ? 'CANCELLED' : 'IO_ERROR' }));
    await sending;
    expect(store.agentView.get(projectId)).toMatchObject({ draft, status: state, error: state === 'cancelled' ? null : 'Native stopped', task: undefined });
    if (state === 'cancelled') expect(run.handle.cancel).toHaveBeenCalledTimes(1);
  });

  it.each(['Next prompt', ''])('keeps newer draft %j when a submitted run fails', async nextDraft => {
    const run = nativeRun(), sending = store.sendAgent(projectId);
    await waitForTask(run.handle);
    store.agentView.patch(projectId, { draft: 'New input' });
    store.agentView.patch(projectId, { draft: nextDraft });
    run.result.reject(new Error('Native failed')); await sending;
    expect(store.agentView.get(projectId)).toMatchObject({ draft: nextDraft, status: 'failed' });
  });

  it('keeps a draft deliberately cleared while context preparation later fails', async () => {
    const run = nativeRun('context'), sending = store.sendAgent(projectId);
    await run.waiting.promise;
    store.agentView.patch(projectId, { draft: '' });
    run.release.reject(new Error('Context failed')); await sending;
    expect(store.agentView.get(projectId)).toMatchObject({ draft: '', status: 'failed', error: 'Context failed' });
    expect(bridge.start).not.toHaveBeenCalled();
  });

  it('keeps the original draft and skips submission when cancelled during preparation', async () => {
    const run = nativeRun('context'), sending = store.sendAgent(projectId);
    await run.waiting.promise;
    await store.cancelAgent(projectId);
    run.release.resolve(); await sending;
    expect(store.agentView.get(projectId)).toMatchObject({ draft, status: 'cancelled', error: null });
    expect(bridge.start).not.toHaveBeenCalled();
  });
});
