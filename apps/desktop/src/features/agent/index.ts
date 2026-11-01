export { AgentPanel } from './AgentPanel';
export { AgentSettings } from './AgentSettings';
export { queueAgentContext } from './store';
import { registerPluginLifecycle } from '../plugins/service';
import { agentView, running, cancelAgent } from './store';
registerPluginLifecycle('horizon.agent', {
  prepareDeactivate: async ({ projectId }) => {
    if (projectId && running(agentView.get(projectId).status)) await cancelAgent(projectId);
    return { ready: true, blockers: [] };
  },
  dispose: ({ projectId }) => { if (projectId) agentView.patch(projectId, { status: 'idle', task: undefined, permission: null }); },
});
