<script setup lang="ts">

withDefaults(defineProps<{ placeholder?: string }>(), {
  placeholder: 'Start typing to search',
})

const model = defineModel<string>({ default: '' })
</script>

<template>
  <div class="relative flex-1">
    <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      v-model="model"
      :placeholder="placeholder"
      class="h-9 rounded-lg bg-transparent pl-9 text-sm dark:bg-transparent"
    />
  </div>
</template>
