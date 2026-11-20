<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'

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

// ── KPIs ─────────────────────────────────────────────────────────────────────
const totalThisMonth = computed(() =>
  expenses.value.filter(e => e.created_at.startsWith(currentMonth) && e.status !== 'rejected')
    .reduce((s, e) => s + Number(e.amount), 0)
)
const pendingCount = computed(() => expenses.value.filter(e => e.status.includes('pending') || e.status === 'scheduled').length)

// ── Setup steps ───────────────────────────────────────────────────────────────
const setupSteps = computed(() => [
  { label: 'Create your organization',    done: !!ctx.value?.org,          href: null },
  { label: 'Create a team',               done: teams.value.length > 0,    href: '/app/org' },
  { label: 'Invite team members',         done: members.value.length > 1,  href: '/app/org' },
  { label: 'Submit your first expense',   done: expenses.value.length > 0, href: '/app/expenses/new' },
  { label: 'Get an expense approved',
    done: expenses.value.some(e => ['pending_finance', 'scheduled', 'paid'].includes(e.status)),
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

// ── Dot-matrix chart ──────────────────────────────────────────────────────────
const DOT = 10            // square size (px)
const DOT_GAP = 5         // gap between squares (px)
const DOT_ROWS = 16       // squares per column (full height)

const dotArea   = ref<HTMLElement | null>(null)
const dotAreaW  = ref(0)
let dotObserver: ResizeObserver | null = null

watch(dotArea, (el) => {
  dotObserver?.disconnect()
  if (!el) return
  dotObserver = new ResizeObserver(entries => { dotAreaW.value = entries[0]?.contentRect.width ?? 0 })
  dotObserver.observe(el)
})
onBeforeUnmount(() => dotObserver?.disconnect())

// how many square-columns each bucket gets, so the grid always fills the width
const dotsPerBucket = computed(() => {
  const n = chartBuckets.value.length || 1
  const fit = Math.floor((dotAreaW.value + DOT_GAP) / (DOT + DOT_GAP))
  return Math.max(1, Math.floor(fit / n))
})

const dotColumns = computed(() =>
  chartBuckets.value.flatMap((b) => {
    const filled = b.value > 0 ? Math.max(1, Math.round((b.value / chartMax.value) * DOT_ROWS)) : 0
    return Array.from({ length: dotsPerBucket.value }, (_, i) => ({ key: `${b.key}-${i}`, filled, bucket: b }))
  })
)

function fmtCompact(v: number) {
  return '₹' + new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
}

const yTicks = computed(() => [3, 2, 1, 0].map(i => fmtCompact((chartMax.value * i) / 3)))

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

// ── Stats cards (same for all roles) ─────────────────────────────────────────
const statsCards = computed(() => [
  { label: 'Total Expenses', value: `₹${totalThisMonth.value.toLocaleString('en-IN')}`, sub: 'This month',      href: '/app/expenses',  urgent: false },
  { label: 'Pending',        value: pendingCount.value.toString(),                       sub: 'Awaiting action', href: '/app/approvals', urgent: pendingCount.value > 0 },
  { label: 'Team Members',   value: members.value.length.toString(),                     sub: 'In organization', href: '/app/org',        urgent: false },
])

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

// Brand logos that failed to load fall back to initials
const failedLogos = ref(new Set<string>())
function expLogo(e: Expense) {
  return failedLogos.value.has(e.id) ? null : brandLogoUrl(e.vendor)
}
function onLogoError(id: string) {
  failedLogos.value = new Set(failedLogos.value).add(id)
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
  <AppPage>

    <!-- ── Loading ─────────────────────────────────────────────────── -->
    <div v-if="loading" class="flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <Skeleton class="h-8 w-40 rounded-lg" />
        <Skeleton class="h-9 w-28 rounded-lg" />
      </div>
      <Skeleton class="h-[78px] rounded-xl" />
      <Skeleton class="h-10 w-full rounded-lg" />
      <Skeleton class="h-[300px] rounded-xl" />
      <div class="grid grid-cols-3 gap-3">
        <Skeleton v-for="n in 3" :key="n" class="h-[120px] rounded-xl" />
      </div>
    </div>

    <template v-else>

      <!-- ── Header ──────────────────────────────────────────────── -->
      <AppPageHeader title="Overview" class="kc-fadein">
        <template #actions>
          <Button variant="outline" class="h-9 gap-1.5 rounded-lg px-4" as-child>
            <NuxtLink to="/app/settings">
              <Icon name="solar:settings-linear" class="size-4" /> Customize
            </NuxtLink>
          </Button>
        </template>
      </AppPageHeader>

      <!-- ── Setup card ────────────────────────────────────────────── -->
      <Card v-if="!setupComplete" class="mb-7 flex-row items-center gap-4 rounded-xl px-4 py-3.5 kc-fadein" style="animation-delay:40ms">
        <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500">
          <Icon name="solar:rocket-2-linear" class="size-5 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[14px] font-medium text-foreground">Finish setting up your account</p>
          <p class="mt-0.5 truncate text-[13px] text-muted-foreground">
            {{ completedSetupCount }} of {{ setupSteps.length }} complete
            <template v-if="nextSetupStep"> · Up next: {{ nextSetupStep.label }}</template>
          </p>
        </div>
        <div class="hidden h-1 w-36 shrink-0 overflow-hidden rounded-full bg-muted md:block">
          <div class="h-full rounded-full bg-foreground transition-all duration-700" :style="{ width: setupProgress + '%' }" />
        </div>
        <Button v-if="nextSetupStep?.href" variant="outline" class="h-9 shrink-0 rounded-lg px-4" as-child>
          <NuxtLink :to="nextSetupStep.href">Continue setup</NuxtLink>
        </Button>
      </Card>

      <!-- ── Range tabs ────────────────────────────────────────────── -->
      <AppPageTabs
        :model-value="activeFilter"
        :tabs="[{ id: '30d', label: '30 days' }, { id: '3m', label: '3 months' }, { id: '12m', label: '12 months' }, { id: 'all', label: 'All time' }]"
        class="kc-fadein"
        style="animation-delay:60ms"
        @update:model-value="setFilter"
      >
        <span class="text-sm text-muted-foreground">{{ dateRangeLabel }}</span>
      </AppPageTabs>

      <!-- ── Main Chart Card (dot matrix) ──────────────────────────── -->
      <Card class="mb-4 gap-0 rounded-2xl px-6 py-5 kc-fadein" style="animation-delay:120ms">

        <!-- Header -->
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[15px] font-medium text-foreground">Total Expenses</p>
            <p class="mt-0.5 text-[13px] text-muted-foreground">{{ dateRangeLabel }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Badge variant="outline" class="h-8 gap-2 rounded-lg px-3 text-sm font-normal">
              <span class="size-3.5 rounded-[4px] bg-primary" /> Spent
            </Badge>
            <Badge variant="outline" class="h-8 gap-2 rounded-lg px-3 text-sm font-normal">
              <span class="size-3.5 rounded-[4px] bg-foreground/10" /> No spend
            </Badge>
          </div>
          <p class="text-[26px] font-normal leading-none tabular-nums text-foreground">
            ₹{{ totalInRange.toLocaleString('en-IN') }}
          </p>
        </div>

        <!-- Chart -->
        <div class="flex gap-3">
          <!-- Y axis -->
          <div
            class="flex shrink-0 flex-col justify-between text-right text-[12px] leading-none text-muted-foreground tabular-nums"
            :style="{ height: `${DOT_ROWS * DOT + (DOT_ROWS - 1) * DOT_GAP}px` }"
          >
            <span v-for="t in yTicks" :key="t">{{ t }}</span>
          </div>

          <div class="min-w-0 flex-1">
            <!-- Squares -->
            <div
              ref="dotArea"
              class="grid"
              :style="{
                gridTemplateColumns: `repeat(${dotColumns.length}, ${DOT}px)`,
                justifyContent: 'space-between',
              }"
            >
              <div
                v-for="col in dotColumns"
                :key="col.key"
                class="flex flex-col-reverse"
                :style="{ gap: `${DOT_GAP}px` }"
                :title="`${col.bucket.key} · ₹${col.bucket.value.toLocaleString('en-IN')}`"
              >
                <span
                  v-for="r in DOT_ROWS"
                  :key="r"
                  class="block rounded-[3px] transition-colors"
                  :class="r <= col.filled ? 'bg-primary' : 'bg-foreground/[0.07]'"
                  :style="{ width: `${DOT}px`, height: `${DOT}px` }"
                />
              </div>
            </div>

            <!-- X axis -->
            <div
              class="mt-4 grid"
              :style="{ gridTemplateColumns: `repeat(${chartBuckets.length}, 1fr)` }"
            >
              <span
                v-for="b in chartBuckets"
                :key="b.key"
                class="whitespace-nowrap text-[12px] leading-none text-muted-foreground"
              >{{ b.label }}</span>
            </div>
          </div>
        </div>
      </Card>

      <!-- ── Stats Grid ─────────────────────────────────────────────── -->
      <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3 kc-fadein" style="animation-delay:180ms">
        <NuxtLink v-for="card in statsCards" :key="card.label" :to="card.href" class="group">
          <Card
            class="gap-0 rounded-xl px-5 py-5 transition-colors group-hover:bg-muted/40"
            :class="card.urgent ? 'ring-amber-500/40 dark:ring-amber-500/25' : ''"
          >
            <div class="mb-3 flex items-start justify-between gap-2">
              <p class="text-sm text-muted-foreground">{{ card.label }}</p>
              <span v-if="card.urgent" class="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
            </div>
            <p class="mb-1.5 text-[30px] font-normal leading-none tabular-nums text-foreground">
              {{ card.value }}
            </p>
            <p class="text-[13px] text-muted-foreground">{{ card.sub }}</p>
          </Card>
        </NuxtLink>
      </div>

      <!-- ── 3-column Widget Row ───────────────────────────────────── -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3 kc-fadein" style="animation-delay:240ms">

        <!-- Monthly Expenses -->
        <Card class="gap-4 rounded-xl px-5 py-5">
          <div class="flex items-center justify-between">
            <p class="text-[14px] font-medium text-foreground">Expenses</p>
            <p class="text-[13px] text-muted-foreground">Last 3 months</p>
          </div>
          <div class="flex flex-1 gap-3" style="min-height:200px">
            <div v-for="m in lastThreeMonths" :key="m.key" class="flex h-full flex-1 flex-col">
              <!-- Bar -->
              <div class="relative flex-1 overflow-hidden rounded-lg"
                :class="m.value === 0 ? 'month-bar-empty' : 'bg-muted/60'">
                <div
                  v-if="m.value > 0"
                  class="absolute right-0 bottom-0 left-0 rounded-lg bg-foreground transition-all duration-700"
                  :style="{ height: `${Math.max((m.value / monthlyMax) * 100, 6)}%` }"
                />
              </div>
              <!-- Label -->
              <div class="mt-3 shrink-0">
                <p class="text-sm font-medium text-foreground">{{ m.label }}</p>
                <p class="text-[13px] tabular-nums text-muted-foreground">₹{{ m.value.toLocaleString('en-IN') }}</p>
              </div>
            </div>
          </div>
        </Card>

        <!-- Recent Expenses -->
        <Card class="gap-4 rounded-xl px-5 py-5">
          <div class="flex items-center justify-between">
            <p class="text-[14px] font-medium text-foreground">Recent expenses</p>
            <Button variant="outline" size="sm" class="h-8 rounded-lg px-3 text-[13px]" as-child>
              <NuxtLink to="/app/expenses">View all</NuxtLink>
            </Button>
          </div>
          <div class="flex-1" style="min-height:200px">
            <div v-if="recentExpenses.length === 0" class="flex h-full flex-col items-center justify-center p-6 text-center">
              <p class="mb-1 text-sm font-medium text-foreground">No expenses yet</p>
              <p class="text-[13px] leading-relaxed text-muted-foreground">Your most recent expenses will appear here.</p>
            </div>
            <div v-else class="-mx-2 flex flex-col">
              <NuxtLink
                v-for="e in recentExpenses"
                :key="e.id"
                :to="`/app/expenses/${e.id}`"
                class="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
              >
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
                >{{ expInitials(e) }}</div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">{{ e.vendor ?? e.category }}</p>
                  <p class="text-[12.5px] text-muted-foreground">{{ fmtShortDate(e.expense_date ?? e.created_at) }}</p>
                </div>
                <p class="shrink-0 text-sm font-medium tabular-nums text-foreground">₹{{ Number(e.amount).toLocaleString('en-IN') }}</p>
              </NuxtLink>
            </div>
          </div>
        </Card>

        <!-- Pending Approvals -->
        <Card class="gap-4 rounded-xl px-5 py-5">
          <div class="flex items-center justify-between">
            <p class="text-[14px] font-medium text-foreground">Pending approvals</p>
            <p class="text-[22px] font-normal leading-none tabular-nums text-foreground">{{ pendingCount }}</p>
          </div>
          <div class="flex flex-1 flex-col items-center justify-center rounded-lg bg-muted/40 p-6 text-center" style="min-height:200px">
            <template v-if="pendingCount === 0">
              <p class="mb-1 text-sm font-medium text-foreground">All caught up</p>
              <p class="text-[13px] leading-relaxed text-muted-foreground">No expenses are waiting for approval.</p>
            </template>
            <template v-else>
              <p class="mb-1 text-sm font-medium text-foreground">{{ pendingCount }} expense{{ pendingCount !== 1 ? 's' : '' }} pending</p>
              <p class="mb-4 text-[13px] leading-relaxed text-muted-foreground">Review and approve to keep things moving.</p>
              <Button class="h-9 rounded-lg px-4" as-child>
                <NuxtLink to="/app/approvals">Review now</NuxtLink>
              </Button>
            </template>
          </div>
        </Card>

      </div>

    </template>
  </AppPage>
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

</style>
