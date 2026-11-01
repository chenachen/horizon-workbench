import { useCallback, useEffect, useRef, useState } from "react";
import type { Terminal } from "@xterm/xterm";
import { Settings2, X } from "lucide-react";
import {
  call,
  start,
  onEvent,
  errorMessage,
  type TaskHandle,
} from "../../bridge";
import "./processes.css";

type Props = { projectId: string; onError?: (error: string) => void };
type TerminalProps = Props & {
  onOpenLauncher?: () => void;
  onClose?: () => void;
};
type Process = {
  processInstanceId: string;
  terminalSessionId?: string;
  revision: number;
  title: string;
  cwd: string;
  pid: number;
  state: string;
  exitCode?: number | null;
  owner: { projectId: string; launchRunId?: string };
};
type Output = {
  viewSubscriptionId: string;
  terminalSessionId: string;
  byteOffset: string;
  bufferStart: string;
  data: string;
  gap: boolean;
};
type Ready = {
  kind: "processStarted" | "exit" | "tcp" | "http" | "stdout";
  codes?: number[];
  host?: string;
  port?: number;
  timeoutMs?: number;
  url?: string;
  statusCodes?: number[];
  pattern?: string;
};
type Step = {
  stepId: string;
  title: string;
  dependsOn: string[];
  command:
    | { kind: "exec"; executable: string; args: string[] }
    | { kind: "shell"; shell: string; script: string };
  cwd: string;
  env: Record<string, string>;
  secretRefs: Record<string, string>;
  mode: "pipe" | "pty";
  lifecycle: "service" | "oneshot";
  ready: Ready;
  onReady?: { openTerminal?: boolean; openUrl?: string; autoOpenUrl?: boolean };
};
type Profile = {
  schemaVersion: 1;
  profileId: string;
  projectId: string;
  revision: number;
  name: string;
  requiredExtensions: { id: string; versionRange: string }[];
  failurePolicy: "stopStarted" | "keepRunning";
  steps: Step[];
};
type RunStep = {
  stepId: string;
  title: string;
  state: string;
  ready: boolean;
  verified?: boolean;
  pid?: number;
  processInstanceId?: string;
  terminalSessionId?: string;
  openTerminal?: boolean;
  error?: string;
  stopError?: string;
  url?: string;
  urlError?: string;
};
type Run = {
  launchRunId: string;
  createdAt: number;
  projectId: string;
  profileId: string;
  profileRevision: number;
  state: string;
  revision: number;
  steps: RunStep[];
};
type Plan = {
  planId: string;
  profileRevision: number;
  digest: string;
  requiresApproval: boolean;
  extensionActions: { id: string; action: string }[];
  resolvedSteps: {
    stepId: string;
    executable: string;
    args: string[];
    cwd: string;
    envKeys: string[];
    mode: string;
    ready: Ready;
  }[];
};
type Candidate = {
  sourceFile: string;
  scriptName: string;
  originalCommand: string;
  cwd: string;
  suggestedStep: Step;
};
const selectedTerminals = new Map<string, string>();
const openedTerminalSteps = new Set<string>();
export function openTerminalSession(
  projectId: string,
  terminalSessionId: string,
) {
  selectedTerminals.set(projectId, terminalSessionId);
  window.dispatchEvent(
    new CustomEvent("horizon:open-terminal", {
      detail: { projectId, terminalSessionId },
    }),
  );
}
const labels: Record<string, string> = {
  running: "运行中",
  exited: "已退出",
  starting: "启动中",
  stopping: "停止中",
  stopped: "已停止",
  failed: "失败",
  partial: "部分运行",
  queued: "等待依赖",
  completed: "已完成",
};
function decode(data: string) {
  return Uint8Array.from(atob(data), (ch) => ch.charCodeAt(0));
}
async function task<T>(method: string, params: unknown, projectId: string) {
  return (await start<T>(method, params, undefined, projectId)).result;
}
function useError(onError?: Props["onError"]) {
  const [error, setError] = useState("");
  const callback = useRef(onError);
  callback.current = onError;
  const report = useCallback((e: unknown) => {
    const message = errorMessage(e);
    setError(message);
    callback.current?.(message);
  }, []);
  return { error, setError, report };
}

export function TerminalPanel({
  projectId,
  onError,
  onOpenLauncher,
  onClose,
}: TerminalProps) {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState(
    () => selectedTerminals.get(projectId) ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [directory, setDirectory] = useState(".");
  const [showOptions, setShowOptions] = useState(false);
  const currentProject = useRef(projectId);
  currentProject.current = projectId;
  const { error, setError, report } = useError(onError);
  const reload = useCallback(async () => {
    const data = await call<{ items: Process[] }>(
      "process_list",
      {},
      projectId,
    );
    if (currentProject.current === projectId)
      setProcesses((previous) => {
        const existing = new Map(previous.map((p) => [p.processInstanceId, p]));
        return data.items
          .filter((p) => p.terminalSessionId)
          .map((p) =>
            (existing.get(p.processInstanceId)?.revision ?? -1) > p.revision
              ? existing.get(p.processInstanceId)!
              : p,
          );
      });
  }, [projectId]);
  useEffect(() => {
    let disposed = false;
    let close: (() => void) | undefined;
    setSelected(selectedTerminals.get(projectId) ?? "");
    setProcesses([]);
    setBusy(false);
    setError("");
    setDirectory(".");
    void onEvent<Process>("horizon.process.v1", (p) => {
      if (p.owner.projectId === projectId && !disposed)
        void reload().catch(report);
    })
      .then((fn) => {
        if (disposed) fn();
        else {
          close = fn;
          void reload().catch(report);
        }
      })
      .catch(report);
    return () => {
      disposed = true;
      close?.();
    };
  }, [projectId, reload, report]);
  const active =
    processes.find((p) => p.processInstanceId === selected) ?? processes.at(-1);
  useEffect(() => {
    const open = (event: Event) => {
      const detail = (
        event as CustomEvent<{ projectId: string; terminalSessionId: string }>
      ).detail;
      if (detail.projectId === projectId) {
        setSelected(detail.terminalSessionId);
        void reload().catch(report);
      }
    };
    window.addEventListener("horizon:open-terminal", open);
    return () => window.removeEventListener("horizon:open-terminal", open);
  }, [projectId, reload, report]);
  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const p = await call<{ terminalSessionId: string }>(
        "terminal_create",
        { cwd: directory },
        projectId,
      );
      selectedTerminals.set(projectId, p.terminalSessionId);
      if (currentProject.current === projectId)
        setSelected(p.terminalSessionId);
      await reload();
    } catch (e) {
      if (currentProject.current === projectId) report(e);
    } finally {
      if (currentProject.current === projectId) setBusy(false);
    }
  };
  const stop = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await task(
        "terminal_stop",
        { terminalSessionId: active.processInstanceId },
        projectId,
      );
      await reload();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="process-panel terminal-panel" aria-label="项目终端">
      <div className="process-toolbar terminal-toolbar">
        <strong className="terminal-title">终端</strong>
        <span className="terminal-header-spacer" />
        <select
          aria-label="终端会话"
          value={active?.processInstanceId ?? ""}
          onChange={(e) => {
            selectedTerminals.set(projectId, e.target.value);
            setSelected(e.target.value);
          }}
        >
          <option value="" disabled>
            选择会话
          </option>
          {processes.map((p) => (
            <option key={p.processInstanceId} value={p.processInstanceId}>
              {p.title} · {p.pid} · {labels[p.state] ?? p.state}
            </option>
          ))}
        </select>
        <button
          className="terminal-icon"
          aria-label="新建终端"
          title="新建终端"
          disabled={busy}
          onClick={() => void create()}
        >
          ＋
        </button>
        <button
          className="terminal-icon"
          aria-label="终端新建选项"
          title="工作目录选项"
          aria-expanded={showOptions}
          onClick={() => setShowOptions(!showOptions)}
        >
          ⌄
        </button>
        <button
          className="terminal-icon"
          aria-label="结束进程"
          title="结束进程"
          disabled={busy || !active || active.state === "exited"}
          onClick={() => void stop()}
        >
          □
        </button>
        <button
          className="terminal-return"
          title="返回编辑器（F6）"
          onClick={() =>
            document
              .querySelector<HTMLElement>("[data-editor-focus], .cm-content")
              ?.focus()
          }
        >
          返回编辑器
        </button>
        {onOpenLauncher ? (
          <button
            className="terminal-icon"
            aria-label="启动方案"
            title="启动方案"
            onClick={onOpenLauncher}
          >
            <Settings2 size={15} />
          </button>
        ) : null}
        {onClose ? (
          <button
            className="terminal-icon"
            aria-label="隐藏终端面板"
            title="隐藏终端面板"
            onClick={onClose}
          >
            <X size={15} />
          </button>
        ) : null}
      </div>
      {showOptions ? (
        <label className="terminal-options">
          新终端工作目录
          <input
            aria-label="新终端工作目录"
            value={directory}
            onChange={(e) => setDirectory(e.target.value)}
            placeholder="项目相对目录"
          />
        </label>
      ) : null}
      {error ? (
        <p className="process-error" role="alert">
          {error}
        </p>
      ) : null}
      {active ? (
        <>
          <div className="process-meta">
            {active.cwd} · PID {active.pid} ·{" "}
            {labels[active.state] ?? active.state}
              {active.exitCode != null ? ` (${active.exitCode})` : ""}
          </div>
          <TerminalView
            key={`${projectId}:${active.processInstanceId}`}
            projectId={projectId}
            sessionId={active.processInstanceId}
            onError={report}
          />
        </>
      ) : (
        <div className="process-empty">
          <strong>需要命令行时再启动</strong>
          <p>
            新建终端会在此项目目录启动 shell。隐藏面板、切换项目会保留进程。
          </p>
          <button disabled={busy} onClick={() => void create()}>
            新建终端
          </button>
        </div>
      )}
    </section>
  );
}

function TerminalView({
  projectId,
  sessionId,
  onError,
}: {
  projectId: string;
  sessionId: string;
  onError: (e: unknown) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false;
    let terminal: Terminal | undefined;
    let detach: (() => void) | undefined;
    let resize: ResizeObserver | undefined;
    let appearance: MutationObserver | undefined;
    let viewId = "";
    const pending: Output[] = [];
    let input = Promise.resolve();
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const [{ Terminal: Xterm }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
        import("@xterm/xterm/css/xterm.css"),
      ]);
      if (disposed || !mount.current) return;
      const theme = () => {
        const style = getComputedStyle(mount.current!);
        const token = (name: string, fallback: string) =>
          style.getPropertyValue(name).trim() || fallback;
        return {
          background: token("--surface", "#f3f6fb"),
          foreground: token("--text", "#17233b"),
          cursor: token("--accent", "#4b72ad"),
          selectionBackground: token("--selection", "#d8e4f7"),
          black: "#38475c",
          red: "#c24f59",
          green: "#3a8060",
          yellow: "#a4782d",
          blue: "#4c79b2",
          magenta: "#8660ac",
          cyan: "#38858b",
          white: "#d7dee9",
        };
      };
      terminal = new Xterm({
        cursorBlink: true,
        scrollback: 3000,
        fontSize: 12,
        fontFamily: "SFMono-Regular, Menlo, monospace",
        allowProposedApi: false,
        theme: theme(),
      });
      const fit = new FitAddon();
      terminal.loadAddon(fit);
      terminal.open(mount.current);
      fit.fit();
      const sendResize = () => {
        if (
          !terminal ||
          disposed ||
          !mount.current?.clientWidth ||
          !mount.current.clientHeight
        )
          return;
        fit.fit();
        void call(
          "terminal_resize",
          {
            terminalSessionId: sessionId,
            cols: terminal.cols,
            rows: terminal.rows,
          },
          projectId,
        ).catch(onError);
      };
      const receive = (event: Output) => {
        if (disposed || event.terminalSessionId !== sessionId) return;
        if (!viewId) {
          pending.push(event);
          return;
        }
        if (event.viewSubscriptionId !== viewId || !terminal) return;
        const bytes = decode(event.data);
        if (event.gap) {
          terminal.reset();
          terminal.writeln("\r\n[较早输出已超出缓存，历史已截断]\r\n");
        }
        terminal.write(bytes, () => {
          if (!disposed)
            void call(
              "terminal_output_ack",
              {
                viewSubscriptionId: viewId,
                throughOffset: String(
                  BigInt(event.byteOffset) + BigInt(bytes.byteLength),
                ),
              },
              projectId,
            ).catch(onError);
        });
      };
      detach = await onEvent<Output>("horizon.terminal.v1", receive);
      if (disposed) {
        detach();
        terminal.dispose();
        return;
      }
      const view = await call<{ viewSubscriptionId: string }>(
        "terminal_attach_view",
        { terminalSessionId: sessionId, afterOffset: "0" },
        projectId,
      );
      viewId = view.viewSubscriptionId;
      if (disposed) {
        void call(
          "terminal_detach_view",
          { viewSubscriptionId: viewId },
          projectId,
        );
        return;
      }
      for (const event of pending) receive(event);
      pending.length = 0;
      terminal.onData((data) => {
        input = input
          .then(() =>
            call(
              "terminal_input",
              { terminalSessionId: sessionId, data },
              projectId,
            ),
          )
          .then(() => undefined)
          .catch(onError);
      });
      terminal.attachCustomKeyEventHandler((event) => {
        if (event.key === "F6") {
          if (event.type === "keydown")
            document
              .querySelector<HTMLElement>("[data-editor-focus], .cm-content")
              ?.focus();
          return false;
        }
        if (event.metaKey && ["c", "v"].includes(event.key.toLowerCase()))
          return false;
        return true;
      });
      resize = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(sendResize, 70);
      });
      resize.observe(mount.current!);
      sendResize();
      terminal.focus();
      appearance = new MutationObserver(() => {
        if (terminal && mount.current) terminal.options.theme = theme();
      });
      appearance.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style", "class", "data-theme"],
      });
    })().catch((e) => {
      if (!disposed) onError(e);
    });
    return () => {
      disposed = true;
      clearTimeout(resizeTimer);
      resize?.disconnect();
      appearance?.disconnect();
      detach?.();
      terminal?.dispose();
      if (viewId)
        void call(
          "terminal_detach_view",
          { viewSubscriptionId: viewId },
          projectId,
        ).catch(() => {});
    };
  }, [projectId, sessionId, onError]);
  return (
    <div
      className="process-xterm"
      ref={mount}
      aria-label="交互式终端；F6 返回编辑器"
    />
  );
}

function newStep(): Step {
  return {
    stepId: crypto.randomUUID(),
    title: "新进程",
    dependsOn: [],
    command: { kind: "exec", executable: "npm", args: ["run", "dev"] },
    cwd: ".",
    env: {},
    secretRefs: {},
    mode: "pipe",
    lifecycle: "service",
    ready: { kind: "processStarted" },
  };
}
function newProfile(projectId: string): Profile {
  return {
    schemaVersion: 1,
    profileId: crypto.randomUUID(),
    projectId,
    revision: 0,
    name: "开发环境",
    requiredExtensions: [],
    failurePolicy: "stopStarted",
    steps: [newStep()],
  };
}
function useLauncher(projectId: string, onError?: Props["onError"]) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [restartRun, setRestartRun] = useState<string>();
  const handle = useRef<TaskHandle<Run> | null>(null);
  const { error, setError, report } = useError(onError);
  const currentProject = useRef(projectId);
  currentProject.current = projectId;
  const reload = useCallback(async () => {
    const [profiles, runs] = await Promise.all([
      call<{ items: Profile[] }>("launch_profile_list", {}, projectId),
      call<{ items: Run[] }>("launch_list", {}, projectId),
    ]);
    if (currentProject.current !== projectId) return;
    setProfiles(profiles.items);
    setRuns((previous) => {
      const existing = new Map(previous.map((run) => [run.launchRunId, run]));
      return runs.items.map((run) =>
        (existing.get(run.launchRunId)?.revision ?? -1) > run.revision
          ? existing.get(run.launchRunId)!
          : run,
      );
    });
    setSelected((id) =>
      profiles.items.some((p) => p.profileId === id)
        ? id
        : (profiles.items[0]?.profileId ?? ""),
    );
  }, [projectId]);
  useEffect(() => {
    let disposed = false;
    let close: (() => void) | undefined;
    setProfiles([]);
    setRuns([]);
    setPlan(null);
    setBusy(false);
    setError("");
    handle.current = null;
    const profilesChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId: string; profileId?: string }>).detail;
      if (detail.projectId !== projectId || disposed) return;
      void reload()
        .then(() => {
          if (!disposed && detail.profileId) setSelected(detail.profileId);
        })
        .catch((error) => {
          if (!disposed) report(error);
        });
    };
    window.addEventListener("horizon:launch-profiles-changed", profilesChanged);
    void onEvent<Run>("horizon.launch.v1", (run) => {
      if (run.projectId !== projectId || disposed) return;
      setRuns((all) =>
        (all.find((r) => r.launchRunId === run.launchRunId)?.revision ?? -1) >=
        run.revision
          ? all
          : [...all.filter((r) => r.launchRunId !== run.launchRunId), run],
      );
      for (const step of run.steps) {
        const key = `${run.launchRunId}:${step.stepId}`;
        if (
          step.ready &&
          step.openTerminal &&
          step.terminalSessionId &&
          !openedTerminalSteps.has(key)
        ) {
          openedTerminalSteps.add(key);
          if (openedTerminalSteps.size > 256)
            openedTerminalSteps.delete(
              openedTerminalSteps.values().next().value!,
            );
          openTerminalSession(projectId, step.terminalSessionId);
        }
      }
    })
      .then((fn) => {
        if (disposed) fn();
        else {
          close = fn;
          void reload().catch(report);
        }
      })
      .catch(report);
    return () => {
      disposed = true;
      close?.();
      window.removeEventListener("horizon:launch-profiles-changed", profilesChanged);
    };
  }, [projectId, reload, report]);
  const profile = profiles.find((p) => p.profileId === selected);
  const active = runs.find(
    (r) => r.profileId === selected && !["failed", "stopped"].includes(r.state),
  );
  const execute = async (plan: Plan, replacement?: string) => {
    setBusy(true);
    setPlan(null);
    let operation: TaskHandle<Run> | null = null;
    try {
      const method = replacement ? "launch_restart" : "launch_start";
      const params = replacement
        ? {
            launchRunId: replacement,
            replacementPlanId: plan.planId,
            planDigest: plan.digest,
            approved: true,
          }
        : { planId: plan.planId, planDigest: plan.digest, approved: true };
      operation = await start<Run>(method, params, undefined, projectId);
      if (currentProject.current === projectId) handle.current = operation;
      await operation.result;
      await reload();
    } catch (e) {
      if (currentProject.current === projectId) report(e);
      await reload().catch(() => {});
    } finally {
      if (handle.current === operation) handle.current = null;
      if (currentProject.current === projectId) setBusy(false);
    }
  };
  const prepare = async (replacement?: string) => {
    if (!profile) return;
    setBusy(true);
    setError("");
    try {
      const prepared = await call<Plan>(
        "launch_prepare",
        { profileId: profile.profileId, profileRevision: profile.revision },
        projectId,
      );
      if (currentProject.current !== projectId) return;
      setRestartRun(replacement);
      if (!prepared.requiresApproval) {
        await execute(prepared, replacement);
      } else setPlan(prepared);
    } catch (e) {
      if (currentProject.current === projectId) report(e);
    } finally {
      if (currentProject.current === projectId) setBusy(false);
    }
  };
  const stop = async (run: Run) => {
    setBusy(true);
    try {
      const result = await task<{ failed: string[] }>(
        "launch_stop",
        { launchRunId: run.launchRunId },
        projectId,
      );
      if (result.failed.length)
        throw new Error(`停止未确认：${result.failed.join(", ")}`);
      await reload();
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  };
  return {
    profiles,
    runs,
    selected,
    setSelected,
    profile,
    active,
    busy,
    plan,
    setPlan,
    error,
    setError,
    report,
    reload,
    prepare,
    stop,
    execute: () => plan && void execute(plan, restartRun),
    cancel: () => handle.current?.cancel(),
  };
}
type LauncherModel = ReturnType<typeof useLauncher>;

export function LauncherToolbar({ projectId, onError }: Props) {
  const model = useLauncher(projectId, onError);
  return (
    <div className="process-launch-compact">
      <select
        aria-label="启动方案"
        value={model.selected}
        onChange={(e) => model.setSelected(e.target.value)}
      >
        <option value="" disabled>
          {model.profiles.length ? "选择方案" : "在设置添加启动方案"}
        </option>
        {model.profiles.map((p) => (
          <option key={p.profileId} value={p.profileId}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        disabled={model.busy || !model.profile || !!model.active}
        onClick={() => void model.prepare()}
      >
        启动
      </button>
      {model.active ? (
        <button
          disabled={model.busy}
          onClick={() => void model.stop(model.active!)}
        >
          停止
        </button>
      ) : null}
      {model.error ? (
        <span role="alert" className="process-error">
          {model.error}
        </span>
      ) : null}
      <PlanApproval model={model} />
    </div>
  );
}

export function LauncherPanel({ projectId, onError }: Props) {
  const model = useLauncher(projectId, onError);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [log, setLog] = useState<string>();
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState<Profile | null>(null);
  useEffect(() => {
    setDraft(null);
    setCandidates(null);
    setLog(undefined);
    setNotice("");
    setDeleting(null);
  }, [projectId]);
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    model.setError("");
    try {
      const saved = await call<Profile>(
        "launch_profile_save",
        { profile: draft, expectedRevision: draft.revision || null },
        projectId,
      );
      await model.reload();
      model.setSelected(saved.profileId);
      setDraft(null);
      setNotice("");
      window.dispatchEvent(new CustomEvent("horizon:launch-profiles-changed", {
        detail: { projectId, profileId: saved.profileId },
      }));
    } catch (e) {
      model.report(e);
    } finally {
      setSaving(false);
    }
  };
  const discover = async () => {
    setSaving(true);
    try {
      const data = await call<{ candidates: Candidate[]; warnings?: string[] }>(
        "launch_detect",
        {},
        projectId,
      );
      setCandidates(data.candidates);
      setNotice(data.warnings?.join(" ") ?? "");
    } catch (e) {
      model.report(e);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!deleting || saving) return;
    const profile = deleting;
    setSaving(true);
    model.setError("");
    try {
      for (const run of model.runs.filter(
        (r) => r.profileId === profile.profileId && !["failed", "stopped"].includes(r.state),
      )) {
        const stopped = await task<{ failed: string[] }>(
          "launch_stop",
          { launchRunId: run.launchRunId },
          projectId,
        );
        if (stopped.failed.length)
          throw new Error(`停止未确认，方案已保留：${stopped.failed.join(", ")}`);
      }
      await call(
        "launch_profile_delete",
        {
          profileId: profile.profileId,
          expectedRevision: profile.revision,
        },
        projectId,
      );
      await model.reload();
      setDeleting(null);
      window.dispatchEvent(new CustomEvent("horizon:launch-profiles-changed", {
        detail: { projectId },
      }));
    } catch (e) {
      model.report(e);
    } finally {
      setSaving(false);
    }
  };
  const transfer = async (purpose: "import" | "export") => {
    setSaving(true);
    model.setError("");
    try {
      const picked = await call<{ selectionToken: string | null }>(
        "launch_profile_pick",
        { purpose },
        projectId,
      );
      if (!picked.selectionToken) return;
      if (purpose === "import") {
        const imported = await call<{ profile: Profile; warnings: string[] }>(
          "launch_profile_import",
          { selectionToken: picked.selectionToken },
          projectId,
        );
        setDraft(imported.profile);
        setNotice(imported.warnings.join(" "));
      } else if (model.profile) {
        await call(
          "launch_profile_export",
          {
            profileId: model.profile.profileId,
            profileRevision: model.profile.revision,
            selectionToken: picked.selectionToken,
          },
          projectId,
        );
        setNotice("方案已导出；凭据引用和敏感环境变量已脱敏。");
      }
    } catch (e) {
      model.report(e);
    } finally {
      setSaving(false);
    }
  };
  return (
    <section
      className="process-panel launcher-settings"
      aria-label="项目启动方案设置"
    >
      <div className="process-heading">
        <div>
          <h2>项目启动方案</h2>
          <p>配置多个进程、依赖和就绪条件。打开项目不会执行命令。</p>
        </div>
        <button disabled={saving} onClick={() => void discover()}>
          发现 package scripts
        </button>
        <button
          disabled={saving || !!draft}
          onClick={() => void transfer("import")}
        >
          导入方案
        </button>
        <button
          disabled={!!draft}
          onClick={() => setDraft(newProfile(projectId))}
        >
          新建方案
        </button>
      </div>
      {model.error ? (
        <p className="process-error" role="alert">
          {model.error}
        </p>
      ) : null}
      {notice ? (
        <p className="process-meta" role="status">
          {notice}
        </p>
      ) : null}
      {candidates ? (
        <div className="process-card">
          <div className="process-toolbar">
            <strong>发现 {candidates.length} 个脚本</strong>
            <span>仅读取；添加后需保存并审阅启动。</span>
            <button onClick={() => setCandidates(null)}>关闭</button>
          </div>
          {candidates.map((c, index) => (
            <div
              className="process-candidate"
              key={`${c.sourceFile}:${c.scriptName}`}
            >
              <div>
                <strong>{c.scriptName}</strong>
                <small>
                  {c.sourceFile} · {c.cwd}
                </small>
                <code>{c.originalCommand}</code>
              </div>
              <button
                onClick={() => {
                  setDraft((old) =>
                    old
                      ? {
                          ...old,
                          steps: [
                            ...old.steps,
                            { ...c.suggestedStep, stepId: crypto.randomUUID() },
                          ],
                        }
                      : {
                          ...newProfile(projectId),
                          name: c.scriptName,
                          steps: [
                            { ...c.suggestedStep, stepId: crypto.randomUUID() },
                          ],
                        },
                  );
                  setCandidates(
                    (all) => all?.filter((_, i) => i !== index) ?? null,
                  );
                }}
              >
                添加到草稿
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {draft ? (
        <div className="process-card profile-editor">
          <div className="process-toolbar">
            <h3>{draft.revision ? "编辑方案" : "新建方案"}</h3>
            <button disabled={saving} onClick={() => void save()}>
              保存方案
            </button>
            <button
              disabled={saving}
              onClick={() => {
                if (window.confirm("放弃未保存的方案修改？")) setDraft(null);
              }}
            >
              取消
            </button>
          </div>
          <label>
            方案名称
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="process-grid">
            <label>
              失败处理
              <select
                value={draft.failurePolicy}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    failurePolicy: e.target.value as Profile["failurePolicy"],
                  })
                }
              >
                <option value="stopStarted">停止本次已启动进程</option>
                <option value="keepRunning">保留进程用于排错</option>
              </select>
            </label>
            <label>
              所需扩展（每行 ID@版本）
              <DraftTextarea
                value={draft.requiredExtensions
                  .map((x) => `${x.id}@${x.versionRange}`)
                  .join("\n")}
                onValue={(value) =>
                  setDraft({
                    ...draft,
                    requiredExtensions: value
                      .split("\n")
                      .filter(Boolean)
                      .map((line) => {
                        const [id, versionRange = "*"] = line.split("@");
                        return { id, versionRange };
                      }),
                  })
                }
                placeholder="horizon.terminal@*"
              />
            </label>
          </div>
          {draft.steps.map((step, index) => (
            <StepEditor
              key={step.stepId}
              step={step}
              steps={draft.steps}
              index={index}
              onChange={(next) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((s) =>
                    s.stepId === step.stepId ? next : s,
                  ),
                })
              }
              onDelete={() =>
                setDraft({
                  ...draft,
                  steps: draft.steps.filter((s) => s.stepId !== step.stepId),
                })
              }
            />
          ))}
          <button
            onClick={() =>
              setDraft({ ...draft, steps: [...draft.steps, newStep()] })
            }
          >
            添加进程
          </button>
        </div>
      ) : null}
      <div className="process-toolbar">
        <select
          aria-label="已保存方案"
          value={model.selected}
          onChange={(e) => model.setSelected(e.target.value)}
        >
          <option value="" disabled>
            选择方案
          </option>
          {model.profiles.map((p) => (
            <option key={p.profileId} value={p.profileId}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          disabled={!model.profile || model.busy || !!model.active}
          onClick={() => void model.prepare()}
        >
          预检并启动
        </button>
        <button
          disabled={!model.profile || !!draft}
          onClick={() =>
            model.profile && setDraft(structuredClone(model.profile))
          }
        >
          编辑
        </button>
        <button
          disabled={!model.profile || saving}
          onClick={() => void transfer("export")}
        >
          导出方案
        </button>
        <button
          disabled={!model.profile || model.busy || saving}
          onClick={() => {
            if (model.profile) {
              model.setError("");
              setDeleting(structuredClone(model.profile));
            }
          }}
        >
          删除方案
        </button>
        {model.active ? (
          <>
            <button
              disabled={model.busy}
              onClick={() => void model.stop(model.active!)}
            >
              停止全部
            </button>
            <button
              disabled={model.busy}
              onClick={() => void model.prepare(model.active!.launchRunId)}
            >
              重新预检并重启
            </button>
          </>
        ) : null}
        {model.busy ? (
          <button onClick={() => void model.cancel()}>取消启动</button>
        ) : null}
      </div>
      {model.active && model.profile && model.active.profileRevision !== model.profile.revision ? (
        <p className="process-notice">
          当前运行使用配置版本 {model.active.profileRevision}；已保存版本 {model.profile.revision}。
          当前进程保持启动时配置，重新预检并重启后使用新版本。
        </p>
      ) : null}
      {!model.profiles.length && !draft ? (
        <p className="process-empty">
          暂无启动方案。发现项目脚本，或新建自定义多进程方案。
        </p>
      ) : null}
      {model.runs
        .filter((r) => r.profileId === model.selected)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5)
        .map((run) => (
          <div key={run.launchRunId} className="process-card">
            <div className="process-toolbar">
              <strong>{labels[run.state] ?? run.state}</strong>
              <small>
                配置版本 {run.profileRevision} · {run.launchRunId}
              </small>
            </div>
            {run.steps.map((step) => (
              <div className="process-run-step" key={step.stepId}>
                <div>
                  <strong>{step.title}</strong>
                  <span className={`process-state ${step.state}`}>
                    {labels[step.state] ?? step.state}
                  </span>
                  <small>
                    {step.pid ? `PID ${step.pid} · ` : ""}
                    {step.ready
                      ? step.verified
                        ? "就绪已验证"
                        : "运行中，未验证就绪"
                      : "尚未就绪"}
                  </small>
                  {step.error ? (
                    <p className="process-error">{step.error}</p>
                  ) : null}
                  {step.stopError ? (
                    <p className="process-error">停止未确认：{step.stopError}</p>
                  ) : null}
                  {step.urlError ? (
                    <p className="process-error">{step.urlError}</p>
                  ) : null}
                </div>
                <div className="process-toolbar">
                  {step.processInstanceId ? (
                    <>
                      <button onClick={() => setLog(step.processInstanceId)}>
                        日志
                      </button>
                      {step.terminalSessionId ? (
                        <button
                          onClick={() =>
                            openTerminalSession(
                              projectId,
                              step.terminalSessionId!,
                            )
                          }
                        >
                          打开终端
                        </button>
                      ) : null}
                      <button
                        disabled={[
                          "exited",
                          "completed",
                          "failed",
                          "queued",
                        ].includes(step.state)}
                        onClick={() =>
                          void task(
                            "process_stop",
                            {
                              processInstanceId: step.processInstanceId,
                              mode: "graceful",
                            },
                            projectId,
                          ).catch(model.report)
                        }
                      >
                        停止此项
                      </button>
                    </>
                  ) : null}
                  {step.url ? (
                    <button
                      disabled={!step.ready}
                      onClick={() =>
                        void call(
                          "launch_open_url",
                          { launchRunId: run.launchRunId, stepId: step.stepId },
                          projectId,
                        ).catch(model.report)
                      }
                    >
                      打开 URL
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ))}
      {log ? (
        <div className="process-card">
          <div className="process-toolbar">
            <strong>进程日志</strong>
            <button onClick={() => setLog(undefined)}>关闭日志</button>
          </div>
          <ProcessLog
            key={`${projectId}:${log}`}
            projectId={projectId}
            processId={log}
            report={model.report}
          />
        </div>
      ) : null}
      <PlanApproval model={model} />
      {deleting ? (
        <DeleteProfileDialog
          profile={deleting}
          runs={model.runs.filter((run) => run.profileId === deleting.profileId && !["failed", "stopped"].includes(run.state))}
          busy={saving}
          error={model.error}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </section>
  );
}

function DeleteProfileDialog({ profile, runs, busy, error, onCancel, onConfirm }: {
  profile: Profile;
  runs: Run[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    container.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <div className="process-dialog-backdrop">
      <section ref={container} className="process-dialog" role="dialog" aria-modal="true" aria-label="删除启动方案"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) { e.stopPropagation(); onCancel(); }
          if (e.key === "Tab") {
            const buttons = [...(container.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
            if (!buttons.length) { e.preventDefault(); return; }
            if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1)?.focus(); }
            else if (!e.shiftKey && document.activeElement === buttons.at(-1)) { e.preventDefault(); buttons[0]?.focus(); }
          }
        }}>
        <h2>删除启动方案</h2>
        <p>{profile.name} · 配置版本 {profile.revision}</p>
        <p>{runs.length ? "先停止下列运行组及其自有进程，再删除方案。停止未确认时保留方案。" : "仅删除方案配置，项目文件、依赖包与输出文件保留。"}</p>
        {runs.map((run) => (
          <div className="process-card" key={run.launchRunId}>
            <strong>{run.launchRunId} · 配置版本 {run.profileRevision}</strong>
            {run.steps.filter((step) => !["exited", "completed", "failed", "queued"].includes(step.state)).map((step) => (
              <small key={step.stepId}>{step.title} · {labels[step.state] ?? step.state}{step.pid ? ` · PID ${step.pid}` : ""}</small>
            ))}
          </div>
        ))}
        {runs.length ? <p>只删除配置，项目文件保留；取消不会停止或删除任何内容。</p> : null}
        {error ? <p role="alert" className="process-error">{error}</p> : null}
        <div className="process-toolbar">
          <button disabled={busy} onClick={onCancel}>取消</button>
          <button disabled={busy} onClick={onConfirm}>{busy ? "正在处理…" : runs.length ? "停止后删除" : "删除方案"}</button>
        </div>
      </section>
    </div>
  );
}

function PlanApproval({ model }: { model: LauncherModel }) {
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!model.plan) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(
      () =>
        container.current?.querySelector<HTMLButtonElement>("button")?.focus(),
      0,
    );
    return () => {
      clearTimeout(timer);
      previous?.focus();
    };
  }, [model.plan]);
  if (!model.plan) return null;
  return (
    <div className="process-dialog-backdrop">
      <section
        ref={container}
        className="process-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="审阅启动命令"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            model.setPlan(null);
          }
          if (e.key === "Tab") {
            const items = [
              ...(container.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
              ) ?? []),
            ];
            if (!items.length) return;
            const first = items[0],
              last = items.at(-1)!;
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <h2>审阅启动命令</h2>
        <p>
          批准以下命令在项目中运行。命令和脚本来源变化后会重新审阅；停止进程不会撤销命令已写入的文件。
        </p>
        {model.active && model.active.profileRevision !== model.plan.profileRevision ? (
          <p>将停止当前配置版本 {model.active.profileRevision}，改用已保存版本 {model.plan.profileRevision}；请核对以下新命令、目录、环境变量与就绪条件。</p>
        ) : null}
        {model.plan.resolvedSteps.map((s) => (
          <div className="process-card" key={s.stepId}>
            <code>
              {s.executable}{" "}
              {s.args.map((arg) => JSON.stringify(arg)).join(" ")}
            </code>
            <small>目录：{s.cwd}</small>
            <small>
              环境变量：{s.envKeys.join(", ") || "继承当前环境"} · {s.mode} ·
              就绪：{s.ready.kind}
            </small>
          </div>
        ))}
        {model.plan.extensionActions.length ? (
          <p>
            按需激活：
            {model.plan.extensionActions.map((action) => action.id).join("、")}
          </p>
        ) : null}
        <div className="process-toolbar">
          <button autoFocus onClick={() => model.setPlan(null)}>
            取消
          </button>
          <button onClick={model.execute}>批准并启动</button>
        </div>
      </section>
    </div>
  );
}
function mapText(map: Record<string, string>) {
  return Object.entries(map)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}
function DraftTextarea({
  value,
  onValue,
  placeholder,
}: {
  value: string;
  onValue: (text: string) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(value);
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(value);
  }, [value]);
  return (
    <textarea
      value={text}
      placeholder={placeholder}
      onFocus={() => {
        editing.current = true;
      }}
      onBlur={() => {
        editing.current = false;
      }}
      onChange={(e) => {
        setText(e.target.value);
        onValue(e.target.value);
      }}
    />
  );
}
function parseMap(text: string) {
  return Object.fromEntries(
    text
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf("=");
        return index < 0
          ? [line, ""]
          : [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}
function StepEditor({
  step,
  steps,
  index,
  onChange,
  onDelete,
}: {
  step: Step;
  steps: Step[];
  index: number;
  onChange: (step: Step) => void;
  onDelete: () => void;
}) {
  const change = (value: Partial<Step>) => onChange({ ...step, ...value });
  const ready = (value: Partial<Ready>) =>
    change({ ready: { ...step.ready, ...value } });
  return (
    <details className="process-step-editor" open={index === 0}>
      <summary>
        进程 {index + 1} · {step.title}
      </summary>
      <div className="process-grid">
        <label>
          名称
          <input
            value={step.title}
            onChange={(e) => change({ title: e.target.value })}
          />
        </label>
        <label>
          工作目录
          <input
            value={step.cwd}
            onChange={(e) => change({ cwd: e.target.value })}
          />
        </label>
        <label>
          命令形式
          <select
            value={step.command.kind}
            onChange={(e) =>
              change({
                command:
                  e.target.value === "exec"
                    ? { kind: "exec", executable: "", args: [] }
                    : { kind: "shell", shell: "/bin/zsh", script: "" },
              })
            }
          >
            <option value="exec">程序与参数</option>
            <option value="shell">显式 Shell 脚本</option>
          </select>
        </label>
        {step.command.kind === "exec" ? (
          <>
            <label>
              可执行程序
              <input
                value={step.command.executable}
                onChange={(e) =>
                  change({
                    command: {
                      ...(step.command as Extract<
                        Step["command"],
                        { kind: "exec" }
                      >),
                      executable: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="process-wide">
              参数（每行一个，保留空格）
              <textarea
                value={step.command.args.join("\n")}
                onChange={(e) =>
                  change({
                    command: {
                      ...(step.command as Extract<
                        Step["command"],
                        { kind: "exec" }
                      >),
                      args: e.target.value ? e.target.value.split("\n") : [],
                    },
                  })
                }
              />
            </label>
          </>
        ) : (
          <>
            <label>
              Shell
              <input
                value={step.command.shell}
                onChange={(e) =>
                  change({
                    command: {
                      ...(step.command as Extract<
                        Step["command"],
                        { kind: "shell" }
                      >),
                      shell: e.target.value,
                    },
                  })
                }
              />
            </label>
            <label className="process-wide">
              脚本
              <textarea
                value={step.command.script}
                onChange={(e) =>
                  change({
                    command: {
                      ...(step.command as Extract<
                        Step["command"],
                        { kind: "shell" }
                      >),
                      script: e.target.value,
                    },
                  })
                }
              />
            </label>
          </>
        )}
        <label>
          输出模式
          <select
            value={step.mode}
            onChange={(e) => change({ mode: e.target.value as Step["mode"] })}
          >
            <option value="pipe">日志管道</option>
            <option value="pty">交互式 PTY（需终端扩展）</option>
          </select>
        </label>
        <label>
          生命周期
          <select
            value={step.lifecycle}
            onChange={(e) =>
              change({
                lifecycle: e.target.value as Step["lifecycle"],
                ready:
                  e.target.value === "oneshot"
                    ? { kind: "exit", codes: [0] }
                    : { kind: "processStarted" },
              })
            }
          >
            <option value="service">常驻服务</option>
            <option value="oneshot">一次性命令</option>
          </select>
        </label>
        <label>
          环境变量（KEY=value）
          <DraftTextarea
            value={mapText(step.env)}
            onValue={(value) => change({ env: parseMap(value) })}
          />
        </label>
        <label>
          凭据引用（KEY=凭据ID）
          <DraftTextarea
            value={mapText(step.secretRefs)}
            onValue={(value) => change({ secretRefs: parseMap(value) })}
          />
        </label>
        <fieldset className="process-wide">
          <legend>等待这些进程就绪</legend>
          {steps
            .filter((s) => s.stepId !== step.stepId)
            .map((s) => (
              <label className="process-check" key={s.stepId}>
                <input
                  type="checkbox"
                  checked={step.dependsOn.includes(s.stepId)}
                  onChange={(e) =>
                    change({
                      dependsOn: e.target.checked
                        ? [...step.dependsOn, s.stepId]
                        : step.dependsOn.filter((id) => id !== s.stepId),
                    })
                  }
                />
                {s.title}
              </label>
            ))}
          {steps.length === 1 ? (
            <small>添加其他进程后可设置依赖。</small>
          ) : null}
        </fieldset>
        <label>
          就绪条件
          <select
            value={step.ready.kind}
            onChange={(e) => {
              const kind = e.target.value as Ready["kind"];
              change({
                ready:
                  kind === "tcp"
                    ? { kind, host: "127.0.0.1", port: 3000, timeoutMs: 30000 }
                    : kind === "http"
                      ? {
                          kind,
                          url: "http://127.0.0.1:3000",
                          statusCodes: [200],
                          timeoutMs: 30000,
                        }
                      : kind === "stdout"
                        ? { kind, pattern: "ready", timeoutMs: 30000 }
                        : kind === "exit"
                          ? { kind, codes: [0] }
                          : { kind },
              });
            }}
          >
            <option value="processStarted">进程启动（未验证）</option>
            <option value="exit">成功退出</option>
            <option value="tcp">本地 TCP 端口</option>
            <option value="http">本地 HTTP 响应</option>
            <option value="stdout">日志正则匹配</option>
          </select>
        </label>
        {["tcp", "http", "stdout"].includes(step.ready.kind) ? (
          <label>
            超时（毫秒）
            <input
              type="number"
              min={100}
              max={600000}
              value={step.ready.timeoutMs}
              onChange={(e) => ready({ timeoutMs: Number(e.target.value) })}
            />
          </label>
        ) : null}
        {step.ready.kind === "tcp" ? (
          <>
            <label>
              本地地址
              <select
                value={step.ready.host}
                onChange={(e) => ready({ host: e.target.value })}
              >
                <option>127.0.0.1</option>
                <option>::1</option>
              </select>
            </label>
            <label>
              端口
              <input
                type="number"
                min={1}
                max={65535}
                value={step.ready.port}
                onChange={(e) => ready({ port: Number(e.target.value) })}
              />
            </label>
          </>
        ) : null}
        {step.ready.kind === "http" ? (
          <>
            <label>
              探测 URL
              <input
                value={step.ready.url}
                onChange={(e) => ready({ url: e.target.value })}
              />
            </label>
            <label>
              允许状态码（逗号分隔）
              <input
                value={step.ready.statusCodes?.join(",")}
                onChange={(e) =>
                  ready({ statusCodes: e.target.value.split(",").map(Number) })
                }
              />
            </label>
          </>
        ) : null}
        {step.ready.kind === "stdout" ? (
          <label>
            日志正则
            <input
              value={step.ready.pattern}
              onChange={(e) => ready({ pattern: e.target.value })}
            />
          </label>
        ) : null}
        {step.ready.kind === "exit" ? (
          <label>
            允许退出码（逗号分隔）
            <input
              value={step.ready.codes?.join(",")}
              onChange={(e) =>
                ready({ codes: e.target.value.split(",").map(Number) })
              }
            />
          </label>
        ) : null}
        <label className="process-wide">
          就绪后可打开的 URL
          <input
            value={step.onReady?.openUrl ?? ""}
            onChange={(e) =>
              change({
                onReady: e.target.value
                  ? { ...step.onReady, openUrl: e.target.value }
                  : { ...step.onReady, openUrl: undefined, autoOpenUrl: false },
              })
            }
            placeholder="http://127.0.0.1:3000"
          />
        </label>
        <label className="process-check process-wide">
          <input
            type="checkbox"
            disabled={!step.onReady?.openUrl}
            checked={step.onReady?.autoOpenUrl ?? false}
            onChange={(e) => change({ onReady: { ...step.onReady, autoOpenUrl: e.target.checked } })}
          />
          就绪后自动打开 URL（每次运行一次）
        </label>
        <label className="process-check process-wide">
          <input
            type="checkbox"
            disabled={step.mode !== "pty"}
            checked={step.onReady?.openTerminal ?? false}
            onChange={(e) =>
              change({
                onReady: { ...step.onReady, openTerminal: e.target.checked },
              })
            }
          />
          就绪时显示此进程终端（PTY 模式）
        </label>
      </div>
      <button onClick={onDelete}>删除此进程</button>
    </details>
  );
}
function ProcessLog({
  projectId,
  processId,
  report,
}: {
  projectId: string;
  processId: string;
  report: (e: unknown) => void;
}) {
  const [text, setText] = useState("");
  const [gap, setGap] = useState(false);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let offset = "0";
    let characters = 0;
    const decoder = new TextDecoder();
    const load = async () => {
      try {
        const output = await call<{
          data: string;
          nextOffset: string;
          bufferEnd: string;
          gap: boolean;
        }>(
          "process_output_read",
          { processInstanceId: processId, offset },
          projectId,
        );
        if (disposed) return;
        if (output.gap) setGap(true);
        const data = decoder.decode(decode(output.data), { stream: true });
        characters += data.length;
        if (characters > 200000) setGap(true);
        setText((old) => (old + data).slice(-200000));
        offset = output.nextOffset;
        timer = setTimeout(
          () => void load(),
          offset === output.bufferEnd ? 800 : 0,
        );
      } catch (e) {
        if (!disposed) report(e);
      }
    };
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [projectId, processId, report]);
  return (
    <>
      {gap ? (
        <p className="process-meta">较早日志已截断，当前显示最近输出。</p>
      ) : null}
      <pre className="process-log" tabIndex={0}>
        {text || "等待输出…"}
      </pre>
    </>
  );
}
