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

// chrome.tabs 的受控 mock（setup.ts 的全局 mock 未声明返回类型，此处给类型化包装便于链式断言）
const mockTabsQuery = (chrome.tabs.query as any) as {
  mockResolvedValue: (v: any) => void
  mockRejectedValue: (e: any) => void
}
const mockTabsSendMessage = (chrome.tabs.sendMessage as any) as {
  mockResolvedValue: (v: any) => void
  mockRejectedValue: (e: any) => void
}

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
  appendPageAnalysisHistory: vi.fn(),
  deletePageAnalysisHistory: vi.fn(),
  clearPageAnalysisHistory: vi.fn(),
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
    ;(chrome.runtime.sendMessage as any) = vi.fn()

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
    ;(chrome.runtime.sendMessage as any) = vi.fn()

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

  it('analyzeHistoryItem should analyze specific record and update result', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '# Test',
      currentRecording: [],
      analysisHistory: [
        { timestamp: 500, records: [{ type: 'click', timestamp: 1, pageUrl: '/' }], result: '' },
        { timestamp: 600, records: [{ type: 'click', timestamp: 2, pageUrl: '/' }], result: 'old' },
      ],
    }
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'Test', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '# Reanalyzed' } }] })),
    })

    const result = await store.analyzeHistoryItem(500)

    expect(result).toBe('# Reanalyzed')
    expect(store.originSession.analysisHistory[0].result).toBe('# Reanalyzed')
    // 只更新目标记录，不影响其他条
    expect(store.originSession.analysisHistory[1].result).toBe('old')
    expect(mockUpdateHistoryResult).toHaveBeenCalledWith('localhost:5173', 500, '# Reanalyzed')
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

  // ===== 页面分析 =====
  it('analyzePage should capture snapshot, call AI and store result', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '# 项目', currentRecording: [], analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'Test', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })

    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockTabsSendMessage.mockResolvedValue({
      type: 'PAGE_SNAPSHOT',
      snapshot: {
        url: 'https://example.com', title: 'Test', viewport: '1024x768',
        tokens: { colors: ['#fff'], fonts: ['sans-serif'], fontSizes: [], spacing: [], radii: [], shadows: [] },
        components: [{ tag: 'button', className: 'btn', style: { color: '#000' } }],
        layout: '单列',
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '# 页面风格说明' } }] })),
    })

    const result = await store.analyzePage()

    expect(result).toBe('# 页面风格说明')
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'PAGE_ANALYZE_REQUEST' })
    expect(store.isAnalyzingPage).toBe(false)
    expect(store.originSession.pageAnalysis?.result).toBe('# 页面风格说明')
    // 断言同时写入了历史
    expect(store.originSession.pageAnalysisHistory?.length).toBe(1)
    expect(store.originSession.pageAnalysisHistory![0].url).toBe('https://example.com')
    expect(store.originSession.pageAnalysisHistory![0].title).toBe('Test')
    expect(storage.setOriginSession).toHaveBeenCalled()
  })

  it('analyzePage should return error when no active model', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue(null)

    const result = await store.analyzePage()

    expect(result).toContain('配置并激活')
    expect(store.isAnalyzingPage).toBe(false)
  })

  it('analyzePage should return error when no active tab', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'T', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })
    mockTabsQuery.mockResolvedValue([])

    const result = await store.analyzePage()

    expect(result).toContain('无法获取当前页面')
  })

  it('analyzePage should return error when content not responding', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'T', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockTabsSendMessage.mockRejectedValue(new Error('Receiving end does not exist'))

    const result = await store.analyzePage()

    expect(result).toContain('页面未响应')
  })

  it('analyzeSelectArea should analyze snapshot within rect', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '# 项目', currentRecording: [], analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'Test', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })

    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockTabsSendMessage.mockResolvedValue({
      type: 'PAGE_SNAPSHOT',
      snapshot: {
        url: 'https://example.com', title: 'Test', viewport: '1024x768',
        tokens: { colors: ['#fff'], fonts: [], fontSizes: [], spacing: [], radii: [], shadows: [] },
        components: [{ tag: 'button', className: 'btn', style: { color: '#000' } }],
        layout: '选区布局',
        rect: { x: 10, y: 20, width: 100, height: 50 },
      },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '# 选区风格' } }] })),
    })

    const result = await store.analyzeSelectArea()

    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(1, { type: 'PAGE_SELECT_REQUEST' })
    expect(result).toBe('# 选区风格')
    expect(store.isSelecting).toBe(false)
    expect(store.originSession.pageAnalysis?.result).toBe('# 选区风格')
    expect(store.originSession.pageAnalysisHistory?.length).toBe(1)
  })

  it('analyzeSelectArea should return null when user cancels', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }
    mockGetActiveModel.mockResolvedValue({
      id: 'm1', name: 'T', apiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1', apiPath: '/chat/completions', model: 'gpt-4o-mini',
    })
    mockTabsQuery.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
    mockTabsSendMessage.mockResolvedValue({ type: 'PAGE_SELECT_CANCEL' })

    const result = await store.analyzeSelectArea()

    expect(result).toBeNull()
    expect(store.isSelecting).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('deletePageAnalysisItem should remove by timestamp', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [], analysisHistory: [],
      pageAnalysisHistory: [
        { timestamp: 100, url: 'https://a.com', title: 'A', result: 'result a' },
        { timestamp: 200, url: 'https://b.com', title: 'B', result: 'result b' },
      ],
    }

    await store.deletePageAnalysisItem(100)

    expect(store.originSession.pageAnalysisHistory?.length).toBe(1)
    expect(store.originSession.pageAnalysisHistory![0].title).toBe('B')
    expect(storage.deletePageAnalysisHistory).toHaveBeenCalledWith('localhost:5173', 100)
  })

  it('clearPageAnalysisHistory should clear all', async () => {
    const store = useAppStore()
    store.currentOrigin = 'localhost:5173'
    store.originSession = {
      projectContext: '', currentRecording: [], analysisHistory: [],
      pageAnalysisHistory: [
        { timestamp: 100, url: 'https://a.com', title: 'A', result: 'a' },
      ],
    }

    await store.clearPageAnalysisHistory()

    expect(store.originSession.pageAnalysisHistory?.length).toBe(0)
    expect(storage.clearPageAnalysisHistory).toHaveBeenCalledWith('localhost:5173')
  })
})
