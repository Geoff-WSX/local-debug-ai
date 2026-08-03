<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="viewBox"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    :class="['shrink-0', className]"
    :aria-hidden="true"
  >
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      :stroke="stroke"
      :fill="fill"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  size?: number
  className?: string
}>(), {
  size: 16,
  className: '',
})

interface IconDef {
  viewBox: string
  paths: string[]
  fill?: string
}

// 统一 1.5px 描边的线性图标库（stroke-based）
const icons: Record<string, IconDef> = {
  record: {  // 录制圆点
    viewBox: '0 0 24 24',
    paths: [
      'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0',
    ],
  },
  stop: {  // 停止方块
    viewBox: '0 0 24 24',
    paths: ['M8 8h8v8H8z'],
  },
  analyze: {  // 魔杖/分析
    viewBox: '0 0 24 24',
    paths: [
      'M15 4V2M15 16V14M8 9H6M24 9H22M17.8 11.8L19 13M12.2 6.2L11 5M4 21L19 6',
    ],
  },
  mic: {  // 调试
    viewBox: '0 0 24 24',
    paths: [
      'M9 18v-5a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0z',
      'M6 11a6 6 0 0 0 12 0',
      'M8 21h8',
    ],
  },
  doc: {  // 文档
    viewBox: '0 0 24 24',
    paths: [
      'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
      'M14 2v6h6',
    ],
  },
  gear: {  // 设置
    viewBox: '0 0 24 24',
    paths: [
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
      'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    ],
  },
  history: {  // 历史
    viewBox: '0 0 24 24',
    paths: [
      'M3 12a9 9 0 1 0 3-6.7L3 8',
      'M3 3v5h5',
      'M12 7v5l3 3',
    ],
  },
  export: {  // 导出
    viewBox: '0 0 24 24',
    paths: [
      'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
      'M7 10l5 5 5-5',
      'M12 15V3',
    ],
  },
  trash: {  // 删除
    viewBox: '0 0 24 24',
    paths: [
      'M3 6h18',
      'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
      'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
      'M10 11v6M14 11v6',
    ],
  },
  plus: {  // 添加
    viewBox: '0 0 24 24',
    paths: ['M12 5v14M5 12h14'],
  },
  close: {  // 关闭
    viewBox: '0 0 24 24',
    paths: ['M18 6L6 18M6 6l12 12'],
  },
  check: {  // 成功
    viewBox: '0 0 24 24',
    paths: ['M20 6L9 17l-5-5'],
  },
  chevron: {  // 箭头（展开）
    viewBox: '0 0 24 24',
    paths: ['M6 9l6 6 6-6'],
  },
  target: {  // 预期效果
    viewBox: '0 0 24 24',
    paths: [
      'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
      'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
      'M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
    ],
  },
  list: {  // 列表
    viewBox: '0 0 24 24',
    paths: [
      'M8 6h13M8 12h13M8 18h13',
      'M3 6h.01M3 12h.01M3 18h.01',
    ],
  },
}

const strokeFill = (name: string) => {
  // 实心图标（record/stop）
  if (name === 'record' || name === 'stop') return 'fill'
  return 'stroke'
}

const selected = computed(() => icons[props.name] || icons.doc)

const viewBox = computed(() => selected.value.viewBox)
const paths = computed(() => selected.value.paths)
const fill = computed(() => strokeFill(props.name) === 'fill' ? 'currentColor' : 'none')
const stroke = computed(() => strokeFill(props.name) === 'stroke' ? 'currentColor' : 'none')
const strokeWidth = computed(() => strokeFill(props.name) === 'fill' ? 0.5 : 1.6)
</script>
