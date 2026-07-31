import type { GlobalConfig, OriginSession, OperationItem, AnalysisRecord } from '../types'
import { DEFAULT_GLOBAL_CONFIG, createDefaultOriginSession } from '../types'

// ===== 全局配置 =====

export async function getGlobalConfig(): Promise<GlobalConfig> {
  const data = await chrome.storage.local.get('global')
  return data.global ? { ...DEFAULT_GLOBAL_CONFIG, ...data.global } : { ...DEFAULT_GLOBAL_CONFIG }
}

export async function setGlobalConfig(partial: Partial<GlobalConfig>): Promise<void> {
  const current = await getGlobalConfig()
  await chrome.storage.local.set({ global: { ...current, ...partial } })
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
