<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase     = useSupabase()
const expenses     = ref<Expense[]>([])
const loading      = ref(true)
const rejectingId  = ref<string | null>(null)
const rejectReason = ref('')
const rejectTarget = computed(() => expenses.value.find(e => e.id === rejectingId.value) ?? null)
const rejectOpen   = computed({
  get: () => rejectingId.value !== null,
  set: (v: boolean) => { if (!v) { rejectingId.value = null; rejectReason.value = '' } },
})
const quickReasons = [
  'Missing GST invoice',
  'Receipt is not readable',
  'Duplicate submission',
  'Personal expense — not reimbursable',
  'Exceeds policy limit',
]
function openReject(id: string) {
  rejectReason.value = ''
  rejectingId.value = id
}
const approving    = ref<Set<string>>(new Set())
const rejecting    = ref<Set<string>>(new Set())
const search       = ref('')
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
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Approvals" description="Review and approve expenses submitted by your team." />

    <!-- Tabs -->
    <AppPageTabs model-value="pending" :tabs="[{ id: 'pending', label: 'Pending', count: loading ? undefined : expenses.length }]" />


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
          <Skeleton class="h-5 w-20 rounded-full" />
          <Skeleton class="h-8 w-24 rounded-lg" />
          <Skeleton class="h-8 w-20 rounded-lg" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
        <Icon name="solar:clipboard-list-linear" class="size-7 text-muted-foreground" />
        <p class="text-[15px] text-foreground">{{ search ? 'No matching expenses' : 'No pending approvals' }}</p>
        <p class="-mt-1.5 text-sm text-muted-foreground">
          {{ search ? 'Try a different search term.' : 'Expenses submitted by your team will appear here.' }}
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
            <template v-for="e in g.items" :key="e.id">
              <TableRow class="border-border">
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
                      <p v-if="e.description" class="mt-0.5 max-w-[320px] truncate text-[12.5px] text-muted-foreground">{{ e.description }}</p>
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
                  <div class="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                        :disabled="approving.has(e.id)"
                        @click="approve(e.id)"
                      >
                        <svg v-if="approving.has(e.id)" class="size-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                        </svg>
                        <Icon v-else name="solar:check-circle-linear" class="size-3.5 text-emerald-500" />
                        {{ approving.has(e.id) ? 'Approving…' : 'Approve' }}
                      </Button>
                      <Button
                        variant="outline"
                        class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                        :disabled="rejecting.has(e.id)"
                        @click="openReject(e.id)"
                      >
                        <Icon name="solar:close-circle-linear" class="size-3.5 text-red-500" />
                        Reject
                      </Button>
                      <Button variant="outline" class="h-8 gap-1.5 rounded-lg px-2.5 text-[12.5px] font-normal" as-child>
                        <NuxtLink :to="`/app/expenses/${e.id}`">View</NuxtLink>
                      </Button>
                    </div>
                </TableCell>
              </TableRow>

            </template>
          </template>
        </TableBody>
        <template #footer>
          Showing {{ filtered.length }} of {{ expenses.length }} expenses
        </template>
      </Table>
    </AppTableCard>

    <!-- Reject dialog -->
    <Dialog v-model:open="rejectOpen">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Reject expense</DialogTitle>
          <DialogDescription>The submitter will see this reason and can resubmit.</DialogDescription>
        </DialogHeader>

        <Card v-if="rejectTarget" size="sm" class="flex-row items-center gap-3 px-3">
          <div
            v-if="expLogo(rejectTarget)"
            class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white"
          >
            <img :src="expLogo(rejectTarget) ?? undefined" :alt="rejectTarget.vendor ?? ''" class="size-5 object-contain">
          </div>
          <div
            v-else
            class="flex size-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
            :style="{ background: catColor(rejectTarget.category) }"
          >
            {{ initials(rejectTarget.vendor ?? rejectTarget.category) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground">{{ rejectTarget.vendor ?? 'Expense' }}</p>
            <p class="text-[12.5px] capitalize text-muted-foreground">
              {{ rejectTarget.category }} · {{ fmtDate(rejectTarget.expense_date ?? rejectTarget.created_at) }}
            </p>
          </div>
          <p class="shrink-0 text-sm font-medium tabular-nums text-foreground">
            ₹{{ Number(rejectTarget.amount).toLocaleString('en-IN') }}
          </p>
        </Card>

        <div class="flex flex-col gap-2">
          <label class="text-[12.5px] font-medium text-foreground">Reason</label>
          <Input
            v-model="rejectReason"
            placeholder="Reason for rejection…"
            class="h-9 text-sm"
            @keydown.enter="rejectTarget && reject(rejectTarget.id)"
          />
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="r in quickReasons"
              :key="r"
              variant="outline"
              size="xs"
              class="rounded-md font-normal"
              :class="rejectReason === r ? 'bg-muted text-foreground' : 'text-muted-foreground'"
              @click="rejectReason = r"
            >
              {{ r }}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="rejectOpen = false">Cancel</Button>
          <Button
            variant="destructive"
            class="gap-1.5"
            :disabled="!rejectTarget || rejecting.has(rejectTarget.id) || !rejectReason.trim()"
            @click="rejectTarget && reject(rejectTarget.id)"
          >
            <svg v-if="rejectTarget && rejecting.has(rejectTarget.id)" class="size-3.5 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            {{ rejectTarget && rejecting.has(rejectTarget.id) ? 'Rejecting…' : 'Reject expense' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

  </AppPage>
</template>
