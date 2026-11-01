import { useEffect, useState } from 'react';
import { call, nativeAvailable, onEvent } from './bridge';

export type ProjectResource = { resourceId: string; projectId?: string; ownerExtensionId: string; kind: string; state: string };
export function useProjectActivity() {
  const [resources, setResources] = useState<ProjectResource[]>([]);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let active = true, pending = false, signature = '';
    const refresh = async () => {
      if (!active || pending || document.hidden) return;
      pending = true;
      try {
        const result = await call<{ items: ProjectResource[] }>('resource_list');
        const next = result.items.filter(item => item.projectId && !['stopped', 'exited', 'disposed'].includes(item.state));
        const key = JSON.stringify(next.map(item => [item.resourceId, item.projectId, item.kind, item.state]));
        if (active && key !== signature) { signature = key; setResources(next); }
      } catch { /* Resource counts retry on the next host update. */ }
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
  return resources;
}
