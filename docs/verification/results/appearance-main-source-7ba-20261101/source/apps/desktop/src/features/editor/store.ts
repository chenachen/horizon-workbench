import { useSyncExternalStore } from 'react';
import { call } from '../../bridge';
import { EditorStore } from '../../../../../packages/editor/src/store';
export const editorStore = new EditorStore({ call });
export const useEditor = () => useSyncExternalStore(editorStore.subscribe, editorStore.getSnapshot, editorStore.getSnapshot);
const disposers = new Set<(projectId?: string) => void>();
export const registerEditorDisposer = (dispose: (projectId?: string) => void) => { disposers.add(dispose); return () => { disposers.delete(dispose); }; };
export const disposeEditorViews = async (projectId?: string) => { disposers.forEach(dispose => dispose(projectId)); editorStore.hostClosedProject(projectId, 'retainCheckpoint'); };
