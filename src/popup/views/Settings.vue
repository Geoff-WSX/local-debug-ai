<template>
  <div class="p-4 space-y-5">
    <h2 class="text-sm font-bold text-gray-800">🔧 全局配置</h2>

    <!-- 全局 API Key -->
    <div>
      <label class="text-xs font-medium text-gray-600 block mb-1">API 密钥（全局默认）</label>
      <input
        v-model="form.globalApiKey"
        type="password"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="sk-..."
      />
    </div>

    <!-- Base URL -->
    <div>
      <label class="text-xs font-medium text-gray-600 block mb-1">接口地址（Base URL）</label>
      <input
        v-model="form.baseUrl"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="https://api.openai.com/v1"
      />
    </div>

    <!-- API 端点路径格式 -->
    <div>
      <label class="text-xs font-medium text-gray-600 block mb-1">API 格式</label>
      <select
        v-model="form.apiPath"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        <option v-for="p in apiPathPresets" :key="p.path" :value="p.path">
          {{ p.label }} ({{ p.path }})
        </option>
      </select>
      <div class="text-[10px] text-gray-400 mt-1">
        完整请求地址: <code class="bg-gray-100 px-1 rounded">{{ fullUrl }}</code>
      </div>
    </div>

    <!-- 模型名称 -->
    <div>
      <label class="text-xs font-medium text-gray-600 block mb-1">模型名称</label>
      <input
        v-model="form.defaultModel"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="gpt-4o-mini"
      />
    </div>

    <hr class="border-gray-200" />

    <h2 class="text-sm font-bold text-gray-800">📌 当前站点配置</h2>

    <!-- 站点独立 API Key -->
    <div>
      <label class="text-xs font-medium text-gray-600 block mb-1">
        站点独立密钥
        <span class="text-gray-400 font-normal">（留空则使用全局密钥）</span>
      </label>
      <input
        v-model="form.siteApiKey"
        type="password"
        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
        placeholder="可选：当前站点专属密钥"
      />
    </div>

    <!-- 操作按钮 -->
    <div class="flex gap-2">
      <button
        class="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors"
        @click="handleSave"
      >
        💾 保存配置
      </button>
      <button
        class="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors disabled:opacity-40"
        :disabled="!canTest"
        @click="handleTest"
      >
        {{ testing ? '⏳ 测试中...' : '🔗 连通性测试' }}
      </button>
    </div>

    <!-- 测试结果 -->
    <div
      v-if="testResult"
      class="text-xs rounded-lg p-3"
      :class="testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
    >
      {{ testResult.msg }}
    </div>

    <hr class="border-gray-200" />

    <h2 class="text-sm font-bold text-gray-800">💾 数据备份</h2>
    <p class="text-xs text-gray-500 mb-2">导出配置和所有站点数据，重装后一键恢复</p>
    <div class="flex gap-2">
      <button
        class="flex-1 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
        @click="handleExport"
      >
        📤 导出配置
      </button>
      <button
        class="flex-1 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 transition-colors"
        @click="triggerImport"
      >
        📥 导入配置
      </button>
      <input
        ref="importInput"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleImport"
      />
    </div>
    <div
      v-if="importResult"
      class="text-xs rounded-lg p-3 mt-2"
      :class="importResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'"
    >
      {{ importResult.msg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import { getGlobalConfig, setGlobalConfig, getOriginSession, setOriginSession } from '@/utils/storage'
import { API_PATH_PRESETS } from '@/types'

const store = useAppStore()
const testing = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)
const importResult = ref<{ ok: boolean; msg: string } | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const apiPathPresets = API_PATH_PRESETS

const form = reactive({
  globalApiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  apiPath: '/chat/completions',
  defaultModel: 'gpt-4o-mini',
  siteApiKey: '',
})

const fullUrl = computed(() => {
  const base = form.baseUrl.replace(/\/+$/, '')
  const path = form.apiPath.startsWith('/') ? form.apiPath : `/${form.apiPath}`
  return `${base}${path}`
})

const canTest = computed(() => {
  const key = form.siteApiKey || form.globalApiKey
  return !!key && !testing.value
})

async function loadSettings() {
  const global = await getGlobalConfig()
  form.globalApiKey = global.globalApiKey
  form.baseUrl = global.baseUrl
  form.apiPath = global.apiPath || '/chat/completions'
  form.defaultModel = global.defaultModel

  if (store.currentOrigin) {
    const session = await getOriginSession(store.currentOrigin)
    form.siteApiKey = session.apiKey
  }
}

// 监听站点切换
watch(() => store.currentOrigin, () => {
  loadSettings()
})

onMounted(loadSettings)

async function handleSave() {
  await setGlobalConfig({
    globalApiKey: form.globalApiKey,
    baseUrl: form.baseUrl,
    apiPath: form.apiPath,
    defaultModel: form.defaultModel,
  })
  if (store.currentOrigin) {
    await setOriginSession(store.currentOrigin, { apiKey: form.siteApiKey })
  }
  alert('配置已保存')
}

async function handleTest() {
  testing.value = true
  testResult.value = null

  const apiKey = form.siteApiKey || form.globalApiKey

  try {
    const res = await fetch(fullUrl.value, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: form.defaultModel,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    })

    if (res.ok) {
      testResult.value = { ok: true, msg: '✅ 连接成功！API 密钥有效' }
    } else {
      const err = await res.text()
      testResult.value = { ok: false, msg: `❌ 请求失败 (${res.status}): ${err.slice(0, 200)}` }
    }
  } catch (err: any) {
    testResult.value = { ok: false, msg: `❌ 网络错误: ${err.message}` }
  } finally {
    testing.value = false
  }
}

async function handleExport() {
  const data = await chrome.storage.local.get(null)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AI调试助手配置_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function triggerImport() {
  importInput.value?.click()
}

async function handleImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    await chrome.storage.local.clear()
    await chrome.storage.local.set(data)
    importResult.value = { ok: true, msg: '✅ 配置已恢复，请重新打开插件查看' }
    // 重新加载当前页面数据
    await loadSettings()
    if (store.currentOrigin) {
      await store.loadOriginData(store.currentOrigin)
    }
  } catch (err: any) {
    importResult.value = { ok: false, msg: `❌ 导入失败: ${err.message}` }
  }

  input.value = '' // 重置文件选择
}
</script>
