import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import StatusBar from '../../src/popup/components/StatusBar.vue'

describe('StatusBar.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should show status for non-localhost origins too', () => {
    const wrapper = mount(StatusBar, {
      props: {
        origin: 'example.com',
        hasProjectContext: true,
      },
    })
    expect(wrapper.text()).toContain('example.com')
    expect(wrapper.text()).toContain('已填写项目简介')
  })

  it('should show no-page hint when origin is empty', () => {
    const wrapper = mount(StatusBar, {
      props: {
        origin: '',
        hasProjectContext: false,
      },
    })
    expect(wrapper.text()).toContain('未检测到页面')
    expect(wrapper.text()).toContain('未填写项目简介')
  })
})
