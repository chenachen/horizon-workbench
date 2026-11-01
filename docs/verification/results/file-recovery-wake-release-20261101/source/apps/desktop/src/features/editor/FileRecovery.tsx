import { useEffect, useRef, useState } from 'react';
import { FileWarning, FolderSearch, RefreshCw } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { errorMessage, type EditorBuffer, type FileRelocationPlan } from '../../../../../packages/editor/src/types';
import { editorStore } from './store';
import { editorCommands } from './commands';
import './file-recovery.css';

const previewLimit = 50000;
const formatBytes = (bytes: string) => {
  const size = Number(bytes);
  return size < 1024 ? `${size} B` : size < 1048576 ? `${(size / 1024).toFixed(1)} KiB` : `${(size / 1048576).toFixed(1)} MiB`;
};
function failureReason(buffer: EditorBuffer) {
  if (buffer.accessError?.code === 'NOT_FOUND') return '文件或链接目标已不存在，或所在磁盘尚未连接。';
  if (buffer.accessError?.code === 'PERMISSION_DENIED') return '当前无法读取此文件。请检查读取权限和文件所在位置。';
  return buffer.accessError?.message ?? '请检查文件是否可访问，然后重新尝试。';
}

export function FileRecovery({ buffer, onSaveCopy }: { buffer: EditorBuffer; onSaveCopy?: () => void }) {
  const empty = buffer.mode === 'unavailable' || !!buffer.evicted;
  const summary = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState<'retry' | 'locate' | 'apply' | null>(null);
  const [plan, setPlan] = useState<FileRelocationPlan | null>(null);
  const [error, setError] = useState(''), [invalidPlan, setInvalidPlan] = useState(false);
  useEffect(() => { if (empty) summary.current?.focus(); }, [buffer.key, empty]);
  useEffect(() => { const { fileId, projectId } = buffer; return () => editorStore.cancelFileRelocation(fileId, projectId); }, [buffer.key]);
  const retry = async () => {
    setBusy('retry'); setError('');
    try { if (await editorStore.retryFileAccess(buffer.fileId, buffer.projectId)) void editorCommands.focus(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const locate = async () => {
    if (plan) editorStore.cancelFileRelocation(plan.source.fileId, plan.source.projectId);
    setPlan(null); setBusy('locate'); setError(''); setInvalidPlan(false);
    try { setPlan(await editorStore.prepareFileRelocation(buffer.fileId, buffer.projectId)); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(null); }
  };
  const cancel = () => {
    if (busy === 'apply') return;
    if (plan) editorStore.cancelFileRelocation(plan.source.fileId, plan.source.projectId);
    setPlan(null); setError('');
  };
  const apply = async (choice: 'useSelected' | 'keepBuffer') => {
    if (!plan) return;
    setBusy('apply'); setError('');
    try { await editorStore.applyFileRelocation(plan, choice); setPlan(null); void editorCommands.focus(); }
    catch (cause) { setError(errorMessage(cause)); setInvalidPlan(true); }
    finally { setBusy(null); }
  };
  const currentText = plan?.dirty ? buffer.getText() : '';
  const selectedText = plan?.candidate.text;
  return <>
    <section ref={summary} tabIndex={-1} role="alert" aria-label="文件不可用" className={empty ? 'file-unavailable' : 'file-access-notice'}>
      <span className="file-unavailable-symbol"><FileWarning size={28} strokeWidth={1.7} /></span>
      <div className="file-unavailable-copy"><h2>{empty ? '这个文件暂时无法读取' : '磁盘文件暂时无法读取'}</h2><code>{buffer.path}</code><p>{failureReason(buffer)}{!empty && ' 已保留当前内容和未保存编辑。'}</p>
        <div className="file-recovery-buttons"><button className="primary" disabled={!!busy || buffer.loading} onClick={() => void retry()}><RefreshCw size={15} />{busy === 'retry' || buffer.loading ? '正在重试…' : '重新尝试'}</button><button disabled={!!busy} onClick={() => void locate()}><FolderSearch size={17} />{busy === 'locate' ? '正在选择…' : '重新定位…'}</button>{onSaveCopy && <button disabled={!!busy} onClick={onSaveCopy}>另存副本</button>}</div>
        <button className="file-unavailable-close" disabled={!!busy} onClick={() => editorStore.requestClose(buffer.fileId, buffer.projectId)}>关闭这个标签</button>
        <details><summary>错误详情</summary><p>{buffer.accessError?.message}</p></details>
        {error && !plan && <p className="file-recovery-error" role="alert">{error}</p>}
      </div>
    </section>
    {plan && <Modal title="确认文件的新位置" wide className="file-relocation-dialog" onClose={cancel}>
      <div className="file-relocation-paths"><div><span>原文件</span><code>{plan.source.displayPath}</code></div><div><span>选择的新位置</span><code>{plan.candidate.displayPath}</code><small>{formatBytes(plan.candidate.diskRevision.byteLength)}{plan.candidate.readOnly ? ' · 只读' : ''}</small></div></div>
      <p>确认文件身份后再关联。此操作不会写入所选文件。</p>
      <div className={`file-relocation-preview${plan.dirty ? ' with-current' : ''}`}>
        {plan.dirty && <section><h3>当前未保存编辑{currentText.length > previewLimit ? ' · 部分预览' : ''}</h3><pre>{currentText.slice(0, previewLimit)}</pre></section>}
        <section><h3>所选文件{plan.candidate.previewTruncated || (selectedText?.length ?? 0) > previewLimit ? ' · 部分预览' : ''}</h3>{selectedText !== undefined ? <pre>{selectedText.slice(0, previewLimit)}</pre> : <p>此文件不支持文本预览。载入后使用对应的只读查看方式。</p>}</section>
      </div>
      {plan.dirty && <p className="file-relocation-warning">“载入所选文件”会放弃当前未保存编辑。“保留当前编辑并关联”保留正文和撤销记录，之后仍需保存。</p>}
      {plan.dirty && !plan.candidate.canKeepBuffer && <p>所选文件不支持完整编辑，不能关联当前编辑。可取消后另存副本。</p>}
      {error && <p className="file-recovery-error" role="alert">{error}</p>}
      <footer className="file-relocation-actions"><button autoFocus disabled={!!busy} onClick={cancel}>取消</button><button disabled={!!busy} onClick={() => void locate()}>重新选择文件…</button>{plan.dirty && <button disabled={!!busy || invalidPlan || !plan.candidate.canKeepBuffer} className="primary-button" onClick={() => void apply('keepBuffer')}>保留当前编辑并关联</button>}<button disabled={!!busy || invalidPlan || (plan.dirty && plan.candidate.mode !== 'editor')} className={plan.dirty ? 'danger-text' : 'primary-button'} onClick={() => void apply('useSelected')}>{busy === 'apply' ? '正在关联…' : plan.dirty ? '放弃当前编辑并载入' : '载入所选文件'}</button></footer>
    </Modal>}
  </>;
}
