<template>
  <div class="w-full h-full min-h-screen flex flex-col bg-base text-tprimary overflow-hidden">
    <!-- 品牌栏 -->
    <div class="flex items-center gap-2.5 px-3 py-2.5 bg-base-panel border-b border-edge-faint shadow-edge-top shrink-0">
      <div class="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-accent to-violet-500/70 shadow-md">
        <img src="/icons/icon48.png" alt="logo" class="w-4 h-4 rounded-sm" />
      </div>
      <span class="text-xs font-bold tracking-wide text-tprimary">UDA</span>
      <span
        class="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
        :class="store.isRecording ? 'bg-danger-soft text-danger' : 'bg-base-hover text-tdisabled'"
      >
        <span
          class="w-1.5 h-1.5 rounded-full"
          :class="store.isRecording ? 'bg-danger animate-pulse-rec' : 'bg-tdisabled'"
        />
        {{ store.isRecording ? '录制中' : '待机' }}
      </span>
    </div>

    <!-- Tab 导航 -->
    <div class="flex gap-1 px-2 py-1.5 bg-base-panel border-b border-edge shrink-0">
      <button
        v-for="(tab, idx) in tabs"
        :key="idx"
        class="flex-1 py-2 rounded-md text-xs font-medium tracking-wide transition-all duration-200 relative flex items-center justify-center gap-1.5"
        :class="store.activeTab === idx
          ? 'text-accent bg-base-hover shadow-card'
          : 'text-tsecondary hover:text-tprimary hover:bg-base-hover/50'"
        @click="store.activeTab = idx"
      >
        <AppIcon :name="tab.icon" :size="14" :class="store.activeTab === idx ? '' : 'text-tdisabled'" />
        {{ tab.label }}
        <span
          v-if="store.activeTab === idx"
          class="absolute -bottom-1.5 left-3 right-3 h-0.5 bg-accent rounded-full transition-all duration-200"
        />
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="flex-1 overflow-hidden">
      <DebugRecord v-show="store.activeTab === 0" />
      <ProjectContext v-show="store.activeTab === 1" />
      <Settings v-show="store.activeTab === 2" />
      <History v-show="store.activeTab === 3" />
    </div>

    <!-- Toast -->
    <Toast ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import DebugRecord from './views/DebugRecord.vue'
import ProjectContext from './views/ProjectContext.vue'
import Settings from './views/Settings.vue'
import History from './views/History.vue'
import Toast from './components/Toast.vue'
import { setToastInstance } from './components/toastBus'
import AppIcon from './components/AppIcon.vue'

const store = useAppStore()
const toastRef = ref<InstanceType<typeof Toast> | null>(null)

const tabs = [
  { label: '调试录制', icon: 'mic' },
  { label: '项目简介', icon: 'doc' },
  { label: '设置中心', icon: 'gear' },
  { label: '历史记录', icon: 'history' },
]

onMounted(() => {
  // 注册 Toast 全局单例（供 alert 替换等使用）
  setToastInstance(toastRef.value)

  // 加载当前站点数据（不清空录制内容，让用户看到之前的录制结果）
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0]
    if (tab.url) {
      try {
        const origin = new URL(tab.url).host
        await store.loadOriginData(origin)
        await store.restoreRecordingState(origin)
      } catch {
        // URL 解析失败，可能是 chrome:// 页面
      }
    }
  })

  // 监听消息：录制事件更新、站点切换
  chrome.runtime.onMessage.addListener((msg: any) => {
    if (msg.type === 'TAB_CHANGED' && msg.origin !== store.currentOrigin) {
      store.loadOriginData(msg.origin)
    } else if (msg.type === 'RECORDING_CHANGED' && msg.origin === store.currentOrigin) {
      // 有新的录制事件到达，刷新 liveRecords
      store.loadOriginData(store.currentOrigin)
    }
  })
})
</script>
