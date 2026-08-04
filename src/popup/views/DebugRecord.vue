<template>
  <div class="flex flex-col h-full">
    <!-- 状态栏 -->
    <StatusBar
      :origin="store.currentOrigin"
      :has-project-context="!!store.originSession.projectContext"
    />

    <!-- 控制按钮 -->
    <div class="flex items-center gap-2.5 px-3 py-2.5 border-b border-edge bg-base-panel">
      <button
        class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-card"
        :class="store.isRecording
          ? 'bg-danger/15 text-danger border border-danger/40 hover:bg-danger/20'
          : 'bg-accent text-white hover:bg-accent-hover'"
        @click="toggleRecording"
      >
        <AppIcon :name="store.isRecording ? 'stop' : 'record'" :size="14" :class="store.isRecording ? 'animate-pulse-rec' : ''" />
        {{ store.isRecording ? '停止录制' : '开始录制' }}
      </button>

      <button
        class="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none"
        :class="store.isAnalyzing ? 'bg-base-active text-tsecondary' : 'bg-success text-base shadow-card hover:bg-success/80'"
        :disabled="store.liveRecords.length === 0 || store.isAnalyzing"
        @click="handleAnalyze"
      >
        <AppIcon
          v-if="store.isAnalyzing"
          :name="analyzeIcon"
          :size="14"
          class="animate-spin text-accent"
        />
        <AppIcon v-else name="analyze" :size="14" />
        {{ store.isAnalyzing ? '分析中...' : 'AI 分析' }}
      </button>
    </div>

    <!-- 预期效果输入 -->
    <div v-if="store.liveRecords.length > 0" class="mx-3 mt-2 mb-2 px-3 py-2.5 border border-accent/30 bg-accent-soft/60 rounded-lg">
      <label class="text-xs font-medium text-accent flex items-center gap-1.5 mb-1.5">
        <AppIcon name="target" :size="13" />
        预期效果（可选）
        <span class="text-[10px] text-tsecondary font-normal">AI 将对照此目标定位问题</span>
      </label>
      <input
        v-model="store.expectedEffect"
        class="w-full px-2.5 py-1.5 border border-edge rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 bg-surface-sunken text-tprimary placeholder:text-tdisabled"
        placeholder="如：点击登录后应该跳转到仪表盘"
      />
    </div>

    <!-- 实时日志列表 -->
    <div class="flex-1 overflow-y-auto">
      <EmptyState
        v-if="store.liveRecords.length === 0 && !store.isRecording"
        icon="mic"
        title="暂无操作记录"
        description="点击「开始录制」后在页面操作即可捕获"
      />
      <div v-else-if="store.liveRecords.length === 0 && store.isRecording" class="py-10 text-center">
        <div class="text-sm mb-2 inline-flex items-center gap-2 text-danger">
          <span class="w-2.5 h-2.5 rounded-full bg-danger animate-pulse-rec" />
          <span class="text-xs font-medium tracking-wide">录制中，等待页面操作...</span>
        </div>
      </div>
      <LogItem
        v-for="(record, idx) in store.liveRecords"
        :key="record.timestamp + '-' + idx"
        :item="record"
        :index="idx"
        @remove="store.removeLiveRecord"
      />
    </div>

    <!-- 结果区域 -->
    <Transition name="result">
      <div v-if="analysisResult !== null" class="border-t border-edge max-h-[260px] overflow-y-auto bg-base-panel">
        <div class="flex items-center justify-between px-3 py-2 bg-surface-raised border-b border-edge sticky top-0">
          <span class="text-xs font-medium text-accent flex items-center gap-1.5">
            <AppIcon name="analyze" :size="13" />
            AI 分析结果
          </span>
          <button
            class="text-xs text-tsecondary hover:text-tprimary transition-colors flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-base-hover"
            @click="analysisResult = null"
          >
            <AppIcon name="close" :size="12" /> 收起
          </button>
        </div>
        <div class="p-3">
          <MarkdownRenderer :content="analysisResult" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import StatusBar from '@/popup/components/StatusBar.vue'
import LogItem from '@/popup/components/LogItem.vue'
import MarkdownRenderer from '@/popup/components/MarkdownRenderer.vue'
import EmptyState from '@/popup/components/EmptyState.vue'
import AppIcon from '@/popup/components/AppIcon.vue'
import { showToast } from '@/popup/components/toastBus'

const store = useAppStore()
const analysisResult = ref<string | null>(null)

const analyzeIcon = computed(() => store.isAnalyzing ? 'loader' : 'analyze')

function toggleRecording() {
  if (store.isRecording) {
    store.stopRecording()
  } else {
    store.startRecording()
  }
}

async function handleAnalyze() {
  const result = await store.analyzeCurrentRecording()
  if (result === null) return
  // 检查是否是错误信息
  if (result.startsWith('请前往') || result.startsWith('暂无') || result.startsWith('AI 请求失败') || result.startsWith('网络连接失败') || result.startsWith('接口地址') || result.startsWith('AI 返回')) {
    showToast('error', result)
    return
  }
  analysisResult.value = result
}

// 监听 storage 变化：content script 写入后自动刷新
let storageListener: ((changes: Record<string, any>, area: string) => void) | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // 加载当前站点数据
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0]
    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
      const origin = new URL(tab.url).host
      store.loadOriginData(origin)
    }
  })

  // 监听 storage 变更（content script 直接写 storage 后的通知机制）
  storageListener = (changes, area) => {
    if (area === 'local' && changes[store.currentOrigin]) {
      store.loadOriginData(store.currentOrigin)
    }
  }
  chrome.storage.onChanged.addListener(storageListener)

  // 每 500ms 无条件读取最新数据（数据是否显示由 storage 决定，不依赖任何状态同步）
  pollTimer = setInterval(async () => {
    if (store.currentOrigin) {
      await store.reloadRecordingData()
    }
  }, 500)
})

onUnmounted(() => {
  if (storageListener) {
    chrome.storage.onChanged.removeListener(storageListener)
  }
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.result-enter-active {
  transition: all 0.3s ease;
}
.result-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
</style>
