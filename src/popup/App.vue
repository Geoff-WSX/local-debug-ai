<template>
  <div class="w-full h-full min-h-screen flex flex-col bg-white text-gray-800 overflow-hidden">
    <!-- Tab 导航 -->
    <div class="flex border-b bg-gray-50 shrink-0">
      <button
        v-for="(tab, idx) in tabs"
        :key="idx"
        class="flex-1 py-2.5 text-xs font-medium transition-colors relative"
        :class="store.activeTab === idx
          ? 'text-blue-600 bg-white'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'"
        @click="store.activeTab = idx"
      >
        {{ tab }}
        <span
          v-if="store.activeTab === idx"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
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
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import DebugRecord from './views/DebugRecord.vue'
import ProjectContext from './views/ProjectContext.vue'
import Settings from './views/Settings.vue'
import History from './views/History.vue'

const store = useAppStore()

const tabs = ['调试录制', '项目上下文', '设置中心', '历史记录']

onMounted(() => {
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
