<template>
  <div
    class="group relative flex items-start gap-2.5 px-3 py-2.5 text-xs border-b border-edge-faint hover:bg-base-hover transition-all duration-200 cursor-default"
  >
    <!-- 左侧类型强调条（hover 显现） -->
    <span class="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-transparent transition-colors duration-200" :class="accentBarClass" />

    <!-- 类型角标 -->
    <span
      class="inline-flex items-center justify-center w-6 h-5 rounded-md shrink-0 mt-0.5"
      :class="typeClass"
    >
      <AppIcon :name="typeIcon" :size="12" />
    </span>

    <!-- 内容 -->
    <div class="flex-1 min-w-0">
      <div class="font-medium text-tprimary truncate">
        {{ typeLabel }}
      </div>
      <div class="text-tsecondary truncate mt-0.5">
        {{ summary }}
      </div>
      <div class="text-tdisabled mt-0.5 text-[11px] flex items-center gap-1">
        <AppIcon name="chevron" :size="9" class="rotate-90" /> {{ time }}
      </div>
    </div>

    <!-- 删除按钮 -->
    <button
      class="shrink-0 text-tdisabled hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-danger-soft"
      @click="$emit('remove', index)"
    >
      <AppIcon name="close" :size="12" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { OperationItem } from '@/types'
import { formatTimestamp, truncateText } from '@/utils/formatter'
import AppIcon from '@/popup/components/AppIcon.vue'

const props = defineProps<{
  item: OperationItem
  index: number
}>()

defineEmits<{
  remove: [index: number]
}>()

const typeClass = computed(() => {
  switch (props.item.type) {
    case 'click': return 'bg-accent-soft text-accent'
    case 'js_error': return 'bg-danger-soft text-danger'
    case 'route_change': return 'bg-success-soft text-success'
    case 'input': return 'bg-warning-soft text-warning'
  }
})

// 左侧强调条（hover 显现的语义色）
const accentBarClass = computed(() => {
  switch (props.item.type) {
    case 'click': return 'bg-accent/80 group-hover:bg-accent'
    case 'js_error': return 'bg-danger/80 group-hover:bg-danger'
    case 'route_change': return 'bg-success/80 group-hover:bg-success'
    case 'input': return 'bg-warning/80 group-hover:bg-warning'
  }
})

const typeIcon = computed(() => {
  switch (props.item.type) {
    case 'click': return 'mic'
    case 'js_error': return 'close'
    case 'route_change': return 'chevron'
    case 'input': return 'target'
  }
})

const typeLabel = computed(() => {
  switch (props.item.type) {
    case 'click': return `点击 — ${truncateText(props.item.targetText || '(无文本)', 30)}`
    case 'js_error': return `JS 错误 — ${truncateText(props.item.errorMsg || '', 40)}`
    case 'route_change': return `路由跳转 → ${truncateText(props.item.toUrl || '', 30)}`
    case 'input': return `输入 — ${truncateText(props.item.targetText || '(空)', 30)}`
  }
})

const summary = computed(() => {
  switch (props.item.type) {
    case 'click': return `XPath: ${truncateText(props.item.xpath || '', 40)}`
    case 'js_error': return truncateText(props.item.errorMsg || '', 60)
    case 'route_change': return `${truncateText(props.item.fromUrl || '', 25)} → ${truncateText(props.item.toUrl || '', 25)}`
    case 'input': return `XPath: ${truncateText(props.item.xpath || '', 40)}`
  }
})

const time = computed(() => formatTimestamp(props.item.timestamp))
</script>
