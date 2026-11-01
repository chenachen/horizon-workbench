import { Context, Service, type Fiber } from 'cordis';
import { builtinById } from './builtins';
import type { ActivationContext, Disposable, ExtensionState, LifecycleRequest, PluginLifecycle, SlotContribution, UiSlotId } from './types';

const EMPTY: readonly ExtensionState[] = Object.freeze([]);
const EMPTY_SLOTS: readonly SlotContribution[] = Object.freeze([]);
type Instance = { controller: AbortController; resources: Array<Disposable | (() => void | Promise<void>)>; dispose: () => Promise<void>; state: ExtensionState; projectId?: string; fiber?: Fiber; disposing: boolean };
const keyFor = (id: string, projectId?: string) => `${projectId ?? '@app'}:${id}`;
class ActivationLease extends Service { constructor(context: Context, key: string, readonly activationId: string) { super(context, key); } }
async function disposeResources(resources: Instance['resources']) {
  const failures: unknown[] = [];
  for (const resource of resources.splice(0).reverse()) try { await (typeof resource === 'function' ? resource() : resource.dispose()); } catch (error) { failures.push(error); }
  if (failures.length) throw new AggregateError(failures, '扩展部分资源清理失败');
}

/** Native state is authoritative. Cordis owns the lifetime of allowed UI contributions. */
export class PluginRuntime {
  readonly context = new Context();
  private states = new Map<string, readonly ExtensionState[]>();
  private instances = new Map<string, Instance>();
  private ownedInstances = new Set<Instance>();
  private hooks = new Map<string, Set<PluginLifecycle>>();
  private listeners = new Set<() => void>();
  private errorListeners = new Set<(state: ExtensionState, projectId: string | undefined, error: unknown) => void>();
  private contributions = new Map<string, SlotContribution>();
  private slotSnapshots = new Map<UiSlotId, readonly SlotContribution[]>();
  private queue: Promise<void> = Promise.resolve();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  onActivationError = (listener: (state: ExtensionState, projectId: string | undefined, error: unknown) => void) => { this.errorListeners.add(listener); return () => { this.errorListeners.delete(listener); }; };
  getSnapshot = (projectId?: string) => this.states.get(projectId ?? '@app') ?? EMPTY;
  getSlotSnapshot = (slot: UiSlotId) => this.slotSnapshots.get(slot) ?? EMPTY_SLOTS;
  getDiagnostics() {
    // Cordis 4.0.0-rc.12 exposes the actual callback collections in its types.
    // Event hooks and fiber-local update hooks are disjoint; effects are not listeners.
    const hooks = Reflect.ownKeys(this.context.events._hooks).flatMap(key => this.context.events._hooks[key]);
    const fibers = new Set([...this.context.registry.values()].flatMap(runtime => [...runtime.fibers]));
    for (const instance of this.ownedInstances) if (instance.fiber) fibers.add(instance.fiber);
    const localListeners = (fiber: Fiber) => Object.values(fiber._hooks).reduce((count, listeners) => count + listeners.length, 0);
    return {
      pluginInstances: this.ownedInstances.size,
      pluginInstancesDisposing: [...this.ownedInstances].filter(instance => instance.disposing).length,
      cordisRootListeners: hooks.filter(hook => hook.ctx.fiber === this.context.fiber).length + localListeners(this.context.fiber),
      cordisPluginListeners: hooks.filter(hook => hook.ctx.fiber !== this.context.fiber).length + [...fibers].reduce((count, fiber) => count + localListeners(fiber), 0),
      pluginStoreObservers: this.listeners.size,
      activationErrorObservers: this.errorListeners.size,
    };
  }
  isEnabled = (id: string, projectId?: string) => this.getSnapshot(projectId).some(state => state.id === id && state.installState === 'installed' && state.effectiveEnabled && !state.effectivePaused && state.runState !== 'failed' && state.runState !== 'cleanupFailed');
  registerLifecycle(id: string, hooks: PluginLifecycle): () => void {
    const list = this.hooks.get(id) ?? new Set(); list.add(hooks); this.hooks.set(id, list);
    for (const instance of this.instances.values()) if (instance.state.id === id) void this.activateHook(hooks, instance).catch(error => this.failInstance(instance, error));
    return () => { list.delete(hooks); if (!list.size) this.hooks.delete(id); };
  }
  private async activateHook(hook: PluginLifecycle, instance: Instance) {
    if (!hook.activate || instance.controller.signal.aborted) return;
    const resource = await hook.activate({ activationId: instance.state.activationId!, projectId: instance.projectId, signal: instance.controller.signal, own: item => { if (!instance.resources.includes(item)) instance.resources.push(item); return item; } });
    if (resource && !instance.resources.includes(resource)) { if (instance.controller.signal.aborted) await (typeof resource === 'function' ? resource() : resource.dispose()); else instance.resources.push(resource); }
  }
  private async failInstance(instance: Instance, error: unknown) {
    const key = keyFor(instance.state.id, instance.projectId);
    if (this.instances.get(key) !== instance) return;
    this.instances.delete(key);
    try { await instance.dispose(); } catch (cleanup) { error = new AggregateError([error, cleanup], '扩展激活及清理失败'); }
    const states = this.states.get(instance.projectId ?? '@app');
    if (states) this.states.set(instance.projectId ?? '@app', Object.freeze(states.map(state => state.id === instance.state.id && state.activationId === instance.state.activationId ? Object.freeze({ ...state, runState: 'failed' as const, error: { code: 'EXTENSION_FAILED', message: error instanceof Error ? error.message : String(error) } }) : state)));
    this.publish();
    for (const listener of this.errorListeners) listener(instance.state, instance.projectId, error);
  }
  async prepareDeactivate(id: string, request: LifecycleRequest): Promise<{ ready: boolean; blockers: string[] }> {
    const results = await Promise.all([...this.hooks.get(id) ?? []].map(h => h.prepareDeactivate?.(request)));
    return { ready: results.every(r => !r || r.ready), blockers: results.flatMap(r => r?.blockers ?? []) };
  }
  async stop(id: string, request: LifecycleRequest): Promise<void> {
    for (const [key, instance] of this.instances) if (instance.state.id === id && (!request.projectId || request.projectId === instance.projectId)) { this.instances.delete(key); await instance.dispose(); }
    for (const hook of this.hooks.get(id) ?? []) await hook.dispose?.(request);
    this.publish();
  }
  registerSlot(contribution: SlotContribution): Disposable {
    const key = `${contribution.activationId}:${contribution.id}`;
    this.contributions.set(key, Object.freeze(contribution)); this.publish();
    return { dispose: () => { this.contributions.delete(key); this.publish(); } };
  }
  syncNative(states: ExtensionState[], projectId?: string): Promise<void> {
    this.queue = this.queue.catch(() => {}).then(async () => {
      this.states.set(projectId ?? '@app', Object.freeze(states.map(s => Object.freeze(s))));
      for (const [key, instance] of [...this.instances].reverse()) {
        if (instance.projectId !== projectId) continue;
        const next = states.find(s => s.id === instance.state.id);
        if (!next?.effectiveEnabled || next.effectivePaused || next.installState !== 'installed' || next.activationId !== instance.state.activationId || !['active', 'activating'].includes(next.runState)) {
          this.instances.delete(key); await instance.dispose();
          for (const hook of this.hooks.get(instance.state.id) ?? []) await hook.dispose?.({ reason: next?.installState === 'absent' ? 'uninstall' : next?.effectivePaused ? 'pause' : 'disable', projectId });
        }
      }
      const ordered: ExtensionState[] = []; const visited = new Set<string>();
      const visit = (state: ExtensionState) => { if (visited.has(state.id)) return; visited.add(state.id); for (const dependency of Object.keys((state.manifest ?? builtinById.get(state.id))?.requires ?? {})) { const provider = states.find(s => s.id === dependency); if (provider) visit(provider); } ordered.push(state); };
      states.forEach(visit);
      for (const state of ordered) {
        if (!state.effectiveEnabled || state.effectivePaused || state.installState !== 'installed' || !['active', 'activating'].includes(state.runState) || !state.activationId) continue;
        const key = keyFor(state.id, projectId); if (this.instances.has(key)) continue;
        const resources: Instance['resources'] = []; const controller = new AbortController();
        const instance: Instance = { controller, resources, state, projectId, dispose: async () => {}, disposing: false };
        let resourceFailure: unknown;
        const releaseResources = async () => {
          try { await disposeResources(resources); } catch (error) { resourceFailure = error; }
          // Cordis logs effect cleanup failures internally. Preserve the failure for our owner.
          if (resourceFailure) throw resourceFailure;
        };
        const manifest = state.manifest ?? builtinById.get(state.id);
        const dependencies = Object.keys(manifest?.requires ?? {}).map(id => keyFor(id, projectId));
        if (dependencies.some(dependency => !this.instances.has(dependency))) continue;
        const fiber = this.context.plugin({ name: state.id, inject: dependencies, apply: ctx => { new ActivationLease(ctx, key, state.activationId!); ctx.effect(() => { for (const view of manifest?.contributes.views ?? []) if (view.renderer === 'trusted') resources.push(this.registerSlot({ id: view.id, title: manifest!.name, extensionId: state.id, activationId: state.activationId!, projectId, slot: view.slot })); return async () => { controller.abort(); await releaseResources(); }; }); } });
        instance.fiber = fiber.ctx.fiber;
        this.ownedInstances.add(instance);
        let disposing: Promise<void> | undefined;
        instance.dispose = () => disposing ??= (async () => { instance.disposing = true; controller.abort(); try { await fiber.dispose(); } finally { await releaseResources(); } this.ownedInstances.delete(instance); })();
        this.instances.set(key, instance);
        try {
          await fiber;
          for (const hook of this.hooks.get(state.id) ?? []) await this.activateHook(hook, instance);
        } catch (error) { await this.failInstance(instance, error); }
      }
      this.publish();
    });
    return this.queue;
  }
  private publish() {
    for (const slot of ['navigation', 'primarySidebar', 'editor', 'auxiliary', 'bottom', 'status', 'overlay'] as UiSlotId[]) {
      const next = [...this.contributions.values()].filter(v => v.slot === slot);
      const previous = this.slotSnapshots.get(slot) ?? EMPTY_SLOTS;
      if (previous.length !== next.length || previous.some((v, i) => v !== next[i])) this.slotSnapshots.set(slot, Object.freeze(next));
    }
    for (const listener of this.listeners) listener();
  }
  async dispose() { const failures: unknown[] = []; for (const instance of [...this.instances.values()].reverse()) try { await instance.dispose(); } catch (error) { failures.push(error); } this.instances.clear(); await this.context.fiber.dispose(); this.listeners.clear(); this.errorListeners.clear(); if (failures.length) throw new AggregateError(failures, '扩展部分资源清理失败'); }
}
export const pluginRuntime = new PluginRuntime();
