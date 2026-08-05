import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// 为每个元素提供可配置的 getBoundingClientRect（用于测试选区过滤）
const positions = new WeakMap<Element, { left: number; top: number; width: number; height: number }>()

function setPos(el: Element, rect: { left: number; top: number; width: number; height: number }) {
  positions.set(el, rect)
}

describe('capturePageSnapshot', () => {
  beforeEach(() => {
    vi.resetModules()
    document.body.innerHTML = ''
    // jsdom 默认 getBoundingClientRect 全 0，这里根据 positions 返回；未配置的用默认非零尺寸
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: function (this: Element) {
        const p = positions.get(this)
        return p
          ? { width: p.width, height: p.height, top: p.top, left: p.left, right: p.left + p.width, bottom: p.top + p.height, x: p.left, y: p.top }
          : { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 }
      },
    })
  })

  afterEach(() => {
    // 还原
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value: undefined,
    })
  })

  it('captures page metadata and structure', async () => {
    document.title = '测试页面标题'
    document.body.innerHTML = '<button class="btn">登录</button><input class="search" type="search" />'
    // 给元素配置非零位置使其可见
    document.querySelectorAll('button, input').forEach((el) => setPos(el, { left: 0, top: 0, width: 100, height: 40 }))

    const mod = await import('../../src/content/index')
    const snapshot = mod.capturePageSnapshot()

    expect(snapshot).toBeTruthy()
    expect(snapshot.title).toBe('测试页面标题')
    expect(snapshot.url).toBeTruthy()
    expect(snapshot.viewport).toContain('x')
    expect(Array.isArray(snapshot.components)).toBe(true)
    expect(snapshot.tokens).toBeTruthy()
    expect(typeof snapshot.layout).toBe('string')
  })

  it('captures button and input components', async () => {
    document.body.innerHTML = '<button class="btn">登录</button><input class="search" type="search" />'
    document.querySelectorAll('button, input').forEach((el) => setPos(el, { left: 0, top: 0, width: 100, height: 40 }))

    const mod = await import('../../src/content/index')
    const snapshot = mod.capturePageSnapshot()

    const tags = snapshot.components.map((c) => c.tag)
    expect(tags).toContain('button')
    expect(tags).toContain('input')
    expect(snapshot.components[0]?.className).toBe('btn')
  })

  it('capturePageSnapshotInRect only captures intersecting components', async () => {
    document.body.innerHTML = `
      <button class="in-rect">框内按钮</button>
      <input class="out-rect" />
    `
    const inBtn = document.querySelector('button')!
    const outInput = document.querySelector('input')!
    setPos(inBtn, { left: 100, top: 100, width: 100, height: 40 })
    setPos(outInput, { left: 500, top: 500, width: 100, height: 40 })

    const mod = await import('../../src/content/index')
    const snapshot = mod.capturePageSnapshotInRect({ x: 50, y: 50, width: 200, height: 200 })

    // 只有框内按钮被采到，框外的 input 被过滤
    const tags = snapshot.components.map((c) => c.tag)
    expect(tags).toContain('button')
    expect(tags).not.toContain('input')
    // 快照带选区信息
    expect(snapshot.rect).toEqual({ x: 50, y: 50, width: 200, height: 200 })
  })

  it('capturePageSnapshotInRect without rect returns full page', async () => {
    document.body.innerHTML = '<button class="a">A</button>'
    document.querySelectorAll('button').forEach((el) => setPos(el, { left: 0, top: 0, width: 100, height: 40 }))

    const mod = await import('../../src/content/index')
    const snapshot = mod.capturePageSnapshotInRect(undefined)

    expect(snapshot.components.length).toBeGreaterThan(0)
    expect(snapshot.rect).toBeUndefined()
  })
})
