# AI前端调试浏览器插件 — 设计文档

**日期：** 2026-07-30
**版本：** v1.0

## 1. 技术栈

| 层级 | 选型 |
|------|------|
| 框架 | Vue 3 + TypeScript + Vite |
| UI | TailwindCSS + Naive UI（按需引入） |
| 状态管理 | Pinia |
| 测试 | Vitest + @vue/test-utils + sinon.js |
| 构建插件 | vite-plugin-web-extension |
| 打包输出 | dist/ → ZIP（AI前端调试助手_v1.0.zip） |
| 插件规范 | Manifest V3 |

## 2. 目录结构

```
LocalDebugAI/
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── manifest.json
├── src/
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── App.vue
│   │   ├── views/
│   │   │   ├── DebugRecord.vue
│   │   │   ├── ProjectContext.vue
│   │   │   ├── Settings.vue
│   │   │   └── History.vue
│   │   └── components/
│   │       ├── StatusBar.vue
│   │       ├── LogItem.vue
│   │       └── MarkdownRenderer.vue
│   ├── content/
│   │   └── index.ts
│   ├── background/
│   │   └── index.ts
│   ├── stores/
│   │   └── useAppStore.ts
│   ├── types/
│   │   └── index.ts
│   └── utils/
│       ├── storage.ts
│       ├── ai.ts
│       ├── xpath.ts
│       └── formatter.ts
└── tests/
    ├── setup.ts
    ├── utils/
    ├── stores/
    └── components/
```

## 3. Popup 弹窗布局

- **尺寸：** 420px × 600px（max-height）
- 顶部栏固定：站点 Origin + 文档状态条 + 4 个 Tab 切换
- 内容区可滚动，使用 `v-if` 切换 Tab，不引入 vue-router
- Tab：调试录制（默认）| 项目上下文 | 设置中心 | 历史记录

## 4. 存储结构

`chrome.storage.local` 以 Origin 维度隔离：

```
{
  "global": { "globalApiKey", "baseUrl", "defaultModel" },
  "localhost:5173": {
    "projectContext", "apiKey",
    "currentRecording": OperationItem[],
    "analysisHistory": AnalysisRecord[]
  }
}
```

## 5. 核心数据流

- **录制流：** Popup 开始录制 → Background 通知 Content Script → 事件捕获 → 存储 → Popup 实时展示
- **AI 流：** Popup 发起 → Background 组装 Prompt → fetch API → 存入历史 → 返回渲染
- **切换流：** tabs.onActivated → 提取 origin → 加载对应数据 → Popup 刷新

## 6. AI 交互规则

- 固定 Prompt 模板（两板块输出：异常根因 + 修复方案）
- 无文档时替换兜底文案
- 每次请求仅 2 条消息（system + user），无历史上下文
- temperature = 0.2
- 分析完成后：存入历史 + 清空当前录制

## 7. 异常处理

| 场景 | 处理 |
|------|------|
| 无 Key | 弹窗提示前往设置 |
| 无录制日志 | 按钮 disabled |
| AI 请求失败 | 区分错误原因弹窗 |
| 存储空间满 | 提示清空历史 |
| 站点切换 | 自动加载对应数据 |
| 非 localhost | 提示仅支持本地环境 |
