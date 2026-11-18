<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase    = useSupabase()
const { ctx, load } = useOrgContext()
const role        = computed(() => ctx.value?.member?.role)
const expenses    = ref<Expense[]>([])
const loading     = ref(true)
const search      = ref('')
const selected    = ref<Set<string>>(new Set())
const { filters, apply, group } = useExpenseFilters()

type Filter = 'all' | 'pending' | 'approved' | 'rejected'
const activeFilter = ref<Filter>('all')

function setFilter(f: string) { activeFilter.value = f as Filter }

const filtered = computed(() => {
  let list = expenses.value
  if (activeFilter.value === 'pending')  list = list.filter(e => e.status.includes('pending'))
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
  pending:  expenses.value.filter(e => e.status.includes('pending')).length,
  approved: expenses.value.filter(e => e.status === 'paid').length,
  rejected: expenses.value.filter(e => e.status === 'rejected').length,
}))

function toggleSelect(id: string) {
  const s = new Set(selected.value)
  s.has(id) ? s.delete(id) : s.add(id)
  selected.value = s
}

function toggleAll() {
  if (selected.value.size === filtered.value.length) selected.value = new Set()
  else selected.value = new Set(filtered.value.map(e => e.id))
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending_manager: 'Pending',
    pending_finance: 'Pending',
    paid: 'Paid',
    rejected: 'Rejected',
  }
  return map[s] ?? s
}

function statusVariant(s: string) {
  if (s === 'paid')     return 'success'
  if (s === 'rejected') return 'danger'
  return 'warning'
}

function catColor(cat: string) {
  const palette = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % palette.length
  return palette[h]
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
  <AppPage>

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <AppPageHeader :title="role === 'employee' ? 'My Expenses' : 'Expenses'">
      <template #actions>
        <Button v-if="role === 'employee'" as-child class="h-9 gap-1.5 rounded-lg px-4">
          <NuxtLink to="/app/expenses/new">
            <Icon name="solar:add-linear" class="size-4" /> New expense
          </NuxtLink>
        </Button>
      </template>
    </AppPageHeader>

    <!-- ── Tabs ────────────────────────────────────────────────────────── -->
    <AppPageTabs
      :model-value="activeFilter"
      :tabs="[
        { id: 'all',      label: 'All',      count: counts.all },
        { id: 'pending',  label: 'Pending',  count: counts.pending },
        { id: 'approved', label: 'Approved', count: counts.approved },
        { id: 'rejected', label: 'Rejected', count: counts.rejected },
      ]"
      @update:model-value="setFilter"
    />


    <AppTableCard>
      <template #toolbar>
        <AppExpenseToolbar v-model:search="search" :filters="filters" />
      </template>
      <!-- ── Loading ─────────────────────────────────────────────────────── -->
      <div v-if="loading" class="flex flex-col">
        <div v-for="n in 8" :key="n" class="flex items-center gap-4 border-b border-border px-2 py-3.5">
          <Skeleton class="size-4 rounded" />
          <Skeleton class="size-8 rounded-lg" />
          <Skeleton class="h-4 w-32 rounded" />
          <Skeleton class="ml-auto h-4 w-24 rounded" />
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
      </div>

      <!-- ── Empty state ─────────────────────────────────────────────────── -->
      <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
        <Icon name="solar:bill-list-linear" class="size-7 text-muted-foreground" />
        <p class="text-[15px] text-foreground">No expenses found</p>
        <p class="-mt-1.5 text-sm text-muted-foreground">
          {{ search ? 'Try a different search term.' : 'Submit your first expense to get started.' }}
        </p>
        <Button v-if="role === 'employee' && !search" as-child variant="outline" class="mt-2 h-9 gap-1.5 rounded-lg px-4">
          <NuxtLink to="/app/expenses/new"><Icon name="solar:add-linear" class="size-4" /> New expense</NuxtLink>
        </Button>
      </div>

      <!-- ── Table ───────────────────────────────────────────────────────── -->
      <Table v-else>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="w-10">
              <Checkbox
                aria-label="Select all"
                :model-value="selected.size > 0 && selected.size < filtered.length ? 'indeterminate' : selected.size === filtered.length && filtered.length > 0"
                @update:model-value="toggleAll"
              />
            </TableHead>
            <TableHead>
              Name <span class="ml-0.5 text-muted-foreground/60">({{ filtered.length }})</span>
            </TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="g in groups" :key="g.key">
            <TableRow v-if="g.label" class="bg-muted/40 hover:bg-muted/40">
              <TableCell :colspan="7" class="py-2 text-[12.5px] font-medium text-foreground">
                {{ g.label }} <span class="ml-1 font-normal text-muted-foreground">{{ g.items.length }}</span>
              </TableCell>
            </TableRow>
            <TableRow
              v-for="e in g.items"
              :key="e.id"
              class="group cursor-pointer border-border"
              @click="navigateTo(`/app/expenses/${e.id}`)"
            >
              <TableCell @click.stop>
                <Checkbox
                  aria-label="Select expense"
                  :model-value="selected.has(e.id)"
                  @update:model-value="toggleSelect(e.id)"
                />
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-3">
                  <div
                    v-if="expLogo(e)"
                    class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
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
                    class="flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                    :style="{ background: catColor(e.category) }"
                  >
                    {{ initials(e.vendor ?? e.category) }}
                  </div>
                  <div>
                    <p class="text-sm font-medium leading-tight text-foreground">{{ e.vendor ?? 'Expense' }}</p>
                    <p class="mt-0.5 text-[12.5px] capitalize text-muted-foreground">{{ e.category }}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="neutral" class="capitalize">{{ e.category }}</Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ e.expense_date ?? e.created_at.slice(0, 10) }}
              </TableCell>
              <TableCell class="font-medium tabular-nums text-foreground">
                ₹{{ Number(e.amount).toLocaleString('en-IN') }}
              </TableCell>
              <TableCell>
                <Badge :variant="statusVariant(e.status)" class="gap-1.5">
                  <span class="size-1.5 shrink-0 rounded-full bg-current" />
                  {{ statusLabel(e.status) }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <Button variant="outline" size="sm" class="h-8 rounded-lg px-3 text-[13px]" as-child @click.stop>
                  <NuxtLink :to="`/app/expenses/${e.id}`">View</NuxtLink>
                </Button>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
        <template #footer>
          Showing {{ filtered.length }} of {{ expenses.length }} expenses
        </template>
      </Table>
    </AppTableCard>

  </AppPage>
</template>
