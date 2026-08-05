import type { OperationItem, ModelConfig, PageAnalysisInput } from '../types'

/**
 * 拼接完整的 API 请求地址
 */
export function buildApiUrl(config: Pick<ModelConfig, 'baseUrl' | 'apiPath'>): string {
  const base = config.baseUrl.replace(/\/+$/, '')
  const path = config.apiPath?.startsWith('/') ? config.apiPath : `/${config.apiPath || 'chat/completions'}`
  return `${base}${path}`
}

/**
 * 构建 AI 系统提示词（固定模板）
 */
export function buildSystemPrompt(projectContext: string, records: OperationItem[], expectedEffect?: string): string {
  const contextBlock = projectContext
    ? `=====项目简介=====\n${projectContext}`
    : '暂无项目简介，仅基于前端运行日志排查代码错误，无法校验业务交互合规性'

  const effectBlock = expectedEffect
    ? `\n\n=====用户预期效果=====\n${expectedEffect}`
    : ''

  return `你是资深前端调试工程师。
参考【项目简介】+ 用户页面时序操作日志，审核实际交互与产品业务逻辑是否一致，找出全部前端问题。
问题分为两类：
1. 业务逻辑异常：页面表现与项目简介描述的业务规则不符
2. 代码运行异常：JS报错、点击失效、路由跳转错误等前端代码BUG

输出必须严格分为两大板块，禁止寒暄、多余文字、闲聊拓展：
### 1. 异常根因汇总
逐条列出所有问题，标注类型（业务异常/代码异常），写明触发时机、触发元素、底层根本原因。
### 2. 完整修复方案
对应每条问题，给出可直接复制的代码片段、修改文件位置、分步排查调整步骤。

${contextBlock}

=====用户页面时序操作日志=====
${JSON.stringify(records, null, 2)}${effectBlock}`
}

/**
 * AI 分析前置校验
 * @returns null 表示通过，字符串表示错误信息
 */
export function validateBeforeAnalyze(apiKey: string, records: OperationItem[]): string | null {
  if (!apiKey) {
    return '请前往设置配置 API 密钥'
  }
  if (!records || records.length === 0) {
    return '暂无操作记录，请先录制页面操作'
  }
  return null
}

/**
 * 构建页面分析提示词：提取组件与风格，供 AI 生成相似页面
 */
export function buildPageAnalysisPrompt(projectContext: string, snapshot: PageAnalysisInput): string {
  const contextBlock = projectContext
    ? `=====项目简介=====\n${projectContext}`
    : ''

  const componentsText = JSON.stringify(snapshot.components, null, 2)
  const tokensText = JSON.stringify(snapshot.tokens, null, 2)

  return `你是资深前端工程师与 UI 设计师。你的任务是分析一个页面的 DOM 组件与视觉风格采样数据，输出一份「完整可复用的页面设计与风格说明」。

这份说明将作为用户的 AI 参考，用于生成一个风格相似的新页面。

请严格按以下结构输出，使用中文，禁止寒暄和多余文字：

## 1. 页面概览
- 页面标题：${snapshot.title}
- 视口：${snapshot.viewport}
- URL：${snapshot.url}
- 布局描述：${snapshot.layout}
${contextBlock ? `- 项目背景：${projectContext}` : ''}

## 2. 设计令牌（Design Tokens）
参考以下 CSS 样式 tokens 归纳简洁的颜色、字体、间距体系：

### 颜色
${snapshot.tokens.colors.length ? snapshot.tokens.colors.map(c => `- \`${c}\``).join('\n') : '（未采样到显著颜色）'}

### 字体
${snapshot.tokens.fonts.length ? snapshot.tokens.fonts.map(f => `- \`${f}\``).join('\n') : '（未采样到显著字体）'}
字号范围：${snapshot.tokens.fontSizes.length ? snapshot.tokens.fontSizes.join(', ') : '未知'}

### 间距 & 圆角 & 阴影
间距：${snapshot.tokens.spacing.length ? snapshot.tokens.spacing.join(', ') : '未知'}
圆角：${snapshot.tokens.radii.length ? snapshot.tokens.radii.join(', ') : '未知'}
阴影：${snapshot.tokens.shadows.length ? snapshot.tokens.shadows.join(', ') : '未知'}

### CSS 自定义属性
${snapshot.tokens.cssVariables && Object.keys(snapshot.tokens.cssVariables).length
  ? Object.entries(snapshot.tokens.cssVariables).slice(0, 20).map(([k, v]) => `- ${k}: ${v}`).join('\n')
  : '（未检测到 CSS 自定义属性）'}

## 3. 组件清单
以下是从页面中采样到的 ${snapshot.components.length} 个组件（同类同样式已去重），请按以下分类归纳：

- 按钮（Button）风格
- 输入框（Input/Select/Textarea）风格
- 文字链接（A）风格
- 导航（Nav/Header）结构
- 区块（Section/Main/Article）布局
- 其他组件

输出每个分类的组件标签、类名、关键样式（颜色、字号、圆角、阴影、内边距等）。

原始组件数据：
${componentsText}

## 4. 风格总结
请用 3-5 句话概括这个页面的整体视觉风格（如：极简风、深色主题、圆角卡片、柔光阴影等）。

## 5. 复用提示词
最后输出一段可直接复制到 AI 提示词的简短描述，用于生成一个风格相似的新页面。例如：
\`\`\`
参考以下设计规格生成一个【页面类型】页面：
- 主色调：...
- 字体：...
- 组件：...
- 布局：...
\`\`\`

${tokensText}`
}
