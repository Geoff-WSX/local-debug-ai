import { describe, it, expect } from 'vitest'
import { formatTimestamp, truncateText, formatOrigin } from '../../src/utils/formatter'

describe('formatter', () => {
  describe('formatTimestamp', () => {
    it('should format timestamp to readable datetime string', () => {
      const ts = new Date('2026-07-30T12:00:00').getTime()
      const result = formatTimestamp(ts)
      expect(result).toContain('2026')
      expect(result).toContain('07')
      expect(result).toContain('30')
    })

    it('should handle zero timestamp', () => {
      const result = formatTimestamp(0)
      expect(result).toBeTruthy()
    })
  })

  describe('truncateText', () => {
    it('should return text as is when shorter than max', () => {
      expect(truncateText('hello', 10)).toBe('hello')
    })

    it('should truncate and append ellipsis when longer than max', () => {
      expect(truncateText('hello world this is long', 10)).toBe('hello worl…')
    })

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('')
    })

    it('should use default max length of 50', () => {
      const long = 'a'.repeat(100)
      const result = truncateText(long)
      expect(result.length).toBe(51) // 50 + 1 ellipsis
      expect(result).toMatch(/…$/)
    })
  })

  describe('formatOrigin', () => {
    it('should extract origin from full URL', () => {
      expect(formatOrigin('http://localhost:5173/home')).toBe('localhost:5173')
    })

    it('should handle URL without path', () => {
      expect(formatOrigin('http://localhost:3000')).toBe('localhost:3000')
    })

    it('should handle 127.0.0.1', () => {
      expect(formatOrigin('http://127.0.0.1:8080/test')).toBe('127.0.0.1:8080')
    })
  })
})
