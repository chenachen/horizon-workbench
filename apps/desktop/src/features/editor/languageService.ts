import { ChangeSet, Compartment, Text, type Extension } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { LSPClient, LSPPlugin, Workspace, type Transport, type WorkspaceFile } from '@codemirror/lsp-client';
import { Channel, invoke } from '@tauri-apps/api/core';
import type { Definition, DefinitionLink, Range } from 'vscode-languageserver-protocol';
import type { EditorBuffer, EditorDocumentChange, FileRef } from '../../../../../packages/editor/src/types';
import type { ExtensionState, LanguageServerDefinition } from '../../../../../packages/plugins/src/types';
import { call, getProjectEpoch, nativeAvailable, type Reply } from '../../bridge';
import { pluginRuntime, refreshPlugins } from '../plugins/service';
import { editorStore } from './store';

export type DefinitionTarget = { uri: string; range: Range; label?: string };
type Connection = {
  sessionId: string; serverId: string; extensionId: string; rootUri: string;
  fileUri: string; languageId: string; revision: number; initializationOptions?: unknown; settings?: Record<string, unknown>;
};
type NativeEvent = { type: 'message'; message: string } | { type: 'closed'; error?: string };
type ServiceChoice = { state: ExtensionState; definition: LanguageServerDefinition; languageId: string; fingerprint: string };
type Binding = { buffer: EditorBuffer; session: Session; uri: string; languageId: string; fingerprint: string };
type PendingBinding = { generation: number; extensionId: string; revision: number; promise: Promise<Binding | null>; error?: unknown };
type ViewBinding = { buffer: EditorBuffer; view: EditorView; compartment: Compartment; current?: Binding; policy: string | null; disposed: boolean; request: number };
type Session = {
  info: Connection; projectId: string; client: LSPClient; workspace: BufferWorkspace;
  transport: NativeLanguageTransport; ready: Promise<void>; restoring?: Promise<void>; closed: boolean; error?: Error;
};

const sessions = new Map<string, Session>();
const bindings = new Map<string, PendingBinding>();
const generations = new Map<string, number>();
const views = new Set<ViewBinding>();
const queries = new WeakMap<EditorView, { cancel(): void }>();
type TargetSnapshot = { key: string; buffer: EditorBuffer; version: number; contentVersion: number; doc: Text };
const targetSnapshots = new WeakMap<DefinitionTarget, TargetSnapshot>();
const canceled = () => new Error('文件或语言服务已变化，请重新跳转。');
const asError = (value: unknown) => value instanceof Error ? value : new Error(typeof value === 'object' && value && 'message' in value ? String(value.message) : String(value));
const currentGeneration = (projectId: string) => generations.get(projectId) ?? 0;

function policyAvailable(state: ExtensionState) {
  return state.installState === 'installed' && state.effectiveEnabled && !state.effectivePaused;
}
function available(state: ExtensionState) {
  return policyAvailable(state)
    && !['failed', 'cleanupFailed', 'pausing', 'paused'].includes(state.runState);
}

function chooseService(buffer: EditorBuffer, policyOnly = false): ServiceChoice | null {
  const states = pluginRuntime.getSnapshot(buffer.projectId).filter(policyOnly ? policyAvailable : available);
  const filename = buffer.path.replaceAll('\\', '/').split('/').pop() ?? buffer.path;
  let languageId = '', suffixLength = -1;
  for (const state of states) for (const language of state.manifest?.contributes.languages ?? []) {
    if (language.filenames?.includes(filename)) { languageId = language.id; suffixLength = Infinity; }
    for (const suffix of language.extensions ?? []) if (suffix.length > suffixLength && filename.toLowerCase().endsWith(suffix.toLowerCase())) {
      languageId = language.id; suffixLength = suffix.length;
    }
  }
  if (!languageId) return null;
  for (const state of states) for (const definition of state.manifest?.contributes.languageServers ?? []) {
    if (definition.languageIds.includes(languageId)) return {
      state, definition, languageId,
      fingerprint: JSON.stringify([state.id, state.installedVersion, definition, languageId, buffer.path]),
    };
  }
  return null;
}

function settingSection(settings: Record<string, unknown>, section: unknown, serverId: string): unknown {
  if (typeof section !== 'string' || !section) return settings;
  let value: unknown = settings;
  for (const part of section.split('.')) value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[part] : undefined;
  if (value !== undefined) return value;
  // Servers such as rust-analyzer request their named section even when the
  // plugin's settings already contain that section's contents.
  return section === serverId || section === 'rust-analyzer' && serverId === 'rust' ? settings : null;
}

/** Ordered JSON transport; Rust owns Content-Length framing and the process. */
export class NativeLanguageTransport implements Transport {
  private handlers = new Set<(message: string) => void>();
  private pending = new Set<string | number>();
  private outbound = Promise.resolve();
  private failure?: Error;
  constructor(
    private info: Connection,
    private write: (message: string) => Promise<unknown>,
    private onClosed: (error: Error) => void,
    private onDefinitionCapability: (enabled: boolean) => void = () => {},
  ) {}
  subscribe(handler: (message: string) => void) { this.handlers.add(handler); }
  unsubscribe(handler: (message: string) => void) { this.handlers.delete(handler); }
  send(message: string) {
    const data = JSON.parse(message);
    if (data.method === 'initialize') {
      data.params.workspaceFolders = [{ uri: this.info.rootUri, name: this.rootName() }];
      data.params.capabilities.general = { ...data.params.capabilities.general, positionEncodings: ['utf-16'] };
      data.params.capabilities.workspace = { configuration: true, workspaceFolders: true };
      data.params.capabilities.textDocument.definition = { linkSupport: true, dynamicRegistration: true };
      message = JSON.stringify(data);
    }
    if (data.id !== undefined && data.method) this.pending.add(data.id);
    if (this.failure) {
      if (data.id !== undefined && data.method) this.deliverError(data.id, this.failure);
      return;
    }
    this.outbound = this.outbound.then(() => this.failure ? undefined : this.write(message)).then(() => {}, error => this.close(asError(error)));
  }
  private rootName() { return decodeURIComponent(this.info.rootUri.replace(/\/$/, '').split('/').pop() ?? this.info.rootUri); }
  private deliver(message: string) { for (const handler of this.handlers) handler(message); }
  private deliverError(id: string | number, error: Error) {
    this.pending.delete(id);
    this.deliver(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32097, message: error.message } }));
  }
  receive(message: string) {
    if (this.failure) return;
    const data = JSON.parse(message);
    if (data.id !== undefined && data.method) {
      let result: unknown, supported = true;
      if (data.method === 'workspace/configuration') result = (data.params?.items ?? []).map((item: { section?: string }) => settingSection(this.info.settings ?? {}, item.section, this.info.serverId));
      else if (data.method === 'workspace/workspaceFolders') result = [{ uri: this.info.rootUri, name: this.rootName() }];
      else if (data.method === 'window/workDoneProgress/create') result = null;
      else if (data.method === 'client/registerCapability' || data.method === 'client/unregisterCapability') {
        const registrations = data.params?.registrations ?? data.params?.unregistrations ?? data.params?.unregisterations ?? [];
        supported = registrations.every((item: { method: string }) => item.method === 'textDocument/definition');
        if (supported) this.onDefinitionCapability(data.method === 'client/registerCapability');
        result = null;
      } else supported = false;
      this.send(JSON.stringify({ jsonrpc: '2.0', id: data.id, ...(supported ? { result } : { error: { code: -32601, message: 'Horizon does not support this server request' } }) }));
      return;
    }
    if (data.id !== undefined) {
      this.pending.delete(data.id);
      const encoding = data.result?.capabilities?.positionEncoding;
      if (encoding && encoding !== 'utf-16') {
        const error = new Error(`语言服务器选择了不支持的位置编码：${encoding}`);
        this.deliverError(data.id, error); this.close(error); return;
      }
    }
    this.deliver(message);
  }
  close(error = new Error('语言服务已停止。')) {
    if (this.failure) return;
    this.failure = error;
    for (const id of [...this.pending]) this.deliverError(id, error);
    this.onClosed(error);
  }
}

type BufferFile = WorkspaceFile & {
  buffer: EditorBuffer; key: string; path: string; contentVersion: number; current: Text;
  pending: ChangeSet; view: EditorView | null;
};

/** Documents follow buffers, independently of the single visible EditorView. */
export class BufferWorkspace extends Workspace {
  files: BufferFile[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private released = false;
  constructor(client: LSPClient, private projectId: string) { super(client); }
  track(buffer: EditorBuffer, uri: string, languageId: string) {
    let file = this.files.find(file => file.uri === uri);
    if (file) { file.buffer = buffer; return file; }
    const doc = buffer.contentIdentity instanceof Text ? buffer.contentIdentity : Text.of(buffer.getText().split(/\r\n?|\n/));
    file = {
      uri, languageId, key: buffer.key, path: buffer.path, buffer, version: buffer.version,
      doc, current: doc, pending: ChangeSet.empty(doc.length), contentVersion: buffer.contentVersion, view: null,
      getView() { return this.view; },
    };
    this.files.push(file); this.client.didOpen(file); return file;
  }
  openFile(uri: string, _languageId: string, view: EditorView) {
    const file = this.files.find(file => file.uri === uri);
    if (file) file.view = view;
  }
  closeFile(uri: string, view: EditorView) {
    const file = this.files.find(file => file.uri === uri);
    if (file?.view === view) file.view = null;
  }
  changed(event: EditorDocumentChange) {
    const file = this.files.find(file => file.key === event.key);
    if (!file || file.buffer !== event.buffer || this.released) return;
    const changes = event.changes;
    const next = event.contentIdentity instanceof Text ? event.contentIdentity : null;
    if (changes && changes.length === file.current.length && next) {
      file.pending = file.pending.compose(changes); file.current = next;
    } else this.replace(file);
    this.scheduleSync();
  }
  private replace(file: BufferFile) {
    const next = file.buffer.contentIdentity instanceof Text ? file.buffer.contentIdentity : Text.of(file.buffer.getText().split(/\r\n?|\n/));
    const replacement = ChangeSet.of({ from: 0, to: file.current.length, insert: next }, file.current.length);
    file.pending = file.pending.compose(replacement); file.current = next;
    file.contentVersion = file.buffer.contentVersion;
  }
  reconcile() {
    if (this.released) return;
    for (const file of [...this.files]) {
      const buffer = editorStore.getBuffer(this.projectId, file.buffer.fileId);
      if (!buffer || buffer.evicted || buffer.mode !== 'editor' || buffer.simplified || buffer.key !== file.key || buffer.path !== file.path) {
        this.client.didClose(file.uri); this.files = this.files.filter(item => item !== file); continue;
      }
      if (buffer !== file.buffer || buffer.contentVersion !== file.contentVersion) {
        file.buffer = buffer; this.replace(file); this.scheduleSync();
      }
    }
  }
  syncFiles() {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    const updates = [];
    for (const file of this.files) if (!file.pending.empty) {
      const prevDoc = file.doc, changes = file.pending;
      file.doc = file.current; file.version = Math.max(file.version + 1, file.buffer.version);
      file.pending = ChangeSet.empty(file.doc.length);
      const plugin = file.view && LSPPlugin.get(file.view);
      if (plugin?.client === this.client) plugin.clear();
      updates.push({ file, prevDoc, changes });
    }
    return updates;
  }
  private scheduleSync() {
    if (!this.timer) this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.released) this.client.sync();
    }, 40);
  }
  disconnected() { this.released = true; if (this.timer) clearTimeout(this.timer); this.files = []; }
}

function closeSession(session: Session, error: Error, stop: boolean) {
  if (session.closed) return;
  session.closed = true; session.error = error;
  session.transport.close(error); session.client.disconnect(); sessions.delete(session.info.sessionId);
  for (const [key, pending] of bindings) {
    void pending.promise.then(binding => { if (binding?.session === session && bindings.get(key) === pending) bindings.delete(key); }).catch(() => {});
  }
  for (const context of views) if (context.current?.session === session) {
    context.current = undefined;
    queueMicrotask(() => { if (!context.disposed) context.view.dispatch({ effects: context.compartment.reconfigure([]) }); });
  }
  if (stop) void call('language_server_stop', { sessionId: session.info.sessionId }, session.projectId).catch(() => {});
}

async function connect(buffer: EditorBuffer, choice: ServiceChoice, generation: number): Promise<Binding> {
  let info: Connection | undefined;
  const early: NativeEvent[] = [];
  const receive = (event: NativeEvent) => {
    if (!info) { early.push(event); return; }
    const session = sessions.get(info.sessionId);
    if (session) {
      if (event.type === 'message') session.transport.receive(event.message);
      else closeSession(session, new Error(event.error || '语言服务已停止。'), false);
    }
  };
  const channel = new Channel<NativeEvent>(); channel.onmessage = receive;
  const reply = await invoke<Reply<Connection>>('horizon_subscribe', { call: {
    protocolVersion: 1, requestId: crypto.randomUUID(), method: 'language_server_connect',
    scope: { kind: 'project', projectId: buffer.projectId, projectEpoch: getProjectEpoch(buffer.projectId) },
    params: { fileId: buffer.fileId, serverId: choice.definition.id, expectedRevision: choice.state.revision }, idempotencyKey: crypto.randomUUID(),
  }, channel });
  if (!reply.ok) throw Object.assign(new Error(reply.error.message), { code: reply.error.code });
  info = reply.data;
  const shared = sessions.get(info.sessionId);
  if (shared) {
    // Rust retains the first connection's channel when another file reuses the
    // session. That channel may already hold the shared client's initialize
    // response, even if this original file binding became obsolete meanwhile.
    // Route session traffic before checking the caller's document lifetime.
    for (const event of early.splice(0)) receive(event);
    if (shared.closed) throw shared.error ?? canceled();
  }
  if (currentGeneration(buffer.projectId) !== generation || !chooseService(buffer) || chooseService(buffer)?.fingerprint !== choice.fingerprint) {
    if (!sessions.has(info.sessionId)) void call('language_server_stop', { sessionId: info.sessionId }, buffer.projectId).catch(() => {});
    throw canceled();
  }
  let session = sessions.get(info.sessionId);
  if (!session) {
    const connection = info;
    const client = new LSPClient({
      rootUri: info.rootUri, initializationOptions: info.initializationOptions, timeout: 15_000,
      workspace: client => new BufferWorkspace(client, buffer.projectId),
      // Only navigation is enabled; message dialogs from a background prewarm
      // must not take focus from the document being edited.
      notificationHandlers: { 'window/showMessage': () => true },
    });
    session = {
      info, projectId: buffer.projectId, client, workspace: client.workspace as BufferWorkspace,
      transport: undefined!, ready: undefined!, closed: false,
    };
    const created = session;
    created.transport = new NativeLanguageTransport(info,
      message => call('language_server_send', { sessionId: connection.sessionId, message }, buffer.projectId),
      error => closeSession(created, error, true),
      enabled => { if (client.serverCapabilities) client.serverCapabilities.definitionProvider = enabled; });
    sessions.set(info.sessionId, created);
    client.connect(created.transport);
    created.ready = client.initializing.then(() => {
      if (created.closed) throw created.error ?? canceled();
      if (connection.settings && Object.keys(connection.settings).length) client.notification('workspace/didChangeConfiguration', { settings: connection.settings });
    }).catch(error => { closeSession(created, asError(error), true); throw error; });
    void created.ready.catch(() => {});
  }
  for (const event of early.splice(0)) receive(event);
  await session.ready;
  if (session.closed || currentGeneration(buffer.projectId) !== generation || editorStore.getBuffer(buffer.projectId, buffer.fileId) !== buffer || buffer.evicted) throw canceled();
  session.workspace.track(buffer, info.fileUri, info.languageId);
  await restoreWorkspaceBuffers(session);
  return { buffer, session, uri: info.fileUri, languageId: info.languageId, fingerprint: choice.fingerprint };
}

async function restoreWorkspaceBuffers(session: Session): Promise<void> {
  if (session.restoring) return session.restoring;
  const generation = currentGeneration(session.projectId);
  const pending = (async () => {
    const open = [...editorStore.getSnapshot().buffers.values()].filter(buffer =>
      buffer.projectId === session.projectId && buffer.mode === 'editor' && !buffer.evicted && !buffer.simplified
      && !session.workspace.files.some(file => file.key === buffer.key));
    await Promise.all(open.map(async buffer => {
      const choice = chooseService(buffer);
      if (!choice || choice.state.id !== session.info.extensionId || choice.definition.id !== session.info.serverId) return;
      const key = buffer.key, fileId = buffer.fileId, path = buffer.path;
      // Resolve an existing buffer into this workspace without creating another
      // process. A new/restarted server must see all unsaved overlays before a
      // definition query, including documents that currently have no view.
      const document = await call<{ fileUri: string; languageId: string } | null>('language_server_document', {
        sessionId: session.info.sessionId, fileId,
      }, session.projectId);
      if (session.closed || currentGeneration(session.projectId) !== generation) throw canceled();
      if (!document || buffer.key !== key || buffer.fileId !== fileId || buffer.path !== path || editorStore.getBuffer(buffer.projectId, fileId) !== buffer || buffer.evicted) return;
      session.workspace.track(buffer, document.fileUri, document.languageId);
    }));
  })();
  session.restoring = pending;
  try { await pending; }
  finally { if (session.restoring === pending) session.restoring = undefined; }
}

async function ensureBinding(buffer: EditorBuffer, retry = false): Promise<Binding | null> {
  if (!nativeAvailable() || buffer.mode !== 'editor' || buffer.evicted || buffer.simplified) return null;
  const generation = currentGeneration(buffer.projectId);
  if (!pluginRuntime.getSnapshot(buffer.projectId).length) await refreshPlugins(buffer.projectId);
  if (generation !== currentGeneration(buffer.projectId)) throw canceled();
  const choice = chooseService(buffer);
  if (!choice) return null;
  let pending = bindings.get(buffer.key);
  if (pending && (pending.generation !== generation || retry && pending.error)) { bindings.delete(buffer.key); pending = undefined; }
  if (!pending) {
    const record: PendingBinding = { generation, extensionId: choice.state.id, revision: choice.state.revision, promise: undefined! };
    record.promise = connect(buffer, choice, generation).catch(error => { record.error = error; throw error; });
    bindings.set(buffer.key, record); pending = record;
  }
  const binding = await pending.promise;
  if (binding && (binding.buffer !== buffer || binding.fingerprint !== choice.fingerprint || binding.session.closed)) {
    bindings.delete(buffer.key); return ensureBinding(buffer, retry);
  }
  return binding;
}

async function attach(context: ViewBinding) {
  const request = ++context.request;
  try {
    const binding = await ensureBinding(context.buffer);
    if (context.disposed || context.request !== request || !binding || binding.session.closed) return;
    context.current = binding;
    context.view.dispatch({ effects: context.compartment.reconfigure(binding.session.client.plugin(binding.uri, binding.languageId)) });
  } catch { /* Prewarm errors are surfaced when navigation is explicitly requested. */ }
}

async function navigationBinding(context: ViewBinding): Promise<Binding | null> {
  const { buffer, current } = context;
  const choice = chooseService(buffer);
  if (current && current.buffer === buffer && !current.session.closed && current.fingerprint === choice?.fingerprint
    && (choice.state.runState === 'active' || choice.state.runState === 'activating')) return current;
  // Only a cold/released/sleeping service needs a fresh lifecycle revision.
  // Warm navigation uses the already subscribed policy and connection.
  await refreshPlugins(buffer.projectId, true);
  try { return await ensureBinding(buffer, true); }
  catch (error) {
    if ((error as { code?: string })?.code !== 'STALE_VERSION') throw error;
    await refreshPlugins(buffer.projectId, true);
    return ensureBinding(buffer, true);
  }
}

export function semanticExtension(buffer: EditorBuffer): Extension {
  const compartment = new Compartment();
  return [compartment.of([]), ViewPlugin.define(view => {
    const context: ViewBinding = { buffer, view, compartment, policy: chooseService(buffer, true)?.fingerprint ?? null, disposed: false, request: 0 };
    views.add(context); void attach(context);
    return { destroy() { context.disposed = true; context.request++; views.delete(context); queries.get(view)?.cancel(); } };
  })];
}

export function normalizeDefinitions(result: Definition | DefinitionLink[] | null): DefinitionTarget[] {
  const values = result === null ? [] : Array.isArray(result) ? result : [result];
  const unique = new Map<string, DefinitionTarget>();
  for (const value of values) {
    const uri = 'targetUri' in value ? value.targetUri : value.uri;
    const range = 'targetUri' in value ? value.targetSelectionRange : value.range;
    if (!uri || !range || ![range.start.line, range.start.character, range.end.line, range.end.character].every(value => Number.isInteger(value) && value >= 0)) continue;
    unique.set(JSON.stringify([uri, range]), { uri, range });
  }
  return [...unique.values()];
}

export async function getDefinitions(view: EditorView, pos = view.state.selection.main.head): Promise<DefinitionTarget[]> {
  queries.get(view)?.cancel();
  const context = [...views].find(context => context.view === view && !context.disposed);
  if (!context) throw new Error('当前文件没有可用的语言服务。');
  const { buffer } = context, version = buffer.version, sourceDoc = view.state.doc;
  const generation = currentGeneration(buffer.projectId);
  let rejected = false;
  let requestSession: Session | undefined, requestParams: unknown;
  const operation = { cancel() { rejected = true; if (requestParams) requestSession?.client.cancelRequest(requestParams); } };
  queries.set(view, operation);
  try {
    const binding = await navigationBinding(context);
    if (!binding) throw new Error('此语言尚未启用语义跳转插件。');
    await restoreWorkspaceBuffers(binding.session);
    if (rejected || context.disposed || buffer.version !== version || view.state.doc !== sourceDoc) throw canceled();
    const session = requestSession = binding.session;
    if (context.current !== binding) {
      context.current = binding;
      view.dispatch({ effects: context.compartment.reconfigure(session.client.plugin(binding.uri, binding.languageId)) });
    }
    if (!session.client.serverCapabilities?.definitionProvider) throw new Error('语言服务器不支持跳转到定义。');
    session.client.sync();
    const offset = Math.max(0, Math.min(pos, sourceDoc.length)), line = sourceDoc.lineAt(offset);
    const params = { textDocument: { uri: binding.uri }, position: { line: line.number - 1, character: offset - line.from } };
    requestParams = params;
    const baselines = new Map(session.workspace.files.map(file => [file.uri, {
      key: file.key, buffer: file.buffer, version: file.buffer.version, contentVersion: file.buffer.contentVersion, doc: file.current,
    }]));
    const result = await session.client.request<typeof params, Definition | DefinitionLink[] | null>('textDocument/definition', params);
    if (rejected || context.disposed || session.closed || generation !== currentGeneration(buffer.projectId) || buffer.version !== version || view.state.doc !== sourceDoc) throw canceled();
    const targets = normalizeDefinitions(result);
    for (const target of targets) {
      const file = session.workspace.files.find(file => file.uri === target.uri);
      const baseline = baselines.get(target.uri);
      if (baseline && (!file || file.buffer !== baseline.buffer || file.buffer.version !== baseline.version || file.buffer.contentVersion !== baseline.contentVersion || file.current !== baseline.doc)) throw canceled();
      if (file && !baseline) throw canceled();
      if (baseline) targetSnapshots.set(target, baseline);
    }
    return targets;
  } catch (error) { throw asError(error); }
  finally { if (queries.get(view) === operation) queries.delete(view); }
}

export function cancelDefinitionRequest(view?: EditorView): void {
  if (view) queries.get(view)?.cancel();
  else for (const context of views) queries.get(context.view)?.cancel();
}

function targetIsCurrent(target: DefinitionTarget) {
  const snapshot = targetSnapshots.get(target);
  if (!snapshot) return true;
  const buffer = editorStore.getSnapshot().buffers.get(snapshot.key);
  return buffer === snapshot.buffer && !buffer.evicted && buffer.version === snapshot.version && buffer.contentVersion === snapshot.contentVersion;
}

export async function openDefinition(projectId: string, target: DefinitionTarget, isCurrent: () => boolean = () => true): Promise<void> {
  if (!isCurrent() || !targetIsCurrent(target)) throw canceled();
  const generation = currentGeneration(projectId), source = editorStore.getActive(projectId), version = source?.version;
  const epoch = getProjectEpoch(projectId);
  const file = await call<FileRef>('language_server_resolve', { uri: target.uri }, projectId);
  if (!isCurrent() || !targetIsCurrent(target) || currentGeneration(projectId) !== generation || getProjectEpoch(projectId) !== epoch || editorStore.getSnapshot().activeProjectId !== projectId || editorStore.getActive(projectId) !== source || source?.version !== version) throw canceled();
  const opened = await editorStore.openFile(file.fileId, { projectId, line: target.range.start.line, column: target.range.start.character });
  if (!opened) throw new Error('无法打开定义所在的文件。');
}

export function releaseLanguageServices(projectId?: string): void {
  const projects = new Set([...bindings.keys()].map(key => key.split('\u0000')[0]));
  for (const context of views) projects.add(context.buffer.projectId);
  if (projectId) projects.add(projectId);
  for (const project of projects) if (!projectId || project === projectId) generations.set(project, currentGeneration(project) + 1);
  for (const [key] of bindings) if (!projectId || key.startsWith(`${projectId}\u0000`)) bindings.delete(key);
  for (const session of [...sessions.values()]) if (!projectId || session.projectId === projectId) closeSession(session, new Error('语言服务已释放。'), true);
}

editorStore.subscribeDocumentChanges(event => {
  for (const session of sessions.values()) if (session.projectId === event.buffer.projectId && !session.closed) session.workspace.changed(event);
  for (const context of views) if (context.buffer.key === event.key) queries.get(context.view)?.cancel();
});
editorStore.subscribe(() => {
  for (const session of sessions.values()) session.workspace.reconcile();
  for (const [key] of bindings) {
    const buffer = editorStore.getSnapshot().buffers.get(key);
    if (!buffer || buffer.evicted || buffer.mode !== 'editor') bindings.delete(key);
  }
});
editorStore.subscribeRekeys((previousKey, buffer) => {
  bindings.delete(previousKey);
  for (const session of sessions.values()) session.workspace.reconcile();
  for (const context of views) if (context.buffer === buffer) { context.current = undefined; void attach(context); }
});
pluginRuntime.subscribe(() => {
  for (const session of [...sessions.values()]) {
    const state = pluginRuntime.getSnapshot(session.projectId).find(state => state.id === session.info.extensionId);
    // An explicit wake can return before the extension event updates the UI's
    // cached sleeping snapshot. Only snapshots at/after this native activation
    // revision may close its new session; a later real stop still takes effect
    // even while the language-server initialize request is pending.
    if (state && state.revision < session.info.revision) continue;
    if (!state || !available(state) || state.runState === 'sleeping') closeSession(session, new Error('语义插件已停用或休眠。'), true);
  }
  for (const context of views) if (!context.disposed) {
    const policy = chooseService(context.buffer, true)?.fingerprint ?? null;
    const policyChanged = policy !== context.policy;
    context.policy = policy;
    const choice = chooseService(context.buffer);
    const pending = bindings.get(context.buffer.key);
    if (!choice || pending?.error && (pending.extensionId !== choice.state.id || pending.revision !== choice.state.revision)) bindings.delete(context.buffer.key);
    // Native stop emits intermediate stopped/active snapshots before sleeping.
    // Only an actual enable/resume/install/provider change may auto-start here.
    // Runtime status notifications must never enqueue a replacement process.
    if (policyChanged && choice && choice.state.runState !== 'sleeping') void attach(context);
  }
});
