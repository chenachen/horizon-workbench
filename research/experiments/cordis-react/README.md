# Cordis + React 可复现实验

研究验证，不是桌面应用源码。2026-10-31 在 macOS arm64 / Chromium 151.0.7922.34 通过；精确版本与原始结果见 package-lock.json、result.json。

仓库根目录先 `npm ci`、`npx playwright install chromium`，然后：

```sh
cd research/experiments/cordis-react
npm ci
node check.mjs
```

Node 24.5.0 为本次运行环境。实验使用根目录 Playwright，不为研究样例重复安装浏览器依赖。检查服务等待/恢复、停用清理、无 Node 全局、React 退订及几何/主题变化保持 textarea 节点。未验证 CodeMirror、IME、任意布局树、Tauri WebView、QuickJS、桌面性能或 Harness 插件兼容。运行会更新 result.json。
