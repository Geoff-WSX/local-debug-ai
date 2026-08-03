<template>
  <div class="p-4 space-y-4">
    <div class="text-sm font-medium text-tprimary mb-2">
      项目简介
      <span class="text-xs text-tdisabled font-normal ml-1">（填写项目概况，AI 将结合业务背景分析交互）</span>
    </div>

    <!-- 文件上传区 -->
    <div
      class="border border-dashed border-edge rounded-lg p-6 text-center cursor-pointer hover:border-accent transition-colors group"
      @click="triggerUpload"
      @dragover.prevent
      @drop.prevent="handleDrop"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".txt,.md"
        class="hidden"
        @change="handleFileSelect"
      />
      <p class="text-sm text-tsecondary flex items-center justify-center gap-2">
        <AppIcon name="doc" :size="16" class="text-tdisabled group-hover:text-accent transition-colors" />
        点击或拖拽上传 .txt / .md 项目描述
      </p>
    </div>

    <!-- 文本编辑区 -->
    <textarea
      v-model="content"
      class="w-full h-48 p-3 border border-edge rounded-lg text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 bg-base-panel text-tprimary placeholder:text-tdisabled"
      placeholder="在此填写项目简介：这个产品是做什么的、核心功能、关键交互流程…"
    />

    <!-- 操作按钮 -->
    <div class="flex gap-2">
      <button
        class="flex-1 py-2 bg-accent text-white rounded-lg text-sm hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        :disabled="!content.trim()"
        @click="handleSave"
      >
        <AppIcon name="check" :size="14" /> 保存简介
      </button>
      <button
        class="px-4 py-2 bg-base-hover text-tsecondary rounded-lg text-sm hover:bg-base-active transition-colors"
        @click="handleClear"
      >
        清空
      </button>
    </div>

    <!-- 当前内容预览 -->
    <div v-if="store.originSession.projectContext" class="mt-2">
      <div class="text-xs text-tsecondary mb-1">已保存的项目简介（{{ store.originSession.projectContext.length }} 字符）</div>
      <div class="text-xs text-tsecondary bg-base-hover rounded p-2 max-h-32 overflow-y-auto">
        {{ store.originSession.projectContext.slice(0, 500) }}{{ store.originSession.projectContext.length > 500 ? '...' : '' }}
      </div>
    </div>
    <div v-else class="text-xs text-warning mt-2">
      ⚠ 尚未填写项目简介，AI 分析将仅基于代码日志排查异常
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import AppIcon from '@/popup/components/AppIcon.vue'
import { showToast } from '@/popup/components/toastBus'

const store = useAppStore()
const content = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

onMounted(() => {
  content.value = store.originSession.projectContext || ''
})

function triggerUpload() {
  fileInput.value?.click()
}

function handleDrop(e: DragEvent) {
  const file = e.dataTransfer?.files[0]
  if (file) readFile(file)
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) readFile(file)
}

function readFile(file: File) {
  if (!file.name.endsWith('.txt') && !file.name.endsWith('.md')) {
    showToast('error', '仅支持 .txt 和 .md 文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    content.value = reader.result as string
  }
  reader.readAsText(file)
}

async function handleSave() {
  if (!content.value.trim()) return
  await store.saveProjectContext(content.value)
}

async function handleClear() {
  content.value = ''
  await store.clearProjectContext()
}
</script>
