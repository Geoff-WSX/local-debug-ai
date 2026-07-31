import type { ExtensionMessage, OperationItem, AnalysisRecord } from '../types'
import * as storage from '../utils/storage'
import { buildSystemPrompt, validateBeforeAnalyze, buildApiUrl } from '../utils/ai'

/**
 * 从 URL 中提取 origin 标识
 */
function extractOrigin(url: string): string {
  try {
    const u = new URL(url)
    return u.host
  } catch {
    return url
  }
}

/**
 * 处理 AI 分析请求
 */
async function handleAIAnalyze(origin: string, expectedEffect?: string): Promise<{ success: boolean; result?: string; error?: string }> {
  const session = await storage.getOriginSession(origin)
  // 使用当前激活模型（每次只能启动一个）
  const activeModel = await storage.getActiveModel()
  if (!activeModel) {
    return { success: false, error: '请先在设置中心配置并激活模型' }
  }

  const apiKey = activeModel.apiKey
  const error = validateBeforeAnalyze(apiKey, session.currentRecording)
  if (error) {
    return { success: false, error }
  }

  try {
    const systemPrompt = buildSystemPrompt(session.projectContext, session.currentRecording, expectedEffect)

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
          { role: 'user', content: JSON.stringify(session.currentRecording) },
        ],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text()
      return { success: false, error: `AI 请求失败 (${response.status}): ${errBody.slice(0, 300)}` }
    }

    const contentType = response.headers?.get?.('content-type') || ''
    const bodyText = await response.text()

    if (!contentType.includes('application/json')) {
      return { success: false, error: `接口地址返回了 HTML 页面而非 API 数据。请检查设置中的「API 接口地址」是否正确` }
    }

    let data: any
    try {
      data = JSON.parse(bodyText)
    } catch {
      return { success: false, error: `AI 返回数据解析失败：服务器返回了非 JSON 格式（${bodyText.slice(0, 200)}）` }
    }

    const result = data.choices?.[0]?.message?.content || ''

    // 更新对应的未分析历史记录（如果存在）
    const unanalyzed = await storage.findUnanalyzedHistory(origin)
    if (unanalyzed) {
      await storage.updateHistoryResult(origin, unanalyzed.timestamp, result)
    } else {
      // 兼容：没有未分析记录则新增完整历史
      const record: AnalysisRecord = {
        timestamp: Date.now(),
        records: [...session.currentRecording],
        result,
      }
      await storage.appendHistory(origin, record)
    }

    // 清空当前录制（分析完成，方便下一轮）
    await storage.clearRecording(origin)

    return { success: true, result }
  } catch (err: any) {
    return { success: false, error: `网络连接失败: ${err.message}` }
  }
}

/**
 * 消息处理器（导出供测试使用）
 */
export async function handleMessage(
  message: ExtensionMessage,
  sender: chrome.runtime.MessageSender,
): Promise<any> {
  switch (message.type) {
    case 'AI_ANALYZE': {
      return await handleAIAnalyze(message.origin, message.expectedEffect)
    }

    default:
      return { success: false, error: `Unknown message type: ${(message as any).type}` }
  }
}

// ===== 注册消息监听 =====
chrome.runtime.onMessage.addListener((message: any, sender: chrome.runtime.MessageSender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true // 异步响应
})

// ===== Side Panel 控制 =====
// 行为设计：点击图标打开侧边栏，切换 Tab 时根据 URL 启用/禁用
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

// 侧边栏打开时通知侧边栏加载数据
chrome.sidePanel.onOpened.addListener(async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab?.url && (tab.url.startsWith('http://localhost') || tab.url.startsWith('http://127.0.0.1'))) {
    chrome.runtime.sendMessage({ type: 'TAB_CHANGED', origin: extractOrigin(tab.url) }).catch(() => {})
  }
})

// Tab 切换：非 localhost 尝试关闭；localhost 通知侧边栏更新数据
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId)
    if (tab.url && (tab.url.startsWith('http://localhost') || tab.url.startsWith('http://127.0.0.1'))) {
    chrome.runtime.sendMessage({ type: 'TAB_CHANGED', origin: extractOrigin(tab.url) }).catch(() => {})
  } else {
    try { await chrome.sidePanel.close() } catch {}
  }
  } catch {}
})
