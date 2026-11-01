import React from 'react';
import { createRoot } from 'react-dom/client';
import { RecoveryNotice } from './apps/desktop/src/features/editor/RecoveryNotice';
import { editorStore } from './apps/desktop/src/features/editor/store';

const file = { projectId: 'a', fileId: 'file-a', displayPath: 'alpha.txt' };
const revision = { token: 'disk-before', contentHash: 'controlled-disk-hash', byteLength: '12', modifiedAt: '2026-11-01T00:00:00Z' };
const draft = { checkpointId: 'cp-old', documentId: 'cp-old', projectId: 'a', file, fileId: file.fileId, editorRevision: 1, updatedAt: '2026-11-01T00:01:00Z', byteCount: '21', baseDiskRevision: revision, text: 'recovered draft text\n', selection: { anchor: 6, head: 6 }, encoding: 'utf8', eol: 'lf' };
const beta = { checkpointId: 'cp-beta', documentId: 'cp-beta', projectId: 'b', file: { projectId: 'b', fileId: 'file-b', displayPath: 'beta.txt' }, editorRevision: 2, updatedAt: '2026-11-01T00:02:00Z', byteCount: '9' };
const drafts = new Map([['cp-old', draft]]);
const clone = value => structuredClone(value);
const root = createRoot(document.getElementById('root'));
const h = window.recoveryRestoreHarness = {
  calls: [], lists: [], pendingMark: null, pendingCheckpoint: null, pendingCleanup: null, cleanupCompleted: false, projectId: 'a', projectEpoch: 1,
  request(method, params = {}, projectId) {
    h.calls.push({ method, params: clone(params), projectId });
    if (method === 'recovery_list') {
      const items = params.projectId === 'b' ? [beta] : [...drafts.values()];
      return new Promise(resolve => h.lists.push({ projectId: params.projectId, items: clone(items), resolve, settled: false }));
    }
    if (method === 'recovery_read') return Promise.resolve(clone(drafts.get(params.checkpointId)));
    if (method === 'document_open') return Promise.resolve({ mode: 'editor', text: 'disk before\n', simplified: false, meta: { documentId: 'cp-new', file, editorRevision: 0, baseDiskRevision: revision, encoding: 'utf8', eol: 'lf', state: 'clean', readOnly: false } });
    if (method === 'document_disk_read') return Promise.resolve({ text: 'disk before\n' });
    if (method === 'document_mark_dirty') return new Promise(resolve => { h.pendingMark = { params: clone(params), resolve }; });
    if (method === 'document_checkpoint') return new Promise(resolve => { h.pendingCheckpoint = { params: clone(params), resolve }; });
    if (method === 'recovery_resolve') return new Promise(resolve => { h.pendingCleanup = { params: clone(params), resolve }; });
    if (method === 'session_update') return Promise.resolve({});
    throw Error('Unexpected controlled RPC: ' + method);
  },
  releaseList(index) { const request = h.lists[index]; if (!request || request.settled) throw Error('Invalid list response ' + index); request.settled = true; request.resolve({ items: clone(request.items) }); },
  releaseMark() { const pending = h.pendingMark; h.pendingMark = null; pending.resolve({ revision: pending.params.editorRevision }); },
  releaseCheckpoint() {
    const pending = h.pendingCheckpoint; h.pendingCheckpoint = null;
    drafts.set('cp-new', { ...clone(draft), ...clone(pending.params), checkpointId: 'cp-new', documentId: 'cp-new', updatedAt: '2026-11-01T00:03:00Z' });
    pending.resolve({ checkpointId: 'cp-new', editorRevision: pending.params.editorRevision });
  },
  releaseCleanup() { const pending = h.pendingCleanup; h.pendingCleanup = null; drafts.delete(pending.params.checkpointId); h.cleanupCompleted = true; pending.resolve({ resolved: true }); },
  switchProject() { h.projectId = 'b'; h.projectEpoch = 7; editorStore.setProject('b', 7); render(); },
  unmount() { root.unmount(); },
  capture() {
    const buffer = editorStore.getBuffer('a', file.fileId);
    return { projectId: h.projectId, projectEpoch: h.projectEpoch, calls: clone(h.calls), lists: h.lists.map(({ projectId, items, settled }) => ({ projectId, checkpointIds: items.map(item => item.checkpointId), settled })), cleanupCompleted: h.cleanupCompleted, retainedCheckpointIds: [...drafts.keys()], buffer: buffer ? { projectId: buffer.projectId, checkpointId: buffer.checkpointId, checkpointVersion: buffer.checkpointVersion, version: buffer.version, dirty: buffer.dirty, text: buffer.getText(), selection: clone(buffer.selection) } : null, noticeText: document.querySelector('[role=status]')?.textContent ?? '', candidateIds: [...document.querySelectorAll('select[aria-label="选择待恢复草稿"] option')].map(option => option.value), comparisonPresent: !!document.querySelector('[aria-label="恢复草稿与磁盘内容比较"]'), rootHTML: document.getElementById('root').innerHTML };
  },
};
function render() { root.render(<RecoveryNotice projectId={h.projectId} projectEpoch={h.projectEpoch} />); }
editorStore.setProject('a', 1);
render();
