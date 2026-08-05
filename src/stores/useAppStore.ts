import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import type { GlobalConfig, OriginSession, OperationItem, AnalysisRecord, PageAnalysisInput, PageAnalysisOutput, PageAnalysisRecord } from '../types'
import { DEFAULT_GLOBAL_CONFIG, createDefaultOriginSession } from '../types'
import * as storage from '../utils/storage'
import { buildSystemPrompt, buildPageAnalysisPrompt, validateBeforeAnalyze, buildApiUrl } from '../utils/ai'

export const useAppStore = defineStore('app', () => {
  // ===== 状态 =====
  const currentOrigin = ref('')
  const globalConfig = ref<GlobalConfig>({ ...DEFAULT_GLOBAL_CONFIG })
  const originSession = ref<OriginSession>(createDefaultOriginSession())
  const activeTab = ref(0)
  const isRecording = ref(false)
  const isAnalyzing = ref(false)
  const isAnalyzingPage = ref(false)
  const isSelecting = ref(false)
  const liveRecords = ref<OperationItem[]>([])
  const expectedEffect = ref('')

  // ===== 站点数据加载 =====
  async function loadOriginData(origin: string) {
    currentOrigin.value = origin
    globalConfig.value = await storage.getGlobalConfig()
    const session = await storage.getOriginSession(origin)
    // 防御：确保 pageAnalysisHistory 始终是数组（旧数据可能缺失/非数组）
    if (!Array.isArray(session.pageAnalysisHistory)) session.pageAnalysisHistory = []
    originSession.value = session
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

  function removeLiveRecord(index: number) {
    liveRecords.value.splice(index, 1)
  }

  // ===== AI 分析 =====
  // 私有的 AI 调用核心：执行 fetch 分析记录
  async function _callAI(records: OperationItem[], projectContext: string, effect: string): Promise<{ result?: string; error?: string }> {
    const activeModel = await storage.getActiveModel()
    if (!activeModel) {
      return { error: '请先在设置中心配置并激活模型' }
    }
    const apiKey = activeModel.apiKey
    const err = validateBeforeAnalyze(apiKey, records)
    if (err) return { error: err }

    try {
      const systemPrompt = buildSystemPrompt(projectContext, records, effect || undefined)
      const response = await fetch(buildApiUrl(activeModel), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: activeModel.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(records) },
          ],
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        const errBody = await response.text()
        return { error: `AI 请求失败 (${response.status}): ${errBody.slice(0, 300)}` }
      }

      const contentType = response.headers?.get?.('content-type') || ''
      const bodyText = await response.text()

      if (!contentType.includes('application/json')) {
        return { error: '接口地址返回了 HTML 页面而非 API 数据。请检查设置中的「API 接口地址」是否正确' }
      }

      let data: any
      try {
        data = JSON.parse(bodyText)
      } catch {
        return { error: `AI 返回数据解析失败：服务器返回了非 JSON 格式（${bodyText.slice(0, 200)}）` }
      }

      return { result: data.choices?.[0]?.message?.content || '' }
    } catch (err: any) {
      return { error: `网络连接失败: ${err.message}` }
    }
  }

  // 分析当前录制区
  async function analyzeCurrentRecording(): Promise<string | null> {
    isAnalyzing.value = true
    try {
      const { result, error } = await _callAI(
        originSession.value.currentRecording,
        originSession.value.projectContext,
        expectedEffect.value,
      )
      if (error) return error

      // 更新对应的未分析历史记录（如果存在），否则新增
      const unanalyzed = await storage.findUnanalyzedHistory(currentOrigin.value)
      if (unanalyzed) {
        await storage.updateHistoryResult(currentOrigin.value, unanalyzed.timestamp, result!)
        const idx = originSession.value.analysisHistory.findIndex((r) => r.timestamp === unanalyzed.timestamp)
        if (idx !== -1) originSession.value.analysisHistory[idx].result = result!
      } else {
        const record: AnalysisRecord = {
          timestamp: Date.now(),
          records: [...originSession.value.currentRecording],
          result: result!,
        }
        originSession.value.analysisHistory.push(record)
        await storage.appendHistory(currentOrigin.value, record)
      }

      // 清空当前录制
      originSession.value.currentRecording = []
      liveRecords.value = []
      expectedEffect.value = ''
      await storage.clearRecording(currentOrigin.value)

      return result!
    } finally {
      isAnalyzing.value = false
    }
  }

  // 重新分析指定历史记录
  async function analyzeHistoryItem(timestamp: number, effect?: string): Promise<string | null> {
    const idx = originSession.value.analysisHistory.findIndex((r) => r.timestamp === timestamp)
    if (idx === -1) return null
    const record = originSession.value.analysisHistory[idx]

    isAnalyzing.value = true
    try {
      const { result, error } = await _callAI(
        record.records,
        originSession.value.projectContext,
        effect || '',
      )
      if (error) return error

      // 更新该条历史结果（不新增）
      await storage.updateHistoryResult(currentOrigin.value, timestamp, result!)
      record.result = result!
      return result!
    } finally {
      isAnalyzing.value = false
    }
  }

  // ===== 页面分析 =====
  // 公共：对已采集的快照执行 AI 分析 + 存储
  async function _runPageAnalysis(snapshot: PageAnalysisInput): Promise<string | null> {
    const activeModel = await storage.getActiveModel()
    if (!activeModel) return '请先在设置中心配置并激活模型'
    if (!activeModel.apiKey) return '请先在设置中心配置 API 密钥'

    try {
      const systemPrompt = buildPageAnalysisPrompt(originSession.value.projectContext, snapshot)
      const response = await fetch(buildApiUrl(activeModel), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeModel.apiKey}`,
        },
        body: JSON.stringify({
          model: activeModel.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(snapshot) },
          ],
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const errBody = await response.text()
        return `AI 请求失败 (${response.status}): ${errBody.slice(0, 300)}`
      }

      const contentType = response.headers?.get?.('content-type') || ''
      const bodyText = await response.text()
      if (!contentType.includes('application/json')) {
        return '接口地址返回了 HTML 页面而非 API 数据。请检查设置中的「API 接口地址」是否正确'
      }

      let data: any
      try {
        data = JSON.parse(bodyText)
      } catch {
        return `AI 返回数据解析失败：服务器返回了非 JSON 格式（${bodyText.slice(0, 200)}）`
      }

      const result = data.choices?.[0]?.message?.content || ''

      // 存储结果：更新最近一次 + 追加历史
      const output: PageAnalysisOutput = { result, analyzedAt: Date.now() }
      originSession.value.pageAnalysis = output
      const record: PageAnalysisRecord = {
        timestamp: Date.now(),
        url: snapshot.url,
        title: snapshot.title,
        result,
      }
      if (!Array.isArray(originSession.value.pageAnalysisHistory)) originSession.value.pageAnalysisHistory = []
      originSession.value.pageAnalysisHistory.push(record)
      await storage.setOriginSession(currentOrigin.value, {
        pageAnalysis: output,
        pageAnalysisHistory: originSession.value.pageAnalysisHistory,
      })

      return result
    } catch (err: any) {
      return `网络连接失败: ${err.message}`
    }
  }

  async function analyzePage(): Promise<string | null> {
    if (!currentOrigin.value) return '未检测到页面'
    isAnalyzingPage.value = true
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab?.id) return '无法获取当前页面'

      let snapshot: PageAnalysisInput | null = null
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'PAGE_ANALYZE_REQUEST' })
        if (response?.type === 'PAGE_SNAPSHOT' && response.snapshot) {
          snapshot = response.snapshot
        }
      } catch {
        return '页面未响应，请确保已打开一个网页'
      }
      if (!snapshot) return '页面快照采集失败'

      return await _runPageAnalysis(snapshot)
    } catch (err: any) {
      return `网络连接失败: ${err.message}`
    } finally {
      isAnalyzingPage.value = false
    }
  }

  // 选区分析：进入选区模式，拖拽框选后采集区域内快照并分析
  async function analyzeSelectArea(): Promise<string | null> {
    if (!currentOrigin.value) return '未检测到页面'
    isSelecting.value = true
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab?.id) return '无法获取当前页面'

      let snapshot: PageAnalysisInput | null = null
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'PAGE_SELECT_REQUEST' })
        if (response?.type === 'PAGE_SNAPSHOT' && response.snapshot) {
          snapshot = response.snapshot
        } else if (response?.type === 'PAGE_SELECT_CANCEL') {
          return null // 用户取消选区
        }
      } catch {
        return '页面未响应，请确保已打开一个网页'
      }
      if (!snapshot) return '页面快照采集失败'

      isSelecting.value = false
      isAnalyzingPage.value = true
      try {
        return await _runPageAnalysis(snapshot)
      } finally {
        isAnalyzingPage.value = false
      }
    } catch (err: any) {
      return `网络连接失败: ${err.message}`
    } finally {
      isSelecting.value = false
    }
  }

  // 删除指定页面分析历史
  async function deletePageAnalysisItem(timestamp: number) {
    const arr = originSession.value.pageAnalysisHistory || []
    originSession.value.pageAnalysisHistory = arr.filter((r) => r.timestamp !== timestamp)
    await storage.deletePageAnalysisHistory(currentOrigin.value, timestamp)
  }

  // 清空页面分析历史
  async function clearPageAnalysisHistory() {
    originSession.value.pageAnalysisHistory = []
    await storage.clearPageAnalysisHistory(currentOrigin.value)
  }

  // ===== 项目简介 =====
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
    isAnalyzingPage,
    isSelecting,
    liveRecords,
    expectedEffect,
    // 动作
    loadOriginData,
    restoreRecordingState,
    startRecording,
    stopRecording,
    reloadRecordingData,
    removeLiveRecord,
    analyzeCurrentRecording,
    analyzeHistoryItem,
    analyzePage,
    analyzeSelectArea,
    deletePageAnalysisItem,
    clearPageAnalysisHistory,
    saveProjectContext,
    clearProjectContext,
    deleteHistoryItem,
    clearAllHistory,
    saveGlobalConfig,
  }
})
