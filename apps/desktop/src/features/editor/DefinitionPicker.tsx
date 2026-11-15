import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, X } from 'lucide-react';
import type { DefinitionTarget } from './languageService';

export type DefinitionState = {
  requestId: number;
  sourceKey: string;
  projectId: string;
  status: 'loading' | 'empty' | 'ready' | 'error';
  targets: DefinitionTarget[];
  message?: string;
};
type Props = { state: DefinitionState; onChoose(target: DefinitionTarget): void; onClose(): void };

function targetPath(uri: string) {
  try { return decodeURIComponent(new URL(uri).pathname); } catch { return uri; }
}

export function DefinitionPicker(props: Props) {
  if (props.state.status === 'ready') return <DefinitionChoices key={props.state.requestId} {...props} />;
  const { state, onClose } = props;
  return <div className={`definition-notice${state.status === 'error' ? ' definition-error' : ''}`} role={state.status === 'error' ? 'alert' : 'status'}>
    <span>{state.status === 'loading' ? '正在查找定义…' : state.status === 'empty' ? '没有找到定义。' : state.message || '代码跳转失败。'}</span>
    <button type="button" aria-label="关闭定义跳转" title="关闭定义跳转" onClick={onClose}><X size={14} /></button>
  </div>;
}

function DefinitionChoices({ state, onChoose, onClose }: Props) {
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  const origin = useRef(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  useEffect(() => {
    dialog.current?.querySelector<HTMLButtonElement>('[role="option"]')?.focus();
    return () => { if (origin.current?.isConnected) origin.current.focus(); };
  }, []);
  const move = (index: number) => {
    const next = Math.max(0, Math.min(state.targets.length - 1, index));
    setSelected(next);
    const button = dialog.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')[next];
    button?.focus(); button?.scrollIntoView({ block: 'nearest' });
  };
  return <div className="editor-modal-backdrop definition-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialog} className="definition-picker" role="dialog" aria-modal="true" aria-label="选择定义" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); move(selected + (event.key === 'ArrowDown' ? 1 : -1)); }
      else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); move(event.key === 'Home' ? 0 : state.targets.length - 1); }
      else if (event.key === 'Tab') {
        const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([tabindex="-1"])');
        const first = buttons?.[0], last = buttons?.[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header><strong>选择定义</strong><span>{state.targets.length} 个位置</span><button type="button" aria-label="关闭定义跳转" title="关闭定义跳转" onClick={onClose}><X size={16} /></button></header>
      <div className="definition-targets" role="listbox" aria-label="定义位置">{state.targets.map((target, index) => {
        const path = targetPath(target.uri), label = target.label || path.split('/').pop() || path;
        return <button type="button" role="option" key={`${target.uri}:${target.range.start.line}:${target.range.start.character}:${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} title={`${path}:${target.range.start.line + 1}:${target.range.start.character + 1}`} onFocus={() => setSelected(index)} onClick={() => onChoose(target)}>
          <ArrowUpRight size={16} /><span><strong>{label}</strong><small>{path}</small></span><span className="definition-target-position">{target.range.start.line + 1}:{target.range.start.character + 1}</span>
        </button>;
      })}</div>
      <footer>↑↓ 选择 · Enter 跳转 · Esc 返回编辑器</footer>
    </section>
  </div>;
}
