import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LogItem from '../../src/popup/components/LogItem.vue'
import type { OperationItem } from '../../src/types'

describe('LogItem.vue', () => {
  it('should render click event correctly', () => {
    const item: OperationItem = {
      type: 'click',
      timestamp: Date.now(),
      pageUrl: '/home',
      targetText: '登录按钮',
      xpath: '//button',
    }
    const wrapper = mount(LogItem, { props: { item, index: 0 } })
    expect(wrapper.text()).toContain('点击')
    expect(wrapper.text()).toContain('登录按钮')
  })

  it('should render JS error event correctly', () => {
    const item: OperationItem = {
      type: 'js_error',
      timestamp: Date.now(),
      pageUrl: '/app',
      errorMsg: 'TypeError: x is not a function',
    }
    const wrapper = mount(LogItem, { props: { item, index: 0 } })
    expect(wrapper.text()).toContain('JS 错误')
    expect(wrapper.text()).toContain('TypeError')
  })

  it('should render route change event correctly', () => {
    const item: OperationItem = {
      type: 'route_change',
      timestamp: Date.now(),
      pageUrl: '/new-page',
      fromUrl: '/old-page',
      toUrl: '/new-page',
    }
    const wrapper = mount(LogItem, { props: { item, index: 0 } })
    expect(wrapper.text()).toContain('路由')
    expect(wrapper.text()).toContain('/new-page')
  })

  it('should render input event correctly', () => {
    const item: OperationItem = {
      type: 'input',
      timestamp: Date.now(),
      pageUrl: '/search',
      targetText: 'hello',
      xpath: '//input',
    }
    const wrapper = mount(LogItem, { props: { item, index: 0 } })
    expect(wrapper.text()).toContain('输入')
    expect(wrapper.text()).toContain('hello')
  })

  it('should emit remove event when delete button clicked', () => {
    const item: OperationItem = {
      type: 'click',
      timestamp: Date.now(),
      pageUrl: '/',
      targetText: 'test',
    }
    const wrapper = mount(LogItem, { props: { item, index: 2 } })
    wrapper.find('button').trigger('click')
    expect(wrapper.emitted('remove')).toBeTruthy()
    expect(wrapper.emitted('remove')![0]).toEqual([2])
  })
})
