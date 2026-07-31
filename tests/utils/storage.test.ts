import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getGlobalConfig,
  setGlobalConfig,
  getOriginSession,
  setOriginSession,
  appendRecording,
  appendHistory,
  clearRecording,
  deleteHistoryItem,
  clearAllHistory,
  getRecordingStatus,
  setRecordingStatus,
  appendUnanalyzedHistory,
  findUnanalyzedHistory,
  updateHistoryResult,
} from '../../src/utils/storage'
import type { GlobalConfig, OriginSession, OperationItem } from '../../src/types'
import { DEFAULT_GLOBAL_CONFIG } from '../../src/types'

const mockChrome = chrome as any

describe('storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getGlobalConfig', () => {
    it('should return default config when no global data', async () => {
      mockChrome.storage.local.get.mockResolvedValue({})
      const config = await getGlobalConfig()
      expect(config).toEqual(DEFAULT_GLOBAL_CONFIG)
    })

    it('should return stored global config', async () => {
      const stored: GlobalConfig = {
        globalApiKey: 'sk-test',
        baseUrl: 'https://custom.api.com/v1',
        apiPath: '/chat/completions',
        defaultModel: 'gpt-4',
      }
      mockChrome.storage.local.get.mockResolvedValue({ global: stored })
      const config = await getGlobalConfig()
      expect(config).toEqual(stored)
    })
  })

  describe('setGlobalConfig', () => {
    it('should merge with existing config', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        global: { globalApiKey: 'old', baseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
      })
      await setGlobalConfig({ globalApiKey: 'new-key' })
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        global: expect.objectContaining({ globalApiKey: 'new-key', baseUrl: 'https://api.openai.com/v1' }),
      })
    })
  })

  describe('getOriginSession', () => {
    it('should return default session when no data for origin', async () => {
      mockChrome.storage.local.get.mockResolvedValue({})
      const session = await getOriginSession('localhost:5173')
      expect(session).toEqual({
        projectContext: '',
        apiKey: '',
        currentRecording: [],
        analysisHistory: [],
      })
    })

    it('should return stored session for origin', async () => {
      const stored: OriginSession = {
        projectContext: '# Project',
        apiKey: 'site-key',
        currentRecording: [],
        analysisHistory: [],
      }
      mockChrome.storage.local.get.mockResolvedValue({ 'localhost:5173': stored })
      const session = await getOriginSession('localhost:5173')
      expect(session.projectContext).toBe('# Project')
      expect(session.apiKey).toBe('site-key')
    })
  })

  describe('appendRecording', () => {
    it('should append item to currentRecording', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [], analysisHistory: [],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      const item: OperationItem = {
        type: 'click', timestamp: Date.now(), pageUrl: 'http://localhost:5173/',
        targetText: 'OK', xpath: '//button',
      }
      await appendRecording(origin, item)

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].currentRecording).toHaveLength(1)
      expect(setCall[origin].currentRecording[0].targetText).toBe('OK')
    })
  })

  describe('appendHistory', () => {
    it('should append analysis record to history', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [], analysisHistory: [],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      const record = {
        timestamp: Date.now(),
        records: [],
        result: '# Fix\n\n```js\nconsole.log("fixed")\n```',
      }
      await appendHistory(origin, record)

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].analysisHistory).toHaveLength(1)
      expect(setCall[origin].analysisHistory[0].result).toContain('fixed')
    })
  })

  describe('clearRecording', () => {
    it('should clear currentRecording array', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: 'docs', apiKey: '', currentRecording: [{ type: 'click', timestamp: 1, pageUrl: '/' } as OperationItem],
        analysisHistory: [{ timestamp: 1, records: [], result: 'old' }],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      await clearRecording(origin)

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].currentRecording).toEqual([])
      // history 不受影响
      expect(setCall[origin].analysisHistory).toHaveLength(1)
    })
  })

  describe('deleteHistoryItem', () => {
    it('should delete a specific history item by timestamp', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [],
        analysisHistory: [
          { timestamp: 100, records: [], result: 'first' },
          { timestamp: 200, records: [], result: 'second' },
          { timestamp: 300, records: [], result: 'third' },
        ],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      await deleteHistoryItem(origin, 200)

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].analysisHistory).toHaveLength(2)
      expect(setCall[origin].analysisHistory.map((r: any) => r.timestamp)).toEqual([100, 300])
    })
  })

  describe('clearAllHistory', () => {
    it('should clear all history records', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: 'docs', apiKey: '', currentRecording: [],
        analysisHistory: [
          { timestamp: 100, records: [], result: 'first' },
        ],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      await clearAllHistory(origin)

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].analysisHistory).toEqual([])
      expect(setCall[origin].projectContext).toBe('docs') // 其他数据不受影响
    })
  })

  describe('recordingStatus', () => {
    it('getRecordingStatus should return empty object when no status stored', async () => {
      mockChrome.storage.local.get.mockResolvedValue({})
      const status = await getRecordingStatus()
      expect(status).toEqual({})
    })

    it('setRecordingStatus should store timestamp for origin', async () => {
      mockChrome.storage.local.get.mockResolvedValue({ recordingStatuses: {} })
      await setRecordingStatus('localhost:5173', 1234567890)
      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall.recordingStatuses['localhost:5173']).toBe(1234567890)
    })

    it('getRecordingStatus should return stored timestamps', async () => {
      mockChrome.storage.local.get.mockResolvedValue({
        recordingStatuses: { 'localhost:5173': 1234567890, 'localhost:3000': 0 },
      })
      const status = await getRecordingStatus()
      expect(status['localhost:5173']).toBe(1234567890)
      expect(status['localhost:3000']).toBe(0)
    })
  })

  describe('appendUnanalyzedHistory', () => {
    it('should save current recording as unanalyzed history', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [],
        analysisHistory: [],
      }
      existing.currentRecording = [{ type: 'click', timestamp: 100, pageUrl: '/home' } as OperationItem]
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      await appendUnanalyzedHistory(origin)

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].analysisHistory).toHaveLength(1)
      expect(setCall[origin].analysisHistory[0].result).toBe('')
      expect(setCall[origin].analysisHistory[0].records).toHaveLength(1)
    })

    it('should not save when recording is empty', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [], analysisHistory: [],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      await appendUnanalyzedHistory(origin)

      expect(mockChrome.storage.local.set).not.toHaveBeenCalled()
    })
  })

  describe('findUnanalyzedHistory', () => {
    it('should return latest unanalyzed record', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [],
        analysisHistory: [
          { timestamp: 100, records: [], result: 'analyzed' },
          { timestamp: 200, records: [{ type: 'click' as any, timestamp: 1, pageUrl: '/' }], result: '' },
          { timestamp: 300, records: [], result: 'done' },
        ],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })
      const record = await findUnanalyzedHistory(origin)
      expect(record!.timestamp).toBe(200)
    })

    it('should return null when all analyzed', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [],
        analysisHistory: [{ timestamp: 100, records: [], result: 'done' }],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })
      const record = await findUnanalyzedHistory(origin)
      expect(record).toBeNull()
    })
  })

  describe('updateHistoryResult', () => {
    it('should update result by timestamp', async () => {
      const origin = 'localhost:5173'
      const existing: OriginSession = {
        projectContext: '', apiKey: '', currentRecording: [],
        analysisHistory: [{ timestamp: 100, records: [], result: '' }],
      }
      mockChrome.storage.local.get.mockResolvedValue({ [origin]: existing })

      await updateHistoryResult(origin, 100, '# Result')

      const setCall = mockChrome.storage.local.set.mock.calls[0][0]
      expect(setCall[origin].analysisHistory[0].result).toBe('# Result')
    })
  })
})
