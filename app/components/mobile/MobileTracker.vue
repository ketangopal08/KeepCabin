<script setup lang="ts">
import { trackerSteps } from '~/utils/expenseStatus'

// Compact 3-node tracker: Submitted → Approved (manager + finance) → Paid.
const props = defineProps<{
  expense: {
    status: string
    action_log: { action: string; actor_name: string; timestamp: string; note?: string }[]
    payout_date?: string | null
    utr_number?: string | null
    rejection_reason?: string | null
  }
}>()

type NodeState = 'done' | 'current' | 'upcoming' | 'rejected'

function timeOf(action: string) {
  const e = props.expense.action_log?.find(x => x.action === action)
  return e ? new Date(e.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase() : null
}

const nodes = computed(() => {
  const s = trackerSteps(props.expense)
  const by = Object.fromEntries(s.map(x => [x.key, x.state])) as Record<string, NodeState>

  const approved: NodeState =
    by.manager === 'rejected' || by.finance === 'rejected' ? 'rejected'
      : by.finance === 'done' ? 'done'
        : by.manager === 'current' || by.finance === 'current' ? 'current'
          : 'upcoming'
  const paid: NodeState = by.paid === 'done' ? 'done' : by.scheduled === 'current' ? 'current' : 'upcoming'

  return [
    { key: 'submitted', label: 'Submitted', state: 'done' as NodeState, time: timeOf('submitted') },
    { key: 'approved',  label: approved === 'rejected' ? 'Rejected' : 'Approved', state: approved, time: timeOf('finance_approved') ?? timeOf('rejected') },
    { key: 'paid',      label: 'Paid', state: paid, time: timeOf('paid') },
  ]
})

// Fill of the line between node i and i+1
function lineFilled(i: number) {
  const next = nodes.value[i + 1]
  return next && next.state !== 'upcoming'
}

// Animate the line fill in after mount
const shown = ref(false)
onMounted(() => requestAnimationFrame(() => { shown.value = true }))
</script>

<template>
  <div>
    <div class="flex items-center">
      <template v-for="(n, i) in nodes" :key="n.key">
        <span
          class="m-node relative flex size-6 shrink-0 items-center justify-center rounded-full border-2"
          :style="{ '--d': `${i * 260}ms` }"
          :class="{
            'border-foreground bg-foreground text-background': n.state === 'done',
            'border-foreground bg-background text-foreground': n.state === 'current',
            'border-muted-foreground/30 bg-muted-foreground/30': n.state === 'upcoming',
            'border-red-500 bg-red-500 text-white': n.state === 'rejected',
          }"
        >
          <span v-if="n.state === 'current'" class="absolute -inset-1 animate-ping rounded-full bg-foreground/15" />
          <Icon v-if="n.state === 'done' || n.state === 'current'" name="solar:check-read-linear" class="relative size-3.5" />
          <Icon v-else-if="n.state === 'rejected'" name="solar:close-circle-linear" class="size-3.5" />
        </span>
        <span v-if="i < nodes.length - 1" class="relative h-1 flex-1 overflow-hidden bg-muted-foreground/20">
          <span
            v-if="lineFilled(i)"
            class="absolute inset-0 origin-left bg-foreground transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)]"
            :class="shown ? 'scale-x-100' : 'scale-x-0'"
            :style="{ transitionDelay: `${120 + i * 260}ms` }"
          />
        </span>
      </template>
    </div>
    <div class="mt-2 grid grid-cols-3">
      <div
        v-for="(n, i) in nodes"
        :key="n.key"
        :class="i === 0 ? 'text-left' : i === nodes.length - 1 ? 'text-right' : 'text-center'"
      >
        <p class="text-[12px] font-medium" :class="n.state === 'rejected' ? 'text-red-500' : 'text-foreground'">{{ n.label }}</p>
        <p v-if="n.time && n.state !== 'upcoming'" class="text-[10.5px] text-muted-foreground">{{ n.time }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes node-pop {
  0%   { transform: scale(.4); opacity: 0; }
  70%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); }
}
.m-node { animation: node-pop 420ms cubic-bezier(.16, 1, .3, 1) both; animation-delay: var(--d, 0ms); }
</style>
