import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

/** Keep action errors visible above the active modal's native top layer. */
export function ErrorNotice({ message, onClose }: { message: string; onClose: () => void }) {
  const [target, setTarget] = useState<Element>(document.body);
  useEffect(() => {
    const sync = () => setTarget([...document.querySelectorAll('dialog[open]')].at(-1) ?? document.body);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);
  return createPortal(<div className="notification error-notification" role="alert">
    <AlertCircle size={17} /><span>{message}</span>
    <button className="icon-button" aria-label="关闭错误提示" onClick={onClose}><X size={15} /></button>
  </div>, target);
}
