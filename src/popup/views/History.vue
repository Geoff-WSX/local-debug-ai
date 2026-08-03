<template>
  <div class="flex flex-col h-full">
    <!-- 顶部操作栏 -->
    <div class="flex items-center justify-between px-3 py-2 border-b bg-base-panel">
      <span class="text-xs text-tsecondary">
        共 {{ store.originSession.analysisHistory.length }} 条记录
      </span>
      <div class="flex gap-3">
        <button
          class="text-xs text-tsecondary hover:text-accent transition-colors flex items-center gap-1"
          :disabled="store.originSession.analysisHistory.length === 0"
          @click="handleExport"
        >
          <AppIcon name="export" :size="13" /> 导出
        </button>
        <button
          class="text-xs text-danger hover:text-danger/80 transition-colors flex items-center gap-1"
          :disabled="store.originSession.analysisHistory.length === 0"
          @click="handleClearAll"
        >
          <AppIcon name="trash" :size="13" /> 清空
        </button>
      </div>
    </div>

    <!-- 历史列表 -->
    <div class="flex-1 overflow-y-auto">
      <EmptyState
        v-if="store.originSession.analysisHistory.length === 0"
        icon="history"
        title="暂无历史记录"
        description="完成 AI 分析后记录将自动保存至此"
      />

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
          <span class="text-tdisabled shrink-0 transition-transform duration-200" :class="expanded.has(record.timestamp) ? 'rotate-180' : ''">
            <AppIcon name="chevron" :size="12" />
          </span>
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
            v-if="analyzingTs === record.timestamp"
            class="text-[10px] px-2 py-1 bg-accent text-white rounded shrink-0 animate-pulse flex items-center gap-1"
            @click.stop
          >
            <AppIcon name="close" :size="10" /> 分析中...
          </button>
          <button
            v-else
            class="text-[10px] px-2 py-1 bg-accent text-white rounded hover:bg-accent-hover shrink-0 flex items-center gap-1"
            :disabled="!record.records.length"
            @click.stop="handleAnalyze(record.timestamp)"
          >
            <AppIcon name="analyze" :size="10" /> 分析
          </button>
          <button
            class="text-tdisabled hover:text-danger transition-colors shrink-0"
            @click.stop="handleDelete(record.timestamp)"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>

        <!-- 展开详情（带过渡动画） -->
        <Transition name="expand">
          <div v-if="expanded.has(record.timestamp)" class="px-4 pb-3 space-y-2 overflow-hidden">
            <div class="text-xs text-tsecondary font-medium flex items-center gap-1"><AppIcon name="list" :size="12" /> 操作日志</div>
            <div class="bg-base-panel rounded p-2 max-h-32 overflow-y-auto text-xs text-tsecondary space-y-1">
              <div v-for="(op, i) in record.records" :key="i" class="truncate">
                <span class="text-tdisabled">[{{ op.type }}]</span>
                {{ op.targetText || op.errorMsg || op.toUrl || '(无详情)' }}
              </div>
              <div v-if="record.records.length === 0" class="text-tdisabled">无操作记录</div>
            </div>
            <div class="text-xs text-tsecondary font-medium flex items-center gap-1"><AppIcon name="analyze" :size="12" /> AI 诊断结果</div>
            <div v-if="record.result" class="max-h-48 overflow-y-auto">
              <MarkdownRenderer :content="record.result" />
            </div>
            <div v-else class="text-xs text-warning bg-warning-soft rounded p-2">
              尚未分析 — 点击右侧「分析」按钮即可分析
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import { formatTimestamp } from '@/utils/formatter'
import MarkdownRenderer from '@/popup/components/MarkdownRenderer.vue'
import AppIcon from '@/popup/components/AppIcon.vue'
import EmptyState from '@/popup/components/EmptyState.vue'
import { showToast } from '@/popup/components/toastBus'

const store = useAppStore()
const expanded = ref<Set<number>>(new Set())
const analyzingTs = ref<number | null>(null)

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

// 重新分析某条历史记录
async function handleAnalyze(ts: number) {
  if (analyzingTs.value !== null) return
  analyzingTs.value = ts
  const result = await store.analyzeHistoryItem(ts)
  analyzingTs.value = null

  if (result === null) return
  // 错误提示
  if (result.startsWith('请前往') || result.startsWith('暂无') || result.startsWith('AI 请求失败')
    || result.startsWith('网络连接失败') || result.startsWith('接口地址') || result.startsWith('AI 返回')) {
    showToast('error', result)
    return
  }
  showToast('success', '分析完成')
  // 自动展开显示结果
  expanded.value.add(ts)
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

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.25s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
