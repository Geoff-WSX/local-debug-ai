<template>
  <div class="flex flex-col items-center justify-center py-10 px-6 text-center animate-fade-in">
    <div class="w-10 h-10 rounded-full bg-base-hover flex items-center justify-center mb-3">
      <AppIcon :name="icon" :size="20" class="text-tdisabled" />
    </div>
    <p class="text-sm text-tsecondary mb-1">{{ title }}</p>
    <p v-if="description" class="text-xs text-tdisabled max-w-[240px]">{{ description }}</p>
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