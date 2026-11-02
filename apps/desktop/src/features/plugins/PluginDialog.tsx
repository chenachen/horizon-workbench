import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function PluginDialog({ title, busy, onClose, children, kind }: { title: string; busy?: boolean; onClose(): void; children: ReactNode; kind?: 'stop' | 'uninstall' }) {
  const ref = useRef<HTMLDialogElement>(null); const titleId = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { dialog.close(); }; }, []);
  return <dialog className="plugin-dialog" data-kind={kind} ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="plugin-heading"><h3 id={titleId}>{title}</h3><button aria-label="关闭对话框" disabled={busy} onClick={onClose}><X size={17} /></button></div>
    {children}
  </dialog>;
}
