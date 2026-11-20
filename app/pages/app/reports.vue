<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense, Team } from '~~/lib/supabase'
import { currentIstMonth } from '~~/lib/plans'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const thisMonth = currentIstMonth(new Date())
const selectedMonth = ref(thisMonth)

// Free plan: only the current month can be exported (premium crown on older months)
const { exportLocked, load: loadBilling } = useBilling()
onMounted(() => loadBilling())
const monthLocked = computed(() => exportLocked.value && selectedMonth.value !== thisMonth)
const downloading = ref(false)

// ── Data (real expenses for this workspace) ─────────────────────────────────
const expenses = ref<Expense[]>([])
const teams = ref<Team[]>([])
const loading = ref(true)

onMounted(async () => {
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
})

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
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Reports" description="Monthly spend overview and CSV export for your accountant.">
      <template #actions>
        <Button
          :disabled="downloading || monthLocked || (!loading && monthExpenses.length === 0)"
          class="h-9 gap-1.5 rounded-lg px-4"
          @click="downloadCSV"
        >
          <Icon v-if="downloading" name="solar:refresh-linear" class="size-4 shrink-0 animate-spin" />
          <Icon v-else name="solar:file-download-linear" class="size-4 shrink-0" />
          {{ downloading ? 'Downloading…' : 'Download CSV' }}
        </Button>
      </template>
    </AppPageHeader>

    <!-- Month bar -->
    <div class="mb-6 flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" class="rounded-lg" aria-label="Previous month" @click="shiftMonth(-1)">
          <Icon name="solar:alt-arrow-left-linear" class="size-4" />
        </Button>
        <Input v-model="selectedMonth" type="month" :max="thisMonth" class="h-8 w-44 rounded-lg text-sm" />
        <Button
          variant="outline" size="icon-sm" class="rounded-lg" aria-label="Next month"
          :disabled="selectedMonth >= thisMonth" @click="shiftMonth(1)"
        >
          <Icon name="solar:alt-arrow-right-linear" class="size-4" />
        </Button>
      </div>
      <p class="text-[15px] font-medium text-foreground">{{ monthLabel }}</p>
      <span v-if="exportLocked" class="ml-auto flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Icon name="solar:crown-linear" class="size-4 text-amber-500" />
        <template v-if="monthLocked">Exporting older months needs Pro.</template>
        <template v-else>Free plan exports the current month only.</template>
        <Button variant="link" class="h-auto p-0 text-[13px]" as-child>
          <NuxtLink to="/app/upgrade">Upgrade</NuxtLink>
        </Button>
      </span>
    </div>

    <!-- Loading -->
    <template v-if="loading">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Skeleton v-for="n in 4" :key="n" class="h-[104px] rounded-xl" />
      </div>
      <Skeleton class="mt-4 h-[260px] rounded-xl" />
    </template>

    <!-- Empty month (also what a brand-new workspace sees) -->
    <Card v-else-if="monthExpenses.length === 0" class="items-center gap-0 rounded-xl px-6 py-16 text-center">
      <div class="mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
        <Icon name="solar:chart-2-linear" class="size-6 text-muted-foreground" />
      </div>
      <p class="text-[15px] font-medium text-foreground">No expenses in {{ monthLabel }}</p>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Once your team submits expenses dated this month, you'll see totals, breakdowns and a CSV export here.
      </p>
      <Button v-if="selectedMonth !== thisMonth" variant="outline" size="sm" class="mt-5 rounded-lg" @click="selectedMonth = thisMonth">
        Go to current month
      </Button>
    </Card>

    <template v-else>
      <!-- Summary -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card v-for="s in stats" :key="s.label" class="gap-0 rounded-xl px-4 py-4">
          <div class="flex items-center justify-between">
            <p class="text-[13px] text-muted-foreground">{{ s.label }}</p>
            <Icon :name="s.icon" class="size-4 text-muted-foreground" />
          </div>
          <p class="mt-2 text-[22px] font-medium tabular-nums text-foreground">{{ s.value }}</p>
          <p class="mt-0.5 text-[12px] text-muted-foreground">{{ s.sub }}</p>
        </Card>
      </div>

      <!-- Breakdowns -->
      <div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card v-for="b in [{ title: 'By category', rows: byCategory }, { title: 'By team', rows: byTeam }]" :key="b.title" class="gap-0 rounded-xl px-5 py-4">
          <p class="mb-3 text-[14px] font-medium text-foreground">{{ b.title }}</p>
          <div class="flex flex-col gap-3">
            <div v-for="r in b.rows" :key="r.label">
              <div class="mb-1 flex items-baseline justify-between text-[13px]">
                <span class="capitalize text-foreground">{{ r.label }}</span>
                <span class="tabular-nums text-muted-foreground">{{ inr(r.amount) }}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${r.pct}%` }" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Preview -->
      <div class="mt-8 mb-3 flex items-center justify-between">
        <p class="text-[14px] font-medium text-foreground">Expenses in {{ monthLabel }}</p>
        <span class="text-[13px] text-muted-foreground">{{ monthExpenses.length }} total</span>
      </div>
      <AppTableCard>
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-[90px]">Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Category</TableHead>
              <TableHead class="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="e in previewRows" :key="e.id" class="border-border">
              <TableCell class="text-muted-foreground">{{ fmtDay(e.expense_date) }}</TableCell>
              <TableCell class="font-medium">{{ e.vendor || '—' }}</TableCell>
              <TableCell>{{ teamName(e.team_id) }}</TableCell>
              <TableCell class="capitalize">{{ e.category }}</TableCell>
              <TableCell class="text-right font-medium tabular-nums">{{ inr(Number(e.amount)) }}</TableCell>
              <TableCell>
                <Badge :variant="statusBadge[e.status]?.variant ?? 'neutral'" class="gap-1.5">
                  <span class="size-1.5 shrink-0 rounded-full bg-current" />
                  {{ statusBadge[e.status]?.label ?? e.status }}
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
          <template #footer>
            <template v-if="monthExpenses.length > PREVIEW_LIMIT">
              Showing {{ PREVIEW_LIMIT }} of {{ monthExpenses.length }} · the CSV includes all {{ monthExpenses.length }}
            </template>
            <template v-else>The CSV includes all {{ monthExpenses.length }} expenses shown</template>
          </template>
        </Table>
      </AppTableCard>

      <!-- Columns -->
      <p class="mt-6 mb-2 text-[13px] text-muted-foreground">CSV columns</p>
      <div class="flex flex-wrap gap-1.5">
        <Badge v-for="col in exportColumns" :key="col" variant="outline" class="h-6 rounded-md px-2 text-[12px] font-normal">
          {{ col }}
        </Badge>
      </div>
    </template>

  </AppPage>
</template>
