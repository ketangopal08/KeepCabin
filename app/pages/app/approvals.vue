<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const expenses = ref<Expense[]>([])
const loading = ref(true)
const rejectingId = ref<string | null>(null)
const rejectReason = ref('')

async function fetchPending() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    const all = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    expenses.value = all.filter(e => e.status === 'pending_manager')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to load approvals')
  } finally {
    loading.value = false
  }
}

async function approve(id: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    await $fetch<{ ok: boolean }>(`/api/expenses/${id}/approve` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    toast.success('Expense approved')
    await fetchPending()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to approve expense')
  }
}

async function reject(id: string) {
  if (!rejectReason.value.trim()) { toast.error('Enter a reason'); return }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    await $fetch<{ ok: boolean }>(`/api/expenses/${id}/reject` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { reason: rejectReason.value.trim() },
    })
    toast.success('Expense rejected')
    rejectingId.value = null
    rejectReason.value = ''
    await fetchPending()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to reject expense')
  }
}

onMounted(fetchPending)
</script>

<template>
  <div class="flex flex-col gap-4">
    <h1 class="text-xl font-semibold text-gray-900">Approvals</h1>

    <div v-if="loading" class="text-sm text-gray-400">Loading…</div>
    <div v-else-if="expenses.length === 0" class="text-sm text-gray-400 py-8 text-center">No pending approvals.</div>

    <div v-else class="flex flex-col gap-3">
      <div v-for="e in expenses" :key="e.id"
        class="flex flex-col gap-3 px-4 py-4 rounded-xl border border-gray-200">
        <div class="flex items-start justify-between">
          <div>
            <p class="text-sm font-medium text-gray-900">{{ e.vendor ?? 'Expense' }}</p>
            <p class="text-xs text-gray-400">{{ e.expense_date ?? e.created_at.slice(0,10) }} · {{ e.category }}</p>
            <p v-if="e.description" class="text-xs text-gray-500 mt-0.5">{{ e.description }}</p>
          </div>
          <span class="text-base font-bold text-gray-900">₹{{ e.amount.toLocaleString('en-IN') }}</span>
        </div>

        <img v-if="e.receipt_url" :src="e.receipt_url" class="rounded-lg max-h-40 object-contain self-start border border-gray-100" />

        <!-- Reject reason input -->
        <div v-if="rejectingId === e.id" class="flex gap-2">
          <input v-model="rejectReason" placeholder="Reason for rejection…"
            class="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200 outline-none focus:border-red-400" />
          <button class="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-all"
            @click="reject(e.id)">Confirm</button>
          <button class="px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            @click="rejectingId = null; rejectReason = ''">Cancel</button>
        </div>

        <div v-else class="flex gap-2">
          <button class="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all"
            @click="approve(e.id)">Approve</button>
          <button class="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-all"
            @click="rejectingId = e.id">Reject</button>
          <NuxtLink :to="`/app/expenses/${e.id}`" class="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-all">
            View
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
