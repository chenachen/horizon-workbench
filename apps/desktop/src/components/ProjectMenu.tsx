import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FolderOpen, Moon, Pencil, Pin, Play, Settings2, Trash2 } from 'lucide-react';
import type { Project } from '../workspace';

export function ProjectMenu({ project, left, top, trigger, onClose, onSettings, onPin, onReveal, onLaunch, onStop }: {
  project: Project; left: number; top: number; trigger: HTMLElement | null;
  onClose: () => void; onSettings: () => void; onPin: () => void; onReveal: () => void;
  onLaunch: () => void; onStop: (action: 'sleep' | 'remove') => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left, top });
  useLayoutEffect(() => {
    const rect = ref.current!.getBoundingClientRect();
    setPosition({ left: Math.max(12, Math.min(left, window.innerWidth - rect.width - 12)), top: Math.max(12, Math.min(top, window.innerHeight - rect.height - 12)) });
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [left, top]);
  useEffect(() => () => { if (trigger?.isConnected) trigger.focus(); }, [trigger]);
  return <div className="project-menu-dismiss" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="project-action-menu" role="menu" aria-label={`${project.displayName} 项目操作`} style={position} onKeyDown={event => {
      if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); onClose(); return; }
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
      buttons[next]?.focus(); event.preventDefault();
    }}>
      <p className="project-menu-title">{project.displayName}</p>
      <button role="menuitem" onClick={onPin}><Pin size={17} />{project.pinned ? '取消固定' : '固定项目'}</button>
      <button role="menuitem" onClick={onSettings}><Pencil size={17} />重命名显示名称</button>
      <button role="menuitem" onClick={onReveal}><FolderOpen size={17} />在文件管理器中显示</button>
      <div role="separator" />
      <button role="menuitem" onClick={onLaunch}><Play size={17} />项目启动方案</button>
      <button role="menuitem" onClick={() => onStop('sleep')}><Moon size={17} />休眠项目</button>
      <button role="menuitem" onClick={onSettings}><Settings2 size={17} />项目设置</button>
      <div role="separator" />
      <button role="menuitem" className="danger-text" onClick={() => onStop('remove')}><Trash2 size={17} />从工作区移除</button>
    </div>
  </div>;
}
