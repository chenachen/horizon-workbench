import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionState, PluginManifest } from '../../../../../packages/plugins/src/types';

const mocks = vi.hoisted(() => ({
  snapshots: new Map<string, ExtensionState[]>(),
  listeners: new Set<() => void>(),
  refresh: vi.fn(), activate: vi.fn(), read: vi.fn(), create: vi.fn(), dispose: vi.fn(), report: vi.fn(),
}));
vi.mock('../../bridge', () => ({ nativeAvailable: () => true, call: mocks.read }));
vi.mock('../plugins/service', () => ({
  pluginRuntime: {
    getSnapshot: (projectId: string) => mocks.snapshots.get(projectId) ?? [],
    subscribe: (listener: () => void) => { mocks.listeners.add(listener); return () => mocks.listeners.delete(listener); },
  },
  refreshPlugins: mocks.refresh,
  activatePlugin: mocks.activate,
}));
vi.mock('./textmate', () => ({ createTextmateLanguage: mocks.create, disposeTextmateLanguage: mocks.dispose }));
vi.mock('./store', () => ({ editorStore: { reportError: mocks.report } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function extension(): ExtensionState {
  const manifest: PluginManifest = {
    id: 'local.fixture', name: 'Fixture', version: '0.1.0', description: '', author: 'Fixture',
    apiVersion: 1, engines: { horizon: '>=0.1.0 <0.2.0' }, runtime: { kind: 'declarative' },
    activation: ['onLanguage:fixture'], requires: {}, optional: {}, capabilities: [],
    contributes: {
      languages: [{ id: 'fixture', extensions: ['.fixture'], filenames: ['Fixturefile'] }],
      grammars: [{ language: 'fixture', scopeName: 'source.fixture', path: 'syntaxes/fixture.json' }],
    },
  };
  return {
    id: manifest.id, revision: 1, installedVersion: '0.1.0', installState: 'installed',
    enabledGlobal: true, pausedGlobal: false, pausedProject: false, effectivePaused: false,
    projectOverride: 'inherit', effectiveEnabled: true, runState: 'active', activationId: 'fixture',
    dependents: [], ownedResourceCount: 0, uiReclaim: 'released', manifest,
  };
}
function publish() { for (const listener of mocks.listeners) listener(); }
const turn = async () => { for (let count = 0; count < 8; count++) await Promise.resolve(); };
let service: typeof import('./syntax').syntaxService;
let state: ExtensionState;

beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); mocks.listeners.clear(); mocks.snapshots.clear();
  mocks.refresh.mockResolvedValue(undefined); mocks.activate.mockResolvedValue(undefined);
  mocks.create.mockImplementation(async () => []);
  mocks.read.mockResolvedValue({ scopeName: 'source.fixture', patterns: [], repository: {} });
  state = extension(); mocks.snapshots.set('A', [state]);
  service = (await import('./syntax')).syntaxService;
});

describe('language plugin catalog', () => {
  it('matches declared suffixes and filenames and reads grammar through the native resource API', async () => {
    expect(service.languageId('A', 'src/main.FIXTURE')).toBe('fixture');
    expect(service.languageId('A', 'src/Fixturefile')).toBe('fixture');
    expect(service.languageId('A', 'src/plain.txt')).toBe('plain');
    await service.load('A', 'main.fixture');
    await service.load('A', 'other.fixture');
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const input = mocks.create.mock.calls[0][0];
    expect(await input.loadGrammar('source.fixture')).toMatchObject({ scopeName: 'source.fixture' });
    expect(mocks.read).toHaveBeenCalledWith('extension_read_grammar', { extensionId: 'local.fixture', scopeName: 'source.fixture' }, 'A');
  });

  it('reconfigures on enable, pause, uninstall and same-manifest resource reload', async () => {
    const listener = vi.fn(); service.subscribe(listener);
    const firstRevision = service.getRevision('A');
    await service.load('A', 'main.fixture');
    state.revision++; publish();
    expect(service.getRevision('A')).toBeGreaterThan(firstRevision);
    await service.load('A', 'main.fixture');
    expect(mocks.create).toHaveBeenCalledTimes(2);
    state.effectivePaused = true; publish();
    expect(service.languageId('A', 'main.fixture')).toBe('plain');
    expect(await service.load('A', 'main.fixture')).toEqual([]);
    state.effectivePaused = false; state.effectiveEnabled = false; publish();
    expect(service.languageId('A', 'main.fixture')).toBe('plain');
    state.effectiveEnabled = true; state.installState = 'absent'; publish();
    expect(service.languageId('A', 'main.fixture')).toBe('plain');
    state.installState = 'installed'; publish();
    expect(service.languageId('A', 'main.fixture')).toBe('fixture');
    await turn();
    expect(mocks.dispose).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalled();
  });

  it('keeps per-project policies independent', () => {
    mocks.snapshots.set('B', [{ ...state, effectiveEnabled: false }]);
    expect(service.languageId('A', 'main.fixture')).toBe('fixture');
    expect(service.languageId('B', 'main.fixture')).toBe('plain');
  });

  it('uses plain text when the associated grammar provider is unavailable', async () => {
    state.manifest!.contributes.grammars = [];
    expect(service.languageId('A', 'main.fixture')).toBe('plain');
    expect(await service.load('A', 'main.fixture')).toEqual([]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('disposes an obsolete highlighter that finishes loading after its plugin is disabled', async () => {
    const highlighter = deferred<[]>(); mocks.create.mockReturnValue(highlighter.promise);
    const pending = service.load('A', 'main.fixture');
    state.effectiveEnabled = false; publish();
    const obsolete: [] = []; highlighter.resolve(obsolete);
    await pending; await turn();
    expect(mocks.dispose).toHaveBeenCalledWith(obsolete);
    expect(service.languageId('A', 'main.fixture')).toBe('plain');
  });

  it('does not allocate a highlighter after a project is released during native refresh', async () => {
    mocks.snapshots.clear();
    const refresh = deferred<void>(); mocks.refresh.mockReturnValue(refresh.promise);
    const pending = service.load('A', 'main.fixture');
    service.release('A');
    mocks.snapshots.set('A', [state]); refresh.resolve();
    expect(await pending).toEqual([]);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('does not allocate a highlighter after a project is released during activation', async () => {
    state.runState = 'stopped';
    const activation = deferred<void>(); mocks.activate.mockReturnValue(activation.promise);
    const pending = service.load('A', 'main.fixture');
    service.release('A'); activation.resolve();
    expect(await pending).toEqual([]);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
