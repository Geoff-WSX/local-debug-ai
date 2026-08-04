<template>
  <div class="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in">
    <div class="w-12 h-12 rounded-2xl bg-surface-raised border border-edge flex items-center justify-center mb-3 shadow-card">
      <AppIcon :name="icon" :size="22" class="text-tdisabled" />
    </div>
    <p class="text-sm font-medium text-tprimary mb-1.5">{{ title }}</p>
    <p v-if="description" class="text-xs text-tdisabled max-w-[240px] leading-relaxed">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
}>(), {
  icon: 'mic',
  description: '',
})
</script>