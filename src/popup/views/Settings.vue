<template>
  <div class="p-4 space-y-5">
    <h2 class="text-sm font-bold text-tprimary">🔧 模型配置</h2>
    <p class="text-xs text-tsecondary -mt-2">配置多个模型，每次仅激活一个用于 AI 分析</p>

    <!-- 模型列表 -->
    <div class="space-y-2">
      <div
        v-for="model in models"
        :key="model.id"
        class="border rounded-lg p-3"
        :class="model.id === activeModelId ? 'border-accent bg-accent-soft' : 'border-edge'"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="w-3 h-3 rounded-full shrink-0"
              :class="model.id === activeModelId ? 'bg-success' : 'bg-edge'"
            />
            <span class="text-xs font-medium text-tprimary truncate">{{ model.name || '未命名模型' }}</span>
            <span
              v-if="model.id === activeModelId"
              class="text-[10px] px-1.5 py-0.5 bg-success-soft text-success rounded shrink-0"
            >
              当前激活
            </span>
          </div>
          <div class="flex gap-1 shrink-0">
            <button
              v-if="model.id !== activeModelId"
              class="text-[10px] px-2 py-1 bg-success text-white rounded hover:bg-success/80"
              @click="activateModel(model.id)"
            >
              激活
            </button>
            <button
              class="text-[10px] px-2 py-1 bg-base-hover text-tsecondary rounded hover:bg-base-active"
              @click="startEdit(model)"
            >
              编辑
            </button>
            <button
              class="text-[10px] px-2 py-1 bg-danger-soft text-danger rounded hover:bg-danger-soft"
              @click="removeModel(model.id)"
            >
              删除
            </button>
          </div>
        </div>
        <div class="text-[10px] text-tdisabled mt-1 truncate">
          {{ model.model }} · {{ model.baseUrl }}{{ model.apiPath }}
        </div>
      </div>

      <button
        class="w-full py-2 border-2 border-dashed border-edge rounded-lg text-xs text-tsecondary hover:border-accent hover:text-blue-500 transition-colors"
        @click="startAdd"
      >
        ＋ 添加模型
      </button>
    </div>

    <!-- 模型编辑表单 -->
    <div v-if="editing" class="border border-accent rounded-lg p-3 space-y-3 bg-base-panel">
      <h3 class="text-xs font-bold text-tprimary">{{ editing.id ? '编辑模型' : '添加模型' }}</h3>
      <div>
        <label class="text-xs text-tsecondary block mb-1">模型名称（自定义）</label>
        <input
          v-model="editing.name"
          class="w-full px-3 py-2 border border-edge rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="如：OpenAI GPT / DeepSeek"
        />
      </div>
      <div>
        <label class="text-xs text-tsecondary block mb-1">API 密钥</label>
        <input
          v-model="editing.apiKey"
          type="password"
          class="w-full px-3 py-2 border border-edge rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="sk-..."
        />
      </div>
      <div>
        <label class="text-xs text-tsecondary block mb-1">接口地址（Base URL）</label>
        <input
          v-model="editing.baseUrl"
          class="w-full px-3 py-2 border border-edge rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="https://api.openai.com/v1"
        />
      </div>
      <div>
        <label class="text-xs text-tsecondary block mb-1">API 格式</label>
        <select
          v-model="editing.apiPath"
          class="w-full px-3 py-2 border border-edge rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 bg-base-panel"
        >
          <option v-for="p in apiPathPresets" :key="p.path" :value="p.path">
            {{ p.label }} ({{ p.path }})
          </option>
        </select>
        <div class="text-[10px] text-tdisabled mt-1">
          完整请求地址: <code class="bg-base-panel px-1 rounded">{{ editFullUrl }}</code>
        </div>
      </div>
      <div>
        <label class="text-xs text-tsecondary block mb-1">模型名称</label>
        <input
          v-model="editing.model"
          class="w-full px-3 py-2 border border-edge rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-accent/50"
          placeholder="gpt-4o-mini"
        />
      </div>
      <div class="flex gap-2">
        <button
          class="flex-1 py-2 bg-accent-soft0 text-white rounded-lg text-sm hover:bg-accent-hover"
          @click="saveModel"
        >
          💾 保存模型
        </button>
        <button
          class="flex-1 py-2 bg-success text-white rounded-lg text-sm hover:bg-success/80 disabled:opacity-40"
          :disabled="!canTest"
          @click="handleTest"
        >
          {{ testing ? '⏳ 测试中...' : '🔗 测试连接' }}
        </button>
        <button
          class="px-3 py-2 bg-base-hover text-tsecondary rounded-lg text-sm hover:bg-base-active"
          @click="cancelEdit"
        >
          取消
        </button>
      </div>
      <div
        v-if="testResult"
        class="text-xs rounded-lg p-3"
        :class="testResult.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'"
      >
        {{ testResult.msg }}
      </div>
    </div>

    <hr class="border-edge" />

    <h2 class="text-sm font-bold text-tprimary">💾 数据备份</h2>
    <p class="text-xs text-tsecondary mb-2">导出配置和所有站点数据，重装后一键恢复</p>
    <div class="flex gap-2">
      <button
        class="flex-1 py-2 bg-base-active text-white rounded-lg text-sm hover:bg-edge-strong transition-colors"
        @click="handleExport"
      >
        📤 导出配置
      </button>
      <button
        class="flex-1 py-2 bg-base-active text-white rounded-lg text-sm hover:bg-edge-strong transition-colors"
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
      :class="importResult.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'"
    >
      {{ importResult.msg }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/useAppStore'
import {
  getGlobalConfig,
  addModel,
  updateModel,
  deleteModel,
  setActiveModel,
} from '@/utils/storage'
import { API_PATH_PRESETS, createDefaultModel } from '@/types'
import type { ModelConfig } from '@/types'
import { showToast } from '@/popup/components/toastBus'

const store = useAppStore()
const testing = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)
const importResult = ref<{ ok: boolean; msg: string } | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const apiPathPresets = API_PATH_PRESETS

const models = ref<ModelConfig[]>([])
const activeModelId = ref('')
const editing = ref<ModelConfig | null>(null)

const editFullUrl = computed(() => {
  if (!editing.value) return ''
  const base = editing.value.baseUrl.replace(/\/+$/, '')
  const path = editing.value.apiPath.startsWith('/') ? editing.value.apiPath : `/${editing.value.apiPath}`
  return `${base}${path}`
})

const canTest = computed(() => {
  return !!editing.value?.apiKey && !testing.value
})

async function loadSettings() {
  const global = await getGlobalConfig()
  models.value = global.models
  activeModelId.value = global.activeModelId
}

// 监听站点切换
watch(() => store.currentOrigin, () => {
  loadSettings()
})

onMounted(loadSettings)

function startAdd() {
  editing.value = createDefaultModel()
  testResult.value = null
}

function startEdit(model: ModelConfig) {
  editing.value = { ...model }
  testResult.value = null
}

function cancelEdit() {
  editing.value = null
  testResult.value = null
}

async function saveModel() {
  if (!editing.value) return
  if (!editing.value.name) {
    showToast('error', '请输入模型名称')
    return
  }
  if (!editing.value.apiKey) {
    showToast('error', '请输入 API 密钥')
    return
  }

  if (editing.value.id && models.value.some((m) => m.id === editing.value!.id)) {
    // 编辑已有模型
    await updateModel(editing.value.id, { ...editing.value })
  } else {
    // 新增模型
    const { id, ...rest } = editing.value
    await addModel(rest)
  }
  editing.value = null
  await loadSettings()
  showToast('success', '模型已保存')
}

async function activateModel(id: string) {
  await setActiveModel(id)
  await loadSettings()
}

async function removeModel(id: string) {
  if (!confirm('确认删除该模型？')) return
  await deleteModel(id)
  await loadSettings()
}

async function handleTest() {
  if (!editing.value) return
  testing.value = true
  testResult.value = null

  const apiKey = editing.value.apiKey
  const url = editFullUrl.value

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: editing.value.model,
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
