import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('content script', () => {
  let mockData: Record<string, any>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    document.body.innerHTML = ''

    // 内存 mock storage
    mockData = {
      recordingStatuses: {},
    }
    vi.mocked(chrome.storage.local.get).mockImplementation((key: any) => {
      if (typeof key === 'string') return Promise.resolve({ [key]: mockData[key] || {} })
      return Promise.resolve({ ...mockData })
    })
    vi.mocked(chrome.storage.local.set).mockImplementation((data: any) => {
      Object.assign(mockData, data)
      return Promise.resolve()
    })
  })

  it('should capture click events and write to storage when recording', async () => {
    await import('../../src/content/index')

    // 先注入再设置录制状态（页面加载清理逻辑会重置状态）
    mockData.recordingStatuses['localhost:3000'] = 1234567890
    mockData['localhost:3000'] = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }

    document.body.innerHTML = '<button id="test-btn">Login</button>'
    document.getElementById('test-btn')!.click()

    await new Promise(r => setTimeout(r, 50))

    const records = mockData['localhost:3000']?.currentRecording || []
    expect(records.some((r: any) => r.type === 'click')).toBe(true)
  })

  it('should skip write when not recording', async () => {
    await import('../../src/content/index')

    mockData.recordingStatuses['localhost:3000'] = 0
    mockData['localhost:3000'] = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }

    document.body.innerHTML = '<button>Click</button>'
    document.querySelector('button')!.click()

    await new Promise(r => setTimeout(r, 50))

    expect(mockData['localhost:3000']?.currentRecording?.length || 0).toBe(0)
  })

  it('should clear stale records on page load but keep new recordings', async () => {
    // 模拟上一轮录制残留（时间戳早于页面加载）
    mockData.recordingStatuses['localhost:3000'] = 1234567890
    const oldTime = Date.now() - 100000
    const newTime = Date.now() + 100000 // 未来时间，模拟录制中写入
    mockData['localhost:3000'] = {
      projectContext: '',
      currentRecording: [
        { type: 'click', timestamp: oldTime, pageUrl: '/' }, // 旧记录
        { type: 'click', timestamp: newTime, pageUrl: '/' }, // 新记录（模拟录制中写入）
      ],
      analysisHistory: [],
    }

    await import('../../src/content/index')
    await new Promise(r => setTimeout(r, 50))

    // 页面加载后：旧记录被清掉，新记录保留，录制状态不被覆盖
    const records = mockData['localhost:3000'].currentRecording
    expect(records.some((r: any) => r.timestamp < oldTime + 1)).toBe(false)
    expect(records.length).toBe(1)
    expect(mockData.recordingStatuses['localhost:3000']).toBe(1234567890)
  })

  it('should capture route changes via pushState', async () => {
    await import('../../src/content/index')

    mockData.recordingStatuses['localhost:3000'] = 1234567890
    mockData['localhost:3000'] = {
      projectContext: '', currentRecording: [], analysisHistory: [],
    }

    history.pushState({}, '', '/new-page')

    await new Promise(r => setTimeout(r, 50))

    const records = mockData['localhost:3000']?.currentRecording || []
    // 至少包含一条 route_change（可能因多监听器有重复，但必有 route_change 类型）
    expect(records.some((r: any) => r.type === 'route_change')).toBe(true)
  })
})
