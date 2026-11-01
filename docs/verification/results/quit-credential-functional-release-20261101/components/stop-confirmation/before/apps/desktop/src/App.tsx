import { Suspense, lazy, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { Orbit, Plus, PanelsTopLeft, Search, Settings2, Puzzle, FolderOpen, GitBranch, Terminal, Sparkles, MoreHorizontal, ArrowRight, Check, Pin, Moon, X, Maximize, Minimize, ChevronDown, LayoutGrid, Files, PanelLeftClose, Command, RefreshCw, AlertCircle, Download, ArrowUp, ArrowDown, ArrowUpRight, Laptop, Pencil, Trash2 } from 'lucide-react';
import { call, errorMessage, HorizonError, nativeAvailable, onEvent, setProjectEpoch } from './bridge';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmptyState, Loading, Modal } from './components/Modal';
import { ProjectMenu } from './components/ProjectMenu';
import { ResizeHandle } from './components/ResizeHandle';
import { ErrorNotice } from './components/ErrorNotice';
import { SleepingProjectPage, type SleepingProjectSnapshot } from './components/SleepingProjectPage';
import type { Bootstrap, Project, ProjectSession, StopPlan, Workspace } from './workspace';
import { activatePlugin, pluginRuntime, usePluginEnabled, usePlugins } from './features/plugins/service';
import { PluginSlot } from './features/plugins/PluginSlot';
import { useProjectActivity } from './useProjectActivity';
import { AppearanceProvider, useAppearance, useSettings } from './features/settings/AppearanceProvider';
import { defaultShortcuts, shortcutDisplay, shortcutFromEvent } from './features/settings/shortcuts';
import type { GeometryKey } from '../../../packages/appearance/src';
import type { DiffSelection, GitSnapshot } from './features/git';

const FileExplorer = lazy(() => import('./features/editor').then(m => ({ default: m.FileExplorer })));
const SearchPanel = lazy(() => import('./features/editor').then(m => ({ default: m.SearchPanel })));
const EditorWorkbench = lazy(() => import('./features/editor').then(m => ({ default: m.EditorWorkbench })));
const QuickOpen = lazy(() => import('./features/editor').then(m => ({ default: m.QuickOpen })));
const GitPanel = lazy(() => import('./features/git').then(m => ({ default: m.GitPanel })));
const GitDiffSurface = lazy(() => import('./features/git').then(m => ({ default: m.GitDiffSurface })));
const CloneForm = lazy(() => import('./features/git').then(m => ({ default: m.CloneForm })));
const PluginCenter = lazy(() => import('./features/plugins/PluginCenter').then(m => ({ default: m.PluginCenter })));
const SettingsPanel = lazy(() => import('./features/settings/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const AgentPanel = lazy(() => import('./features/agent').then(m => ({ default: m.AgentPanel })));
const AgentSettings = lazy(() => import('./features/agent').then(m => ({ default: m.AgentSettings })));
const TerminalPanel = lazy(() => import('./features/processes').then(m => ({ default: m.TerminalPanel })));
const LauncherPanel = lazy(() => import('./features/processes').then(m => ({ default: m.LauncherPanel })));
const LauncherToolbar = lazy(() => import('./features/processes').then(m => ({ default: m.LauncherToolbar })));
const RecoveryPanel = lazy(() => import('./components/RecoveryPanel').then(m => ({ default: m.RecoveryPanel })));

type Panel = 'files' | 'search' | 'git';
type ModalKind = 'settings' | 'workspace' | 'add' | 'clone' | 'project' | 'commands' | 'recovery' | null;
type PanelState = { sidebar: boolean; tab: Panel; ai: boolean; terminal: boolean; focus: boolean };
type ProjectAccessFailure = { projectId: string; code: string; message: string };
const defaultPanels: PanelState = { sidebar: true, tab: 'files', ai: false, terminal: false, focus: false };
const panelMemory = new Map<string, PanelState>();
const getEditor = () => import('./features/editor').then(m => m.editorStore);

export default function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>();
  const [projectEpoch, setEpoch] = useState(1);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState('');
  const [error, setError] = useState('');
  const [projectAccessError, setProjectAccessError] = useState<ProjectAccessFailure>();
  const [busyProject, setBusyProject] = useState<string>();
  const activation = useRef(0);
  const navigationQueue = useRef<Promise<void>>(Promise.resolve());
  const reportError = useCallback((value: unknown) => { setError(errorMessage(value)); }, []);
  const refresh = useCallback(async () => {
    const data = await call<Bootstrap>('app_bootstrap', { clientVersion: '0.1.0', protocolVersion: 1 });
    setWorkspaces(data.workspaces); setProjects(data.projects);
    return data;
  }, []);
  const navigate = useCallback((requested: { projectId?: string; workspaceId?: string }) => {
    const generation = ++activation.current; setBusyProject(requested.projectId);
    const pending = navigationQueue.current.then(async () => {
      if (generation !== activation.current) return false;
      try {
        let id = requested.projectId;
        if (requested.workspaceId) {
          const selected = await call<{ workspaceId: string; activeProjectId: string | null }>('workspace_activate', { workspaceId: requested.workspaceId });
          if (generation !== activation.current) return false;
          id = selected.activeProjectId ?? undefined;
          if (!id) { setWorkspaceId(selected.workspaceId); setProjectId(undefined); return true; }
        }
        if (!id) return false;
        const result = await call<{ project: Project; projectEpoch: number; session: ProjectSession }>('project_activate', { projectId: id });
        if (generation !== activation.current) return false;
        const editor = await getEditor();
        if (generation !== activation.current) return false;
        setProjectEpoch(id, result.projectEpoch);
        if (!panelMemory.has(id)) {
          const layout = result.session.layout;
          const sidebar = layout?.panels?.primarySidebar;
          const active = sidebar?.activeViewId;
          panelMemory.set(id, {
            sidebar: sidebar?.visible ?? true,
            tab: active === 'search' || active === 'git' ? active : 'files',
            ai: layout?.panels?.auxiliary?.visible ?? false,
            terminal: layout?.panels?.bottom?.visible ?? false,
            focus: layout?.focusMode ?? false,
          });
        }
        await editor.setProject(id, result.projectEpoch, result.session);
        if (generation !== activation.current) return false;
        setProjects(items => items.map(p => p.id === id ? result.project : p));
        setWorkspaceId(result.project.workspaceId); setProjectId(id); setEpoch(result.projectEpoch);
        setProjectAccessError(undefined);
        return true;
      } catch (reason) {
        if (generation === activation.current) {
          if (reason instanceof HorizonError && reason.details?.kind === 'projectDirectory' && typeof reason.details.projectId === 'string') {
            setProjectAccessError({ projectId: reason.details.projectId, code: reason.code, message: reason.message });
          } else reportError(reason);
        }
        return false;
      }
      finally { if (generation === activation.current) setBusyProject(undefined); }
    });
    navigationQueue.current = pending.then(() => undefined);
    return pending;
  }, [reportError]);
  const activate = useCallback((id: string) => navigate({ projectId: id }), [navigate]);
  const selectWorkspace = useCallback((id: string) => navigate({ workspaceId: id }), [navigate]);
  const boot = useCallback(async () => {
    setBooting(true); setBootError('');
    try {
      const data = await refresh();
      setWorkspaceId(data.activeWorkspaceId ?? data.workspaces[0]?.id ?? '');
      const remembered = data.projects.find(p => p.id === data.activeProjectId);
      if (remembered) await activate(remembered.id);
    } catch (reason) { setBootError(errorMessage(reason)); }
    finally { setBooting(false); }
  }, [activate, refresh]);
  useEffect(() => { if (nativeAvailable()) void boot(); else { setBooting(false); setBootError('请从 Horizon 桌面应用启动，以连接本机文件、Git 和插件服务。'); } }, [boot]);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let disposed = false; let unsubscribe: (() => void) | undefined;
    void onEvent<{ projectId?: string; state?: string }>('horizon.project.v1', payload => {
      void (async () => {
        if (payload.state === 'sleeping' && payload.projectId) await (await getEditor()).hostClosedProject(payload.projectId);
        await refresh();
      })().catch(reportError);
    }).then(off => { if (disposed) off(); else unsubscribe = off; });
    return () => { disposed = true; unsubscribe?.(); };
  }, [refresh, reportError]);

  return <ErrorBoundary name="Horizon"><AppearanceProvider onError={reportError}>
    <DesktopShell {...{ workspaces, projects, workspaceId, projectId, projectEpoch, booting, bootError, busyProject, error, projectAccessError, activate, selectWorkspace, refresh, reportError }}
      clearProjectAccessError={() => setProjectAccessError(undefined)} setWorkspaceId={setWorkspaceId} clearError={() => setError('')} retryBoot={boot} clearProject={() => { setProjectId(undefined); ++activation.current; }} />
  </AppearanceProvider></ErrorBoundary>;
}

type ShellProps = {
  workspaces: Workspace[]; projects: Project[]; workspaceId: string; projectId?: string; projectEpoch: number; booting: boolean; bootError: string; busyProject?: string; error: string; projectAccessError?: ProjectAccessFailure; clearProjectAccessError: () => void;
  activate: (id: string) => Promise<boolean>; selectWorkspace: (id: string) => Promise<boolean>; refresh: () => Promise<Bootstrap>; reportError: (error: unknown) => void; setWorkspaceId: (id: string) => void; clearError: () => void; retryBoot: () => Promise<void>; clearProject: () => void;
};

function DesktopShell(props: ShellProps) {
  const { workspaces, projects, workspaceId, projectId, projectEpoch, booting, bootError, error, busyProject, activate: activateProject, selectWorkspace, refresh, reportError } = props;
  const [modal, setModal] = useState<ModalKind>(null);
  const [mainPage, setMainPage] = useState<'overview' | 'plugins' | null>(null);
  const [sleepingSnapshot, setSleepingSnapshot] = useState<SleepingProjectSnapshot>();
  const overviewOpen = mainPage === 'overview';
  const pluginsOpen = mainPage === 'plugins';
  const fullPageOpen = mainPage !== null;
  const activate = useCallback(async (id: string) => { const opened = await activateProject(id); if (opened) { setMainPage(null); setSleepingSnapshot(undefined); } return opened; }, [activateProject]);
  const openOverview = useCallback(() => { setModal(null); setMainPage('overview'); }, []);
  const openPlugins = useCallback(() => { setModal(null); setMainPage('plugins'); }, []);
  const [settingsTab, setSettingsTab] = useState('appearance');
  const [panels, setPanels] = useState<PanelState>(defaultPanels);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickOpenMode, setQuickOpenMode] = useState<'files' | 'commands'>('files');
  const openQuickFiles = useCallback(() => { setQuickOpenMode('files'); setMainPage(null); setQuickOpen(true); }, []);
  const [menuProject, setMenuProject] = useState<Project>();
  const [projectMenu, setProjectMenu] = useState<{ project: Project; left: number; top: number; trigger: HTMLElement | null }>();
  useEffect(() => { if (props.projectAccessError) { setModal(null); setQuickOpen(false); setProjectMenu(undefined); } }, [props.projectAccessError]);
  const [editWorkspace, setEditWorkspace] = useState<Workspace>();
  const [stopPlan, setStopPlan] = useState<{ plan: StopPlan; project?: Project; action: 'exit' | 'sleep' | 'remove' }>();
  const [stopBusy, setStopBusy] = useState(false);
  const [wasAI, setWasAI] = useState(false);
  const [wasTerminal, setWasTerminal] = useState(false);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const activeProjectButton = useRef<HTMLButtonElement>(null);
  const lastProject = useRef<string | undefined>(undefined);
  const [reviews, setReviews] = useState<Record<string, { projectId: string; selection: DiffSelection; snapshot: GitSnapshot; onToggleStage?: () => void }>>({});
  const [gitSnapshots, setGitSnapshots] = useState<Record<string, GitSnapshot>>({});
  const [conflicts, setConflicts] = useState<Record<string, boolean>>({});
  const conflictVisibility = useCallback((id: string, visible: boolean) => {
    setConflicts(items => { if (Boolean(items[id]) === visible) return items; const next = { ...items }; if (visible) next[id] = true; else delete next[id]; return next; });
    if (visible) setReviews(items => { if (!items[id]) return items; const next = { ...items }; delete next[id]; return next; });
  }, []);
  const appearance = useAppearance();
  const { settings } = useSettings(projectId);
  const projectResources = useProjectActivity();

  usePlugins(projectId);
  const filesEnabled = usePluginEnabled('horizon.files', projectId);
  const editorEnabled = usePluginEnabled('horizon.editor', projectId);
  const searchEnabled = usePluginEnabled('horizon.search', projectId);
  const gitEnabled = usePluginEnabled('horizon.git', projectId);
  const agentEnabled = usePluginEnabled('horizon.agent', projectId);
  const terminalEnabled = usePluginEnabled('horizon.terminal', projectId);
  const launchEnabled = usePluginEnabled('horizon.launch', projectId);
  const previewEnabled = usePluginEnabled('horizon.markdown', projectId);
  const sleepingProject = !projectId ? projects.find(p => p.id === sleepingSnapshot?.projectId && p.workspaceId === workspaceId && p.state === 'sleeping') : undefined;
  const displayedProjectId = projectId ?? sleepingProject?.id;
  const project = projects.find(p => p.id === displayedProjectId);
  const inaccessibleProject = projects.find(p => p.id === props.projectAccessError?.projectId);
  const workspace = workspaces.find(w => w.id === workspaceId);
  const orderedProjects = projects.filter(p => p.workspaceId === workspaceId).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (workspace?.projectIds.indexOf(a.id) ?? 0) - (workspace?.projectIds.indexOf(b.id) ?? 0));
  const drawerLayout = appearance.layouts.find(layout => layout.id === appearance.snapshot?.effective.layoutId)?.navigation === 'drawer';
  const visibleProjects = drawerLayout && !drawerExpanded ? orderedProjects.filter(p => p.id === (displayedProjectId ?? orderedProjects[0]?.id)) : orderedProjects;
  const projectNavigationSignature = JSON.stringify(visibleProjects.map(p => [p.id, p.displayName, p.state]));
  const gitSnapshot = projectId && gitEnabled ? gitSnapshots[projectId] : undefined;
  const conflictOpen = Boolean(gitEnabled && projectId && conflicts[projectId]);
  const fileGitStatus = useMemo(() => gitSnapshot ? Object.fromEntries(gitSnapshot.files.map(item => [item.file.fileId, item.kind === 'unmerged' ? '!' : item.kind === 'untracked' ? '?' : item.worktree.replace(/[. ]/g, '') || item.index.replace(/[. ]/g, '')])) : undefined, [gitSnapshot]);
  const closeModal = useCallback(() => setModal(null), []);
  const refreshReview = useCallback(({ projectId: id, snapshot }: { projectId: string; snapshot: GitSnapshot }) => {
    setGitSnapshots(items => items[id]?.repoToken === snapshot.repoToken ? items : { ...items, [id]: snapshot });
    setReviews(items => {
      const current = items[id];
      if (!current || current.selection.base === 'commitToParent' || current.snapshot.repoToken === snapshot.repoToken) return items;
      return { ...items, [id]: { ...current, snapshot } };
    });
  }, []);
  const updatePanels = useCallback((patch: Partial<PanelState>) => {
    const next = { ...panels, ...patch };
    setPanels(next);
    if (projectId) {
      panelMemory.set(projectId, next);
      void call('session_update', { layout: {
        panels: {
          primarySidebar: { visible: next.sidebar, activeViewId: next.tab },
          auxiliary: { visible: next.ai, activeViewId: 'agent' },
          bottom: { visible: next.terminal, activeViewId: 'terminal' },
        },
        focusMode: next.focus, focusRestore: null,
      } }, projectId).catch(reportError);
    }
  }, [projectId, panels, reportError]);

  useEffect(() => {
    if (lastProject.current === projectId) return;
    const next = projectId ? panelMemory.get(projectId) ?? { ...defaultPanels } : { ...defaultPanels };
    setPanels(next);
    if (next.ai) setWasAI(true);
    if (next.terminal) setWasTerminal(true);
    lastProject.current = projectId;
  }, [projectId]);
  useEffect(() => {
    // The parent applies layout CSS in its effect; scroll after those dimensions settle.
    const frame = requestAnimationFrame(() => activeProjectButton.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [projectId, appearance.snapshot?.effective.layoutId, appearance.snapshot?.effectiveGeometry.navigationWidth, appearance.snapshot?.effectiveGeometry.topbarHeight, appearance.snapshot?.effectiveGeometry.statusHeight, projectNavigationSignature, drawerExpanded, fullPageOpen, panels.focus]);
  useEffect(() => {
    if (!projectId) return;
    let disposed = false;
    const ids = [editorEnabled && 'horizon.editor', filesEnabled && panels.sidebar && panels.tab === 'files' && 'horizon.files', searchEnabled && panels.sidebar && panels.tab === 'search' && 'horizon.search', gitEnabled && panels.sidebar && panels.tab === 'git' && 'horizon.git', agentEnabled && panels.ai && 'horizon.agent', terminalEnabled && panels.terminal && 'horizon.terminal', launchEnabled && 'horizon.launch'];
    for (const id of ids) if (id) void (async () => {
      const editor = id === 'horizon.editor' ? await getEditor() : undefined;
      if (disposed) return;
      const restoreTicket = editor?.captureRestoreTicket(projectId, projectEpoch);
      await activatePlugin(id, projectId, 'view');
      if (!disposed && editor && restoreTicket) await editor.restoreProjectSession(projectId, restoreTicket);
    })().catch(reason => { if (!disposed) reportError(reason); });
    return () => { disposed = true; };
  }, [projectId, projectEpoch, editorEnabled, filesEnabled, searchEnabled, gitEnabled, agentEnabled, terminalEnabled, launchEnabled, panels.sidebar, panels.tab, panels.ai, panels.terminal, reportError]);
  const openSettings = useCallback((tab = 'appearance') => { setSettingsTab(tab); setModal('settings'); }, []);
  const openFile = useCallback(async (file: { projectId: string; fileId: string; displayPath?: string }) => {
    setMainPage(null);
    setReviews(items => { const next = { ...items }; delete next[file.projectId]; return next; });
    try { await (await getEditor()).openFile(file.fileId, { projectId: file.projectId }); } catch (reason) { reportError(reason); }
  }, [reportError]);
  const chooseSidebar = useCallback((tab: Panel) => { setMainPage(null); updatePanels({ sidebar: true, tab }); }, [updatePanels]);
  const toggleAI = useCallback(() => { setMainPage(null); setWasAI(true); updatePanels({ ai: !panels.ai, ...(window.innerWidth < 960 ? { sidebar: false } : {}) }); }, [panels.ai, updatePanels]);
  const toggleTerminal = useCallback(() => { setMainPage(null); setWasTerminal(true); updatePanels({ terminal: !panels.terminal }); }, [panels.terminal, updatePanels]);
  const commandEnabled = useCallback((id: string) => {
    if (id === 'file.open') return Boolean(projectId && filesEnabled);
    if (id.startsWith('file.')) return Boolean(projectId && editorEnabled);
    const features: Record<string, boolean> = { 'view.files': filesEnabled, 'view.search': searchEnabled, 'view.git': gitEnabled, 'view.ai': agentEnabled, 'view.terminal': terminalEnabled, 'project.launch': launchEnabled };
    return id in features ? Boolean(projectId && features[id]) : true;
  }, [projectId, filesEnabled, editorEnabled, searchEnabled, gitEnabled, agentEnabled, terminalEnabled, launchEnabled]);
  const configuredShortcuts = { ...defaultShortcuts, ...(settings?.effective.shortcuts as Record<string, string> ?? {}) };
  const commands = commandItems.map(([id, title, shortcut]) => ({ id, title, shortcut: (commandShortcutActions[id] ?? id) in configuredShortcuts ? shortcutDisplay(configuredShortcuts[commandShortcutActions[id] ?? id]) : shortcut, disabled: !commandEnabled(id) }));
  useEffect(() => {
    const openTerminal = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId: string }>).detail;
      if (detail.projectId !== projectId) void activate(detail.projectId);
      setWasTerminal(true); updatePanels({ terminal: true }); setModal(null);
    };
    window.addEventListener('horizon:open-terminal', openTerminal); return () => window.removeEventListener('horizon:open-terminal', openTerminal);
  }, [activate, projectId, updatePanels]);
  const executeCommand = useCallback((id: string) => {
    if (!commandEnabled(id)) return;
    switch (id) {
      case 'file.save': void getEditor().then(s => s.saveActive()).catch(reportError); break;
      case 'file.saveAll': void getEditor().then(s => s.saveAll()).catch(reportError); break;
      case 'file.close': void getEditor().then(s => s.requestClose()).catch(reportError); break;
      case 'file.open': openQuickFiles(); break;
      case 'view.search': chooseSidebar('search'); break;
      case 'view.files': chooseSidebar('files'); break;
      case 'view.git': chooseSidebar('git'); break;
      case 'view.ai': toggleAI(); break;
      case 'view.terminal': toggleTerminal(); break;
      case 'view.sidebar': updatePanels({ sidebar: !panels.sidebar }); break;
      case 'view.focus': updatePanels({ focus: !panels.focus }); break;
      case 'app.settings': openSettings(); break;
      case 'app.plugins': openPlugins(); break;
      case 'app.recovery': setModal('recovery'); break;
      case 'project.add': setModal('add'); break;
      case 'project.overview': openOverview(); break;
      case 'project.launch': openSettings('launch'); break;
    }
  }, [chooseSidebar, openSettings, openOverview, openPlugins, panels.sidebar, panels.focus, reportError, toggleAI, toggleTerminal, updatePanels, commandEnabled, openQuickFiles]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented || document.querySelector('dialog[open],[aria-modal="true"],[role="menu"]')) return;
      const configured = { ...defaultShortcuts, ...(settings?.effective.shortcuts as Record<string, string> ?? {}) };
      const combo = shortcutFromEvent(event);
      const action = Object.entries(configured).find(([, shortcut]) => shortcut && shortcut === combo)?.[0];
      const aliases: Record<string, string> = { 'sidebar.toggle': 'view.sidebar', 'agent.toggle': 'view.ai', 'settings.open': 'app.settings', 'terminal.toggle': 'view.terminal', 'focus.toggle': 'view.focus', 'search.open': 'view.search' };
      if (action) {
        event.preventDefault(); event.stopPropagation();
        if (action === 'command.open') { if (projectId && filesEnabled) { setMainPage(null); setQuickOpenMode('commands'); setQuickOpen(true); } else setModal('commands'); }
        else executeCommand(aliases[action] ?? action);
        return;
      }
      let command: string | undefined;
      if (event.key === 'Escape') { if (quickOpen) setQuickOpen(false); else if (fullPageOpen) setMainPage(null); else if (window.innerWidth < 960) updatePanels({ sidebar: false, ai: false }); }
      if (event.key === 'F6') {
        const regions = [...document.querySelectorAll<HTMLElement>('[data-focus-region]')].filter(e => e.offsetParent !== null);
        const current = regions.findIndex(e => e.contains(document.activeElement));
        const next = regions[(current + (event.shiftKey ? -1 : 1) + regions.length) % regions.length];
        next?.querySelector<HTMLElement>('button:not(:disabled),input,select,[tabindex="0"],.cm-content')?.focus(); event.preventDefault();
      }
      if (command) { event.preventDefault(); executeCommand(command); }
    };
    window.addEventListener('keydown', keys, true); return () => window.removeEventListener('keydown', keys, true);
  }, [executeCommand, quickOpen, fullPageOpen, updatePanels, settings, projectId, filesEnabled]);

  const prepareStop = useCallback(async (action: 'exit' | 'sleep' | 'remove', target?: Project) => {
    try {
      await (await getEditor()).flushDrafts(action === 'exit' ? undefined : target!.id);
      const plan = await call<StopPlan>(action === 'exit' ? 'app_exit_plan' : 'project_close_plan', action === 'exit' ? {} : { projectId: target!.id, action });
      setStopPlan({ plan, project: target, action }); setModal(null);
    } catch (reason) { reportError(reason); }
  }, [reportError]);
  useEffect(() => {
    if (!nativeAvailable()) return;
    let disposed = false; let dispose: (() => Promise<void>) | undefined;
    void onEvent('horizon.closeRequested', () => { void prepareStop('exit'); }).then(fn => {
      if (disposed) void fn(); else dispose = fn;
    }).catch(reason => { if (!disposed) reportError(reason); });
    return () => { disposed = true; void dispose?.(); };
  }, [prepareStop, reportError]);
  const applyStop = async (decision: 'save' | 'retainCheckpoint' | 'discard') => {
    if (!stopPlan) return; setStopBusy(true);
    try {
      const store = await getEditor();
      if (decision === 'save' && !await store.saveAll(stopPlan.project?.id)) throw new Error('仍有文档未保存成功。请先处理保存错误，再继续。');
      if (decision === 'retainCheckpoint') await store.flushDrafts(stopPlan.project?.id);
      const fresh = await call<StopPlan>(stopPlan.action === 'exit' ? 'app_exit_plan' : 'project_close_plan', stopPlan.action === 'exit' ? {} : { projectId: stopPlan.project!.id, action: stopPlan.action });
      const decisions = [...fresh.resources.map(r => ({ resourceId: r.resourceId, action: 'stop' })), ...fresh.dirtyDocuments.map(documentId => ({ resourceId: documentId, action: decision, ...(decision === 'retainCheckpoint' ? { checkpointId: documentId } : {}) }))];
      await call(stopPlan.action === 'exit' ? 'app_exit_apply' : 'project_close_apply', { planId: fresh.planId, planDigest: fresh.digest ?? fresh.planDigest, decisions });
      if (stopPlan.action === 'sleep' && projectId && projectId === stopPlan.project?.id) {
        const session = store.getSnapshot().projects.get(projectId);
        setSleepingSnapshot({ projectId, tabs: (session?.tabs ?? []).map(fileId => ({ fileId, path: store.getBuffer(projectId, fileId)?.path ?? fileId, active: fileId === session?.activeFileId })) });
        setMainPage(null); setQuickOpen(false);
      }
      await store.hostClosedProject(stopPlan.project?.id, decision === 'discard' ? 'discard' : 'retainCheckpoint');
      if (stopPlan.action !== 'exit') { await refresh(); if (projectId === stopPlan.project?.id) props.clearProject(); setStopPlan(undefined); }
    } catch (reason) { reportError(reason); }
    finally { setStopBusy(false); }
  };

  const manageProject = (item: Project, trigger = document.activeElement as HTMLElement | null) => {
    const rect = trigger?.getBoundingClientRect();
    setProjectMenu({ project: item, left: rect?.left ?? 80, top: (rect?.bottom ?? 96) + 8, trigger });
  };
  const projectSettings = (item: Project) => { setProjectMenu(undefined); setMenuProject(item); setModal('project'); };
  const addFinished = async (id: string) => { await refresh(); setModal(null); await activate(id); };
  const featureMissing = (name: string) => <EmptyState title={`${name}插件尚未启用`} action={<button onClick={() => openPlugins()}><Puzzle size={15} />打开插件中心</button>}>安装或恢复插件后即可继续使用。</EmptyState>;
  const lazyPanel = (name: string, child: ReactNode) => <ErrorBoundary name={name} resetKey={projectId}><Suspense fallback={<Loading />}>{child}</Suspense></ErrorBoundary>;
  const saveGeometry = (key: GeometryKey, value: number) => appearance.setGeometry(key, value).catch(reportError);

  return <div className={`horizon-app ${fullPageOpen ? 'full-page-open' : !projectId && !sleepingProject ? 'welcome-open' : ''} ${panels.focus ? 'focus-mode' : ''} ${panels.sidebar ? 'sidebar-open' : 'sidebar-closed'} ${panels.ai ? 'ai-open' : ''} ${panels.terminal ? 'terminal-open' : ''}`}>
    <header className="topbar" data-tauri-drag-region data-focus-region="toolbar">
      <div className="brand" data-tauri-drag-region><Orbit size={25} strokeWidth={1.6} /><span>Horizon</span></div>
      <label className="workspace-switch"><span className="sr-only">工作区</span><select aria-label="切换工作区" value={workspaceId} onChange={e => { setSleepingSnapshot(undefined); void selectWorkspace(e.target.value); }}>{workspaces.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}{!workspaces.length ? <option>工作区</option> : null}</select><ChevronDown size={13} /></label>
      <div className="topbar-space" data-tauri-drag-region />
      <button className="quick-open-button" onClick={() => { if (projectId && filesEnabled) openQuickFiles(); else setModal('commands'); }}><Search size={15} /><span>搜索文件或命令</span><kbd>{shortcutDisplay(configuredShortcuts[projectId && filesEnabled ? 'file.open' : 'command.open'])}</kbd></button>
      <button className="icon-button" aria-label="切换侧栏" title={`切换侧栏 ${shortcutDisplay(configuredShortcuts['sidebar.toggle'])}`} onClick={() => { setMainPage(null); updatePanels({ sidebar: !panels.sidebar }); }}><PanelsTopLeft size={18} /></button>
      <button className={`icon-button ${panels.ai ? 'selected' : ''}`} aria-label="AI 助手" title="AI 助手" onClick={toggleAI}><Sparkles size={18} /></button>
      <button className={`icon-button plugin-entry ${pluginsOpen ? 'selected' : ''}`} aria-label="插件中心" title="插件中心" onClick={() => openPlugins()}><Puzzle size={18} /><span>插件</span></button>
      <button className="icon-button" aria-label="设置" title={`设置 ${shortcutDisplay(configuredShortcuts['settings.open'])}`} onClick={() => openSettings()}><Settings2 size={18} /></button>
      {panels.focus ? <button className="focus-exit" onClick={() => updatePanels({ focus: false })}><Minimize size={14} />退出专注</button> : null}
    </header>

    <nav className={`project-navigation ${drawerExpanded ? 'drawer-expanded' : ''}`} aria-label="项目" data-focus-region="projects">
      <div className="navigation-group-label">工作区项目</div>
      <button className={`nav-overview icon-button ${overviewOpen ? 'selected' : ''}`} aria-pressed={overviewOpen} aria-label="项目总览" title="项目总览" onClick={openOverview}><LayoutGrid size={18} /></button>
      <div className="nav-divider" />
      <div className="project-list" role="list" onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.project-button')]; const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (i + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1) + buttons.length) % buttons.length;
        buttons[next]?.focus(); event.preventDefault();
      }}>
        {visibleProjects.map(p => { const activity = projectResources.filter(resource => resource.projectId === p.id); return <div className="project-item" role="listitem" key={p.id}>
          <button ref={p.id === displayedProjectId ? activeProjectButton : undefined} className={`project-button ${p.id === displayedProjectId ? 'active' : ''}`} aria-label={`切换到项目 ${p.displayName}${activity.length ? '，运行中' : ''}`} aria-current={p.id === displayedProjectId ? 'page' : undefined} title={`${p.displayName}\n${p.rootDisplayPath}`} onClick={() => void activate(p.id)} onContextMenu={e => { e.preventDefault(); manageProject(p, e.currentTarget); }} onKeyDown={e => { if (e.shiftKey && e.key === 'F10') { e.preventDefault(); manageProject(p, e.currentTarget); } }}>
            <span className="project-avatar">{busyProject === p.id ? <span className="spinner" /> : p.displayName.slice(0, 1).toLocaleUpperCase()}</span><span className="project-name">{p.displayName}</span>{p.pinned ? <Pin size={10} className="pin-mark" /> : null}{p.state === 'sleeping' ? <Moon size={11} /> : null}{activity.length ? <span className="project-activity" title={`${activity.length} 项资源运行中`} aria-label={`${activity.length} 项资源运行中`} /> : null}
          </button><button className="project-more icon-button" aria-label={`管理项目 ${p.displayName}`} onClick={event => manageProject(p, event.currentTarget)}><MoreHorizontal size={14} /></button>
        </div>; })}
      </div>
      <button className="drawer-toggle" aria-expanded={drawerExpanded} onClick={() => setDrawerExpanded(value => !value)}><ChevronDown size={15} /><span>{drawerExpanded ? '收起项目' : '更多项目'}</span></button>
      {drawerExpanded ? <button className="drawer-manage" onClick={openOverview}><FolderOpen size={15} />管理项目</button> : null}
      <button className="nav-add icon-button" aria-label="添加本地项目" title="添加本地项目" onClick={() => setModal('add')}><Plus size={19} /><span>添加项目</span></button>
      <div className="nav-spacer" />
      <button className="nav-search icon-button" aria-label="项目搜索" title={`项目搜索 ${shortcutDisplay(configuredShortcuts['search.open'])}`} onClick={() => chooseSidebar('search')}><Search size={18} /></button>
      <button className="nav-plugins icon-button" aria-label="管理插件" title="插件中心" onClick={() => openPlugins()}><Puzzle size={18} /></button>
    </nav>

    <aside className="primary-sidebar" aria-label="项目侧栏" data-focus-region="sidebar">
      <header className="sidebar-heading"><strong title={project?.rootDisplayPath}>{project?.displayName ?? '工作区'}</strong>{project ? <button className="icon-button" aria-label="项目操作" onClick={event => manageProject(project, event.currentTarget)}><MoreHorizontal size={17} /></button> : null}<button className="icon-button" aria-label="收起侧栏" onClick={() => updatePanels({ sidebar: false })}><X size={16} /></button></header>
      <div className="sidebar-tabs" role="tablist" aria-label="项目工具"><button role="tab" aria-selected={panels.tab === 'files'} onClick={() => chooseSidebar('files')}><Files size={13} />文件</button><button role="tab" aria-selected={panels.tab === 'git'} onClick={() => chooseSidebar('git')}><GitBranch size={13} />Git</button><button role="tab" aria-selected={panels.tab === 'search'} onClick={() => chooseSidebar('search')} aria-label="搜索"><Search size={14} /></button></div>
      <div className="sidebar-content">
        {sleepingProject ? <div className="sleeping-project-sidebar"><Moon size={19} /><strong>项目已休眠</strong><p>文件与后台服务将在恢复后载入。</p><span>已保留 {sleepingSnapshot?.tabs.length ?? 0} 个文件标签</span></div> : !projectId ? <EmptyState title="尚未选择项目" action={<button onClick={() => setModal('add')}>添加本地项目</button>} /> : panels.tab === 'files' ? filesEnabled ? lazyPanel('文件树', <FileExplorer projectId={projectId} projectEpoch={projectEpoch} gitStatus={fileGitStatus} />) : featureMissing('文件树') : panels.tab === 'search' ? searchEnabled ? lazyPanel('搜索', <SearchPanel projectId={projectId} projectEpoch={projectEpoch} />) : featureMissing('搜索') : gitEnabled ? lazyPanel('Git', <GitPanel projectId={projectId} conflictTargetId="git-conflict-slot" onConflictVisibilityChange={conflictVisibility} onSnapshot={refreshReview} onOpenFile={editorEnabled ? openFile : undefined} onOpenDiff={review => setReviews(items => ({ ...items, [review.projectId]: review }))} onError={reportError} />) : featureMissing('Git')}
      </div>
      <PluginSlot slot="primarySidebar" projectId={projectId} /><footer className="sidebar-footer"><FolderOpen size={15} /><span title={project?.rootDisplayPath}>{project?.rootDisplayPath.split('/').pop() ?? '本地工作区'}</span><button className="icon-button" aria-label="快速打开文件" onClick={openQuickFiles}><Search size={14} /></button></footer>
      <ResizeHandle label="文件侧栏宽度" variable="--sidebar-width" currentValue={appearance.snapshot?.effectiveGeometry.sidebarWidth ?? 240} min={160} max={480} defaultValue={240} onCommit={v => saveGeometry('sidebarWidth', v)} />
    </aside>

    <main className="editor-region" aria-label={overviewOpen ? '项目总览' : pluginsOpen ? '插件中心' : '编辑区域'} data-focus-region="editor">
      {booting ? <Loading label="正在打开 Horizon…" /> : bootError ? <div className="boot-error"><Orbit size={42} /><h1>Horizon · 地平线</h1><p>{bootError}</p>{nativeAvailable() ? <button onClick={() => void props.retryBoot()}><RefreshCw size={16} />重新连接</button> : <code>npm run desktop</code>}</div> : projectId ? <><div className="editor-content-host" hidden={fullPageOpen || conflictOpen || Boolean(gitEnabled && reviews[projectId])}>{editorEnabled ? lazyPanel('编辑器', <EditorWorkbench projectId={projectId} projectEpoch={projectEpoch} onQuickOpen={openQuickFiles} previewEnabled={previewEnabled} />) : featureMissing('代码编辑器')}</div>{gitEnabled && reviews[projectId] ? <div className="review-content-host" hidden={fullPageOpen || conflictOpen}>{lazyPanel('Git 差异', <GitDiffSurface {...reviews[projectId]} onClose={() => setReviews(items => { const next = { ...items }; delete next[projectId]; return next; })} onOpenFile={editorEnabled ? openFile : undefined} />)}</div> : null}</> : sleepingProject && sleepingSnapshot && !fullPageOpen ? <SleepingProjectPage snapshot={sleepingSnapshot} busy={busyProject === sleepingProject.id} onResume={() => void activate(sleepingProject.id)} onPreferences={() => openSettings('projects')} /> : !fullPageOpen ? <Welcome {...{ orderedProjects, activate }} overview={openOverview} add={() => setModal('add')} clone={() => setModal('clone')} plugins={() => openPlugins()} settings={() => openSettings()} /> : null}
      <div id="git-conflict-slot" className="review-content-host" hidden={fullPageOpen || !conflictOpen} />
      <div id="agent-review-slot" className="agent-review-content-host" hidden={fullPageOpen || !projectId || !agentEnabled} />
      {overviewOpen ? <ProjectOverview {...{ workspaces, projects, workspaceId, projectId, gitSnapshots }} select={id => void activate(id)} add={() => setModal('add')} clone={() => setModal('clone')} manage={manageProject} editWorkspace={w => { setEditWorkspace(w); setModal('workspace'); }} newWorkspace={() => { setEditWorkspace(undefined); setModal('workspace'); }} onError={reportError} refresh={refresh} /> : null}
      {pluginsOpen ? <div className="plugins-page">{lazyPanel('插件中心', <PluginCenter projectId={projectId} onError={reportError} onAppearance={() => openSettings()} onClose={() => setMainPage(null)} />)}</div> : null}
      {projectId && !fullPageOpen && !conflictOpen && !(gitEnabled && reviews[projectId]) ? <button className="editor-focus icon-button" aria-label={panels.focus ? '退出专注模式' : '进入专注模式'} title={panels.focus ? '退出专注模式' : '进入专注模式'} onClick={() => updatePanels({ focus: !panels.focus })}>{panels.focus ? <Minimize size={15} /> : <Maximize size={15} />}</button> : null}
    </main>

    <aside className="auxiliary-panel" hidden={fullPageOpen || !projectId || !panels.ai || panels.focus} aria-label="AI 助手" data-focus-region="ai"><header className="panel-heading"><Sparkles size={16} /><strong>AI 助手</strong><span className="spacer" /><button className="icon-button" aria-label="AI 连接设置" onClick={() => openSettings('agent')}><Settings2 size={15} /></button><button className="icon-button" aria-label="隐藏 AI 面板" onClick={() => updatePanels({ ai: false })}><X size={16} /></button></header>{wasAI && projectId ? agentEnabled ? lazyPanel('AI 助手', <AgentPanel projectId={projectId} projectName={project?.displayName ?? '项目名称暂不可用'} onError={reportError} />) : featureMissing('Pi 助手') : <EmptyState title="先选择项目">对话与任务分别保留在各自项目中。</EmptyState>}<ResizeHandle label="AI 面板宽度" variable="--auxiliary-width" currentValue={appearance.snapshot?.effectiveGeometry.auxiliaryWidth ?? 320} min={240} max={560} defaultValue={320} reverse onCommit={v => saveGeometry('auxiliaryWidth', v)} /></aside>

    <section className="bottom-panel" hidden={fullPageOpen || !projectId || !panels.terminal || panels.focus} aria-label="终端" data-focus-region="terminal"><ResizeHandle label="终端高度" variable="--bottom-height" currentValue={appearance.snapshot?.effectiveGeometry.bottomHeight ?? 220} direction="vertical" min={120} max={480} defaultValue={220} reverse onCommit={v => saveGeometry('bottomHeight', v)} />{!(wasTerminal && projectId && terminalEnabled) ? <header className="panel-heading"><Terminal size={15} /><strong>终端</strong><span className="panel-project">{project?.displayName}</span><span className="spacer" /><button className="text-button" onClick={() => openSettings('launch')}>启动方案</button><button className="icon-button" aria-label="隐藏终端面板" onClick={() => updatePanels({ terminal: false })}><X size={15} /></button></header> : null}{wasTerminal && projectId ? terminalEnabled ? lazyPanel('终端', <TerminalPanel projectId={projectId} onError={reportError} onOpenLauncher={() => openSettings('launch')} onClose={() => updatePanels({ terminal: false })} />) : featureMissing('终端') : <EmptyState title="先选择项目" />}</section>

    <footer className="statusbar" data-focus-region="status"><button className="status-button" onClick={() => chooseSidebar('git')}><GitBranch size={14} /><span>{gitSnapshot?.head.name ?? project?.displayName ?? '本地工作台'}</span>{gitSnapshot?.files.length ? <span>{gitSnapshot.files.length}{gitSnapshot.truncated ? '+' : ''} 个更改</span> : null}</button><div className="status-spacer" /><div id="editor-status-slot" className="editor-status-slot" hidden={fullPageOpen || conflictOpen || !projectId || !editorEnabled || Boolean(gitEnabled && projectId && reviews[projectId])} />{projectId && !fullPageOpen && launchEnabled ? lazyPanel('项目启动', <LauncherToolbar projectId={projectId} onError={reportError} />) : null}<button className={`status-button ${panels.terminal ? 'selected' : ''}`} onClick={toggleTerminal} aria-label="切换终端"><Terminal size={13} /><span>终端</span></button><button className="status-button" onClick={() => openPlugins()}><Puzzle size={13} /><span>扩展</span></button><span className="status-platform">macOS · 0.1.0</span></footer>

    {error ? <ErrorNotice message={error} onClose={props.clearError} /> : null}
    {inaccessibleProject && props.projectAccessError ? <ProjectAccessDialog project={inaccessibleProject} failure={props.projectAccessError} onClose={props.clearProjectAccessError} open={activate} refresh={refresh} /> : null}
    {modal === 'settings' ? <Modal title="设置" wide onClose={closeModal} className="settings-modal">{lazyPanel('设置', <SettingsPanel onClose={closeModal} onManageRecovery={() => setModal('recovery')} projectId={projectId} projectName={project?.displayName} projects={orderedProjects} onSelectProject={activate} onManagePlugins={() => openPlugins()} onError={reportError} initialSection={settingsTab === 'agent' ? 'ai' : settingsTab === 'launch' || settingsTab === 'projects' ? 'projects' : 'appearance'} agentSettings={lazyPanel('AI 设置', <AgentSettings projectId={projectId} onError={reportError} />)} projectSettings={projectId ? lazyPanel('启动方案', <LauncherPanel projectId={projectId} onError={reportError} />) : <EmptyState title="先选择项目">启动方案属于具体项目。</EmptyState>} />)}</Modal> : null}
    {modal === 'recovery' ? <Modal title="恢复草稿" wide onClose={closeModal}>{lazyPanel('恢复草稿', <RecoveryPanel projects={projects} canRestore={id => projects.some(project => project.id === id) && pluginRuntime.isEnabled('horizon.editor', id)} onRestore={async (checkpointId, id) => { await activate(id); await activatePlugin('horizon.editor', id, 'view'); await (await getEditor()).restoreDraft(checkpointId, id); setModal(null); }} />)}</Modal> : null}
    {modal === 'workspace' ? <Modal title={editWorkspace ? '管理工作区' : '创建工作区'} className="project-setup-modal" onClose={closeModal}><WorkspaceForm onCancel={closeModal} workspace={editWorkspace} defaultWorkspace={workspaces[0]} onSaved={async id => { await refresh(); await selectWorkspace(id); openOverview(); }} onError={reportError} /></Modal> : null}
    {modal === 'add' ? <Modal title="添加本地项目" className="project-setup-modal" onClose={closeModal}><AddProjectForm onCancel={closeModal} workspaces={workspaces} workspaceId={workspaceId} onAdded={addFinished} onError={reportError} /></Modal> : null}
    {modal === 'clone' ? <Modal title="克隆仓库" className="project-setup-modal project-clone-modal" onClose={closeModal}>{lazyPanel('克隆仓库', <CloneForm workspaceId={workspaceId} onClose={closeModal} onCloned={() => { void refresh().then(data => { const last = data.projects.at(-1); if (last) void addFinished(last.id); }); }} />)}</Modal> : null}
    {modal === 'project' && menuProject ? <Modal title="项目设置" className="project-setup-modal" onClose={closeModal}><ProjectForm project={menuProject} workspaces={workspaces} onSaved={async relocated => { const data = await refresh(); const active = data.projects.find(p => p.id === projectId); if (active) props.setWorkspaceId(active.workspaceId); if (relocated && menuProject.id === projectId) { await activate(menuProject.id); await (await getEditor()).externalChanged(menuProject.id); } setModal(null); }} onCloseProject={action => void prepareStop(action, menuProject)} onError={reportError} /></Modal> : null}
    {modal === 'commands' ? <Modal title="命令" onClose={closeModal}><CommandList items={commands} execute={id => { setModal(null); executeCommand(id); }} /></Modal> : null}
    {quickOpen && projectId && filesEnabled ? lazyPanel('快速打开', <QuickOpen commands={commands} open={quickOpen} initialMode={quickOpenMode} projectId={projectId} projectEpoch={projectEpoch} onClose={() => setQuickOpen(false)} onCommand={executeCommand} />) : null}
    {projectMenu ? <ProjectMenu {...projectMenu} onClose={() => setProjectMenu(undefined)} onSettings={() => projectSettings(projectMenu.project)} onPin={() => {
      const item = projectMenu.project; setProjectMenu(undefined);
      void call('project_update', { projectId: item.id, expectedRevision: item.revision, pinned: !item.pinned }).then(refresh).catch(reportError);
    }} onReveal={() => { const id = projectMenu.project.id; setProjectMenu(undefined); void call('project_reveal', { projectId: id }).catch(reportError); }} onLaunch={() => {
      const id = projectMenu.project.id; setProjectMenu(undefined); void activate(id).then(opened => { if (opened) openSettings('launch'); });
    }} onStop={action => { const item = projectMenu.project; setProjectMenu(undefined); void prepareStop(action, item); }} /> : null}
    {stopPlan ? <Modal title={stopPlan.action === 'exit' ? '退出 Horizon' : `${stopPlan.action === 'sleep' ? '休眠' : '移除'}项目`} onClose={() => { if (!stopBusy) setStopPlan(undefined); }}><StopConfirmation {...stopPlan} projects={projects} busy={stopBusy} apply={decision => void applyStop(decision)} cancel={() => setStopPlan(undefined)} /></Modal> : null}
  </div>;
}

function ProjectAccessDialog({ project, failure, onClose, open, refresh }: {
  project: Project; failure: ProjectAccessFailure; onClose: () => void; open: (id: string) => Promise<boolean>; refresh: () => Promise<Bootstrap>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const permissionDenied = failure.code === 'PERMISSION_DENIED';
  const recover = async (relocate: boolean) => {
    setBusy(true); setError('');
    try {
      if (relocate) {
        const pick = await call<{ selectionToken: string | null }>('project_pick_directory');
        if (!pick.selectionToken) return;
        await call('project_relocate', { projectId: project.id, selectionToken: pick.selectionToken, expectedRevision: project.revision });
        await refresh();
      }
      const opened = await open(project.id);
      if (opened && relocate) await (await getEditor()).externalChanged(project.id);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setBusy(false); }
  };
  return <Modal title={permissionDenied ? '项目目录需要访问权限' : '项目目录不可用'} className="project-setup-modal" onClose={() => { if (!busy) onClose(); }}>
    <div className="form-stack">
      <div className="path-card"><FolderOpen size={20} /><span><strong>{project.displayName}</strong><br />{project.rootDisplayPath}</span></div>
      <p className="form-intro">{failure.message}</p>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <footer className="form-actions">
        <button disabled={busy} onClick={onClose}>关闭</button>
        <button className={permissionDenied ? '' : 'primary-button'} disabled={busy} onClick={() => void recover(true)}><FolderOpen size={15} />重新定位目录</button>
        <button className={permissionDenied ? 'primary-button' : ''} disabled={busy} onClick={() => void recover(false)}><RefreshCw size={15} />{busy ? '正在处理…' : '重试'}</button>
      </footer>
    </div>
  </Modal>;
}

function Welcome({ orderedProjects, activate, add, clone, plugins, settings, overview }: { orderedProjects: Project[]; activate: (id: string) => Promise<boolean>; add: () => void; clone: () => void; plugins: () => void; settings: () => void; overview: () => void }) {
  const recent = orderedProjects.filter(project => project.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? '').localeCompare(a.lastOpenedAt ?? '')).slice(0, 5);
  return <div className="welcome"><div className="welcome-inner">
    <section><div className="welcome-brand"><Orbit size={42} strokeWidth={1.6} /><span>轻量代码工作台</span></div><h1>Horizon</h1><p className="welcome-subtitle">留一点空间，<br />专注眼前的项目。</p><div className="welcome-actions"><button className="primary-button" onClick={add}><FolderOpen size={16} />打开本地项目</button><button onClick={clone}><GitBranch size={16} />克隆仓库</button></div><p className="welcome-note"><Laptop size={15} />本地使用，无需登录。</p></section>
    <section className="welcome-recent"><h2>最近打开</h2>{recent.length ? <div className="recent-projects">{recent.map(p => <button key={p.id} onClick={() => void activate(p.id)}><span className="recent-mark">{p.displayName.slice(0, 1).toLocaleUpperCase()}</span><span className="recent-copy"><strong>{p.displayName}</strong><small title={p.rootDisplayPath}>{p.rootDisplayPath}</small></span><ArrowUpRight size={15} /></button>)}</div> : <div className="welcome-hints"><p>添加本地项目，即可在这里继续。</p><button onClick={plugins}><Puzzle size={16} />浏览插件</button><button onClick={settings}><Settings2 size={16} />布置工作台</button></div>}<button className="text-button all-projects" onClick={overview}><ArrowRight size={16} />查看所有项目</button></section>
  </div></div>;
}

function AddProjectForm({ workspaces, workspaceId, onAdded, onError, onCancel }: { onCancel: () => void; workspaces: Workspace[]; workspaceId: string; onAdded: (id: string) => Promise<void>; onError: (error: unknown) => void }) {
  const [selection, setSelection] = useState<{ selectionToken: string | null; displayPath?: string }>(); const [name, setName] = useState(''); const [group, setGroup] = useState(workspaceId); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const pick = async () => { setBusy(true); setError(''); try { const next = await call<{ selectionToken: string | null; displayPath?: string }>('project_pick_directory'); if (next.selectionToken) { setSelection(next); setName(next.displayPath?.split('/').filter(Boolean).at(-1) ?? ''); } } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); } };
  return <form className="form-stack" onSubmit={async e => { e.preventDefault(); if (!selection?.selectionToken) return; setBusy(true); setError(''); try { const result = await call<{ project: Project; reused: boolean }>('project_register', { selectionToken: selection.selectionToken, workspaceId: group, displayName: name.trim() || undefined }); await onAdded(result.project.id); } catch (err) { setError(errorMessage(err)); onError(err); } finally { setBusy(false); } }}><p className="form-intro">将文件夹加入工作区，之后可以随时在项目栏切换。</p><label>项目目录<span className="project-directory-field"><input readOnly aria-label="项目目录" value={selection?.displayPath ?? ''} placeholder="选择本地文件夹…" /><button type="button" disabled={busy} onClick={() => void pick()}><FolderOpen size={16} />选择</button></span></label><label>显示名称<input autoComplete="off" value={name} onChange={e => setName(e.target.value)} placeholder="项目名称" /></label><label>所属工作区<select value={group} onChange={e => setGroup(e.target.value)}>{workspaces.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select></label><div className="project-form-note"><FolderOpen size={17} /><span>文件保留在原位置<small>添加项目只保存目录关联，不会移动或上传文件。</small></span></div>{error ? <p className="inline-error" role="alert">{error}</p> : null}<footer className="form-actions"><button type="button" className="text-button" disabled={busy} onClick={onCancel}>取消</button><button type="submit" className="primary-button" disabled={!selection?.selectionToken || busy}>{busy ? '正在添加…' : '添加并打开'}<ArrowRight size={15} /></button></footer></form>;
}

function WorkspaceForm({ workspace, defaultWorkspace, onSaved, onError, onCancel }: { onCancel: () => void; workspace?: Workspace; defaultWorkspace?: Workspace; onSaved: (id: string) => Promise<void>; onError: (e: unknown) => void }) {
  const [name, setName] = useState(workspace?.name ?? ''); const [busy, setBusy] = useState(false); const [confirmRemove, setConfirmRemove] = useState(false);
  return <form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); try { const item = await call<Workspace>(workspace ? 'workspace_update' : 'workspace_create', workspace ? { workspaceId: workspace.id, expectedRevision: workspace.revision, name: name.trim() } : { name: name.trim() }); await onSaved(item.id); } catch (error) { onError(error); } finally { setBusy(false); } }}><p className="form-intro">用工作区收纳相关项目，例如个人项目、客户工作或实验。</p><label>工作区名称<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例如：个人项目" maxLength={80} /></label><div className="project-form-note"><FolderOpen size={17} /><span>不会移动已有项目<small>工作区只保存项目集合与界面状态。</small></span></div><footer className="form-actions">{workspace && workspace.id !== defaultWorkspace?.id ? <button className="danger-text" type="button" onClick={() => setConfirmRemove(true)}><Trash2 size={15} />移除工作区</button> : null}<span className="spacer" /><button type="button" className="text-button" disabled={busy} onClick={onCancel}>取消</button><button type="submit" className="primary-button" disabled={!name.trim() || busy}>{workspace ? null : <Plus size={15} />}{busy ? '正在保存…' : workspace ? '保存工作区' : '创建工作区'}</button></footer>{confirmRemove ? <div className="confirmation-inline"><p>项目将迁移至「{defaultWorkspace?.name}」。磁盘文件保留。</p><button type="button" onClick={() => setConfirmRemove(false)}>取消</button><button type="button" className="danger-button" disabled={busy} onClick={async () => { setBusy(true); try { await call('workspace_remove', { workspaceId: workspace!.id, expectedRevision: workspace!.revision, moveToWorkspaceId: defaultWorkspace!.id }); await onSaved(defaultWorkspace!.id); } catch (error) { onError(error); } finally { setBusy(false); } }}>确认移除分组</button></div> : null}</form>;
}

function ProjectForm({ project, workspaces, onSaved, onCloseProject, onError }: { project: Project; workspaces: Workspace[]; onSaved: (relocated?: boolean) => Promise<void>; onCloseProject: (action: 'sleep' | 'remove') => void; onError: (e: unknown) => void }) {
  const [name, setName] = useState(project.displayName); const [group, setGroup] = useState(project.workspaceId); const [pinned, setPinned] = useState(project.pinned); const [busy, setBusy] = useState(false);
  return <form className="form-stack" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await call('project_update', { projectId: project.id, expectedRevision: project.revision, displayName: name.trim(), workspaceId: group, pinned }); await onSaved(); } catch (error) { onError(error); } finally { setBusy(false); } }}><div className="path-card"><FolderOpen size={20} /><span>{project.rootDisplayPath}</span></div><label>显示名称<input value={name} onChange={e => setName(e.target.value)} /></label><label>所属工作区<select value={group} onChange={e => setGroup(e.target.value)}>{workspaces.map(w => <option value={w.id} key={w.id}>{w.name}</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} />固定项目</label><div className="project-danger-actions"><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { const pick = await call<{ selectionToken: string | null }>('project_pick_directory'); if (pick.selectionToken) { await call('project_relocate', { projectId: project.id, selectionToken: pick.selectionToken, expectedRevision: project.revision }); await onSaved(true); } } catch (error) { onError(error); } finally { setBusy(false); } }}><FolderOpen size={15} />重新定位目录</button><button type="button" onClick={() => onCloseProject('sleep')}><Moon size={15} />休眠项目</button><button type="button" className="danger-text" onClick={() => onCloseProject('remove')}><Trash2 size={15} />移除项目记录</button></div><footer className="form-actions"><button className="primary-button" disabled={busy || !name.trim()}>{busy ? '正在保存…' : '保存'}</button></footer></form>;
}

function ProjectOverview({ workspaces, projects, workspaceId, projectId, gitSnapshots, select, add, clone, manage, editWorkspace, newWorkspace, onError, refresh }: { workspaces: Workspace[]; projects: Project[]; workspaceId: string; projectId?: string; gitSnapshots: Record<string, GitSnapshot>; select: (id: string) => void; add: () => void; clone: () => void; manage: (p: Project, trigger?: HTMLElement | null) => void; editWorkspace: (w: Workspace) => void; newWorkspace: () => void; onError: (e: unknown) => void; refresh: () => Promise<Bootstrap> }) {
  const [query, setQuery] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const projectById = new Map(projects.map(project => [project.id, project]));
  const currentWorkspace = workspaces.find(workspace => workspace.id === workspaceId);
  const needle = query.toLocaleLowerCase();
  const matches = (p: Project) => (!pinnedOnly || p.pinned) && `${p.displayName} ${p.rootDisplayPath}`.toLocaleLowerCase().includes(needle);
  const recent = projects.filter(p => p.lastOpenedAt && matches(p)).sort((a, b) => b.lastOpenedAt!.localeCompare(a.lastOpenedAt!)).slice(0, 8);
  const move = async (workspace: Workspace, project: Project, delta: number) => { const ids = [...workspace.projectIds]; const i = ids.indexOf(project.id); if (i + delta < 0 || i + delta >= ids.length) return; [ids[i], ids[i + delta]] = [ids[i + delta], ids[i]]; try { await call('workspace_update', { workspaceId: workspace.id, expectedRevision: workspace.revision, projectOrder: ids }); await refresh(); } catch (error) { onError(error); } };
  const pin = async (project: Project) => { try { await call('project_update', { projectId: project.id, expectedRevision: project.revision, pinned: !project.pinned }); await refresh(); } catch (error) { onError(error); } };
  return <div className="overview" aria-label="项目与工作区">
    <header className="overview-heading"><div><h1>你的项目，一目了然。</h1><p>{workspaces.length > 1 ? `${workspaces.length} 个工作区` : currentWorkspace?.name ?? '工作区'} · {projects.length} 个项目{currentWorkspace && workspaces.length === 1 ? <button className="icon-button" aria-label={`管理工作区 ${currentWorkspace.name}`} onClick={() => editWorkspace(currentWorkspace)}><Pencil size={13} /></button> : null}</p></div><div className="overview-heading-actions"><button onClick={newWorkspace}><Plus size={15} />新建工作区</button><button className="primary-button" onClick={add}><FolderOpen size={15} />添加项目</button></div></header>
    <div className="overview-toolbar"><label className="search-input"><span className="sr-only">搜索项目</span><input placeholder="搜索项目名称或路径" value={query} onChange={e => setQuery(e.target.value)} /></label><span className="spacer" /><button className={`text-button ${!pinnedOnly ? 'selected' : ''}`} aria-pressed={!pinnedOnly} onClick={() => setPinnedOnly(false)}>全部</button><button className={`text-button ${pinnedOnly ? 'selected' : ''}`} aria-pressed={pinnedOnly} onClick={() => setPinnedOnly(true)}>已固定</button><button className="text-button" onClick={clone}><GitBranch size={15} />克隆仓库</button></div>
    {workspaces.map(w => { const items = w.projectIds.map(id => projectById.get(id)).filter((p): p is Project => Boolean(p && matches(p))); return <section className={`workspace-section ${w.id === workspaceId ? 'current' : ''}`} key={w.id}>
      {workspaces.length > 1 ? <header><LayoutGrid size={16} /><h2>{w.name}</h2><small>{w.projectIds.length} 个项目</small><button className="icon-button" aria-label={`管理工作区 ${w.name}`} onClick={() => editWorkspace(w)}><Pencil size={14} /></button></header> : null}
      <div className="overview-projects">{items.map(p => { const snapshot = gitSnapshots[p.id]; const stateLabel = p.state === 'sleeping' ? '已休眠' : p.state === 'unavailable' ? p.accessError?.code === 'PERMISSION_DENIED' ? '没有读取权限' : '目录不可用' : snapshot?.head.name ?? '本地项目'; return <article className={`project-card ${p.id === projectId ? 'selected' : ''}`} key={p.id}>
        <button className="project-card-open" aria-label={`打开项目 ${p.displayName}`} onClick={() => select(p.id)}><span className="project-card-header"><span className="project-card-avatar">{p.displayName.slice(0, 1).toLocaleUpperCase()}</span></span><span className="project-card-copy"><strong>{p.displayName}</strong><small title={p.rootDisplayPath}>{p.rootDisplayPath}</small></span><span className="project-card-bottom"><span>{p.state === 'sleeping' ? <Moon size={14} /> : p.state === 'unavailable' ? <AlertCircle size={14} /> : snapshot ? <GitBranch size={14} /> : <FolderOpen size={14} />}{stateLabel}</span><span>{snapshot ? snapshot.files.length ? `${snapshot.files.length}${snapshot.truncated ? '+' : ''} 个更改` : '无更改' : ''}</span></span></button>
        <div className="project-card-controls"><button className="icon-button project-pin" aria-label={`${p.pinned ? '取消固定' : '固定'} ${p.displayName}`} aria-pressed={p.pinned} onClick={() => void pin(p)}><Pin size={14} /></button><button className="icon-button" aria-label={`管理 ${p.displayName}`} onClick={event => manage(p, event.currentTarget)}><MoreHorizontal size={16} /></button></div>
        <div className="project-card-reorder"><button className="icon-button" aria-label={`上移 ${p.displayName}`} disabled={w.projectIds[0] === p.id} onClick={() => void move(w, p, -1)}><ArrowUp size={13} /></button><button className="icon-button" aria-label={`下移 ${p.displayName}`} disabled={w.projectIds.at(-1) === p.id} onClick={() => void move(w, p, 1)}><ArrowDown size={13} /></button></div>
      </article>; })}</div>{!items.length ? <div className="overview-empty">{query || pinnedOnly ? '没有符合条件的项目。' : '尚无项目。添加本地目录即可开始。'}</div> : null}
    </section>; })}
    <section className="overview-recent"><h2>最近访问</h2>{recent.length ? <div className="overview-table-wrap"><table><thead><tr><th>项目</th><th>位置</th><th>上次打开</th><th><span className="sr-only">操作</span></th></tr></thead><tbody>{recent.map(p => <tr key={p.id}><td>{p.displayName}</td><td title={p.rootDisplayPath}>{p.rootDisplayPath}</td><td>{p.state === 'unavailable' ? p.accessError?.code === 'PERMISSION_DENIED' ? '没有读取权限' : '目录不可用' : <time dateTime={p.lastOpenedAt}>{new Date(p.lastOpenedAt!).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>}</td><td><button className="text-button" onClick={() => select(p.id)}>{p.state === 'unavailable' ? <FolderOpen size={15} /> : <ArrowUpRight size={15} />}{p.state === 'unavailable' ? '重试打开' : '打开'}</button></td></tr>)}</tbody></table></div> : <p className="overview-recent-empty">打开项目后，最近访问记录会显示在这里。</p>}</section>
  </div>;
}

const commandShortcutActions: Record<string, string> = { 'view.search': 'search.open', 'view.sidebar': 'sidebar.toggle', 'view.focus': 'focus.toggle', 'view.ai': 'agent.toggle', 'view.terminal': 'terminal.toggle', 'app.settings': 'settings.open' };
const commandItems = [
  ['file.open', '快速打开文件', '⌘P'], ['file.save', '保存当前文件', '⌘S'], ['file.saveAll', '保存全部文件', '⌘⌥S'], ['file.close', '关闭当前文件', '⌘W'],
  ['view.files', '显示文件树', ''], ['view.search', '项目内搜索', '⌘⇧F'], ['view.git', '查看 Git 更改', ''], ['view.sidebar', '切换侧栏', '⌘B'], ['view.focus', '切换专注模式', ''],
  ['view.ai', '切换 AI 助手', ''], ['view.terminal', '切换终端', ''], ['project.launch', '配置项目启动方案', ''], ['app.settings', '打开设置', '⌘,'], ['app.plugins', '打开插件中心', ''], ['app.recovery', '查看恢复草稿', ''], ['project.add', '添加本地项目', ''], ['project.overview', '项目与工作区', ''],
];
function CommandList({ items, execute }: { items: { id: string; title: string; shortcut: string; disabled: boolean }[]; execute: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const listId = useId();
  const results = items.filter(item => item.title.toLocaleLowerCase().includes(query.replace(/^>/, '').trim().toLocaleLowerCase()));
  const active = Math.min(selected, Math.max(0, results.length - 1));
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [active, listId, query]);
  const choose = (index: number) => { const item = results[index]; if (item && !item.disabled) execute(item.id); };
  return <div className="command-list">
    <label className="search-input"><Command size={17} /><input autoFocus role="combobox" aria-label="搜索命令" aria-expanded="true" aria-controls={listId} aria-activedescendant={results.length ? `${listId}-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setSelected(0); }} placeholder="输入操作名称…" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setSelected(Math.max(0, Math.min(results.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1)))); }
      else if (event.key === 'Enter') { event.preventDefault(); choose(active); }
    }} /></label>
    <div id={listId} role="listbox" aria-label="命令结果" className="command-results">{results.map(({ id, title, shortcut, disabled }, index) => <button key={id} id={`${listId}-${index}`} role="option" tabIndex={-1} aria-selected={index === active} aria-disabled={disabled} onMouseDown={event => event.preventDefault()} onMouseMove={() => setSelected(index)} onClick={() => choose(index)}><span>{title}{disabled ? <small>当前上下文或扩展不可用</small> : null}</span><kbd>{shortcut}</kbd></button>)}</div>
    {!results.length ? <p className="form-intro">没有匹配“{query}”的命令。</p> : null}
    <p className="command-help">↑↓ 选择 · Enter 执行 · Esc 返回</p>
  </div>;
}
function StopConfirmation({ plan, project, projects, action, busy, apply, cancel }: { plan: StopPlan; project?: Project; projects: Project[]; action: 'exit' | 'sleep' | 'remove'; busy: boolean; apply: (decision: 'save' | 'retainCheckpoint' | 'discard') => void; cancel: () => void }) {
  const [decision, setDecision] = useState<'save' | 'retainCheckpoint' | 'discard'>('save');
  const projectName = (id?: string) => projects.find(item => item.id === id)?.displayName ?? '本地项目';
  const resourceNames: Record<string, string> = { terminal: '终端', launchProcess: '项目进程', agent: 'Pi 任务', agentCommand: 'Pi 工具进程', git: 'Git 操作', search: '项目搜索', extension: '扩展进程' };
  const stateNames: Record<string, string> = { running: '运行中', starting: '启动中', stopping: '停止中', waiting: '等待中', failed: '异常' };
  return <div className="form-stack">
    <p className="form-intro">{action === 'remove' ? `移除「${project?.displayName}」的项目记录，磁盘文件保留。` : action === 'sleep' ? `暂停「${project?.displayName}」的活动资源。` : '退出前处理未保存文档与运行资源。重启后不会自动执行命令。'}</p>
    {plan.dirtyDocuments.length ? <fieldset><legend>{plan.dirtyDocuments.length} 份未保存文档</legend>
      <ul className="stop-documents" aria-label="未保存文档">{plan.documents.map(document => <li key={document.documentId}><Files size={15} /><span><strong>{document.file.displayPath}</strong><small>{projectName(document.file.projectId)}{document.state === 'conflict' ? ' · 磁盘内容已变化' : ''}</small></span></li>)}</ul>
      <label className="radio-label"><input type="radio" checked={decision === 'save'} onChange={() => setDecision('save')} />保存到原文件</label>
      <label className="radio-label"><input type="radio" checked={decision === 'retainCheckpoint'} onChange={() => setDecision('retainCheckpoint')} />保留恢复草稿，稍后继续</label>
      <label className="radio-label"><input type="radio" checked={decision === 'discard'} onChange={() => setDecision('discard')} />放弃本次未保存编辑</label>
    </fieldset> : <p className="success-note"><Check size={15} />没有未保存文档</p>}
    {plan.resources.length ? <div className="stop-resources"><h3>将停止以下资源</h3>{plan.resources.map(resource => <div key={resource.resourceId}><Terminal size={14} /><span className="stop-resource-copy"><strong>{resource.title || resourceNames[resource.kind] || resource.ownerExtensionId}</strong><small>{projectName(resource.projectId ?? resource.owner?.projectId)} · {resource.ownerExtensionId}{resource.pid ? ` · PID ${resource.pid}` : ''}</small></span><span className="stop-resource-state">{stateNames[resource.state] ?? resource.state}</span></div>)}</div> : null}
    <footer className="form-actions"><button onClick={cancel} disabled={busy}>取消</button><button className={decision === 'discard' ? 'danger-button' : 'primary-button'} disabled={busy} onClick={() => apply(decision)}>{busy ? '正在处理…' : action === 'exit' ? '处理并退出' : action === 'sleep' ? '休眠项目' : '移除记录'}</button></footer>
  </div>;
}
