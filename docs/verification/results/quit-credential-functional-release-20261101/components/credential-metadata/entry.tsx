import React from 'react';
import { createRoot } from 'react-dom/client';
import { AgentSettings } from './apps/desktop/src/features/agent/AgentSettings';

const kind = window.scenarioKind;
const make = (id, authState = 'verified', authOwner = 'horizon', withRef = true) => ({
  connectionId: id, adapterId: 'pi', revision: 1, authState, authOwner,
  runtime: { source: 'managed', version: '1.4.0' },
  provider: { id: 'owned', model: 'owned-model', api: 'openai-completions', endpoint: 'http://127.0.0.1:1/v1', label: id, ...(withRef ? { credentialRef: 'ref-' + id } : {}) },
});
const h = window.credentialHarness = {
  calls: [], connections: [], credentials: [],
  reply(call, data) { return { ok: true, requestId: call.requestId, data }; },
  invoke(command, { call }) {
    h.calls.push({ command, method: call.method, params: structuredClone(call.params) });
    let data;
    switch (call.method) {
      case 'agent_detect': data = { ownership: 'managed', installed: true, supported: true, version: '1.4.0', path: '/owned/pi', requiredVersion: '1.4.0', downloadBytes: 1, source: 'owned', diagnostics: [] }; break;
      case 'agent_connections_list': data = { items: structuredClone(h.connections) }; break;
      case 'credential_list': data = { items: structuredClone(h.credentials) }; break;
      case 'agent_preferences_get': data = { revision: 1, effectiveConnectionId: null, projectConnectionId: null }; break;
      case 'credential_set': {
        const { connectionId, persistence } = call.params;
        const credentialRef = h.connections.find(c => c.connectionId === connectionId)?.provider.credentialRef ?? 'ref-' + connectionId;
        h.credentials = [...h.credentials.filter(c => c.credentialRef !== credentialRef), { connectionId, credentialRef, persistence, configured: true }];
        data = { credentialRef, configured: true }; break;
      }
      case 'agent_connection_save': {
        const input = structuredClone(call.params.connection);
        const previous = h.connections.find(c => c.connectionId === input.connectionId);
        const saved = { ...input, revision: (previous?.revision ?? 0) + 1, authState: 'configured' };
        h.connections = [...h.connections.filter(c => c.connectionId !== saved.connectionId), saved];
        data = { connectionId: saved.connectionId, revision: saved.revision }; break;
      }
      default: throw Error('Unexpected production RPC ' + call.method);
    }
    return Promise.resolve(h.reply(call, data));
  },
  capture() {
    return {
      calls: structuredClone(h.calls), connections: structuredClone(h.connections), credentials: structuredClone(h.credentials),
      rows: [...document.querySelectorAll('.agent-connection-row')].map(row => ({
        label: row.querySelector('strong')?.textContent,
        state: row.querySelector('.agent-inline-state')?.textContent,
        good: row.querySelector('.agent-inline-state')?.classList.contains('good'),
      })),
      dialogText: document.querySelector('dialog')?.textContent ?? null,
      passwordValue: document.querySelector('dialog input[type=password]')?.value ?? null,
      passwordPlaceholder: document.querySelector('dialog input[type=password]')?.placeholder ?? null,
    };
  },
};
const add = (connection, persistence, configured = true) => {
  h.connections.push(connection);
  if (connection.provider.credentialRef) h.credentials.push({ connectionId: connection.connectionId, credentialRef: connection.provider.credentialRef, persistence, configured });
};
if (kind === 'expired') {
  add(make('owned-expired', 'configured'), 'session', false);
  add(make('owned-expired-verified'), 'session', false);
} else if (kind === 'live-session') add(make('owned-session'), 'session');
else if (kind === 'system') add(make('owned-system'), 'system');
else if (kind === 'no-ref') {
  add(make('owned-missing', 'configured', 'horizon', false), 'system');
  add(make('owned-external', 'verified', 'external', false), 'system');
  add(make('owned-runtime', 'configured', 'runtime', false), 'system');
} else if (kind === 'scope-to-session') add(make('owned-switch'), 'system');
else if (kind === 'scope-to-system') add(make('owned-switch'), 'session');
createRoot(document.getElementById('root')).render(<AgentSettings />);
