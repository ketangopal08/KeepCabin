<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route = useRoute()
const supabase = useSupabase()
const expense = ref<Expense | null>(null)

const statusLabels: Record<string, string> = {
  pending_manager: 'Pending Manager Approval',
  pending_finance: 'Pending Payment',
  paid: 'Paid',
  rejected: 'Rejected',
}

function getExpenseId(): string {
  const id = route.params.id
  if (Array.isArray(id)) return id[0] ?? ''
  return id ?? ''
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  expense.value = await $fetch<Expense>(`/api/expenses/${getExpenseId()}` as string, {
    headers: { Authorization: `Bearer ${session!.access_token}` },
  })
})
</script>

<template>
  <div v-if="expense" class="flex flex-col gap-6 max-w-lg">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">{{ expense.vendor ?? 'Expense' }}</h1>
        <p class="text-sm text-gray-500">{{ expense.expense_date ?? expense.created_at.slice(0,10) }} · {{ expense.category }}</p>
      </div>
      <span class="text-lg font-bold text-gray-900">₹{{ expense.amount.toLocaleString('en-IN') }}</span>
    </div>

    <p v-if="expense.description" class="text-sm text-gray-600">{{ expense.description }}</p>

    <div class="text-sm font-medium capitalize px-3 py-1.5 rounded-full border self-start"
      :class="{
        'bg-yellow-50 text-yellow-700 border-yellow-200': expense.status === 'pending_manager',
        'bg-blue-50 text-blue-700 border-blue-200': expense.status === 'pending_finance',
        'bg-green-50 text-green-700 border-green-200': expense.status === 'paid',
        'bg-red-50 text-red-700 border-red-200': expense.status === 'rejected',
      }"
    >{{ statusLabels[expense.status] }}</div>

    <img v-if="expense.receipt_url" :src="expense.receipt_url" class="rounded-xl border border-gray-200 max-h-64 object-contain" />

    <div v-if="expense.utr_number" class="text-sm text-gray-600">
      UTR: <span class="font-mono font-medium">{{ expense.utr_number }}</span>
    </div>

    <div v-if="expense.rejection_reason" class="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">
      Rejected: {{ expense.rejection_reason }}
    </div>

    <!-- Action log -->
    <div class="flex flex-col gap-2">
      <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wide">Activity</h2>
      <div v-for="(entry, i) in expense.action_log" :key="i"
        class="flex items-start gap-3 text-sm">
        <div class="size-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
        <div>
          <span class="font-medium text-gray-700 capitalize">{{ entry.action }}</span>
          <span class="text-gray-400"> · {{ new Date(entry.timestamp).toLocaleString('en-IN') }}</span>
          <p v-if="entry.note" class="text-gray-500 text-xs">{{ entry.note }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
