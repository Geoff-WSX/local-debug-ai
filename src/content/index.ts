import type { OperationItem, OriginSession } from '../types'
import { getXPath } from '../utils/xpath'

const RECORDING_KEY = 'recordingStatuses'
let lastUrl = location.href

const originalPushState = history.pushState
const originalReplaceState = history.replaceState

// 串行化写入队列，防止并发覆盖
let writeQueue: Promise<void> = Promise.resolve()

// 录制状态同步缓存：true=本页正在录制。每次事件触发时刷新，避免常规状态下无谓的 storage 写入
let isRecordingNow = false
let statusPending = false
async function refreshRecordingStatus(): Promise<boolean> {
  try {
    statusPending = true
    const data = await chrome.storage.local.get(RECORDING_KEY)
    const statuses = (data[RECORDING_KEY] || {}) as Record<string, number>
    const origin = new URL(location.href).host
    isRecordingNow = (statuses[origin] || 0) > 0
  } catch {
    isRecordingNow = false
  } finally {
    statusPending = false
  }
  return isRecordingNow
}

// 事件入口守卫：非录制态直接短路，不产生任何采集副作用（真开关）
async function guardRecording(): Promise<boolean> {
  if (isRecordingNow) return true
  if (statusPending) return false
  return await refreshRecordingStatus()
}

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
      console.error('[UDA] 录制存储失败:', e)
    }
  })
  await writeQueue
}

function handleClick(e: MouseEvent) {
  void (async () => {
    if (!(await guardRecording())) return
    const target = e.target as HTMLElement | null
    if (!target) return
    const item: OperationItem = {
      type: 'click',
      timestamp: Date.now(),
      pageUrl: location.href,
      targetText: (target.textContent || target.innerText || '').trim().slice(0, 50) || undefined,
      xpath: getXPath(target),
    }
    await sendRecord(item)
  })()
}

function handleError(e: ErrorEvent) {
  void (async () => {
    if (!(await guardRecording())) return
    const item: OperationItem = {
      type: 'js_error',
      timestamp: Date.now(),
      pageUrl: location.href,
      errorMsg: `${e.message} (at ${e.filename}:${e.lineno})`,
    }
    await sendRecord(item)
  })()
}

function handleRejection(e: PromiseRejectionEvent) {
  void (async () => {
    if (!(await guardRecording())) return
    const item: OperationItem = {
      type: 'js_error',
      timestamp: Date.now(),
      pageUrl: location.href,
      errorMsg: `Unhandled Promise Rejection: ${e.reason?.message || e.reason || 'Unknown error'}`,
    }
    await sendRecord(item)
  })()
}

function handleRouteChange(toUrl: string) {
  void (async () => {
    if (!(await guardRecording())) return
    const fromUrl = lastUrl || location.href
    lastUrl = toUrl
    const item: OperationItem = {
      type: 'route_change',
      timestamp: Date.now(),
      pageUrl: toUrl,
      fromUrl,
      toUrl,
    }
    await sendRecord(item)
  })()
}

// 输入控件取值（input / textarea / contenteditable）
function readInputValue(el: HTMLElement): string | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return el.value
  }
  if (el.isContentEditable) {
    return el.textContent || ''
  }
  return null
}

// 去重缓存：同一控件同一值只记一条（Enter 触发后 blur 不重复）
const recordedInputs = new WeakMap<HTMLElement, string>()

function handleInput(el: HTMLElement) {
  void (async () => {
    if (!(await guardRecording())) return
    const value = readInputValue(el)
    if (value === null) return
    // 空值或未变化则不记
    const prev = recordedInputs.get(el)
    if (!value || value === prev) return
    recordedInputs.set(el, value)
    const item: OperationItem = {
      type: 'input',
      timestamp: Date.now(),
      pageUrl: location.href,
      targetText: value.trim().slice(0, 80) || undefined,
      xpath: getXPath(el),
    }
    await sendRecord(item)
  })()
}

// 捕获输入：失焦(blur) 记最终值
function bindInputListeners() {
  document.addEventListener('blur', (e) => {
    const el = e.target as HTMLElement | null
    if (el && readInputValue(el) !== null) handleInput(el)
  }, true)

  // 捕获输入：按回车提交时记值
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const el = e.target as HTMLElement | null
    if (el && readInputValue(el) !== null) handleInput(el)
  }, true)
}

function main() {
  bindInputListeners()

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

  // 预热录制状态缓存，使首个事件即可命中真实开关状态
  refreshRecordingStatus()
}

// 同一 document 只绑定一次（防止脚本重复注入 / 测试中模块重载导致监听器堆积）
declare global {
  interface Window { __UDA_bound?: boolean }
}
if (!window.__UDA_bound) {
  window.__UDA_bound = true
  main()
}

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
