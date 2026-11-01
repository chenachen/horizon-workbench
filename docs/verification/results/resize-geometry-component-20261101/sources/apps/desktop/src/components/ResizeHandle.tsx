import { useEffect, useRef, useState, type CSSProperties } from 'react';

export function ResizeHandle({ label, variable, currentValue, direction = 'horizontal', min, max, defaultValue, reverse = false, onCommit }: { label: string; variable: string; currentValue: number; direction?: 'horizontal' | 'vertical'; min: number; max: number; defaultValue: number; reverse?: boolean; onCommit: (value: number) => Promise<void> }) {
  const [preview, setPreview] = useState<number>();
  const previewValue = useRef<number | undefined>(undefined);
  const commitSequence = useRef(0);
  const pendingCommits = useRef(0);
  const cancelDrag = useRef<(() => void) | null>(null);
  const value = () => previewValue.current ?? currentValue;
  const apply = (n: number) => {
    const next = Math.round(Math.max(min, Math.min(max, n)));
    document.documentElement.style.setProperty(variable, `${next}px`);
    previewValue.current = next; setPreview(next);
    return next;
  };
  const clearPreview = () => { previewValue.current = undefined; setPreview(undefined); };
  const commit = (next: number) => {
    const sequence = ++commitSequence.current; ++pendingCommits.current;
    const settled = () => { --pendingCommits.current; if (sequence === commitSequence.current && !cancelDrag.current) clearPreview(); };
    void onCommit(next).then(settled, settled);
  };
  useEffect(() => { document.documentElement.style.setProperty(variable, `${preview ?? currentValue}px`); }, [variable, preview, currentValue]);
  useEffect(() => () => cancelDrag.current?.(), []);
  return <div role="separator" tabIndex={0} aria-label={label} aria-orientation={direction === 'horizontal' ? 'vertical' : 'horizontal'} aria-valuemin={min} aria-valuemax={max} aria-valuenow={preview ?? currentValue} className={`resize-handle resize-${direction}`} style={{ '--resize-cursor': direction === 'horizontal' ? 'col-resize' : 'row-resize' } as CSSProperties}
    onDoubleClick={() => { const previous = value(); const next = apply(defaultValue); if (next !== previous) commit(next); else if (!pendingCommits.current) clearPreview(); }}
    onKeyDown={event => {
      const step = event.shiftKey ? 10 : 1;
      const d = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
      if (d) { event.preventDefault(); const previous = value(); const next = apply(previous + d * step * (reverse ? -1 : 1)); if (next !== previous) commit(next); else if (!pendingCommits.current) clearPreview(); }
    }}
    onPointerDown={event => {
      if (event.button !== 0) return;
      event.preventDefault(); const el = event.currentTarget; const pointerId = event.pointerId; el.setPointerCapture(pointerId);
      const initial = value(); const origin = direction === 'horizontal' ? event.clientX : event.clientY;
      let next = initial;
      const move = (e: PointerEvent) => { next = apply(initial + ((direction === 'horizontal' ? e.clientX : e.clientY) - origin) * (reverse ? -1 : 1)); };
      const cleanup = () => {
        el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); el.removeEventListener('lostpointercapture', cancel);
        document.removeEventListener('keydown', keydown); cancelDrag.current = null;
        if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      };
      const up = () => { cleanup(); if (next !== initial) commit(next); else if (!pendingCommits.current) clearPreview(); };
      const cancel = () => { cleanup(); apply(initial); if (!pendingCommits.current) clearPreview(); };
      const keydown = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
      cancelDrag.current = cancel;
      el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel); el.addEventListener('lostpointercapture', cancel);
      document.addEventListener('keydown', keydown);
    }} />;
}
