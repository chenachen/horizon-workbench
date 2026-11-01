import React from 'react';
import { createRoot } from 'react-dom/client';
import { GitPanel } from './apps/desktop/src/features/git/GitPanel.tsx';
import './apps/desktop/src/styles.css';

const root = createRoot(document.getElementById('root'));
const snapshot = (id, name, remote) => ({ repoId: 'repo-' + id, generation: 1, repoToken: 'token-' + id + '-1', rootDisplayPath: '/owned/' + id, head: { state: 'branch', name, oid: 'owned-' + id }, upstream: { name: remote + '/' + name, ahead: 0, behind: 0 }, files: [], truncated: false });
const branches = (s, remote) => ({ repoToken: s.repoToken, remotes: [remote], items: [{ name: s.head.name, oid: s.head.oid, current: true, remote: false, upstream: s.upstream.name }, { name: 'gui/no-upstream', oid: s.head.oid, current: false, remote: false, upstream: null }, { name: remote + '/' + s.head.name, oid: s.head.oid, current: false, remote: true }] });
const a = snapshot('A', 'main', 'origin'), b = snapshot('B', 'feature-B', 'remote-B');
const h = window.gitBranchHarness = {
  root, projectId: 'A', world: { A: { snapshot: a, branches: branches(a, 'origin') }, B: { snapshot: b, branches: branches(b, 'remote-B') } },
  calls: [], branchReads: [], snapshots: [], holdBranches: false, subscriptions: 0,
  render(projectId = h.projectId) { h.projectId = projectId; root.render(<GitPanel projectId={projectId} onSnapshot={value => h.snapshots.push(structuredClone(value))} />); },
  switchHead() { const w = h.world.A; w.snapshot = { ...w.snapshot, generation: 2, repoToken: 'token-A-2', head: { state: 'branch', name: 'gui/no-upstream', oid: 'owned-A' }, upstream: null }; w.branches = { ...w.branches, repoToken: w.snapshot.repoToken, items: w.branches.items.map(x => ({ ...x, current: !x.remote && x.name === 'gui/no-upstream' })) }; },
  refsOnly(remotes = ['backup']) { const w = h.world.A; w.branches = { ...w.branches, remotes, items: [...w.branches.items.filter(x => x.name !== 'external-ref'), { name: 'external-ref', oid: 'owned-ref', current: false, remote: false, upstream: null }] }; },
  reply(call, data) { return { ok: true, requestId: call.requestId, data: structuredClone(data) }; },
  resolveBranch(id, ok = true) { const r = h.branchReads.find(x => x.id === id); if (r?.state !== 'pending') throw Error('No pending branch read ' + id); r.state = ok ? 'resolved' : 'rejected'; r.resolve(ok ? h.reply(r.call, r.data) : { ok: false, requestId: r.call.requestId, error: { code: 'IO_ERROR', message: '受控旧分支读取失败', retryable: true } }); },
  invoke(command, { call, channel }) {
    h.calls.push({ command, method: call.method, params: structuredClone(call.params), scope: structuredClone(call.scope) });
    const world = h.world[call.scope.projectId];
    if (command === 'horizon_subscribe') return Promise.resolve(h.reply(call, { subscriptionId: 'owned-sub-' + (++h.subscriptions), snapshots: [] }));
    if (command === 'horizon_start') {
      if (call.method !== 'git_status') throw Error('No Git writes/tasks permitted: ' + call.method);
      const taskId = 'owned-status-' + h.calls.length, data = structuredClone(world.snapshot);
      queueMicrotask(() => channel.onmessage({ protocolVersion: 1, event: 'task', taskId, requestId: call.requestId, scope: call.scope, seq: 1, payload: { type: 'terminal', state: 'succeeded', result: data } }));
      return Promise.resolve(h.reply(call, { taskId, requestId: call.requestId, state: 'queued', cancelMode: 'cooperative' }));
    }
    if (command !== 'horizon_call') throw Error('Unexpected command ' + command);
    switch (call.method) {
      case 'git_status': return Promise.resolve(h.reply(call, world.snapshot));
      case 'git_branches': { const data = structuredClone(world.branches), record = { id: h.branchReads.length + 1, call, data, state: h.holdBranches ? 'pending' : 'resolved' }; h.branchReads.push(record); return h.holdBranches ? new Promise(resolve => { record.resolve = resolve; }) : Promise.resolve(h.reply(call, data)); }
      case 'settings_get': return Promise.resolve(h.reply(call, { effective: { 'git.autoRefresh': true, 'git.autoFetch': false } }));
      case 'session_get': return Promise.resolve(h.reply(call, { commitDraft: '' }));
      case 'stream_ack': case 'subscription_close': return Promise.resolve(h.reply(call, {}));
      default: throw Error('Unexpected product call ' + call.method);
    }
  },
  capture() {
    const modal = document.querySelector('dialog.git-modal[open]'), field = (container, label) => [...(container?.querySelectorAll('label') ?? [])].find(x => x.childNodes[0]?.textContent.trim() === label)?.querySelector('input,select');
    const create = [...(modal?.querySelectorAll('details') ?? [])].find(x => x.querySelector('summary')?.textContent === '新建分支'), compare = [...(modal?.querySelectorAll('details') ?? [])].find(x => x.querySelector('summary')?.textContent === '比较两个引用');
    const remote = field(modal, '远端'), target = field(modal, '目标分支');
    return {
      projectId: h.projectId, snapshot: structuredClone(h.snapshots.at(-1)),
      rows: [...(modal?.querySelectorAll('.git-branch-row') ?? [])].map(x => ({ name: x.querySelector('span')?.firstChild?.textContent, current: x.classList.contains('current'), description: x.querySelector('small')?.textContent })),
      upstreamHint: modal?.querySelector('.git-sync > .git-hint')?.textContent,
      remote: remote?.value, remoteOptions: remote ? [...remote.options].map(x => ({ value: x.value, label: x.textContent })) : [], target: target?.value,
      newBranch: field(create, '新分支名')?.value, startPoint: field(create, '起点')?.value, compareSource: field(compare, '起点')?.value, compareTarget: field(compare, '终点')?.value,
      networkButtons: [...(modal?.querySelectorAll('.git-sync button') ?? [])].map(x => ({ text: x.textContent, disabled: x.disabled })),
      errors: [...document.querySelectorAll('.git-error')].map(x => x.textContent), stale: !!document.querySelector('.git-warning')?.textContent.includes('快照已过期'),
      loading: document.querySelector('.git-refresh-button')?.getAttribute('aria-busy') === 'true',
      calls: structuredClone(h.calls), branchReads: h.branchReads.map(({ id, call, data, state }) => ({ id, projectId: call.scope.projectId, repoId: call.params.repoId, data, state })),
    };
  },
};
h.render();
