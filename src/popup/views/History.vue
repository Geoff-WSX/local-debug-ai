<template>
  <div class="flex flex-col h-full">
    <!-- 子 Tab 切换：调试历史 / 页面分析 -->
    <div class="flex border-b border-edge bg-base-panel shrink-0">
      <button
        class="flex-1 py-2 text-xs font-medium transition-all duration-200 relative flex items-center justify-center gap-1.5"
        :class="historyTab === 'debug'
          ? 'text-accent bg-base-hover'
          : 'text-tsecondary hover:text-tprimary hover:bg-base-hover/50'"
        @click="historyTab = 'debug'"
      >
        <AppIcon name="history" :size="13" /> 调试历史
        <span
          v-if="historyTab === 'debug'"
          class="absolute bottom-0 left-4 right-4 h-0.5 bg-accent rounded-full transition-all duration-200"
        />
      </button>
      <button
        class="flex-1 py-2 text-xs font-medium transition-all duration-200 relative flex items-center justify-center gap-1.5"
        :class="historyTab === 'page'
          ? 'text-accent bg-base-hover'
          : 'text-tsecondary hover:text-tprimary hover:bg-base-hover/50'"
        @click="historyTab = 'page'"
      >
        <AppIcon name="target" :size="13" /> 页面分析
        <span
          v-if="historyTab === 'page'"
          class="absolute bottom-0 left-4 right-4 h-0.5 bg-accent rounded-full transition-all duration-200"
        />
      </button>
    </div>

    <!-- 顶部操作栏（随子 Tab 联动） -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-edge bg-base-panel">
      <span class="text-xs text-tsecondary">
        共 {{ historyTab === 'debug' ? debugList.length : pageHistory.length }} 条记录
      </span>
      <div class="flex gap-2">
        <button
          class="text-xs text-tsecondary hover:text-accent transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-base-hover"
          :disabled="(historyTab === 'debug' ? debugList.length : pageHistory.length) === 0"
          @click="handleExport"
        >
          <AppIcon name="export" :size="13" /> 导出
        </button>
        <button
          class="text-xs text-danger hover:text-danger/80 transition-colors flex items-center gap-1 px-2 py-1 rounded hover:bg-danger-soft"
          :disabled="(historyTab === 'debug' ? debugList.length : pageHistory.length) === 0"
          @click="handleClearAll"
        >
          <AppIcon name="trash" :size="13" /> 清空
        </button>
      </div>
    </div>

    <!-- 调试历史列表 -->
    <div v-if="historyTab === 'debug'" class="flex-1 overflow-y-auto">
      <EmptyState
        v-if="debugList.length === 0"
        icon="history"
        title="暂无调试历史"
        description="完成 AI 分析后记录将自动保存至此"
      />

      <div
        v-for="(record, idx) in debugList"
        :key="record.timestamp"
        class="border-b border-edge-faint"
      >
        <!-- 摘要行（点击展开） -->
        <div
          class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-base-hover/70 transition-colors group"
          @click="toggleExpand(record.timestamp)"
        >
          <span class="text-tdisabled shrink-0 transition-all duration-200" :class="expanded[record.timestamp] ? 'rotate-180 text-accent' : 'group-hover:text-tsecondary'">
            <AppIcon name="chevron" :size="12" />
          </span>
          <span class="text-xs text-tsecondary shrink-0">{{ formatTimestamp(record.timestamp) }}</span>
          <span
            v-if="!record.result"
            class="text-[10px] px-1.5 py-0.5 bg-warning-soft text-warning rounded shrink-0 font-medium"
          >
            未分析
          </span>
          <span class="text-xs text-tdisabled truncate flex-1 ml-1">
            {{ record.records.length }} 条操作记录
          </span>
          <button
            v-if="analyzingTs === record.timestamp"
            class="text-[10px] px-2 py-1 bg-accent text-white rounded shrink-0 animate-pulse flex items-center gap-1"
            @click.stop
          >
            <AppIcon name="loader" :size="10" class="animate-spin" /> 分析中...
          </button>
          <button
            v-else
            class="text-[10px] px-2 py-1 bg-accent text-white rounded hover:bg-accent-hover shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            :disabled="!record.records.length"
            @click.stop="handleAnalyze(record.timestamp)"
          >
            <AppIcon name="analyze" :size="10" /> 分析
          </button>
          <button
            class="text-tdisabled hover:text-danger transition-colors shrink-0 p-1 rounded hover:bg-danger-soft"
            @click.stop="handleDelete(record.timestamp)"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>

        <!-- 展开详情（带过渡动画） -->
        <Transition name="expand">
          <div v-if="expanded[record.timestamp]" class="px-4 pb-3 space-y-2 overflow-hidden bg-surface-sunken/30">
            <div class="text-xs text-tsecondary font-medium flex items-center gap-1 pt-1"><AppIcon name="list" :size="12" class="text-accent" /> 操作日志</div>
            <div class="bg-base-panel rounded-lg p-2.5 max-h-32 overflow-y-auto text-xs text-tsecondary space-y-1 border border-edge shadow-card">
              <div v-for="(op, i) in record.records" :key="i" class="truncate">
                <span class="text-tdisabled font-mono text-[10px]">[{{ op.type }}]</span>
                {{ op.targetText || op.errorMsg || op.toUrl || '(无详情)' }}
              </div>
              <div v-if="record.records.length === 0" class="text-tdisabled">无操作记录</div>
            </div>
            <div class="text-xs text-tsecondary font-medium flex items-center gap-1"><AppIcon name="analyze" :size="12" class="text-accent" /> AI 诊断结果</div>
            <div v-if="record.result" class="max-h-48 overflow-y-auto bg-surface-raised rounded-lg p-2.5 border border-edge shadow-card">
              <MarkdownRenderer :content="record.result" />
            </div>
            <div v-else class="text-xs text-warning bg-warning-soft rounded-lg p-2.5 border border-warning/20">
              尚未分析 — 点击右侧「分析」按钮即可分析
            </div>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 页面分析历史列表 -->
    <div v-if="historyTab === 'page'" class="flex-1 overflow-y-auto">
      <EmptyState
        v-if="pageHistory.length === 0"
        icon="target"
        title="暂无页面分析"
        description="点击左侧「分析页面」按钮后结果将保存至此"
      />

      <div
        v-for="record in pageHistory"
        :key="record.timestamp"
        class="border-b border-edge-faint"
      >
        <!-- 摘要行（点击展开） -->
        <div
          class="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-base-hover/70 transition-colors group"
          @click="togglePageExpand(record.timestamp)"
        >
          <span class="text-tdisabled shrink-0 transition-all duration-200" :class="pageExpanded[record.timestamp] ? 'rotate-180 text-accent' : 'group-hover:text-tsecondary'">
            <AppIcon name="chevron" :size="12" />
          </span>
          <span class="text-xs text-tsecondary shrink-0">{{ formatTimestamp(record.timestamp) }}</span>
          <span class="text-xs text-tdisabled truncate flex-1 ml-1">
            {{ record.title || record.url }}
          </span>
          <button
            class="text-tdisabled hover:text-accent transition-colors shrink-0 p-1 rounded hover:bg-base-hover"
            @click.stop="copyPageResult(record)"
          >
            <AppIcon name="check" :size="12" />
          </button>
          <button
            class="text-tdisabled hover:text-danger transition-colors shrink-0 p-1 rounded hover:bg-danger-soft"
            @click.stop="handleDeletePage(record.timestamp)"
          >
            <AppIcon name="close" :size="12" />
          </button>
        </div>

        <!-- 展开详情 -->
        <Transition name="expand">
          <div v-if="pageExpanded[record.timestamp]" class="px-4 pb-3 space-y-2 overflow-hidden bg-surface-sunken/30">
            <div class="text-xs text-tsecondary font-medium flex items-center gap-1 pt-1"><AppIcon name="target" :size="12" class="text-accent" /> 页面来源</div>
            <div class="bg-base-panel rounded-lg p-2.5 text-xs text-tsecondary border border-edge shadow-card">
              <div class="truncate">{{ record.url }}</div>
              <div v-if="record.title" class="mt-0.5 text-tprimary">{{ record.title }}</div>
            </div>
            <div class="text-xs text-tsecondary font-medium flex items-center gap-1"><AppIcon name="doc" :size="12" class="text-accent" /> 风格分析结果</div>
            <div class="max-h-48 overflow-y-auto bg-surface-raised rounded-lg p-2.5 border border-edge shadow-card">
              <MarkdownRenderer :content="record.result" />
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
const historyTab = ref<'debug' | 'page'>('debug')
const expanded = ref<Record<number, boolean>>({})
const pageExpanded = ref<Record<number, boolean>>({})
const analyzingTs = ref<number | null>(null)

const debugList = computed(() => {
  return [...store.originSession.analysisHistory].sort((a, b) => b.timestamp - a.timestamp)
})

const pageHistory = computed(() => {
  const list = store.originSession.pageAnalysisHistory
  // 防御：确保是数组（旧数据/异常数据可能为非数组，导致展开运算符崩溃）
  if (!Array.isArray(list)) return []
  return [...list].sort((a, b) => b.timestamp - a.timestamp)
})

function toggleExpand(ts: number) {
  if (expanded.value[ts]) {
    delete expanded.value[ts]
  } else {
    expanded.value[ts] = true
  }
}

function togglePageExpand(ts: number) {
  if (pageExpanded.value[ts]) {
    delete pageExpanded.value[ts]
  } else {
    pageExpanded.value[ts] = true
  }
}

// 重新分析某条调试历史
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
  expanded.value[ts] = true
}

async function handleDelete(ts: number) {
  await store.deleteHistoryItem(ts)
}

async function handleDeletePage(ts: number) {
  await store.deletePageAnalysisItem(ts)
}

async function handleClearAll() {
  const isPage = historyTab.value === 'page'
  const label = isPage ? '页面分析历史' : '调试历史'
  if (confirm(`确认清空当前站点全部${label}？`)) {
    if (isPage) {
      await store.clearPageAnalysisHistory()
    } else {
      await store.clearAllHistory()
    }
  }
}

async function copyPageResult(record: { result: string }) {
  try {
    await navigator.clipboard.writeText(record.result)
    showToast('success', '已复制到剪贴板')
  } catch {
    showToast('error', '复制失败')
  }
}

async function handleExport() {
  if (historyTab.value === 'page') {
    await exportPageHistory()
  } else {
    await exportDebugHistory()
  }
}

async function exportDebugHistory() {
  const records = debugList.value
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

async function exportPageHistory() {
  const records = pageHistory.value
  if (records.length === 0) return

  let md = `# 页面风格分析历史 - ${store.currentOrigin}\n\n`
  for (const r of records) {
    md += `---\n## ${formatTimestamp(r.timestamp)}\n\n`
    md += `### 页面来源\n\n- 标题：${r.title || '未知'}\n- URL：${r.url}\n\n`
    md += `### 风格分析结果\n\n${r.result}\n\n`
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `页面风格分析_${store.currentOrigin}_${Date.now()}.md`
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
