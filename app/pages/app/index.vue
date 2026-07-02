<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { TrendingUp, TrendingDown } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
const expenses = ref<Expense[]>([])
const loading = ref(true)
const activeTab = ref('overview')

const currentMonth = new Date().toISOString().slice(0, 7)
const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)

const role = computed(() => ctx.value?.member?.role)

const tabs = computed(() => {
  const base = [{ id: 'overview', label: 'Overview' }]
  if (role.value === 'employee') return [...base, { id: 'expenses', label: 'My Expenses' }]
  if (role.value === 'manager')  return [...base, { id: 'expenses', label: 'Expenses' }, { id: 'team', label: 'My Team' }]
  if (role.value === 'finance')  return [...base, { id: 'expenses', label: 'All Expenses' }]
  if (role.value === 'owner')    return [...base, { id: 'expenses', label: 'All Expenses' }, { id: 'team', label: 'Team' }]
  return base
})

const totalThisMonth = computed(() =>
  expenses.value
    .filter(e => e.created_at.startsWith(currentMonth) && e.status !== 'rejected')
    .reduce((sum, e) => sum + Number(e.amount), 0)
)

const totalLastMonth = computed(() =>
  expenses.value
    .filter(e => e.created_at.startsWith(lastMonth) && e.status !== 'rejected')
    .reduce((sum, e) => sum + Number(e.amount), 0)
)

const spendTrend = computed(() => {
  if (!totalLastMonth.value) return null
  return Math.round(((totalThisMonth.value - totalLastMonth.value) / totalLastMonth.value) * 100)
})

const pendingCount = computed(() =>
  expenses.value.filter(e => ['pending_manager', 'pending_finance'].includes(e.status)).length
)

const pendingFinanceCount = computed(() =>
  expenses.value.filter(e => e.status === 'pending_finance').length
)

const paidCount = computed(() =>
  expenses.value.filter(e => e.status === 'paid').length
)

const rejectedCount = computed(() =>
  expenses.value.filter(e => e.status === 'rejected').length
)

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
    const key = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('en', { weekday: 'short' })
    const amount = expenses.value
      .filter(e => e.created_at.startsWith(key))
      .reduce((s, e) => s + Number(e.amount), 0)
    days.push({ label, amount })
  }
  return days
})
const maxDay = computed(() => Math.max(...last7Days.value.map(d => d.amount), 1))

const recentExpenses = computed(() => expenses.value.slice(0, 6))

const orgInitials = computed(() => (ctx.value?.org?.name ?? '').slice(0, 2).toUpperCase() || 'KC')
const orgColor = computed(() => {
  const colors = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
  const name = ctx.value?.org?.name ?? ''
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length
  return colors[h] ?? colors[0]
})

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function statusDot(s: string) {
  if (s === 'paid') return 'bg-emerald-400'
  if (s === 'rejected') return 'bg-red-400'
  if (s.includes('pending')) return 'bg-amber-400'
  return 'bg-gray-300'
}

async function fetchExpenses() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { await navigateTo('/login'); return }
  try {
    expenses.value = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (e: any) {
    console.error('Failed to fetch expenses', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => { await load(); await fetchExpenses() })
</script>

<template>
  <div class="-m-6 flex flex-col min-h-full">

    <!-- ── Sticky page header ── -->
    <div class="bg-white border-b border-[#ebebeb] px-7 pt-5 pb-0 sticky top-0 z-10">
      <div class="flex items-center gap-3 mb-4">
        <div
          class="size-[34px] rounded-[8px] flex items-center justify-center text-white text-[13px] font-bold shrink-0"
          :style="{ background: orgColor }"
        >
          {{ orgInitials }}
        </div>
        <h1 class="text-[21px] font-bold text-[#111] tracking-tight">
          {{ ctx?.org?.name ?? 'Dashboard' }}
        </h1>
        <span
          v-if="role"
          class="text-[11px] font-semibold px-2 py-[3px] rounded-full capitalize border"
          :class="{
            'bg-violet-50 text-violet-600 border-violet-200': role === 'owner',
            'bg-blue-50 text-blue-600 border-blue-200': role === 'manager',
            'bg-emerald-50 text-emerald-600 border-emerald-200': role === 'finance',
            'bg-gray-100 text-gray-500 border-gray-200': role === 'employee',
          }"
        >
          {{ role }}
        </span>
      </div>

      <div class="flex items-end gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'px-4 pb-2.5 text-[13px] font-medium border-b-2 transition-colors',
            activeTab === tab.id
              ? 'border-[#111] text-[#111]'
              : 'border-transparent text-gray-400 hover:text-gray-700'
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- ── Page body ── -->
    <div class="flex flex-col gap-5 px-7 py-6 flex-1">

      <!-- Loading skeleton -->
      <div v-if="loading" class="flex flex-col gap-4 animate-pulse">
        <div class="grid grid-cols-4 gap-3">
          <div v-for="n in 4" :key="n" class="h-24 rounded-xl bg-gray-100" />
        </div>
        <div class="h-52 rounded-xl bg-gray-100" />
        <div class="h-48 rounded-xl bg-gray-100" />
      </div>

      <template v-else>

        <!-- ── Stat cards ── -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-white border border-[#ebebeb]">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Spent this month</p>
            <p class="text-[26px] font-bold text-[#111] leading-none tracking-tight">
              ₹{{ totalThisMonth.toLocaleString('en-IN') }}
            </p>
            <div v-if="spendTrend !== null" class="flex items-center gap-1 mt-0.5">
              <TrendingUp v-if="spendTrend >= 0" class="size-3.5 text-emerald-500 shrink-0" />
              <TrendingDown v-else class="size-3.5 text-red-400 shrink-0" />
              <span class="text-[12px] font-semibold" :class="spendTrend >= 0 ? 'text-emerald-600' : 'text-red-500'">
                {{ spendTrend >= 0 ? '+' : '' }}{{ spendTrend }}%
              </span>
              <span class="text-[11px] text-gray-400">vs last month</span>
            </div>
            <p v-else class="text-[12px] text-gray-400">No prior month data</p>
          </div>

          <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-white border border-[#ebebeb]">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pending review</p>
            <p
              class="text-[26px] font-bold leading-none tracking-tight"
              :class="pendingCount > 0 ? 'text-amber-500' : 'text-[#111]'"
            >
              {{ pendingCount }}
            </p>
            <p class="text-[12px] text-gray-400">
              {{ pendingCount === 0 ? 'All clear' : `${pendingCount} expense${pendingCount > 1 ? 's' : ''} waiting` }}
            </p>
          </div>

          <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-white border border-[#ebebeb]">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Paid out</p>
            <p class="text-[26px] font-bold text-emerald-600 leading-none tracking-tight">{{ paidCount }}</p>
            <p class="text-[12px] text-gray-400">Fully reimbursed</p>
          </div>

          <div class="flex flex-col gap-2 px-5 py-4 rounded-xl bg-white border border-[#ebebeb]">
            <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Rejected</p>
            <p
              class="text-[26px] font-bold leading-none tracking-tight"
              :class="rejectedCount > 0 ? 'text-red-500' : 'text-[#111]'"
            >
              {{ rejectedCount }}
            </p>
            <p class="text-[12px] text-gray-400">{{ rejectedCount === 0 ? 'None declined' : 'Declined expenses' }}</p>
          </div>

        </div>

        <!-- ── Spend chart + category rank ── -->
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">

          <!-- 7-day bar chart -->
          <div class="flex flex-col gap-4 px-5 py-4 rounded-xl bg-white border border-[#ebebeb]">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-[13px] font-semibold text-[#111]">Daily spend</p>
                <p class="text-[12px] text-gray-400 mt-0.5">Last 7 days</p>
              </div>
              <span class="text-[11px] font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-md px-2 py-1">7d</span>
            </div>

            <div class="flex items-end gap-2" style="height:100px">
              <div
                v-for="day in last7Days"
                :key="day.label"
                class="flex flex-col items-center gap-1.5 flex-1"
              >
                <div class="w-full flex items-end justify-center" style="height:80px">
                  <div
                    class="w-full rounded-sm transition-all duration-700"
                    :style="{
                      height: day.amount > 0 ? `${Math.max(4, Math.round((day.amount / maxDay) * 80))}px` : '3px',
                      background: day.amount > 0 ? orgColor : '#f0f0f0',
                    }"
                  />
                </div>
                <span class="text-[10px] text-gray-400 select-none">{{ day.label }}</span>
              </div>
            </div>
          </div>

          <!-- Category rank -->
          <div class="flex flex-col px-5 py-4 rounded-xl bg-white border border-[#ebebeb]">
            <p class="text-[13px] font-semibold text-[#111] mb-3">Top categories</p>
            <div v-if="byCategory.length === 0" class="text-[12.5px] text-gray-400">No data yet.</div>
            <div
              v-for="([cat, amt], i) in byCategory.slice(0, 6)"
              :key="cat"
              class="flex items-center gap-3 py-2 border-b border-[#f7f7f7] last:border-0"
            >
              <span class="text-[12px] font-semibold text-gray-300 w-4 shrink-0 tabular-nums">{{ i + 1 }}</span>
              <span class="text-[13px] text-[#333] capitalize flex-1 truncate">{{ cat }}</span>
              <span class="text-[12px] font-semibold text-gray-600 tabular-nums">₹{{ amt.toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </div>

        <!-- ── Recent expenses ── -->
        <div class="flex flex-col rounded-xl bg-white border border-[#ebebeb] overflow-hidden">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-[#f0f0f0]">
            <p class="text-[13px] font-semibold text-[#111]">Recent expenses</p>
            <NuxtLink to="/app/expenses" class="text-[12px] text-gray-400 hover:text-gray-700 transition-colors">
              View all →
            </NuxtLink>
          </div>

          <div v-if="recentExpenses.length === 0" class="px-5 py-10 text-center text-[13px] text-gray-400">
            No expenses yet — submit your first one.
          </div>

          <NuxtLink
            v-for="e in recentExpenses"
            :key="e.id"
            :to="`/app/expenses/${e.id}`"
            class="flex items-center gap-4 px-5 py-3 border-b border-[#f7f7f7] last:border-0 hover:bg-[#fafafa] transition-colors"
          >
            <div :class="['size-2 rounded-full shrink-0', statusDot(e.status)]" />
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-[#111] truncate">{{ e.vendor ?? 'Expense' }}</p>
              <p class="text-[11.5px] text-gray-400 capitalize">{{ e.category }}</p>
            </div>
            <span class="text-[11.5px] text-gray-400 shrink-0 hidden sm:block">{{ statusLabel(e.status) }}</span>
            <span class="text-[13px] font-semibold text-[#111] shrink-0 ml-2 tabular-nums">
              ₹{{ Number(e.amount).toLocaleString('en-IN') }}
            </span>
          </NuxtLink>
        </div>

        <!-- ── Role-specific action banners ── -->
        <div
          v-if="role === 'manager' && pendingCount > 0"
          class="flex items-center justify-between px-5 py-3.5 rounded-xl bg-white border border-amber-200"
        >
          <div class="flex items-center gap-3">
            <div class="size-2 rounded-full bg-amber-400 shrink-0" />
            <p class="text-[13px] text-[#333]">
              <span class="font-semibold">{{ pendingCount }} expense{{ pendingCount > 1 ? 's' : '' }}</span>
              waiting for your approval
            </p>
          </div>
          <NuxtLink
            to="/app/approvals"
            class="text-[12px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
          >
            Review now
          </NuxtLink>
        </div>

        <div
          v-if="role === 'finance' && pendingFinanceCount > 0"
          class="flex items-center justify-between px-5 py-3.5 rounded-xl bg-white border border-blue-200"
        >
          <div class="flex items-center gap-3">
            <div class="size-2 rounded-full bg-blue-400 shrink-0" />
            <p class="text-[13px] text-[#333]">
              <span class="font-semibold">{{ pendingFinanceCount }} expense{{ pendingFinanceCount > 1 ? 's' : '' }}</span>
              pending payment
            </p>
          </div>
          <NuxtLink
            to="/app/payments"
            class="text-[12px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"
          >
            Pay now
          </NuxtLink>
        </div>

      </template>
    </div>
  </div>
</template>
