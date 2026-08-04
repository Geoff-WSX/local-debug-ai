# UDA — 工作区指令

Chrome Extension (Manifest V3) 本地前端调试插件：侧边栏录制页面操作（点击/JS报错/路由），调用 AI 分析前端问题。Git 仓库：Geoff-WSX/local-debug-ai。

## 目录结构

- `src/popup/` — 侧边栏 Vue 3 页面（4 标签页：调试录制/项目上下文/设置中心/历史记录）
- `src/content/` — 页面注入脚本（事件捕获，**直写 chrome.storage.local**）
- `src/background/` — Service Worker（仅 AI 分析请求 + 侧边栏控制）
- `src/stores/` — Pinia store
- `src/types/` — 全局类型（ModelConfig/OriginSession/ExtensionMessage）
- `src/utils/` — storage / ai / xpath / formatter 工具
- `public/icons/` — 插件 Logo PNG
- `tests/` — Vitest 单元测试（与 src 结构对应）
- `docs/known-issues.md` — **已知问题记录（改侧边栏前必读）**

## 命令

```bash
npm run test        # 全部 Vitest 测试（改代码后必跑）
npm run build       # Vite 构建 + 同步到 ~/Downloads/LocalDebugAI_chrome/（Chrome 加载目录）
npm run build:local # 仅构建到 dist/（无同步）
npm run zip         # 构建 + 打包 LocalDebugAI_v1.0.zip
node scripts/generate-icons.mjs  # 重新生成 Logo 图标
```

- 无 lint / typecheck 命令；`vue-tsc --noEmit` 会报大量 `chrome` 命名空间错误（未装 @types/chrome，属预存问题，忽略）
- 构建前无需手动清理 dist（vite emptyOutDir）

## 架构关键约束

1. **录制数据流**：content script **直接写 storage**（不依赖 background 中转，SW 会休眠）。页面点击 → content 写 `currentRecording` → 侧边栏 500ms 轮询 `store.reloadRecordingData()` 刷新。
2. **录制状态用时间戳**：`recordingStatuses[origin]` 存 `number`（0=未录制，>0=开始时间）。判断用 `(status[origin] || 0) > 0`，不要改回布尔值。
3. **页面加载清理**：content 只清 `timestamp < pageLoadTime` 的旧记录，**绝不写 `recordingStatuses`**（否则异步竞态会覆盖用户已开始的录制状态）。
4. **AI 调用用激活模型**：`storage.getActiveModel()` 取 `models[activeModelId]`，无激活返回错误提示。多模型列表在设置页管理。
5. **origin 标识**：统一用 `new URL(url).host`（含端口，如 `localhost:5173`），隔离各站点数据。
6. **存储结构**：`global` = `{ models: ModelConfig[], activeModelId }`；每个 origin 一个 `OriginSession`（projectContext/currentRecording/analysisHistory）。

## 已知陷阱（务必避免）

- **禁止调用 `chrome.sidePanel.setOptions({ tabId, enabled: false })`** — 会被 Chrome 持久化，导致侧边栏永久打不开（详见 docs/known-issues.md）。侧边栏控制只用 `setPanelBehavior` / `close()`。
- **`chrome.runtime.sendMessage` 可能返回 undefined**（无接收端时），用 `try/catch` 包裹，不要用 `.catch()`（在 mock 环境会崩）。
- **不要移除 `reloadRecordingData` 的导出** — DebugRecord 轮询依赖它。
- 测试 mock 的 `chrome.storage.local.get` 按 key 返回时，注意 jsdom 默认 URL 是 `localhost:3000`。

## 约定

- 类型：TS 严格模式；vue-tsc 的 chrome 报错属预存问题，以 `npm run build` 和 `npm run test` 为验证标准。
- 组件：Vue 3 `<script setup>` + TailwindCSS 工具类，无独立样式文件（style.css 只有全局基础样式）。
- 修改后：跑 `npm run test`；涉及 UI 再跑 `npm run build` 验证产物。
