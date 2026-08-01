<template>
  <div class="markdown-body text-xs leading-relaxed">
    <div v-for="(block, i) in blocks" :key="i" class="mb-2">
      <!-- 代码块 -->
      <div v-if="block.type === 'code'" class="relative group">
        <pre class="bg-base-active text-tprimary rounded-lg p-3 overflow-x-auto text-xs"><code>{{ block.content }}</code></pre>
        <button
          class="absolute top-2 right-2 px-2 py-1 text-[10px] bg-base-active text-tsecondary rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-edge"
          @click="copyCode(block.content)"
        >
          {{ block.copied ? '已复制' : '复制' }}
        </button>
      </div>
      <!-- 标题 -->
      <h1 v-else-if="block.type === 'h1'" class="text-sm font-bold text-tprimary mt-3 mb-1">{{ block.content }}</h1>
      <h2 v-else-if="block.type === 'h2'" class="text-sm font-semibold text-tprimary mt-2 mb-1">{{ block.content }}</h2>
      <h3 v-else-if="block.type === 'h3'" class="text-xs font-semibold text-tprimary mt-2 mb-1">{{ block.content }}</h3>
      <!-- 列表项 -->
      <div v-else-if="block.type === 'li'" class="flex gap-1.5 pl-3">
        <span class="text-tdisabled shrink-0">•</span>
        <span>{{ block.content }}</span>
      </div>
      <!-- 普通段落 -->
      <p v-else class="text-tsecondary">{{ block.content }}</p>
    </div>
    <div v-if="!blocks.length" class="text-tdisabled italic">
      暂无分析结果
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  content: string
}>()

interface Block {
  type: string
  content: string
  copied?: boolean
}

const copiedIndex = ref<number | null>(null)

function parseMarkdown(text: string): Block[] {
  if (!text) return []

  const lines = text.split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // 代码块（``` 包裹）
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      blocks.push({ type: 'code', content: codeLines.join('\n') })
      i++ // skip closing ```
      continue
    }

    // 标题
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4) })
      i++
      continue
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3) })
      i++
      continue
    }
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.slice(2) })
      i++
      continue
    }

    // 列表项
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      blocks.push({ type: 'li', content: line.trim().slice(2) })
      i++
      continue
    }

    // 空行跳过
    if (line.trim() === '') {
      i++
      continue
    }

    // 普通段落
    blocks.push({ type: 'p', content: line })
    i++
  }

  return blocks
}

const blocks = computed(() => parseMarkdown(props.content))

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copiedIndex.value = Date.now()
    setTimeout(() => { copiedIndex.value = null }, 2000)
  } catch {
    // fallback
    const ta = document.createElement('textarea')
    ta.value = code
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}
</script>
