<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const expenses = ref<Expense[]>([])
const loading = ref(true)
const utrInputs = ref<Record<string, string>>({})
const submitting = ref<Set<string>>(new Set())

async function fetchPending() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    const all = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    expenses.value = all.filter(e => e.status === 'pending_finance')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to load payments')
  } finally {
    loading.value = false
  }
}

async function markPaid(id: string) {
  const utr = utrInputs.value[id]?.trim()
  if (!utr) { toast.error('Enter UTR number'); return }
  if (submitting.value.has(id)) return
  submitting.value = new Set([...submitting.value, id])
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    await $fetch<{ ok: boolean }>(`/api/expenses/${id}/pay` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { utr_number: utr },
    })
    toast.success('Payment recorded')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to record payment')
  } finally {
    submitting.value = new Set([...submitting.value].filter(x => x !== id))
    await fetchPending()
  }
}

onMounted(fetchPending)
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold text-gray-900">Payments</h1>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
    <div v-else-if="expenses.length === 0" class="text-sm text-gray-400 py-8 text-center">No pending payments.</div>

    <div v-else class="flex flex-col gap-3">
      <div v-for="e in expenses" :key="e.id" class="flex flex-col gap-3 px-4 py-4 rounded-xl border border-gray-200">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-gray-900">{{ e.vendor ?? 'Expense' }}</p>
            <p class="text-xs text-gray-400">{{ e.expense_date ?? e.created_at.slice(0,10) }} · {{ e.category }}</p>
            <p v-if="e.description" class="text-xs text-gray-500 mt-0.5">{{ e.description }}</p>
          </div>
          <span class="text-base font-bold text-gray-900">₹{{ e.amount.toLocaleString('en-IN') }}</span>
        </div>
        <div class="flex gap-2">
          <input v-model="utrInputs[e.id]" placeholder="Enter UTR / Reference number"
            class="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-gray-400 font-mono" />
          <button
            :disabled="submitting.has(e.id)"
            class="px-4 py-2 rounded-xl bg-green-700 text-white text-sm font-medium hover:bg-green-800 transition-all disabled:opacity-50"
            @click="markPaid(e.id)">
            {{ submitting.has(e.id) ? 'Saving…' : 'Mark Paid' }}
          </button>
          <NuxtLink :to="`/app/expenses/${e.id}`"
            class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
            View
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
