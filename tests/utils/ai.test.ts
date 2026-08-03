import { describe, it, expect } from 'vitest'
import { buildSystemPrompt, validateBeforeAnalyze } from '../../src/utils/ai'
import type { OperationItem } from '../../src/types'

describe('ai', () => {
  describe('buildSystemPrompt', () => {
    it('should include project context when provided', () => {
      const prompt = buildSystemPrompt('用户需要登录后看到仪表盘', [])
      expect(prompt).toContain('=====项目简介=====')
      expect(prompt).toContain('用户需要登录后看到仪表盘')
      expect(prompt).not.toContain('暂无项目简介')
    })

    it('should use fallback text when project context is empty', () => {
      const prompt = buildSystemPrompt('', [])
      expect(prompt).toContain('暂无项目简介')
      expect(prompt).toContain('仅基于前端运行日志排查代码错误')
    })

    it('should include serialized operation records', () => {
      const records: OperationItem[] = [
        { type: 'click', timestamp: 1000, pageUrl: '/home', targetText: '登录按钮', xpath: '//button' },
      ]
      const prompt = buildSystemPrompt('', records)
      expect(prompt).toContain('登录按钮')
      expect(prompt).toContain('click')
      expect(prompt).toContain('操作日志')
    })

    it('should contain the fixed prompt structure', () => {
      const prompt = buildSystemPrompt('项目简介内容', [])
      expect(prompt).toContain('你是资深前端调试工程师')
      expect(prompt).toContain('### 1. 异常根因汇总')
      expect(prompt).toContain('### 2. 完整修复方案')
      expect(prompt).toContain('禁止寒暄')
    })

    it('should have both sections: project context and operation records', () => {
      const records: OperationItem[] = [
        { type: 'route_change', timestamp: 2000, pageUrl: '/page1', fromUrl: '/page1', toUrl: '/page2' },
      ]
      const prompt = buildSystemPrompt('项目简介', records)
      expect(prompt).toContain('=====项目简介=====')
      expect(prompt).toContain('=====用户页面时序操作日志=====')
    })

    it('should include expected effect when provided', () => {
      const prompt = buildSystemPrompt('项目简介', [], '点击登录后跳转到仪表盘')
      expect(prompt).toContain('=====用户预期效果=====')
      expect(prompt).toContain('点击登录后跳转到仪表盘')
    })

    it('should not include expected effect section when not provided', () => {
      const prompt = buildSystemPrompt('项目简介', [])
      expect(prompt).not.toContain('用户预期效果')
    })
  })

  describe('validateBeforeAnalyze', () => {
    it('should return error when apiKey is empty', () => {
      const err = validateBeforeAnalyze('', [{ type: 'click', timestamp: 1, pageUrl: '/' }])
      expect(err).toContain('配置')
    })

    it('should return error when recording is empty', () => {
      const err = validateBeforeAnalyze('sk-key', [])
      expect(err).toContain('暂无操作记录')
    })

    it('should return null when all conditions are met', () => {
      const err = validateBeforeAnalyze('sk-key', [{ type: 'click', timestamp: 1, pageUrl: '/' }])
      expect(err).toBeNull()
    })
  })
})
