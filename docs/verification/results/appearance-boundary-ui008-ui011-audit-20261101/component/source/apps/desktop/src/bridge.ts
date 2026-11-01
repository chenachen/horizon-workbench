import { Channel, invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface HorizonErrorData {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
  recovery?: string[];
}
export class HorizonError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
  readonly recovery?: string[];
  constructor(error: HorizonErrorData) {
    super(error.message); this.name = 'HorizonError';
    this.code = error.code; this.retryable = error.retryable;
    this.details = error.details; this.recovery = error.recovery;
  }
}
export type Scope = { kind: 'app' } | { kind: 'project'; projectId: string; projectEpoch: number };
export type Reply<T> = { ok: true; requestId: string; data: T } | { ok: false; requestId: string; error: HorizonErrorData };
export interface TaskEvent<T = unknown> {
  protocolVersion: 1; event: string; taskId: string; requestId: string; scope: Scope; seq: number;
  payload: { type: 'started' | 'progress' | 'data' | 'permissionRequired' | 'terminal'; kind?: string; data?: unknown; phase?: string; completed?: number; total?: number; state?: string; result?: T; error?: HorizonErrorData; [key: string]: unknown };
}
export interface TaskHandle<T> {
  taskId: string; requestId: string; state: 'queued'; cancelMode: string;
  result: Promise<T>; completion: Promise<T>; cancel(): Promise<unknown>;
}

const projectEpochs = new Map<string, number>();
export function setProjectEpoch(projectId: string, epoch: number) { projectEpochs.set(projectId, epoch); }
export function getProjectEpoch(projectId: string) { return projectEpochs.get(projectId) ?? 1; }
export const nativeAvailable = () => isTauri();
function request(method: string, params: unknown, projectId?: string) {
  return { protocolVersion: 1, requestId: crypto.randomUUID(), method,
    scope: projectId ? { kind: 'project', projectId, projectEpoch: getProjectEpoch(projectId) } : { kind: 'app' },
    params, idempotencyKey: crypto.randomUUID() };
}
function unwrap<T>(reply: Reply<T>): T {
  if (!reply.ok) throw new HorizonError(reply.error);
  return reply.data;
}
export async function call<T = unknown>(method: string, params: unknown = {}, projectId?: string): Promise<T> {
  return unwrap(await invoke<Reply<T>>('horizon_call', { call: request(method, params, projectId) }));
}
export async function start<T = unknown>(method: string, params: unknown, onEvent: (event: TaskEvent<T>) => void = () => {}, projectId?: string): Promise<TaskHandle<T>> {
  const envelope = request(method, params, projectId);
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const result = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  // Consumers may attach completion handlers after the start acknowledgement.
  void result.catch(() => {});
  let lastSeq = 0, acknowledgedSeq = 0, activeTaskId = '', terminal = false;
  const acknowledge = () => {
    if (!activeTaskId || lastSeq <= acknowledgedSeq) return;
    const throughSeq = lastSeq;
    void call('stream_ack', { taskId: activeTaskId, throughSeq }, projectId).then(() => { acknowledgedSeq = Math.max(acknowledgedSeq, throughSeq); }).catch(() => {});
  };
  const ackTimer = setInterval(acknowledge, 100);
  const channel = new Channel<TaskEvent<T>>();
  channel.onmessage = event => {
    if (terminal || event.requestId !== envelope.requestId || event.seq <= lastSeq) return;
    activeTaskId = event.taskId;
    lastSeq = event.seq;
    try { onEvent(event); } catch (error) { console.error('Task view failed', error); }
    if (event.payload.type === 'terminal') {
      terminal = true;
      acknowledge(); clearInterval(ackTimer);
      if (event.payload.state === 'succeeded') resolve(event.payload.result as T);
      else reject(new HorizonError(event.payload.error ?? { code: event.payload.state === 'cancelled' ? 'CANCELLED' : 'IO_ERROR', message: event.payload.state === 'cancelled' ? '操作已取消' : '操作失败', retryable: true }));
    }
  };
  try {
    const accepted = unwrap(await invoke<Reply<{ taskId: string; requestId: string; state: 'queued'; cancelMode: string }>>('horizon_start', { call: envelope, channel }));
    return { ...accepted, result, completion: result, cancel: () => call('task_cancel', { taskId: accepted.taskId }, projectId) };
  } catch (error) { clearInterval(ackTimer); reject(error); throw error; }
}
export async function subscribe<T = unknown>(topics: string[], onEvent: (event: T) => void, projectId?: string) {
  const channel = new Channel<T>(); channel.onmessage = onEvent;
  const data = unwrap(await invoke<Reply<{ subscriptionId: string; snapshots: unknown[] }>>('horizon_subscribe', { call: request('service_subscribe', { topics }, projectId), channel }));
  return { ...data, close: () => call('subscription_close', { subscriptionId: data.subscriptionId }, projectId) };
}
type EventListenerRecord = { owner?: 'workerHost'; state: 'active' | 'disposing' | 'failed' };
const eventListeners = new Set<EventListenerRecord>();

/** Worker listeners are a subset of eventListeners, never an additional total. */
export function getBridgeDiagnostics() {
  const records = [...eventListeners];
  return {
    eventListeners: records.length,
    eventListenersDisposing: records.filter(record => record.state === 'disposing').length,
    eventListenerDisposalFailures: records.filter(record => record.state === 'failed').length,
    workerEventListeners: records.filter(record => record.owner === 'workerHost').length,
  };
}
export async function onEvent<T>(topic: string, callback: (payload: T) => void, options?: { owner?: 'workerHost' }): Promise<() => Promise<void>> {
  const unlisten = await listen<T>(topic.replaceAll('.', ':'), event => callback(event.payload));
  const record: EventListenerRecord = { owner: options?.owner, state: 'active' };
  eventListeners.add(record);
  let disposal: Promise<void> | undefined;
  return () => {
    if (disposal) return disposal;
    record.state = 'disposing';
    // Tauri's UnlistenFn is typed void, but its implementation returns the native
    // removal promise. Count it until that removal is confirmed.
    disposal = Promise.resolve().then(() => unlisten()).then(() => {
      eventListeners.delete(record);
    }, error => {
      record.state = 'failed'; disposal = undefined;
      throw error;
    });
    // Existing React effect cleanups cannot await. Keep their failures observable
    // in diagnostics while callers that await disposal still receive rejection.
    void disposal.catch(() => {});
    return disposal;
  };
}
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) return String(error.message);
  return String(error);
}
