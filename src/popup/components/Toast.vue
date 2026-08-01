<template>
  <Teleport to="body">
    <div class="fixed top-3 right-3 z-[9999] flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="pointer-events-auto min-w-[200px] max-w-[300px] px-3 py-2.5 rounded-lg text-xs shadow-lg border backdrop-blur-sm animate-slide-in-right"
          :class="toastClass(t.type)"
        >
          <div class="flex items-start gap-2">
            <span class="shrink-0 mt-0.5">{{ toastIcon(t.type) }}</span>
            <span class="flex-1 break-words">{{ t.message }}</span>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface ToastItem {
  id: number
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

const toasts = ref<ToastItem[]>([])
let nextId = 1

function show(type: ToastItem['type'], message: string, duration = 3000) {
  const id = nextId++
  toasts.value.push({ id, type, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, duration)
}

function toastClass(type: ToastItem['type']): string {
  switch (type) {
    case 'success': return 'bg-base-panel/95 border-success text-success'
    case 'error': return 'bg-base-panel/95 border-danger text-danger'
    case 'warning': return 'bg-base-panel/95 border-warning text-warning'
    default: return 'bg-base-panel/95 border-accent text-tprimary'
  }
}

function toastIcon(type: ToastItem['type']): string {
  switch (type) {
    case 'success': return '✅'
    case 'error': return '❌'
    case 'warning': return '⚠️'
    default: return 'ℹ️'
  }
}

defineExpose({ show })
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
