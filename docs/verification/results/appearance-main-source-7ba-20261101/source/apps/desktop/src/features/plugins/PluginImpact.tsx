export interface ImpactDocument {
  documentId: string;
  projectId?: string;
  editorRevision?: number;
  displayPath?: string;
  file?: { displayPath?: string; projectId?: string };
}
export interface ImpactResource {
  resourceId: string;
  projectId?: string;
  ownerExtensionId?: string;
  requestedByExtensionId?: string;
  kind?: string;
  label?: string;
  title?: string;
  pid?: number;
  state?: string;
  ownership?: string;
  requiresExtensions?: string[];
}
export interface PluginImpactPlan {
  projectId?: string;
  extensionIds: string[];
  extensionNames: Record<string, string>;
  dirtyDocuments: ImpactDocument[];
  resources: ImpactResource[];
  projects: { id: string; displayName: string; rootDisplayPath?: string; state?: string }[];
}
const kinds: Record<string, string> = { extensionRuntime: '扩展宿主', terminal: '终端', launch: '启动方案', process: '进程', agent: 'Agent 会话', agentCommand: 'Agent 命令', git: 'Git 任务', search: '搜索任务' };

export function PluginImpact({ plan }: { plan: PluginImpactPlan }) {
  const projectName = (id?: string) => plan.projects.find(project => project.id === id)?.displayName ?? (id || '应用');
  const extensionName = (id?: string) => id ? plan.extensionNames[id] ?? id : '宿主';
  return <div className="plugin-impact">
    <section><h4>影响的项目 · {plan.projects.length}</h4>{plan.projects.length ? <ul>{plan.projects.map(project => <li key={project.id}><strong>{project.displayName}</strong><small>{project.rootDisplayPath ?? project.id}</small></li>)}</ul> : <p>应用范围，没有已登记项目。</p>}</section>
    <section><h4>保留的未保存文档 · {plan.dirtyDocuments.length}</h4>{plan.dirtyDocuments.length ? <ul>{plan.dirtyDocuments.map(document => <li key={document.documentId}><strong>{document.file?.displayPath ?? document.displayPath ?? document.documentId}</strong><small>{projectName(document.projectId ?? document.file?.projectId)} · 编辑版本 {document.editorRevision ?? '—'} · 保留最新恢复稿</small></li>)}</ul> : <p>没有需要处理的未保存文档。</p>}</section>
    <section><h4>将停止的活动资源 · {plan.resources.length}</h4>{plan.resources.length ? <ul>{plan.resources.map(resource => <li key={resource.resourceId}><strong>{resource.label ?? resource.title ?? kinds[resource.kind ?? ''] ?? resource.kind ?? resource.resourceId}{resource.pid ? ` · PID ${resource.pid}` : ''}</strong><small>{projectName(resource.projectId)} · 所属 {extensionName(resource.ownerExtensionId)}{resource.requestedByExtensionId ? ` · 请求来自 ${extensionName(resource.requestedByExtensionId)}` : ''}{resource.ownership === 'attached' ? ' · 断开连接' : ' · 停止并释放'}</small>{resource.requiresExtensions?.length ? <small>依赖：{resource.requiresExtensions.map(extensionName).join('、')}</small> : null}</li>)}</ul> : <p>没有活动进程或任务。</p>}</section>
  </div>;
}
