import { useEffect, useRef, type ReactNode } from 'react';

export function GitModal({ title, children, onClose, wide = false, busy = false, onStop, stopping = false }: { title: string; children: ReactNode; onClose(): void; wide?: boolean; busy?: boolean; onStop?(): void; stopping?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); dialog?.querySelector<HTMLElement>('[data-initial-focus]')?.focus(); return () => { dialog?.close(); }; }, []);
  return <dialog className={`git-modal${wide ? ' git-modal-wide' : ''}`} ref={ref} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2>{title}</h2><span className="git-spacer" />{busy && onStop ? <button type="button" disabled={stopping} onClick={onStop}>{stopping ? '正在停止…' : '停止'}</button> : null}<button type="button" aria-label={`关闭${title}`} disabled={busy} onClick={onClose}>×</button></header>{children}
  </dialog>;
}
