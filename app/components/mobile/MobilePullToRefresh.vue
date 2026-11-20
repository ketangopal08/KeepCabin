<script setup lang="ts">
// Native-style pull-to-refresh: drag down at the top of the page to reload.
const props = defineProps<{ onRefresh: () => Promise<unknown> }>()

const THRESHOLD = 72
const MAX = 110

const pull = ref(0)
const refreshing = ref(false)
const dragging = ref(false)
let startY: number | null = null

function onStart(e: TouchEvent) {
  if (refreshing.value || window.scrollY > 0) { startY = null; return }
  startY = e.touches[0]!.clientY
}
function onMove(e: TouchEvent) {
  if (startY === null) return
  const dy = e.touches[0]!.clientY - startY
  if (dy <= 0) { pull.value = 0; dragging.value = false; return }
  dragging.value = true
  // rubber-band resistance
  pull.value = Math.min(MAX, dy * 0.5)
}
async function onEnd() {
  dragging.value = false
  if (startY === null) return
  startY = null
  if (pull.value >= THRESHOLD) {
    refreshing.value = true
    pull.value = 56
    try { await props.onRefresh() } finally {
      refreshing.value = false
      pull.value = 0
    }
  } else {
    pull.value = 0
  }
}

const progress = computed(() => Math.min(1, pull.value / THRESHOLD))
</script>

<template>
  <div
    class="relative"
    @touchstart.passive="onStart"
    @touchmove.passive="onMove"
    @touchend="onEnd"
    @touchcancel="onEnd"
  >
    <!-- Indicator -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      :style="{ transform: `translateY(${pull - 44}px)`, opacity: progress, transition: dragging ? 'none' : 'transform 360ms cubic-bezier(.16,1,.3,1), opacity 200ms' }"
      aria-hidden="true"
    >
      <span class="flex size-9 items-center justify-center rounded-full border border-border bg-card shadow-md">
        <Icon
          name="solar:refresh-linear"
          class="size-4.5 text-foreground"
          :class="refreshing ? 'animate-spin' : ''"
          :style="refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }"
        />
      </span>
    </div>

    <!-- Content follows the finger -->
    <div
      :style="{ transform: pull ? `translateY(${pull}px)` : undefined, transition: dragging ? 'none' : 'transform 360ms cubic-bezier(.16,1,.3,1)' }"
    >
      <slot />
    </div>
  </div>
</template>
