<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div data-slot="table-container" class="relative w-full overflow-x-auto">
    <table data-slot="table" :class="cn('w-full caption-bottom text-sm', props.class)">
      <slot />
    </table>
    <div
      v-if="$slots.footer"
      data-slot="table-footer-bar"
      class="px-4 py-2.5 text-[13px] text-muted-foreground"
    >
      <slot name="footer" />
    </div>
  </div>
</template>
