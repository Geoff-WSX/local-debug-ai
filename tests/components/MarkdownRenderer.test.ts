import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRenderer from '../../src/popup/components/MarkdownRenderer.vue'

describe('MarkdownRenderer.vue', () => {
  it('should render plain text content', () => {
    const wrapper = mount(MarkdownRenderer, {
      props: { content: 'Hello World' },
    })
    expect(wrapper.text()).toContain('Hello World')
  })

  it('should render code block with copy button', () => {
    const content = '```js\nconsole.log("hello")\n```'
    const wrapper = mount(MarkdownRenderer, {
      props: { content },
    })
    expect(wrapper.text()).toContain('console.log')
    expect(wrapper.text()).toContain('hello')
  })
})
