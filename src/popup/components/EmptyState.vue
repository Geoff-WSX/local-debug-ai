<template>
  <div class="flex flex-col items-center justify-center py-10 px-6 text-center animate-fade-in">
    <div class="text-3xl mb-3 opacity-80">{{ icon }}</div>
    <p class="text-sm text-tsecondary mb-1">{{ title }}</p>
    <p v-if="description" class="text-xs text-tdisabled">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
}>(), {
  icon: '📭',
  description: '',
})
</script>
