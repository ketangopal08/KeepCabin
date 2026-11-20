<!-- Review card for an expense awaiting approval (mobile Approvals + Payments review list).
     Card body links to the expense; Approve / Reject are emitted to the page. -->
<script setup lang="ts">
import type { Expense } from '~~/lib/supabase'
import { personColor, personInitials } from '~/utils/avatarColors'

const props = defineProps<{
  expense: Expense
  approving?: boolean
  rejecting?: boolean
  /** Optional team name row (Payments review shows the team). */
  team?: string
}>()
const emit = defineEmits<{ approve: []; reject: [] }>()

const e = computed(() => props.expense)

function catColor(cat: string) {
  const p = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % p.length
  return p[h]
}

// Brand logo that fails to load falls back to initials
const logoFailed = ref(false)
const logo = computed(() => (logoFailed.value ? null : brandLogoUrl(e.value.vendor)))

function initials(name: string) {
  return (name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function expCode(x: Expense) {
  return `EXP-${x.id.replace(/-/g, '').slice(0, 3).toUpperCase()}-${x.id.replace(/-/g, '').slice(-3).toUpperCase()}`
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}
</script>

<template>
  <Card class="gap-0 rounded-3xl border-0 bg-muted/60 p-0 shadow-none ring-0">
    <NuxtLink :to="`/m/expenses/${e.id}`" class="m-press block p-4 pb-3" @click="haptic">
      <!-- Vendor + amount -->
      <div class="flex items-center gap-3">
        <div v-if="logo" class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
          <img :src="logo" :alt="e.vendor ?? ''" class="size-6 object-contain" loading="lazy" @error="logoFailed = true">
        </div>
        <div
          v-else
          class="flex size-11 shrink-0 items-center justify-center rounded-2xl text-[12px] font-bold text-white"
          :style="{ background: catColor(e.category) }"
        >
          {{ initials(e.vendor ?? e.category) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[15px] font-semibold text-foreground">{{ e.vendor ?? 'Expense' }}</p>
          <p class="truncate text-[12px] text-muted-foreground">
            {{ e.description || expCode(e) }}
          </p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-[17px] font-semibold tabular-nums text-foreground">₹{{ Number(e.amount).toLocaleString('en-IN') }}</p>
          <p class="text-[10.5px] text-muted-foreground">{{ fmtDate(e.expense_date ?? e.created_at) }}</p>
        </div>
      </div>

      <!-- Details -->
      <div class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
        <div class="min-w-0">
          <p class="text-[11.5px] text-muted-foreground">Submitted by:</p>
          <div class="mt-0.5 flex items-center gap-1.5">
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold text-white"
              :style="{ background: personColor(e.submitter_email ?? e.submitted_by) }"
            >
              {{ personInitials(e.submitter_name ?? e.submitter_email) }}
            </span>
            <p class="truncate text-[13px] font-semibold text-foreground">{{ e.submitter_name ?? e.submitter_email ?? 'Unknown' }}</p>
          </div>
        </div>
        <div class="min-w-0">
          <p class="text-[11.5px] text-muted-foreground">Expense ID:</p>
          <p class="truncate text-[13px] font-semibold text-foreground">{{ expCode(e) }}</p>
        </div>
        <div class="min-w-0">
          <p class="mb-1 text-[11.5px] text-muted-foreground">Category:</p>
          <Badge variant="neutral" class="rounded-full capitalize">{{ e.category }}</Badge>
        </div>
        <div v-if="team !== undefined" class="min-w-0">
          <p class="text-[11.5px] text-muted-foreground">Team:</p>
          <p class="truncate text-[13px] font-semibold text-foreground">{{ team }}</p>
        </div>
        <div v-else class="min-w-0">
          <p class="mb-1 text-[11.5px] text-muted-foreground">Status:</p>
          <AppExpenseStatusBadge :status="e.status" :payout-date="e.payout_date" class="rounded-full" />
        </div>
      </div>
    </NuxtLink>

    <!-- Actions -->
    <div class="grid grid-cols-2 gap-2.5 px-4 pb-4">
      <Button
        variant="secondary"
        class="m-press h-12 gap-2 rounded-full bg-background text-[15px] font-semibold text-red-600 hover:bg-background/80 dark:text-red-400"
        :disabled="rejecting"
        @click="haptic(); emit('reject')"
      >
        <Icon name="solar:close-circle-linear" class="size-5" />
        Reject
      </Button>
      <Button
        class="m-press h-12 gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background hover:bg-foreground/90"
        :disabled="approving"
        @click="haptic(); emit('approve')"
      >
        <Icon v-if="approving" name="solar:refresh-linear" class="size-5 animate-spin" />
        <Icon v-else name="solar:check-circle-linear" class="size-5" />
        {{ approving ? 'Approving…' : 'Approve' }}
      </Button>
    </div>
  </Card>
</template>
