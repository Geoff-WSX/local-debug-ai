import { describe, it, expect } from 'vitest'
import { getXPath } from '../../src/utils/xpath'

describe('xpath', () => {
  it('should return XPath for a simple element with id', () => {
    document.body.innerHTML = '<div id="root"><button id="btn">Click</button></div>'
    const el = document.getElementById('btn')!
    const xpath = getXPath(el)
    expect(xpath).toBe("//*[@id='btn']")
  })

  it('should return tag-based XPath for element without id', () => {
    document.body.innerHTML = '<div><span>Hello</span></div>'
    const el = document.querySelector('span')!
    const xpath = getXPath(el)
    expect(xpath).toMatch(/^\/html\/body\/div\/span$/)
  })

  it('should use nth-child for duplicate tags at same level', () => {
    document.body.innerHTML = '<ul><li>a</li><li>b</li><li>c</li></ul>'
    const el = document.querySelectorAll('li')[1]!
    const xpath = getXPath(el)
    expect(xpath).toMatch(/li\[\d+\]/)
  })

  it('should handle deeply nested elements', () => {
    document.body.innerHTML = '<div><div><div><section><article><p>deep</p></article></section></div></div></div>'
    const el = document.querySelector('p')!
    const xpath = getXPath(el)
    expect(xpath).toContain('/p')
  })
})
