import { useSyncExternalStore } from 'react';
import type { UiSlotId } from '../../../../../packages/plugins/src/types';
import { useSlot } from './service';
import { getWorkerCommands, subscribeWorkerCommands } from './workerHost';

/** Only host-rendered text/list/tree models cross the isolated runtime boundary. */
export function PluginSlot({ slot, projectId }: { slot: UiSlotId; projectId?: string }) {
  const contributions = useSlot(slot); const commands = useSyncExternalStore(subscribeWorkerCommands, getWorkerCommands);
  return <>{contributions.filter(item => item.projectId === projectId && item.view).map(item => <section className="plugin-contributed-view" aria-label={item.view!.title} key={`${item.activationId}:${item.id}`}><h3>{item.view!.title}</h3>{item.view!.items.length ? <ul>{item.view!.items.map(row => {
    const command = row.commandId && commands.find(command => command.id === `${item.activationId}:${row.commandId}`);
    return <li key={row.id}>{command ? <button onClick={command.execute}>{row.label}</button> : <span>{row.label}</span>}{row.description && <small>{row.description}</small>}</li>;
  })}</ul> : <p>没有条目</p>}</section>)}</>;
}
