<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense, Team } from '~~/lib/supabase'
import { currentIstMonth } from '~~/lib/plans'

// Mobile version of /app/reports — data, stats and CSV download copied from app/pages/app/reports.vue.
definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase = useSupabase()
const thisMonth = currentIstMonth(new Date())
const selectedMonth = ref(thisMonth)
const monthSheetOpen = ref(false)

// Free plan: only the current month can be exported (premium crown on older months)
const { exportLocked, load: loadBilling, refresh: refreshBilling } = useBilling()
onMounted(() => loadBilling())
const monthLocked = computed(() => exportLocked.value && selectedMonth.value !== thisMonth)
const downloading = ref(false)


// ── Data (real expenses for this workspace) ─────────────────────────────────
const expenses = ref<Expense[]>([])
const teams = ref<Team[]>([])
const loading = ref(true)

async function fetchAll() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    const headers = { Authorization: `Bearer ${session.access_token}` }
    const [ex, tm] = await Promise.all([
      $fetch<Expense[]>('/api/expenses' as string, { headers }).catch(() => [] as Expense[]),
      $fetch<Team[]>('/api/teams' as string, { headers }).catch(() => [] as Team[]),
    ])
    expenses.value = ex
    teams.value = tm
  } finally {
    loading.value = false
  }
}
onMounted(fetchAll)

async function refreshAll() {
  await Promise.all([fetchAll(), refreshBilling()])
}

// Same rule as the CSV export: expenses whose expense date falls in the selected month.
const monthExpenses = computed(() =>
  expenses.value
    .filter(e => e.expense_date?.startsWith(selectedMonth.value))
    .sort((a, b) => (b.expense_date ?? '').localeCompare(a.expense_date ?? '')),
)

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
const sum = (list: Expense[]) => list.reduce((t, e) => t + Number(e.amount || 0), 0)

const stats = computed(() => {
  const list = monthExpenses.value
  const paid = list.filter(e => e.status === 'paid')
  const pending = list.filter(e => e.status === 'pending_manager' || e.status === 'pending_finance' || e.status === 'scheduled')
  const rejected = list.filter(e => e.status === 'rejected')
  return [
    { label: 'Total submitted', value: inr(sum(list)), sub: `${list.length} expense${list.length === 1 ? '' : 's'}`, icon: 'solar:bill-list-linear' },
    { label: 'Paid out', value: inr(sum(paid)), sub: `${paid.length} paid`, icon: 'solar:check-circle-linear' },
    { label: 'Pending', value: inr(sum(pending)), sub: `${pending.length} awaiting approval or payment`, icon: 'solar:clock-circle-linear' },
    { label: 'Rejected', value: inr(sum(rejected)), sub: `${rejected.length} rejected`, icon: 'solar:close-circle-linear' },
  ]
})

function breakdown(keyOf: (e: Expense) => string) {
  const totals = new Map<string, number>()
  for (const e of monthExpenses.value) totals.set(keyOf(e), (totals.get(keyOf(e)) ?? 0) + Number(e.amount || 0))
  const max = Math.max(1, ...totals.values())
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ label, amount, pct: Math.round((amount / max) * 100) }))
}
const teamName = (id: string) => teams.value.find(t => t.id === id)?.name ?? 'Unknown team'
const byCategory = computed(() => breakdown(e => e.category || 'other'))
const byTeam = computed(() => breakdown(e => teamName(e.team_id)))

const PREVIEW_LIMIT = 8
const previewRows = computed(() => monthExpenses.value.slice(0, PREVIEW_LIMIT))

const statusBadge: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' }> = {
  paid: { label: 'Paid', variant: 'success' },
  pending_manager: { label: 'Awaiting manager', variant: 'warning' },
  pending_finance: { label: 'Awaiting finance', variant: 'info' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

// ── Month navigation ────────────────────────────────────────────────────────
function shiftMonth(delta: number) {
  const [y, m] = selectedMonth.value.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  selectedMonth.value = d.toISOString().slice(0, 7)
}
const monthLabel = computed(() => {
  const [y, m] = selectedMonth.value.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
})
const fmtDay = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'

// Quick-pick chips in the month sheet: the last 6 months up to the current one.
const recentMonths = computed(() => {
  const [y, m] = thisMonth.split('-').map(Number) as [number, number]
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    return {
      id: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    }
  })
})
function pickMonth(id: string) {
  selectedMonth.value = id
  monthSheetOpen.value = false
}

const exportColumns = ['Expense ID', 'Date', 'Employee', 'Team', 'Vendor', 'Category', 'Amount (₹)', 'Description', 'Status', 'UTR Number', 'Submitted at', 'Paid at']

async function downloadCSV() {
  downloading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    const response = await fetch(`/api/reports/export?month=${selectedMonth.value}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (response.status === 402) {
      const body = await response.json().catch(() => null)
      if (showPlanLimitToast({ data: body })) return
    }
    if (!response.ok) { console.error('Export failed', response.status); return }
    const blob = await response.blob()
    const link = document.createElement('a')
    const objectUrl = URL.createObjectURL(blob)
    link.href = objectUrl
    link.download = `expenses-${selectedMonth.value}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div>
  <MobilePullToRefresh :on-refresh="refreshAll">
    <MobilePageHeader title="Reports" subtitle="Monthly spend & CSV export" back="/m/settings" />

    <div class="flex flex-col gap-5">
      <!-- ── Month bar ─────────────────────────────────────────────── -->
      <div class="m-rise flex items-center gap-2" style="--d: 40ms">
        <Button variant="secondary" size="icon-lg" class="m-press shrink-0 rounded-full" aria-label="Previous month" @click="shiftMonth(-1)">
          <Icon name="solar:alt-arrow-left-linear" class="size-5" />
        </Button>
        <Button
          variant="secondary"
          class="m-press h-11 min-w-0 flex-1 gap-2 rounded-full text-[14px] font-semibold"
          @click="monthSheetOpen = true"
        >
          <Icon name="solar:calendar-linear" class="size-4.5" />
          <span class="truncate">{{ monthLabel }}</span>
        </Button>
        <Button
          variant="secondary" size="icon-lg" class="m-press shrink-0 rounded-full" aria-label="Next month"
          :disabled="selectedMonth >= thisMonth" @click="shiftMonth(1)"
        >
          <Icon name="solar:alt-arrow-right-linear" class="size-5" />
        </Button>
      </div>

      <!-- ── Hero: total + export ──────────────────────────────────── -->
      <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 80ms">
        <div class="flex items-center justify-between">
          <p class="text-[12.5px] text-background/70">{{ stats[0]!.label }} · {{ monthLabel }}</p>
          <Icon :name="stats[0]!.icon" class="size-4.5 text-background/70" />
        </div>
        <Skeleton v-if="loading" class="mt-2 h-8 w-36 rounded-lg bg-background/15" />
        <template v-else>
          <p class="mt-1.5 text-[28px] font-semibold leading-none tabular-nums">{{ stats[0]!.value }}</p>
          <p class="mt-1.5 text-[12px] text-background/70">{{ stats[0]!.sub }}</p>
        </template>

        <div class="mt-5 grid grid-cols-3 gap-2">
          <div v-for="s in stats.slice(1)" :key="s.label" class="min-w-0 rounded-2xl bg-background/10 px-3 py-2.5">
            <p class="flex items-center gap-1 truncate text-[11px] text-background/70">
              <Icon :name="s.icon" class="size-3.5 shrink-0" />{{ s.label }}
            </p>
            <Skeleton v-if="loading" class="mt-1 h-4 w-14 rounded bg-background/15" />
            <p v-else class="truncate text-[14px] font-semibold tabular-nums">{{ s.value }}</p>
            <p v-if="!loading" class="truncate text-[10.5px] text-background/60">{{ s.sub }}</p>
          </div>
        </div>

        <Button
          :disabled="downloading || monthLocked || (!loading && monthExpenses.length === 0)"
          class="m-press mt-5 h-13 w-full rounded-full bg-background/90 text-[15px] font-semibold text-foreground hover:bg-background"
          @click="downloadCSV"
        >
          <Icon v-if="downloading" name="solar:refresh-linear" class="size-5 shrink-0 animate-spin" />
          <Icon v-else name="solar:file-download-linear" class="size-5 shrink-0" />
          {{ downloading ? 'Downloading…' : 'Export CSV' }}
          <Icon v-if="monthLocked" name="solar:crown-linear" class="size-4 shrink-0 text-amber-500" />
        </Button>
      </Card>

      <!-- ── Plan note (free plan) ─────────────────────────────────── -->
      <Card v-if="exportLocked" class="m-rise flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0" style="--d: 120ms">
        <Icon name="solar:crown-linear" class="size-5 shrink-0 text-amber-500" />
        <p class="min-w-0 flex-1 text-[12.5px] text-muted-foreground">
          <template v-if="monthLocked">Exporting older months needs Pro.</template>
          <template v-else>Free plan exports the current month only.</template>
        </p>
        <Button size="sm" class="m-press h-9 shrink-0 rounded-full px-4 font-semibold" as-child>
          <NuxtLink to="/m/upgrade">Upgrade</NuxtLink>
        </Button>
      </Card>

      <!-- ── Loading ───────────────────────────────────────────────── -->
      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton class="h-[180px] rounded-3xl" />
        <Skeleton class="h-[180px] rounded-3xl" />
      </div>

      <!-- ── Empty month ───────────────────────────────────────────── -->
      <Card v-else-if="monthExpenses.length === 0" class="m-rise items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0" style="--d: 160ms">
        <Icon name="solar:chart-2-linear" class="size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">No expenses in {{ monthLabel }}</p>
        <p class="text-[12.5px] text-muted-foreground">
          Once your team submits expenses dated this month, you'll see totals, breakdowns and a CSV export here.
        </p>
        <Button v-if="selectedMonth !== thisMonth" variant="outline" class="m-press mt-2 h-11 rounded-full px-5" @click="selectedMonth = thisMonth">
          Go to current month
        </Button>
      </Card>

      <template v-else>
        <!-- ── Breakdowns ──────────────────────────────────────────── -->
        <Card
          v-for="(b, bi) in [{ title: 'By category', rows: byCategory }, { title: 'By team', rows: byTeam }]"
          :key="b.title"
          class="m-rise gap-0 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0"
          :style="{ '--d': `${160 + bi * 60}ms` }"
        >
          <p class="mb-3 text-[15px] font-semibold text-foreground">{{ b.title }}</p>
          <div class="flex flex-col gap-3">
            <div v-for="r in b.rows" :key="r.label">
              <div class="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span class="truncate capitalize text-foreground">{{ r.label }}</span>
                <span class="shrink-0 font-semibold tabular-nums text-foreground">{{ inr(r.amount) }}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${r.pct}%` }" />
              </div>
            </div>
          </div>
        </Card>

        <!-- ── Preview ─────────────────────────────────────────────── -->
        <section class="m-rise" style="--d: 280ms">
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-[15px] font-semibold text-foreground">Expenses in {{ monthLabel }}</h2>
            <span class="text-[12.5px] text-muted-foreground">{{ monthExpenses.length }} total</span>
          </div>
          <div class="flex flex-col gap-3">
            <Card
              v-for="e in previewRows"
              :key="e.id"
              class="grid grid-cols-2 gap-x-3 gap-y-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0"
            >
              <div class="min-w-0">
                <p class="text-[11.5px] text-muted-foreground">Vendor:</p>
                <p class="truncate text-[13px] font-semibold text-foreground">{{ e.vendor || '—' }}</p>
                <p class="truncate text-[10.5px] capitalize text-muted-foreground">{{ e.category }} · {{ teamName(e.team_id) }}</p>
              </div>
              <div class="min-w-0 text-right">
                <p class="text-[11.5px] text-muted-foreground">Amount · Date:</p>
                <p class="text-[13px] font-semibold tabular-nums text-foreground">{{ inr(Number(e.amount)) }}</p>
                <p class="text-[10.5px] text-muted-foreground">{{ fmtDay(e.expense_date) }}</p>
              </div>
              <div class="col-span-2">
                <Badge :variant="statusBadge[e.status]?.variant ?? 'neutral'" class="gap-1.5 rounded-full">
                  <span class="size-1.5 shrink-0 rounded-full bg-current" />
                  {{ statusBadge[e.status]?.label ?? e.status }}
                </Badge>
              </div>
            </Card>
          </div>
          <p class="mt-3 text-center text-[11.5px] text-muted-foreground">
            <template v-if="monthExpenses.length > PREVIEW_LIMIT">
              Showing {{ PREVIEW_LIMIT }} of {{ monthExpenses.length }} · the CSV includes all {{ monthExpenses.length }}
            </template>
            <template v-else>The CSV includes all {{ monthExpenses.length }} expenses shown</template>
          </p>
        </section>

        <!-- ── CSV columns ─────────────────────────────────────────── -->
        <section class="m-rise" style="--d: 320ms">
          <p class="mb-2 text-[12.5px] text-muted-foreground">CSV columns</p>
          <div class="flex flex-wrap gap-1.5">
            <Badge v-for="col in exportColumns" :key="col" variant="outline" class="h-6 rounded-full px-2.5 text-[12px] font-normal">
              {{ col }}
            </Badge>
          </div>
        </section>
      </template>
    </div>
  </MobilePullToRefresh>

  <!-- ═══════════════ Month picker sheet ═══════════════ -->
  <Sheet v-model:open="monthSheetOpen">
    <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl px-5 pt-2" style="padding-bottom: max(env(safe-area-inset-bottom), 1.25rem)">
      <div class="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted" aria-hidden="true" />
      <SheetHeader class="px-0 text-left">
        <SheetTitle class="text-[17px] font-semibold">Report month</SheetTitle>
        <SheetDescription class="text-[13px]">Expenses whose date falls in this month are shown and exported.</SheetDescription>
      </SheetHeader>

      <div class="mt-4 flex flex-col gap-3">
        <Card class="flex-row items-center gap-3 rounded-2xl border-0 bg-muted/60 px-4 py-3.5 shadow-none ring-0">
          <div class="min-w-0 flex-1">
            <p class="truncate text-[16px] font-semibold text-foreground">{{ monthLabel }}</p>
            <p class="mt-0.5 truncate text-[13px] text-muted-foreground">{{ monthExpenses.length }} {{ monthExpenses.length === 1 ? 'expense' : 'expenses' }}</p>
          </div>
          <div class="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
            <Icon name="solar:calendar-linear" class="size-5" />
          </div>
        </Card>

        <div class="rounded-3xl border border-border p-4">
          <p class="text-[16px] font-semibold text-foreground">Recent months</p>
          <p class="mt-0.5 text-[13px] text-muted-foreground">Tap a month to view it.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <Button
              v-for="mo in recentMonths"
              :key="mo.id"
              size="sm"
              :variant="selectedMonth === mo.id ? 'outline' : 'secondary'"
              class="m-press h-9 gap-1 rounded-xl px-3.5 text-[13px] font-medium"
              :class="selectedMonth === mo.id ? 'border-2 border-foreground' : ''"
              @click="pickMonth(mo.id)"
            >
              {{ mo.label }}
              <Icon v-if="exportLocked && mo.id !== thisMonth" name="solar:crown-linear" class="size-3.5 text-amber-500" />
            </Button>
          </div>
        </div>

        <MobileField label="Or pick any month" icon="solar:calendar-linear" input-id="rp-month" chevron>
          <Input id="rp-month" v-model="selectedMonth" type="month" :max="thisMonth" class="m-field-input" />
        </MobileField>
      </div>

      <MobileSubmitButton placement="sheet" class="mt-5" @click="monthSheetOpen = false">Done</MobileSubmitButton>
    </SheetContent>
  </Sheet>
  </div>
</template>
