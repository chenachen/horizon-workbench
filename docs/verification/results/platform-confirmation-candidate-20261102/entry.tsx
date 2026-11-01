import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useDiscardConfirmation } from './apps/desktop/src/components/UnsavedChanges';
import { Modal } from './apps/desktop/src/components/Modal';
import './apps/desktop/src/styles.css';

const h = window.nativeDiscardHarness = {
  native: location.hash !== '#browser', calls: [], requests: new Map(), owners: new Map(), results: {}, nativeCalls: [],
  invoke(command, { call }) {
    if (command !== 'horizon_call' || call.method !== 'form_discard_confirm') throw Error('Unexpected RPC: ' + command + '/' + call.method);
    const index = h.calls.push(structuredClone(call)) - 1;
    return new Promise(resolve => { h.requests.set(index, { call, resolve }); });
  },
  reply(index, discard) { const request = h.requests.get(index); if (!request) throw Error('No request ' + index); h.requests.delete(index); request.resolve({ ok: true, requestId: request.call.requestId, data: { discard } }); },
  fail(index) { const request = h.requests.get(index); if (!request) throw Error('No request ' + index); h.requests.delete(index); request.resolve({ ok: false, requestId: request.call.requestId, error: { code: 'IO_ERROR', message: '受控原生确认失败', retryable: true } }); },
  ask(owner, label, dirty = true, busy = false, closeOnDiscard = false) { const confirm = h.owners.get(owner); if (!confirm) throw Error('No owner ' + owner); void confirm(dirty, busy).then(discard => { h.results[label] = discard; if (discard && closeOnDiscard) h.setForm(false); }); },
  capture() { return { native: h.native, calls: structuredClone(h.calls), results: structuredClone(h.results), pendingRequests: [...h.requests.keys()], nativeCalls: [...h.nativeCalls], focusedId: document.activeElement?.id, model: document.querySelector('#owned-model')?.value ?? null, formPresent: !!document.querySelector('#owned-model'), dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => dialog.querySelector('h2')?.textContent), alerts: [...document.querySelectorAll('[role=alert]')].map(alert => alert.textContent) }; },
};
const showModal = HTMLDialogElement.prototype.showModal, close = HTMLDialogElement.prototype.close;
HTMLDialogElement.prototype.showModal = function(...args) { h.nativeCalls.push({ operation: 'showModal', title: this.querySelector('h2')?.textContent }); return showModal.apply(this, args); };
HTMLDialogElement.prototype.close = function(...args) { h.nativeCalls.push({ operation: 'close', title: this.querySelector('h2')?.textContent }); return close.apply(this, args); };

function Owner({ name }) {
  const { confirmDiscard, confirmation } = useDiscardConfirmation();
  useEffect(() => { h.owners.set(name, confirmDiscard); return () => { if (h.owners.get(name) === confirmDiscard) h.owners.delete(name); }; }, [name, confirmDiscard]);
  return confirmation;
}
function Harness() {
  const [form, setForm] = useState(true), [ownerA, setOwnerA] = useState(true);
  h.setForm = setForm; h.setOwnerA = setOwnerA;
  return <><button id="outside-focus">Outside</button>{form ? <Modal title="Owned model form" onClose={() => h.ask('A', 'parent-close-' + Object.keys(h.results).length, true, false, true)}><label>Model<input id="owned-model" defaultValue="owned-no-request" /></label><button id="owned-other" type="button">Other control</button></Modal> : null}{ownerA ? <Owner name="A" /> : null}<Owner name="B" /></>;
}
createRoot(document.getElementById('root')).render(<Harness />);
