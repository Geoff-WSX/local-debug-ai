import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import StatusBar from '../../src/popup/components/StatusBar.vue'

describe('StatusBar.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should show green status when project context exists', () => {
    const wrapper = mount(StatusBar, {
      props: {
        origin: 'localhost:5173',
        hasProjectContext: true,
      },
    })
    expect(wrapper.text()).toContain('localhost:5173')
    expect(wrapper.text()).toContain('已绑定需求文档')
  })

  it('should show yellow warning when no project context', () => {
    const wrapper = mount(StatusBar, {
      props: {
        origin: 'localhost:5173',
        hasProjectContext: false,
      },
    })
    expect(wrapper.text()).toContain('未上传需求文档')
  })

  it('should show localhost hint for non-localhost origins', () => {
    const wrapper = mount(StatusBar, {
      props: {
        origin: '',
        hasProjectContext: false,
      },
    })
    expect(wrapper.text()).toContain('仅支持')
  })
})
