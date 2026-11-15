import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildDiffRows, collapseDiffRows, type DiffLine } from './diffModel';

const OVERSCAN = 12;
const PADDING = 8;
const MAX_SCROLL_HEIGHT = 8_000_000;

export type FullFileDiffHandle = { revealChange(index: number): void; resetExpanded(): void };
type Props = { fileKey: string; lines: DiffLine[]; split: boolean; hideUnchanged: boolean };

function textColumns(text: string) {
  let columns = 0;
  for (const character of text) {
    if (character === '\t') columns += 4 - columns % 4;
    else columns += character.codePointAt(0)! > 255 ? 2 : 1;
  }
  return columns;
}

export const FullFileDiff = forwardRef<FullFileDiffHandle, Props>(function FullFileDiff({ fileKey, lines, split, hideUnchanged }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const oldPane = useRef<HTMLDivElement>(null), newPane = useRef<HTMLDivElement>(null);
  const getScroller = () => split ? newPane.current : host.current;
  const [geometry, setGeometry] = useState({ height: 0, rowHeight: 26, characterWidth: 8.5 });
  const [scrollTop, setScrollTop] = useState(0);
  const scrollPosition = useRef(0);
  const [expanded, setExpanded] = useState<{ key: string; regions: Set<number> }>({ key: '', regions: new Set() });
  const regionKey = `${fileKey}:${split}`;
  const allRows = useMemo(() => buildDiffRows(lines, split), [lines, split]);
  const rows = useMemo(() => hideUnchanged
    ? collapseDiffRows(allRows, expanded.key === regionKey ? expanded.regions : new Set())
    : allRows, [allRows, hideUnchanged, expanded, regionKey]);
  const maxColumns = useMemo(() => lines.reduce((widths, line) => {
    const columns = textColumns(line.text);
    if (line.kind !== 'added') widths.old = Math.max(widths.old, columns);
    if (line.kind !== 'removed') widths.new = Math.max(widths.new, columns);
    return widths;
  }, { old: 0, new: 0 }), [lines]);
  const logicalHeight = rows.length * geometry.rowHeight + PADDING * 2;
  const physicalHeight = Math.min(logicalHeight, MAX_SCROLL_HEIGHT);
  const maxPhysicalScroll = Math.max(0, physicalHeight - geometry.height);
  const maxLogicalScroll = Math.max(0, logicalHeight - geometry.height);
  const scale = maxPhysicalScroll ? maxLogicalScroll / maxPhysicalScroll : 1;
  const logicalTop = Math.min(scrollTop, maxPhysicalScroll) * scale;
  const first = Math.max(0, Math.floor((logicalTop - PADDING) / geometry.rowHeight) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((logicalTop + geometry.height) / geometry.rowHeight) + OVERSCAN);
  const contentWidth = (side?: 'old' | 'new') => (side ? maxColumns[side] : Math.max(maxColumns.old, maxColumns.new)) * geometry.characterWidth + 84;
  const setPosition = (position: number) => {
    const containers = split ? [oldPane.current, newPane.current] : [host.current];
    for (const container of containers) if (container) container.scrollTop = position;
    scrollPosition.current = getScroller()?.scrollTop ?? 0;
    setScrollTop(scrollPosition.current);
  };
  const scroll = (source: HTMLDivElement) => {
    if (split) {
      const target = source === oldPane.current ? newPane.current : oldPane.current;
      if (target && target.scrollTop !== source.scrollTop) target.scrollTop = source.scrollTop;
    }
    scrollPosition.current = source.scrollTop;
    setScrollTop(source.scrollTop);
  };

  useLayoutEffect(() => {
    const container = host.current, scroller = getScroller(), sample = measure.current;
    if (!container || !scroller || !sample) return;
    const resize = () => {
      const size = sample.getBoundingClientRect();
      if (!scroller.clientHeight || !size.height) return;
      setGeometry({ height: scroller.clientHeight, rowHeight: size.height, characterWidth: size.width / 40 });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    observer.observe(scroller);
    observer.observe(sample);
    return () => observer.disconnect();
  }, [split]);

  const revealChange = (index: number) => {
    const row = rows.findIndex(item => item.kind !== 'fold' && item.changeIndex === index);
    if (row < 0 || !getScroller()) return;
    const position = Math.max(0, Math.min(maxLogicalScroll, row * geometry.rowHeight + PADDING - geometry.height / 3));
    setPosition(position / scale);
  };
  useImperativeHandle(ref, () => ({ revealChange, resetExpanded: () => setExpanded({ key: regionKey, regions: new Set() }) }));

  const previous = useRef<{ fileKey: string; split: boolean; rows: typeof rows; rowHeight: number; scale: number } | null>(null);
  useLayoutEffect(() => {
    const old = previous.current;
    const container = getScroller();
    if (!container || !geometry.height) return;
    if (!old || old.fileKey !== fileKey) {
      revealChange(0);
    } else if (old.rows !== rows || old.rowHeight !== geometry.rowHeight || old.scale !== scale) {
      const oldIndex = Math.max(0, Math.floor((scrollPosition.current * old.scale - PADDING) / old.rowHeight));
      const anchor = old.rows[Math.min(oldIndex, old.rows.length - 1)];
      let nextIndex = anchor ? rows.findIndex(row => row.sourceIndex >= anchor.sourceIndex || (
        row.kind === 'fold' && anchor.sourceIndex < (allRows[row.end]?.sourceIndex ?? Infinity)
      )) : 0;
      if (anchor && anchor.kind !== 'fold' && old.split !== split) {
        const lineIndex = rows.findIndex(row => row.kind !== 'fold' && (
          anchor.newLine !== undefined ? row.newLine === anchor.newLine : row.oldLine === anchor.oldLine
        ));
        if (lineIndex >= 0) nextIndex = lineIndex;
      }
      const offset = scrollPosition.current * old.scale - PADDING - oldIndex * old.rowHeight;
      setPosition(Math.max(0, (Math.max(0, nextIndex) * geometry.rowHeight + PADDING + offset) / scale));
    }
    previous.current = { fileKey, split, rows, rowHeight: geometry.rowHeight, scale };
  }, [fileKey, split, rows, geometry.rowHeight, geometry.height]);

  const expand = (start: number) => setExpanded(current => ({
    key: regionKey,
    regions: new Set([...(current.key === regionKey ? current.regions : []), start]),
  }));

  const renderRows = (side?: 'old' | 'new') => <div className="git-file-diff-content" style={{ height: physicalHeight, minWidth: contentWidth(side) }}>
    <div className="git-file-diff-window" style={{ top: PADDING + first * geometry.rowHeight - logicalTop + scrollTop }}>
      {rows.slice(first, last).map(row => {
        if (row.kind === 'fold') return <div className="git-diff-fold" key={`fold-${row.sourceIndex}`} style={{ height: geometry.rowHeight }}><button onClick={() => expand(row.start)}>展开 {row.hiddenLines} 行未更改内容</button></div>;
        const removed = row.kind === 'removed' || row.kind === 'modified';
        const added = row.kind === 'added' || row.kind === 'modified';
        return <div className={`git-diff-line ${row.kind}`} key={row.sourceIndex} data-change-index={row.changeIndex} style={{ height: geometry.rowHeight }}>
          {side === 'old' ? <>
            <span className={`git-old-number${removed ? ' removed' : ''}`}>{row.oldLine}</span>
            <code className={`git-old-content${removed ? ' removed' : ''}`}>{row.oldText ?? ' '}</code>
          </> : side === 'new' ? <>
            <span className={`git-new-number${added ? ' added' : ''}`}>{row.newLine}</span>
            <code className={`git-new-content${added ? ' added' : ''}`}>{row.newText ?? ' '}</code>
          </> : <>
            <span className="git-line-number">{row.kind === 'removed' ? '−' : row.kind === 'added' ? '+' : ''}{row.newLine ?? row.oldLine}</span>
            <code>{row.newText ?? row.oldText ?? ' '}</code>
          </>}
        </div>;
      })}
    </div>
  </div>;

  return <div className={`git-file-diff${split ? ' split' : ''}`} ref={host} role="region" tabIndex={split ? undefined : 0} aria-label="完整文件差异" onScroll={event => { if (!split) scroll(event.currentTarget); }}>
    <span className="git-diff-measure" ref={measure} aria-hidden="true">{'M'.repeat(40)}</span>
    {split ? <>
      <div className="git-diff-pane" data-side="old" ref={oldPane} role="region" tabIndex={0} aria-label="原始文件" onScroll={event => scroll(event.currentTarget)}>{renderRows('old')}</div>
      <div className="git-diff-pane" data-side="new" ref={newPane} role="region" tabIndex={0} aria-label="修改后文件" onScroll={event => scroll(event.currentTarget)}>{renderRows('new')}</div>
    </> : renderRows()}
  </div>;
});
