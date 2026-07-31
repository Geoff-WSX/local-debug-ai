import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as storage from '../../src/utils/storage'

const mockFindUnanalyzed = vi.fn()
const mockUpdateHistoryResult = vi.fn()

vi.mock('../../src/utils/storage', () => ({
  appendRecording: vi.fn(),
  appendHistory: vi.fn(),
  clearRecording: vi.fn(),
  getOriginSession: vi.fn(),
  getGlobalConfig: vi.fn(),
  getRecordingStatus: vi.fn(),
  setRecordingStatus: vi.fn(),
  findUnanalyzedHistory: (...args: any[]) => mockFindUnanalyzed(...args),
  updateHistoryResult: (...args: any[]) => mockUpdateHistoryResult(...args),
}))

const mockSender = { tab: { id: 123 } } as any

describe('background', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockFindUnanalyzed.mockResolvedValue(null)
  })

  it('should handle AI_ANALYZE and update unanalyzed history', async () => {
    const mockSession = {
      projectContext: '# Project',
      apiKey: '',
      currentRecording: [{ type: 'click', timestamp: 100, pageUrl: '/home' }],
      analysisHistory: [],
    }
    const mockGlobal = {
      globalApiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1',
      apiPath: '/chat/completions',
      defaultModel: 'gpt-4o-mini',
    }
    vi.mocked(storage.getOriginSession).mockResolvedValue(mockSession as any)
    vi.mocked(storage.getGlobalConfig).mockResolvedValue(mockGlobal)
    // 存在未分析记录 → 更新
    mockFindUnanalyzed.mockResolvedValue({ timestamp: 500, records: [], result: '' })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: vi.fn().mockReturnValue('application/json') },
      text: () => Promise.resolve(JSON.stringify({ choices: [{ message: { content: '# Found bug\n\nFix this.' } }] })),
    })

    const { handleMessage } = await import('../../src/background/index')
    const response = await handleMessage({ type: 'AI_ANALYZE', origin: 'localhost:5173' }, mockSender)

    expect(fetch).toHaveBeenCalled()
    expect(mockUpdateHistoryResult).toHaveBeenCalledWith('localhost:5173', 500, '# Found bug\n\nFix this.')
    expect(storage.appendHistory).not.toHaveBeenCalled()
    expect(storage.clearRecording).toHaveBeenCalled()
    expect(response).toEqual({ success: true, result: '# Found bug\n\nFix this.' })
  })

  it('should handle AI_ANALYZE with missing API key error', async () => {
    const mockSession = {
      projectContext: '', apiKey: '',
      currentRecording: [{ type: 'click', timestamp: 100, pageUrl: '/home' }],
      analysisHistory: [],
    }
    const mockGlobal = {
      globalApiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      apiPath: '/chat/completions',
      defaultModel: 'gpt-4o-mini',
    }
    vi.mocked(storage.getOriginSession).mockResolvedValue(mockSession as any)
    vi.mocked(storage.getGlobalConfig).mockResolvedValue(mockGlobal)

    const { handleMessage } = await import('../../src/background/index')
    const response = await handleMessage({ type: 'AI_ANALYZE', origin: 'localhost:5173' }, mockSender)

    expect(response).toEqual({ success: false, error: expect.stringContaining('API 密钥') })
  })

  it('should handle AI_ANALYZE with empty recording error', async () => {
    const mockSession = {
      projectContext: '', apiKey: 'sk-key',
      currentRecording: [],
      analysisHistory: [],
    }
    const mockGlobal = {
      globalApiKey: 'sk-key',
      baseUrl: 'https://api.openai.com/v1',
      apiPath: '/chat/completions',
      defaultModel: 'gpt-4o-mini',
    }
    vi.mocked(storage.getOriginSession).mockResolvedValue(mockSession as any)
    vi.mocked(storage.getGlobalConfig).mockResolvedValue(mockGlobal)

    const { handleMessage } = await import('../../src/background/index')
    const response = await handleMessage({ type: 'AI_ANALYZE', origin: 'localhost:5173' }, mockSender)

    expect(response).toEqual({ success: false, error: expect.stringContaining('暂无操作记录') })
  })
})
