<template>
  <div class="flex items-center justify-between px-3 py-2 bg-white border-b text-sm">
    <span class="font-mono text-xs text-gray-500 truncate max-w-[200px]">
      {{ displayOrigin }}
    </span>
    <div
      v-if="isLocalhost"
      class="flex items-center gap-1.5"
    >
      <span
        class="inline-block w-2 h-2 rounded-full"
        :class="hasProjectContext ? 'bg-green-500' : 'bg-yellow-400'"
      />
      <span class="text-xs" :class="hasProjectContext ? 'text-green-700' : 'text-yellow-700'">
        {{ hasProjectContext ? '已绑定需求文档' : '未上传需求文档' }}
      </span>
    </div>
    <div v-else class="text-xs text-orange-600">
      ⚠ 仅支持 localhost 开发环境
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
