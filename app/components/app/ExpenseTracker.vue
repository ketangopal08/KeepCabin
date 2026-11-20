<script setup lang="ts">
import { trackerSteps } from '~/utils/expenseStatus'

const props = defineProps<{
  expense: {
    status: string
    action_log: { action: string; actor_name: string; timestamp: string; note?: string }[]
    payout_date?: string | null
    utr_number?: string | null
    rejection_reason?: string | null
    submitter_name?: string | null
    submitter_email?: string | null
  }
}>()

const steps = computed(() => trackerSteps(props.expense))

// Flow-card styling (pill colours follow the reference: purple · green · cyan)
const PILL: Record<string, { cls: string; icon: string }> = {
  submitted: { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', icon: 'solar:bolt-bold' },
  manager:   { cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300',       icon: 'solar:user-check-linear' },
  finance:   { cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',       icon: 'solar:wallet-money-linear' },
  scheduled: { cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', icon: 'solar:calendar-linear' },
  paid:      { cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300',       icon: 'solar:check-circle-linear' },
}
const PILL_REJECTED = 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
const PILL_UPCOMING = 'bg-muted text-muted-foreground'
const pillCls = (key: string) => PILL[key]?.cls ?? PILL_UPCOMING
const pillIcon = (key: string) => PILL[key]?.icon ?? 'solar:bolt-bold'
const nextUpcoming = (i: number) => steps.value[i + 1]?.state === 'upcoming'

// Sentence + chip for each step, by state
function sentence(s: ReturnType<typeof trackerSteps>[number]): { text: string; chip: string | null; after?: string } {
  const who = props.expense.submitter_name ?? props.expense.submitter_email ?? null
  if (s.state === 'rejected') return { text: 'Rejected', chip: null }
  if (s.state === 'upcoming') {
    return {
      submitted: { text: 'Expense submitted', chip: null },
      manager:   { text: 'Manager will review', chip: null },
      finance:   { text: 'Finance will review', chip: null },
      scheduled: { text: 'Added to the next payout', chip: null },
      paid:      { text: 'Paid to the employee', chip: null },
    }[s.key]
  }
  if (s.state === 'current') {
    return {
      submitted: { text: 'Submitting', chip: null },
      manager:   { text: 'Waiting for', chip: 'manager', after: 'approval' },
      finance:   { text: 'Waiting for', chip: 'finance', after: 'approval' },
      scheduled: { text: 'Payout scheduled for', chip: s.detail?.replace(/^Pays on /, '') ?? null },
      paid:      { text: 'Waiting for', chip: 'payment' },
    }[s.key]
  }
  // done
  const when = s.detail?.split(' · ').pop() ?? null
  return {
    submitted: { text: who ? `Submitted by ${who} on` : 'Submitted on', chip: when },
    manager:   { text: 'Approved by manager on', chip: when },
    finance:   { text: 'Approved by finance on', chip: when },
    scheduled: { text: 'Scheduled for payout', chip: s.detail?.replace(/^Pays on /, '') ?? null },
    paid:      { text: 'Paid with UTR', chip: s.detail?.replace(/^UTR /, '') ?? null },
  }[s.key]
}
</script>

<template>
  <ol class="flex w-full max-w-[480px] flex-col items-center">
    <li
      v-for="(s, i) in steps"
      :key="s.key"
      class="flex w-full flex-col items-center"
      :aria-current="s.state === 'current' ? 'step' : undefined"
    >
      <!-- Step pill -->
      <span
        class="mb-1 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium"
        :class="s.state === 'rejected' ? PILL_REJECTED : s.state === 'upcoming' ? PILL_UPCOMING : pillCls(s.key)"
      >
        <Icon :name="s.state === 'rejected' ? 'solar:close-circle-linear' : pillIcon(s.key)" class="size-3" />
        {{ s.title }}
        <span class="sr-only">({{ s.state }})</span>
      </span>

      <!-- Step card -->
      <div
        class="w-fit max-w-full rounded-xl border bg-card px-3.5 py-2 text-center shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-colors"
        :class="[
          s.state === 'current' ? 'border-foreground/25 ring-2 ring-foreground/5' : 'border-border',
          s.state === 'upcoming' ? 'border-dashed opacity-60 shadow-none' : '',
          s.state === 'rejected' ? 'border-red-500/30' : '',
        ]"
      >
        <p class="flex flex-wrap items-center justify-center gap-1.5 text-[13px] leading-6 text-foreground">
          <span>{{ sentence(s).text }}</span>
          <span
            v-if="sentence(s).chip"
            class="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-1.5 text-[12px] leading-5 text-foreground"
          >
            <Icon name="solar:hashtag-linear" class="size-3 text-muted-foreground" />{{ sentence(s).chip }}
          </span>
          <span v-if="sentence(s).after">{{ sentence(s).after }}</span>
        </p>
        <template v-if="s.state === 'rejected' && s.detail">
          <div class="-mx-3.5 my-2 border-t border-border" />
          <p class="text-[12px] text-muted-foreground">{{ s.detail }}</p>
        </template>
      </div>

      <!-- Connector: dot · line · arrow -->
      <div v-if="i < steps.length - 1" class="flex flex-col items-center py-1" aria-hidden="true">
        <span class="size-1.5 rounded-full bg-muted-foreground/70" />
        <span class="w-px" :class="nextUpcoming(i) ? 'h-5 border-l border-dashed border-muted-foreground/40' : 'h-5 bg-muted-foreground/70'" />
        <span class="size-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-muted-foreground/70" />
      </div>
    </li>
  </ol>
</template>
