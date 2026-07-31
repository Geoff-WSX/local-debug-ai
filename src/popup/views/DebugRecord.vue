<template>
  <div class="flex flex-col h-full">
    <!-- 状态栏 -->
    <StatusBar
      :origin="store.currentOrigin"
      :has-project-context="!!store.originSession.projectContext"
    />

    <!-- 控制按钮 -->
    <div class="flex items-center gap-3 px-3 py-2 border-b">
      <button
        class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="store.isRecording
          ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
          : 'bg-blue-500 text-white hover:bg-blue-600'"
        @click="toggleRecording"
      >
        {{ store.isRecording ? '⏹ 停止录制' : '⏺ 开始录制' }}
      </button>

      <button
        class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        :class="store.isAnalyzing ? 'bg-gray-400 text-white' : 'bg-green-500 text-white hover:bg-green-600'"
        :disabled="store.liveRecords.length === 0 || store.isAnalyzing"
        @click="handleAnalyze"
      >
        {{ store.isAnalyzing ? '⏳ 分析中...' : '🤖 一键 AI 分析' }}
      </button>
    </div>

    <!-- 预期效果输入 -->
    <div v-if="store.liveRecords.length > 0" class="px-3 py-2 border-b bg-blue-50">
      <label class="text-xs font-medium text-blue-700 block mb-1">
        🎯 预期效果（可选）
      </label>
      <input
        v-model="store.expectedEffect"
        class="w-full px-2 py-1.5 border border-blue-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
        placeholder="如：点击登录后应该跳转到仪表盘"
      />
    </div>

    <!-- 实时日志列表 -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="store.liveRecords.length === 0 && !store.isRecording" class="p-6 text-center text-gray-400 text-sm">
        <p class="mb-1">暂无操作记录</p>
        <p class="text-xs">点击「开始录制」后在页面操作即可捕获</p>
      </div>
      <div v-else-if="store.liveRecords.length === 0 && store.isRecording" class="p-6 text-center text-gray-400 text-sm">
        <p>⏳ 录制中，等待页面操作...</p>
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
    <div v-if="analysisResult !== null" class="border-t max-h-[240px] overflow-y-auto">
      <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border-b sticky top-0">
        <span class="text-xs font-medium text-gray-600">AI 分析结果</span>
        <button
          class="text-xs text-gray-400 hover:text-gray-600"
          @click="analysisResult = null"
        >
          收起
        </button>
      </div>
      <div class="p-3">
        <MarkdownRenderer :content="analysisResult" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import StatusBar from '@/popup/components/StatusBar.vue'
import LogItem from '@/popup/components/LogItem.vue'
import MarkdownRenderer from '@/popup/components/MarkdownRenderer.vue'

const store = useAppStore()
const analysisResult = ref<string | null>(null)

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
  if (result.startsWith('请前往') || result.startsWith('暂无') || result.startsWith('AI 请求失败') || result.startsWith('网络连接失败')) {
    alert(result)
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
    if (tab.url && (tab.url.startsWith('http://localhost') || tab.url.startsWith('http://127.0.0.1'))) {
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
