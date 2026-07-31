// ===== 全局配置 =====
export interface GlobalConfig {
  globalApiKey: string
  baseUrl: string
  apiPath: string
  defaultModel: string
}

// API 路径格式预设
export const API_PATH_PRESETS = [
  { label: 'Chat Completions', path: '/chat/completions' },
  { label: 'Anthropic Messages', path: '/v1/messages' },
  { label: 'Responses', path: '/responses' },
]

// ===== 单条操作日志 =====
export interface OperationItem {
  type: 'click' | 'js_error' | 'route_change'
  timestamp: number
  pageUrl: string
  // 点击事件专属
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
  apiKey: string
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
  globalApiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  apiPath: '/chat/completions',
  defaultModel: 'gpt-4o-mini',
}

export function createDefaultOriginSession(): OriginSession {
  return {
    projectContext: '',
    apiKey: '',
    currentRecording: [],
    analysisHistory: [],
  }
}
