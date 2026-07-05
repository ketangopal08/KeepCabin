<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import {
  TrendingUp, TrendingDown, Plus, Receipt, CheckCircle,
  UserPlus, FileDown, Users, Eye, ArrowUpRight, MoreHorizontal,
  Activity, UserCircle2, ChevronLeft, ChevronRight, Zap,
} from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase  = useSupabase()
const { ctx, user, load } = useOrgContext()
const expenses  = ref<Expense[]>([])
const teams     = ref<{ id: string; name: string; created_at?: string }[]>([])
const members   = ref<any[]>([])
const loading   = ref(true)

const currentMonth = new Date().toISOString().slice(0, 7)
const lastMonth    = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

const role = computed(() => ctx.value?.member?.role)

// ── KPI ───────────────────────────────────────────────────────────────────
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

// ── Recent / top pending ──────────────────────────────────────────────────
const recentExpenses = computed(() => expenses.value.slice(0, 6))
const topPending     = computed(() => expenses.value.filter(e => e.status.includes('pending')).slice(0, 2))

// ── Progress ──────────────────────────────────────────────────────────────
const resolvedCount  = computed(() => expenses.value.filter(e => e.status === 'paid').length)
const resolutionRate = computed(() => {
  if (!expenses.value.length) return 0
  return Math.round((resolvedCount.value / expenses.value.length) * 100)
})

// ── Tip carousel ──────────────────────────────────────────────────────────
const tipIndex = ref(0)
const tips = computed(() => {
  const t: string[] = []
  if (pendingCount.value > 0)
    t.push(`There ${pendingCount.value === 1 ? 'is' : 'are'} ${pendingCount.value} expense${pendingCount.value > 1 ? 's' : ''} pending review.`)
  if (totalThisMonth.value > 0)
    t.push(`You've tracked ₹${totalThisMonth.value.toLocaleString('en-IN')} in expenses this month.`)
  if (members.value.length > 0)
    t.push(`Your org has ${members.value.length} member${members.value.length > 1 ? 's' : ''} across ${teams.value.length} team${teams.value.length > 1 ? 's' : ''}.`)
  if (t.length === 0) t.push('Submit your first expense to start tracking.')
  return t
})
const currentTip = computed(() => tips.value[tipIndex.value % Math.max(tips.value.length, 1)])
function nextTip() { tipIndex.value = (tipIndex.value + 1) % Math.max(tips.value.length, 1) }
function prevTip() { tipIndex.value = (tipIndex.value - 1 + Math.max(tips.value.length, 1)) % Math.max(tips.value.length, 1) }

// ── Formatted date ────────────────────────────────────────────────────────
const formattedDate = computed(() =>
  new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
)

// ── Activity feed from expenses ───────────────────────────────────────────
const activityFeed = computed(() =>
  expenses.value.slice(0, 8).map(e => ({
    id:     e.id,
    title:  e.vendor ?? 'Expense',
    desc:   activityDesc(e.status),
    time:   formatTime(e.updated_at ?? e.created_at),
    amount: Number(e.amount),
    status: e.status,
  }))
)

function activityDesc(s: string) {
  if (s === 'paid')            return 'Reimbursement processed and marked paid.'
  if (s === 'rejected')        return 'Expense was declined by a reviewer.'
  if (s === 'pending_finance') return 'Approved by manager, awaiting payment.'
  if (s === 'pending_manager') return 'Submitted and waiting for manager approval.'
  return 'Expense updated.'
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function statusColor(s: string) {
  if (s === 'paid')          return '#10b981'
  if (s === 'rejected')      return '#ef4444'
  if (s.includes('pending')) return '#f59e0b'
  return '#9ca3af'
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

// ── Member helpers ────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#ef4444','#14b8a6']

function memberColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h] ?? AVATAR_COLORS[0]
}

function memberInitials(name: string) {
  if (!name) return '?'
  return name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function memberName(m: any): string {
  return m.user_metadata?.full_name ?? m.email?.split('@')[0] ?? 'Member'
}

// ── Quick actions ─────────────────────────────────────────────────────────
const quickActions = computed(() => [
  { label: 'Submit Expense',   icon: Receipt,     color: '#ffffff', bg: 'linear-gradient(135deg, #f43f5e, #fb923c)', href: '/app/expenses/new',  show: true },
  { label: 'Review Approvals', icon: CheckCircle, color: '#ffffff', bg: 'linear-gradient(135deg, #06b6d4, #3b82f6)', href: '/app/approvals',     show: role.value === 'manager' || role.value === 'owner' },
  { label: 'Invite Member',    icon: UserPlus,    color: '#ffffff', bg: 'linear-gradient(135deg, #a855f7, #6366f1)', href: '/app/org',            show: role.value === 'owner' },
  { label: 'View Reports',     icon: FileDown,    color: '#ffffff', bg: 'linear-gradient(135deg, #f97316, #eab308)', href: '/app/reports',        show: role.value === 'owner' || role.value === 'finance' },
  { label: 'Manage Teams',     icon: Users,       color: '#ffffff', bg: 'linear-gradient(135deg, #14b8a6, #10b981)', href: '/app/teams',          show: role.value === 'owner' || role.value === 'manager' },
].filter(a => a.show))

// ── Team expense count helper ─────────────────────────────────────────────
function teamExpenseCount(teamId: string) {
  return expenses.value.filter(e => (e as any).team_id === teamId).length
}

// ── Data fetching ─────────────────────────────────────────────────────────
async function fetchAll() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { await navigateTo('/login'); return }
  const h = { Authorization: `Bearer ${session.access_token}` }
  await Promise.all([
    $fetch<Expense[]>('/api/expenses', { headers: h }).then(d => { expenses.value = d }).catch(() => {}),
    $fetch<any[]>('/api/teams',   { headers: h }).then(d => { teams.value = d }).catch(() => {}),
    $fetch<any[]>('/api/members', { headers: h }).then(d => { members.value = d }).catch(() => {}),
  ])
  loading.value = false
}

onMounted(async () => { await load(); await fetchAll() })
</script>

<template>
  <div class="flex flex-col w-full min-w-0 px-28">
    <div class="w-full max-w-5xl mx-auto flex flex-col gap-5">

      <!-- ── Date heading ──────────────────────────────────────────────── -->
      <h1 class="text-[22px] font-bold text-foreground tracking-tight">{{ formattedDate }}</h1>

      <!-- ── Loading ──────────────────────────────────────────────────── -->
      <template v-if="loading">
        <div class="grid grid-cols-[1fr_280px] gap-5 items-start">
          <div class="flex flex-col gap-4">
            <Skeleton class="h-36 rounded-2xl" />
            <Skeleton class="h-11 rounded-xl" />
            <Skeleton class="h-36 rounded-xl" />
            <Skeleton class="h-48 rounded-xl" />
            <Skeleton class="h-48 rounded-xl" />
          </div>
          <div class="flex flex-col gap-4">
            <Skeleton class="h-6 w-36 rounded" />
            <Skeleton class="h-24 rounded-xl" />
            <Skeleton class="h-24 rounded-xl" />
            <Skeleton class="h-24 rounded-xl" />
          </div>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-[1fr_272px] gap-5 items-start">

          <!-- ════════════════ LEFT COLUMN ════════════════ -->
          <div class="flex flex-col gap-4">

            <!-- Quick actions card -->
            <div class="rounded-2xl p-4 bg-muted">
              <p class="text-[12.5px] font-semibold mb-3 text-muted-foreground">Quick actions:</p>
              <div :class="['grid gap-2', quickActions.length <= 3 ? 'grid-cols-3' : quickActions.length === 4 ? 'grid-cols-4' : 'grid-cols-5']">
                <NuxtLink
                  v-for="a in quickActions"
                  :key="a.label"
                  :to="a.href"
                  class="flex flex-col items-center gap-2.5 px-2 py-3.5 rounded-xl bg-card hover:shadow-md hover:-translate-y-0.5 transition-all text-center"
                  style="border: 1px solid rgba(0,0,0,0.06);"
                >
                  <div class="size-8 rounded-lg flex items-center justify-center shrink-0" :style="{ background: a.bg }">
                    <component :is="a.icon" class="size-4" :style="{ color: a.color }" />
                  </div>
                  <span class="text-[12px] font-medium text-foreground leading-tight">{{ a.label }}</span>
                </NuxtLink>
              </div>
            </div>

            <!-- Tip bar -->
            <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-muted">
              <p class="text-[13px] flex-1 leading-snug text-foreground/80">
                <span class="font-semibold">Tip:</span> {{ currentTip }}
              </p>
              <div class="flex items-center gap-1.5 ml-4 shrink-0">
                <span class="text-[12px] tabular-nums text-muted-foreground">
                  {{ (tipIndex % Math.max(tips.length, 1)) + 1 }}/{{ tips.length }}
                </span>
                <button
                  class="size-6 flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors"
                  @click="prevTip"
                >
                  <ChevronLeft class="size-3.5 text-muted-foreground" />
                </button>
                <button
                  class="size-6 flex items-center justify-center rounded-full hover:bg-foreground/10 transition-colors"
                  @click="nextTip"
                >
                  <ChevronRight class="size-3.5 text-muted-foreground" />
                </button>
              </div>
            </div>

            <!-- Featured expense + progress -->
            <div class="rounded-2xl p-4 flex flex-col gap-3 bg-muted">

              <!-- Top recent expense action card -->
              <NuxtLink
                v-if="recentExpenses.length > 0"
                :to="`/app/expenses/${recentExpenses[0].id}`"
                class="flex items-center gap-4 p-4 rounded-xl bg-card hover:shadow-sm transition-all"
                style="border: 1px solid rgba(0,0,0,0.06);"
              >
                <div class="size-10 rounded-xl flex items-center justify-center shrink-0" style="background: #e0e7ff;">
                  <Receipt class="size-5" style="color: #6366f1;" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[13.5px] font-semibold text-foreground truncate">{{ recentExpenses[0].vendor ?? 'Expense' }}</p>
                  <p class="text-[12px] text-muted-foreground mt-0.5">
                    ₹{{ Number(recentExpenses[0].amount).toLocaleString('en-IN') }} · {{ recentExpenses[0].category }}
                  </p>
                </div>
                <Button size="sm" class="shrink-0 text-[12px]">View</Button>
              </NuxtLink>

              <div v-else class="flex items-center gap-4 p-4 rounded-xl bg-card/70">
                <p class="text-[13px] text-muted-foreground">No expenses yet — submit your first one.</p>
              </div>

              <!-- Expense overview progress -->
              <div class="px-1">
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <p class="text-[13.5px] font-semibold text-foreground">Expense Overview</p>
                    <span class="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style="background: #d1fae5; color: #065f46;">
                      <Activity class="size-3" />
                      {{ resolvedCount }}/{{ expenses.length }}
                    </span>
                  </div>
                  <NuxtLink to="/app/expenses" class="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowUpRight class="size-3.5" /> Show more
                  </NuxtLink>
                </div>
                <p class="text-[12px] text-muted-foreground mb-2.5">Track your expense reimbursement progress</p>
                <div class="relative h-2 rounded-full overflow-hidden bg-foreground/10">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    style="background: #10b981;"
                    :style="{ width: resolutionRate + '%' }"
                  />
                </div>
                <p class="text-[12px] text-muted-foreground mt-1.5 text-right">{{ resolutionRate }}% complete</p>
              </div>
            </div>

            <!-- Recommendations -->
            <div>
              <div class="flex items-center gap-2.5 mb-1.5">
                <p class="text-[17px] font-semibold text-foreground">Recommendations</p>
                <span class="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style="background: #ede9fe; color: #6d28d9;">
                  <Zap class="size-3" /> AI Assistant
                </span>
              </div>
              <p class="text-[12.5px] text-muted-foreground mb-3">Your highest priority expenses needing attention.</p>

              <div v-if="topPending.length === 0" class="rounded-xl bg-muted/30 py-10 flex items-center justify-center">
                <p class="text-[13px] text-muted-foreground">No pending expenses — you're all caught up!</p>
              </div>

              <div v-else class="grid grid-cols-2 gap-3">
                <NuxtLink
                  v-for="(e, i) in topPending"
                  :key="e.id"
                  :to="`/app/expenses/${e.id}`"
                  class="relative flex flex-col gap-3 p-4 rounded-2xl overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all"
                  :style="i === 0
                    ? 'background: linear-gradient(135deg, #fef3c7 0%, #fde68a 60%)'
                    : 'background: linear-gradient(135deg, #ede9fe 0%, #ddd6fe 60%)'"
                >
                  <ArrowUpRight class="absolute top-3 right-3 size-4" style="color: rgba(0,0,0,0.2);" />
                  <div
                    class="size-9 rounded-xl flex items-center justify-center"
                    :style="i === 0 ? 'background: rgba(245,158,11,0.2)' : 'background: rgba(139,92,246,0.2)'"
                  >
                    <Receipt class="size-4" :style="i === 0 ? 'color:#d97706' : 'color:#7c3aed'" />
                  </div>
                  <div>
                    <p class="text-[13.5px] font-semibold text-foreground leading-tight truncate pr-5">{{ e.vendor ?? 'Expense' }}</p>
                    <p class="text-[12px] mt-0.5" :style="i === 0 ? 'color:#92400e' : 'color:#5b21b6'">
                      ₹{{ Number(e.amount).toLocaleString('en-IN') }} · {{ e.category }}
                    </p>
                  </div>
                  <span
                    class="inline-flex items-center gap-1 self-start text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                    :style="i === 0
                      ? 'background: rgba(245,158,11,0.25); color: #92400e;'
                      : 'background: rgba(139,92,246,0.2); color: #5b21b6;'"
                  >
                    <span>{{ i === 0 ? '↑' : '=' }}</span>
                    {{ i === 0 ? 'High' : 'Medium' }}
                  </span>
                </NuxtLink>
              </div>
            </div>

            <!-- Role alert banners -->
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

          </div><!-- end left column -->

          <!-- ════════════════ RIGHT COLUMN ════════════════ -->
          <div class="flex flex-col gap-4 sticky top-0">
            <!-- <p class="text-[17px] font-semibold text-foreground">Recent Activity</p> -->

            <div v-if="activityFeed.length === 0" class="rounded-xl bg-card border border-border py-12 flex flex-col items-center justify-center gap-2">
              <Activity class="size-8 text-muted-foreground/40" />
              <p class="text-[12.5px] text-muted-foreground">No activity yet</p>
            </div>

            <div v-else class="flex flex-col gap-4">
              <div
                v-for="item in activityFeed.slice(0, 6)"
                :key="item.id"
                class="flex flex-col gap-1"
              >
                <!-- name row -->
                <div class="flex items-center gap-2.5">
                  <div
                    class="size-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    :style="{ background: statusColor(item.status) }"
                  >
                    {{ (item.title[0] ?? '?').toUpperCase() }}
                  </div>
                  <p class="text-[13px] font-semibold text-foreground flex-1 truncate">{{ item.title }}</p>
                  <span
                    class="text-[10.5px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    :style="item.status === 'paid'
                      ? 'background:#d1fae5;color:#065f46'
                      : item.status === 'rejected'
                        ? 'background:#fee2e2;color:#991b1b'
                        : 'background:#fef3c7;color:#92400e'"
                  >
                    {{ statusLabel(item.status) }}
                  </span>
                </div>
                <!-- description -->
                <p class="text-[12px] text-muted-foreground pl-[42px] leading-snug">{{ item.desc }}</p>
                <!-- amount + time -->
                <div class="flex items-center justify-between pl-[42px]">
                  <span class="text-[11px] text-muted-foreground">{{ item.time }}</span>
                  <span class="text-[12px] font-semibold text-foreground tabular-nums">₹{{ item.amount.toLocaleString('en-IN') }}</span>
                </div>
                <Separator class="mt-1" />
              </div>
            </div>

          </div><!-- end right column -->

        </div>
      </template>

    </div>
  </div>
</template>
