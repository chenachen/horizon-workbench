import assert from 'node:assert/strict';
import test from 'node:test';
import { PluginRuntime } from '../src/runtime';
import { builtinLayouts, builtinPackages, builtinThemes } from '../src/builtins';
import { validateLayout, validateManifest } from '../src/validation';
import type { ExtensionState, PluginManifest } from '../src/types';
const active = (id: string, activationId: string, manifest?: PluginManifest): ExtensionState => ({ id, revision: 1, installedVersion: '0.1.0', installState: 'installed', pausedGlobal: false, pausedProject: false, effectivePaused: false, enabledGlobal: true, projectOverride: 'inherit', effectiveEnabled: true, runState: 'active', activationId, dependents: [], ownedResourceCount: 1, uiReclaim: 'released', manifest });

test('eight independent layout topologies and themes validate', () => {
  assert.equal(builtinLayouts.length, 8); assert.equal(builtinThemes.length, 8);
  builtinPackages.forEach(validateManifest);
  assert.equal(new Set(builtinLayouts.map(layout => JSON.stringify(layout.root))).size, 8);
  const invalid = structuredClone(builtinLayouts[0]); invalid.root = { id: 'duplicate', kind: 'row', children: [{ id: 'editor', kind: 'slot', slot: 'editor' }, { id: 'editor', kind: 'slot', slot: 'editor' }] };
  assert.throws(() => validateLayout(invalid), /重复/);
});

test('native revocation disposes registrations, hooks and owned resources', async () => {
  const runtime = new PluginRuntime(); let activation = 0, disposals = 0, stopped = 0;
  runtime.registerLifecycle('horizon.git', { activate: context => { activation++; context.own(() => { disposals++; }); }, dispose: () => { stopped++; } });
  const state = active('horizon.git', 'lease-a'); await runtime.syncNative([state], 'A');
  assert.equal(activation, 1); assert.equal(runtime.getSlotSnapshot('primarySidebar').length, 1);
  const stable = runtime.getSlotSnapshot('primarySidebar'); await runtime.syncNative([state], 'A');
  assert.equal(runtime.getSlotSnapshot('primarySidebar'), stable); assert.equal(activation, 1);
  await runtime.syncNative([{ ...state, effectiveEnabled: false, runState: 'stopped', activationId: undefined }], 'A');
  assert.equal(disposals, 1); assert.equal(stopped, 1); assert.equal(runtime.getSlotSnapshot('primarySidebar').length, 0);
  await runtime.syncNative([{ ...state, activationId: 'lease-b' }], 'A'); assert.equal(activation, 2);
  await runtime.dispose(); assert.equal(disposals, 2);
});

test('pausing project A leaves project B activation and contributions intact', async () => {
  const runtime = new PluginRuntime(); const disposed: string[] = [];
  runtime.registerLifecycle('horizon.git', { activate: context => context.own(() => { disposed.push(context.projectId!); }) });
  await runtime.syncNative([active('horizon.git', 'a')], 'A'); await runtime.syncNative([active('horizon.git', 'b')], 'B');
  await runtime.syncNative([{ ...active('horizon.git', 'a'), effectivePaused: true, runState: 'paused', activationId: undefined }], 'A');
  assert.deepEqual(disposed, ['A']); assert.deepEqual(runtime.getSlotSnapshot('primarySidebar').map(s => s.projectId), ['B']);
  assert.equal(runtime.isEnabled('horizon.git', 'A'), false); assert.equal(runtime.isEnabled('horizon.git', 'B'), true);
  await runtime.dispose();
});

test('Cordis dependency services order providers before consumers and revoke together', async () => {
  const runtime = new PluginRuntime(); const events: string[] = [];
  const manifest = { ...builtinPackages.find(p => p.id === 'horizon.git')!, id: 'local.consumer', requires: { 'horizon.git': '^0.1.0' }, contributes: {} };
  runtime.registerLifecycle('local.consumer', { activate: context => { events.push('start'); return context.own(() => { events.push('stop'); }); } });
  await runtime.syncNative([active('local.consumer', 'consumer', manifest), active('horizon.git', 'provider')], 'A');
  assert.deepEqual(events, ['start']);
  await runtime.syncNative([], 'A'); assert.deepEqual(events, ['start', 'stop']);
  await runtime.dispose();
});

test('failed activation releases resources in reverse order and leaves unrelated plugins usable', async () => {
  const runtime = new PluginRuntime(); const disposed: string[] = []; const failures: string[] = [];
  runtime.onActivationError(state => { failures.push(state.id); });
  runtime.registerLifecycle('horizon.git', { activate: context => { context.own(async () => { await Promise.resolve(); disposed.push('first'); }); context.own(() => { disposed.push('second'); }); throw new Error('activation rejected'); } });
  await runtime.syncNative([active('horizon.git', 'broken'), active('horizon.search', 'healthy')], 'A');
  assert.deepEqual(disposed, ['second', 'first']); assert.deepEqual(failures, ['horizon.git']);
  assert.equal(runtime.getSnapshot('A').find(state => state.id === 'horizon.git')?.runState, 'failed');
  assert.equal(runtime.getSlotSnapshot('primarySidebar').some(slot => slot.extensionId === 'horizon.git'), false);
  assert.equal(runtime.getSlotSnapshot('primarySidebar').some(slot => slot.extensionId === 'horizon.search'), true);
  await runtime.dispose(); assert.deepEqual(disposed, ['second', 'first']);
});

test('late lifecycle registration handles rejected activation and removes its instance', async () => {
  const runtime = new PluginRuntime(); let disposed = 0;
  await runtime.syncNative([active('horizon.git', 'late')], 'A');
  const failed = new Promise<void>(resolve => runtime.onActivationError(() => resolve()));
  runtime.registerLifecycle('horizon.git', { activate: async context => { context.own(() => { disposed++; }); throw new Error('late hook rejected'); } });
  await failed;
  assert.equal(disposed, 1); assert.equal(runtime.getSlotSnapshot('primarySidebar').length, 0);
  await runtime.dispose(); assert.equal(disposed, 1);
});

test('diagnostics count actual Cordis callbacks, including once and fiber-local update subscriptions', async () => {
  const runtime = new PluginRuntime(); const baseline = runtime.getDiagnostics();
  const event = Symbol('diagnostic-subscription'); let off!: () => boolean;
  const fiber = runtime.context.plugin({ name: 'diagnostic-callbacks', apply(ctx) {
    ctx.on(event, () => {}); ctx.once(event, () => {});
    ctx.on('internal/update', (_config, next) => next());
    off = ctx.on(event, () => {});
  } });
  await fiber;
  assert.equal(runtime.getDiagnostics().cordisPluginListeners, baseline.cordisPluginListeners + 4);
  runtime.context.emit(event);
  assert.equal(runtime.getDiagnostics().cordisPluginListeners, baseline.cordisPluginListeners + 3);
  await off();
  assert.equal(runtime.getDiagnostics().cordisPluginListeners, baseline.cordisPluginListeners + 2);
  await fiber.dispose();
  assert.equal(runtime.getDiagnostics().cordisPluginListeners, baseline.cordisPluginListeners);
  assert.equal(runtime.getDiagnostics().cordisRootListeners, baseline.cordisRootListeners);
  const stopStateObserver = runtime.subscribe(() => {}), stopErrorObserver = runtime.onActivationError(() => {});
  assert.equal(runtime.getDiagnostics().pluginStoreObservers, 1); assert.equal(runtime.getDiagnostics().activationErrorObservers, 1);
  stopStateObserver(); stopStateObserver(); stopErrorObserver(); stopErrorObserver();
  assert.equal(runtime.getDiagnostics().pluginStoreObservers, 0); assert.equal(runtime.getDiagnostics().activationErrorObservers, 0);
  await runtime.dispose();
});

test('diagnostics retain disposing instances until their actual asynchronous cleanup completes', async () => {
  const runtime = new PluginRuntime(); let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  runtime.registerLifecycle('horizon.git', { activate: context => context.own(() => context.projectId === 'A' ? pending : undefined) });
  await runtime.syncNative([active('horizon.git', 'a')], 'A'); await runtime.syncNative([active('horizon.git', 'b')], 'B');
  assert.equal(runtime.getDiagnostics().pluginInstances, 2);
  const stopping = runtime.stop('horizon.git', { reason: 'pause', projectId: 'A' });
  assert.equal(runtime.getDiagnostics().pluginInstances, 2); assert.equal(runtime.getDiagnostics().pluginInstancesDisposing, 1);
  release(); await stopping;
  assert.equal(runtime.getDiagnostics().pluginInstances, 1); assert.equal(runtime.getDiagnostics().pluginInstancesDisposing, 0);
  await runtime.dispose(); assert.equal(runtime.getDiagnostics().pluginInstances, 0);
});

test('a failed cleanup stays counted even when Cordis catches the effect rejection', async () => {
  const runtime = new PluginRuntime();
  runtime.registerLifecycle('horizon.git', { activate: context => context.own(async () => { throw new Error('unlisten rejected'); }) });
  await runtime.syncNative([active('horizon.git', 'failed-cleanup')], 'A');
  await assert.rejects(runtime.stop('horizon.git', { reason: 'disable', projectId: 'A' }), /扩展部分资源清理失败/);
  assert.equal(runtime.getDiagnostics().pluginInstances, 1); assert.equal(runtime.getDiagnostics().pluginInstancesDisposing, 1);
  await runtime.dispose();
});
