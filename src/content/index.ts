import type { OperationItem, OriginSession } from '../types'
import { getXPath } from '../utils/xpath'

const RECORDING_KEY = 'recordingStatuses'
let lastUrl = location.href

const originalPushState = history.pushState
const originalReplaceState = history.replaceState

// 串行化写入队列，防止并发覆盖
let writeQueue: Promise<void> = Promise.resolve()

/**
 * content script 直接写入 storage（页面内常驻，不依赖 Service Worker）
 */
async function sendRecord(item: OperationItem) {
  writeQueue = writeQueue.then(async () => {
    try {
      const data = await chrome.storage.local.get(RECORDING_KEY)
      const statuses = (data[RECORDING_KEY] || {}) as Record<string, number>
      const origin = new URL(location.href).host

      // 时间戳 > 0 表示录制中（更健壮：不存在或 0 都是未录制）
      if ((statuses[origin] || 0) > 0) {
        const existing = await chrome.storage.local.get(origin) as Record<string, OriginSession>
        const session: OriginSession = existing[origin] || {
          projectContext: '',
          currentRecording: [],
          analysisHistory: [],
        }
        // 确保 currentRecording 一定是数组
        if (!Array.isArray(session.currentRecording)) {
          session.currentRecording = []
        }
        session.currentRecording.push(item)
        await chrome.storage.local.set({ [origin]: session })
      }
    } catch (e) {
      console.error('[AI调试助手] 录制存储失败:', e)
    }
  })
  await writeQueue
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (!target) return
  const item: OperationItem = {
    type: 'click',
    timestamp: Date.now(),
    pageUrl: location.href,
    targetText: (target.textContent || target.innerText || '').trim().slice(0, 50) || undefined,
    xpath: getXPath(target),
  }
  sendRecord(item)
}

function handleError(e: ErrorEvent) {
  const item: OperationItem = {
    type: 'js_error',
    timestamp: Date.now(),
    pageUrl: location.href,
    errorMsg: `${e.message} (at ${e.filename}:${e.lineno})`,
  }
  sendRecord(item)
}

function handleRejection(e: PromiseRejectionEvent) {
  const item: OperationItem = {
    type: 'js_error',
    timestamp: Date.now(),
    pageUrl: location.href,
    errorMsg: `Unhandled Promise Rejection: ${e.reason?.message || e.reason || 'Unknown error'}`,
  }
  sendRecord(item)
}

function handleRouteChange(toUrl: string) {
  const fromUrl = lastUrl || location.href
  lastUrl = toUrl
  const item: OperationItem = {
    type: 'route_change',
    timestamp: Date.now(),
    pageUrl: toUrl,
    fromUrl,
    toUrl,
  }
  sendRecord(item)
}

document.addEventListener('click', handleClick, { capture: true })
window.addEventListener('error', handleError)
window.addEventListener('unhandledrejection', handleRejection)

history.pushState = function (data, unused, url) {
  const toUrl = url ? new URL(url, location.origin).href : location.href
  originalPushState.call(this, data, unused, url)
  handleRouteChange(toUrl)
}

history.replaceState = function (data, unused, url) {
  const toUrl = url ? new URL(url, location.origin).href : location.href
  originalReplaceState.call(this, data, unused, url)
  handleRouteChange(toUrl)
}

window.addEventListener('popstate', () => {
  const currentUrl = location.href
  if (currentUrl !== lastUrl) {
    handleRouteChange(currentUrl)
  }
})

// 页面加载完成：仅清空上次未分析的录制记录
// 保护：只在页面刚加载时清空一次；若记录时间晚于本页加载时间（新录制），则不删除
const pageOrigin = new URL(location.href).host
const pageLoadTime = Date.now()
chrome.storage.local.get(pageOrigin).then((d: any) => {
  const session: OriginSession = d[pageOrigin] || {
    projectContext: '',
    currentRecording: [],
    analysisHistory: [],
  }
  const records = session.currentRecording || []
  // 只清空页面加载前就已存在的旧记录（时间戳早于页面加载）
  const staleRecords = records.filter((r: any) => (r.timestamp || 0) < pageLoadTime)
  if (staleRecords.length > 0) {
    session.currentRecording = records.filter((r: any) => (r.timestamp || 0) >= pageLoadTime)
    chrome.storage.local.set({ [pageOrigin]: session }).catch(() => {})
  }
}).catch(() => {})
