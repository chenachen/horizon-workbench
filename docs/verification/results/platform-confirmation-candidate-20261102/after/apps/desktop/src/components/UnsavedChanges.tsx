import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { call, errorMessage, nativeAvailable } from '../bridge';
import { ErrorNotice } from './ErrorNotice';
import { Modal } from './Modal';

export type FormDirtyListener = (dirty: boolean, busy?: boolean) => void;

export function useFormDirty(dirty: boolean, onDirtyChange?: FormDirtyListener, busy = false) {
  const listener = useRef(onDirtyChange); listener.current = onDirtyChange;
  useEffect(() => { listener.current?.(dirty, busy); }, [dirty, busy]);
  useEffect(() => () => listener.current?.(false, false), []);
}

function BrowserDiscardConfirmation({ onFinish }: { onFinish(discard: boolean): void }) {
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { continueButton.current?.focus(); }, []);
  return createPortal(<div onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
    <Modal title="放弃未保存的修改？" onClose={() => onFinish(false)}>
      <p>未保存的设置表单将被放弃。已生效的偏好和代码编辑内容保留。</p>
      <div className="form-actions"><button type="button" ref={continueButton} onClick={() => onFinish(false)}>继续编辑</button><button type="button" className="danger-button" onClick={() => onFinish(true)}>放弃修改</button></div>
    </Modal>
  </div>, document.body);
}

type PendingDiscard = { resolve(discard: boolean): void; focus: HTMLElement | null };

export function useDiscardConfirmation() {
  const [pending, setPending] = useState<PendingDiscard | null>(null);
  const [error, setError] = useState('');
  const resolver = useRef<PendingDiscard | null>(null);
  const complete = useCallback((request: PendingDiscard, discard: boolean) => {
    if (resolver.current !== request) return;
    resolver.current = null; setPending(null);
    if (!discard && request.focus?.isConnected) request.focus.focus({ preventScroll: true });
    request.resolve(discard);
  }, []);
  const confirmDiscard = useCallback((dirty: boolean, busy = false): Promise<boolean> => {
    const focus = document.activeElement as HTMLElement | null;
    if (busy || resolver.current) return Promise.resolve(false);
    setError('');
    if (!dirty) return Promise.resolve(true);
    return new Promise(resolve => {
      const request = { resolve, focus }; resolver.current = request;
      if (nativeAvailable()) {
        void call<{ discard: boolean }>('form_discard_confirm').then(result => complete(request, result.discard === true), reason => {
          if (resolver.current !== request) return;
          setError(`确认未完成，修改已保留。请重试。${errorMessage(reason)}`);
          complete(request, false);
        });
      } else setPending(request);
    });
  }, [complete]);
  const finish = useCallback((discard: boolean) => { if (resolver.current) complete(resolver.current, discard); }, [complete]);
  useEffect(() => () => { const request = resolver.current; resolver.current = null; request?.resolve(false); }, []);
  const confirmation = pending || error ? <>{pending ? <BrowserDiscardConfirmation onFinish={finish} /> : null}{error ? <ErrorNotice message={error} onClose={() => setError('')} /> : null}</> : null;
  return { confirmDiscard, confirmation };
}
