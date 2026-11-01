import React from 'react';
import { createRoot } from 'react-dom/client';
import { setProjectEpoch } from './apps/desktop/src/bridge';
import { GitPanel } from './apps/desktop/src/features/git/GitPanel.tsx';
import './apps/desktop/src/styles.css';

const root = createRoot(document.getElementById('root'));
const snapshot = p => ({ repoId: 'repo-' + p, repoToken: 'token-' + p + '-1', generation: 1, rootDisplayPath: '/owned/' + p, head: { state: 'branch', name: 'main-' + p, oid: 'owned-' + p }, upstream: null, files: [{ file: { projectId: p, fileId: 'file-' + p, displayPath: 'tracked.txt' }, index: 'M', worktree: '.', kind: 'ordinary' }], truncated: false });
const h = window.gitWriteHarness = {
  root, projectId: 'A', epochs: {}, world: { A: snapshot('A'), B: snapshot('B') }, nonrepoB: true,
  calls: [], writes: [], reads: [], historyReads: [], snapshots: [], sessions: {}, holdAck: false, holdHistory: false, holdStatus: false,
  render(p = h.projectId) { h.projectId = p; h.epochs[p] = (h.epochs[p] ?? 0) + 1; setProjectEpoch(p, h.epochs[p]); root.render(<GitPanel projectId={p} onSnapshot={value => h.snapshots.push(structuredClone(value))} />); },
  unmount() { root.render(null); },
  reply(call, data) { return { ok: true, requestId: call.requestId, data: structuredClone(data) }; },
  event(record, payload) { record.seq++; record.channel.onmessage({ protocolVersion: 1, event: 'horizon.task.v1', taskId: record.taskId, requestId: record.call.requestId, scope: record.call.scope, seq: record.seq, payload }); },
  ack(id) { const w = h.writes.find(w => w.taskId === id); if (!w?.ackResolve) throw Error('No pending write acknowledgement'); const resolve = w.ackResolve; w.ackResolve = null; w.acked = true; resolve(h.reply(w.call, { taskId: w.taskId, requestId: w.call.requestId, state: 'queued', cancelMode: 'cooperative' })); },
  progress(id, phase = 'Owned hook waiting') { const w = h.writes.find(w => w.taskId === id); h.event(w, { type: 'progress', phase }); },
  finishRead(read) { if (read.done) return; read.done = true; const p = read.call.scope.projectId; if (p === 'B' && h.nonrepoB) h.event(read, { type: 'terminal', state: 'failed', error: { code: 'NOT_FOUND', message: '当前目录不是 Git 仓库', retryable: false } }); else h.event(read, { type: 'terminal', state: 'succeeded', result: read.captured ?? structuredClone(h.world[p]) }); },
  complete(id, mode) {
    const w = h.writes.find(w => w.taskId === id); if (!w || w.terminal) throw Error('No active write'); w.terminal = mode;
    if (mode === 'success') { const old = h.world[w.call.scope.projectId]; const next = { ...old, repoToken: old.repoToken + '-committed', generation: old.generation + 1, files: [] }; h.world[w.call.scope.projectId] = next; h.event(w, { type: 'terminal', state: 'succeeded', result: { snapshot: structuredClone(next), commitOid: 'abcdef1234567890abcdef1234567890abcdef1234' } }); }
    else h.event(w, { type: 'terminal', state: 'failed', error: { code: mode === 'unknown' ? 'OUTCOME_UNKNOWN' : 'IO_ERROR', message: mode === 'unknown' ? '停止已完成；Git 操作可能已生效。请刷新后核对。' : '受控提交失败', retryable: true } });
    queueMicrotask(() => { for (const r of h.reads) if (r.call.scope.projectId === w.call.scope.projectId && !r.manualHold) h.finishRead(r); });
  },
  invoke(command, { call, channel }) {
    h.calls.push({ command, method: call.method, params: structuredClone(call.params), scope: structuredClone(call.scope) }); const p = call.scope.projectId;
    if (command === 'horizon_subscribe') return Promise.resolve(h.reply(call, { subscriptionId: 'owned-sub-' + h.calls.length, snapshots: [] }));
    if (command === 'horizon_start') {
      if (call.method === 'git_status') { const read = { taskId: 'owned-read-' + (h.reads.length + 1), call, channel, seq: 0, done: false, manualHold: h.holdStatus, captured: h.holdStatus ? structuredClone(h.world[p]) : null }; h.reads.push(read); if (!read.manualHold && !h.writes.some(w => w.call.scope.projectId === p && !w.terminal)) queueMicrotask(() => h.finishRead(read)); return Promise.resolve(h.reply(call, { taskId: read.taskId, requestId: call.requestId, state: 'queued', cancelMode: 'cooperative' })); }
      if (call.method !== 'git_mutate') throw Error('Unexpected product task ' + call.method);
      const w = { taskId: 'owned-write-' + (h.writes.length + 1), call, channel, seq: 0, terminal: null, cancelRequested: false, acked: !h.holdAck, ackResolve: null }; h.writes.push(w); queueMicrotask(() => h.progress(w.taskId));
      return h.holdAck ? new Promise(resolve => { w.ackResolve = resolve; }) : Promise.resolve(h.reply(call, { taskId: w.taskId, requestId: call.requestId, state: 'queued', cancelMode: 'cooperative' }));
    }
    if (command !== 'horizon_call') throw Error('Unexpected command ' + command);
    switch (call.method) {
      case 'git_status': return Promise.resolve(h.reply(call, h.world[p]));
      case 'git_branches': return Promise.resolve(h.reply(call, { repoToken: h.world[p].repoToken, remotes: ['origin'], items: [{ name: h.world[p].head.name, oid: h.world[p].head.oid, current: true, remote: false, upstream: null }] }));
      case 'git_history': { const record = { call, resolve: null }; h.historyReads.push(record); return h.holdHistory ? new Promise(resolve => { record.resolve = resolve; }) : Promise.resolve(h.reply(call, { items: [], nextCursor: null, shallow: false })); }
      case 'session_get': return Promise.resolve(h.reply(call, { commitDraft: h.sessions[p] ?? '' }));
      case 'session_update': h.sessions[p] = call.params.commitDraft; return Promise.resolve(h.reply(call, {}));
      case 'settings_get': return Promise.resolve(h.reply(call, { effective: { 'git.autoRefresh': true, 'git.autoFetch': false } }));
      case 'task_cancel': { const w = h.writes.find(w => w.taskId === call.params.taskId); if (!w || w.call.scope.projectId !== p) throw Error('Cancel target not owned by this project'); w.cancelRequested = true; return Promise.resolve(h.reply(call, { taskId: w.taskId, cancelRequested: true, alreadyTerminal: !!w.terminal })); }
      case 'stream_ack': case 'subscription_close': return Promise.resolve(h.reply(call, {}));
      default: throw Error('Unexpected product call ' + call.method);
    }
  },
  capture() {
    return { projectId: h.projectId, epochs: structuredClone(h.epochs), snapshot: structuredClone(h.snapshots.at(-1)), draft: document.querySelector('#git-commit-message')?.value ?? null,
      storageA: sessionStorage.getItem('horizon.git.commitDraft.A'), storageB: sessionStorage.getItem('horizon.git.commitDraft.B'),
      progress: [...document.querySelectorAll('.git-progress')].map(x => x.textContent), buttons: [...document.querySelectorAll('button')].map(x => ({ text: x.textContent, aria: x.getAttribute('aria-label'), disabled: x.disabled })),
      errors: [...document.querySelectorAll('.git-error')].map(x => x.textContent), notice: document.querySelector('.git-notice')?.textContent ?? null,
      writes: h.writes.map(({ taskId, call, terminal, cancelRequested, acked }) => ({ taskId, projectId: call.scope.projectId, terminal, cancelRequested, acked })),
      calls: structuredClone(h.calls), reads: h.reads.map(({ taskId, call, done }) => ({ taskId, projectId: call.scope.projectId, done })), historyReads: h.historyReads.length };
  },
};
h.render();
