# AI 前端调试助手

基于 Chrome Extension Manifest V3 的本地前端调试插件。录制页面操作行为，结合项目需求文档，一键调用大模型自动排查前端交互异常与代码 BUG。

## ✨ 功能特性

- **页面行为录制** — 自动捕获三类操作：点击事件（元素文本 + XPath）、JS 运行错误、路由跳转
- **实时记录** — 录制过程中每点一下页面，侧边栏实时 +1 条记录
- **预期效果分析** — 录制前输入"想要达到的效果"，AI 对比实际行为与预期，定位问题根源
- **AI 智能诊断** — 输出异常根因汇总 + 完整修复方案（可直接复制的代码片段）
- **历史记录** — 每次录制自动存档（含未分析标记），支持查看、删除、导出 Markdown
- **按站点隔离** — 不同 localhost 端口的项目数据互不干扰
- **API 兼容** — 支持所有 OpenAI 格式接口（OpenAI / DeepSeek / 智谱 / 通义千问等）
- **本地优先** — 所有数据存储在浏览器本地，无需云端服务器

## 🚀 安装（开发者模式）

1. 克隆或下载本项目
2. 构建插件：
   ```bash
   npm install
   npm run build
   ```
3. 浏览器地址栏打开 `chrome://extensions/`
4. 开启右上角「开发者模式」
5. 点击「加载已解压的扩展程序」，选择 `dist/` 目录
6. 固定插件到工具栏，点击图标打开右侧侧边栏

> 也可直接使用 `npm run zip` 打包 ZIP，解压后加载。

## 📖 使用说明

### 1. 配置 AI 接口（设置中心）

- 填写 **API 密钥**（全局）
- 选择 **API 格式**（Chat Completions / Anthropic Messages / Responses）
- 填写 **接口地址**（Base URL）和 **模型名称**
- 点击「连通性测试」验证配置

### 2. 绑定项目需求文档（项目上下文，可选但推荐）

上传 `.txt` / `.md` 需求文档，AI 将结合业务需求校验交互合规性。

### 3. 调试录制（调试录制页）

1. 访问本地项目（`http://localhost:xxx`）
2. 点击「开始录制」
3. 在页面操作复现 BUG（点击、跳转等），侧边栏实时显示记录
4. 点击「停止录制」→ 快照自动存入历史记录
5. 可选：填写「预期效果」，点击「一键 AI 分析」
6. 查看 AI 输出的异常根因 + 修复代码，一键复制

### 4. 历史记录

- 每次录制自动存档（未分析条目带黄色标记）
- 支持展开查看、单条删除、清空全部、导出 Markdown

## 🛠 开发

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Vue 3 + TypeScript + Vite |
| UI | TailwindCSS + Naive UI |
| 状态管理 | Pinia |
| 测试 | Vitest + @vue/test-utils |
| 插件规范 | Manifest V3 |

### 目录结构

```
src/
├── popup/          # 侧边栏页面（4 个标签页）
├── content/        # 页面注入脚本（事件捕获，直写 storage）
├── background/     # Service Worker（AI 分析请求）
├── stores/         # Pinia 状态管理
├── types/          # 全局类型定义
└── utils/          # 工具函数（storage / ai / xpath / formatter）
tests/              # 单元测试
```

### 常用命令

```bash
npm run dev        # 开发模式（Vite HMR）
npm run build      # 构建到 dist/ + 同步本地加载目录
npm run test       # 运行全部测试
npm run zip        # 构建 + 打包 ZIP
```

### 数据流架构

```
页面点击 → content script 直写 chrome.storage.local（时间戳状态判断）
         → 侧边栏 500ms 轮询刷新显示
开始/停止录制 → store 直接操作 storage
停止录制 → 快照存入历史（未分析）
AI 分析 → 更新未分析记录结果 + 清空当前录制
```

## 📦 打包

```bash
npm run zip
```

产物：`LocalDebugAI_v1.0.zip`（ZIP 根目录直接包含 `manifest.json`）。

## 📝 License

MIT
