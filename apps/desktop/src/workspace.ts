export interface Workspace { id: string; name: string; projectIds: string[]; revision: number }
export interface Project {
  id: string; workspaceId: string; displayName: string; rootDisplayPath: string; pinned: boolean; revision: number; lastOpenedAt?: string;
  state: 'registered' | 'activating' | 'active' | 'idle' | 'sleeping' | 'unavailable';
  accessError?: { code: string; message: string };
}
export interface ProjectSession {
  schemaVersion: 1; revision: number; tabs: Array<{ fileId: string; pinned: boolean; selection: { anchor: number; head: number }; scrollTop: number }>;
  activeFileId: string | null; expandedEntryIds: string[]; searchDraft: string; commitDraft: string;
  layout: { panels: Record<string, { visible: boolean; activeViewId: string | null }>; focusMode: boolean; focusRestore: Record<string, boolean> | null };
}
export interface Bootstrap { protocolVersion: 1; schemaHash: string; workspaces: Workspace[]; projects: Project[]; availableServices: string[]; activeProjectId?: string; activeWorkspaceId?: string }
export interface StopPlan {
  planId: string; digest: string; planDigest?: string; dirtyDocuments: string[];
  documents: Array<{ documentId: string; state: string; file: { projectId: string; fileId: string; displayPath: string } }>;
  resources: Array<{ resourceId: string; ownerExtensionId: string; kind: string; state: string; actions: string[]; projectId?: string; owner?: { projectId: string }; title?: string; pid?: number }>;
}
