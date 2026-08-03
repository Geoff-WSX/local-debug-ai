<template>
  <div class="flex items-start gap-2.5 px-3 py-2.5 border-b border-edge text-xs hover:bg-base-hover transition-colors group animate-fade-in">
    <!-- 类型图标 -->
    <span
      class="inline-flex items-center justify-center w-5 h-5 rounded-md shrink-0 mt-0.5"
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
      <div class="text-tdisabled mt-0.5 text-[11px]">
        {{ time }}
      </div>
    </div>

    <!-- 删除按钮 -->
    <button
      class="shrink-0 text-tdisabled hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
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
  }
})

const typeIcon = computed(() => {
  switch (props.item.type) {
    case 'click': return 'mic'
    case 'js_error': return 'close'
    case 'route_change': return 'chevron'
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
