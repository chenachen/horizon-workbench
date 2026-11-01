// Public names remain compatible with existing consumers; execution lives in QuickJS sidecars.
import { call, onEvent } from '../../bridge';
import { pluginRuntime, refreshPlugins, registerPluginLifecycle } from './service';
import type { ActivationContext, DeclarativeView, PluginManifest } from '../../../../../packages/plugins/src/types';

export interface WorkerCommand { id: string; extensionId: string; projectId?: string; title: string; execute(): void }
interface RuntimeEvent { extensionId: string; activationId: string; projectId?: string; event: 'command' | 'commandRemove' | 'view' | 'viewRemove' | 'failed'; data: { id: string; view?: DeclarativeView; message?: string } }
let commandSnapshot: readonly WorkerCommand[] = [];
const commandListeners = new Set<() => void>();
const abortListeners = new Set<() => void>();
const liveViewMaps = new Set<Map<string, { dispose(): void | Promise<void> }>>();
export const subscribeWorkerCommands = (listener: () => void) => { commandListeners.add(listener); return () => { commandListeners.delete(listener); }; };
export const getWorkerCommands = () => commandSnapshot;
export const getWorkerDiagnostics = () => ({
  workerAbortListeners: abortListeners.size,
  workerCommandObservers: commandListeners.size,
  workerCommands: commandSnapshot.length,
  workerViews: [...liveViewMaps].reduce((count, views) => count + views.size, 0),
});
function removeCommands(activationId: string) { commandSnapshot = commandSnapshot.filter(command => !command.id.startsWith(`${activationId}:`)); commandListeners.forEach(listener => listener()); }
const registered = new Map<string, PluginManifest>();

async function runQuickJs(manifest: PluginManifest, context: ActivationContext) {
  const id = manifest.id;
  const views = new Map<string, { dispose(): void | Promise<void> }>();
  liveViewMaps.add(views);
  let disposed = false;
  let unlisten: (() => Promise<void>) | undefined;
  let listenerCleanup: Promise<void> | undefined;
  const cleanupUi = () => {
    if (!disposed) {
      disposed = true;
      context.signal.removeEventListener('abort', abort); abortListeners.delete(abort);
      for (const view of views.values()) void view.dispose();
      views.clear(); liveViewMaps.delete(views); removeCommands(context.activationId);
    }
    // A listen request can finish after abort. Its eventual registration still needs disposal.
    if (unlisten && !listenerCleanup) listenerCleanup = unlisten();
    return listenerCleanup ?? Promise.resolve();
  };
  const dispose = async () => {
    const results = await Promise.allSettled([cleanupUi(), call('extension_runtime_stop', { extensionId: id, activationId: context.activationId }, context.projectId)]);
    const failures = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
    if (failures.length) throw new AggregateError(failures, '扩展部分资源清理失败');
  };
  const failed = () => { void cleanupUi().catch(() => {}); void refreshPlugins(context.projectId).catch(() => {}); };
  const abort = () => { abortListeners.delete(abort); void dispose().catch(() => {}); };
  context.signal.addEventListener('abort', abort, { once: true });
  abortListeners.add(abort);
  try {
    // Subscribe before activation so synchronous command/view registrations cannot be lost.
    unlisten = await onEvent<RuntimeEvent>('horizon.extension.runtime.v1', payload => {
      if (disposed || payload.extensionId !== id || payload.activationId !== context.activationId || (payload.projectId ?? undefined) !== context.projectId) return;
      const data = payload.data;
      if (payload.event === 'failed') { void failed(); return; }
      if (payload.event === 'view') {
        const declaration = manifest.contributes.views?.find(view => view.id === data.id && view.renderer === 'declarative');
        if (!declaration || !data.view) return;
        void views.get(data.id)?.dispose();
        views.set(data.id, pluginRuntime.registerSlot({ id: data.id, extensionId: id, activationId: context.activationId, projectId: context.projectId, slot: declaration.slot, title: data.view.title, view: data.view }));
      } else if (payload.event === 'viewRemove') { void views.get(data.id)?.dispose(); views.delete(data.id); }
      else if (payload.event === 'command') {
        const command = manifest.contributes.commands?.find(command => command.id === data.id);
        if (!command) return;
        const commandId = `${context.activationId}:${data.id}`;
        commandSnapshot = [...commandSnapshot.filter(command => command.id !== commandId), {
          id: commandId, extensionId: id, projectId: context.projectId, title: command.title,
          execute: () => { void call('extension_runtime_execute', { extensionId: id, activationId: context.activationId, commandId: data.id }, context.projectId).catch(() => { void refreshPlugins(context.projectId).catch(() => {}); }); },
        }];
        commandListeners.forEach(listener => listener());
      } else if (payload.event === 'commandRemove') {
        commandSnapshot = commandSnapshot.filter(command => command.id !== `${context.activationId}:${data.id}`);
        commandListeners.forEach(listener => listener());
      }
    }, { owner: 'workerHost' });
    if (context.signal.aborted) { await dispose(); return; }
    await call('extension_runtime_activate', { extensionId: id, activationId: context.activationId }, context.projectId);
    if (context.signal.aborted) { await dispose(); return; }
    return dispose;
  } catch (error) {
    await dispose().catch(() => {});
    throw error;
  }
}
export function registerWorkerPackage(manifest: PluginManifest) {
  if (manifest.runtime.kind !== 'quickjs') return;
  const prior = registered.get(manifest.id);
  registered.set(manifest.id, manifest);
  if (prior) return;
  registerPluginLifecycle(manifest.id, { activate: context => {
    const current = pluginRuntime.getSnapshot(context.projectId).find(state => state.id === manifest.id)?.manifest;
    // An update may replace executable code with a declarative package under the same ID.
    if (current?.runtime.kind !== 'quickjs') return;
    return runQuickJs(current, context);
  } });
}
