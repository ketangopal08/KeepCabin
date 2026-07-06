<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { CreditCard, Eye, Wallet } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase   = useSupabase()
const expenses   = ref<Expense[]>([])
const loading    = ref(true)
const utrInputs  = ref<Record<string, string>>({})
const submitting = ref<Set<string>>(new Set())

function catColor(cat: string) {
  const p = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % p.length
  return p[h]
}

function initials(name: string) {
  return (name ?? '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

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
  if (!utr) { toast.error('Enter a UTR / reference number'); return }
  if (submitting.value.has(id)) return
  submitting.value = new Set([...submitting.value, id])
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch<{ ok: boolean }>(`/api/expenses/${id}/pay` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { utr_number: utr },
    })
    toast.success('Payment recorded')
    await fetchPending()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to record payment')
  } finally {
    submitting.value = new Set([...submitting.value].filter(x => x !== id))
  }
}

onMounted(fetchPending)
</script>

<template>
  <div class="-m-6 flex flex-col h-full">

    <!-- Sub-toolbar -->
    <div class="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
      <Wallet class="size-4 text-muted-foreground" />
      <span class="text-[13px] font-medium text-foreground flex-1">Pending Payments</span>
      <Badge v-if="!loading && expenses.length > 0" variant="secondary" class="text-[11.5px]">
        {{ expenses.length }}
      </Badge>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col">
      <div v-for="n in 5" :key="n" class="flex items-center gap-4 px-5 py-4 border-b border-border">
        <Skeleton class="size-10 rounded-xl shrink-0" />
        <div class="flex flex-col gap-1.5 flex-1">
          <Skeleton class="h-4 w-36 rounded" />
          <Skeleton class="h-3 w-48 rounded" />
        </div>
        <Skeleton class="h-9 w-52 rounded-lg" />
        <Skeleton class="h-9 w-28 rounded-lg" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="expenses.length === 0" class="flex flex-col items-center justify-center flex-1 gap-5">
      <div class="size-[72px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
        <Wallet class="size-8 text-muted-foreground/40" />
      </div>
      <div class="text-center">
        <p class="text-[15px] font-semibold text-foreground">No pending payments</p>
        <p class="text-[13px] text-muted-foreground mt-1">Approved expenses awaiting payment will appear here.</p>
      </div>
    </div>

    <!-- Expense list -->
    <div v-else class="flex-1 overflow-auto">
      <div
        v-for="e in expenses"
        :key="e.id"
        class="flex items-center gap-4 px-5 py-4 border-b border-border hover:bg-muted/20 transition-colors"
      >
        <!-- Category avatar -->
        <div
          class="size-10 rounded-xl flex items-center justify-center text-[12px] font-bold text-white shrink-0"
          :style="{ background: catColor(e.category) }"
        >
          {{ initials(e.vendor ?? e.category) }}
        </div>

        <!-- Details -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-[13.5px] font-medium text-foreground truncate">{{ e.vendor ?? 'Expense' }}</p>
            <Badge variant="outline" class="text-[11px] shrink-0 capitalize">{{ e.category }}</Badge>
          </div>
          <p class="text-[12px] text-muted-foreground mt-0.5">
            {{ e.expense_date ? fmtDate(e.expense_date) : fmtDate(e.created_at) }}
            <template v-if="e.description"> · {{ e.description }}</template>
          </p>
        </div>

        <!-- Amount -->
        <p class="text-[15px] font-bold text-foreground shrink-0 tabular-nums">
          ₹{{ Number(e.amount).toLocaleString('en-IN') }}
        </p>

        <!-- UTR input + pay button -->
        <div class="flex items-center gap-2 shrink-0">
          <Input
            v-model="utrInputs[e.id]"
            placeholder="UTR / Reference no."
            class="w-52 text-[12.5px] font-mono h-9"
            @keydown.enter="markPaid(e.id)"
          />
          <Button
            size="sm"
            class="h-9 gap-1.5 text-[12.5px]"
            :disabled="submitting.has(e.id) || !utrInputs[e.id]?.trim()"
            @click="markPaid(e.id)"
          >
            <svg v-if="submitting.has(e.id)" class="animate-spin size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <CreditCard v-else class="size-3.5" />
            {{ submitting.has(e.id) ? 'Saving…' : 'Mark Paid' }}
          </Button>
          <Button variant="ghost" size="icon-sm" class="h-9 w-9 text-muted-foreground" as-child>
            <NuxtLink :to="`/app/expenses/${e.id}`">
              <Eye class="size-3.5" />
            </NuxtLink>
          </Button>
        </div>
      </div>
    </div>

  </div>
</template>
