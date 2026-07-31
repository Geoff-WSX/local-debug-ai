import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore } from '../../src/stores/useAppStore'
import * as storage from '../../src/utils/storage'
import type { OriginSession, OperationItem, AnalysisRecord } from '../../src/types'

const mockGetRecordingStatus = vi.fn()
const mockSetRecordingStatus = vi.fn()
const mockFindUnanalyzed = vi.fn()
const mockUpdateHistoryResult = vi.fn()
const mockGetActiveModel = vi.fn()

vi.mock('../../src/utils/storage', () => ({
  getGlobalConfig: vi.fn(),
  setGlobalConfig: vi.fn(),
  getOriginSession: vi.fn(),
  setOriginSession: vi.fn(),
  appendRecording: vi.fn(),
  appendHistory: vi.fn(),
  appendUnanalyzedHistory: vi.fn(),
  clearRecording: vi.fn(),
  deleteHistoryItem: vi.fn(),
  clearAllHistory: vi.fn(),
  getRecordingStatus: (...args: any[]) => mockGetRecordingStatus(...args),
  setRecordingStatus: (...args: any[]) => mockSetRecordingStatus(...args),
  findUnanalyzedHistory: (...args: any[]) => mockFindUnanalyzed(...args),
  updateHistoryResult: (...args: any[]) => mockUpdateHistoryResult(...args),
  getActiveModel: (...args: any[]) => mockGetActiveModel(...args),
}))

describe('useAppStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('should initialize with default state', () => {
    const store = useAppStore()
    expect(store.currentOrigin).toBe('')
    expect(store.activeTab).toBe(0)
    expect(store.isRecording).toBe(false)
    expect(store.isAnalyzing).toBe(false)
    expect(store.liveRecords).toEqual([])
    expect(store.expectedEffect).toBe('')
  })

  it('loadOriginData should load global config and origin session', async () => {
    const mockGlobal = { models: [{ id: 'm1', name: 'T', apiKey: 'sk-key', baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini' }], activeModelId: 'm1' }
    const mockSession: OriginSession = {
      projectContext: '# Project', currentRecording: [], analysisHistory: [],
    }
    vi.mocked(storage.getGlobalConfig).mockResolvedValue(mockGlobal)
    vi.mocked(storage.getOriginSession).mockResolvedValue(mockSession)

    const store = useAppStore()
    await store.loadOriginData('localhost:5173')

    expect(store.currentOrigin).toBe('localhost:5173')
    expect(store.globalConfig).toEqual(mockGlobal)
    expect(store.originSession).toEqual(mockSession)
    expect(store.liveRecords).toEqual([])
  })

  it('restoreRecordingState should restore isRecording from storage', async () => {
    mockGetRecordingStatus.mockResolvedValue({ 'localhost:5173': 1234567890 })

    const store = useAppStore()
    await store.restoreRecordingState('localhost:5173')

    expect(store.isRecording).toBe(true)
  })

  it('restoreRecordingState should be false when timestamp is 0', async () => {
    mockGetRecordingStatus.mockResolvedValue({ 'localhost:5173': 0 })

    const store = useAppStore()
    await store.restoreRecordingState('localhost:5173')

    expect(store.isRecording).toBe(false)
  })

  it('startRecording should set isRecording to true, clear records and set status', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.liveRecords = [{ type: 'click', timestamp: 1, pageUrl: '/' } as OperationItem]
    chrome.runtime.sendMessage = vi.fn()

    await store.startRecording()

    expect(store.isRecording).toBe(true)
    expect(store.liveRecords).toEqual([])
    // 直接操作 storage，不经过 background
    expect(storage.clearRecording).toHaveBeenCalledWith('localhost:5173')
    expect(mockSetRecordingStatus).toHaveBeenCalledWith('localhost:5173', expect.any(Number))
    expect(mockSetRecordingStatus.mock.calls[0][1]).toBeGreaterThan(0)
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
  })

  it('stopRecording should save unanalyzed history, stop status and reload data', async () => {
    const store = useAppStore()
    store.isRecording = true
    store.currentOrigin = 'localhost:5173'
    store.originSession = { projectContext: '', currentRecording: [{ type: 'click', timestamp: 1, pageUrl: '/' } as OperationItem], analysisHistory: [] }
    chrome.runtime.sendMessage = vi.fn()

    // mock reload 返回的数据
    const loadedSession: OriginSession = {
      projectContext: '',
      
      currentRecording: [
        { type: 'click', timestamp: 100, pageUrl: '/home' },
        { type: 'click', timestamp: 200, pageUrl: '/about' },
      ],
      analysisHistory: [],
    }
    vi.mocked(storage.getOriginSession).mockResolvedValue(loadedSession)

    await store.stopRecording()

    expect(store.isRecording).toBe(false)
    // 停止时存入未分析历史快照
    expect(storage.appendUnanalyzedHistory).toHaveBeenCalledWith('localhost:5173')
    expect(mockSetRecordingStatus).toHaveBeenCalledWith('localhost:5173', 0)
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled()
    // 停止后重新加载录制数据（保留显示）
    expect(store.liveRecords).toHaveLength(2)
  })

  it('addLiveRecord should append record to liveRecords', () => {
    const store = useAppStore()
    const record: OperationItem = { type: 'click', timestamp: 1000, pageUrl: '/home', targetText: '按钮' }
    store.addLiveRecord(record)
    expect(store.liveRecords).toHaveLength(1)
    expect(store.liveRecords[0].targetText).toBe('按钮')
  })

  it('removeLiveRecord should remove record by index', () => {
    const store = useAppStore()
    store.liveRecords = [
      { type: 'click', timestamp: 1, pageUrl: '/' } as OperationItem,
      { type: 'js_error', timestamp: 2, pageUrl: '/' } as OperationItem,
      { type: 'route_change', timestamp: 3, pageUrl: '/' } as OperationItem,
    ]
    store.removeLiveRecord(1)
    expect(store.liveRecords).toHaveLength(2)
    expect(store.liveRecords[1].type).toBe('route_change')
  })

  it('analyzeCurrentRecording should call AI and save history when no unanalyzed', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '# Test',
      
      currentRecording: [{ type: 'click', timestamp: 100, pageUrl: '/home' }],
      analysisHistory: [],
    }
    store.expectedEffect = '点击后应该跳转'
    mockFindUnanalyzed.mockResolvedValue(null)
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'Test', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '# AI Result' } }] })),
    })

    await store.analyzeCurrentRecording()

    expect(store.isAnalyzing).toBe(false)
    expect(storage.appendHistory).toHaveBeenCalled()
    expect(store.originSession.analysisHistory).toHaveLength(1)
    expect(store.originSession.currentRecording).toEqual([])
    expect(store.liveRecords).toEqual([])
    expect(store.expectedEffect).toBe('')
  })

  it('analyzeCurrentRecording should return error when no active model', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '# Test',
      
      currentRecording: [{ type: 'click', timestamp: 100, pageUrl: '/home' }],
      analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue(null)

    const result = await store.analyzeCurrentRecording()

    expect(result).toContain('配置并激活')
  })

  it('analyzeCurrentRecording should update unanalyzed history when exists', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '# Test',
      
      currentRecording: [{ type: 'click', timestamp: 100, pageUrl: '/home' }],
      analysisHistory: [{ timestamp: 500, records: [{ type: 'click', timestamp: 1, pageUrl: '/' }], result: '' }],
    }
    mockFindUnanalyzed.mockResolvedValue({ timestamp: 500, records: [], result: '' })
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'Test', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '# Updated Result' } }] })),
    })

    await store.analyzeCurrentRecording()

    expect(mockUpdateHistoryResult).toHaveBeenCalledWith('localhost:5173', 500, '# Updated Result')
    expect(storage.appendHistory).not.toHaveBeenCalled()
    expect(store.originSession.analysisHistory[0].result).toBe('# Updated Result')
    expect(store.originSession.currentRecording).toEqual([])
  })

  it('saveProjectContext should update project context', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = { projectContext: '', currentRecording: [], analysisHistory: [] }

    await store.saveProjectContext('# New Project Docs')

    expect(store.originSession.projectContext).toBe('# New Project Docs')
    expect(storage.setOriginSession).toHaveBeenCalled()
  })

  it('clearProjectContext should clear project context', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = { projectContext: '# Old', currentRecording: [], analysisHistory: [] }

    await store.clearProjectContext()

    expect(store.originSession.projectContext).toBe('')
    expect(storage.setOriginSession).toHaveBeenCalled()
  })

  it('deleteHistoryItem should remove record from history', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [],
      analysisHistory: [
        { timestamp: 100, records: [], result: 'a' },
        { timestamp: 200, records: [], result: 'b' },
      ],
    }

    await store.deleteHistoryItem(100)

    expect(store.originSession.analysisHistory).toHaveLength(1)
    expect(store.originSession.analysisHistory[0].timestamp).toBe(200)
    expect(storage.deleteHistoryItem).toHaveBeenCalledWith('localhost:5173', 100)
  })

  it('clearAllHistory should clear all history', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [],
      analysisHistory: [{ timestamp: 100, records: [], result: 'a' }],
    }

    await store.clearAllHistory()

    expect(store.originSession.analysisHistory).toEqual([])
    expect(storage.clearAllHistory).toHaveBeenCalledWith('localhost:5173')
  })

  it('saveGlobalConfig should update global config', async () => {
    const store = useAppStore()
    store.globalConfig = { models: [], activeModelId: '' }

    await store.saveGlobalConfig({ activeModelId: 'm1' })

    expect(store.globalConfig.activeModelId).toBe('m1')
    expect(storage.setGlobalConfig).toHaveBeenCalledWith({ activeModelId: 'm1' })
  })
})
