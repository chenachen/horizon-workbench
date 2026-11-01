import { useEffect, useRef } from 'react';
import { FileText, Moon, Play, Settings2 } from 'lucide-react';

export type SleepingProjectSnapshot = {
  projectId: string;
  tabs: { fileId: string; path: string; active: boolean }[];
};

export function SleepingProjectPage({ snapshot, busy, onResume, onPreferences }: {
  snapshot: SleepingProjectSnapshot;
  busy: boolean;
  onResume: () => void;
  onPreferences: () => void;
}) {
  const summary = useRef<HTMLElement>(null), tabs = useRef<HTMLDivElement>(null), activeTab = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    summary.current?.focus();
    const row = tabs.current; if (!row) return;
    const observer = new ResizeObserver(() => activeTab.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' }));
    observer.observe(row);
    return () => observer.disconnect();
  }, [snapshot.projectId]);
  return <div className="sleeping-project-page">
    {snapshot.tabs.length > 0 && <div ref={tabs} className="sleeping-project-tabs" aria-label="已保留的文件标签">{snapshot.tabs.map(tab => <span key={tab.fileId} ref={tab.active ? activeTab : undefined} className={tab.active ? 'active' : ''} title={tab.path}><FileText size={13} />{tab.path.split('/').pop()}</span>)}</div>}
    <section ref={summary} tabIndex={-1} className="sleeping-project-summary" role="status" aria-label="项目已休眠">
      <span className="sleeping-project-symbol"><Moon size={30} strokeWidth={1.7} /></span>
      <h2>项目已休眠</h2>
      <p>文件标签与阅读位置已保留。<br />恢复后按需启用项目服务。</p>
      <div><button className="primary-button" disabled={busy} onClick={onResume}><Play size={30} />{busy ? '正在恢复…' : '恢复项目'}</button><button disabled={busy} onClick={onPreferences}><Settings2 size={30} />休眠偏好</button></div>
    </section>
  </div>;
}
