export type ConfigurationScope = 'global' | 'project';
type Draft = Readonly<Record<string, unknown>>;
interface ConfigurationDrafts { scope: ConfigurationScope; global: Draft; project: Draft }

const emptyGlobal: ConfigurationDrafts = { scope: 'global', global: {}, project: {} };
const emptyProject: ConfigurationDrafts = { scope: 'project', global: {}, project: {} };
// Keep unsaved form values through page unmounts, only for this app window.
const drafts = new Map<string, ConfigurationDrafts>();
const listeners = new Set<() => void>();
const contextKey = (extensionId: string, projectId?: string) => JSON.stringify([extensionId, projectId ?? null]);

function get(extensionId: string, projectId?: string): ConfigurationDrafts {
  return drafts.get(contextKey(extensionId, projectId)) ?? (projectId ? emptyProject : emptyGlobal);
}
function update(extensionId: string, projectId: string | undefined, next: ConfigurationDrafts) {
  drafts.set(contextKey(extensionId, projectId), next);
  for (const listener of listeners) listener();
}

export const configurationDrafts = {
  get,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  setScope(extensionId: string, projectId: string | undefined, scope: ConfigurationScope) {
    update(extensionId, projectId, { ...get(extensionId, projectId), scope });
  },
  setValue(extensionId: string, projectId: string | undefined, scope: ConfigurationScope, key: string, value: unknown) {
    const current = get(extensionId, projectId);
    update(extensionId, projectId, { ...current, [scope]: { ...current[scope], [key]: value } });
  },
  saved(extensionId: string, projectId: string | undefined, scope: ConfigurationScope, key: string, savedDraft: unknown) {
    const current = get(extensionId, projectId);
    // An edit made while this save was in flight is still unsaved.
    if (!(key in current[scope]) || !Object.is(current[scope][key], savedDraft)) return;
    const next = { ...current[scope] };
    delete next[key];
    update(extensionId, projectId, { ...current, [scope]: next });
  },
  discard(extensionId: string, projectId: string | undefined, scope: ConfigurationScope) {
    update(extensionId, projectId, { ...get(extensionId, projectId), [scope]: {} });
  },
};
