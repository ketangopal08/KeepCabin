<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { personColor, personInitials } from '~/utils/avatarColors'
import { statusText } from '~/utils/expenseStatus'
import { EXPENSE_FILTER_OPTIONS as O } from '~/composables/useExpenseFilters'
import type { ExpenseFilters } from '~/composables/useExpenseFilters'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase    = useSupabase()
const { ctx, load } = useOrgContext()
const role        = computed(() => ctx.value?.member?.role)
const expenses    = ref<Expense[]>([])
const loading     = ref(true)
const search      = ref('')
const { filters, apply, group } = useExpenseFilters()

type Filter = 'all' | 'pending' | 'approved' | 'rejected'
const activeFilter = ref<Filter>('all')

function setFilter(f: string) { activeFilter.value = f as Filter }

const filtered = computed(() => {
  let list = expenses.value
  if (activeFilter.value === 'pending')  list = list.filter(e => e.status.includes('pending') || e.status === 'scheduled')
  if (activeFilter.value === 'approved') list = list.filter(e => e.status === 'paid')
  if (activeFilter.value === 'rejected') list = list.filter(e => e.status === 'rejected')
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(e =>
      (e.vendor ?? '').toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
    )
  }
  return apply(list)
})

const groups = computed(() => group(filtered.value))

const counts = computed(() => ({
  all:      expenses.value.length,
  pending:  expenses.value.filter(e => e.status.includes('pending') || e.status === 'scheduled').length,
  approved: expenses.value.filter(e => e.status === 'paid').length,
  rejected: expenses.value.filter(e => e.status === 'rejected').length,
}))

const tabs = computed(() => [
  { id: 'all',      label: 'All',      count: counts.value.all },
  { id: 'pending',  label: 'Pending',  count: counts.value.pending },
  { id: 'approved', label: 'Approved', count: counts.value.approved },
  { id: 'rejected', label: 'Rejected', count: counts.value.rejected },
])

const isEmployee = computed(() => role.value === 'employee')
const pendingCount = computed(() => expenses.value.filter(e => e.status === 'pending_manager' || e.status === 'pending_finance').length)
const scheduledRows = computed(() => expenses.value.filter(e => e.status === 'scheduled'))
const scheduledAmount = computed(() => scheduledRows.value.reduce((s, e) => s + Number(e.amount), 0))
const nextPayout = computed(() => {
  const dates = scheduledRows.value.map(e => e.payout_date).filter((d): d is string => !!d).sort()
  return dates[0] ? statusText('scheduled', dates[0]).replace('Pays on ', '') : undefined
})
// Paid this month: rows with status paid whose updated_at falls in the current IST month
const paidThisMonth = computed(() => {
  const ym = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
  const now = ym(new Date())
  return expenses.value
    .filter(e => e.status === 'paid' && ym(new Date(e.updated_at)) === now)
    .reduce((s, e) => s + Number(e.amount), 0)
})
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

// ── Filter menu (same options as the web toolbar) ─────────────────────────────
const FILTER_MENUS: { key: keyof ExpenseFilters; label: string; icon: string }[] = [
  { key: 'category', label: 'Category', icon: 'solar:tag-linear' },
  { key: 'date',     label: 'Date',     icon: 'solar:calendar-linear' },
  { key: 'amount',   label: 'Amount',   icon: 'solar:wallet-money-linear' },
  { key: 'sort',     label: 'Sort',     icon: 'solar:sort-vertical-linear' },
  { key: 'groupBy',  label: 'Group by', icon: 'solar:layers-minimalistic-linear' },
]
function optionLabel(key: keyof ExpenseFilters) {
  return O[key].find(o => o.value === filters[key])?.label ?? ''
}
const filtersActive = computed(() =>
  filters.category !== 'all' || filters.date !== 'all' || filters.amount !== 'all' ||
  filters.sort !== 'newest' || filters.groupBy !== 'none',
)
function resetFilters() {
  filters.category = 'all'
  filters.date = 'all'
  filters.amount = 'all'
  filters.sort = 'newest'
  filters.groupBy = 'none'
}

// ── Formatting ────────────────────────────────────────────────────────────────
function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}
function expCode(e: Expense) {
  return `EXP-${e.id.replace(/-/g, '').slice(0, 3).toUpperCase()}-${e.id.replace(/-/g, '').slice(-3).toUpperCase()}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Data ──────────────────────────────────────────────────────────────────────
async function fetchExpenses() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    expenses.value = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } finally {
    loading.value = false
  }
}

onMounted(async () => { await load(); await fetchExpenses() })
</script>

<template>
  <MobilePullToRefresh :on-refresh="fetchExpenses">
  <div class="flex flex-col gap-5">
    <MobilePageHeader
      :title="role === 'employee' ? 'My Expenses' : 'Expenses'"
      :subtitle="loading ? undefined : `${filtered.length} of ${expenses.length} expenses`"
      back="/m"
      class="!mb-0"
    >
      <template #action>
        <Button
          v-if="role === 'employee'"
          size="icon-lg"
          class="m-press rounded-full bg-foreground text-background hover:bg-foreground/90"
          as-child
        >
          <NuxtLink to="/m/expenses/new" aria-label="New expense" @click="haptic">
            <Icon name="solar:add-circle-linear" class="size-5" />
          </NuxtLink>
        </Button>
      </template>
    </MobilePageHeader>

    <!-- ── Summary (employees) ───────────────────────────────────── -->
    <div v-if="isEmployee" class="m-rise grid grid-cols-3 gap-2.5" style="--d: 60ms">
      <Card class="gap-0 rounded-3xl border-0 bg-muted/60 p-3.5 shadow-none ring-0">
        <Icon name="solar:hourglass-linear" class="size-4.5 text-muted-foreground" />
        <p class="mt-2 text-[11.5px] leading-tight text-muted-foreground">Awaiting approval</p>
        <Skeleton v-if="loading" class="mt-1 h-4 w-10 rounded" />
        <p v-else class="mt-0.5 text-[15px] font-semibold tabular-nums text-foreground">{{ pendingCount }}</p>
      </Card>
      <Card class="gap-0 rounded-3xl border-0 bg-muted/60 p-3.5 shadow-none ring-0">
        <Icon name="solar:calendar-linear" class="size-4.5 text-muted-foreground" />
        <p class="mt-2 text-[11.5px] leading-tight text-muted-foreground">Scheduled</p>
        <Skeleton v-if="loading" class="mt-1 h-4 w-14 rounded" />
        <template v-else>
          <p class="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-foreground">{{ inr(scheduledAmount) }}</p>
          <p v-if="nextPayout" class="truncate text-[10.5px] text-muted-foreground">next: {{ nextPayout }}</p>
        </template>
      </Card>
      <Card class="gap-0 rounded-3xl border-0 bg-muted/60 p-3.5 shadow-none ring-0">
        <Icon name="solar:wallet-money-linear" class="size-4.5 text-muted-foreground" />
        <p class="mt-2 text-[11.5px] leading-tight text-muted-foreground">Paid this month</p>
        <Skeleton v-if="loading" class="mt-1 h-4 w-14 rounded" />
        <p v-else class="mt-0.5 truncate text-[15px] font-semibold tabular-nums text-foreground">{{ inr(paidThisMonth) }}</p>
      </Card>
    </div>

    <!-- ── Search + filters ──────────────────────────────────────── -->
    <div class="m-rise relative" style="--d: 120ms">
      <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="search"
        type="search"
        placeholder="Search by vendor or category"
        class="h-13 rounded-full pr-14 pl-11 text-base transition-shadow md:text-base focus-visible:shadow-[0_6px_24px_-10px_rgba(0,0,0,0.25)]"
      />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="icon-lg"
            class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full bg-foreground text-background transition-transform hover:bg-foreground/90 active:scale-90"
            aria-label="Filter"
          >
            <Icon name="solar:filter-linear" class="size-5" />
            <span v-if="filtersActive" class="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-60">
          <DropdownMenuLabel>Filters</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuSub v-for="m in FILTER_MENUS" :key="m.key">
            <DropdownMenuSubTrigger class="py-2">
              <Icon :name="m.icon" class="size-4 text-muted-foreground" />
              <span>{{ m.label }}</span>
              <span class="ml-auto truncate pl-2 text-[12px] text-muted-foreground">{{ optionLabel(m.key) }}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent class="w-48">
              <DropdownMenuRadioGroup v-model="filters[m.key]">
                <DropdownMenuRadioItem v-for="o in O[m.key]" :key="o.value" :value="o.value" class="py-2">
                  {{ o.label }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <template v-if="filtersActive">
            <DropdownMenuSeparator />
            <DropdownMenuItem class="py-2" @select="resetFilters">
              <Icon name="solar:restart-linear" class="size-4 text-muted-foreground" /> Reset filters
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- ── Status chips ──────────────────────────────────────────── -->
    <div class="m-rise -mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style="--d: 160ms">
      <Button
        v-for="t in tabs"
        :key="t.id"
        size="sm"
        :variant="activeFilter === t.id ? 'default' : 'secondary'"
        class="m-press h-9 shrink-0 rounded-full px-4 text-[13px]"
        :class="activeFilter === t.id ? 'bg-foreground text-background hover:bg-foreground/90' : ''"
        @click="setFilter(t.id); haptic()"
      >
        {{ t.label }}
        <span class="tabular-nums" :class="activeFilter === t.id ? 'text-background/60' : 'text-muted-foreground'">{{ t.count }}</span>
      </Button>
    </div>

    <!-- ── List ──────────────────────────────────────────────────── -->
    <section class="m-rise" style="--d: 200ms">
      <!-- Loading -->
      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton v-for="n in 4" :key="n" class="h-[128px] rounded-3xl" />
      </div>

      <!-- Empty -->
      <Card v-else-if="filtered.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-8 text-center shadow-none ring-0">
        <Icon name="solar:bill-list-linear" class="size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">No expenses found</p>
        <p class="text-[12.5px] text-muted-foreground">
          {{ search ? 'Try a different search term.' : 'Submit your first expense to get started.' }}
        </p>
        <Button v-if="role === 'employee' && !search" class="m-press mt-2 h-11 rounded-full bg-foreground px-5 font-semibold text-background hover:bg-foreground/90" as-child>
          <NuxtLink to="/m/expenses/new" @click="haptic">
            <Icon name="solar:document-add-linear" class="size-5" /> New expense
          </NuxtLink>
        </Button>
      </Card>

      <!-- Cards -->
      <div v-else class="flex flex-col gap-5">
        <div v-for="g in groups" :key="g.key">
          <p v-if="g.label" class="mb-2.5 px-1 text-[13px] font-semibold text-foreground">
            {{ g.label }} <span class="ml-1 font-normal text-muted-foreground">{{ g.items.length }}</span>
          </p>
          <TransitionGroup name="m-list" tag="div" class="relative flex flex-col gap-3">
            <NuxtLink
              v-for="(e, i) in g.items"
              :key="e.id"
              :to="`/m/expenses/${e.id}`"
              class="m-press m-rise block"
              :style="{ '--d': `${240 + Math.min(i, 8) * 60}ms` }"
              @click="haptic"
            >
              <Card class="grid grid-cols-2 gap-x-3 gap-y-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
                <div class="min-w-0">
                  <p class="text-[11.5px] text-muted-foreground">Expense ID:</p>
                  <p class="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                    {{ expCode(e) }}
                  </p>
                </div>
                <div class="min-w-0">
                  <p class="text-[11.5px] text-muted-foreground">Item:</p>
                  <p class="truncate text-[13px] font-semibold text-foreground">{{ e.vendor ?? e.category }}</p>
                  <p class="truncate text-[10.5px] capitalize text-muted-foreground">{{ e.category }}</p>
                </div>
                <div class="min-w-0">
                  <p class="mb-1 text-[11.5px] text-muted-foreground">Status:</p>
                  <AppExpenseStatusBadge :status="e.status" :payout-date="e.payout_date" class="rounded-full" />
                </div>
                <div class="min-w-0">
                  <p class="text-[11.5px] text-muted-foreground">Amount · Date:</p>
                  <p class="text-[13px] font-semibold tabular-nums text-foreground">₹{{ Number(e.amount).toLocaleString('en-IN') }}</p>
                  <p class="text-[10.5px] text-muted-foreground">{{ fmtDate(e.expense_date ?? e.created_at) }}</p>
                </div>
                <div v-if="!isEmployee" class="col-span-2 flex min-w-0 items-center gap-2.5">
                  <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold text-white"
                    :style="{ background: personColor(e.submitter_email ?? e.submitted_by) }"
                  >
                    {{ personInitials(e.submitter_name ?? e.submitter_email) }}
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-[12.5px] font-medium text-foreground">{{ e.submitter_name ?? e.submitter_email ?? 'Unknown' }}</p>
                    <p v-if="e.submitter_name && e.submitter_email" class="truncate text-[10.5px] text-muted-foreground">{{ e.submitter_email }}</p>
                  </div>
                </div>
              </Card>
            </NuxtLink>
          </TransitionGroup>
        </div>
      </div>
    </section>
  </div>
  </MobilePullToRefresh>
</template>
