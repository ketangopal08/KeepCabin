<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
const expenses = ref<Expense[]>([])
const loading = ref(true)

const currentMonth = new Date().toISOString().slice(0, 7)

const totalThisMonth = computed(() =>
  expenses.value
    .filter(e => e.created_at.startsWith(currentMonth) && e.status !== 'rejected')
    .reduce((sum, e) => sum + Number(e.amount), 0)
)

const pendingCount = computed(() =>
  expenses.value.filter(e => ['pending_manager', 'pending_finance'].includes(e.status)).length
)

const pendingFinanceCount = computed(() =>
  expenses.value.filter(e => e.status === 'pending_finance').length
)

const paidCount = computed(() =>
  expenses.value.filter(e => e.status === 'paid').length
)

const byCategory = computed(() => {
  const map: Record<string, number> = {}
  for (const e of expenses.value) {
    if (e.status === 'rejected') continue
    map[e.category] = (map[e.category] ?? 0) + Number(e.amount)
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1])
})

const recentExpenses = computed(() => expenses.value.slice(0, 5))

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
  <div class="flex flex-col gap-6">
    <div>
      <h1 class="text-xl font-semibold text-gray-900">Dashboard</h1>
      <p class="text-sm text-gray-500 capitalize">{{ ctx?.org?.name }} · {{ ctx?.member?.role }}</p>
    </div>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

    <template v-else>
      <!-- Stats row -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="flex flex-col gap-1 px-5 py-4 rounded-xl border border-gray-200">
          <p class="text-xs text-gray-400 uppercase tracking-wide">Spent this month</p>
          <p class="text-2xl font-bold text-gray-900">₹{{ totalThisMonth.toLocaleString('en-IN') }}</p>
        </div>
        <div class="flex flex-col gap-1 px-5 py-4 rounded-xl border border-gray-200">
          <p class="text-xs text-gray-400 uppercase tracking-wide">Pending</p>
          <p class="text-2xl font-bold text-yellow-600">{{ pendingCount }}</p>
        </div>
        <div class="flex flex-col gap-1 px-5 py-4 rounded-xl border border-gray-200">
          <p class="text-xs text-gray-400 uppercase tracking-wide">Paid</p>
          <p class="text-2xl font-bold text-green-600">{{ paidCount }}</p>
        </div>
      </div>

      <!-- Spend by category -->
      <div class="flex flex-col gap-3 px-5 py-4 rounded-xl border border-gray-200">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Spend by category</p>
        <div v-if="byCategory.length === 0" class="text-sm text-gray-400">No data yet.</div>
        <div v-for="[cat, amt] in byCategory" :key="cat" class="flex items-center gap-3">
          <span class="text-sm text-gray-700 capitalize w-28 shrink-0">{{ cat }}</span>
          <div class="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div class="h-2 rounded-full bg-gray-900"
              :style="{ width: `${Math.round((amt / (totalThisMonth || 1)) * 100)}%` }" />
          </div>
          <span class="text-sm font-medium text-gray-700 w-24 text-right">₹{{ amt.toLocaleString('en-IN') }}</span>
        </div>
      </div>

      <!-- Recent expenses -->
      <div class="flex flex-col gap-2">
        <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recent expenses</p>
        <NuxtLink v-for="e in recentExpenses" :key="e.id" :to="`/app/expenses/${e.id}`"
          class="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all">
          <div>
            <p class="text-sm font-medium text-gray-900">{{ e.vendor ?? 'Expense' }}</p>
            <p class="text-xs text-gray-400 capitalize">{{ e.category }} · {{ e.status.replaceAll('_', ' ') }}</p>
          </div>
          <span class="text-sm font-semibold text-gray-900">₹{{ Number(e.amount).toLocaleString('en-IN') }}</span>
        </NuxtLink>
      </div>

      <!-- Quick action for manager/finance -->
      <div v-if="ctx?.member?.role === 'manager' && pendingCount > 0"
        class="flex items-center justify-between px-4 py-3 rounded-xl bg-yellow-50 border border-yellow-200">
        <p class="text-sm font-medium text-yellow-800">{{ pendingCount }} expense{{ pendingCount > 1 ? 's' : '' }} waiting for your approval</p>
        <NuxtLink to="/app/approvals" class="text-sm font-medium text-yellow-700 hover:text-yellow-900 transition-colors">Review →</NuxtLink>
      </div>

      <div v-if="ctx?.member?.role === 'finance' && pendingFinanceCount > 0"
        class="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50 border border-blue-200">
        <p class="text-sm font-medium text-blue-800">{{ pendingFinanceCount }} expense{{ pendingFinanceCount > 1 ? 's' : '' }} pending payment</p>
        <NuxtLink to="/app/payments" class="text-sm font-medium text-blue-700 hover:text-blue-900 transition-colors">Pay now →</NuxtLink>
      </div>
    </template>
  </div>
</template>
