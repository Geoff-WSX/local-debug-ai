<template>
  <div class="flex items-center justify-between px-3 py-2 bg-base-panel border-b border-edge text-sm shrink-0">
    <span class="font-mono text-xs text-tsecondary truncate max-w-[180px]">
      {{ displayOrigin }}
    </span>
    <div
      v-if="isLocalhost"
      class="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
      :class="hasProjectContext
        ? 'bg-success-soft text-success'
        : 'bg-warning-soft text-warning'"
    >
      <span
        class="inline-block w-1.5 h-1.5 rounded-full"
        :class="hasProjectContext ? 'bg-success' : 'bg-warning'"
      />
      {{ hasProjectContext ? '已填写项目简介' : '未填写项目简介' }}
    </div>
    <div v-else class="text-[10px] text-warning bg-warning-soft px-2 py-0.5 rounded-full">
      ⚠ 仅支持 localhost
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  origin: string
  hasProjectContext: boolean
}>()

const isLocalhost = computed(() => {
  return props.origin.startsWith('localhost') || props.origin.startsWith('127.0.0.1')
})

const displayOrigin = computed(() => {
  return props.origin || '未检测到页面'
})
</script>
