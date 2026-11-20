<script setup lang="ts">
import { CheckIcon, XIcon } from '@lucide/vue'
import { trackerSteps } from '~/utils/expenseStatus'

const props = defineProps<{
  expense: {
    status: string
    action_log: { action: string; actor_name: string; timestamp: string; note?: string }[]
    payout_date?: string | null
    utr_number?: string | null
    rejection_reason?: string | null
  }
}>()
const steps = computed(() => trackerSteps(props.expense))
</script>

<template>
  <ol class="flex flex-col">
    <li v-for="(s, i) in steps" :key="s.key" class="flex gap-3" :aria-current="s.state === 'current' ? 'step' : undefined">
      <div class="flex flex-col items-center">
        <span
          class="flex size-6 shrink-0 items-center justify-center rounded-full"
          :class="{
            'bg-primary text-primary-foreground': s.state === 'done',
            'border-2 border-primary bg-background': s.state === 'current',
            'bg-red-500/10 text-red-600 dark:text-red-400': s.state === 'rejected',
            'bg-muted text-muted-foreground': s.state === 'upcoming',
          }"
        >
          <CheckIcon v-if="s.state === 'done'" class="size-3.5" />
          <XIcon v-else-if="s.state === 'rejected'" class="size-3.5" />
          <span v-else-if="s.state === 'current'" class="size-2 rounded-full bg-primary" />
        </span>
        <span v-if="i < steps.length - 1" class="my-1 w-px flex-1 bg-border" />
      </div>
      <div class="pb-4">
        <div class="text-sm font-medium" :class="s.state === 'upcoming' ? 'text-muted-foreground' : 'text-foreground'">{{ s.title }}<span class="sr-only"> ({{ s.state }})</span></div>
        <div v-if="s.detail" class="text-xs text-muted-foreground">{{ s.detail }}</div>
      </div>
    </li>
  </ol>
</template>
