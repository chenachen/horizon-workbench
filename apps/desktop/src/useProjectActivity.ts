import { useEffect, useState } from 'react';
import { call, errorMessage, nativeAvailable, onEvent } from './bridge';

export type ProjectResource = { resourceId: string; projectId?: string | null; owner?: { projectId?: string | null }; ownerExtensionId: string; kind: string; state: string; title?: string | null; label?: string | null; pid?: number | null };
export type ProjectActivitySnapshot = { resources: ProjectResource[]; updatedAt: string | null; error: string };
export function useProjectActivity() {
  const [activity, setActivity] = useState<ProjectActivitySnapshot>({ resources: [], updatedAt: null, error: '' });
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true, pending = false, signature = '';
    const refresh = async () => {
      if (!active || pending || document.hidden) return;
      pending = true;
      try {
        const result = await call<{ items: ProjectResource[] }>('resource_list');
        const next = result.items.map(item => ({ ...item, projectId: item.projectId ?? item.owner?.projectId })).filter(item => item.projectId && !['stopped', 'exited', 'disposed'].includes(item.state));
        const key = JSON.stringify(next.map(item => [item.resourceId, item.projectId, item.ownerExtensionId, item.kind, item.state, item.title, item.label, item.pid, item.owner]));
        if (active) {
          const changed = key !== signature, updatedAt = new Date().toISOString(); signature = key;
          setActivity(previous => ({ resources: changed ? next : previous.resources, updatedAt, error: '' }));
        }
      } catch (error) {
        if (active) { const message = errorMessage(error); setActivity(previous => previous.error === message ? previous : { ...previous, error: message }); }
      }
      finally { pending = false; }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    const listeners = ['horizon.process.v1', 'horizon.launch.v1', 'horizon.extension.v1'].map(topic => onEvent(topic, () => void refresh()));
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); for (const listener of listeners) void listener.then(close => close()).catch(() => {}); };
  }, []);
  return activity;
}
