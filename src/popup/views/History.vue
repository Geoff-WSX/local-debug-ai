<template>
  <div class="flex flex-col h-full">
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between px-3 py-2 border-b bg-base-panel">
      <span class="text-xs text-tsecondary">
        共 {{ store.originSession.analysisHistory.length }} 条记录
      </span>
      <div class="flex gap-2">
        <button
          class="text-xs text-tsecondary hover:text-accent transition-colors"
          :disabled="store.originSession.analysisHistory.length === 0"
          @click="handleExport"
        >
          📥 导出
        </button>
        <button
          class="text-xs text-danger hover:text-danger/80 transition-colors"
          :disabled="store.originSession.analysisHistory.length === 0"
          @click="handleClearAll"
        >
          🗑 清空
        </button>
      </div>
    </div>

    <!-- 历史列表 -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="store.originSession.analysisHistory.length === 0" class="p-8 text-center text-tdisabled text-sm">
        <p>暂无历史记录</p>
        <p class="text-xs mt-1">完成 AI 分析后记录将自动保存至此</p>
      </div>

      <div
        v-for="(record, idx) in sortedHistory"
        :key="record.timestamp"
        class="border-b border-edge"
      >
        <!-- 摘要行（点击展开） -->
        <div
          class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-base-panel transition-colors"
          @click="toggleExpand(record.timestamp)"
        >
          <span class="text-xs text-tdisabled shrink-0">{{ expanded.has(record.timestamp) ? '▼' : '▶' }}</span>
          <span class="text-xs text-tsecondary shrink-0">{{ formatTimestamp(record.timestamp) }}</span>
          <span
            v-if="!record.result"
            class="text-[10px] px-1.5 py-0.5 bg-warning-soft text-warning rounded shrink-0"
          >
            未分析
          </span>
          <span class="text-xs text-tdisabled truncate flex-1">
            {{ record.records.length }} 条操作记录
          </span>
          <button
            class="text-xs text-tdisabled hover:text-danger shrink-0"
            @click.stop="handleDelete(record.timestamp)"
          >
            ✕
          </button>
        </div>

        <!-- 展开详情 -->
        <div v-if="expanded.has(record.timestamp)" class="px-4 pb-3 space-y-2">
          <div class="text-xs text-tsecondary font-medium">📋 操作日志</div>
          <div class="bg-base-panel rounded p-2 max-h-32 overflow-y-auto text-xs text-tsecondary space-y-1">
            <div v-for="(op, i) in record.records" :key="i" class="truncate">
              <span class="text-tdisabled">[{{ op.type }}]</span>
              {{ op.targetText || op.errorMsg || op.toUrl || '(无详情)' }}
            </div>
            <div v-if="record.records.length === 0" class="text-tdisabled">无操作记录</div>
          </div>
          <div class="text-xs text-tsecondary font-medium">🤖 AI 诊断结果</div>
          <div v-if="record.result" class="max-h-48 overflow-y-auto">
            <MarkdownRenderer :content="record.result" />
          </div>
          <div v-else class="text-xs text-warning bg-warning-soft rounded p-2">
            尚未分析 — 可返回「调试录制」页点击 AI 分析
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import { formatTimestamp } from '@/utils/formatter'
import MarkdownRenderer from '@/popup/components/MarkdownRenderer.vue'

const store = useAppStore()
const expanded = ref<Set<number>>(new Set())

const sortedHistory = computed(() => {
  return [...store.originSession.analysisHistory].sort((a, b) => b.timestamp - a.timestamp)
})

function toggleExpand(ts: number) {
  if (expanded.value.has(ts)) {
    expanded.value.delete(ts)
  } else {
    expanded.value.add(ts)
  }
}

async function handleDelete(ts: number) {
  await store.deleteHistoryItem(ts)
}

async function handleClearAll() {
  if (confirm('确认清空当前站点全部历史记录？')) {
    await store.clearAllHistory()
  }
}

async function handleExport() {
  const records = sortedHistory.value
  if (records.length === 0) return

  let md = `# AI调试历史记录 - ${store.currentOrigin}\n\n`
  for (const r of records) {
    md += `---\n## ${formatTimestamp(r.timestamp)}\n\n`
    md += `### 操作日志\n\n`
    for (const op of r.records) {
      md += `- [${op.type}] ${op.targetText || op.errorMsg || op.toUrl || '无详情'}\n`
    }
    md += `\n### AI 诊断结果\n\n${r.result}\n\n`
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AI调试历史_${store.currentOrigin}_${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(url)
}
</script>
