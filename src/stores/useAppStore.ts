import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { GlobalConfig, OriginSession, OperationItem, AnalysisRecord } from '../types'
import { DEFAULT_GLOBAL_CONFIG, createDefaultOriginSession } from '../types'
import * as storage from '../utils/storage'
import { buildSystemPrompt, validateBeforeAnalyze, buildApiUrl } from '../utils/ai'

export const useAppStore = defineStore('app', () => {
  // ===== 状态 =====
  const currentOrigin = ref('')
  const globalConfig = ref<GlobalConfig>({ ...DEFAULT_GLOBAL_CONFIG })
  const originSession = ref<OriginSession>(createDefaultOriginSession())
  const activeTab = ref(0)
  const isRecording = ref(false)
  const isAnalyzing = ref(false)
  const liveRecords = ref<OperationItem[]>([])
  const expectedEffect = ref('')

  // ===== 站点数据加载 =====
  async function loadOriginData(origin: string) {
    currentOrigin.value = origin
    globalConfig.value = await storage.getGlobalConfig()
    originSession.value = await storage.getOriginSession(origin)
    liveRecords.value = [...originSession.value.currentRecording]
  }

  // 侧边栏打开时恢复录制状态（不影响用户操作中的状态）
  async function restoreRecordingState(origin: string) {
    const statuses = await storage.getRecordingStatus()
    isRecording.value = (statuses[origin] || 0) > 0
  }

  // ===== 录制控制 =====
  // 直接操作 storage，不经过 background（消除 SW 休眠等中间环节）
  async function startRecording() {
    if (!currentOrigin.value) return
    isRecording.value = true
    liveRecords.value = []
    // 清空上一轮录制数据
    await storage.clearRecording(currentOrigin.value)
    // 设置录制状态（时间戳 > 0 = 录制中）
    await storage.setRecordingStatus(currentOrigin.value, Date.now())
  }

  async function stopRecording() {
    if (!currentOrigin.value) return
    isRecording.value = false
    // 停止录制：把当前录制快照存入历史（未分析），供 AI 分析后更新
    await storage.appendUnanalyzedHistory(currentOrigin.value)
    // 设置状态为停止（0），保留当前录制数据供查看
    await storage.setRecordingStatus(currentOrigin.value, 0)
    // 重新加载（当前区保留显示）
    await reloadRecordingData()
  }

  async function reloadRecordingData() {
    if (!currentOrigin.value) return
    const loaded = await storage.getOriginSession(currentOrigin.value)
    originSession.value = loaded
    liveRecords.value = [...loaded.currentRecording]
  }

  function addLiveRecord(record: OperationItem) {
    liveRecords.value.push(record)
  }

  function removeLiveRecord(index: number) {
    liveRecords.value.splice(index, 1)
  }

  // ===== AI 分析 =====
  async function analyzeCurrentRecording(): Promise<string | null> {
    const apiKey = originSession.value.apiKey || globalConfig.value.globalApiKey
    const error = validateBeforeAnalyze(apiKey, originSession.value.currentRecording)
    if (error) return error

    isAnalyzing.value = true

    try {
      const systemPrompt = buildSystemPrompt(
        originSession.value.projectContext,
        originSession.value.currentRecording,
        expectedEffect.value || undefined,
      )

      const response = await fetch(buildApiUrl(globalConfig.value), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: globalConfig.value.defaultModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(originSession.value.currentRecording) },
          ],
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        const errBody = await response.text()
        return `AI 请求失败 (${response.status}): ${errBody.slice(0, 300)}`
      }

      const contentType = response.headers?.get?.('content-type') || ''
      const bodyText = await response.text()

      if (!contentType.includes('application/json')) {
        return `接口地址返回了 HTML 页面而非 API 数据。请检查设置中的「API 接口地址」是否正确`
      }

      let data: any
      try {
        data = JSON.parse(bodyText)
      } catch {
        return `AI 返回数据解析失败：服务器返回了非 JSON 格式（${bodyText.slice(0, 200)}）`
      }

      const result = data.choices?.[0]?.message?.content || ''

      // 更新对应的未分析历史记录（如果存在），否则新增
      const unanalyzed = await storage.findUnanalyzedHistory(currentOrigin.value)
      if (unanalyzed) {
        await storage.updateHistoryResult(currentOrigin.value, unanalyzed.timestamp, result)
        // 同步本地状态
        const idx = originSession.value.analysisHistory.findIndex((r) => r.timestamp === unanalyzed.timestamp)
        if (idx !== -1) {
          originSession.value.analysisHistory[idx].result = result
        }
      } else {
        const record: AnalysisRecord = {
          timestamp: Date.now(),
          records: [...originSession.value.currentRecording],
          result,
        }
        originSession.value.analysisHistory.push(record)
        await storage.appendHistory(currentOrigin.value, record)
      }

      // 清空当前录制
      originSession.value.currentRecording = []
      liveRecords.value = []
      expectedEffect.value = ''
      await storage.clearRecording(currentOrigin.value)

      return result
    } catch (err: any) {
      return `网络连接失败: ${err.message}`
    } finally {
      isAnalyzing.value = false
    }
  }

  // ===== 项目上下文 =====
  async function saveProjectContext(content: string) {
    originSession.value.projectContext = content
    await storage.setOriginSession(currentOrigin.value, { projectContext: content })
  }

  async function clearProjectContext() {
    originSession.value.projectContext = ''
    await storage.setOriginSession(currentOrigin.value, { projectContext: '' })
  }

  // ===== 历史记录管理 =====
  async function deleteHistoryItem(timestamp: number) {
    const idx = originSession.value.analysisHistory.findIndex((r) => r.timestamp === timestamp)
    if (idx !== -1) {
      originSession.value.analysisHistory.splice(idx, 1)
      await storage.deleteHistoryItem(currentOrigin.value, timestamp)
    }
  }

  async function clearAllHistory() {
    originSession.value.analysisHistory = []
    await storage.clearAllHistory(currentOrigin.value)
  }

  // ===== 全局配置 =====
  async function saveGlobalConfig(partial: Partial<GlobalConfig>) {
    Object.assign(globalConfig.value, partial)
    await storage.setGlobalConfig(partial)
  }

  return {
    // 状态
    currentOrigin,
    globalConfig,
    originSession,
    activeTab,
    isRecording,
    isAnalyzing,
    liveRecords,
    expectedEffect,
    // 动作
    loadOriginData,
    restoreRecordingState,
    startRecording,
    stopRecording,
    addLiveRecord,
    removeLiveRecord,
    analyzeCurrentRecording,
    saveProjectContext,
    clearProjectContext,
    deleteHistoryItem,
    clearAllHistory,
    saveGlobalConfig,
  }
})
