<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { SlidersHorizontal, ArrowUpDown, Search, Plus, X } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase    = useSupabase()
const { ctx, load } = useOrgContext()
const role        = computed(() => ctx.value?.member?.role)
const expenses    = ref<Expense[]>([])
const loading     = ref(true)
const search      = ref('')
const showSearch  = ref(false)
const selected    = ref<Set<string>>(new Set())

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
  return list
})

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

function statusStyle(s: string) {
  if (s === 'paid')     return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400'
  if (s === 'rejected') return 'text-red-500 bg-red-50 dark:bg-red-950/40 dark:text-red-400'
  return 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400'
}

function dotStyle(s: string) {
  if (s === 'paid')     return 'bg-emerald-500'
  if (s === 'rejected') return 'bg-red-500'
  return 'bg-amber-500'
}

function catColor(cat: string) {
  const palette = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % palette.length
  return palette[h]
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
  <div class="-m-6 flex flex-col h-full">

    <!-- ── Sub-toolbar ─────────────────────────────────────────────────── -->
    <div class="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0 flex-wrap">
      <!-- Filter tabs -->
      <div class="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
        <button
          v-for="tab in [
            { id: 'all',      label: 'All' },
            { id: 'pending',  label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ]"
          :key="tab.id"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium shrink-0 transition-colors"
          :class="activeFilter === tab.id
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
          @click="setFilter(tab.id)"
        >
          <svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          {{ tab.label }}
          <span class="text-[11px] text-muted-foreground/70">{{ counts[tab.id] }}</span>
        </button>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-1.5 shrink-0">
        <div v-if="showSearch" class="flex items-center gap-1 bg-accent rounded-lg px-2.5 h-8">
          <Search class="size-3.5 text-muted-foreground shrink-0" />
          <input
            v-model="search"
            placeholder="Search…"
            class="bg-transparent text-[12.5px] text-foreground placeholder:text-muted-foreground outline-none w-40"
            @keydown.escape="showSearch = false; search = ''"
          />
          <button @click="showSearch = false; search = ''">
            <X class="size-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        </div>

        <Button v-else variant="outline" size="sm" class="h-8 text-[12.5px] gap-1.5" @click="showSearch = true">
          <Search class="size-3.5" /> Search
        </Button>
        <Button variant="outline" size="sm" class="h-8 text-[12.5px] gap-1.5">
          <ArrowUpDown class="size-3.5" /> Sort
        </Button>
        <Button variant="outline" size="sm" class="h-8 text-[12.5px] gap-1.5">
          <SlidersHorizontal class="size-3.5" /> Filter
        </Button>
        <Button v-if="role === 'employee'" as-child size="sm" class="h-8 text-[12.5px] gap-1.5">
          <NuxtLink to="/app/expenses/new">
            <Plus class="size-3.5" /> New Expense
          </NuxtLink>
        </Button>
      </div>
    </div>

    <!-- ── Table ───────────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-auto">

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col">
        <div v-for="n in 8" :key="n" class="flex items-center gap-4 px-5 py-3.5 border-b border-border">
          <Skeleton class="size-4 rounded" />
          <Skeleton class="size-8 rounded-lg" />
          <Skeleton class="h-4 w-32 rounded" />
          <Skeleton class="h-4 w-24 rounded ml-auto" />
          <Skeleton class="h-5 w-16 rounded-full" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-28 gap-5">
        <div class="size-16 rounded-2xl border border-border bg-muted/40 flex items-center justify-center">
          <Plus class="size-7 text-muted-foreground/50" />
        </div>
        <div class="text-center">
          <p class="text-[15px] font-semibold text-foreground">No expenses found</p>
          <p class="text-[13px] text-muted-foreground mt-1">
            {{ search ? 'Try a different search term.' : 'Submit your first expense to get started.' }}
          </p>
        </div>
        <Button v-if="role === 'employee' && !search" as-child size="sm">
          <NuxtLink to="/app/expenses/new"><Plus class="size-3.5 mr-1.5" /> New Expense</NuxtLink>
        </Button>
      </div>

      <!-- Table -->
      <table v-else class="w-full text-[13px]">
        <thead class="sticky top-0 bg-background border-b border-border z-10">
          <tr>
            <th class="w-10 px-5 py-3 text-left">
              <input
                type="checkbox"
                class="rounded border-border accent-foreground cursor-pointer"
                :checked="selected.size === filtered.length && filtered.length > 0"
                :indeterminate="selected.size > 0 && selected.size < filtered.length"
                @change="toggleAll"
              />
            </th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">
              Expense
              <span class="ml-1 text-muted-foreground/50">({{ filtered.length }})</span>
            </th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">Category</th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">Date</th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">Amount</th>
            <th class="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th class="w-10 px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          <NuxtLink
            v-for="e in filtered"
            :key="e.id"
            as="tr"
            :to="`/app/expenses/${e.id}`"
            class="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
            @click.stop
          >
            <td class="px-5 py-3.5" @click.stop>
              <input
                type="checkbox"
                class="rounded border-border accent-foreground cursor-pointer"
                :checked="selected.has(e.id)"
                @change="toggleSelect(e.id)"
              />
            </td>
            <td class="px-3 py-3.5">
              <div class="flex items-center gap-3">
                <div
                  class="size-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  :style="{ background: catColor(e.category) }"
                >
                  {{ initials(e.vendor ?? e.category) }}
                </div>
                <div>
                  <p class="font-medium text-foreground leading-tight">{{ e.vendor ?? 'Expense' }}</p>
                  <p class="text-[11.5px] text-muted-foreground mt-0.5">{{ e.category }}</p>
                </div>
              </div>
            </td>
            <td class="px-3 py-3.5">
              <Badge variant="outline" class="text-[11px] font-medium">{{ e.category }}</Badge>
            </td>
            <td class="px-3 py-3.5 text-muted-foreground">
              {{ e.expense_date ?? e.created_at.slice(0, 10) }}
            </td>
            <td class="px-3 py-3.5 font-semibold text-foreground tabular-nums">
              ₹{{ Number(e.amount).toLocaleString('en-IN') }}
            </td>
            <td class="px-3 py-3.5">
              <span
                class="inline-flex items-center gap-1.5 text-[11.5px] font-medium px-2 py-0.5 rounded-full"
                :class="statusStyle(e.status)"
              >
                <span class="size-1.5 rounded-full shrink-0" :class="dotStyle(e.status)" />
                {{ statusLabel(e.status) }}
              </span>
            </td>
            <td class="px-5 py-3.5 text-right">
              <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>
                  <circle cx="12" cy="19" r="1" fill="currentColor"/>
                </svg>
              </button>
            </td>
          </NuxtLink>
        </tbody>
      </table>
    </div>

  </div>
</template>
