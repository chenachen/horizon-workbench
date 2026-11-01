import React, { useEffect, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Context, Service } from 'cordis';

const metrics = { mounts: 0, unmounts: 0, activations: 0, cleanups: 0, events: 0, timers: 0 };
const listeners = new Set();
let snapshot = Object.freeze({ layout: 'left', theme: 'light', sidebarWidth: 220 });
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => snapshot;
const patch = value => { snapshot = Object.freeze({ ...snapshot, ...value }); listeners.forEach(fn => fn()); };

function Editor() {
  useEffect(() => { metrics.mounts++; return () => { metrics.unmounts++; }; }, []);
  return <textarea aria-label="document" defaultValue="unsaved draft" />;
}

function Workbench() {
  const current = useSyncExternalStore(subscribe, getSnapshot);
  return <main data-layout={current.layout} data-theme={current.theme}
    style={{ display: 'grid', gridTemplateColumns: current.layout === 'left' ? `${current.sidebarWidth}px 1fr` : '1fr',
      background: current.theme === 'light' ? '#fff' : '#202530', color: current.theme === 'light' ? '#222' : '#eee' }}>
    <nav>Project / files</nav><section><Editor /></section>
  </main>;
}

class Availability extends Service {
  constructor(ctx) { super(ctx, 'availability'); }
}

const Consumer = {
  name: 'research.consumer', inject: ['availability'],
  apply(ctx) {
    metrics.activations++;
    ctx.on('research/ping', () => { metrics.events++; });
    ctx.effect(() => {
      const timer = setInterval(() => { metrics.timers++; }, 10);
      return () => { clearInterval(timer); metrics.cleanups++; };
    });
  },
};

async function start() {
  const context = new Context();
  const consumer = context.plugin(Consumer);
  let provider;
  const reactRoot = createRoot(document.getElementById('app'));
  reactRoot.render(<Workbench />);
  window.research = {
    metrics, patch,
    environment: { nodeProcess: typeof globalThis.process, require: typeof globalThis.require },
    pending: () => consumer.state,
    provide: async () => { provider = await context.plugin(Availability); await consumer; },
    removeProvider: () => provider.dispose(),
    ping: () => context.emit('research/ping'),
    shutdown: async () => { reactRoot.unmount(); await context.fiber.dispose(); },
    subscribers: () => listeners.size,
  };
}
start().catch(error => { window.researchError = String(error); });
