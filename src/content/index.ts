import type { OperationItem, OriginSession, PageAnalysisInput, ComponentInfo, ComponentStyle, Rect } from '../types'
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

// ===== 页面分析：采集 DOM 组件与风格快照（独立于录制）=====

// 采样一个元素的 computed 样式为可复现的组件快照
function sampleStyle(el: Element): ComponentStyle {
  const cs = window.getComputedStyle(el)
  return {
    color: cs.color !== 'rgb(0, 0, 0)' || el.tagName === 'BUTTON' ? cs.color : undefined,
    background: cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : undefined,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontFamily: cs.fontFamily,
    borderRadius: cs.borderRadius !== '0px' ? cs.borderRadius : undefined,
    padding: cs.paddingTop === cs.paddingBottom && cs.paddingTop === cs.paddingLeft ? cs.paddingTop : `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
    margin: cs.marginTop !== '0px' || cs.marginLeft !== '0px' ? cs.marginTop : undefined,
    gap: cs.gap && cs.gap !== 'normal' ? cs.gap : undefined,
    boxShadow: cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow : undefined,
    display: cs.display,
  }
}

// 判断元素是否在页面视口内可见
function isVisible(el: Element): boolean {
  const rect = (el as HTMLElement).getBoundingClientRect?.()
  if (!rect || rect.width === 0 || rect.height === 0) return false
  const cs = window.getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none'
}

// 判断元素矩形是否与选区矩形相交（rect 为空则视为整页）
function intersectsRect(el: Element, rect?: Rect): boolean {
  if (!rect) return true
  const r = (el as HTMLElement).getBoundingClientRect?.()
  if (!r) return false
  return r.left < rect.x + rect.width
      && r.left + r.width > rect.x
      && r.top < rect.y + rect.height
      && r.top + r.height > rect.y
}

// 采样组件：按标签聚合，每类取前 N 个代表元素（rect 限定选区）
function captureComponents(rect?: Rect): ComponentInfo[] {
  const components: ComponentInfo[] = []
  const seen = new Set<string>()
  const selectors = ['button', 'input', 'select', 'textarea', 'a', 'img', 'nav', 'header', 'footer', 'main', 'section', 'article', 'aside', '[class*="card"]', '[class*="btn"]', '[data-component]']
  const maxEach = rect ? 15 : 6

  for (const selector of selectors) {
    let els: NodeListOf<Element>
    try {
      els = document.querySelectorAll(selector)
    } catch {
      continue
    }
    let count = 0
    for (const el of Array.from(els)) {
      if (count >= maxEach) break
      if (!isVisible(el)) continue
      if (!intersectsRect(el, rect)) continue
      const className = (el.getAttribute('class') || '').slice(0, 60)
      // 去重（同类同 class 只采一次）
      const dedupKey = `${el.tagName}:${className}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      const tag = el.tagName.toLowerCase()
      const info: ComponentInfo = {
        tag,
        className: className || undefined,
        text: (el.textContent || '').trim().slice(0, 40).replace(/\s+/g, ' ') || undefined,
        type: (el as HTMLInputElement).type || undefined,
        style: sampleStyle(el),
      }
      components.push(info)
      count++
    }
  }
  return components
}

// 采集 CSS 自定义属性与全局风格 tokens（rect 限定选区时只采样区域内元素）
function captureTokens(rect?: Rect) {
  const cssVariables: Record<string, string> = {}
  const colors = new Set<string>()
  const fonts = new Set<string>()
  const fontSizes = new Set<string>()
  const spacing = new Set<string>()
  const radii = new Set<string>()
  const shadows = new Set<string>()
  const root = document.documentElement
  const rootCs = window.getComputedStyle(root)
  const defaultFont = rootCs.fontFamily || ''

  // CSS 自定义属性（:root 上的 --x）
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue // 跨域样式表跳过
      }
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && rule.selectorText.includes(':root')) {
          const style = rule.style
          for (let i = 0; i < style.length; i++) {
            const prop = style.item(i)
            if (prop.startsWith('--')) {
              cssVariables[prop] = style.getPropertyValue(prop).trim()
            }
          }
        }
      }
    }
  } catch {}

  // 采样常见结构元素的颜色/字体/spacing
  const sampleSelectors = ['body', 'h1', 'h2', 'h3', 'button', 'a', 'input']
  const sampleEls = sampleSelectors.flatMap((s) => {
    try {
      return Array.from(document.querySelectorAll(s)).slice(0, 8)
    } catch {
      return []
    }
  })
  for (const el of sampleEls) {
    if (rect && !intersectsRect(el, rect)) continue
    const cs = window.getComputedStyle(el)
    if (cs.color) colors.add(cs.color)
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.add(cs.backgroundColor)
    if (cs.fontFamily && cs.fontFamily !== defaultFont) fonts.add(cs.fontFamily)
    if (cs.fontSize) fontSizes.add(cs.fontSize)
    if (cs.paddingTop !== '0px') spacing.add(cs.paddingTop)
    if (cs.marginTop !== '0px') spacing.add(cs.marginTop)
    if (cs.borderRadius !== '0px') radii.add(cs.borderRadius)
    if (cs.boxShadow && cs.boxShadow !== 'none') shadows.add(cs.boxShadow)
    if (cs.gap && cs.gap !== 'normal') spacing.add(cs.gap)
  }
  // body 背景兜底
  if (!rect && rootCs.backgroundColor && rootCs.backgroundColor !== 'rgba(0, 0, 0, 0)') colors.add(rootCs.backgroundColor)

  return {
    colors: Array.from(colors).slice(0, 40),
    cssVariables: Object.keys(cssVariables).length ? cssVariables : undefined,
    fonts: Array.from(fonts).slice(0, 12),
    fontSizes: Array.from(fontSizes).slice(0, 12),
    spacing: Array.from(spacing).slice(0, 12),
    radii: Array.from(radii).slice(0, 10),
    shadows: Array.from(shadows).slice(0, 10),
  }
}

// 归纳简洁布局描述（rect 限定选区时统计区域内区块数）
function captureLayout(rect?: Rect): string {
  const body = document.body
  if (!body) return ''
  const cs = window.getComputedStyle(body)
  const parts: string[] = []
  if (!rect && (cs.display === 'flex' || cs.display === 'grid')) parts.push(`body 使用 ${cs.display} 布局`)
  if (!rect && cs.flexDirection && cs.flexDirection !== 'row') parts.push(`flex-direction: ${cs.flexDirection}`)
  const container = document.querySelector('main, .container, [class*="container"], [class*="wrapper"]')
  if (container && !rect) {
    const ccs = window.getComputedStyle(container)
    if (ccs.width && ccs.width !== 'auto') parts.push(`主容器宽 ${ccs.width}`)
    if (ccs.maxWidth && ccs.maxWidth !== 'none') parts.push(`最大宽 ${ccs.maxWidth}`)
  }
  const sections = Array.from(document.querySelectorAll('section, main, [class*="card"]'))
    .filter((el) => intersectsRect(el, rect))
  if (sections.length) parts.push(`约 ${sections.length} 个区块`)
  return parts.join('；') || (rect ? '选区布局' : '未检测到显著布局')
}

// 采集页面快照（不依赖录制状态，随时可触发）
export function capturePageSnapshot(): PageAnalysisInput {
  return capturePageSnapshotInRect()
}

// 采集指定矩形区域内快照（选区分析）
export function capturePageSnapshotInRect(rect?: Rect): PageAnalysisInput {
  const components = captureComponents(rect)
  const tokens = captureTokens(rect)
  return {
    url: location.href,
    title: document.title || '',
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    tokens,
    components,
    layout: captureLayout(rect),
    rect,
  }
}

// ===== 选区交互：在当前页面叠加蒙层，用户拖拽框选区域 =====
let selectRectEl: HTMLDivElement | null = null
let selectOverlayEl: HTMLDivElement | null = null
let selectStart: { x: number; y: number } | null = null

function removeSelectOverlay() {
  if (selectOverlayEl?.parentNode) selectOverlayEl.parentNode.removeChild(selectOverlayEl)
  if (selectRectEl?.parentNode) selectRectEl.parentNode.removeChild(selectRectEl)
  selectOverlayEl = null
  selectRectEl = null
  selectStart = null
}

// 进入选区模式；返回 Promise，选区完成 resolve(rect)，取消/Esc resolve(null)
export function enterSelectMode(): Promise<Rect | null> {
  return new Promise((resolve) => {
    if (selectOverlayEl) return resolve(null)
    selectStart = null

    // 全屏遮罩（半透明，阻止事件穿透）
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.25);z-index:2147483647;cursor:crosshair;'
    // 选区高亮矩形（虚线框）
    const sel = document.createElement('div')
    sel.style.cssText = 'position:fixed;border:2px dashed #3b82f6;background:rgba(59,130,246,0.12);z-index:2147483647;display:none;pointer-events:none;'
    ;(document.body || document.documentElement).appendChild(overlay)
    ;(document.body || document.documentElement).appendChild(sel)
    selectOverlayEl = overlay
    selectRectEl = sel

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return
      e.preventDefault(); e.stopPropagation()
      selectStart = { x: e.clientX, y: e.clientY }
      sel.style.display = 'block'
      updateSel(e.clientX, e.clientY)
    }
    function onMouseMove(e: MouseEvent) {
      if (!selectStart) return
      e.preventDefault(); e.stopPropagation()
      updateSel(e.clientX, e.clientY)
    }
    function updateSel(cx: number, cy: number) {
      const s = selectStart!
      const x = Math.min(s.x, cx)
      const y = Math.min(s.y, cy)
      const w = Math.abs(cx - s.x)
      const h = Math.abs(cy - s.y)
      sel.style.left = `${x}px`
      sel.style.top = `${y}px`
      sel.style.width = `${w}px`
      sel.style.height = `${h}px`
    }
    function onMouseUp(e: MouseEvent) {
      if (!selectStart) return
      e.preventDefault(); e.stopPropagation()
      const s = selectStart
      const x = Math.min(s.x, e.clientX)
      const y = Math.min(s.y, e.clientY)
      const w = Math.abs(e.clientX - s.x)
      const h = Math.abs(e.clientY - s.y)
      overlay.removeEventListener('mousedown', onMouseDown)
      overlay.removeEventListener('mousemove', onMouseMove)
      overlay.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('keydown', onKeyDown)
      removeSelectOverlay()
      // 太小视为误触（< 10px）取消
      if (w < 10 || h < 10) { resolve(null); return }
      resolve({ x, y, width: w, height: h })
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        overlay.removeEventListener('mousedown', onMouseDown)
        overlay.removeEventListener('mousemove', onMouseMove)
        overlay.removeEventListener('mouseup', onMouseUp)
        document.removeEventListener('keydown', onKeyDown)
        removeSelectOverlay()
        resolve(null)
      }
    }

    overlay.addEventListener('mousedown', onMouseDown)
    overlay.addEventListener('mousemove', onMouseMove)
    overlay.addEventListener('mouseup', onMouseUp)
    document.addEventListener('keydown', onKeyDown)
  })
}

// content 侧响应"分析页面 / 选区分析"请求
chrome.runtime.onMessage.addListener((msg: any, _sender, sendResponse) => {
  if (msg?.type === 'PAGE_ANALYZE_REQUEST') {
    try {
      sendResponse({ type: 'PAGE_SNAPSHOT', snapshot: capturePageSnapshot() })
    } catch (e) {
      sendResponse({ type: 'PAGE_SNAPSHOT', snapshot: null })
    }
  } else if (msg?.type === 'PAGE_SELECT_REQUEST') {
    // 进入选区模式：完成拖拽后采集区域内快照返回；取消返回 null
    void (async () => {
      try {
        const rect = await enterSelectMode()
        if (!rect) {
          sendResponse({ type: 'PAGE_SELECT_CANCEL' })
          return
        }
        sendResponse({ type: 'PAGE_SNAPSHOT', snapshot: capturePageSnapshotInRect(rect) })
      } catch (e) {
        sendResponse({ type: 'PAGE_SELECT_CANCEL' })
      }
    })()
    return true // 异步响应
  }
  return undefined
})
