<template>
  <div class="flex items-start gap-2 px-3 py-2 border-b border-gray-100 text-xs hover:bg-gray-50 group">
    <!-- 类型图标 -->
    <span
      class="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[10px] shrink-0 mt-0.5"
      :class="typeClass"
    >
      {{ typeIcon }}
    </span>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <div class="font-medium text-gray-800">
        {{ typeLabel }}
      </div>
      <div class="text-gray-500 truncate">
        {{ summary }}
      </div>
      <div class="text-gray-400 mt-0.5">
        {{ time }}
      </div>
    </div>

    <!-- 删除按钮 -->
    <button
      class="shrink-0 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
