<template>
  <button
    :class="[
      'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-all duration-150',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
      variantClass,
      sizeClass,
      disabledClass,
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
    <slot>{{ label }}</slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  variant?: 'primary' | 'success' | 'danger' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}>(), {
  label: '',
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
})

defineEmits<{ click: [e: MouseEvent] }>()

const variantClass = computed(() => {
  switch (props.variant) {
    case 'success':
      return 'bg-success text-base hover:bg-success/80'
    case 'danger':
      return 'bg-danger text-white hover:bg-danger/80'
    case 'ghost':
      return 'bg-transparent text-tsecondary hover:bg-base-hover hover:text-tprimary'
    case 'outline':
      return 'bg-transparent text-tprimary border border-edge hover:border-edge-strong hover:bg-base-hover'
    default:
      return 'bg-accent text-white hover:bg-accent-hover'
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm': return 'px-2.5 py-1.5 text-xs'
    case 'lg': return 'px-5 py-3 text-sm'
    default: return 'px-4 py-2 text-sm'
  }
})

const disabledClass = computed(() => {
  return props.disabled || props.loading
    ? 'opacity-40 cursor-not-allowed pointer-events-none'
    : 'cursor-pointer active:scale-[0.98]'
})
</script>
