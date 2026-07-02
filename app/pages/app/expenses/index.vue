<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load } = useOrgContext()
const expenses = ref<Expense[]>([])
const loading = ref(true)

const statusColors: Record<string, string> = {
  pending_manager: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  pending_finance: 'bg-blue-50 text-blue-700 border-blue-200',
  paid: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

const statusLabels: Record<string, string> = {
  pending_manager: 'Pending Manager',
  pending_finance: 'Pending Finance',
  paid: 'Paid',
  rejected: 'Rejected',
}

async function fetchExpenses() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    expenses.value = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (e: any) {
    console.error('Failed to load expenses:', e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => { await load(); await fetchExpenses() })
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold text-gray-900">Expenses</h1>
      <NuxtLink v-if="ctx?.member?.role === 'employee'" to="/app/expenses/new"
        class="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all">
        + Submit
      </NuxtLink>
    </div>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>

    <div v-else-if="expenses.length === 0" class="text-sm text-gray-400 py-8 text-center">
      No expenses yet.
    </div>

    <div v-else class="flex flex-col gap-2">
      <NuxtLink v-for="e in expenses" :key="e.id" :to="`/app/expenses/${e.id}`"
        class="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
        <div class="flex flex-col gap-0.5">
          <span class="text-sm font-medium text-gray-900">{{ e.vendor ?? 'Expense' }}</span>
          <span class="text-xs text-gray-400">{{ e.expense_date ?? e.created_at.slice(0,10) }} · {{ e.category }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-gray-900">₹{{ e.amount.toLocaleString('en-IN') }}</span>
          <span :class="['text-xs px-2.5 py-0.5 rounded-full border font-medium', statusColors[e.status]]">
            {{ statusLabels[e.status] }}
          </span>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
