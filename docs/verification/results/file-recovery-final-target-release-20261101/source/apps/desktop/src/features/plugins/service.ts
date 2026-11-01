import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { call, onEvent, start, nativeAvailable } from '../../bridge';
import { pluginRuntime } from '../../../../../packages/plugins/src/runtime';
import type { ExtensionState, PluginLifecycle, UiSlotId } from '../../../../../packages/plugins/src/types';
export { pluginRuntime };
const refreshes = new Map<string, Promise<void>>();
const subscriptions = new Map<string, { count: number; close: Promise<() => void> }>();
const knownProjects = new Set<string | undefined>();
const pendingRefresh = new Set<string>();
let lastError = '';
const errorListeners = new Set<() => void>();
const report = (error: unknown) => { lastError = error instanceof Error ? error.message : String(error); errorListeners.forEach(listener => listener()); };
pluginRuntime.onActivationError((state, projectId, error) => {
  report(error);
  if (nativeAvailable()) void call('extension_report_error', { extensionId: state.id, activationId: state.activationId, message: error instanceof Error ? error.message : String(error) }, projectId).catch(() => {}).finally(() => { void refreshPlugins(projectId).catch(() => {}); });
});
export const usePluginError = () => useSyncExternalStore(listener => { errorListeners.add(listener); return () => errorListeners.delete(listener); }, () => lastError);
export async function refreshPlugins(projectId?: string, fresh = false): Promise<void> {
  if (!nativeAvailable()) return;
  knownProjects.add(projectId);
  const key = projectId ?? '@app';
  let promise = refreshes.get(key);
  if (promise && fresh) {
    // An in-flight list may predate project wake. Finish its UI disposal, then
    // await the follow-up snapshot requested by finally instead of the old one.
    pendingRefresh.add(key);
    await promise.catch(() => {});
    return refreshes.get(key) ?? refreshPlugins(projectId);
  }
  if (!promise) { promise = call<{ items: ExtensionState[] }>('extension_list', { projectId }).then(async ({ items }) => { if (items.some(item => item.manifest?.runtime.kind === 'quickjs')) { const { registerWorkerPackage } = await import('./workerHost'); for (const item of items) if (item.manifest) registerWorkerPackage(item.manifest); } await pluginRuntime.syncNative(items, projectId); if (lastError) { lastError = ''; errorListeners.forEach(listener => listener()); } }).catch(error => { report(error); throw error; }).finally(() => { refreshes.delete(key); if (pendingRefresh.delete(key)) void refreshPlugins(projectId).catch(() => {}); }); refreshes.set(key, promise); }
  return promise;
}
export async function initializePlugins(projectId?: string): Promise<() => void> {
  await refreshPlugins(projectId);
  if (!nativeAvailable()) return () => {};
  const key = projectId ?? '@app'; let entry = subscriptions.get(key);
  if (!entry) { entry = { count: 0, close: onEvent('horizon.extension.v1', () => { for (const project of knownProjects) { if (refreshes.has(project ?? '@app')) pendingRefresh.add(project ?? '@app'); else void refreshPlugins(project).catch(() => {}); } }) }; subscriptions.set(key, entry); }
  entry.count++;
  return () => { const current = subscriptions.get(key); if (current && --current.count === 0) { void current.close.then(close => close()); subscriptions.delete(key); } };
}
export async function activatePlugin(id: string, projectId?: string, event = 'view') {
  if (!nativeAvailable()) return;
  await refreshPlugins(projectId, true);
  const state = pluginRuntime.getSnapshot(projectId).find(s => s.id === id);
  if (state?.runState === 'active' || state?.runState === 'activating' || !state?.effectiveEnabled || state.effectivePaused) return;
  const commandId = state?.manifest?.contributes.commands?.[0]?.id ?? `${id}.open`;
  const handle = await start<ExtensionState>('extension_activate', { extensionId: id, reason: { kind: event === 'command' ? 'command' : 'view', id: event === 'command' ? commandId : `${id}.view` } }, undefined, projectId);
  await handle.result; await refreshPlugins(projectId, true);
}
export function usePlugins(projectId?: string) {
  useEffect(() => { let close: (() => void) | undefined; let gone = false; void initializePlugins(projectId).then(dispose => { if (gone) dispose(); else close = dispose; }).catch(report); return () => { gone = true; close?.(); }; }, [projectId]);
  return useSyncExternalStore(pluginRuntime.subscribe, useCallback(() => pluginRuntime.getSnapshot(projectId), [projectId]));
}
export function usePluginEnabled(id: string, projectId?: string) {
  return useSyncExternalStore(pluginRuntime.subscribe, useCallback(() => pluginRuntime.isEnabled(id, projectId), [id, projectId]));
}
export function useSlot(slot: UiSlotId) { return useSyncExternalStore(pluginRuntime.subscribe, useCallback(() => pluginRuntime.getSlotSnapshot(slot), [slot])); }
export function registerPluginLifecycle(id: string, hooks: PluginLifecycle) { return pluginRuntime.registerLifecycle(id, hooks); }
