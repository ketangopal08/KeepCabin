<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase   = useSupabase()
const expenses   = ref<Expense[]>([])
const loading    = ref(true)
const utrInputs  = ref<Record<string, string>>({})
const submitting = ref<Set<string>>(new Set())
const search     = ref('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return expenses.value
  return expenses.value.filter(e =>
    (e.vendor ?? '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  )
})

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
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Payments" description="Record payments for approved expenses." />

    <!-- Tabs -->
    <AppPageTabs model-value="pending" :tabs="[{ id: 'pending', label: 'Pending payment', count: loading ? undefined : expenses.length }]" />

    <!-- Search -->
    <AppSearchInput v-model="search" placeholder="Search by vendor or category" class="mb-4" />

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col">
      <div v-for="n in 5" :key="n" class="flex items-center gap-4 border-b border-border px-2 py-4">
        <Skeleton class="size-9 shrink-0 rounded-lg" />
        <div class="flex flex-1 flex-col gap-1.5">
          <Skeleton class="h-4 w-36 rounded" />
          <Skeleton class="h-3 w-48 rounded" />
        </div>
        <Skeleton class="h-9 w-52 rounded-lg" />
        <Skeleton class="h-9 w-28 rounded-lg" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
      <Icon name="solar:wallet-linear" class="size-7 text-muted-foreground" />
      <p class="text-[15px] text-foreground">{{ search ? 'No matching expenses' : 'No pending payments' }}</p>
      <p class="-mt-1.5 text-sm text-muted-foreground">
        {{ search ? 'Try a different search term.' : 'Approved expenses awaiting payment will appear here.' }}
      </p>
    </div>

    <!-- Expense table -->
    <Table v-else>
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead class="h-11 px-2 font-normal text-muted-foreground">Name</TableHead>
          <TableHead class="h-11 font-normal text-muted-foreground">Category</TableHead>
          <TableHead class="h-11 font-normal text-muted-foreground">Date</TableHead>
          <TableHead class="h-11 font-normal text-muted-foreground">Amount</TableHead>
          <TableHead class="h-11 w-px" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="e in filtered" :key="e.id" class="border-border">
          <TableCell class="px-2 py-3">
            <div class="flex items-center gap-3">
              <div
                class="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                :style="{ background: catColor(e.category) }"
              >
                {{ initials(e.vendor ?? e.category) }}
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-foreground">{{ e.vendor ?? 'Expense' }}</p>
                <p v-if="e.description" class="mt-0.5 max-w-[280px] truncate text-[12.5px] text-muted-foreground">{{ e.description }}</p>
              </div>
            </div>
          </TableCell>
          <TableCell class="py-3">
            <Badge variant="outline" class="font-normal capitalize">{{ e.category }}</Badge>
          </TableCell>
          <TableCell class="py-3 text-muted-foreground">
            {{ e.expense_date ? fmtDate(e.expense_date) : fmtDate(e.created_at) }}
          </TableCell>
          <TableCell class="py-3 font-medium tabular-nums text-foreground">
            ₹{{ Number(e.amount).toLocaleString('en-IN') }}
          </TableCell>
          <TableCell class="py-3">
            <div class="flex items-center justify-end gap-2">
              <Input
                v-model="utrInputs[e.id]"
                placeholder="UTR / Reference no."
                class="h-8 w-52 font-mono text-[13px]"
                @keydown.enter="markPaid(e.id)"
              />
              <Button
                class="h-8 gap-1.5 rounded-lg px-3"
                :disabled="submitting.has(e.id) || !utrInputs[e.id]?.trim()"
                @click="markPaid(e.id)"
              >
                <svg v-if="submitting.has(e.id)" class="size-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
                <Icon name="solar:card-linear" v-else class="size-3.5" />
                {{ submitting.has(e.id) ? 'Saving…' : 'Mark paid' }}
              </Button>
              <Button variant="outline" size="icon" class="rounded-lg text-muted-foreground" as-child>
                <NuxtLink :to="`/app/expenses/${e.id}`">
                  <Icon name="solar:eye-linear" class="size-4" />
                </NuxtLink>
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>

  </AppPage>
</template>
