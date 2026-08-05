// ===== 全局配置 =====

// 单个模型配置（完整连接配置）
export interface ModelConfig {
  id: string            // 唯一 ID
  name: string          // 显示名（如 "OpenAI GPT"）
  apiKey: string
  baseUrl: string
  apiPath: string       // /chat/completions 等
  model: string         // 模型名称
}

// 全局配置：模型列表 + 当前激活模型（每次只能启动一个）
export interface GlobalConfig {
  models: ModelConfig[]
  activeModelId: string
}

// API 路径格式预设
export const API_PATH_PRESETS = [
  { label: 'Chat Completions', path: '/chat/completions' },
  { label: 'Anthropic Messages', path: '/v1/messages' },
  { label: 'Responses', path: '/responses' },
]

// ===== 单条操作日志 =====
export interface OperationItem {
  type: 'click' | 'js_error' | 'route_change' | 'input'
  timestamp: number
  pageUrl: string
  // 点击/输入事件专属
  targetText?: string
  xpath?: string
  // JS 报错专属
  errorMsg?: string
  // 路由跳转专属
  fromUrl?: string
  toUrl?: string
}

// ===== AI 分析历史记录 =====
export interface AnalysisRecord {
  timestamp: number
  records: OperationItem[]
  result: string
}

// ===== 页面分析（组件 & 风格快照）=====
// 单个组件的样式快照（getComputedStyle 采样的可复现属性）
export interface ComponentStyle {
  color?: string
  background?: string
  fontSize?: string
  fontWeight?: string
  fontFamily?: string
  borderRadius?: string
  padding?: string
  margin?: string
  gap?: string
  boxShadow?: string
  display?: string
  flexDirection?: string
  justifyContent?: string
  alignItems?: string
}

// 采样到的单个组件
export interface ComponentInfo {
  tag: string
  className?: string
  text?: string
  // 控件类型（button:submit/reset、input:text/search 等）
  type?: string
  style: ComponentStyle
}

// 页面风格 tokens（颜色 / 字体 / 间距 / 圆角 / 阴影）
export interface PageStyleTokens {
  colors: string[]        // 去重的颜色值
  cssVariables?: Record<string, string>  // --xxx 自定义属性
  fonts: string[]         // 去重的 font-family
  fontSizes: string[]
  spacing: string[]
  radii: string[]
  shadows: string[]
}

// content 脚本采集的页面 DOM/样式快照
export interface PageAnalysisInput {
  url: string
  title: string
  viewport: string        // 如 "1920x1080"
  tokens: PageStyleTokens
  components: ComponentInfo[]
  layout: string          // 简短布局结构描述（容器/栅格/间距归纳）
  rect?: Rect             // 选区分析：限定矩形区域（视口坐标）
}

// 选区矩形（视口坐标）
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// AI 分析后存储的输出（用户可直接复制的描述）
export interface PageAnalysisOutput {
  result: string          // AI 生成的页面设计风格说明
  analyzedAt: number
}

// 页面分析历史条目（可回溯查看的每一次页面分析结果）
export interface PageAnalysisRecord {
  timestamp: number
  url: string             // 分析时的页面 URL
  title?: string          // 页面标题（可选）
  result: string          // AI 生成的页面设计风格说明
}

// ===== 单个 Origin 站点数据 =====
export interface OriginSession {
  projectContext: string
  currentRecording: OperationItem[]
  analysisHistory: AnalysisRecord[]
  // 页面分析结果（独立于调试历史，可选）
  pageAnalysis?: PageAnalysisOutput
  // 页面分析历史（多条的累计记录）
  pageAnalysisHistory?: PageAnalysisRecord[]
}

// ===== 整体存储结构 =====
export interface StorageData {
  global: GlobalConfig
  [origin: string]: OriginSession | GlobalConfig
}

// ===== 消息协议 =====
export type ExtensionMessage =
  | { type: 'RECORD_EVENT'; payload: OperationItem }
  | { type: 'START_RECORDING'; tabId?: number; origin?: string }
  | { type: 'STOP_RECORDING'; tabId?: number; origin?: string }
  | { type: 'PAGE_LOADED'; origin: string }
  | { type: 'AI_ANALYZE'; origin: string; expectedEffect?: string }
  | { type: 'AI_RESULT'; origin: string; result: string; error?: string }
  | { type: 'RECORDING_STATUS'; active: boolean }
  | { type: 'RECORDING_CHANGED'; records: OperationItem[] }
  | { type: 'TAB_CHANGED'; origin: string }
  // 页面分析：侧边栏请求 content 采集快照
  | { type: 'PAGE_ANALYZE_REQUEST' }
  | { type: 'PAGE_SNAPSHOT'; snapshot: PageAnalysisInput }
  // 页面选区分析：侧边栏命令 content 进入选区模式 / 取消
  | { type: 'PAGE_SELECT_REQUEST' }
  | { type: 'PAGE_SELECT_CANCEL' }

// ===== 默认值 =====
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  models: [],
  activeModelId: '',
}

/** 生成模型 ID */
export function genModelId(): string {
  return `model_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 创建默认空模型配置 */
export function createDefaultModel(): ModelConfig {
  return {
    id: genModelId(),
    name: '',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    apiPath: '/chat/completions',
    model: 'gpt-4o-mini',
  }
}

export function createDefaultOriginSession(): OriginSession {
  return {
    projectContext: '',
    currentRecording: [],
    analysisHistory: [],
    pageAnalysisHistory: [],
  }
}
