<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { Rocket, Settings } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase       = useSupabase()
const { ctx, load } = useOrgContext()
const expenses  = ref<Expense[]>([])
const teams     = ref<{ id: string; name: string }[]>([])
const members   = ref<any[]>([])
const loading   = ref(true)

const activeFilter = ref<'30d' | '3m' | '12m' | 'all'>('30d')

function setFilter(id: string) {
  activeFilter.value = id as '30d' | '3m' | '12m' | 'all'
}

const currentMonth = new Date().toISOString().slice(0, 7)
const role         = computed(() => ctx.value?.member?.role)

// ── KPIs ─────────────────────────────────────────────────────────────────────
const totalThisMonth = computed(() =>
  expenses.value.filter(e => e.created_at.startsWith(currentMonth) && e.status !== 'rejected')
    .reduce((s, e) => s + Number(e.amount), 0)
)
const paidThisMonth = computed(() =>
  expenses.value.filter(e => e.created_at.startsWith(currentMonth) && e.status === 'paid')
    .reduce((s, e) => s + Number(e.amount), 0)
)
const pendingCount        = computed(() => expenses.value.filter(e => e.status.includes('pending')).length)
const pendingFinanceCount = computed(() => expenses.value.filter(e => e.status === 'pending_finance').length)
const paidCount           = computed(() => expenses.value.filter(e => e.status === 'paid').length)

// ── Setup steps ───────────────────────────────────────────────────────────────
const setupSteps = computed(() => [
  { label: 'Create your organization',    done: !!ctx.value?.org,          href: null },
  { label: 'Create a team',               done: teams.value.length > 0,    href: '/app/org' },
  { label: 'Invite team members',         done: members.value.length > 1,  href: '/app/org' },
  { label: 'Submit your first expense',   done: expenses.value.length > 0, href: '/app/expenses/new' },
  { label: 'Get an expense approved',
    done: expenses.value.some(e => ['pending_finance', 'paid'].includes(e.status)),
    href: '/app/approvals' },
])

const completedSetupCount = computed(() => setupSteps.value.filter(s => s.done).length)
const nextSetupStep       = computed(() => setupSteps.value.find(s => !s.done))
const setupComplete       = computed(() => completedSetupCount.value === setupSteps.value.length)
const setupProgress       = computed(() => (completedSetupCount.value / setupSteps.value.length) * 100)

// ── Chart ─────────────────────────────────────────────────────────────────────
const chartBuckets = computed((): { label: string; value: number; key: string }[] => {
  const now     = new Date()
  const buckets: { label: string; value: number; key: string }[] = []

  if (activeFilter.value === '30d') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key  = d.toISOString().slice(0, 10)
      const pos  = 29 - i
      const label = (pos % 7 === 0 || i === 0)
        ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''
      const value = expenses.value
        .filter(e => e.created_at.slice(0, 10) === key && e.status !== 'rejected')
        .reduce((s, e) => s + Number(e.amount), 0)
      buckets.push({ label, value, key })
    }
  } else if (activeFilter.value === '3m') {
    for (let i = 12; i >= 0; i--) {
      const end   = new Date(now); end.setDate(end.getDate() - i * 7)
      const start = new Date(end); start.setDate(start.getDate() - 6)
      const label = (i % 4 === 0)
        ? start.toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''
      const value = expenses.value
        .filter(e => { const d = new Date(e.created_at); return d >= start && d <= end && e.status !== 'rejected' })
        .reduce((s, e) => s + Number(e.amount), 0)
      buckets.push({ label, value, key: end.toISOString().slice(0, 10) })
    }
  } else if (activeFilter.value === '12m') {
    for (let i = 11; i >= 0; i--) {
      const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key   = d.toISOString().slice(0, 7)
      const label = d.toLocaleDateString('en', { month: 'short' })
      const value = expenses.value
        .filter(e => e.created_at.startsWith(key) && e.status !== 'rejected')
        .reduce((s, e) => s + Number(e.amount), 0)
      buckets.push({ label, value, key })
    }
  } else {
    const months = [...new Set(expenses.value.map(e => e.created_at.slice(0, 7)))].sort()
    const keys   = months.length > 0 ? months : (() => {
      const r = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        r.push(d.toISOString().slice(0, 7))
      }
      return r
    })()
    keys.forEach(key => {
      const d     = new Date(key + '-01')
      const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' })
      const value = expenses.value
        .filter(e => e.created_at.startsWith(key) && e.status !== 'rejected')
        .reduce((s, e) => s + Number(e.amount), 0)
      buckets.push({ label, value, key })
    })
  }

  return buckets
})

const chartMax    = computed(() => Math.max(...chartBuckets.value.map(b => b.value), 1))
const totalInRange = computed(() => chartBuckets.value.reduce((s, b) => s + b.value, 0))

const svgBars = computed(() =>
  chartBuckets.value.map((b, i) => {
    const n     = chartBuckets.value.length
    const slotW = 1000 / n
    const pad   = Math.max(slotW * 0.12, 1.5)
    return {
      x: i * slotW + pad,
      w: slotW - pad * 2,
      y: b.value > 0 ? 160 - (b.value / chartMax.value) * 150 : 159.5,
      h: b.value > 0 ? (b.value / chartMax.value) * 150 : 0.5,
      key: b.key,
    }
  })
)

const dateRangeLabel = computed(() => {
  const now   = new Date()
  let start   = new Date()
  if (activeFilter.value === '30d') start.setDate(start.getDate() - 30)
  else if (activeFilter.value === '3m') start.setMonth(start.getMonth() - 3)
  else if (activeFilter.value === '12m') start.setMonth(start.getMonth() - 12)
  else start = new Date('2020-01-01')
  const fmt = (d: Date) => d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} – ${fmt(now)}`
})

// ── Stats cards (role-aware) ──────────────────────────────────────────────────
const statsCards = computed(() => {
  if (role.value === 'employee') return [
    { label: 'Expenses This Month', value: `₹${totalThisMonth.value.toLocaleString('en-IN')}`, sub: 'Total tracked',     href: '/app/expenses', urgent: false },
    { label: 'Pending Review',      value: pendingCount.value.toString(),                       sub: 'Awaiting approval', href: '/app/expenses', urgent: pendingCount.value > 0 },
    { label: 'Reimbursed',          value: paidCount.value.toString(),                          sub: 'Paid expenses',     href: '/app/expenses', urgent: false },
  ]
  if (role.value === 'manager') return [
    { label: 'Team Expenses',    value: `₹${totalThisMonth.value.toLocaleString('en-IN')}`, sub: 'This month',        href: '/app/expenses',  urgent: false },
    { label: 'Pending Approval', value: pendingCount.value.toString(),                      sub: 'Needs your action', href: '/app/approvals', urgent: pendingCount.value > 0 },
    { label: 'Team Members',     value: members.value.length.toString(),                    sub: 'In your team',      href: '/app/teams',     urgent: false },
  ]
  if (role.value === 'finance') return [
    { label: 'Total Expenses',   value: `₹${totalThisMonth.value.toLocaleString('en-IN')}`, sub: 'This month',       href: '/app/expenses', urgent: false },
    { label: 'Pending Payment',  value: pendingFinanceCount.value.toString(),                sub: 'Awaiting payment', href: '/app/payments', urgent: pendingFinanceCount.value > 0 },
    { label: 'Paid Out',         value: `₹${paidThisMonth.value.toLocaleString('en-IN')}`,  sub: 'Reimbursed',       href: '/app/expenses', urgent: false },
  ]
  return [
    { label: 'Total Expenses', value: `₹${totalThisMonth.value.toLocaleString('en-IN')}`, sub: 'This month',     href: '/app/expenses',  urgent: false },
    { label: 'Pending',        value: pendingCount.value.toString(),                       sub: 'Awaiting action', href: '/app/approvals', urgent: pendingCount.value > 0 },
    { label: 'Team Members',   value: members.value.length.toString(),                     sub: 'In organization', href: '/app/org',       urgent: false },
  ]
})

// ── Widget: last 3 months bar chart ──────────────────────────────────────────
const lastThreeMonths = computed(() => {
  const now = new Date()
  return [2, 1, 0].map(i => {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key   = d.toISOString().slice(0, 7)
    const label = d.toLocaleDateString('en', { month: 'long' })
    const value = expenses.value
      .filter(e => e.created_at.startsWith(key) && e.status !== 'rejected')
      .reduce((s, e) => s + Number(e.amount), 0)
    return { key, label, value }
  })
})

const monthlyMax = computed(() => Math.max(...lastThreeMonths.value.map(m => m.value), 1))

// ── Widget: recent expenses ───────────────────────────────────────────────────
const recentExpenses = computed(() =>
  [...expenses.value]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
)

function catColor(cat: string) {
  const p = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % p.length
  return p[h]
}

function expInitials(e: Expense) {
  return (e.vendor ?? e.category ?? '?').slice(0, 2).toUpperCase()
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Data fetch ────────────────────────────────────────────────────────────────
async function fetchAll() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { await navigateTo('/login'); return }
  const h = { Authorization: `Bearer ${session.access_token}` }
  await Promise.all([
    $fetch<Expense[]>('/api/expenses', { headers: h }).then(d => { expenses.value = d }).catch(() => {}),
    $fetch<any[]>('/api/teams',        { headers: h }).then(d => { teams.value = d   }).catch(() => {}),
    $fetch<any[]>('/api/members',      { headers: h }).then(d => { members.value = d }).catch(() => {}),
  ])
  loading.value = false
}

onMounted(async () => { await load(); await fetchAll() })
</script>

<template>
  <div class="-m-6 flex flex-col overflow-auto">
    <div class="flex flex-col gap-6 px-6 py-6">

      <!-- ── Loading ─────────────────────────────────────────────────── -->
      <template v-if="loading">
        <Skeleton class="h-[116px] rounded-2xl" />
        <div class="flex items-center justify-between">
          <Skeleton class="h-9 w-40 rounded-lg" />
          <Skeleton class="h-8 w-72 rounded-full" />
        </div>
        <Skeleton class="h-[300px] rounded-2xl" />
        <div class="grid grid-cols-3 gap-3">
          <Skeleton v-for="n in 3" :key="n" class="h-[120px] rounded-2xl" />
        </div>
        <Skeleton class="h-[72px] rounded-2xl" />
      </template>

      <template v-else>

        <!-- ── Setup Banner ──────────────────────────────────────────── -->
        <div v-if="!setupComplete" class="border border-border rounded-2xl overflow-hidden kc-fadein">
          <div class="grid grid-cols-[1fr_auto]">
            <div class="px-6 py-5">
              <div class="flex items-center gap-2 mb-1.5">
                <Rocket class="size-[15px] text-foreground" />
                <p class="text-[14px] font-semibold text-foreground">Finish setting up your account</p>
              </div>
              <p class="text-[12.5px] text-muted-foreground mb-4 max-w-sm leading-relaxed">
                Set up your team and start tracking expenses. Complete these steps to unlock the full workflow.
              </p>
              <p class="text-[12px] text-muted-foreground mb-2">{{ completedSetupCount }} of {{ setupSteps.length }} complete</p>
              <div class="w-44 h-[3px] rounded-full bg-border overflow-hidden">
                <div
                  class="h-full rounded-full bg-foreground transition-all duration-700"
                  :style="{ width: setupProgress + '%' }"
                />
              </div>
            </div>
            <div class="px-7 py-5 border-l border-border flex flex-col justify-center gap-2 min-w-[260px]">
              <p class="text-[11.5px] text-muted-foreground">Up next</p>
              <p class="text-[14.5px] font-semibold text-foreground leading-tight">{{ nextSetupStep?.label }}</p>
              <p class="text-[12px] text-muted-foreground">Complete this step to keep moving forward.</p>
              <Button
                v-if="nextSetupStep?.href"
                size="sm"
                class="mt-1.5 self-start"
                as-child
              >
                <NuxtLink :to="nextSetupStep.href">Continue setup</NuxtLink>
              </Button>
            </div>
          </div>
        </div>

        <!-- ── Overview Header ───────────────────────────────────────── -->
        <div class="flex items-center justify-between kc-fadein" style="animation-delay:60ms">
          <h1 class="text-[22px] font-semibold text-foreground tracking-tight leading-none" style="    font-weight: 400;">Overview</h1>
          <div class="flex items-center gap-2">
            <div class="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
              <button
                v-for="f in [{ id: 'all', label: 'All Time' }, { id: '12m', label: '12m' }, { id: '3m', label: '3m' }, { id: '30d', label: '30d' }]"
                :key="f.id"
                class="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-[12.5px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                :class="activeFilter === f.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:text-foreground'"
                @click="setFilter(f.id)"
              >{{ f.label }}</button>
            </div>
            <Button variant="outline" size="sm" class="h-8 gap-1.5 text-[12.5px]" as-child>
              <NuxtLink to="/app/settings">
                <Settings class="size-3.5" /> Customize
              </NuxtLink>
            </Button>
          </div>
        </div>

        <!-- ── Main Chart Card ───────────────────────────────────────── -->
        <div class="border border-border rounded-2xl overflow-hidden kc-fadein" style="animation-delay:120ms">

          <!-- Metric header -->
          <div class="px-6 py-5">
            <p class="text-[13px] text-muted-foreground">Total Expenses</p>
            <p class="text-[44px] font-bold text-foreground leading-none mt-2 tabular-nums" style="font-weight: 200;">
              ₹{{ totalInRange.toLocaleString('en-IN') }}
            </p>
            <div class="flex items-center gap-2 mt-2.5">
              <span class="size-[7px] rounded-full bg-blue-500 shrink-0" />
              <span class="text-[12.5px] text-muted-foreground">{{ dateRangeLabel }}</span>
            </div>
          </div>

          <!-- Chart -->
          <div class="border-t border-border">
            <svg
              viewBox="0 0 1000 160"
              class="w-full kc-chart"
              style="height:190px;display:block"
              preserveAspectRatio="none"
            >
              <!-- Grid lines -->
              <line v-for="n in 4" :key="n"
                x1="0" x2="1000" :y1="n * 36" :y2="n * 36"
                class="chart-grid" />
              <!-- Bars -->
              <rect
                v-for="bar in svgBars"
                :key="bar.key"
                :x="bar.x" :width="bar.w"
                :y="bar.y" :height="bar.h"
                class="chart-bar" rx="2"
              />
              <!-- Baseline -->
              <line x1="0" x2="1000" y1="160" y2="160" class="chart-baseline" />
            </svg>

            <!-- Date axis labels -->
            <div
              class="grid border-t border-border/60"
              :style="{ gridTemplateColumns: `repeat(${chartBuckets.length}, 1fr)` }"
            >
              <span
                v-for="b in chartBuckets"
                :key="b.key"
                class="text-center text-[10px] text-muted-foreground/50 py-2 px-px overflow-hidden leading-none"
              >{{ b.label }}</span>
            </div>
          </div>
        </div>

        <!-- ── Stats Grid ─────────────────────────────────────────────── -->
        <div class="grid grid-cols-3 gap-3 kc-fadein" style="animation-delay:180ms">
          <NuxtLink
            v-for="card in statsCards"
            :key="card.label"
            :to="card.href"
            class="border rounded-2xl px-6 py-5 transition-colors hover:bg-muted/20 group"
            :class="card.urgent ? 'border-amber-500/40 dark:border-amber-500/25' : 'border-border'"
          >
            <div class="flex items-start justify-between gap-2 mb-3">
              <p class="text-[13px] text-muted-foreground">{{ card.label }}</p>
              <span v-if="card.urgent" class="size-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
            </div>
            <p class="text-[38px] font-bold text-foreground leading-none mb-1.5 tabular-nums" style="font-weight: 200;">
              {{ card.value }}
            </p>
            <p class="text-[12px] text-muted-foreground">{{ card.sub }}</p>
          </NuxtLink>
        </div>

        <!-- ── 3-column Widget Row ───────────────────────────────────── -->
        <div class="border border-border rounded-2xl overflow-hidden grid grid-cols-3 divide-x divide-border kc-fadein" style="animation-delay:240ms">

          <!-- Monthly Expenses -->
          <div class="p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <p class="text-[14px] font-medium text-foreground">Expenses</p>
              <p class="text-[12.5px] text-muted-foreground">Last 3 Months</p>
            </div>
            <div class="flex gap-3 flex-1" style="min-height:200px">
              <div v-for="m in lastThreeMonths" :key="m.key" class="flex-1 flex flex-col h-full">
                <!-- Bar -->
                <div class="flex-1 relative rounded-xl overflow-hidden"
                  :class="m.value === 0 ? 'month-bar-empty' : 'bg-muted/40'">
                  <div
                    v-if="m.value > 0"
                    class="absolute bottom-0 left-0 right-0 bg-foreground rounded-xl transition-all duration-700"
                    :style="{ height: `${Math.max((m.value / monthlyMax) * 100, 6)}%` }"
                  />
                </div>
                <!-- Label -->
                <div class="mt-3 shrink-0">
                  <p class="text-[13px] font-medium text-foreground">{{ m.label }}</p>
                  <p class="text-[12px] text-muted-foreground tabular-nums">₹{{ m.value.toLocaleString('en-IN') }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Recent Expenses -->
          <div class="p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <p class="text-[14px] font-medium text-foreground">Recent Expenses</p>
              <Button variant="secondary" size="sm" class="h-7 text-[12px]" as-child>
                <NuxtLink to="/app/expenses">View All</NuxtLink>
              </Button>
            </div>
            <div class="flex-1 bg-muted/40 rounded-xl overflow-hidden" style="min-height:200px">
              <div v-if="recentExpenses.length === 0" class="h-full flex flex-col items-center justify-center p-6 text-center">
                <p class="text-[14px] font-semibold text-foreground mb-1">No expenses yet</p>
                <p class="text-[12.5px] text-muted-foreground leading-relaxed">Your most recent expenses will appear here.</p>
              </div>
              <div v-else class="flex flex-col divide-y divide-border/40">
                <NuxtLink
                  v-for="e in recentExpenses"
                  :key="e.id"
                  :to="`/app/expenses/${e.id}`"
                  class="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div
                    class="size-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    :style="{ background: catColor(e.category) }"
                  >{{ expInitials(e) }}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[12.5px] font-medium text-foreground truncate">{{ e.vendor ?? e.category }}</p>
                    <p class="text-[11.5px] text-muted-foreground">{{ fmtShortDate(e.expense_date ?? e.created_at) }}</p>
                  </div>
                  <p class="text-[12.5px] font-semibold text-foreground tabular-nums shrink-0">₹{{ Number(e.amount).toLocaleString('en-IN') }}</p>
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- Pending Approvals -->
          <div class="p-5 flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <p class="text-[14px] font-medium text-foreground">Pending Approvals</p>
              <p class="text-[22px] font-bold text-foreground tabular-nums leading-none">{{ pendingCount }}</p>
            </div>
            <div class="flex-1 bg-muted/40 rounded-xl flex flex-col items-center justify-center p-6 text-center" style="min-height:200px">
              <template v-if="pendingCount === 0">
                <p class="text-[14px] font-semibold text-foreground mb-1">All caught up</p>
                <p class="text-[12.5px] text-muted-foreground leading-relaxed">No expenses are waiting for approval.</p>
              </template>
              <template v-else>
                <p class="text-[14px] font-semibold text-foreground mb-1">{{ pendingCount }} expense{{ pendingCount !== 1 ? 's' : '' }} pending</p>
                <p class="text-[12.5px] text-muted-foreground mb-4 leading-relaxed">Review and approve to keep things moving.</p>
                <Button size="sm" as-child>
                  <NuxtLink to="/app/approvals">Review now</NuxtLink>
                </Button>
              </template>
            </div>
          </div>

        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
@keyframes kcFadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.kc-fadein {
  animation: kcFadeIn 0.35s ease-out both;
}

/* Monthly bar empty state — diagonal hatch */
.month-bar-empty {
  background-color: hsl(var(--muted));
  background-image: repeating-linear-gradient(
    -45deg,
    hsl(var(--border)) 0,
    hsl(var(--border)) 1px,
    transparent 0,
    transparent 50%
  );
  background-size: 8px 8px;
}

/* SVG chart styles */
.chart-bar {
  fill: #3b82f6;
  fill-opacity: 0.75;
}
.chart-grid {
  stroke: currentColor;
  stroke-opacity: 0.06;
  stroke-width: 1;
}
.chart-baseline {
  stroke: currentColor;
  stroke-opacity: 0.10;
  stroke-width: 1;
}
</style>
