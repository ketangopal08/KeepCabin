<script setup lang="ts">

defineProps<{
  title: string
  description?: string
  back?: { label: string; to: string }
}>()
</script>

<template>
  <div class="mb-7">
    <NuxtLink
      v-if="back"
      :to="back.to"
      class="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <Icon name="solar:arrow-left-linear" class="size-4" /> {{ back.label }}
    </NuxtLink>
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <slot name="leading" />
        <div class="min-w-0">
          <h1 class="truncate text-xl font-medium tracking-tight text-foreground">{{ title }}</h1>
          <p v-if="description || $slots.description" class="mt-1 text-sm text-muted-foreground">
            <slot name="description">{{ description }}</slot>
          </p>
        </div>
      </div>
      <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
