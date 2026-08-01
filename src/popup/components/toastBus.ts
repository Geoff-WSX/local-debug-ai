import type { ToastItem } from './Toast.vue'

// Toast 全局单例：供非组件代码（alert 替换等）调用
let instance: { show: (type: ToastItem['type'], message: string, duration?: number) => void } | null = null

export function setToastInstance(inst: typeof instance) {
  instance = inst
}

export function showToast(type: ToastItem['type'], message: string, duration?: number) {
  instance?.show(type, message, duration)
}
