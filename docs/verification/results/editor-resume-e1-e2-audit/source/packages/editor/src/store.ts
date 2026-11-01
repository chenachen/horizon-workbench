import { bufferKey, errorMessage, type EditorBuffer, type EditorProject, type EditorSnapshot, type EditorTransport, type OpenDocument, type ProjectSession, type RecoveryDraft, type SaveResult, type Selection } from './types';
import { beginEditorOpen } from './metrics';
import { clampSelection, editorTextLength } from './selection';

export type RestoreTicket = { readonly epoch: number; readonly generation: number };

/** Text belongs to document models; snapshots publish metadata only, not each keystroke. */
export class EditorStore {
  private buffers = new Map<string, EditorBuffer>();
  private projects = new Map<string, EditorProject>();
  private detachedProjects = new Set<string>();
  private projectGenerations = new Map<string, number>();
  private pendingSessions = new Map<string, ProjectSession>();
  private restoringSessions = new Map<string, RestoreTicket>();
  private listeners = new Set<() => void>();
  private editListeners = new Set<(key: string) => void>();
  private saves = new Map<string, Promise<boolean>>();
  private checkpoints = new Map<string, Promise<void>>();
  private opens = new Map<string, { ticket: RestoreTicket; promise: Promise<EditorBuffer | undefined> }>();
  private draftTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private maxDraftTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private marks = new Map<string, Promise<unknown>>();
  private sessionTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private sessionWrites = new Map<string, Promise<void>>();
  private closeQueue: { projectId: string; fileId: string }[] = [];
  private processingCloseQueue = false;
  private snapshot: EditorSnapshot = { revision: 0, activeProjectId: null, projects: this.projects, buffers: this.buffers, pendingClose: null, error: null };
  constructor(private transport: EditorTransport, private cleanLimit = 20, private cleanBytesLimit = 64 * 1024 * 1024) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  subscribeEdits = (listener: (key: string) => void) => { this.editListeners.add(listener); return () => { this.editListeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  getBuffer = (projectId: string, fileId: string) => this.buffers.get(bufferKey(projectId, fileId));
  getActive = (projectId = this.snapshot.activeProjectId ?? '') => { const file = this.projects.get(projectId)?.activeFileId; return file ? this.getBuffer(projectId, file) : undefined; };
  private emit(error: string | null = this.snapshot.error) { this.snapshot = { ...this.snapshot, revision: this.snapshot.revision + 1, projects: this.projects, buffers: this.buffers, error }; this.listeners.forEach(fn => fn()); }
  reportError = (error: unknown) => this.emit(errorMessage(error));
  clearError = () => this.emit(null);
  captureRestoreTicket = (projectId: string, expectedEpoch: number): RestoreTicket | undefined => {
    const project = this.projects.get(projectId);
    return project?.epoch === expectedEpoch ? { epoch: expectedEpoch, generation: this.projectGenerations.get(projectId) ?? 0 } : undefined;
  };
  private ticketMatches(projectId: string, ticket: RestoreTicket) {
    return this.projects.get(projectId)?.epoch === ticket.epoch && (this.projectGenerations.get(projectId) ?? 0) === ticket.generation;
  }
  private projectIsLive(projectId: string, ticket: RestoreTicket) { return this.ticketMatches(projectId, ticket) && !this.detachedProjects.has(projectId); }
  setProject = (id: string, epoch: number, session?: ProjectSession) => {
    const old = this.snapshot.activeProjectId;
    if (old && old !== id) void this.flushDrafts(old).catch(this.reportError);
    let project = this.projects.get(id);
    if (!project) { project = { id, epoch, tabs: [], activeFileId: null, expanded: new Set(session?.expandedEntryIds ?? []), searchDraft: session?.searchDraft ?? '', restored: false }; this.projects.set(id, project); }
    else if (project.epoch !== epoch) this.projectGenerations.set(id, (this.projectGenerations.get(id) ?? 0) + 1);
    project.epoch = epoch; this.snapshot = { ...this.snapshot, activeProjectId: id }; this.emit();
    if (session && !project.restored) this.pendingSessions.set(id, session);
  };
  /** The host calls this only after the editor's view activation has succeeded. */
  restoreProjectSession = async (projectId: string, ticket = this.captureRestoreTicket(projectId, this.projects.get(projectId)?.epoch ?? -1)) => {
    const project = this.projects.get(projectId), session = this.pendingSessions.get(projectId);
    if (!project || !ticket || !this.ticketMatches(projectId, ticket)) return;
    const restoring = this.restoringSessions.get(projectId);
    if (restoring && restoring.epoch === ticket.epoch && restoring.generation === ticket.generation) return;
    const reattached = this.detachedProjects.delete(projectId);
    if (!session || project.restored) {
      const active = this.getActive(projectId);
      if (active?.evicted) await this.openFile(active.fileId, { projectId, preview: active.preview });
      if (reattached && this.projectIsLive(projectId, ticket)) this.persistSession(projectId);
      return;
    }
    this.restoringSessions.set(projectId, ticket); const activeAtStart = project.activeFileId;
    try { for (const tab of session.tabs) { const buffer = await this.openFile(tab.fileId, { projectId, preview: !tab.pinned, activate: false }); if (!this.projectIsLive(projectId, ticket)) return; if (buffer) { buffer.selection = clampSelection(tab.selection, editorTextLength(buffer.getText())); buffer.scrollTop = tab.scrollTop; } }
      if (!this.projectIsLive(projectId, ticket)) return;
      if (project.activeFileId === activeAtStart && session.activeFileId && this.getBuffer(projectId, session.activeFileId)) this.activate(session.activeFileId, projectId);
      project.restored = true; if (this.pendingSessions.get(projectId) === session) this.pendingSessions.delete(projectId);
    } finally { if (this.restoringSessions.get(projectId) === ticket) this.restoringSessions.delete(projectId); if (this.projectIsLive(projectId, ticket)) this.persistSession(projectId); }
  };
  openFile = async (fileId: string, options: { projectId?: string; preview?: boolean; line?: number; column?: number; activate?: boolean } = {}) => {
    const projectId = options.projectId ?? this.snapshot.activeProjectId;
    if (!projectId || !this.projects.has(projectId) || this.detachedProjects.has(projectId)) return;
    const key = bufferKey(projectId, fileId), project = this.projects.get(projectId)!;
    const ticket = this.captureRestoreTicket(projectId, project.epoch)!;
    let buffer = this.buffers.get(key);
    if (options.activate !== false) beginEditorOpen(projectId, fileId, buffer && !buffer.evicted ? 'warm' : 'cold');
    if (buffer && !buffer.evicted) { if (!options.preview) buffer.preview = false; if (options.activate !== false) this.activate(fileId, projectId); if (options.line !== undefined) { buffer.reveal = { line: options.line, column: options.column ?? 0, nonce: Date.now() }; this.emit(); } return buffer; }
    const existing = this.opens.get(key);
    if (existing && existing.ticket.epoch === ticket.epoch && existing.ticket.generation === ticket.generation) return existing.promise;
    const opening = (async () => {
      try {
        const draft = buffer?.evicted && buffer.recoveryPending && buffer.checkpointId ? await this.transport.call<RecoveryDraft>('recovery_read', { checkpointId: buffer.checkpointId }, projectId) : undefined;
        if (!this.projectIsLive(projectId, ticket)) return;
        const result = await this.transport.call<OpenDocument>('document_open', { fileId, mode: 'auto' }, projectId);
        if (!this.projectIsLive(projectId, ticket)) return;
        if (options.preview) {
          const previous = project.tabs.map(f => this.getBuffer(projectId, f)).find(b => b?.preview && !b.dirty && !b.saving);
          if (previous) await this.close(previous.fileId, 'saved', projectId);
          if (!this.projectIsLive(projectId, ticket)) return;
        }
        const previous = buffer;
        buffer = this.fromOpen(projectId, fileId, result, previous?.preview ?? !!options.preview);
        if (previous) { buffer.selection = clampSelection(previous.selection, editorTextLength(buffer.getText())); buffer.scrollTop = previous.scrollTop; buffer.contentVersion = previous.contentVersion + 1; }
        if (draft && buffer.meta && buffer.mode === 'editor') {
          buffer.conflict = buffer.meta.baseDiskRevision.token !== draft.baseDiskRevision.token;
          buffer.meta.baseDiskRevision = draft.baseDiskRevision; buffer.getText = () => draft.text; buffer.dirty = true; buffer.preview = false;
          buffer.version = Math.max(buffer.version + 1, draft.editorRevision); buffer.selection = clampSelection(draft.selection, editorTextLength(draft.text));
          await this.transport.call('document_mark_dirty', { documentId: buffer.meta.documentId, editorRevision: buffer.version, dirty: true }, projectId);
          if (!this.projectIsLive(projectId, ticket)) return;
          await this.checkpoint(buffer);
          if (!this.projectIsLive(projectId, ticket)) return;
          if (draft.checkpointId !== buffer.checkpointId) await this.transport.call('recovery_resolve', { checkpointId: draft.checkpointId, replacementDocumentId: buffer.meta.documentId }, projectId);
          if (!this.projectIsLive(projectId, ticket)) return;
        }
        if (options.line !== undefined) buffer.reveal = { line: options.line, column: options.column ?? 0, nonce: Date.now() };
        this.buffers.set(key, buffer); if (!project.tabs.includes(fileId)) project.tabs.push(fileId);
        if (options.activate !== false) project.activeFileId = fileId;
        this.emit(null); this.persistSession(projectId); this.evictClean();
        return buffer;
      } catch (error) { if (this.projectIsLive(projectId, ticket) && this.snapshot.activeProjectId === projectId) this.reportError(error); return undefined; }
      finally { if (this.opens.get(key)?.ticket === ticket) this.opens.delete(key); }
    })();
    this.opens.set(key, { ticket, promise: opening }); return opening;
  };
  private fromOpen(projectId: string, fileId: string, result: OpenDocument, preview: boolean): EditorBuffer {
    const text = result.mode === 'editor' ? result.text : '';
    return { key: bufferKey(projectId, fileId), projectId, fileId, path: result.mode === 'editor' ? result.meta.file.displayPath : result.file.displayPath, mode: result.mode,
      meta: result.mode === 'editor' ? result.meta : undefined, revision: result.mode === 'chunked' ? result.revision : undefined,
      simplified: result.mode === 'editor' && result.simplified, reason: result.mode === 'unsupported' ? result.reason : undefined,
      dirty: false, saving: false, conflict: false, preview, loading: false, version: result.mode === 'editor' ? result.meta.editorRevision : 0,
      savedVersion: result.mode === 'editor' ? result.meta.editorRevision : 0, contentVersion: 0, selection: { anchor: 0, head: 0 }, scrollTop: 0,
      getText: () => text, cursor: result.mode === 'chunked' ? result.cursor : undefined, checkpointVersion: -1, lastUsed: Date.now() };
  }
  activate = (fileId: string, projectId = this.snapshot.activeProjectId ?? '') => { const p = this.projects.get(projectId), b = this.getBuffer(projectId, fileId); if (!p || !b) return; if (b.evicted) { void this.openFile(fileId, { projectId, preview: b.preview }); return; } beginEditorOpen(projectId, fileId, 'warm'); p.activeFileId = fileId; b.lastUsed = Date.now(); this.evictClean(); this.emit(); this.persistSession(projectId); };
  keep = (fileId: string, projectId = this.snapshot.activeProjectId ?? '') => { const b = this.getBuffer(projectId, fileId); if (b) { b.preview = false; this.emit(); this.persistSession(projectId); } };
  nextTab = (direction: 1 | -1, projectId = this.snapshot.activeProjectId ?? '') => { const project = this.projects.get(projectId); if (!project?.tabs.length) return; const index = Math.max(0, project.tabs.indexOf(project.activeFileId ?? '')); this.activate(project.tabs[(index + direction + project.tabs.length) % project.tabs.length], projectId); };
  moveTab = (fileId: string, direction: 1 | -1, projectId = this.snapshot.activeProjectId ?? '') => { const project = this.projects.get(projectId); if (!project) return; const index = project.tabs.indexOf(fileId), target = index + direction; if (index < 0 || target < 0 || target >= project.tabs.length) return; [project.tabs[index], project.tabs[target]] = [project.tabs[target], project.tabs[index]]; this.emit(); this.persistSession(projectId); };
  private markDirty(buffer: EditorBuffer, dirty: boolean) {
    if (!buffer.meta) return Promise.resolve();
    const version = buffer.version, documentId = buffer.meta.documentId;
    const previous = this.marks.get(buffer.key), checkpoint = this.checkpoints.get(buffer.key);
    const next = Promise.all([previous?.catch(() => {}), checkpoint?.catch(() => {})]).then(() => this.transport.call('document_mark_dirty', { documentId, editorRevision: version, dirty }, buffer.projectId)).then(result => { if (!dirty && buffer.version === version) { buffer.checkpointId = undefined; buffer.checkpointVersion = -1; buffer.checkpointError = undefined; } return result; }).catch(error => { if ((error as { code?: string })?.code !== 'STALE_VERSION' || buffer.version === version) this.reportError(error); }).finally(() => { if (this.marks.get(buffer.key) === next) this.marks.delete(buffer.key); });
    this.marks.set(buffer.key, next); return next;
  }
  edited = (projectId: string, fileId: string, getText: () => string, selection: Selection, contentIdentity?: unknown) => {
    const b = this.getBuffer(projectId, fileId); if (!b || b.mode !== 'editor' || b.meta?.readOnly) return;
    b.getText = getText; b.contentIdentity = contentIdentity; b.selection = selection; b.version++; const wasDirty = b.dirty;
    b.dirty = b.conflict || !(contentIdentity !== undefined && b.savedContentIdentity !== undefined && b.contentEquals?.(contentIdentity, b.savedContentIdentity)); b.preview = false;
    this.editListeners.forEach(listener => listener(b.key));
    if (wasDirty !== b.dirty) { this.emit(); void this.markDirty(b, b.dirty); }
    if (!b.dirty) { for (const timers of [this.draftTimers, this.maxDraftTimers]) { const timer = timers.get(b.key); if (timer) clearTimeout(timer); timers.delete(b.key); } b.checkpointId = undefined; b.checkpointVersion = -1; b.checkpointError = undefined; return; }
    const old = this.draftTimers.get(b.key); if (old) clearTimeout(old);
    this.draftTimers.set(b.key, setTimeout(() => { this.draftTimers.delete(b.key); void this.checkpoint(b).catch(this.reportError); }, 2000));
    if (!this.maxDraftTimers.has(b.key)) this.maxDraftTimers.set(b.key, setTimeout(() => { this.maxDraftTimers.delete(b.key); void this.checkpoint(b).catch(this.reportError); }, 10000));
  };
  position = (projectId: string, fileId: string, selection: Selection, scrollTop?: number) => { const b = this.getBuffer(projectId, fileId); if (b) { b.selection = selection; if (scrollTop !== undefined) b.scrollTop = scrollTop; this.persistSession(projectId); } };
  private async checkpoint(b: EditorBuffer): Promise<void> {
    if (!b.dirty || !b.meta || b.checkpointVersion === b.version) return;
    const previous = this.checkpoints.get(b.key); if (previous) { await previous; if (b.checkpointVersion === b.version) return; }
    const version = b.version, text = b.getText();
    const pending = this.transport.call<{ checkpointId: string; editorRevision: number }>('document_checkpoint', { documentId: b.meta.documentId, editorRevision: version, baseDiskRevision: b.meta.baseDiskRevision, text, selection: b.selection }, b.projectId).then(result => { b.checkpointVersion = result.editorRevision; b.checkpointId = result.checkpointId; b.checkpointError = undefined; const timer = this.maxDraftTimers.get(b.key); if (timer) clearTimeout(timer); this.maxDraftTimers.delete(b.key); }).catch(error => { b.checkpointError = errorMessage(error); throw error; }).finally(() => { this.checkpoints.delete(b.key); this.emit(); });
    this.checkpoints.set(b.key, pending); return pending;
  }
  flushDrafts = async (projectId?: string) => { const buffers = [...this.buffers.values()].filter(b => b.dirty && (!projectId || b.projectId === projectId)); await Promise.all([this.flushSessions(projectId), ...buffers.map(async b => { const timer = this.draftTimers.get(b.key); if (timer) clearTimeout(timer); this.draftTimers.delete(b.key); await this.marks.get(b.key); do { await this.checkpoint(b); } while (b.dirty && b.checkpointVersion !== b.version); })]); };
  saveActive = () => { const b = this.getActive(); return b ? this.save(b.fileId, b.projectId) : Promise.resolve(true); };
  save = (fileId: string, projectId = this.snapshot.activeProjectId ?? ''): Promise<boolean> => {
    const b = this.getBuffer(projectId, fileId); if (!b || !b.meta || b.mode !== 'editor' || b.meta.readOnly || b.meta.eol === 'mixed' || b.composing || b.proposalPending) return Promise.resolve(false);
    if (this.saves.has(b.key)) return this.saves.get(b.key)!;
    if (!b.dirty) return Promise.resolve(true);
    const version = b.version, text = b.getText(), savedIdentity = b.contentIdentity, expectedDiskRevision = b.meta.baseDiskRevision;
    b.saving = true; b.error = undefined; this.emit();
    const pending = (async () => {
      try {
        await this.marks.get(b.key); await this.checkpoints.get(b.key);
        const result = await this.transport.call<SaveResult>('document_save', { documentId: b.meta!.documentId, editorRevision: version, expectedDiskRevision, text, encoding: b.meta!.encoding, eol: b.meta!.eol }, projectId);
        b.meta!.baseDiskRevision = result.diskRevision; b.savedVersion = result.savedEditorRevision; b.savedContentIdentity = savedIdentity; b.dirty = b.version !== version && !(savedIdentity !== undefined && b.contentIdentity !== undefined && b.contentEquals?.(b.contentIdentity, savedIdentity)); b.conflict = false;
        if (b.dirty) await this.checkpoint(b);
        else { if (b.version !== version) await this.markDirty(b, false); const timer = this.maxDraftTimers.get(b.key); if (timer) clearTimeout(timer); this.maxDraftTimers.delete(b.key); }
        return !b.dirty;
      } catch (error) { b.error = errorMessage(error); if ((error as { code?: string })?.code === 'FILE_CHANGED') b.conflict = true; return false; }
      finally { b.saving = false; this.saves.delete(b.key); this.emit(); }
    })(); this.saves.set(b.key, pending); return pending;
  };
  saveAll = async (projectId?: string) => { let ok = true; for (const b of this.buffers.values()) if (b.dirty && (!projectId || b.projectId === projectId)) ok = await this.save(b.fileId, b.projectId) && ok; return ok; };
  requestClose = (fileId?: string, projectId = this.snapshot.activeProjectId ?? '') => { this.closeQueue = []; const b = fileId ? this.getBuffer(projectId, fileId) : this.getActive(projectId); if (!b) return; if (b.dirty || b.saving) { this.snapshot = { ...this.snapshot, pendingClose: { projectId, fileId: b.fileId } }; this.emit(); } else void this.close(b.fileId, 'saved', projectId); };
  requestCloseMany = (fileIds: string[], projectId = this.snapshot.activeProjectId ?? '') => { this.closeQueue = [...new Set(fileIds)].map(fileId => ({ projectId, fileId })); void this.advanceCloseQueue(); };
  private async advanceCloseQueue() {
    if (this.processingCloseQueue) return; this.processingCloseQueue = true;
    try { while (this.closeQueue.length) { const next = this.closeQueue[0], buffer = this.getBuffer(next.projectId, next.fileId); if (!buffer) { this.closeQueue.shift(); continue; } if (buffer.dirty || buffer.saving || !await this.close(next.fileId, 'saved', next.projectId)) { this.snapshot = { ...this.snapshot, pendingClose: next }; this.emit(); return; } } }
    finally { this.processingCloseQueue = false; }
  }
  cancelClose = () => { this.closeQueue = []; this.snapshot = { ...this.snapshot, pendingClose: null }; this.emit(); };
  close = async (fileId: string, decision: 'saved' | 'discard', projectId = this.snapshot.activeProjectId ?? '') => {
    const b = this.getBuffer(projectId, fileId), p = this.projects.get(projectId); if (!b || !p) return true;
    const ticket = this.captureRestoreTicket(projectId, p.epoch)!;
    const ownsBuffer = () => this.projectIsLive(projectId, ticket) && this.getBuffer(projectId, fileId) === b;
    if (!ownsBuffer()) return false;
    if (b.saving || b.composing) return false;
    if (decision === 'saved' && b.dirty && !await this.save(fileId, projectId)) return false;
    if (!ownsBuffer()) return false;
    try { if (b.meta) { await this.marks.get(b.key); if (!ownsBuffer()) return false; await this.checkpoints.get(b.key); if (!ownsBuffer()) return false; if (b.dirty && decision === 'discard') { await this.transport.call('document_mark_dirty', { documentId: b.meta.documentId, editorRevision: b.version, dirty: true }, projectId); if (!ownsBuffer()) return false; } await this.transport.call('document_close', { documentId: b.meta.documentId, expectedEditorRevision: b.version, decision }, projectId); } }
    catch (error) { if (ownsBuffer()) { b.error = errorMessage(error); this.emit(); } return false; }
    if (!ownsBuffer()) return false;
    const i = p.tabs.indexOf(fileId); p.tabs = p.tabs.filter(f => f !== fileId); if (p.activeFileId === fileId) p.activeFileId = p.tabs[i] ?? p.tabs[i - 1] ?? null;
    const timer = this.draftTimers.get(b.key); if (timer) clearTimeout(timer); this.draftTimers.delete(b.key);
    const maxTimer = this.maxDraftTimers.get(b.key); if (maxTimer) clearTimeout(maxTimer); this.maxDraftTimers.delete(b.key);
    this.buffers.delete(b.key); this.snapshot = { ...this.snapshot, pendingClose: null };
    if (this.closeQueue[0]?.projectId === projectId && this.closeQueue[0]?.fileId === fileId) this.closeQueue.shift();
    this.emit(); this.persistSession(projectId); if (this.closeQueue.length && !this.processingCloseQueue) void this.advanceCloseQueue(); return true;
  };
  reload = async (fileId: string, discardLocal: boolean, projectId = this.snapshot.activeProjectId ?? '') => {
    const b = this.getBuffer(projectId, fileId); if (!b?.meta || (b.dirty && !discardLocal)) return;
    const version = b.version;
    try {
      if (b.dirty) await this.transport.call('document_mark_dirty', { documentId: b.meta.documentId, editorRevision: b.version, dirty: true }, projectId);
      const stat = await this.transport.call<{ revision: NonNullable<EditorBuffer['revision']> }>('file_stat', { fileId }, projectId);
      if (b.version !== version || b.composing) return;
      const result = await this.transport.call<OpenDocument>('document_reload', { documentId: b.meta.documentId, expectedEditorRevision: version, expectedDiskRevision: stat.revision, discardLocal }, projectId);
      if (b.version !== version) { b.conflict = true; await this.transport.call('document_mark_dirty', { documentId: b.meta.documentId, editorRevision: b.version, dirty: true }, projectId); this.emit(); return; }
      const fresh = this.fromOpen(projectId, fileId, result, b.preview); fresh.selection = clampSelection(b.selection, editorTextLength(fresh.getText())); fresh.scrollTop = b.scrollTop; fresh.contentVersion = b.contentVersion + 1;
      this.buffers.set(b.key, fresh); this.emit();
    } catch (error) { b.error = errorMessage(error); b.conflict = b.dirty; this.emit(); }
  };
  externalChanged = async (projectId: string, entityId?: string) => { for (const b of this.buffers.values()) {
    if (b.projectId !== projectId || (entityId && entityId !== projectId && b.fileId !== entityId && b.meta?.documentId !== entityId) || b.saving || !b.meta || b.evicted) continue;
    try { const stat = await this.transport.call<{ revision: NonNullable<EditorBuffer['revision']> }>('file_stat', { fileId: b.fileId }, projectId); if (stat.revision.token === b.meta.baseDiskRevision.token) continue; if (b.dirty) { b.conflict = true; this.emit(); } else await this.reload(b.fileId, false, projectId); }
    catch (error) { b.error = `磁盘文件不可用：${errorMessage(error)}。已保留打开内容，可另存副本。`; b.conflict = true; this.emit(); }
  } };
  loadChunk = async (fileId: string, projectId = this.snapshot.activeProjectId ?? '') => {
    const b = this.getBuffer(projectId, fileId); if (!b || b.mode !== 'chunked' || !b.cursor || b.loading) return;
    b.loading = true; this.emit(); try {
      const result = await this.transport.call<{ text: string; byteStart: string; byteEnd: string; nextCursor: string | null; revision: NonNullable<EditorBuffer['revision']> }>('file_read_chunk', { fileId, cursor: b.cursor, limitBytes: 262144 }, projectId);
      b.getText = () => result.text; b.byteStart = result.byteStart; b.byteEnd = result.byteEnd; b.cursor = result.nextCursor; b.revision = result.revision; b.contentVersion++; b.error = undefined;
    } catch (error) { b.error = errorMessage(error); } finally { b.loading = false; this.emit(); }
  };
  restoreDraft = async (checkpointId: string, projectId: string) => {
    const draft = await this.transport.call<RecoveryDraft>('recovery_read', { checkpointId }, projectId);
    if (draft.projectId !== projectId || (draft.file && draft.file.projectId !== projectId)) throw new Error('恢复草稿属于其他项目，请切换到原项目后恢复。');
    const fileId = draft.file?.fileId ?? draft.fileId;
    if (!fileId) throw new Error('恢复草稿缺少文件信息，请在设置中导出草稿。');
    const b = await this.openFile(fileId, { projectId, preview: false });
    if (!b?.meta || b.mode !== 'editor') throw new Error('原文件无法在编辑器中打开。恢复草稿仍已保留，可在设置中导出。');
    if (b.dirty || b.saving || b.composing || b.proposalPending) throw new Error('当前文件有未保存编辑或正在处理。请先保存当前编辑，或关闭文件并明确放弃后，再恢复草稿。');
    if (b.meta.readOnly) throw new Error('当前文件只读，无法直接恢复。请在设置中导出恢复草稿。');
    b.conflict = b.meta.baseDiskRevision.token !== draft.baseDiskRevision.token; b.meta.baseDiskRevision = draft.baseDiskRevision;
    b.getText = () => draft.text; b.version = Math.max(b.version + 1, draft.editorRevision); b.dirty = true; b.selection = clampSelection(draft.selection, editorTextLength(draft.text)); b.contentVersion++;
    b.checkpointId = checkpointId; b.checkpointVersion = -1; this.emit();
    await this.transport.call('document_mark_dirty', { documentId: b.meta.documentId, editorRevision: b.version, dirty: true }, projectId);
    await this.checkpoint(b);
    if (checkpointId !== b.checkpointId) await this.transport.call('recovery_resolve', { checkpointId, replacementDocumentId: b.meta.documentId }, projectId);
  };
  setExpanded = (projectId: string, id: string, expanded: boolean) => { const p = this.projects.get(projectId); if (!p) return; if (expanded) p.expanded.add(id); else p.expanded.delete(id); this.persistSession(projectId); };
  setSearchDraft = (projectId: string, text: string) => { const p = this.projects.get(projectId); if (p) { p.searchDraft = text; this.persistSession(projectId); } };
  rename = (projectId: string, fileId: string, path: string) => { const b = this.getBuffer(projectId, fileId); if (b) { b.path = path; if (b.meta) b.meta.file.displayPath = path; this.emit(); } };
  renamePath = (projectId: string, oldPath: string, newPath: string) => { for (const b of this.buffers.values()) if (b.projectId === projectId && (b.path === oldPath || b.path.startsWith(`${oldPath}/`))) { b.path = newPath + b.path.slice(oldPath.length); if (b.meta) b.meta.file.displayPath = b.path; } this.emit(); };
  private persistSession(projectId: string) {
    if (this.restoringSessions.has(projectId) || this.detachedProjects.has(projectId)) return;
    const old = this.sessionTimers.get(projectId); if (old) clearTimeout(old);
    this.sessionTimers.set(projectId, setTimeout(() => { this.sessionTimers.delete(projectId); void this.writeSession(projectId).catch(this.reportError); }, 400));
  }
  private writeSession(projectId: string): Promise<void> {
    if (this.restoringSessions.has(projectId) || this.detachedProjects.has(projectId)) return Promise.resolve();
    const previous = this.sessionWrites.get(projectId) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(async () => {
      const project = this.projects.get(projectId); if (!project || this.detachedProjects.has(projectId) || this.restoringSessions.has(projectId)) return;
      const pending = !project.restored ? this.pendingSessions.get(projectId) : undefined;
      const tabs = pending?.tabs ?? project.tabs.map(fileId => { const b = this.getBuffer(projectId, fileId)!; return { fileId, pinned: !b.preview, selection: b.selection, scrollTop: b.scrollTop }; });
      await this.transport.call('session_update', { tabs, activeFileId: pending?.activeFileId ?? project.activeFileId, expandedEntryIds: [...project.expanded], searchDraft: project.searchDraft }, projectId);
    }).finally(() => { if (this.sessionWrites.get(projectId) === next) this.sessionWrites.delete(projectId); });
    this.sessionWrites.set(projectId, next); return next;
  }
  flushSessions = async (projectId?: string) => { const ids = (projectId ? [projectId] : [...this.projects.keys()]).filter(id => !this.detachedProjects.has(id)); await Promise.all(ids.map(id => { const timer = this.sessionTimers.get(id); if (timer) clearTimeout(timer); this.sessionTimers.delete(id); return this.writeSession(id); })); };
  private evictClean() {
    const active = this.getActive();
    const clean = [...this.buffers.values()].filter(b => !b.dirty && !b.saving && !b.evicted && b.mode === 'editor').sort((a, b) => a.lastUsed - b.lastUsed);
    let count = clean.length, bytes = clean.reduce((total, b) => total + Number(b.meta?.baseDiskRevision.byteLength ?? 0), 0);
    for (const b of clean) { if (count <= this.cleanLimit && bytes <= this.cleanBytesLimit) break; if (b === active) continue; b.getText = () => ''; b.contentIdentity = undefined; b.savedContentIdentity = undefined; b.evicted = true; bytes -= Number(b.meta?.baseDiskRevision.byteLength ?? 0); count--; }
  }
  disposeProject = async (projectId?: string) => { await this.flushDrafts(projectId); for (const b of this.buffers.values()) { if (projectId && b.projectId !== projectId) continue; if (b.dirty) { const text = b.getText(); b.getText = () => text; } else { b.getText = () => ''; b.evicted = true; } for (const timers of [this.draftTimers, this.maxDraftTimers]) { const timer = timers.get(b.key); if (timer) clearTimeout(timer); timers.delete(b.key); } } this.emit(); };
  /** Call only after the host has resolved its stop plan and released document IDs. */
  hostClosedProject = (projectId?: string, decision: 'retainCheckpoint' | 'discard' = 'retainCheckpoint') => {
    for (const id of projectId ? [projectId] : this.projects.keys()) {
      this.projectGenerations.set(id, (this.projectGenerations.get(id) ?? 0) + 1);
      this.detachedProjects.add(id);
      const timer = this.sessionTimers.get(id); if (timer) clearTimeout(timer); this.sessionTimers.delete(id);
    }
    for (const b of this.buffers.values()) {
      if (projectId && b.projectId !== projectId) continue;
      for (const timers of [this.draftTimers, this.maxDraftTimers]) { const timer = timers.get(b.key); if (timer) clearTimeout(timer); timers.delete(b.key); }
      if (b.dirty && decision === 'retainCheckpoint' && !b.checkpointId) { b.error = '宿主已停止，但缺少恢复草稿回执；当前文本已保留。'; continue; }
      b.recoveryPending = decision === 'retainCheckpoint' && (b.dirty || b.recoveryPending === true);
      b.getText = () => ''; b.contentIdentity = undefined; b.savedContentIdentity = undefined; b.evicted = true; b.saving = false; b.composing = false; b.dirty = false; b.meta = undefined;
      if (!b.recoveryPending) { b.conflict = false; b.checkpointId = undefined; b.checkpointVersion = -1; }
    }
    this.emit();
  };
}
