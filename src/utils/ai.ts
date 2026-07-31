import type { OperationItem, GlobalConfig } from '../types'

/**
 * 拼接完整的 API 请求地址
 */
export function buildApiUrl(config: Pick<GlobalConfig, 'baseUrl' | 'apiPath'>): string {
  const base = config.baseUrl.replace(/\/+$/, '')
  const path = config.apiPath?.startsWith('/') ? config.apiPath : `/${config.apiPath || 'chat/completions'}`
  return `${base}${path}`
}

/**
 * 构建 AI 系统提示词（固定模板）
 */
export function buildSystemPrompt(projectContext: string, records: OperationItem[], expectedEffect?: string): string {
  const contextBlock = projectContext
    ? `=====项目业务需求文档=====\n${projectContext}`
    : '暂无项目业务需求文档，仅基于前端运行日志排查代码错误，无法校验业务交互合规性'

  const effectBlock = expectedEffect
    ? `\n\n=====用户预期效果=====\n${expectedEffect}`
    : ''

  return `你是资深前端调试工程师。
对照【项目业务需求文档】+ 用户页面时序操作日志，核对实际交互与产品需求是否一致，找出全部前端问题。
问题分为两类：
1. 业务逻辑异常：页面表现不符合项目规定交互规则
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
