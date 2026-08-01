<template>
  <div class="flex items-start gap-2.5 px-3 py-2.5 border-b border-edge text-xs hover:bg-base-hover transition-colors group animate-fade-in">
    <!-- 类型图标 -->
    <span
      class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] shrink-0 mt-0.5 shadow-sm"
      :class="typeClass"
    >
      {{ typeIcon }}
    </span>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <div class="font-medium text-tprimary">
        {{ typeLabel }}
      </div>
      <div class="text-tsecondary truncate mt-0.5">
        {{ summary }}
      </div>
      <div class="text-tdisabled mt-0.5 text-[11px]">
        {{ time }}
      </div>
    </div>

    <!-- 删除按钮 -->
    <button
      class="shrink-0 text-tdisabled hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
      @click="$emit('remove', index)"
    >
      ✕
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OperationItem } from '@/types'
import { formatTimestamp, truncateText } from '@/utils/formatter'

const props = defineProps<{
  item: OperationItem
  index: number
}>()

defineEmits<{
  remove: [index: number]
}>()

const typeClass = computed(() => {
  switch (props.item.type) {
    case 'click': return 'bg-blue-500'
    case 'js_error': return 'bg-red-500'
    case 'route_change': return 'bg-purple-500'
  }
})

const typeIcon = computed(() => {
  switch (props.item.type) {
    case 'click': return 'C'
    case 'js_error': return '!'
    case 'route_change': return 'R'
  }
})

const typeLabel = computed(() => {
  switch (props.item.type) {
    case 'click': return `点击 — ${truncateText(props.item.targetText || '(无文本)', 30)}`
    case 'js_error': return `JS 错误 — ${truncateText(props.item.errorMsg || '', 40)}`
    case 'route_change': return `路由跳转 → ${truncateText(props.item.toUrl || '', 30)}`
  }
})

const summary = computed(() => {
  switch (props.item.type) {
    case 'click': return `XPath: ${truncateText(props.item.xpath || '', 40)}`
    case 'js_error': return truncateText(props.item.errorMsg || '', 60)
    case 'route_change': return `${truncateText(props.item.fromUrl || '', 25)} → ${truncateText(props.item.toUrl || '', 25)}`
  }
})

const time = computed(() => formatTimestamp(props.item.timestamp))
</script>
