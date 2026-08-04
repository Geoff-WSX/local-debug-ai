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

// ===== 单个 Origin 站点数据 =====
export interface OriginSession {
  projectContext: string
  currentRecording: OperationItem[]
  analysisHistory: AnalysisRecord[]
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
  }
}
