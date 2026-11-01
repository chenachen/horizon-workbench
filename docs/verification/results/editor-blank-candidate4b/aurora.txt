import { createStore } from "./store";
import type { Project } from "./types";

export const workspace = createStore({
  activeProject: "aurora",
  projects: new Map<string, Project>(),
});

export async function switchProject(id: string) {
  const current = workspace.get().activeProject;

  // 保存当前项目的标签与阅读位置
  await saveSession(current);
  const session = await restoreSession(id);

  workspace.set({ activeProject: id });
  editor.restore(session.tabs);
  panels.restore(session.layout);
}

// 独立项目，各自保持上下文。
// ：，。
// 粘贴验收：你好，地平线。
