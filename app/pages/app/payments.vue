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
const { filters, apply, group } = useExpenseFilters()

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return apply(expenses.value)
  return apply(expenses.value.filter(e =>
    (e.vendor ?? '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
  ))
})

const groups = computed(() => group(filtered.value))

function catColor(cat: string) {
  const p = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % p.length
  return p[h]
}

// Brand logos that failed to load fall back to initials
const failedLogos = ref(new Set<string>())
function expLogo(e: Expense) {
  return failedLogos.value.has(e.id) ? null : brandLogoUrl(e.vendor)
}
function onLogoError(id: string) {
  failedLogos.value = new Set(failedLogos.value).add(id)
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


    <AppTableCard>
      <template #toolbar>
        <AppExpenseToolbar v-model:search="search" :filters="filters" />
      </template>
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
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead class="w-px" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="g in groups" :key="g.key">
            <TableRow v-if="g.label" class="bg-muted/40 hover:bg-muted/40">
              <TableCell :colspan="5" class="py-2 text-[12.5px] font-medium text-foreground">
                {{ g.label }} <span class="ml-1 font-normal text-muted-foreground">{{ g.items.length }}</span>
              </TableCell>
            </TableRow>
            <TableRow v-for="e in g.items" :key="e.id" class="border-border">
              <TableCell>
                <div class="flex items-center gap-3">
                  <div
                    v-if="expLogo(e)"
                    class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
                  >
                    <img
                      :src="expLogo(e) ?? undefined"
                      :alt="e.vendor ?? ''"
                      class="size-5 object-contain"
                      loading="lazy"
                      @error="onLogoError(e.id)"
                    >
                  </div>
                  <div
                    v-else
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
              <TableCell>
                <Badge variant="neutral" class="capitalize">{{ e.category }}</Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ e.expense_date ? fmtDate(e.expense_date) : fmtDate(e.created_at) }}
              </TableCell>
              <TableCell class="font-medium tabular-nums text-foreground">
                ₹{{ Number(e.amount).toLocaleString('en-IN') }}
              </TableCell>
              <TableCell>
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
                  <Button variant="outline" size="sm" class="h-8 rounded-lg px-3 text-[13px]" as-child>
                    <NuxtLink :to="`/app/expenses/${e.id}`">View</NuxtLink>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
        <template #footer>
          Showing {{ filtered.length }} of {{ expenses.length }} expenses
        </template>
      </Table>
    </AppTableCard>

  </AppPage>
</template>
