<script setup lang="ts">
// Standard header for /m sub-screens: round back button, centered title, optional right action.
const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  /** Where back goes when there is no history (e.g. opened from a link). */
  back?: string | false
}>(), { back: '/m' })

const router = useRouter()
function goBack() {
  if (window.history.state?.back) router.back()
  else if (props.back) router.push(props.back)
}
</script>

<template>
  <header class="m-rise mb-5 flex items-center gap-3">
    <Button
      v-if="back !== false"
      variant="secondary"
      size="icon-lg"
      class="m-press shrink-0 rounded-full"
      aria-label="Back"
      @click="goBack"
    >
      <Icon name="solar:arrow-left-linear" class="size-5" />
    </Button>
    <div class="min-w-0 flex-1" :class="back !== false ? 'text-center' : ''">
      <h1 class="truncate text-[17px] font-semibold tracking-tight text-foreground">{{ title }}</h1>
      <p v-if="subtitle" class="truncate text-[12px] text-muted-foreground">{{ subtitle }}</p>
    </div>
    <div class="flex min-w-11 shrink-0 justify-end">
      <slot name="action" />
    </div>
  </header>
</template>
