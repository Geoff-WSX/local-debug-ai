/**
 * 计算 DOM 元素的 XPath
 */
export function getXPath(el: Element): string {
  // 优先使用 id
  if (el.id) {
    return `//*[@id='${el.id}']`
  }

  // 递归向上构建路径
  function buildPath(node: Element): string {
    if (node === document.body) {
      return '/html/body'
    }
    if (node === document.documentElement) {
      return '/html'
    }

    const parent = node.parentElement
    if (!parent) return ''

    // 计算在同级中的位置
    const tag = node.tagName.toLowerCase()
    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName === node.tagName
    )
    let index = 1
    if (siblings.length > 1) {
      index = siblings.indexOf(node) + 1
    }

    const segment = siblings.length > 1
      ? `${tag}[${index}]`
      : tag

    return `${buildPath(parent)}/${segment}`
  }

  return buildPath(el)
}
