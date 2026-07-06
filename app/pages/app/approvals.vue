<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { Check, X, Eye, ClipboardList } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase     = useSupabase()
const expenses     = ref<Expense[]>([])
const loading      = ref(true)
const rejectingId  = ref<string | null>(null)
const rejectReason = ref('')
const approving    = ref<Set<string>>(new Set())
const rejecting    = ref<Set<string>>(new Set())

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
    expenses.value = all.filter(e => e.status === 'pending_manager')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to load approvals')
  } finally {
    loading.value = false
  }
}

async function approve(id: string) {
  approving.value = new Set([...approving.value, id])
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch<{ ok: boolean }>(`/api/expenses/${id}/approve` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    toast.success('Expense approved')
    await fetchPending()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to approve')
  } finally {
    approving.value = new Set([...approving.value].filter(x => x !== id))
  }
}

async function reject(id: string) {
  if (!rejectReason.value.trim()) { toast.error('Enter a rejection reason'); return }
  rejecting.value = new Set([...rejecting.value, id])
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
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
    toast.error(e?.data?.message ?? 'Failed to reject')
  } finally {
    rejecting.value = new Set([...rejecting.value].filter(x => x !== id))
  }
}

onMounted(fetchPending)
</script>

<template>
  <div class="-m-6 flex flex-col h-full">

    <!-- Sub-toolbar -->
    <div class="flex items-center gap-2 px-5 py-2.5 border-b border-border bg-background shrink-0">
      <ClipboardList class="size-4 text-muted-foreground" />
      <span class="text-[13px] font-medium text-foreground flex-1">Pending Approvals</span>
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
        <Skeleton class="h-5 w-20 rounded-full" />
        <Skeleton class="h-8 w-24 rounded-lg" />
        <Skeleton class="h-8 w-20 rounded-lg" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="expenses.length === 0" class="flex flex-col items-center justify-center flex-1 gap-5">
      <div class="size-[72px] rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
        <ClipboardList class="size-8 text-muted-foreground/40" />
      </div>
      <div class="text-center">
        <p class="text-[15px] font-semibold text-foreground">No pending approvals</p>
        <p class="text-[13px] text-muted-foreground mt-1">Expenses submitted by your team will appear here.</p>
      </div>
    </div>

    <!-- Expense list -->
    <div v-else class="flex-1 overflow-auto">
      <div
        v-for="e in expenses"
        :key="e.id"
        class="flex flex-col border-b border-border hover:bg-muted/20 transition-colors"
      >
        <!-- Main row -->
        <div class="flex items-center gap-4 px-5 py-4">
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

          <!-- Actions -->
          <div class="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              class="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-[12.5px]"
              :disabled="approving.has(e.id)"
              @click="approve(e.id)"
            >
              <svg v-if="approving.has(e.id)" class="animate-spin size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <Check v-else class="size-3.5" />
              {{ approving.has(e.id) ? 'Approving…' : 'Approve' }}
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20 text-[12.5px]"
              @click="rejectingId = rejectingId === e.id ? null : e.id; rejectReason = ''"
            >
              <X class="size-3.5" /> Reject
            </Button>
            <Button variant="ghost" size="icon-sm" class="h-8 w-8 text-muted-foreground" as-child>
              <NuxtLink :to="`/app/expenses/${e.id}`">
                <Eye class="size-3.5" />
              </NuxtLink>
            </Button>
          </div>
        </div>

        <!-- Reject reason input (inline expand) -->
        <div
          v-if="rejectingId === e.id"
          class="px-5 pb-4 flex gap-2"
        >
          <Input
            v-model="rejectReason"
            placeholder="Reason for rejection…"
            class="text-[13px]"
            @keydown.enter="reject(e.id)"
            @keydown.escape="rejectingId = null; rejectReason = ''"
          />
          <Button
            variant="destructive"
            size="sm"
            class="h-9 shrink-0"
            :disabled="rejecting.has(e.id) || !rejectReason.trim()"
            @click="reject(e.id)"
          >
            <svg v-if="rejecting.has(e.id)" class="animate-spin size-3.5 mr-1 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            {{ rejecting.has(e.id) ? 'Rejecting…' : 'Confirm' }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="h-9 shrink-0"
            @click="rejectingId = null; rejectReason = ''"
          >Cancel</Button>
        </div>
      </div>
    </div>

  </div>
</template>
