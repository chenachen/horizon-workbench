// Importing the workbench must not eagerly load CodeMirror and language parsers.
export const editorCommands = {
  find: () => import('./CodeSurface').then(m => m.editorCommands.find()),
  gotoLine: () => import('./CodeSurface').then(m => m.editorCommands.gotoLine()),
  undo: () => import('./CodeSurface').then(m => m.editorCommands.undo()),
  redo: () => import('./CodeSurface').then(m => m.editorCommands.redo()),
  focus: () => import('./CodeSurface').then(m => m.editorCommands.focus()),
};
export const applyReviewedEdit = (input: { projectId: string; fileId: string; expectedEditorRevision: number; text: string; proposalId?: string }) => import('./CodeSurface').then(module => module.applyReviewedEdit(input));
