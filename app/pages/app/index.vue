<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import {
  TrendingUp, TrendingDown, Plus, Receipt, CheckCircle,
  UserPlus, FileDown, Users, Eye, ArrowUpRight, MoreHorizontal, Activity, UserCircle2,
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

// ── Recent expenses ───────────────────────────────────────────────────────
const recentExpenses = computed(() => expenses.value.slice(0, 6))

// ── Activity feed from expenses ───────────────────────────────────────────
const activityFeed = computed(() =>
  expenses.value.slice(0, 8).map(e => ({
    id:     e.id,
    title:  e.vendor ?? 'Expense',
    desc:   activityDesc(e.status),
    time:   formatTime(e.updated_at ?? e.created_at),
    dot:    statusColor(e.status),
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
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

function statusColor(s: string) {
  if (s === 'paid')            return 'bg-emerald-500'
  if (s === 'rejected')        return 'bg-red-500'
  if (s.includes('pending'))   return 'bg-amber-500'
  return 'bg-muted-foreground'
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
  { label: 'Submit Expense',    desc: 'Add a new expense for reimbursement',  icon: Receipt,      color: '#10b981', bg: '#d1fae5', href: '/app/expenses/new',   show: true },
  { label: 'Review Approvals',  desc: 'Approve or reject pending expenses',   icon: CheckCircle,  color: '#0ea5e9', bg: '#e0f2fe', href: '/app/approvals',      show: role.value === 'manager' || role.value === 'owner' },
  { label: 'Invite Member',     desc: 'Add someone to your organization',     icon: UserPlus,     color: '#8b5cf6', bg: '#ede9fe', href: '/app/org',             show: role.value === 'owner' },
  { label: 'View Reports',      desc: 'Download and export expense reports',  icon: FileDown,     color: '#f59e0b', bg: '#fef3c7', href: '/app/reports',         show: role.value === 'owner' || role.value === 'finance' },
  { label: 'Manage Teams',      desc: 'Organise members into teams',          icon: Users,        color: '#6366f1', bg: '#e0e7ff', href: '/app/teams',           show: role.value === 'owner' || role.value === 'manager' },
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
  <div class="flex flex-col gap-5 w-full min-w-0">

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-[17px] font-semibold text-foreground">Dashboard</h1>
        <p class="text-[12.5px] text-muted-foreground mt-0.5">
          Welcome back, <span class="text-foreground font-medium">{{ user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'there' }}</span>
        </p>
      </div>
      <Button v-if="role === 'employee'" as-child size="sm">
        <NuxtLink to="/app/expenses/new"><Plus class="size-3.5 mr-1.5" />New Expense</NuxtLink>
      </Button>
    </div>

    <!-- ── Highlight banner ─────────────────────────────────────────── -->
    <div class="relative flex items-center justify-between rounded-2xl overflow-hidden px-6 py-4 min-h-[64px]"
      style="background: linear-gradient(120deg, #fce7f3 0%, #ede9fe 45%, #dbeafe 100%);">
      <!-- soft left glow blob -->
      <div class="absolute left-0 top-0 h-full w-40 rounded-full blur-3xl opacity-60 pointer-events-none"
        style="background: radial-gradient(ellipse at left, #f9a8d4 0%, transparent 70%)" />
      <!-- text -->
      <p class="relative text-[13.5px] text-foreground/80 max-w-xl leading-relaxed">
        <span class="font-semibold text-foreground">KeepCabin</span>
        is your all-in-one platform for expense tracking, team budgets, and approval workflows — built for modern teams.
      </p>
      <!-- icon group -->
      <div class="relative flex items-center gap-2 shrink-0 ml-4">
        <div class="size-10 rounded-xl bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center shadow-sm">
          <svg class="size-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <circle cx="12" cy="12" r="10"/>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        </div>
        <div class="size-10 rounded-xl bg-white/60 backdrop-blur-sm border border-white/80 flex items-center justify-center shadow-sm">
          <svg class="size-5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- ── Loading ────────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="flex gap-3">
        <Skeleton v-for="n in 4" :key="n" class="h-20 flex-1 rounded-xl" />
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton v-for="n in 4" :key="n" class="h-24 rounded-xl" />
      </div>
      <div class="grid grid-cols-[1fr_380px] gap-4">
        <Skeleton class="h-72 rounded-xl" />
        <Skeleton class="h-72 rounded-xl" />
      </div>
      <div class="grid grid-cols-[1fr_380px] gap-4">
        <Skeleton class="h-64 rounded-xl" />
        <Skeleton class="h-64 rounded-xl" />
      </div>
    </template>

    <template v-else>

      <!-- ── Quick actions ───────────────────────────────────────────── -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <NuxtLink
          v-for="a in quickActions"
          :key="a.label"
          :to="a.href"
          class="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors group cursor-pointer"
        >
          <div class="size-9 rounded-lg flex items-center justify-center shrink-0" :style="{ background: a.bg }">
            <component :is="a.icon" class="size-[18px]" :style="{ color: a.color }" />
          </div>
          <div class="min-w-0">
            <p class="text-[13px] font-semibold text-foreground leading-tight">{{ a.label }}</p>
            <p class="text-[11px] text-muted-foreground mt-0.5 leading-tight truncate">{{ a.desc }}</p>
          </div>
        </NuxtLink>
      </div>

      <!-- ── KPI stats ───────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">

        <div class="flex flex-col gap-1.5 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Spent this month</p>
          <p class="text-[24px] font-bold text-foreground leading-none tracking-tight">
            ₹{{ totalThisMonth.toLocaleString('en-IN') }}
          </p>
          <div v-if="spendTrend !== null" class="flex items-center gap-1">
            <TrendingUp v-if="spendTrend >= 0" class="size-3.5 text-emerald-500 shrink-0" />
            <TrendingDown v-else class="size-3.5 text-red-400 shrink-0" />
            <span class="text-[11.5px] font-semibold" :class="spendTrend >= 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ spendTrend >= 0 ? '+' : '' }}{{ spendTrend }}%
            </span>
            <span class="text-[11px] text-muted-foreground">vs last month</span>
          </div>
          <p v-else class="text-[11.5px] text-muted-foreground">No prior data</p>
        </div>

        <div class="flex flex-col gap-1.5 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pending review</p>
          <p class="text-[24px] font-bold leading-none tracking-tight"
            :class="pendingCount > 0 ? 'text-amber-500' : 'text-foreground'">{{ pendingCount }}</p>
          <p class="text-[11.5px] text-muted-foreground">{{ pendingCount === 0 ? 'All clear' : `${pendingCount} waiting` }}</p>
        </div>

        <div class="flex flex-col gap-1.5 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Paid out</p>
          <p class="text-[24px] font-bold text-emerald-500 leading-none tracking-tight">{{ paidCount }}</p>
          <p class="text-[11.5px] text-muted-foreground">Fully reimbursed</p>
        </div>

        <div class="flex flex-col gap-1.5 px-5 py-4 rounded-xl bg-card border border-border">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Rejected</p>
          <p class="text-[24px] font-bold leading-none tracking-tight"
            :class="rejectedCount > 0 ? 'text-red-500' : 'text-foreground'">{{ rejectedCount }}</p>
          <p class="text-[11.5px] text-muted-foreground">{{ rejectedCount === 0 ? 'None declined' : 'Declined' }}</p>
        </div>
      </div>

      <!-- ── Row 1: Recent expenses + Teams ─────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-4">

        <!-- Recent expenses -->
        <div class="flex flex-col rounded-xl bg-card border border-border overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <p class="text-[13px] font-semibold text-foreground">Recent Expenses</p>
            <div class="flex items-center gap-2">
              <NuxtLink to="/app/expenses"
                class="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                View all <ArrowUpRight class="size-3" />
              </NuxtLink>
              <button class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <MoreHorizontal class="size-4" />
              </button>
            </div>
          </div>

          <div v-if="recentExpenses.length === 0" class="flex flex-col items-center justify-center gap-2.5 py-12">
            <div class="size-10 rounded-xl bg-muted flex items-center justify-center">
              <Receipt class="size-5 text-muted-foreground" />
            </div>
            <p class="text-[13px] font-medium text-foreground">No expenses yet</p>
            <p class="text-[12px] text-muted-foreground">Submit your first expense to get started.</p>
          </div>

          <NuxtLink
            v-for="e in recentExpenses"
            :key="e.id"
            :to="`/app/expenses/${e.id}`"
            class="flex items-center gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors group"
          >
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-foreground truncate">{{ e.vendor ?? 'Expense' }}</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-[11px] text-muted-foreground capitalize">{{ e.category }}</span>
                <span class="text-muted-foreground/40">•</span>
                <div :class="['size-1.5 rounded-full', statusColor(e.status)]" />
                <span class="text-[11px] text-muted-foreground">{{ statusLabel(e.status) }}</span>
              </div>
            </div>
            <span class="text-[12.5px] font-semibold text-foreground tabular-nums shrink-0">
              ₹{{ Number(e.amount).toLocaleString('en-IN') }}
            </span>
            <button class="p-1.5 rounded-md border border-border text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <Eye class="size-3.5" />
            </button>
          </NuxtLink>
        </div>

        <!-- Teams -->
        <div class="flex flex-col rounded-xl bg-card border border-border overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <p class="text-[13px] font-semibold text-foreground">Teams</p>
            <button class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <MoreHorizontal class="size-4" />
            </button>
          </div>

          <div v-if="teams.length === 0" class="flex flex-col items-center justify-center gap-2.5 py-12">
            <div class="size-10 rounded-xl bg-muted flex items-center justify-center">
              <Users class="size-5 text-muted-foreground" />
            </div>
            <p class="text-[13px] font-medium text-foreground">No teams yet</p>
            <p class="text-[12px] text-muted-foreground">Create a team to organise your members.</p>
          </div>

          <div class="grid grid-cols-2 gap-px bg-border">
            <NuxtLink
              v-for="t in teams.slice(0, 6)"
              :key="t.id"
              :to="`/app/teams/${t.id}`"
              class="flex flex-col gap-2 p-4 bg-card hover:bg-muted/40 transition-colors"
            >
              <TeamAvatar :name="t.name" />
              <div>
                <p class="text-[12.5px] font-semibold text-foreground leading-tight truncate">{{ t.name }}</p>
                <p class="text-[11px] text-muted-foreground mt-0.5">
                  {{ teamExpenseCount(t.id) }} expense{{ teamExpenseCount(t.id) === 1 ? '' : 's' }}
                </p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- ── Row 2: Activity + Members ──────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] gap-4">

        <!-- Recent activity -->
        <div class="flex flex-col rounded-xl bg-card border border-border overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <p class="text-[13px] font-semibold text-foreground">Recent Activity</p>
            <NuxtLink to="/app/expenses"
              class="text-[12px] text-primary font-medium hover:underline">
              View All
            </NuxtLink>
          </div>

          <div v-if="activityFeed.length === 0" class="flex flex-col items-center justify-center gap-2.5 py-12">
            <div class="size-10 rounded-xl bg-muted flex items-center justify-center">
              <Activity class="size-5 text-muted-foreground" />
            </div>
            <p class="text-[13px] font-medium text-foreground">No activity yet</p>
            <p class="text-[12px] text-muted-foreground">Activity will appear here as expenses are submitted.</p>
          </div>

          <div class="flex flex-col">
            <div
              v-for="(item, idx) in activityFeed"
              :key="item.id"
              class="flex gap-3 px-5 py-3.5 border-b border-border last:border-0"
            >
              <!-- timeline dot + line -->
              <div class="flex flex-col items-center shrink-0 pt-1">
                <div :class="['size-2 rounded-full shrink-0', item.dot]" />
                <div v-if="idx < activityFeed.length - 1" class="w-px flex-1 bg-border mt-1.5" />
              </div>
              <div class="flex-1 min-w-0 pb-1">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-[13px] font-medium text-foreground truncate">{{ item.title }}</p>
                    <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{{ item.desc }}</p>
                  </div>
                  <span class="text-[11px] text-muted-foreground shrink-0 mt-0.5">{{ item.time }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1.5">
                  <Badge variant="outline" class="text-[10.5px] h-5 px-1.5">{{ statusLabel(item.status) }}</Badge>
                  <span class="text-[12px] font-semibold text-foreground tabular-nums">₹{{ item.amount.toLocaleString('en-IN') }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Members -->
        <div class="flex flex-col rounded-xl bg-card border border-border overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <p class="text-[13px] font-semibold text-foreground">
              Members <span class="text-muted-foreground font-normal">({{ members.length }})</span>
            </p>
            <div class="flex items-center gap-2">
              <NuxtLink v-if="role === 'owner'" to="/app/org"
                class="size-6 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
                <Plus class="size-3.5" />
              </NuxtLink>
              <button class="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <MoreHorizontal class="size-4" />
              </button>
            </div>
          </div>

          <div v-if="members.length === 0" class="flex flex-col items-center justify-center gap-2.5 py-12">
            <div class="size-10 rounded-xl bg-muted flex items-center justify-center">
              <UserCircle2 class="size-5 text-muted-foreground" />
            </div>
            <p class="text-[13px] font-medium text-foreground">No members yet</p>
            <p class="text-[12px] text-muted-foreground">Invite people to join your organization.</p>
          </div>

          <div class="grid grid-cols-3 gap-px bg-border">
            <div
              v-for="m in members.slice(0, 9)"
              :key="m.id"
              class="flex flex-col items-center gap-2 py-4 px-2 bg-card hover:bg-muted/40 transition-colors"
            >
              <div
                class="size-12 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0"
                :style="{ background: memberColor(memberName(m)) }"
              >
                {{ memberInitials(memberName(m)) }}
              </div>
              <div class="text-center min-w-0 w-full">
                <p class="text-[12px] font-medium text-foreground truncate px-1">{{ memberName(m) }}</p>
                <p class="text-[10.5px] text-muted-foreground truncate px-1">{{ m.email }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Role banners ────────────────────────────────────────────── -->
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
