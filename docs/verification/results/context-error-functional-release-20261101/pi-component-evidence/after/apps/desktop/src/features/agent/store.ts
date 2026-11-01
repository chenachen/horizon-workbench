import { useCallback, useSyncExternalStore } from 'react';
import { call, errorMessage, start, type TaskEvent, type TaskHandle } from '../../bridge';
import type { AgentConnection, AgentSession, Attachment, Message, PermissionRequest, Profile, RunResult } from './types';
interface View { initialized: boolean; cancelRequested: boolean; revision: number; profile: Profile; session: AgentSession | null; sessions: AgentSession[]; connections: AgentConnection[]; connectionId: string; messages: Message[]; historyCursor: string | null; draft: string; attachments: Attachment[]; status: string; error: string | null; permission: PermissionRequest | null; tools: { id: string; name: string; state: string }[]; reviewId: string | null; task?: TaskHandle<RunResult>; loading: boolean }
const views = new Map<string, View>(), listeners = new Set<() => void>();
const loading = new Map<string, Promise<void>>();
const sessionReads = new Map<string, symbol>();
const visible = new Set<string>();
const preview = (text: string) => text.length <= 32768 ? text : text.slice(0, /[\uD800-\uDBFF]/.test(text.charAt(32767)) ? 32767 : 32768);
const initial = (): View => ({ initialized: false, cancelRequested: false, revision: 0, profile: 'chat', session: null, sessions: [], connections: [], connectionId: '', messages: [], historyCursor: null, draft: '', attachments: [], status: 'idle', error: null, permission: null, tools: [], reviewId: null, loading: false });
const view = (p: string) => { let v = views.get(p); if (!v) { v = initial(); views.set(p, v); } return v; };
const patch = (p: string, changes: Partial<View>) => { views.set(p, { ...view(p), ...changes, revision: view(p).revision + 1 }); listeners.forEach(fn => fn()); };
export const running = (status: string) => ['starting', 'running', 'waitingInput', 'stopping', 'finishing', 'retrying', 'compacting'].includes(status);
export function useAgent(projectId: string) { return useSyncExternalStore(useCallback(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, []), useCallback(() => view(projectId), [projectId])); }
export const agentView = { get: view, patch };
export function retainAgentView(projectId: string) { visible.add(projectId); return () => { visible.delete(projectId); if (!running(view(projectId).status)) patch(projectId, { messages: [], tools: [] }); }; }
export function queueAgentContext(projectId: string, attachment: Attachment) { const current = view(projectId).attachments.filter(a => a.key !== attachment.key); patch(projectId, { attachments: [...current, attachment] }); }
export async function loadAgent(projectId: string) {
  let promise = loading.get(projectId); if (promise) return promise;
  patch(projectId, { loading: true });
  promise = (async () => {
    try {
      const [connections, sessions, preferences] = await Promise.all([call<{ items: AgentConnection[] }>('agent_connections_list'), call<{ items: AgentSession[] }>('agent_sessions_list', {}, projectId), call<{ effectiveConnectionId: string | null }>('agent_preferences_get', {}, projectId)]);
      const current = view(projectId); const connectionId = connections.items.some(c => c.connectionId === current.connectionId) ? current.connectionId : preferences.effectiveConnectionId ?? connections.items[0]?.connectionId ?? '';
      const session = current.session ? sessions.items.find(s => s.sessionId === current.session?.sessionId) ?? current.session : current.initialized ? null : [...sessions.items].reverse().find(s => s.profile === current.profile) ?? null;
      patch(projectId, { initialized: true, connections: connections.items, sessions: sessions.items, connectionId, session, reviewId: current.reviewId ?? session?.reviewId ?? null, loading: false });
      if (session && !running(view(projectId).status) && !view(projectId).messages.length) await hydrateSession(projectId, session, false);
    } catch (error) { patch(projectId, { loading: false, error: errorMessage(error) }); }
  })().finally(() => loading.delete(projectId)); loading.set(projectId, promise); return promise;
}
async function hydrateSession(projectId: string, session: AgentSession, explicit: boolean) {
  const current = view(projectId);
  if (running(current.status)) return;
  const read = Symbol(); sessionReads.set(projectId, read);
  const result = await call<{ items: Message[]; nextCursor: string | null }>('agent_transcript_read', { sessionId: session.sessionId, limit: 100 }, projectId);
  const latest = view(projectId);
  if (sessionReads.get(projectId) !== read || running(latest.status)
    || latest.session?.sessionId !== current.session?.sessionId || latest.profile !== current.profile
    || latest.connectionId !== current.connectionId || latest.status !== current.status
    || latest.messages !== current.messages || latest.task !== current.task) return;
  const preserveFailure = !explicit && (current.status === 'failed' || current.status === 'cancelled');
  patch(projectId, { session, profile: session.profile, connectionId: session.connectionId, messages: result.items, historyCursor: result.nextCursor, reviewId: session.reviewId, ...(preserveFailure ? {} : { error: null, status: 'idle' }), tools: [] });
}
export async function selectSession(projectId: string, session: AgentSession) {
  await hydrateSession(projectId, session, true);
}
export async function loadEarlierMessages(projectId: string) {
  const current = view(projectId); if (!current.session || !current.historyCursor || running(current.status)) return;
  const page = await call<{ items: Message[]; nextCursor: string | null }>('agent_transcript_read', { sessionId: current.session.sessionId, cursor: current.historyCursor, limit: 100 }, projectId);
  patch(projectId, { messages: page.items, historyCursor: page.nextCursor });
}
export function setProfile(projectId: string, profile: Profile) { const current = view(projectId); if (running(current.status)) return; patch(projectId, { profile, session: null, messages: [], reviewId: null, tools: [], error: null }); }
async function ensureSession(projectId: string) {
  const current = view(projectId); if (current.session && current.session.profile === current.profile && current.session.connectionId === current.connectionId) return current.session;
  if (!current.connectionId) throw new Error('请先配置模型连接');
  const session = await call<AgentSession>('agent_session_create', { connectionId: current.connectionId, profile: current.profile }, projectId);
  patch(projectId, { session, sessions: [...view(projectId).sessions, session] }); return session;
}
const queued = new Map<string, TaskEvent<RunResult>[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function consume(projectId: string, events: TaskEvent<RunResult>[]) {
  const current = view(projectId); let messages = [...current.messages], status = current.status, permission = current.permission, tools = [...current.tools];
  for (const event of events) {
    if (event.payload.kind === 'agent.interactionResolved') { permission = null; if (status !== 'stopping') status = 'running'; continue; }
    if (event.payload.kind !== 'agent.event') continue;
    const outer = event.payload.data as { payload?: Record<string, any> }; const e = outer?.payload; if (!e) continue;
    if (e.type === 'textDelta') {
      const i = messages.findIndex(m => m.messageId === e.messageId);
      if (i >= 0) messages[i] = { ...messages[i], text: preview(messages[i].text + String(e.text ?? '')), truncated: messages[i].truncated || messages[i].text.length + String(e.text ?? '').length > 32768 };
      else messages.push({ messageId: e.messageId, role: 'assistant', text: preview(String(e.text ?? '')), truncated: String(e.text ?? '').length > 32768, state: 'streaming' });
    }
    if (e.type === 'messageFinal') { const message: Message = { messageId: e.messageId, role: 'assistant', text: preview(e.text ?? messages.find(m => m.messageId === e.messageId)?.text ?? ''), state: e.stopReason, contentRef: e.contentRef, truncated: !!e.contentRef }; const i = messages.findIndex(m => m.messageId === e.messageId); if (i >= 0) messages[i] = message; else messages.push(message); }
    if (e.type === 'runStarted') status = 'running';
    if (e.type === 'phase') status = e.phase;
    if (e.type === 'interaction') { permission = e.request; status = 'waitingInput'; }
    if (e.type === 'toolState') { const item = { id: e.toolCallId, name: e.name, state: e.state }; const i = tools.findIndex(t => t.id === item.id); if (i >= 0) tools[i] = item; else tools.push(item); }
    if (e.type === 'runSettled') { status = 'finishing'; permission = null; }
  }
  patch(projectId, { messages: messages.slice(-100), tools: tools.slice(-50), status, permission });
}
function flush(projectId: string) { const events = queued.get(projectId); if (events?.length) consume(projectId, events); queued.delete(projectId); const timer = timers.get(projectId); if (timer) clearTimeout(timer); timers.delete(projectId); }
function event(projectId: string, event: TaskEvent<RunResult>) {
  const canonical = (event.payload.data as { payload?: { type?: string; contentRef?: { sessionId: string; messageId: string } } } | undefined)?.payload;
  if (canonical?.type === 'messageFinal' && canonical.contentRef) {
    const ref = canonical.contentRef;
    void (async () => { const page: { text: string; nextCursor: string | null } = await call('agent_message_read', ref, projectId); flush(projectId); patch(projectId, { messages: view(projectId).messages.map(m => m.messageId === ref.messageId ? { ...m, text: preview(page.text), contentRef: ref, truncated: true } : m) }); })().catch(error => patch(projectId, { error: errorMessage(error) }));
  }
 const events = queued.get(projectId) ?? []; events.push(event); queued.set(projectId, events); if (!timers.has(projectId)) timers.set(projectId, setTimeout(() => flush(projectId), 32)); }
export async function sendAgent(projectId: string) {
  const current = view(projectId); if (running(current.status) || !current.draft.trim()) return;
  const draft = current.draft; patch(projectId, { status: 'starting', cancelRequested: false, error: null, tools: [], permission: null });
  try {
    const session = await ensureSession(projectId);
    if (view(projectId).cancelRequested) { patch(projectId, { status: 'cancelled' }); return; }
    const items = current.attachments.map(({ source, fileId, documentId, editorRevision, expectedDiskRevision, text, range, diffId, expectedRepoToken }) => ({ source, fileId, documentId, editorRevision, expectedDiskRevision, text, range, diffId, expectedRepoToken }));
    const snapshot = await call<{ snapshotId: string; manifestDigest: string }>('agent_context_prepare', { sessionId: session.sessionId, items }, projectId);
    if (view(projectId).cancelRequested) { patch(projectId, { status: 'cancelled' }); return; }
    const handle = await start<RunResult>('agent_submit', { sessionId: session.sessionId, text: draft, ...snapshot, submissionId: crypto.randomUUID() }, e => event(projectId, e), projectId);
    if (view(projectId).cancelRequested) await handle.cancel();
    patch(projectId, { task: handle, draft: '', messages: [...view(projectId).messages, { messageId: crypto.randomUUID(), role: 'user', text: draft, state: 'sent' }] });
    const result = await handle.result; flush(projectId);
    patch(projectId, { task: undefined, status: result.state ?? 'handled', reviewId: result.reviewId ?? null, permission: null });
    await loadAgent(projectId); if (!visible.has(projectId)) patch(projectId, { messages: [], tools: [] });
  } catch (error) { flush(projectId); patch(projectId, { status: (error as { code?: string }).code === 'CANCELLED' ? 'cancelled' : 'failed', task: undefined, permission: null, error: (error as { code?: string }).code === 'CANCELLED' ? null : errorMessage(error), draft: view(projectId).draft || draft }); await loadAgent(projectId); }
}
export async function cancelAgent(projectId: string) { const current = view(projectId); patch(projectId, { status: 'stopping', cancelRequested: true }); try { await current.task?.cancel(); if (current.session) await call('agent_cancel', { sessionId: current.session.sessionId, runId: current.task?.requestId }, projectId); } catch (error) { patch(projectId, { error: errorMessage(error) }); } }

export async function answerPermission(projectId: string, decision: 'allowOnce' | 'deny') {
  const request = view(projectId).permission; if (!request) return;
  await call('agent_interaction_answer', { sessionId: request.sessionId, interactionId: request.interactionId, decision, operationDigest: request.permission.operationDigest }, projectId);
  patch(projectId, { permission: null, status: 'running' });
}
