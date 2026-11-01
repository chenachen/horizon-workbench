import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';

export type FormDirtyListener = (dirty: boolean, busy?: boolean) => void;

export function useFormDirty(dirty: boolean, onDirtyChange?: FormDirtyListener, busy = false) {
  const listener = useRef(onDirtyChange); listener.current = onDirtyChange;
  useEffect(() => { listener.current?.(dirty, busy); }, [dirty, busy]);
  useEffect(() => () => listener.current?.(false, false), []);
}

export function useDiscardConfirmation() {
  const [pending, setPending] = useState<((discard: boolean) => void) | null>(null);
  const resolver = useRef<((discard: boolean) => void) | null>(null);
  const confirmDiscard = useCallback((dirty: boolean, busy = false): Promise<boolean> => {
    if (busy || resolver.current) return Promise.resolve(false);
    if (!dirty) return Promise.resolve(true);
    return new Promise(resolve => { resolver.current = resolve; setPending(() => resolve); });
  }, []);
  const finish = useCallback((discard: boolean) => {
    const resolve = resolver.current; resolver.current = null; setPending(null); resolve?.(discard);
  }, []);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  const confirmation = pending ? createPortal(<div onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation(); }}>
    <Modal title="放弃未保存的修改？" onClose={() => finish(false)} replaceTop>
      <p>未保存的设置表单将被放弃。已生效的偏好和代码编辑内容保留。</p>
      <div className="form-actions"><button autoFocus onClick={() => finish(false)}>继续编辑</button><button className="danger-button" onClick={() => finish(true)}>放弃修改</button></div>
    </Modal>
  </div>, document.body) : null;
  return { confirmDiscard, confirmation };
}
