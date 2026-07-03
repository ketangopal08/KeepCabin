<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { TrendingUp, TrendingDown, ArrowUpRight, Plus } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
const expenses = ref<Expense[]>([])
const loading  = ref(true)

const currentMonth = new Date().toISOString().slice(0, 7)
const lastMonth    = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

const role = computed(() => ctx.value?.member?.role)

const totalThisMonth = computed(() =>
  expenses.value.filter(e => e.created_at.startsWith(currentMonth) && e.status !== 'rejected')
    .reduce((s, e) => s + Number(e.amount), 0)
)
const totalLastMonth = computed(() =>
  expenses.value.filter(e => e.created_at.startsWith(lastMonth) && e.status !== 'rejected')
    .reduce((s, e) => s + Number(e.amount), 0)
)
const spendTrend = computed(() => {
  if (!totalLastMonth.value) return null
  return Math.round(((totalThisMonth.value - totalLastMonth.value) / totalLastMonth.value) * 100)
})
const pendingCount        = computed(() => expenses.value.filter(e => e.status.includes('pending')).length)
const pendingFinanceCount = computed(() => expenses.value.filter(e => e.status === 'pending_finance').length)
const paidCount           = computed(() => expenses.value.filter(e => e.status === 'paid').length)
const rejectedCount       = computed(() => expenses.value.filter(e => e.status === 'rejected').length)

const byCategory = computed(() => {
  const map: Record<string, number> = {}
  for (const e of expenses.value) {
    if (e.status === 'rejected') continue
    map[e.category] = (map[e.category] ?? 0) + Number(e.amount)
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

const last7Days = computed(() => {
  const days: { label: string; amount: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key   = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en', { weekday: 'short' })
    const amount = expenses.value.filter(e => e.created_at.startsWith(key)).reduce((s, e) => s + Number(e.amount), 0)
    days.push({ label, amount })
  }
  return days
})
const maxDay = computed(() => Math.max(...last7Days.value.map(d => d.amount), 1))

const recentExpenses = computed(() => expenses.value.slice(0, 6))

function statusDot(s: string) {
  if (s === 'paid')           return 'bg-emerald-500'
  if (s === 'rejected')       return 'bg-red-500'
  if (s.includes('pending'))  return 'bg-amber-500'
  return 'bg-muted-foreground'
}
function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

const orgColor = computed(() => {
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6']
  const name = ctx.value?.org?.name ?? ''
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length
  return colors[h] ?? colors[0]
})

async function fetchExpenses() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { await navigateTo('/login'); return }
  try {
    expenses.value = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch { /* silent */ } finally {
    loading.value = false
  }
}

onMounted(async () => { await load(); await fetchExpenses() })
</script>

<template>
  <div class="flex flex-col gap-5">

    <!-- ── Page header ──────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[18px] font-semibold text-foreground">Dashboard</h1>
        <p class="text-[13px] text-muted-foreground mt-0.5">
          Welcome back, <span class="text-foreground font-medium">{{ ctx?.org?.name }}</span>
        </p>
      </div>
      <Button v-if="role === 'employee'" as-child size="sm">
        <NuxtLink to="/app/expenses/new"><Plus class="size-3.5 mr-1.5" />New Expense</NuxtLink>
      </Button>
    </div>

    <!-- ── Loading skeleton ─────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton v-for="n in 4" :key="n" class="h-24 rounded-xl" />
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
        <Skeleton class="h-44 rounded-xl" />
        <Skeleton class="h-44 rounded-xl" />
      </div>
      <Skeleton class="h-52 rounded-xl" />
    </template>

    <template v-else>

      <!-- ── Stat cards ────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Spent this month</p>
          <p class="text-[26px] font-bold text-foreground leading-none tracking-tight">
            ₹{{ totalThisMonth.toLocaleString('en-IN') }}
          </p>
          <div v-if="spendTrend !== null" class="flex items-center gap-1">
            <TrendingUp v-if="spendTrend >= 0" class="size-3.5 text-emerald-500 shrink-0" />
            <TrendingDown v-else class="size-3.5 text-red-400 shrink-0" />
            <span class="text-[12px] font-semibold" :class="spendTrend >= 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ spendTrend >= 0 ? '+' : '' }}{{ spendTrend }}%
            </span>
            <span class="text-[11px] text-muted-foreground">vs last month</span>
          </div>
          <p v-else class="text-[12px] text-muted-foreground">No prior month data</p>
        </div>

        <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending review</p>
          <p class="text-[26px] font-bold leading-none tracking-tight"
            :class="pendingCount > 0 ? 'text-amber-500' : 'text-foreground'">
            {{ pendingCount }}
          </p>
          <p class="text-[12px] text-muted-foreground">
            {{ pendingCount === 0 ? 'All clear' : `${pendingCount} waiting` }}
          </p>
        </div>

        <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paid out</p>
          <p class="text-[26px] font-bold text-emerald-500 leading-none tracking-tight">{{ paidCount }}</p>
          <p class="text-[12px] text-muted-foreground">Fully reimbursed</p>
        </div>

        <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rejected</p>
          <p class="text-[26px] font-bold leading-none tracking-tight"
            :class="rejectedCount > 0 ? 'text-red-500' : 'text-foreground'">
            {{ rejectedCount }}
          </p>
          <p class="text-[12px] text-muted-foreground">{{ rejectedCount === 0 ? 'None declined' : 'Declined' }}</p>
        </div>

      </div>

      <!-- ── Chart + categories ────────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">

        <!-- 7-day bar chart -->
        <div class="flex flex-col gap-4 px-5 py-4 rounded-xl bg-card border border-border">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-[13px] font-semibold text-foreground">Daily spend</p>
              <p class="text-[12px] text-muted-foreground mt-0.5">Last 7 days</p>
            </div>
            <Badge variant="outline" class="text-[11px]">7d</Badge>
          </div>
          <div class="flex items-end gap-2" style="height:88px">
            <div v-for="day in last7Days" :key="day.label" class="flex flex-col items-center gap-1.5 flex-1">
              <div class="w-full flex items-end justify-center" style="height:68px">
                <div
                  class="w-full rounded-sm transition-all duration-700"
                  :style="{
                    height: day.amount > 0 ? `${Math.max(4, Math.round((day.amount / maxDay) * 68))}px` : '3px',
                    background: day.amount > 0 ? orgColor : 'hsl(var(--muted))',
                  }"
                />
              </div>
              <span class="text-[10px] text-muted-foreground select-none">{{ day.label }}</span>
            </div>
          </div>
        </div>

        <!-- Top categories -->
        <div class="flex flex-col px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[13px] font-semibold text-foreground mb-3">Top categories</p>
          <div v-if="byCategory.length === 0" class="text-[12.5px] text-muted-foreground">No data yet.</div>
          <div v-for="([cat, amt], i) in byCategory.slice(0, 6)" :key="cat"
            class="flex items-center gap-3 py-2 border-b border-border last:border-0">
            <span class="text-[12px] font-semibold text-muted-foreground w-4 shrink-0 tabular-nums">{{ i + 1 }}</span>
            <span class="text-[13px] text-foreground capitalize flex-1 truncate">{{ cat }}</span>
            <span class="text-[12px] font-semibold text-foreground tabular-nums">₹{{ amt.toLocaleString('en-IN') }}</span>
          </div>
        </div>
      </div>

      <!-- ── Recent expenses ───────────────────────────────────────── -->
      <div class="flex flex-col rounded-xl bg-card border border-border overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <p class="text-[13px] font-semibold text-foreground">Recent expenses</p>
          <NuxtLink to="/app/expenses"
            class="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
            View all <ArrowUpRight class="size-3" />
          </NuxtLink>
        </div>

        <div v-if="recentExpenses.length === 0" class="px-5 py-10 text-center text-[13px] text-muted-foreground">
          No expenses yet — submit your first one.
        </div>

        <NuxtLink v-for="e in recentExpenses" :key="e.id" :to="`/app/expenses/${e.id}`"
          class="flex items-center gap-4 px-5 py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
          <div :class="['size-2 rounded-full shrink-0', statusDot(e.status)]" />
          <div class="flex-1 min-w-0">
            <p class="text-[13px] font-medium text-foreground truncate">{{ e.vendor ?? 'Expense' }}</p>
            <p class="text-[11.5px] text-muted-foreground capitalize">{{ e.category }}</p>
          </div>
          <span class="text-[11.5px] text-muted-foreground shrink-0 hidden sm:block">{{ statusLabel(e.status) }}</span>
          <span class="text-[13px] font-semibold text-foreground shrink-0 ml-2 tabular-nums">
            ₹{{ Number(e.amount).toLocaleString('en-IN') }}
          </span>
        </NuxtLink>
      </div>

      <!-- ── Role banners ──────────────────────────────────────────── -->
      <div v-if="role === 'manager' && pendingCount > 0"
        class="flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-amber-500/30">
        <div class="flex items-center gap-3">
          <div class="size-2 rounded-full bg-amber-500 shrink-0" />
          <p class="text-[13px] text-foreground">
            <span class="font-semibold">{{ pendingCount }} expense{{ pendingCount > 1 ? 's' : '' }}</span>
            waiting for your approval
          </p>
        </div>
        <NuxtLink to="/app/approvals">
          <Button variant="outline" size="xs" class="border-amber-500/40 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30">
            Review now
          </Button>
        </NuxtLink>
      </div>

      <div v-if="role === 'finance' && pendingFinanceCount > 0"
        class="flex items-center justify-between px-5 py-3.5 rounded-xl bg-card border border-blue-500/30">
        <div class="flex items-center gap-3">
          <div class="size-2 rounded-full bg-blue-500 shrink-0" />
          <p class="text-[13px] text-foreground">
            <span class="font-semibold">{{ pendingFinanceCount }} expense{{ pendingFinanceCount > 1 ? 's' : '' }}</span>
            pending payment
          </p>
        </div>
        <NuxtLink to="/app/payments">
          <Button variant="outline" size="xs" class="border-blue-500/40 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30">
            Pay now
          </Button>
        </NuxtLink>
      </div>

    </template>
  </div>
</template>
