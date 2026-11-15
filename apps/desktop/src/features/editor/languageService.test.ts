import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangeSet, Text } from '@codemirror/state';
import { LSPClient } from '@codemirror/lsp-client';
import type { EditorView } from '@codemirror/view';
import type { EditorBuffer } from '../../../../../packages/editor/src/types';

const mocks = vi.hoisted(() => ({ buffers: new Map<string, EditorBuffer>(), call: vi.fn(), openFile: vi.fn(), active: undefined as EditorBuffer | undefined }));
vi.mock('../../bridge', () => ({ call: mocks.call, getProjectEpoch: () => 1, nativeAvailable: () => false }));
vi.mock('../plugins/service', () => ({ pluginRuntime: { getSnapshot: () => [], subscribe: () => () => {} }, refreshPlugins: vi.fn() }));
vi.mock('./store', () => ({ editorStore: {
  getBuffer: (projectId: string, fileId: string) => mocks.buffers.get(`${projectId}\u0000${fileId}`),
  getSnapshot: () => ({ buffers: mocks.buffers, activeProjectId: 'A' }),
  getActive: () => mocks.active, openFile: mocks.openFile,
  subscribe: () => () => {}, subscribeDocumentChanges: () => () => {}, subscribeRekeys: () => () => {},
} }));

import { BufferWorkspace, NativeLanguageTransport, normalizeDefinitions, openDefinition } from './languageService';

const info = { sessionId: 'session', projectId: 'A', extensionId: 'fixture.semantic', serverId: 'rust', rootUri: 'file:///project', fileUri: 'file:///project/main.rs', languageId: 'rust', revision: 1, settings: { checkOnSave: false } };
const turn = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
const range = (line: number, character: number) => ({ start: { line, character }, end: { line, character: character + 1 } });
function buffer(id: string, text = 'let value = 1;\n'.repeat(150)): EditorBuffer {
  const doc = Text.of(text.split('\n'));
  const value: EditorBuffer = {
    key: `A\u0000${id}`, projectId: 'A', fileId: id, path: `${id}.rs`, mode: 'editor', simplified: false,
    dirty: false, saving: false, conflict: false, preview: false, loading: false, version: 1, savedVersion: 1,
    contentVersion: 0, selection: { anchor: 0, head: 0 }, scrollTop: 0, getText: vi.fn(() => doc.toString()),
    contentIdentity: doc, checkpointVersion: 1, lastUsed: 1,
  };
  mocks.buffers.set(value.key, value); return value;
}

const clients: LSPClient[] = [];
beforeEach(() => { mocks.buffers.clear(); mocks.active = undefined; vi.clearAllMocks(); });
afterEach(() => { for (const client of clients.splice(0)) client.disconnect(); });

async function harness() {
  const messages: Record<string, any>[] = [];
  let workspace!: BufferWorkspace;
  const client = new LSPClient({ workspace: client => workspace = new BufferWorkspace(client, 'A') });
  clients.push(client);
  const transport = new NativeLanguageTransport(info, async text => {
    const message = JSON.parse(text); messages.push(message);
    if (message.method === 'initialize') transport.receive(JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { capabilities: { definitionProvider: true, textDocumentSync: 2 } } }));
  }, () => {});
  client.connect(transport); await client.initializing; await turn();
  return { client, workspace, transport, messages };
}

describe('native LSP transport', () => {
  it('advertises UTF-16 and the implemented workspace operations', async () => {
    const { messages } = await harness();
    const init = messages.find(message => message.method === 'initialize')!;
    expect(init.params.capabilities.general.positionEncodings).toEqual(['utf-16']);
    expect(init.params.capabilities.workspace).toEqual({ configuration: true, workspaceFolders: true });
    expect(init.params.capabilities.textDocument.definition.linkSupport).toBe(true);
    expect(init.params.workspaceFolders).toEqual([{ uri: 'file:///project', name: 'project' }]);
  });

  it('handles configuration requests without forwarding them to the limited stock client', async () => {
    const { transport, messages } = await harness();
    transport.receive(JSON.stringify({ jsonrpc: '2.0', id: 'server-config', method: 'workspace/configuration', params: { items: [{ section: 'rust-analyzer' }, { section: 'missing' }] } }));
    await turn();
    expect(messages.find(message => message.id === 'server-config')).toEqual({ jsonrpc: '2.0', id: 'server-config', result: [{ checkOnSave: false }, null] });
    transport.receive(JSON.stringify({ jsonrpc: '2.0', id: 'watch', method: 'client/registerCapability', params: { registrations: [{ method: 'workspace/didChangeWatchedFiles' }] } }));
    await turn();
    expect(messages.find(message => message.id === 'watch')?.error.code).toBe(-32601);
  });

  it('rejects pending requests immediately when the native pipe closes', async () => {
    const { client, transport } = await harness();
    const pending = client.request('textDocument/definition', {});
    await turn();
    const rejection = expect(pending).rejects.toMatchObject({ message: 'native EOF' });
    transport.close(new Error('native EOF'));
    await rejection;
  });

  it('rejects an initialization response selecting another position encoding', async () => {
    const responses: any[] = [], closed = vi.fn();
    const transport = new NativeLanguageTransport(info, async () => {}, closed);
    transport.subscribe(message => responses.push(JSON.parse(message)));
    transport.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { capabilities: { textDocument: {} } } }));
    transport.receive(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { capabilities: { positionEncoding: 'utf-8' } } }));
    expect(responses[0].error.message).toContain('utf-8');
    expect(closed).toHaveBeenCalledOnce();
  });
});

describe('buffer-backed LSP workspace', () => {
  it('composes exact background changes and sends incremental ranges without rereading text', async () => {
    const { workspace, client, messages } = await harness();
    const value = buffer('background'), original = value.contentIdentity as Text;
    workspace.track(value, 'file:///project/background.rs', 'rust'); await turn();
    const first = ChangeSet.of({ from: 4, to: 9, insert: 'name' }, original.length);
    let current = first.apply(original); value.contentIdentity = current; value.version++;
    workspace.changed({ buffer: value, key: value.key, version: value.version, changes: first, contentIdentity: current });
    const second = ChangeSet.of({ from: 0, insert: '// 😀\n' }, current.length);
    current = second.apply(current); value.contentIdentity = current; value.version++;
    workspace.changed({ buffer: value, key: value.key, version: value.version, changes: second, contentIdentity: current });
    client.sync(); await turn();
    const changes = messages.filter(message => message.method === 'textDocument/didChange');
    expect(changes).toHaveLength(1);
    expect(changes[0].params.textDocument).toEqual({ uri: 'file:///project/background.rs', version: 3 });
    expect(changes[0].params.contentChanges.every((change: any) => change.range)).toBe(true);
    expect(workspace.files[0].doc.toString()).toBe(current.toString());
    expect(value.getText).not.toHaveBeenCalled();
  });

  it('keeps documents open across tab switches and closes them on buffer eviction', async () => {
    const { workspace, messages } = await harness();
    const value = buffer('main'), uri = 'file:///project/main.rs';
    workspace.track(value, uri, 'rust');
    const view = {} as EditorView;
    workspace.openFile(uri, 'rust', view); workspace.closeFile(uri, view); await turn();
    expect(workspace.files).toHaveLength(1);
    expect(messages.filter(message => message.method === 'textDocument/didClose')).toHaveLength(0);
    value.evicted = true; workspace.reconcile(); await turn();
    expect(workspace.files).toHaveLength(0);
    expect(messages.filter(message => message.method === 'textDocument/didClose')).toHaveLength(1);
  });

  it('synchronizes a disk reload that replaces a buffer without an edit event', async () => {
    const { workspace, client, messages } = await harness();
    const previous = buffer('main'); workspace.track(previous, 'file:///project/main.rs', 'rust'); await turn();
    const reloaded = buffer('main', 'let reloaded = true;');
    workspace.reconcile(); client.sync(); await turn();
    expect(workspace.files[0].buffer).toBe(reloaded);
    expect(messages.find(message => message.method === 'textDocument/didChange')?.params.contentChanges).toEqual([{ text: 'let reloaded = true;' }]);
  });

  it('closes the old URI when a tracked buffer is renamed', async () => {
    const { workspace } = await harness();
    const value = buffer('main'); workspace.track(value, 'file:///project/main.rs', 'rust');
    value.path = 'renamed.rs'; workspace.reconcile();
    expect(workspace.files).toHaveLength(0);
  });
});

describe('definition targets', () => {
  it('keeps every unique Location or LocationLink selection range', () => {
    const a = { uri: 'file:///a.ts', range: range(1, 2) };
    expect(normalizeDefinitions([a, a, { uri: 'file:///b.ts', range: range(0, 3) }])).toEqual([a, { uri: 'file:///b.ts', range: range(0, 3) }]);
    expect(normalizeDefinitions([{ targetUri: 'file:///a.ts', targetRange: range(0, 0), targetSelectionRange: range(2, 4) }])).toEqual([{ uri: 'file:///a.ts', range: range(2, 4) }]);
    expect(normalizeDefinitions(null)).toEqual([]);
  });

  it('does not open a target if the user cancels while native URI resolution is pending', async () => {
    mocks.active = buffer('main');
    let resolve!: (value: unknown) => void;
    mocks.call.mockReturnValue(new Promise(done => { resolve = done; }));
    let current = true;
    const pending = openDefinition('A', { uri: 'file:///target.rs', range: range(2, 4) }, () => current);
    current = false; resolve({ fileId: 'target', projectId: 'A', displayPath: 'target.rs' });
    await expect(pending).rejects.toThrow('重新跳转');
    expect(mocks.openFile).not.toHaveBeenCalled();
  });

  it('does not open a target if the source buffer changes while resolution is pending', async () => {
    const source = mocks.active = buffer('main');
    let resolve!: (value: unknown) => void;
    mocks.call.mockReturnValue(new Promise(done => { resolve = done; }));
    const pending = openDefinition('A', { uri: 'file:///target.rs', range: range(2, 4) });
    source.version++; resolve({ fileId: 'target', projectId: 'A', displayPath: 'target.rs' });
    await expect(pending).rejects.toThrow('重新跳转');
    expect(mocks.openFile).not.toHaveBeenCalled();
  });
});
