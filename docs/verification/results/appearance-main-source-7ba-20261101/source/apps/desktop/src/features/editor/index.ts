export { FileExplorer, FileExplorerToolbar } from './FileExplorer';
export { SearchPanel, QuickOpen } from './SearchPanel';
export { EditorWorkbench } from './EditorWorkbench';
export { editorStore, useEditor, disposeEditorViews } from './store';
export { editorCommands, applyReviewedEdit } from './commands';
export { getEditorDiagnostics } from '../../../../../packages/editor/src/metrics';
export type { FileExplorerProps } from './FileExplorer';
export type { EditorWorkbenchProps } from './EditorWorkbench';
export type { QuickOpenProps, QuickOpenMode } from './SearchPanel';
import { registerPluginLifecycle } from '../plugins/service';
import { editorStore, disposeEditorViews } from './store';
import { disposeTrees } from './FileExplorer';
import { disposeSearches } from './SearchPanel';
registerPluginLifecycle('horizon.editor', {
  activate: async ({ projectId, signal }) => { if (projectId && !signal.aborted) await editorStore.restoreProjectSession(projectId); },
  prepareDeactivate: async ({ projectId }) => {
    try { await editorStore.flushDrafts(projectId); return { ready: true, blockers: [] }; }
    catch { return { ready: false, blockers: [...editorStore.getSnapshot().buffers.values()].filter(b => b.dirty && (!projectId || b.projectId === projectId)).map(b => b.meta?.documentId ?? b.fileId) }; }
  },
  dispose: ({ projectId }) => disposeEditorViews(projectId),
});
registerPluginLifecycle('horizon.files', { dispose: ({ projectId }) => disposeTrees(projectId) });
registerPluginLifecycle('horizon.search', { dispose: ({ projectId }) => disposeSearches(projectId) });
