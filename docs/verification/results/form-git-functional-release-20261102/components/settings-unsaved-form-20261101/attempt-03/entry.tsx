import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './apps/desktop/src/App.tsx';
import './apps/desktop/src/styles.css';

const h = window.formHarness = {
  calls: [], listeners: new Map(), editorCalls: [], profiles: [], pending: null,
  failConnection: false, holdConnection: false, failProfile: false, holdProfile: false, failSettings: false, failSession: false,
  activeProjectId: 'owned-one', planCount: 0, settingsRevision: 1, settingsValues: {},
  codeBuffer: { text: 'OWNED_CODE_DRAFT_UNSAVED', dirty: true },
  connections: [{ connectionId: 'owned-existing', revision: 3, adapterId: 'pi', runtime: { source: 'managed', version: '1.4.0' }, provider: { id: 'owned-provider', api: 'openai-completions', endpoint: 'http://127.0.0.1:1/v1', model: 'owned-model', label: 'Owned existing', credentialRef: 'owned-ref' }, authOwner: 'horizon', authState: 'verified' }],
  credentials: [{ credentialRef: 'owned-ref', connectionId: 'owned-existing', persistence: 'session', configured: true }],
  projects: ['owned-one', 'owned-two'].map((id, index) => ({ id, workspaceId: 'owned-workspace', displayName: 'Owned project ' + (index + 1), rootDisplayPath: '/owned/' + id, pinned: false, revision: 1, state: 'active' })),
  session: { schemaVersion: 1, revision: 1, tabs: [], activeFileId: null, expandedEntryIds: [], searchDraft: '', commitDraft: '', layout: { panels: {}, focusMode: false, focusRestore: null } },
  appearance: { revision: 1, effective: { layoutId: 'horizon.layout.mist', themeId: 'horizon.theme.mist', mode: 'light', geometryByLayout: {}, colorsByTheme: {}, background: { assetId: null, region: 'workbench', fit: 'cover', opacity: .12, overlay: .85, position: { x: .5, y: .5 } } }, effectiveGeometry: {}, sources: [], layoutSource: 'global', notices: [] },
  bootstrap() { return { protocolVersion: 1, schemaHash: 'owned', workspaces: [{ id: 'owned-workspace', name: 'Owned workspace', projectIds: h.projects.map(p => p.id), revision: 1 }], projects: h.projects, activeProjectId: h.activeProjectId, activeWorkspaceId: 'owned-workspace' }; },
  reply(call, data) { return { ok: true, requestId: call.requestId, data }; },
  error(call, message) { return { ok: false, requestId: call.requestId, error: { code: 'IO_ERROR', message, retryable: true } }; },
  emit(topic) { const listeners = h.listeners.get(topic.replaceAll('.', ':')); if (!listeners?.size) throw Error('No actual App listener for ' + topic); for (const listener of [...listeners]) listener({ payload: {} }); },
  resolvePending(ok) { const pending = h.pending; if (!pending) throw Error('No pending save'); h.pending = null; if (ok && pending.call.method === 'launch_profile_save') h.profiles = [pending.data]; if (ok && pending.call.method === 'agent_connection_save') h.connections = [...h.connections, pending.data]; pending.resolve(ok ? h.reply(pending.call, pending.data) : h.error(pending.call, '受控保存失败')); },
  async invoke(command, { call }) {
    if (command !== 'horizon_call') throw Error('No tasks/model requests permitted: ' + command);
    const params = structuredClone(call.params); if (call.method === 'credential_set') params.secret = '[REDACTED owned component input]';
    h.calls.push({ method: call.method, params, scope: structuredClone(call.scope) });
    let data;
    switch (call.method) {
      case 'app_bootstrap': data = h.bootstrap(); break;
      case 'project_activate': h.activeProjectId = call.params.projectId; data = { project: h.projects.find(p => p.id === h.activeProjectId), projectEpoch: 2, session: h.session }; break;
      case 'resource_list': data = { items: [] }; break;
      case 'session_update': if (h.failSession) return h.error(call, '其他独立操作错误'); data = h.session; break;
      case 'appearance_get': data = h.appearance; break;
      case 'extension_list': data = { items: [] }; break;
      case 'appearance_preset_list': data = { items: [] }; break;
      case 'appearance_preset_save': data = {}; break;
      case 'settings_get': data = { revision: h.settingsRevision, global: h.settingsValues, overrides: {}, effective: { 'ui.fontSize': 13, 'editor.fontSize': 14, ...h.settingsValues }, sources: {} }; break;
      case 'settings_patch': if (h.failSettings) return h.error(call, '受控快捷键保存失败'); Object.assign(h.settingsValues, call.params.set); h.settingsRevision++; data = {}; break;
      case 'agent_detect': data = { ownership: 'managed', installed: true, supported: true, version: '1.4.0', path: '/owned/pi', requiredVersion: '1.4.0', downloadBytes: 0, source: 'owned', diagnostics: [] }; break;
      case 'agent_connections_list': data = { items: h.connections }; break;
      case 'credential_list': data = { items: h.credentials }; break;
      case 'agent_preferences_get': data = { revision: 1, effectiveConnectionId: 'owned-existing', projectConnectionId: null }; break;
      case 'credential_set': data = { credentialRef: 'ref-' + call.params.connectionId }; break;
      case 'agent_connection_save': {
        data = { ...call.params.connection, revision: 4, authState: 'configured' };
        if (h.holdConnection) return new Promise(resolve => { h.pending = { call, data, resolve }; });
        if (h.failConnection) return h.error(call, '受控连接保存失败');
        h.connections = [...h.connections.filter(c => c.connectionId !== data.connectionId), data]; break;
      }
      case 'launch_profile_list': data = { items: h.profiles }; break;
      case 'launch_list': data = { items: [] }; break;
      case 'launch_profile_save': {
        data = { ...call.params.profile, revision: 1 };
        if (h.holdProfile) return new Promise(resolve => { h.pending = { call, data, resolve }; });
        if (h.failProfile) return h.error(call, '受控方案保存失败');
        h.profiles = [data]; break;
      }
      case 'recovery_list': data = { items: [] }; break;
      case 'app_exit_plan': h.planCount++; data = { planId: 'owned-plan-' + h.planCount, digest: 'owned-digest', dirtyDocuments: h.codeBuffer.dirty ? ['owned-code'] : [], documents: h.codeBuffer.dirty ? [{ documentId: 'owned-code', file: { projectId: 'owned-one', fileId: 'owned-code', displayPath: 'owned-code.txt' }, state: 'dirty' }] : [], resources: [] }; break;
      default: throw Error('Unexpected production RPC ' + call.method);
    }
    return h.reply(call, structuredClone(data));
  },
  capture() {
    const form = document.querySelector('.agent-connection-form'), profile = document.querySelector('.profile-editor');
    const fields = form ? [...form.querySelectorAll('input,select')].map(el => ({ label: el.closest('label')?.childNodes[0]?.textContent ?? '', value: el.type === 'password' ? undefined : el.value, passwordPresent: el.type === 'password' ? el.value.length > 0 : undefined })) : null;
    return {
      dialogs: [...document.querySelectorAll('dialog[open]')].map(el => el.querySelector('h2')?.textContent),
      section: document.querySelector('.settings-panel')?.dataset.section ?? null,
      fields, profileName: profile?.querySelector('label input')?.value ?? null,
      presetName: document.querySelector('[aria-label="外观组合名称"]')?.value ?? null,
      conflict: [...document.querySelectorAll('.settings-error strong')].some(el => el.textContent === '快捷键冲突'),
      connectionError: form?.querySelector('[role=alert]')?.textContent ?? null,
      globalError: document.querySelector('.error-notification span')?.textContent ?? null,
      activeProjectId: h.activeProjectId, planCount: h.planCount, pending: !!h.pending,
      storageContainsKey: [...Object.values(localStorage), ...Object.values(sessionStorage)].some(value => value.includes('OWNED_ONLY_NO_SECRET')),
      codeBuffer: structuredClone(h.codeBuffer), editorCalls: structuredClone(h.editorCalls), calls: structuredClone(h.calls),
    };
  },
};
createRoot(document.getElementById('root')).render(<App />);
