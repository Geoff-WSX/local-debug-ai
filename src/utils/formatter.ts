/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/**
 * 截断文本，超出 maxLen 则追加省略号
 */
export function truncateText(text: string, maxLen = 50): string {
  if (!text) return ''
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}

/**
 * 从 URL 中提取 origin 标识（移除协议前缀）
 */
export function formatOrigin(url: string): string {
  try {
    const u = new URL(url)
    return u.host // 返回 hostname:port
  } catch {
    return url
  }
}
