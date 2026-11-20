<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense, Payout } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

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

const scheduledCount = computed(() => payouts.value.filter(p => p.status === 'scheduled').length)

// All expenses (needed for the Pay dialog's expense list); `expenses` stays the Review list
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
function catColor(cat: string) {
  const p = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % p.length
  return p[h]
}

// Brand logos that failed to load fall back to initials
const failedLogos = ref(new Set<string>())
function expLogo(e: Expense) {
  return failedLogos.value.has(e.id) ? null : brandLogoUrl(e.vendor)
}
function onLogoError(id: string) {
  failedLogos.value = new Set(failedLogos.value).add(id)
}

function initials(name: string) {
  return (name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
    // Only a 409 closes the dialog; otherwise keep it open with the typed reason
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
      // Keep the dialog open with the typed UTR
      toast.error(e?.data?.message ?? 'Failed to record payout')
    }
  } finally {
    paying.value = false
  }
}

function firstName(p: PayoutRow) {
  return (p.employee_name ?? p.employee_email ?? 'employee').split(' ')[0]
}

onMounted(loadAll)
</script>

<template>
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Payouts" description="Review approved expenses and pay your team." />

    <!-- Summary -->
    <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AppStatCard label="To review" icon="solar:clipboard-check-linear" tone="positive" :value="loading ? '—' : expenses.length" :sub="loading ? undefined : money(reviewAmount)" />
      <AppStatCard
        label="Next payout"
        icon="solar:calendar-linear"
        tone="positive"
        :value="loading || !nextCycle ? '—' : fmtCycleShort(nextCycle)"
        :sub="loading || !nextCycle ? undefined : `${money(nextAmount)} scheduled`"
      />
      <AppStatCard
        label="Overdue"
        icon="solar:danger-triangle-linear"
        tone="negative"
        :value="loading ? '—' : overdueCount"
        :class="!loading && overdueCount > 0 ? 'ring-1 ring-orange-500/30 bg-orange-500/5' : ''"
      />
      <AppStatCard label="Paid this month" icon="solar:wallet-money-linear" tone="positive" :value="loading ? '—' : money(paidThisMonth)" />
    </div>

    <!-- Tabs -->
    <AppPageTabs
      v-model="tab"
      :tabs="[
        { id: 'review',  label: 'Review',  count: loading ? undefined : expenses.length },
        { id: 'payouts', label: 'Payouts', count: loading ? undefined : scheduledCount },
      ]"
    />

    <AppTableCard>
      <template v-if="tab === 'review'" #toolbar>
        <AppExpenseToolbar v-model:search="search" :filters="filters" />
      </template>
      <template v-else-if="!payoutsFailed && payouts.length > 0" #toolbar>
        <div class="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" aria-label="Previous cycle" :disabled="cycleIdx === 0" @click="stepCycle(-1)">
            <Icon name="solar:alt-arrow-left-linear" class="size-4" />
          </Button>
          <span class="min-w-[120px] text-center text-sm font-medium text-foreground">
            {{ selectedCycle ? fmtCycle(selectedCycle) : 'All cycles' }}
          </span>
          <Button variant="outline" size="icon-sm" aria-label="Next cycle" :disabled="cycleIdx >= cycleOptions.length - 1" @click="stepCycle(1)">
            <Icon name="solar:alt-arrow-right-linear" class="size-4" />
          </Button>
        </div>
      </template>
      <!-- Loading -->
      <div v-if="loading" class="flex flex-col">
        <div v-for="n in 5" :key="n" class="flex items-center gap-4 border-b border-border px-2 py-4">
          <Skeleton class="size-9 shrink-0 rounded-lg" />
          <div class="flex flex-1 flex-col gap-1.5">
            <Skeleton class="h-4 w-36 rounded" />
            <Skeleton class="h-3 w-48 rounded" />
          </div>
          <Skeleton class="h-5 w-20 rounded-full" />
          <Skeleton class="h-8 w-24 rounded-lg" />
          <Skeleton class="h-8 w-20 rounded-lg" />
        </div>
      </div>

      <!-- Review tab -->
      <template v-else-if="tab === 'review'">
        <div v-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
          <Icon name="solar:wallet-linear" class="size-7 text-muted-foreground" />
          <p class="text-[15px] text-foreground">{{ search ? 'No matching expenses' : 'Nothing to review' }}</p>
          <p class="-mt-1.5 text-sm text-muted-foreground">
            {{ search ? 'Try a different search term.' : 'Manager-approved expenses awaiting finance review will appear here.' }}
          </p>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>Expense</TableHead>
              <TableHead>Submitted by</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead class="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="g in groups" :key="g.key">
            <TableRow v-if="g.label" class="bg-muted/40 hover:bg-muted/40">
              <TableCell :colspan="7" class="py-2 text-[12.5px] font-medium text-foreground">
                {{ g.label }} <span class="ml-1 font-normal text-muted-foreground">{{ g.items.length }}</span>
              </TableCell>
            </TableRow>
            <TableRow v-for="e in g.items" :key="e.id" class="border-border">
              <TableCell>
                <div class="flex items-center gap-3">
                  <div
                    v-if="expLogo(e)"
                    class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
                  >
                    <img
                      :src="expLogo(e) ?? undefined"
                      :alt="e.vendor ?? ''"
                      class="size-5 object-contain"
                      loading="lazy"
                      @error="onLogoError(e.id)"
                    >
                  </div>
                  <div
                    v-else
                    class="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                    :style="{ background: catColor(e.category) }"
                  >
                    {{ initials(e.vendor ?? e.category) }}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">{{ e.vendor ?? 'Expense' }}</p>
                    <p v-if="e.description" class="mt-0.5 max-w-[280px] truncate text-[12.5px] text-muted-foreground">{{ e.description }}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
                    :style="{ background: personColor(e.submitter_email ?? e.submitted_by) }"
                  >
                    {{ personInitials(e.submitter_name ?? e.submitter_email) }}
                  </div>
                  <div class="min-w-0">
                    <p class="max-w-[200px] truncate text-sm text-foreground">{{ e.submitter_name ?? e.submitter_email ?? 'Unknown' }}</p>
                    <p v-if="e.submitter_name && e.submitter_email" class="max-w-[200px] truncate text-[12px] text-muted-foreground">{{ e.submitter_email }}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ teamName(e.team_id) }}</TableCell>
              <TableCell>
                <Badge variant="neutral" class="capitalize">{{ e.category }}</Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ e.expense_date ? fmtDate(e.expense_date) : fmtDate(e.created_at) }}
              </TableCell>
              <TableCell class="font-medium tabular-nums text-foreground">
                {{ money(e.amount) }}
              </TableCell>
              <TableCell>
                <div class="flex items-center justify-end gap-1.5">
                  <Button
                    variant="outline"
                    class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                    :disabled="approving.has(e.id)"
                    @click="approve(e.id)"
                  >
                    <Icon name="solar:check-circle-linear" class="size-3.5 text-emerald-500" />
                    {{ approving.has(e.id) ? 'Approving…' : 'Approve' }}
                  </Button>
                  <Button
                    variant="outline"
                    class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                    :disabled="rejecting.has(e.id)"
                    @click="openReject(e.id)"
                  >
                    <Icon name="solar:close-circle-linear" class="size-3.5 text-red-500" />
                    Reject
                  </Button>
                  <Button variant="outline" class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal" as-child>
                    <NuxtLink :to="`/app/expenses/${e.id}`">View</NuxtLink>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            </template>
          </TableBody>
          <template #footer>
            Showing {{ filtered.length }} of {{ expenses.length }} expenses
          </template>
        </Table>
      </template>

      <!-- Payouts tab -->
      <template v-else>
        <div v-if="payoutsFailed" class="flex flex-col items-center justify-center gap-3 py-28">
          <Icon name="solar:card-linear" class="size-7 text-muted-foreground" />
          <p class="text-[15px] text-foreground">Payouts aren't available yet</p>
          <p class="-mt-1.5 text-sm text-muted-foreground">Try again in a little while.</p>
        </div>

        <div v-else-if="payouts.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
          <Icon name="solar:card-linear" class="size-7 text-muted-foreground" />
          <p class="text-[15px] text-foreground">No payouts yet</p>
          <p class="-mt-1.5 text-sm text-muted-foreground">Payouts are created when finance approves expenses.</p>
        </div>

        <Table v-else>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead>Employee</TableHead>
              <TableHead>Payout date</TableHead>
              <TableHead>Expenses</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead class="w-px" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="p in visiblePayouts" :key="p.id" class="border-border">
              <TableCell>
                <div class="flex items-center gap-2.5">
                  <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
                    :style="{ background: personColor(p.employee_email ?? p.user_id) }"
                  >
                    {{ personInitials(p.employee_name ?? p.employee_email) }}
                  </div>
                  <div class="min-w-0">
                    <p class="max-w-[200px] truncate text-sm text-foreground">{{ p.employee_name ?? p.employee_email ?? 'Unknown' }}</p>
                    <p v-if="p.employee_name && p.employee_email" class="max-w-[200px] truncate text-[12px] text-muted-foreground">{{ p.employee_email }}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ fmtCycle(p.cycle_date) }}</TableCell>
              <TableCell class="tabular-nums text-muted-foreground">{{ p.expense_count }}</TableCell>
              <TableCell class="font-medium tabular-nums text-foreground">{{ money(p.amount) }}</TableCell>
              <TableCell>
                <Badge v-if="p.status === 'paid'" variant="success">Paid · UTR {{ p.utr_number }}</Badge>
                <Badge v-else-if="p.overdue" variant="danger">Overdue</Badge>
                <Badge v-else variant="warning">Scheduled</Badge>
              </TableCell>
              <TableCell>
                <div class="flex items-center justify-end">
                  <Button v-if="p.status === 'scheduled'" class="h-8 gap-1.5 rounded-lg px-3" @click="openPay(p.id)">
                    <Icon name="solar:card-linear" class="size-3.5" />
                    Pay
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </template>
    </AppTableCard>

    <!-- Reject dialog -->
    <Dialog v-model:open="rejectOpen">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Reject expense</DialogTitle>
          <DialogDescription>The submitter will see this reason and can resubmit.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-2">
          <label class="text-[12.5px] font-medium text-foreground">Reason</label>
          <Input
            v-model="rejectReason"
            placeholder="Reason for rejection…"
            class="h-9 text-sm"
            @keydown.enter="rejectTarget && reject(rejectTarget.id)"
          />
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="r in quickReasons"
              :key="r"
              variant="outline"
              size="xs"
              class="rounded-md font-normal"
              :class="rejectReason === r ? 'bg-muted text-foreground' : 'text-muted-foreground'"
              @click="rejectReason = r"
            >
              {{ r }}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="rejectOpen = false">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="!rejectTarget || rejecting.has(rejectTarget.id) || !rejectReason.trim()"
            @click="rejectTarget && reject(rejectTarget.id)"
          >
            {{ rejectTarget && rejecting.has(rejectTarget.id) ? 'Rejecting…' : 'Reject expense' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Pay dialog -->
    <Dialog v-model:open="payOpen">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{{ payTarget ? `Pay ${firstName(payTarget)} ${money2(payTarget.amount)}` : 'Record payout' }}</DialogTitle>
          <DialogDescription v-if="payTarget">
            {{ payTarget.expense_count }} {{ payTarget.expense_count === 1 ? 'expense' : 'expenses' }} for {{ payTarget.employee_name ?? payTarget.employee_email ?? 'employee' }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="payExpenses.length" class="max-h-64 overflow-y-auto rounded-lg border border-border">
          <div
            v-for="e in payExpenses"
            :key="e.id"
            class="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
          >
            <div class="min-w-0">
              <p class="truncate text-sm text-foreground">{{ e.vendor ?? 'Expense' }}</p>
              <p class="text-[12px] text-muted-foreground">{{ fmtDate(e.expense_date ?? e.created_at) }}</p>
            </div>
            <p class="shrink-0 text-sm font-medium tabular-nums text-foreground">{{ money2(e.amount) }}</p>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-[12.5px] font-medium text-foreground">UTR / Reference number</label>
          <Input
            v-model="utr"
            placeholder="UTR / Reference no."
            class="h-9 font-mono text-[13px]"
            @keydown.enter="pay()"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" @click="payOpen = false">Cancel</Button>
          <Button :disabled="paying || !utr.trim()" @click="pay()">
            {{ paying ? 'Saving…' : 'Confirm' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </AppPage>
</template>
