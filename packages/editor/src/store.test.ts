import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorStore } from './store';
import type { DiskRevision, EditorTransport, FileRelocationPlan, OpenDocument } from './types';
import { EditorState, Text, type Transaction } from '@codemirror/state';
import { history, undo } from '@codemirror/commands';

const revision = (token: string, byteLength = '5'): DiskRevision => ({ token, contentHash: token, byteLength, modifiedAt: '2026-10-31T00:00:00Z' });
const opened = (projectId: string, fileId: string, text = 'hello'): OpenDocument => ({ mode: 'editor', meta: { documentId: `doc-${projectId}-${fileId}`, file: { projectId, fileId, displayPath: `${fileId}.ts` }, editorRevision: 0, baseDiskRevision: revision('disk-0'), encoding: 'utf8bom', eol: 'crlf', state: 'clean', readOnly: false }, text, simplified: false });
const relocationPlan = (): FileRelocationPlan => ({ planId: 'plan', digest: 'digest', expiresAt: '2099-01-01', source: { projectId: 'a', fileId: 'one', displayPath: 'one.ts' }, hasBuffer: true, dirty: true, candidate: { fileId: 'relocated', displayPath: 'relocated.ts', mode: 'editor', diskRevision: revision('candidate'), encoding: 'utf8', eol: 'lf', readOnly: false, simplified: false, canKeepBuffer: true, text: 'candidate contents', previewTruncated: false } });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
function fixture(overrides: Record<string, (params: Record<string, unknown>, projectId?: string) => unknown> = {}, limit = 20) {
  const call = vi.fn(async (method: string, params: Record<string, unknown> = {}, projectId?: string): Promise<unknown> => {
    if (overrides[method]) return overrides[method](params, projectId);
    if (method === 'document_open') return opened(projectId!, String(params.fileId));
    if (method === 'document_checkpoint') return { checkpointId: params.documentId, editorRevision: params.editorRevision };
    if (method === 'document_save') return { savedEditorRevision: params.editorRevision, diskRevision: revision('disk-saved'), recoveryCheckpointId: null };
    if (method === 'file_stat') return { revision: revision('disk-0') };
    return {};
  });
  const store = new EditorStore({ call } as EditorTransport, limit);
  store.setProject('a', 1);
  const edit = (fileId: string, text: string, projectId = 'a') => store.edited(projectId, fileId, () => text, { anchor: text.length, head: text.length });
  return { store, call, edit };
}
async function tick() { await vi.advanceTimersByTimeAsync(0); }

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('versioned editor documents', () => {
  it.each(['NOT_FOUND', 'PERMISSION_DENIED'])('keeps a failed %s file in its own retryable tab without replacing another draft', async code => {
    let unavailable = true;
    const { store, call, edit } = fixture({ document_open: (params, projectId) => {
      if (params.fileId === 'missing' && unavailable) throw Object.assign(new Error('cannot read this file'), { code, details: { file: { projectId, fileId: 'missing', displayPath: 'src/missing.ts' } } });
      return opened(projectId!, String(params.fileId));
    } });
    await store.openFile('one'); edit('one', 'keep this unsaved text');
    await store.openFile('missing', { preview: true });
    expect(store.getActive()).toMatchObject({ fileId: 'missing', path: 'src/missing.ts', mode: 'unavailable', dirty: false, accessError: { code } });
    expect(store.getSnapshot().projects.get('a')!.tabs).toEqual(['one', 'missing']);
    expect(store.getBuffer('a', 'one')!.getText()).toBe('keep this unsaved text');
    expect(store.getSnapshot().error).toBeNull();
    unavailable = false; await store.openFile('missing');
    expect(store.getActive()).toMatchObject({ fileId: 'missing', mode: 'editor', loading: false });
    expect(store.getActive()!.accessError).toBeUndefined();
    expect(store.getBuffer('a', 'one')!.dirty).toBe(true);
    expect(call.mock.calls.some(([method]) => method === 'document_save')).toBe(false);
  });

  it('closes an unreadable placeholder without closing or saving the previous document', async () => {
    const { store, call } = fixture({ document_open: (params, projectId) => {
      if (params.fileId === 'missing') throw Object.assign(new Error('missing'), { code: 'NOT_FOUND', details: { file: { projectId, fileId: 'missing', displayPath: 'missing.ts' } } });
      return opened(projectId!, String(params.fileId));
    } });
    await store.openFile('one'); await store.openFile('missing');
    expect(await store.close('missing', 'saved', 'a')).toBe(true);
    expect(store.getActive()!.fileId).toBe('one');
    expect(call.mock.calls.some(([method]) => method === 'document_close' || method === 'document_save')).toBe(false);
  });

  it('relocates a dirty document without replacing its buffer, content, or editor history identity', async () => {
    const plan = relocationPlan(), selected = opened('a', 'relocated', 'retained draft');
    if (selected.mode !== 'editor') throw new Error('fixture');
    selected.meta = { ...selected.meta, documentId: 'doc-a-one', editorRevision: 1, state: 'dirty', baseDiskRevision: revision('candidate') };
    const { store, call, edit } = fixture({ document_relocate_prepare: () => ({ plan }), document_relocate_apply: () => ({ previousFileId: 'one', choice: 'keepBuffer', file: selected.meta.file, opened: selected }) });
    await store.openFile('one'); edit('one', 'retained draft');
    const original = store.getActive()!; original.scrollTop = 725; original.savedContentIdentity = 'old source baseline';
    const rekey = vi.fn(); store.subscribeRekeys(rekey);
    expect(await store.prepareFileRelocation('one', 'a')).toEqual(plan);
    expect(original.checkpointId).toBe('doc-a-one'); expect(original.proposalPending).toBe(true);
    const result = await store.applyFileRelocation(plan, 'keepBuffer');
    expect(result).toBe(original); expect(store.getBuffer('a', 'one')).toBeUndefined();
    expect(store.getActive()).toMatchObject({ fileId: 'relocated', path: 'relocated.ts', dirty: true, scrollTop: 725, proposalPending: false, checkpointId: 'doc-a-one' });
    expect(result.getText()).toBe('retained draft'); expect(result.savedContentIdentity).toBeUndefined();
    expect(result.meta!.baseDiskRevision.token).toBe('candidate');
    expect(rekey).toHaveBeenCalledWith('a\u0000one', original, true);
    expect(store.getSnapshot().projects.get('a')!.tabs).toEqual(['relocated']);
    expect(call.mock.calls.some(([method]) => method === 'document_save')).toBe(false);
  });

  it('keeps the original draft and association when a relocation candidate changes', async () => {
    const plan = relocationPlan();
    const { store, edit } = fixture({ document_relocate_prepare: () => ({ plan }), document_relocate_apply: () => { throw Object.assign(new Error('candidate changed'), { code: 'FILE_CHANGED' }); } });
    await store.openFile('one'); edit('one', 'keep original'); const original = store.getActive()!;
    await store.prepareFileRelocation('one', 'a');
    await expect(store.applyFileRelocation(plan, 'keepBuffer')).rejects.toThrow('candidate changed');
    expect(store.getActive()).toBe(original); expect(original.fileId).toBe('one'); expect(original.getText()).toBe('keep original');
    expect(original.dirty).toBe(true); expect(original.proposalPending).toBe(false);
  });

  it('does not remove a clean document checkpoint identity until native cleanup is acknowledged', async () => {
    const cleanup = deferred<unknown>();
    const { store } = fixture({ document_mark_dirty: params => params.dirty ? {} : cleanup.promise });
    await store.openFile('one'); const buffer = store.getActive()!;
    buffer.savedContentIdentity = 'saved'; buffer.contentEquals = (a, b) => a === b;
    store.edited('a', 'one', () => 'changed', { anchor: 7, head: 7 }, 'changed'); await store.flushDrafts('a');
    const checkpointId = buffer.checkpointId;
    store.edited('a', 'one', () => 'hello', { anchor: 5, head: 5 }, 'saved'); await tick();
    expect(buffer.dirty).toBe(false); expect(buffer.checkpointId).toBe(checkpointId);
    const changed = vi.fn(); store.subscribe(changed);
    cleanup.resolve({}); await tick();
    expect(buffer.checkpointId).toBeUndefined(); expect(buffer.checkpointVersion).toBe(-1); expect(changed).toHaveBeenCalled();
  });

  it('saves the captured revision while newer input remains dirty, and serializes duplicate saves', async () => {
    const saved = deferred<unknown>();
    const { store, call, edit } = fixture({ document_save: () => saved.promise });
    await store.openFile('one'); edit('one', 'first edit');
    const saving = store.saveActive(); expect(store.saveActive()).toBe(saving);
    edit('one', 'first edit + 中文 🧭'); await tick();
    const request = call.mock.calls.find(([method]) => method === 'document_save')![1];
    expect(request).toMatchObject({ editorRevision: 1, text: 'first edit', encoding: 'utf8bom', eol: 'crlf' });
    saved.resolve({ savedEditorRevision: 1, diskRevision: revision('disk-1'), recoveryCheckpointId: null });
    expect(await saving).toBe(false);
    expect(store.getActive()).toMatchObject({ dirty: true, version: 2, savedVersion: 1, checkpointVersion: 2 });
    expect(store.getActive()!.getText()).toBe('first edit + 中文 🧭');
    expect(store.getActive()!.meta!.baseDiskRevision.token).toBe('disk-1');
    expect(call.mock.calls.filter(([method]) => method === 'document_save')).toHaveLength(1);
  });

  it('keeps late project A reads and saves scoped to A while B is active', async () => {
    const read = deferred<OpenDocument>();
    const { store, call, edit } = fixture({ document_open: (params, project) => project === 'a' ? read.promise : opened(project!, String(params.fileId)) });
    const pending = store.openFile('a-file'); store.setProject('b', 2); await store.openFile('b-file');
    read.resolve(opened('a', 'a-file')); await pending;
    expect(store.getSnapshot().activeProjectId).toBe('b'); expect(store.getActive()!.fileId).toBe('b-file');
    edit('a-file', 'A draft', 'a'); await store.save('a-file', 'a');
    expect(call.mock.calls.find(([method]) => method === 'document_save')![2]).toBe('a');
    expect(store.getActive()!.getText()).toBe('hello');
  });

  it('drops a late document response after host stop without replacing B content or error', async () => {
    const read = deferred<OpenDocument>();
    const { store } = fixture({ document_open: (params, projectId) => projectId === 'a' ? read.promise : opened(projectId!, String(params.fileId)) });
    const pending = store.openFile('late');
    store.hostClosedProject('a'); store.setProject('b', 1); await store.openFile('current'); store.reportError(new Error('B current error'));
    read.resolve(opened('a', 'late', 'old response'));
    expect(await pending).toBeUndefined();
    expect(store.getBuffer('a', 'late')).toBeUndefined();
    expect(store.getSnapshot().projects.get('a')?.tabs).toEqual([]);
    expect(store.getActive()).toMatchObject({ projectId: 'b', fileId: 'current' });
    expect(store.getSnapshot().error).toBe('B current error');
  });

  it.each([false, true])('keeps a late A read failure out of B error state (host stopped: %s)', async stop => {
    const read = deferred<OpenDocument>();
    const { store } = fixture({ document_open: (params, projectId) => projectId === 'a' ? read.promise : opened(projectId!, String(params.fileId)) });
    const pending = store.openFile('late'); if (stop) store.hostClosedProject('a');
    store.setProject('b', 1); await store.openFile('current');
    read.reject(Object.assign(new Error('A scope expired'), { code: 'STALE_SCOPE' })); await pending;
    expect(store.getSnapshot().error).toBeNull(); expect(store.getActive()?.fileId).toBe('current');
  });

  it('starts a new epoch read independently and keeps it deduplicated after the old read settles', async () => {
    const oldRead = deferred<OpenDocument>(), newRead = deferred<OpenDocument>(); let reads = 0;
    const { store, call } = fixture({ document_open: () => ++reads === 1 ? oldRead.promise : newRead.promise });
    const oldTicket = store.captureRestoreTicket('a', 1)!;
    const oldOpen = store.openFile('one'); store.setProject('a', 2);
    expect(store.captureRestoreTicket('a', 1)).toBeUndefined();
    expect(store.captureRestoreTicket('a', 2)?.generation).not.toBe(oldTicket.generation);
    const newOpen = store.openFile('one'); oldRead.resolve(opened('a', 'one', 'old epoch'));
    expect(await oldOpen).toBeUndefined(); expect(store.getBuffer('a', 'one')).toBeUndefined();
    const duplicate = store.openFile('one');
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(2);
    newRead.resolve(opened('a', 'one', 'new epoch')); await Promise.all([newOpen, duplicate]);
    expect(store.getActive()?.getText()).toBe('new epoch');
  });

  it('rejects a pre-stop restore ticket and lets a fresh same-epoch activation reopen the retained tab', async () => {
    const { store, call } = fixture(); await store.openFile('one'); await store.flushDrafts('a');
    const oldTicket = store.captureRestoreTicket('a', 1)!; store.hostClosedProject('a');
    store.setProject('a', 1); call.mockClear();
    await store.restoreProjectSession('a', oldTicket);
    expect(await store.openFile('one')).toBeUndefined();
    expect(store.getActive()?.evicted).toBe(true);
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(0);
    const newTicket = store.captureRestoreTicket('a', 1)!;
    expect(newTicket.generation).not.toBe(oldTicket.generation);
    await store.restoreProjectSession('a', newTicket);
    expect(store.getActive()?.evicted).not.toBe(true);
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(1);
  });

  it('keeps the rebound preview buffer and tab when its pre-sleep document close replies late', async () => {
    const closing = deferred<unknown>(); let opens = 0;
    const { store, call } = fixture({
      document_open: (params, projectId) => { const result = opened(projectId!, String(params.fileId), `read-${++opens}`); if (result.mode === 'editor') result.meta.documentId = `handle-${opens}`; return result; },
      document_close: () => closing.promise,
    });
    await store.openFile('one', { preview: true }); await store.flushDrafts('a');
    const oldBuffer = store.getActive(); const replacing = store.openFile('two', { preview: true }); await tick();
    expect(call.mock.calls.filter(([method]) => method === 'document_close')).toHaveLength(1);
    store.hostClosedProject('a');
    await store.restoreProjectSession('a', store.captureRestoreTicket('a', 1));
    const rebound = store.getActive()!;
    expect(rebound).not.toBe(oldBuffer); expect(rebound.meta?.documentId).toBe('handle-3');
    closing.resolve({}); expect(await replacing).toBeUndefined();
    expect(store.getActive()).toBe(rebound); expect(store.getBuffer('a', 'two')).toBeUndefined();
    expect(store.getSnapshot().projects.get('a')?.tabs).toEqual(['one']);
    expect(rebound.getText()).toBe('read-3'); expect(store.getSnapshot().error).toBeNull();
  });

  it('abandons an interrupted session restore and retries its whole tab list with a fresh activation', async () => {
    const firstRead = deferred<OpenDocument>(); let first = true;
    const { store, call } = fixture({ document_open: (params, projectId) => { if (first) { first = false; return firstRead.promise; } return opened(projectId!, String(params.fileId)); } });
    store.setProject('a', 1, { schemaVersion: 1, revision: 1, tabs: ['one', 'two'].map(fileId => ({ fileId, pinned: true, selection: { anchor: 1, head: 1 }, scrollTop: 10 })), activeFileId: 'two', expandedEntryIds: [], searchDraft: '' });
    const restore = store.restoreProjectSession('a', store.captureRestoreTicket('a', 1));
    store.hostClosedProject('a'); firstRead.resolve(opened('a', 'one')); await restore;
    expect(store.getSnapshot().projects.get('a')?.restored).toBe(false);
    expect(store.getBuffer('a', 'one')).toBeUndefined();
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(1);
    await store.restoreProjectSession('a', store.captureRestoreTicket('a', 1));
    expect(store.getSnapshot().projects.get('a')?.tabs).toEqual(['one', 'two']);
    expect(store.getSnapshot().projects.get('a')?.restored).toBe(true);
    expect(store.getActive()?.fileId).toBe('two');
  });

  it('does not let an old restore clear the new restore session-write barrier', async () => {
    const oldRead = deferred<OpenDocument>(), newRead = deferred<OpenDocument>(); let reads = 0;
    const { store, call } = fixture({ document_open: () => ++reads === 1 ? oldRead.promise : newRead.promise });
    store.setProject('a', 1, { schemaVersion: 1, revision: 1, tabs: [{ fileId: 'one', pinned: true, selection: { anchor: 1, head: 1 }, scrollTop: 10 }], activeFileId: 'one', expandedEntryIds: [], searchDraft: '' });
    const oldRestore = store.restoreProjectSession('a', store.captureRestoreTicket('a', 1));
    store.hostClosedProject('a'); store.setProject('a', 2);
    const newRestore = store.restoreProjectSession('a', store.captureRestoreTicket('a', 2));
    oldRead.resolve(opened('a', 'one', 'old')); await oldRestore; await store.flushSessions('a');
    expect(call.mock.calls.filter(([method]) => method === 'session_update')).toHaveLength(0);
    newRead.resolve(opened('a', 'one', 'new')); await newRestore; await store.flushSessions('a');
    expect(store.getActive()?.getText()).toBe('new');
    expect(call.mock.calls.filter(([method]) => method === 'session_update')).toHaveLength(1);
  });

  it.each(['recovery_read', 'document_mark_dirty', 'document_checkpoint', 'recovery_resolve'])('stops retained draft reopening after host stop during %s', async blockedMethod => {
    const blocked = deferred<unknown>(); let reopening = false;
    const draft = { checkpointId: 'retained', projectId: 'a', fileId: 'one', editorRevision: 3, baseDiskRevision: revision('disk-0'), text: 'retained draft', selection: { anchor: 2, head: 2 } };
    const resultFor = (method: string, params: Record<string, unknown>) => method === 'recovery_read' ? draft : method === 'document_checkpoint' ? { checkpointId: reopening ? 'replacement' : 'retained', editorRevision: params.editorRevision } : {};
    const overrides = Object.fromEntries(['recovery_read', 'document_mark_dirty', 'document_checkpoint', 'recovery_resolve'].map(method => [method, (params: Record<string, unknown>) => reopening && method === blockedMethod ? blocked.promise : resultFor(method, params)]));
    const { store, edit, call } = fixture(overrides);
    await store.openFile('one'); edit('one', 'retained draft'); await store.flushDrafts('a'); store.hostClosedProject('a');
    reopening = true; call.mockClear(); const restore = store.restoreProjectSession('a', store.captureRestoreTicket('a', 1)); await tick();
    expect(call.mock.calls.some(([method]) => method === blockedMethod)).toBe(true);
    store.hostClosedProject('a'); store.setProject('b', 1); await store.openFile('current');
    blocked.resolve(resultFor(blockedMethod, { editorRevision: 3 })); await restore;
    expect(store.getBuffer('a', 'one')).toMatchObject({ evicted: true, recoveryPending: true, meta: undefined, checkpointId: 'retained' });
    expect(store.getActive()?.fileId).toBe('current'); expect(store.getSnapshot().error).toBeNull();
    if (blockedMethod === 'recovery_read') expect(call.mock.calls.filter(([method, , projectId]) => method === 'document_open' && projectId === 'a')).toHaveLength(0);
    if (blockedMethod !== 'recovery_resolve') expect(call.mock.calls.filter(([method]) => method === 'recovery_resolve')).toHaveLength(0);
  });

  it('retains content and refuses close after a disk-version conflict', async () => {
    const { store, edit, call } = fixture({ document_save: () => { throw Object.assign(new Error('磁盘文件已变化'), { code: 'FILE_CHANGED' }); } });
    await store.openFile('one'); edit('one', 'unsaved');
    expect(await store.close('one', 'saved', 'a')).toBe(false);
    expect(store.getActive()).toMatchObject({ dirty: true, conflict: true });
    expect(store.getActive()!.getText()).toBe('unsaved');
    expect(call.mock.calls.some(([method]) => method === 'document_close')).toBe(false);
  });

  it('cannot save a partially loaded 50 MiB file and keeps only the current chunk', async () => {
    const { store, call } = fixture({ document_open: () => ({ mode: 'chunked', file: { projectId: 'a', fileId: 'large', displayPath: 'large.log' }, revision: revision('large', '52428800'), cursor: 'cursor-0' }), file_read_chunk: params => ({ text: params.cursor === 'cursor-0' ? 'chunk 1' : 'chunk 2', byteStart: params.cursor === 'cursor-0' ? '0' : '262144', byteEnd: params.cursor === 'cursor-0' ? '262144' : '524288', nextCursor: params.cursor === 'cursor-0' ? 'cursor-1' : null, revision: revision('large', '52428800') }) });
    await store.openFile('large'); await store.loadChunk('large'); await store.loadChunk('large');
    expect(store.getActive()!.getText()).toBe('chunk 2');
    expect(store.getActive()).toMatchObject({ byteStart: '262144', byteEnd: '524288', cursor: null });
    expect(await store.saveActive()).toBe(false);
    expect(call.mock.calls.some(([method]) => method === 'document_save')).toBe(false);
  });

  it.each(['chunked', 'unsupported'] as const)('reopens a sleeping %s tab, reports a missing path, and retries with a fresh reader', async mode => {
    let missing = false, opens = 0;
    const { store, call } = fixture({
      document_open: (params, projectId) => {
        if (params.fileId === 'other') return opened(projectId!, 'other');
        opens++;
        if (missing) throw Object.assign(new Error('file was moved while asleep'), { code: 'NOT_FOUND' });
        const file = { projectId: 'a', fileId: 'readonly', displayPath: 'readonly.dat' };
        return mode === 'chunked' ? { mode, file, revision: revision('large', '105906176'), cursor: `reader-${opens}` } : { mode, file, reason: 'binary' };
      },
      file_read_chunk: params => ({ text: `contents from ${params.cursor}`, byteStart: '0', byteEnd: '262144', nextCursor: `${params.cursor}-next`, revision: revision('large', '105906176') }),
    });
    await store.openFile('other'); await store.openFile('readonly');
    if (mode === 'chunked') await store.loadChunk('readonly');
    const old = store.getActive()!; await store.flushSessions('a'); store.hostClosedProject('a');
    expect(old.evicted).toBe(true); expect(old.cursor).toBeUndefined();
    expect(old.byteStart).toBeUndefined(); expect(old.byteEnd).toBeUndefined();
    const readsBeforeWake = call.mock.calls.filter(([method]) => method === 'file_read_chunk').length;
    await store.loadChunk('readonly');
    expect(call.mock.calls.filter(([method]) => method === 'file_read_chunk')).toHaveLength(readsBeforeWake);

    missing = true; store.setProject('a', 2); await store.restoreProjectSession('a');
    expect(store.getActive()).toMatchObject({ fileId: 'readonly', evicted: true, accessError: { code: 'NOT_FOUND' }, loading: false });
    expect(store.getActive()!.cursor).toBeUndefined();
    store.activate('other', 'a'); await tick();
    expect(store.getActive()).toMatchObject({ fileId: 'other', mode: 'editor' });
    missing = false; expect(await store.retryFileAccess('readonly', 'a')).toBe(true);
    const fresh = store.getActive()!;
    expect(fresh).not.toBe(old); expect(fresh.mode).toBe(mode); expect(fresh.evicted).not.toBe(true); expect(fresh.accessError).toBeUndefined();
    if (mode === 'chunked') { expect(fresh.cursor).toBe('reader-3'); await store.loadChunk('readonly'); expect(fresh.getText()).toBe('contents from reader-3'); }
    expect(opens).toBe(3);
  });

  it('does not restore an old chunk cursor or text when a read finishes after host sleep', async () => {
    const pending = deferred<unknown>();
    const { store } = fixture({
      document_open: () => ({ mode: 'chunked', file: { projectId: 'a', fileId: 'large', displayPath: 'large.log' }, revision: revision('large', '105906176'), cursor: 'old-reader' }),
      file_read_chunk: () => pending.promise,
    });
    await store.openFile('large'); const old = store.getActive()!;
    const reading = store.loadChunk('large'); expect(old.loading).toBe(true);
    store.hostClosedProject('a');
    expect(old.loading).toBe(false); expect(old.cursor).toBeUndefined();
    pending.resolve({ text: 'obsolete chunk', byteStart: '0', byteEnd: '262144', nextCursor: 'obsolete-next', revision: revision('old') }); await reading;
    expect(old.getText()).toBe(''); expect(old.cursor).toBeUndefined(); expect(old.byteStart).toBeUndefined(); expect(old.evicted).toBe(true);
  });

  it('turns an expired chunk cursor into a retryable file access error and reopens from a new cursor', async () => {
    let opens = 0;
    const { store, call } = fixture({
      document_open: () => ({ mode: 'chunked', file: { projectId: 'a', fileId: 'large', displayPath: 'large.log' }, revision: revision('large', '105906176'), cursor: `reader-${++opens}` }),
      file_read_chunk: params => {
        if (params.cursor === 'reader-1') throw Object.assign(new Error('读取位置已失效'), { code: 'STALE_CURSOR' });
        return { text: 'fresh first chunk', byteStart: '0', byteEnd: '262144', nextCursor: 'reader-2-next', revision: revision('large', '105906176') };
      },
    });
    await store.openFile('large'); await store.loadChunk('large');
    expect(store.getActive()).toMatchObject({ evicted: true, accessError: { code: 'STALE_CURSOR' }, loading: false });
    expect(store.getActive()!.cursor).toBeUndefined();
    await store.loadChunk('large'); expect(call.mock.calls.filter(([method]) => method === 'file_read_chunk')).toHaveLength(1);
    expect(await store.retryFileAccess('large', 'a')).toBe(true); await store.loadChunk('large');
    expect(store.getActive()!.getText()).toBe('fresh first chunk'); expect(store.getActive()!.accessError).toBeUndefined();
    expect(store.getActive()).toMatchObject({ byteStart: '0', byteEnd: '262144', cursor: 'reader-2-next', loading: false });
  });

  it('blocks release when recovery persistence fails', async () => {
    const { store, edit } = fixture({ document_checkpoint: () => { throw new Error('磁盘已满'); } });
    await store.openFile('one'); edit('one', 'only copy');
    await expect(store.disposeProject('a')).rejects.toThrow('磁盘已满');
    expect(store.getActive()!.getText()).toBe('only copy'); expect(store.getActive()!.checkpointError).toBe('磁盘已满');
  });

  it('writes a recovery checkpoint at 2 seconds idle and within 10 seconds of continuous edits', async () => {
    const { store, call, edit } = fixture(); await store.openFile('one');
    edit('one', '1'); await vi.advanceTimersByTimeAsync(1999);
    expect(call.mock.calls.some(([method]) => method === 'document_checkpoint')).toBe(false);
    await vi.advanceTimersByTimeAsync(1); expect(store.getActive()!.checkpointVersion).toBe(1);
    for (let n = 2; n < 13; n++) { edit('one', String(n)); await vi.advanceTimersByTimeAsync(950); }
    expect(call.mock.calls.filter(([method]) => method === 'document_checkpoint').length).toBeGreaterThanOrEqual(2);
  });

  it('restores a draft as dirty and compares its disk baseline without writing the file', async () => {
    const { store, call } = fixture({ recovery_read: () => ({ checkpointId: 'cp-old', documentId: 'old', projectId: 'a', file: { projectId: 'a', fileId: 'one', displayPath: 'one.ts' }, editorRevision: 4, baseDiskRevision: revision('old-disk'), text: 'recovered draft', selection: { anchor: 2, head: 5 }, encoding: 'utf8bom', eol: 'crlf' }) });
    await store.restoreDraft('cp-old', 'a');
    expect(store.getActive()).toMatchObject({ dirty: true, conflict: true, selection: { anchor: 2, head: 5 }, checkpointVersion: 4 });
    expect(store.getActive()!.getText()).toBe('recovered draft');
    expect(call.mock.calls.some(([method]) => method === 'document_save')).toBe(false);
    expect(call.mock.calls.find(([method]) => method === 'document_open')?.[1]).toMatchObject({ fileId: 'one' });
    expect(call.mock.calls.find(([method]) => method === 'recovery_resolve')?.[1]).toMatchObject({ checkpointId: 'cp-old', replacementDocumentId: 'doc-a-one' });
  });

  it('rejects recovery over existing edits and leaves both the live buffer and durable draft intact', async () => {
    const { store, call, edit } = fixture({ recovery_read: () => ({ checkpointId: 'cp-old', projectId: 'a', file: { projectId: 'a', fileId: 'one', displayPath: 'one.ts' }, editorRevision: 4, baseDiskRevision: revision('disk-0'), text: 'older draft', selection: { anchor: 0, head: 0 } }) });
    await store.openFile('one'); edit('one', 'current unsaved text');
    await expect(store.restoreDraft('cp-old', 'a')).rejects.toThrow('当前文件有未保存编辑');
    expect(store.getActive()!.getText()).toBe('current unsaved text');
    expect(call.mock.calls.some(([method]) => method === 'recovery_resolve' || method === 'document_save')).toBe(false);
  });

  it('rejects a recovery draft from another project before opening a file', async () => {
    const { store, call } = fixture({ recovery_read: () => ({ checkpointId: 'cp-other', projectId: 'b', file: { projectId: 'b', fileId: 'one', displayPath: 'one.ts' }, text: 'other project' }) });
    await expect(store.restoreDraft('cp-other', 'a')).rejects.toThrow('恢复草稿属于其他项目');
    expect(call.mock.calls.some(([method]) => method === 'document_open')).toBe(false);
  });

  it('bounds clean document text while preserving dirty buffers and tab metadata', async () => {
    const { store, edit } = fixture({}, 2); await store.openFile('dirty'); edit('dirty', 'do not evict');
    await store.openFile('one'); await store.openFile('two'); await store.openFile('three');
    expect(store.getBuffer('a', 'one')!.evicted).toBe(true);
    expect(store.getBuffer('a', 'dirty')!.getText()).toBe('do not evict');
    expect(store.getSnapshot().projects.get('a')!.tabs).toHaveLength(4);
    await store.openFile('one'); expect(store.getActive()!.getText()).toBe('hello'); expect(store.getActive()!.evicted).not.toBe(true);
  });

  it('retains input typed while an external clean-file reload is in flight', async () => {
    const reloaded = deferred<OpenDocument>();
    const { store, edit } = fixture({ document_reload: () => reloaded.promise });
    await store.openFile('one'); const reload = store.reload('one', false, 'a'); await tick();
    edit('one', 'typed during reload'); reloaded.resolve(opened('a', 'one', 'external contents')); await reload;
    expect(store.getActive()!.getText()).toBe('typed during reload'); expect(store.getActive()).toMatchObject({ dirty: true, conflict: true });
  });

  it('does not replace a dirty preview tab and blocks IME half-input saves', async () => {
    const { store, edit, call } = fixture(); await store.openFile('one', { preview: true }); edit('one', '中文');
    await store.openFile('two', { preview: true }); expect(store.getSnapshot().projects.get('a')!.tabs).toEqual(['one', 'two']);
    const buffer = store.getBuffer('a', 'one')!; buffer.composing = true;
    expect(await store.save('one', 'a')).toBe(false); expect(call.mock.calls.some(([method]) => method === 'document_save')).toBe(false);
  });

  it('rebinds retained recovery drafts after the host has released old document handles', async () => {
    let documentNumber = 0;
    const drafts = new Map<string, Record<string, unknown>>();
    const { store, edit, call } = fixture({
      document_open: (params, projectId) => { const value = opened(projectId!, String(params.fileId)); if (value.mode === 'editor') value.meta.documentId = `document-${++documentNumber}`; return value; },
      document_checkpoint: params => { const checkpointId = String(params.documentId); drafts.set(checkpointId, { ...params, checkpointId, fileId: 'one', projectId: 'a', encoding: 'utf8bom', eol: 'crlf' }); return { checkpointId, editorRevision: params.editorRevision }; },
      recovery_read: params => drafts.get(String(params.checkpointId)),
      recovery_resolve: params => { drafts.delete(String(params.checkpointId)); return { resolved: true }; },
    });
    await store.openFile('one'); edit('one', 'retained after disable'); await store.flushDrafts('a');
    store.hostClosedProject('a', 'retainCheckpoint');
    expect(store.getActive()).toMatchObject({ evicted: true, recoveryPending: true, dirty: false, meta: undefined });
    expect(store.getActive()!.getText()).toBe('');
    await store.restoreProjectSession('a');
    expect(store.getActive()!.meta!.documentId).toBe('document-2');
    expect(store.getActive()!.getText()).toBe('retained after disable');
    expect(store.getActive()!.dirty).toBe(true); expect(drafts.has('document-1')).toBe(false); expect(drafts.has('document-2')).toBe(true);
    expect(call.mock.calls.filter(([method]) => method === 'document_close')).toHaveLength(0);
  });

  it('does not finish a recovery flush at an older revision when typing continues during the write', async () => {
    const first = deferred<unknown>(); let checkpointCalls = 0;
    const { store, edit } = fixture({ document_checkpoint: params => ++checkpointCalls === 1 ? first.promise : { checkpointId: params.documentId, editorRevision: params.editorRevision } });
    await store.openFile('one'); edit('one', 'version 1'); const flushing = store.flushDrafts('a'); await tick();
    edit('one', 'version 2'); first.resolve({ checkpointId: 'doc-a-one', editorRevision: 1 }); await flushing;
    expect(store.getActive()!.checkpointVersion).toBe(2); expect(checkpointCalls).toBe(2);
  });

  it('records dormant project sessions without opening documents until explicit editor activation', async () => {
    const { store, call } = fixture();
    store.setProject('b', 3, { schemaVersion: 1, revision: 2, tabs: [{ fileId: 'restored', pinned: true, selection: { anchor: 1, head: 3 }, scrollTop: 120 }], activeFileId: 'restored', expandedEntryIds: ['dir'], searchDraft: 'needle' });
    await tick(); expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(0);
    await store.restoreProjectSession('b');
    expect(store.getActive()).toMatchObject({ projectId: 'b', fileId: 'restored', selection: { anchor: 1, head: 3 }, scrollTop: 120 });
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(1);
  });

  it('opens the shorter CRLF disk file after restart with a selection saved at the end of a longer unsaved draft', async () => {
    const disk = '第一行\r\n第二行\r\n第三行\r\n';
    const draft = `${disk}未保存：跨项目保留`;
    const cursor = EditorState.create({ doc: draft }).doc.length;
    const { store } = fixture({ document_open: (params, projectId) => opened(projectId!, String(params.fileId), disk) });
    store.setProject('b', 4, { schemaVersion: 1, revision: 3, tabs: [{ fileId: 'crlf', pinned: true, selection: { anchor: cursor, head: cursor }, scrollTop: 0 }], activeFileId: 'crlf', expandedEntryIds: [], searchDraft: '' });
    await store.restoreProjectSession('b');
    const buffer = store.getActive()!;
    const state = EditorState.create({ doc: buffer.getText(), selection: buffer.selection });
    expect(buffer.meta!.encoding).toBe('utf8bom');
    expect(state.doc.toString()).toBe('第一行\n第二行\n第三行\n');
    expect(state.selection.main.head).toBe(state.doc.length);
    expect(buffer.dirty).toBe(false);
  });

  it('clamps recovered CRLF selections before creating an editor and writing the new checkpoint', async () => {
    const text = '恢复一行\r\n中文 🧭\r\n';
    const { store, call } = fixture({ recovery_read: () => ({ checkpointId: 'old', projectId: 'a', fileId: 'one', editorRevision: 7, baseDiskRevision: revision('disk-0'), text, selection: { anchor: -5, head: text.length } }) });
    await store.restoreDraft('old', 'a');
    const buffer = store.getActive()!;
    const state = EditorState.create({ doc: buffer.getText(), selection: buffer.selection });
    expect(state.selection.main.anchor).toBe(0);
    expect(state.selection.main.head).toBe(state.doc.length);
    expect(call.mock.calls.find(([method]) => method === 'document_checkpoint')?.[1]?.selection).toEqual({ anchor: 0, head: state.doc.length });
  });

  it('clamps the saved selection when an external reload shortens the disk document', async () => {
    const { store } = fixture({ document_reload: () => opened('a', 'one', '一\r\n') });
    await store.openFile('one'); store.position('a', 'one', { anchor: 5, head: 5 });
    await store.reload('one', false, 'a');
    const buffer = store.getActive()!;
    const state = EditorState.create({ doc: buffer.getText(), selection: buffer.selection });
    expect(state.selection.main.head).toBe(2);
  });

  it('clamps retained recovery selections after document handles are rebound', async () => {
    let draft: Record<string, unknown> = {};
    const { store, edit } = fixture({
      document_checkpoint: params => { draft = { ...params, checkpointId: params.documentId, projectId: 'a', fileId: 'one' }; return { checkpointId: params.documentId, editorRevision: params.editorRevision }; },
      recovery_read: () => ({ ...draft, text: '一\r\n', selection: { anchor: 90, head: 90 } }),
    });
    await store.openFile('one'); edit('one', 'a retained draft'); await store.flushDrafts('a');
    store.hostClosedProject('a', 'retainCheckpoint'); await store.restoreProjectSession('a');
    const buffer = store.getActive()!;
    const state = EditorState.create({ doc: buffer.getText(), selection: buffer.selection });
    expect(state.selection.main.head).toBe(2); expect(buffer.dirty).toBe(true);
  });

  it('cancels sleeping project session timers and can flush exit or removal without using its stale scope', async () => {
    const sleeping = new Set<string>();
    const { store, call } = fixture({ session_update: (_params, projectId) => {
      if (sleeping.has(projectId!)) throw Object.assign(new Error('项目 epoch 已失效'), { code: 'STALE_SCOPE' });
      return {};
    } });
    await store.openFile('one'); await store.flushDrafts('a');
    store.setSearchDraft('a', 'pending session update');
    store.hostClosedProject('a'); sleeping.add('a'); call.mockClear();
    store.setProject('b', 1); await store.openFile('other');
    await vi.advanceTimersByTimeAsync(1000);
    await expect(store.flushDrafts()).resolves.toBeUndefined();
    await expect(store.flushDrafts('a')).resolves.toBeUndefined();
    expect(call.mock.calls.filter(([method, , projectId]) => method === 'session_update' && projectId === 'a')).toHaveLength(0);
    expect(call.mock.calls.some(([method, , projectId]) => method === 'session_update' && projectId === 'b')).toBe(true);
    expect(store.getSnapshot().error).toBeNull();
  });

  it('reattaches a sleeping restored session, retains a draft across duplicate close notifications, and saves using the new handle', async () => {
    let sleeping = false, documentNumber = 0, currentDocument = '';
    const drafts = new Map<string, Record<string, unknown>>();
    const { store, call, edit } = fixture({
      document_open: (params, projectId) => {
        if (sleeping) throw Object.assign(new Error('旧项目 scope'), { code: 'STALE_SCOPE' });
        const result = opened(projectId!, String(params.fileId));
        if (result.mode === 'editor') result.meta.documentId = currentDocument = `awake-${++documentNumber}`;
        return result;
      },
      document_checkpoint: params => { drafts.set(String(params.documentId), { ...params, checkpointId: params.documentId, projectId: 'a', fileId: 'one' }); return { checkpointId: params.documentId, editorRevision: params.editorRevision }; },
      recovery_read: params => drafts.get(String(params.checkpointId)),
      recovery_resolve: params => { drafts.delete(String(params.checkpointId)); return {}; },
      session_update: () => { if (sleeping) throw Object.assign(new Error('旧项目 scope'), { code: 'STALE_SCOPE' }); return {}; },
      document_save: params => {
        if (params.documentId !== currentDocument) throw new Error('旧文档句柄');
        return { savedEditorRevision: params.editorRevision, diskRevision: revision('saved-after-wake'), recoveryCheckpointId: null };
      },
    });
    const session = { schemaVersion: 1 as const, revision: 1, tabs: [{ fileId: 'one', pinned: true, selection: { anchor: 0, head: 0 }, scrollTop: 0 }], activeFileId: 'one', expandedEntryIds: [], searchDraft: '' };
    store.setProject('a', 1, session); await store.restoreProjectSession('a');
    edit('one', '休眠前未保存'); await store.flushDrafts('a');
    store.hostClosedProject('a'); store.hostClosedProject('a'); sleeping = true;
    await expect(store.flushDrafts()).resolves.toBeUndefined();
    expect(store.getActive()).toMatchObject({ recoveryPending: true, checkpointId: 'awake-1' });
    sleeping = false; store.setProject('a', 2, session); await store.restoreProjectSession('a');
    expect(store.getSnapshot().projects.get('a')?.epoch).toBe(2);
    expect(store.getActive()!.meta!.documentId).toBe('awake-2');
    expect(store.getActive()!.getText()).toBe('休眠前未保存');
    edit('one', '唤醒后继续编辑'); expect(await store.saveActive()).toBe(true);
    await store.flushDrafts();
    expect(call.mock.calls.find(([method]) => method === 'document_save')?.[1]).toMatchObject({ documentId: 'awake-2', text: '唤醒后继续编辑' });
    expect(drafts.has('awake-1')).toBe(false);
  });

  it('reattaches editor plugin activation even when the project session has already restored', async () => {
    const { store, call } = fixture();
    store.setProject('a', 1, { schemaVersion: 1, revision: 1, tabs: [{ fileId: 'one', pinned: true, selection: { anchor: 2, head: 2 }, scrollTop: 20 }], activeFileId: 'one', expandedEntryIds: [], searchDraft: '' });
    await store.restoreProjectSession('a'); await store.flushDrafts('a');
    store.hostClosedProject('a'); call.mockClear();
    await store.restoreProjectSession('a'); await store.flushDrafts('a');
    expect(store.getActive()).toMatchObject({ selection: { anchor: 2, head: 2 }, scrollTop: 20 });
    expect(store.getActive()!.evicted).not.toBe(true);
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(1);
    expect(call.mock.calls.some(([method]) => method === 'session_update')).toBe(true);
  });

  it('drops a queued session write when its project detaches before the earlier write finishes', async () => {
    const pending = deferred<unknown>();
    const { store, call } = fixture({ session_update: () => pending.promise });
    const first = store.flushSessions('a'); await tick();
    const queued = store.flushSessions('a'); store.hostClosedProject('a');
    pending.resolve({}); await Promise.all([first, queued]);
    expect(call.mock.calls.filter(([method]) => method === 'session_update')).toHaveLength(1);
  });

  it('ignores the mounted workbench auto-open after host sleep until explicit editor activation reattaches it', async () => {
    let sleeping = false;
    const { store, call } = fixture({ document_open: (params, projectId) => {
      if (sleeping && projectId === 'a') throw Object.assign(new Error('项目上下文已过期'), { code: 'STALE_SCOPE' });
      return opened(projectId!, String(params.fileId));
    } });
    await store.openFile('one'); await store.flushDrafts('a');
    store.hostClosedProject('a'); sleeping = true; call.mockClear();
    // EditorWorkbench may still be mounted while the host awaits project-list refresh.
    expect(await store.openFile('one', { projectId: 'a' })).toBeUndefined();
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(0);
    expect(store.getSnapshot().error).toBeNull();
    store.setProject('b', 1);
    expect(store.getSnapshot().error).toBeNull();
    sleeping = false; await store.restoreProjectSession('a');
    expect(store.getBuffer('a', 'one')!.evicted).not.toBe(true);
    expect(call.mock.calls.filter(([method]) => method === 'document_open')).toHaveLength(1);
  });

  it('closes clean tabs in a batch, pauses at each dirty tab, and cancellation preserves remaining tabs', async () => {
    const { store, edit } = fixture(); await store.openFile('clean'); await store.openFile('dirty-1'); edit('dirty-1', 'one'); await store.openFile('dirty-2'); edit('dirty-2', 'two');
    store.requestCloseMany(['clean', 'dirty-1', 'dirty-2'], 'a'); await tick();
    expect(store.getSnapshot().projects.get('a')!.tabs).toEqual(['dirty-1', 'dirty-2']);
    expect(store.getSnapshot().pendingClose?.fileId).toBe('dirty-1');
    await store.close('dirty-1', 'discard', 'a'); await tick();
    expect(store.getSnapshot().pendingClose?.fileId).toBe('dirty-2');
    store.cancelClose(); expect(store.getSnapshot().pendingClose).toBe(null); expect(store.getActive()!.getText()).toBe('two');
  });

  it('uses CodeMirror text identity to clear dirty state when undo reaches the saved content', async () => {
    const { store, call } = fixture(); await store.openFile('one'); const buffer = store.getActive()!;
    let state = EditorState.create({ doc: 'hello', extensions: [history()] });
    buffer.contentIdentity = state.doc; buffer.savedContentIdentity = state.doc;
    buffer.contentEquals = (left, right) => left instanceof Text && right instanceof Text && left.eq(right);
    const dispatch = (transaction: Transaction) => { state = transaction.state; const text = state.doc; store.edited('a', 'one', () => text.toString(), { anchor: state.selection.main.anchor, head: state.selection.main.head }, text); };
    dispatch(state.update({ changes: { from: 5, insert: '\n未保存' } })); expect(buffer.dirty).toBe(true);
    expect(undo({ state, dispatch })).toBe(true); await tick();
    expect(buffer.getText()).toBe('hello'); expect(buffer.dirty).toBe(false);
    expect(call.mock.calls.filter(([method]) => method === 'document_mark_dirty').at(-1)?.[1]).toMatchObject({ dirty: false, editorRevision: 2 });
    expect(call.mock.calls.some(([method]) => method === 'document_save')).toBe(false);
  });
});
