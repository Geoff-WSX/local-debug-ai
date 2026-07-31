import type { GlobalConfig, OriginSession, OperationItem, AnalysisRecord, ModelConfig } from '../types'
import { DEFAULT_GLOBAL_CONFIG, createDefaultOriginSession, genModelId } from '../types'

// ===== 全局配置 =====

/**
 * 读取全局配置（兼容旧版单一模型格式，自动迁移为模型列表）
 */
export async function getGlobalConfig(): Promise<GlobalConfig> {
  const data = await chrome.storage.local.get('global')
  const stored = data.global

  // 无配置 → 默认
  if (!stored) {
    return { ...DEFAULT_GLOBAL_CONFIG, models: [], activeModelId: '' }
  }

  // 新版格式（models 数组）
  if (Array.isArray(stored.models)) {
    return {
      models: stored.models || [],
      activeModelId: stored.activeModelId || '',
    }
  }

  // 旧版格式（单一模型字段）→ 迁移为模型列表
  const legacy: any = stored
  const migratedModel: ModelConfig = {
    id: genModelId(),
    name: '默认模型',
    apiKey: legacy.globalApiKey || '',
    baseUrl: legacy.baseUrl || 'https://api.openai.com/v1',
    apiPath: legacy.apiPath || '/chat/completions',
    model: legacy.defaultModel || 'gpt-4o-mini',
  }
  const migrated: GlobalConfig = {
    models: [migratedModel],
    activeModelId: migratedModel.id,
  }
  // 写回迁移结果
  await chrome.storage.local.set({ global: migrated })
  return migrated
}

export async function setGlobalConfig(partial: Partial<GlobalConfig>): Promise<void> {
  const current = await getGlobalConfig()
  await chrome.storage.local.set({ global: { ...current, ...partial } })
}

// ===== 模型 CRUD =====

/** 获取当前激活的模型（无激活返回 null） */
export async function getActiveModel(): Promise<ModelConfig | null> {
  const config = await getGlobalConfig()
  return config.models.find((m) => m.id === config.activeModelId) || null
}

/** 添加模型 */
export async function addModel(model: Omit<ModelConfig, 'id'>): Promise<ModelConfig> {
  const config = await getGlobalConfig()
  const newModel: ModelConfig = { ...model, id: genModelId() }
  config.models.push(newModel)
  // 第一个模型自动设为激活
  if (!config.activeModelId) {
    config.activeModelId = newModel.id
  }
  await setGlobalConfig({ models: config.models, activeModelId: config.activeModelId })
  return newModel
}

/** 更新模型 */
export async function updateModel(id: string, partial: Partial<ModelConfig>): Promise<void> {
  const config = await getGlobalConfig()
  const idx = config.models.findIndex((m) => m.id === id)
  if (idx !== -1) {
    config.models[idx] = { ...config.models[idx], ...partial }
    await setGlobalConfig({ models: config.models })
  }
}

/** 删除模型 */
export async function deleteModel(id: string): Promise<void> {
  const config = await getGlobalConfig()
  config.models = config.models.filter((m) => m.id !== id)
  // 若删除的是激活模型，激活第一个剩余模型
  if (config.activeModelId === id) {
    config.activeModelId = config.models[0]?.id || ''
  }
  await setGlobalConfig({ models: config.models, activeModelId: config.activeModelId })
}

/** 设置激活模型 */
export async function setActiveModel(id: string): Promise<void> {
  const config = await getGlobalConfig()
  if (config.models.some((m) => m.id === id)) {
    await setGlobalConfig({ activeModelId: id })
  }
}

// ===== 站点数据 =====

export async function getOriginSession(origin: string): Promise<OriginSession> {
  const data = await chrome.storage.local.get(origin)
  return data[origin] ? { ...createDefaultOriginSession(), ...data[origin] } : createDefaultOriginSession()
}

export async function setOriginSession(origin: string, partial: Partial<OriginSession>): Promise<void> {
  const current = await getOriginSession(origin)
  await chrome.storage.local.set({ [origin]: { ...current, ...partial } })
}

// ===== 录制操作 =====

const RECORDING_KEY = 'recordingStatuses'

/**
 * 获取各站点录制状态（值为开始录制的时间戳，0 表示未录制）
 */
export async function getRecordingStatus(): Promise<Record<string, number>> {
  const data = await chrome.storage.local.get(RECORDING_KEY)
  return (data[RECORDING_KEY] || {}) as Record<string, number>
}

/**
 * 设置录制状态：startTime > 0 表示录制中（记录开始时间），0 表示停止
 */
export async function setRecordingStatus(origin: string, startTime: number): Promise<void> {
  const current = await getRecordingStatus()
  current[origin] = startTime
  await chrome.storage.local.set({ [RECORDING_KEY]: current })
}

/**
 * 检查是否录制中
 */
export async function isRecordingNow(origin: string): Promise<boolean> {
  const statuses = await getRecordingStatus()
  return (statuses[origin] || 0) > 0
}

export async function appendRecording(origin: string, item: OperationItem): Promise<void> {
  const session = await getOriginSession(origin)
  session.currentRecording.push(item)
  await chrome.storage.local.set({ [origin]: session })
}

export async function clearRecording(origin: string): Promise<void> {
  const session = await getOriginSession(origin)
  session.currentRecording = []
  await chrome.storage.local.set({ [origin]: session })
}

// ===== 历史记录 =====

export async function appendHistory(origin: string, record: AnalysisRecord): Promise<void> {
  const session = await getOriginSession(origin)
  session.analysisHistory.push(record)
  await chrome.storage.local.set({ [origin]: session })
}

export async function deleteHistoryItem(origin: string, timestamp: number): Promise<void> {
  const session = await getOriginSession(origin)
  session.analysisHistory = session.analysisHistory.filter((r) => r.timestamp !== timestamp)
  await chrome.storage.local.set({ [origin]: session })
}

export async function clearAllHistory(origin: string): Promise<void> {
  const session = await getOriginSession(origin)
  session.analysisHistory = []
  await chrome.storage.local.set({ [origin]: session })
}

/**
 * 将当前录制快照存入历史（未分析，result 为空）
 */
export async function appendUnanalyzedHistory(origin: string): Promise<void> {
  const session = await getOriginSession(origin)
  if (session.currentRecording.length > 0) {
    session.analysisHistory.push({
      timestamp: Date.now(),
      records: [...session.currentRecording],
      result: '',
    })
    await chrome.storage.local.set({ [origin]: session })
  }
}

/**
 * 找到指定站点最新一条未分析的录制记录
 */
export async function findUnanalyzedHistory(origin: string): Promise<AnalysisRecord | null> {
  const session = await getOriginSession(origin)
  for (let i = session.analysisHistory.length - 1; i >= 0; i--) {
    if (!session.analysisHistory[i].result) {
      return session.analysisHistory[i]
    }
  }
  return null
}

/**
 * 更新指定历史记录的分析结果
 */
export async function updateHistoryResult(origin: string, timestamp: number, result: string): Promise<void> {
  const session = await getOriginSession(origin)
  const idx = session.analysisHistory.findIndex((r) => r.timestamp === timestamp)
  if (idx !== -1) {
    session.analysisHistory[idx].result = result
    await chrome.storage.local.set({ [origin]: session })
  }
}
