<div align="center">

# UDA — UI DebugAI

[![中文](https://img.shields.io/badge/语言-中文-red.svg)](#中文) [![English](https://img.shields.io/badge/lang-English-blue.svg)](#english)

</div>

---

<a id="中文"></a>

# UDA — UI DebugAI

基于 Chrome Extension Manifest V3 的前端调试插件。录制页面操作行为，结合项目简介，一键调用大模型自动排查前端交互异常与代码 BUG。支持任意网页（含本地项目）。

## 功能特性

- **页面行为录制** — 自动捕获 4 类操作：点击事件、JS 运行错误、路由跳转、文本输入
- **实时记录** — 录制过程中每点一下页面，侧边栏实时 +1 条记录
- **预期效果分析** — 录制前输入"想要达到的效果"，AI 对比实际行为与预期，定位问题根源
- **AI 智能诊断** — 输出异常根因汇总 + 完整修复方案（可直接复制的代码片段）
- **页面风格分析** — 提取页面组件与视觉风格，供 AI 生成相似风格页面（支持选区分析）
- **历史记录** — 每次录制/分析自动存档，支持查看、删除、导出 Markdown
- **按站点隔离** — 不同站点（域名:端口）的数据互不干扰
- **支持任意网页** — 录制功能对所有 http/https 页面开放，不仅限 localhost
- **录制即开关** — 点「开始录制」才在当前页采集，否则不采集任何数据
- **API 兼容** — 支持所有 OpenAI 格式接口（OpenAI / DeepSeek / 智谱 / 通义千问等）
- **本地优先** — 所有数据存储在浏览器本地，无需云端服务器

## 安装（开发者模式）

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

## 使用说明

### 1. 配置 AI 接口（设置中心）

- 填写 **API 密钥**（全局）
- 选择 **API 格式**（Chat Completions / Anthropic Messages / Responses）
- 填写 **接口地址**（Base URL）和 **模型名称**
- 点击「连通性测试」验证配置

### 2. 填写项目简介（项目简介，可选但推荐）

填写项目概况，AI 将结合业务背景分析交互问题。

### 3. 调试录制（调试录制页）

1. 打开要调试的页面（任意 http/https 站点，或本地项目）
2. 点击「开始录制」
3. 在页面操作复现 BUG（点击、跳转等），侧边栏实时显示记录
4. 点击「停止录制」→ 快照自动存入历史记录
5. 可选：填写「预期效果」，点击「一键 AI 分析」
6. 查看 AI 输出的异常根因 + 修复代码，一键复制

### 4. 页面风格分析

1. 点击「分析页面」提取整页组件与风格
2. 或点击「分析选区」在页面上拖拽框选区域
3. AI 自动生成页面设计与风格说明
4. 复制结果，粘贴到任意 AI 生成相似风格页面

### 5. 历史记录

- 每次录制和分析自动存档
- 支持查看、删除、导出 Markdown
- 两种历史独立查看：**调试历史** / **页面分析**

## 项目结构

```
src/
├── content/          # 页面注入脚本（事件捕获、页面快照采集）
├── background/       # Service Worker（AI 请求、侧边栏控制）
├── popup/            # 侧边栏 Vue 3 页面
│   ├── views/        # 调试录制 / 项目简介 / 设置中心 / 历史记录
│   └── components/   # 日志条目 / 状态栏 / Markdown 渲染 / 空状态 / 图标
├── stores/           # Pinia 状态管理
├── types/            # 全局 TypeScript 类型
└── utils/            # storage / AI / xpath / formatter 工具
```

## 技术栈

- Chrome Extension Manifest V3
- Vue 3 + TypeScript + Pinia
- TailwindCSS
- Vite
- Vitest

## 开发命令

```bash
npm run test        # 运行全部测试
npm run build       # 构建 + 同步到 Chrome 加载目录
npm run build:local # 仅构建到 dist/
npm run typecheck   # 类型检查（vue-tsc）
npm run zip         # 构建 + 打包 ZIP
```

---

<a id="english"></a>

# UDA — UI DebugAI

[![中文](https://img.shields.io/badge/语言-中文-red.svg)](#中文) [![English](https://img.shields.io/badge/lang-English-blue.svg)](#english)

A Chrome Extension (Manifest V3) for frontend debugging. Record page interactions, analyze with AI to identify bugs and business logic issues. Supports any web page (not just localhost).

## Features

- **Page Interaction Recording** — Captures 4 types of events: clicks, JS errors, route changes, text input
- **Real-time Logging** — Every action appears instantly in the sidebar
- **Expected Behavior Analysis** — Describe what should happen, AI compares actual vs expected
- **AI Diagnosis** — Root cause summary + fixable code snippets
- **Page Style Analysis** — Extract components and visual style from any page (or a selected area) for AI to generate similar pages
- **History** — Auto-saves all recordings and analyses; supports review, deletion, Markdown export
- **Site Isolation** — Data is isolated per domain:port
- **Any Web Page** — Works on all http/https sites, not limited to localhost
- **Privacy-First** — Click "Start Recording" to activate; no data collection otherwise
- **API Compatible** — All OpenAI-format APIs supported (OpenAI, DeepSeek, Zhipu AI, Tongyi, etc.)
- **Local Storage** — All data stays in your browser

## Installation (Developer Mode)

1. Clone or download this repo
2. Build the extension:
   ```bash
   npm install
   npm run build
   ```
3. Open `chrome://extensions/`
4. Enable **Developer mode** (top right)
5. Click **Load unpacked** and select the `dist/` directory
6. Pin the extension and click the icon to open the sidebar

> Or use `npm run zip` to create a ZIP file.

## Usage

### 1. Configure AI (Settings tab)

- Enter your **API key**
- Select **API format** (Chat Completions / Anthropic Messages / Responses)
- Enter **Base URL** and **Model name**
- Click **Test Connection** to verify

### 2. Project Context (optional)

Fill in a brief project description so AI can analyze with business context.

### 3. Debug Recording

1. Open any http/https page
2. Click **Start Recording**
3. Reproduce the bug on your page
4. Click **Stop Recording** → snapshot saved to history
5. Optionally set an **Expected Effect**, then click **AI Analyze**
6. View AI diagnosis with root cause and fix code

### 4. Page Style Analysis

1. Click **Analyze Page** for full-page analysis
2. Or click **Select Area** to drag-select a region on the page
3. AI generates a complete design specification
4. Copy the result and paste into any AI to generate a similar-looking page

### 5. History

- All recordings and analyses are auto-saved
- Two independent tabs: **Debug History** / **Page Analysis**
- Supports expand, copy, delete, and Markdown export

## Tech Stack

- Chrome Extension Manifest V3
- Vue 3 + TypeScript + Pinia
- TailwindCSS
- Vite
- Vitest

## Commands

```bash
npm run test        # Run all tests
npm run build       # Build + sync to Chrome load directory
npm run build:local # Build to dist/ only
npm run typecheck   # TypeScript type checking
npm run zip         # Build + ZIP package
```