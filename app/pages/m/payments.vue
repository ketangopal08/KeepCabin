<script setup lang="ts">
// Mobile Payouts — finance reviews manager-approved expenses and records payouts (UTR).
// Data + actions copied from app/pages/app/payments.vue (same API calls).
import { useSupabase } from '~~/lib/supabase'
import type { Expense, Payout } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { personColor, personInitials } from '~/utils/avatarColors'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

type PayoutRow = Payout & { employee_name: string | null; employee_email: string | null; expense_count: number; overdue: boolean }

const supabase = useSupabase()
const { ctx, load } = useOrgContext()

const tab      = ref('review')
const expenses = ref<Expense[]>([])
const payouts  = ref<PayoutRow[]>([])
const loading  = ref(true)
const payoutsFailed = ref(false)

const search = ref('')
const { filters, apply, group } = useExpenseFilters()

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return apply(expenses.value)
  return apply(expenses.value.filter(e =>
    (e.vendor ?? '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  ))
})

const groups = computed(() => group(filtered.value))

// Flatten groups into one keyed list so the whole thing animates in a single TransitionGroup
type Row = { kind: 'label'; key: string; label: string; count: number } | { kind: 'exp'; key: string; e: Expense }
const rows = computed<Row[]>(() => groups.value.flatMap(g => [
  ...(g.label ? [{ kind: 'label' as const, key: `g:${g.key}`, label: g.label, count: g.items.length }] : []),
  ...g.items.map(e => ({ kind: 'exp' as const, key: e.id, e })),
]))

const scheduledCount = computed(() => payouts.value.filter(p => p.status === 'scheduled').length)

// All expenses (needed for the Pay sheet's expense list); `expenses` stays the Review list
const allExpenses = ref<Expense[]>([])
const teamNames = ref<Record<string, string>>({})
function teamName(id: string | null | undefined) {
  return (id && teamNames.value[id]) || '—'
}

// ── Stats ──
const reviewAmount = computed(() => expenses.value.reduce((s, e) => s + Number(e.amount), 0))
const scheduledPayouts = computed(() => payouts.value.filter(p => p.status === 'scheduled'))
const nextCycle = computed(() => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const dates = scheduledPayouts.value.map(p => p.cycle_date).filter(d => d >= today).sort()
  return dates[0] ?? null
})
const nextAmount = computed(() =>
  scheduledPayouts.value.filter(p => p.cycle_date === nextCycle.value).reduce((s, p) => s + Number(p.amount), 0)
)
const overdueCount = computed(() => payouts.value.filter(p => p.status === 'scheduled' && p.overdue).length)
const istMonth = (d: Date | string) =>
  new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
const paidThisMonth = computed(() => {
  const cur = istMonth(new Date())
  return payouts.value
    .filter(p => p.status === 'paid' && p.paid_at && istMonth(p.paid_at) === cur)
    .reduce((s, p) => s + Number(p.amount), 0)
})

// ── Cycle bar ──
const selectedCycle = ref<string | null>(null)
const cycleDates = computed(() => [...new Set(payouts.value.map(p => p.cycle_date))].sort())
const cycleOptions = computed<(string | null)[]>(() => [null, ...cycleDates.value])
const cycleIdx = computed(() => Math.max(0, cycleOptions.value.indexOf(selectedCycle.value)))
watch(cycleDates, (d) => { if (selectedCycle.value && !d.includes(selectedCycle.value)) selectedCycle.value = null })
const visiblePayouts = computed(() =>
  selectedCycle.value ? payouts.value.filter(p => p.cycle_date === selectedCycle.value) : payouts.value
)
function stepCycle(dir: 1 | -1) {
  const n = cycleOptions.value.length
  const i = Math.min(n - 1, Math.max(0, cycleIdx.value + dir))
  selectedCycle.value = cycleOptions.value[i] ?? null
}

const payExpenses = computed(() =>
  payTarget.value ? allExpenses.value.filter(e => e.payout_id === payTarget.value!.id) : []
)

// ── Helpers ──
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCycle(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function fmtCycleShort(d: string) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function money(n: number | string) {
  return `₹${Number(n).toLocaleString('en-IN')}`
}

function money2(n: number | string) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}


async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { await navigateTo('/login'); return null }
  return { Authorization: `Bearer ${session.access_token}` }
}

function isConflict(e: any) {
  return e?.statusCode === 409 || e?.status === 409 || e?.response?.status === 409
}

async function handleError(e: any, fallback: string) {
  if (isConflict(e)) {
    toast.error('Already handled by someone else')
    await loadAll()
  } else {
    toast.error(e?.data?.message ?? fallback)
  }
}

// ── Load ──
async function loadAll() {
  try {
    const headers = await authHeaders()
    if (!headers) return
    await load()
    // allSettled: the Review tab keeps working even if /api/payouts fails
    // (e.g. before lib/reimbursements.sql has been run).
    const [all, pays, teams] = await Promise.allSettled([
      $fetch<Expense[]>('/api/expenses' as string, { headers }),
      $fetch<PayoutRow[]>('/api/payouts' as string, { headers }),
      $fetch<{ id: string; name: string }[]>('/api/teams' as string, { headers }),
    ])
    if (teams.status === 'fulfilled') {
      teamNames.value = Object.fromEntries(teams.value.map(t => [t.id, t.name]))
    }
    if (pays.status === 'fulfilled') {
      payouts.value = pays.value
      payoutsFailed.value = false
    } else {
      payouts.value = []
      payoutsFailed.value = true
    }
    if (all.status === 'rejected') throw all.reason
    const me = ctx.value?.member.user_id
    allExpenses.value = all.value
    expenses.value = all.value.filter(e => e.status === 'pending_finance' && e.submitted_by !== me)
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to load payments')
  } finally {
    loading.value = false
  }
}

// ── Review: approve / reject ──
const approving    = ref<Set<string>>(new Set())
const rejecting    = ref<Set<string>>(new Set())
const rejectingId  = ref<string | null>(null)
const rejectReason = ref('')
const rejectTarget = computed(() => expenses.value.find(e => e.id === rejectingId.value) ?? null)
const rejectOpen   = computed({
  get: () => rejectingId.value !== null,
  set: (v: boolean) => { if (!v) { rejectingId.value = null; rejectReason.value = '' } },
})
const quickReasons = [
  'Missing GST invoice',
  'Receipt is not readable',
  'Duplicate submission',
  'Personal expense — not reimbursable',
  'Exceeds policy limit',
]
function openReject(id: string) {
  rejectReason.value = ''
  rejectingId.value = id
}

async function approve(id: string) {
  if (approving.value.has(id)) return
  approving.value = new Set([...approving.value, id])
  try {
    const headers = await authHeaders()
    if (!headers) return
    const res = await $fetch<{ ok: boolean; payout_id: string; cycle_date: string }>(`/api/expenses/${id}/finance-approve` as string, {
      method: 'POST',
      headers,
    })
    toast.success(`Approved — pays on ${fmtCycleShort(res.cycle_date)}`)
    await loadAll()
  } catch (e: any) {
    await handleError(e, 'Failed to approve')
  } finally {
    approving.value = new Set([...approving.value].filter(x => x !== id))
  }
}

async function reject(id: string) {
  if (!rejectReason.value.trim()) { toast.error('Enter a rejection reason'); return }
  if (rejecting.value.has(id)) return
  rejecting.value = new Set([...rejecting.value, id])
  try {
    const headers = await authHeaders()
    if (!headers) return
    await $fetch<{ ok: boolean }>(`/api/expenses/${id}/finance-reject` as string, {
      method: 'POST',
      headers,
      body: { reason: rejectReason.value.trim() },
    })
    toast.success('Expense rejected')
    rejectingId.value = null
    rejectReason.value = ''
    await loadAll()
  } catch (e: any) {
    // Only a 409 closes the sheet; otherwise keep it open with the typed reason
    if (isConflict(e)) {
      rejectingId.value = null
      rejectReason.value = ''
    }
    await handleError(e, 'Failed to reject')
  } finally {
    rejecting.value = new Set([...rejecting.value].filter(x => x !== id))
  }
}

// ── Payouts: pay ──
const payingId  = ref<string | null>(null)
const utr       = ref('')
const paying    = ref(false)
const payTarget = computed(() => payouts.value.find(p => p.id === payingId.value) ?? null)
const payOpen   = computed({
  get: () => payingId.value !== null,
  set: (v: boolean) => { if (!v) { payingId.value = null; utr.value = '' } },
})
function openPay(id: string) {
  utr.value = ''
  payingId.value = id
}

async function pay() {
  const target = payTarget.value
  if (!target || paying.value) return
  if (!utr.value.trim()) { toast.error('Enter a UTR / reference number'); return }
  paying.value = true
  try {
    const headers = await authHeaders()
    if (!headers) return
    await $fetch<{ ok: boolean; amount: number; expense_count: number }>(`/api/payouts/${target.id}/pay` as string, {
      method: 'POST',
      headers,
      body: {
        utr_number: utr.value.trim(),
        expected_count: Number(target.expense_count),
        expected_amount: Number(target.amount),
      },
    })
    toast.success('Payout recorded')
    payingId.value = null
    utr.value = ''
    await loadAll()
  } catch (e: any) {
    if (isConflict(e)) {
      // Payout changed or was already paid: close, show the server's reason, reload fresh numbers
      payingId.value = null
      utr.value = ''
      toast.error(e?.data?.message ?? 'Already handled by someone else')
      await loadAll()
    } else {
      // Keep the sheet open with the typed UTR
      toast.error(e?.data?.message ?? 'Failed to record payout')
    }
  } finally {
    paying.value = false
  }
}

function firstName(p: PayoutRow) {
  return (p.employee_name ?? p.employee_email ?? 'employee').split(' ')[0]
}

const tabs = computed(() => [
  { id: 'review',  label: 'Review',  count: loading.value ? undefined : expenses.value.length },
  { id: 'payouts', label: 'Payouts', count: loading.value ? undefined : scheduledCount.value },
])

onMounted(loadAll)
</script>

<template>
  <div>
    <MobilePageHeader title="Payouts" subtitle="Review approved expenses and pay your team" back="/m" />

    <MobilePullToRefresh :on-refresh="loadAll">
      <div class="flex flex-col gap-5">
        <!-- ── Summary hero ──────────────────────────────────────── -->
        <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[12.5px] text-background/70">To review</p>
              <Skeleton v-if="loading" class="mt-1.5 h-8 w-36 rounded-lg bg-background/15" />
              <p v-else class="mt-1.5 text-[28px] font-semibold leading-none tabular-nums">{{ money2(reviewAmount) }}</p>
              <p class="mt-1.5 text-[12px] text-background/70">
                {{ loading ? '—' : `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'} awaiting finance` }}
              </p>
            </div>
            <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-background/10">
              <Icon name="solar:wallet-money-linear" class="size-5.5" />
            </span>
          </div>

          <div class="mt-5 grid grid-cols-3 gap-2">
            <div class="min-w-0 rounded-2xl bg-background/10 px-3 py-2.5">
              <p class="flex items-center gap-1 text-[11px] text-background/70">
                <Icon name="solar:calendar-linear" class="size-3.5 shrink-0" />Next payout
              </p>
              <p class="truncate text-[14px] font-semibold tabular-nums">{{ loading || !nextCycle ? '—' : fmtCycleShort(nextCycle) }}</p>
              <p class="truncate text-[10.5px] text-background/70">{{ loading || !nextCycle ? ' ' : money(nextAmount) }}</p>
            </div>
            <div
              class="min-w-0 rounded-2xl px-3 py-2.5"
              :class="!loading && overdueCount > 0 ? 'bg-orange-500/25' : 'bg-background/10'"
            >
              <p class="flex items-center gap-1 text-[11px] text-background/70">
                <Icon name="solar:danger-triangle-linear" class="size-3.5 shrink-0" />Overdue
              </p>
              <p class="truncate text-[14px] font-semibold tabular-nums">{{ loading ? '—' : overdueCount }}</p>
              <p class="truncate text-[10.5px] text-background/70">payouts</p>
            </div>
            <div class="min-w-0 rounded-2xl bg-background/10 px-3 py-2.5">
              <p class="flex items-center gap-1 text-[11px] text-background/70">
                <Icon name="solar:check-circle-linear" class="size-3.5 shrink-0" />Paid
              </p>
              <p class="truncate text-[14px] font-semibold tabular-nums">{{ loading ? '—' : money(paidThisMonth) }}</p>
              <p class="truncate text-[10.5px] text-background/70">this month</p>
            </div>
          </div>
        </Card>

        <!-- ── Segmented tabs ────────────────────────────────────── -->
        <div class="m-rise grid grid-cols-2 gap-1 rounded-full bg-muted/60 p-1" style="--d: 120ms">
          <Button
            v-for="t in tabs"
            :key="t.id"
            variant="ghost"
            class="m-press h-11 gap-2 rounded-full text-[14px] font-semibold"
            :class="tab === t.id ? 'bg-foreground text-background hover:bg-foreground hover:text-background' : 'text-muted-foreground'"
            @click="tab = t.id; haptic('selection')"
          >
            {{ t.label }}
            <Badge
              v-if="t.count !== undefined"
              variant="secondary"
              class="h-5 min-w-5 rounded-full px-1.5 tabular-nums"
              :class="tab === t.id ? 'bg-background/20 text-background' : ''"
            >
              {{ t.count }}
            </Badge>
          </Button>
        </div>

        <Transition name="m-swap" mode="out-in">
          <!-- ── Review tab ─────────────────────────────────────── -->
          <div v-if="tab === 'review'" key="review" class="flex flex-col gap-5">
            <MobileApprFilters v-model:search="search" :filters="filters" />

            <div v-if="loading" class="flex flex-col gap-3">
              <Skeleton v-for="n in 3" :key="n" class="h-[212px] rounded-3xl" />
            </div>

            <Card v-else-if="filtered.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
              <Icon name="solar:wallet-linear" class="size-7 text-muted-foreground" />
              <p class="text-[14px] font-medium text-foreground">{{ search ? 'No matching expenses' : 'Nothing to review' }}</p>
              <p class="text-[12.5px] text-muted-foreground">
                {{ search ? 'Try a different search term.' : 'Manager-approved expenses awaiting finance review will appear here.' }}
              </p>
            </Card>

            <div v-else>
              <TransitionGroup name="m-list" tag="div" class="relative flex flex-col gap-3">
                <template v-for="(r, i) in rows" :key="r.key">
                  <p
                    v-if="r.kind === 'label'"
                    class="mt-1 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-foreground"
                  >
                    {{ r.label }} <span class="font-normal text-muted-foreground">{{ r.count }}</span>
                  </p>
                  <MobileApprExpenseCard
                    v-else
                    :expense="r.e"
                    :team="teamName(r.e.team_id)"
                    :approving="approving.has(r.e.id)"
                    :rejecting="rejecting.has(r.e.id)"
                    class="m-rise"
                    :style="{ '--d': `${Math.min(i, 6) * 60}ms` }"
                    @approve="approve(r.e.id)"
                    @reject="openReject(r.e.id)"
                  />
                </template>
              </TransitionGroup>
              <p class="mt-4 text-center text-[12px] text-muted-foreground">
                Showing {{ filtered.length }} of {{ expenses.length }} expenses
              </p>
            </div>
          </div>

          <!-- ── Payouts tab ────────────────────────────────────── -->
          <div v-else key="payouts" class="flex flex-col gap-4">
            <div v-if="loading" class="flex flex-col gap-3">
              <Skeleton v-for="n in 3" :key="n" class="h-[148px] rounded-3xl" />
            </div>

            <Card v-else-if="payoutsFailed" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
              <Icon name="solar:card-linear" class="size-7 text-muted-foreground" />
              <p class="text-[14px] font-medium text-foreground">Payouts aren't available yet</p>
              <p class="text-[12.5px] text-muted-foreground">Try again in a little while.</p>
            </Card>

            <Card v-else-if="payouts.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
              <Icon name="solar:card-linear" class="size-7 text-muted-foreground" />
              <p class="text-[14px] font-medium text-foreground">No payouts yet</p>
              <p class="text-[12.5px] text-muted-foreground">Payouts are created when finance approves expenses.</p>
            </Card>

            <template v-else>
              <!-- Cycle stepper -->
              <div class="flex items-center justify-between gap-2 rounded-full bg-muted/60 p-1">
                <Button
                  variant="ghost"
                  size="icon-lg"
                  class="m-press size-11 rounded-full bg-background hover:bg-background/80"
                  aria-label="Previous cycle"
                  :disabled="cycleIdx === 0"
                  @click="stepCycle(-1)"
                >
                  <Icon name="solar:alt-arrow-left-linear" class="size-5" />
                </Button>
                <div class="min-w-0 text-center">
                  <p class="text-[11px] text-muted-foreground">Payout cycle</p>
                  <Transition name="m-swap" mode="out-in">
                    <p :key="selectedCycle ?? 'all'" class="truncate text-[14px] font-semibold text-foreground">
                      {{ selectedCycle ? fmtCycle(selectedCycle) : 'All cycles' }}
                    </p>
                  </Transition>
                </div>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  class="m-press size-11 rounded-full bg-background hover:bg-background/80"
                  aria-label="Next cycle"
                  :disabled="cycleIdx >= cycleOptions.length - 1"
                  @click="stepCycle(1)"
                >
                  <Icon name="solar:alt-arrow-right-linear" class="size-5" />
                </Button>
              </div>

              <TransitionGroup name="m-list" tag="div" class="relative flex flex-col gap-3">
                <Card
                  v-for="(p, i) in visiblePayouts"
                  :key="p.id"
                  class="m-rise gap-0 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0"
                  :class="p.status === 'scheduled' && p.overdue ? 'ring-1 ring-orange-500/30' : ''"
                  :style="{ '--d': `${Math.min(i, 6) * 60}ms` }"
                >
                  <div class="flex items-center gap-3">
                    <div
                      class="flex size-11 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                      :style="{ background: personColor(p.employee_email ?? p.user_id) }"
                    >
                      {{ personInitials(p.employee_name ?? p.employee_email) }}
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-[15px] font-semibold text-foreground">{{ p.employee_name ?? p.employee_email ?? 'Unknown' }}</p>
                      <p v-if="p.employee_name && p.employee_email" class="truncate text-[12px] text-muted-foreground">{{ p.employee_email }}</p>
                    </div>
                    <p class="shrink-0 text-[17px] font-semibold tabular-nums text-foreground">{{ money(p.amount) }}</p>
                  </div>

                  <div class="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
                    <div class="min-w-0">
                      <p class="text-[11.5px] text-muted-foreground">Payout date:</p>
                      <p class="truncate text-[13px] font-semibold text-foreground">{{ fmtCycle(p.cycle_date) }}</p>
                    </div>
                    <div class="min-w-0">
                      <p class="text-[11.5px] text-muted-foreground">Expenses:</p>
                      <p class="text-[13px] font-semibold tabular-nums text-foreground">{{ p.expense_count }}</p>
                    </div>
                    <div class="col-span-2 min-w-0">
                      <p class="mb-1 text-[11.5px] text-muted-foreground">Status:</p>
                      <Badge v-if="p.status === 'paid'" variant="success" class="max-w-full rounded-full">
                        <span class="truncate">Paid · UTR {{ p.utr_number }}</span>
                      </Badge>
                      <Badge v-else-if="p.overdue" variant="danger" class="rounded-full">Overdue</Badge>
                      <Badge v-else variant="warning" class="rounded-full">Scheduled</Badge>
                    </div>
                  </div>

                  <Button
                    v-if="p.status === 'scheduled'"
                    class="m-press mt-4 h-12 w-full gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background hover:bg-foreground/90"
                    @click="openPay(p.id)"
                  >
                    <Icon name="solar:card-linear" class="size-5" />
                    Pay {{ money(p.amount) }}
                  </Button>
                </Card>
              </TransitionGroup>
            </template>
          </div>
        </Transition>
      </div>
    </MobilePullToRefresh>

    <!-- ── Reject sheet ──────────────────────────────────────────── -->
    <MobileApprRejectSheet
      v-model:open="rejectOpen"
      v-model:reason="rejectReason"
      :target="rejectTarget"
      :busy="!!rejectTarget && rejecting.has(rejectTarget.id)"
      :quick-reasons="quickReasons"
      @confirm="rejectTarget && reject(rejectTarget.id)"
    />

    <!-- ── Pay sheet ─────────────────────────────────────────────── -->
    <Sheet v-model:open="payOpen">
      <SheetContent
        side="bottom"
        class="mx-auto max-h-[90dvh] max-w-md gap-0 overflow-y-auto rounded-t-3xl border-0 px-5 pt-3"
        style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
        <SheetHeader class="p-0 text-left">
          <SheetTitle class="text-[17px]">{{ payTarget ? `Pay ${firstName(payTarget)} ${money2(payTarget.amount)}` : 'Record payout' }}</SheetTitle>
          <SheetDescription v-if="payTarget">
            {{ payTarget.expense_count }} {{ payTarget.expense_count === 1 ? 'expense' : 'expenses' }} for {{ payTarget.employee_name ?? payTarget.employee_email ?? 'employee' }}
          </SheetDescription>
        </SheetHeader>

        <div class="mt-4 flex flex-col gap-3">
          <Card v-if="payTarget" class="flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
            <div class="min-w-0 flex-1">
              <p class="truncate text-[16px] font-semibold text-foreground">{{ payTarget.employee_name ?? payTarget.employee_email ?? 'Unknown' }}</p>
              <p class="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">
                {{ money2(payTarget.amount) }} · {{ payTarget.expense_count }} {{ payTarget.expense_count === 1 ? 'expense' : 'expenses' }}
              </p>
            </div>
            <div
              class="flex size-10 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
              :style="{ background: personColor(payTarget.employee_email ?? payTarget.user_id) }"
            >
              {{ personInitials(payTarget.employee_name ?? payTarget.employee_email) }}
            </div>
          </Card>

          <Card v-if="payExpenses.length" class="max-h-60 gap-0 overflow-y-auto rounded-3xl border border-border py-1 shadow-none ring-0">
            <template v-for="(e, i) in payExpenses" :key="e.id">
              <Separator v-if="i > 0" class="mx-4 w-auto bg-border/60" />
              <div class="flex items-center justify-between gap-3 px-4 py-2.5">
                <div class="min-w-0">
                  <p class="truncate text-[14px] text-foreground">{{ e.vendor ?? 'Expense' }}</p>
                  <p class="text-[12px] text-muted-foreground">{{ fmtDate(e.expense_date ?? e.created_at) }}</p>
                </div>
                <p class="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">{{ money2(e.amount) }}</p>
              </div>
            </template>
          </Card>

          <MobileField label="UTR / Reference number" icon="solar:document-text-linear" input-id="pay-utr">
            <Input
              id="pay-utr"
              v-model="utr"
              placeholder="UTR / Reference no."
              autocapitalize="characters"
              autocomplete="off"
              class="m-field-input font-mono"
              @keydown.enter="pay()"
            />
          </MobileField>
        </div>

        <div class="mt-5 flex flex-col gap-2">
          <MobileSubmitButton placement="sheet" :loading="paying" :disabled="!utr.trim()" @click="pay()">
            {{ paying ? 'Saving…' : payTarget ? `Pay ${money2(payTarget.amount)}` : 'Confirm' }}
          </MobileSubmitButton>
          <Button variant="ghost" class="m-press h-12 w-full rounded-full text-[15px]" @click="payOpen = false">
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
