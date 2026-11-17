<script setup lang="ts">
// Underline tabs (ElevenLabs style). Right-side slot for extra controls.
defineProps<{
  tabs: { id: string; label: string; count?: number }[]
}>()

const model = defineModel<string>({ required: true })
</script>

<template>
  <div class="mb-5 flex items-center justify-between gap-4 border-b border-border">
    <div class="-mb-px flex items-center gap-5 overflow-x-auto">
      <Button
        v-for="tab in tabs"
        :key="tab.id"
        variant="ghost"
        class="h-10 shrink-0 gap-1.5 rounded-none border-0 border-b-2 px-0 text-sm font-medium hover:bg-transparent dark:hover:bg-transparent"
        :class="model === tab.id
          ? 'border-foreground text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="model = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.count !== undefined" class="text-xs tabular-nums text-muted-foreground">{{ tab.count }}</span>
      </Button>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-1 pb-1.5">
      <slot />
    </div>
  </div>
</template>
