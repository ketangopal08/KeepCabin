<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route    = useRoute()
const supabase = useSupabase()
const { ctx, load } = useOrgContext()

const expense     = ref<Expense | null>(null)
const loading     = ref(true)
const fetchError  = ref('')

const approving     = ref(false)
const rejectOpen    = ref(false)
const rejectReason  = ref('')
const rejectLoading = ref(false)
const receiptZoom   = ref(false)

const role     = computed(() => ctx.value?.member?.role)
const myTeamId = computed(() => ctx.value?.member?.team_id)

const canApproveOrReject = computed(() =>
  role.value === 'manager' &&
  expense.value?.status === 'pending_manager' &&
  expense.value?.team_id === myTeamId.value
)

function expenseId() {
  const id = route.params.id
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '')
}

function catColor(cat: string) {
  const p = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#f97316']
  let h = 0
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % p.length
  return p[h]
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function fetchExpense() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    expense.value = await $fetch<Expense>(`/api/expenses/${expenseId()}` as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
  } catch (e: any) {
    fetchError.value = e?.data?.message ?? 'Failed to load expense'
  } finally {
    loading.value = false
  }
}

onMounted(async () => { await load(); await fetchExpense() })

async function approve() {
  approving.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch(`/api/expenses/${expenseId()}/approve` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    toast.success('Expense approved')
    await fetchExpense()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to approve')
  } finally {
    approving.value = false
  }
}

async function submitReject() {
  if (!rejectReason.value.trim()) { toast.error('Enter a rejection reason'); return }
  rejectLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch(`/api/expenses/${expenseId()}/reject` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { reason: rejectReason.value.trim() },
    })
    toast.success('Expense rejected')
    rejectOpen.value = false
    rejectReason.value = ''
    await fetchExpense()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to reject')
  } finally {
    rejectLoading.value = false
  }
}
</script>

<template>
  <AppPage>

    <!-- ── Loading ────────────────────────────────────────────────────── -->
    <template v-if="loading">
      <Skeleton class="mb-4 h-4 w-28 rounded" />
      <div class="mb-7 flex items-start justify-between">
        <div class="flex flex-col gap-2">
          <Skeleton class="h-7 w-64 rounded" />
          <Skeleton class="h-4 w-40 rounded" />
        </div>
        <Skeleton class="h-8 w-40 rounded-lg" />
      </div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-10">
        <Skeleton class="h-[520px] rounded-2xl lg:col-span-7" />
        <div class="flex flex-col gap-4 lg:col-span-3">
          <Skeleton class="h-40 rounded-xl" />
          <Skeleton class="h-48 rounded-xl" />
        </div>
      </div>
    </template>

    <!-- ── Error ──────────────────────────────────────────────────────── -->
    <template v-else-if="fetchError || !expense">
      <div class="flex flex-col items-center justify-center gap-4 py-28">
        <Icon name="solar:document-text-linear" class="size-7 text-muted-foreground" />
        <p class="text-[15px] text-foreground">{{ fetchError || 'Expense not found' }}</p>
        <Button variant="outline" class="h-9 gap-1.5 rounded-lg px-4" as-child>
          <NuxtLink to="/app/expenses"><Icon name="solar:arrow-left-linear" class="size-4" />Back to Expenses</NuxtLink>
        </Button>
      </div>
    </template>

    <!-- ── Content ────────────────────────────────────────────────────── -->
    <template v-else>

      <!-- Header -->
      <AppPageHeader :title="expense.vendor ?? 'Expense'" :back="{ label: 'Expenses', to: '/app/expenses' }">
        <template #description>
          Submitted by <span class="font-medium text-foreground">{{ expense.submitter_name ?? expense.submitter_email ?? '—' }}</span>
          · {{ expense.expense_date ? fmtDate(expense.expense_date) : fmtDate(expense.created_at) }}
        </template>
        <template #actions>
          <AppExpenseStatusBadge :status="expense.status" :payout-date="expense.payout_date" />
          <p class="text-2xl font-medium leading-none tabular-nums text-foreground">
            ₹{{ Number(expense.amount).toLocaleString('en-IN') }}
          </p>
          <template v-if="canApproveOrReject">
            <Separator orientation="vertical" class="mx-2 !h-7" />
            <Button
              variant="outline"
              class="h-9 gap-2 rounded-lg px-4"
              :disabled="approving"
              @click="approve"
            >
              <svg v-if="approving" class="size-4 shrink-0 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <Icon v-else name="solar:check-circle-linear" class="size-4 text-emerald-500" />
              {{ approving ? 'Approving…' : 'Approve' }}
            </Button>
            <Button
              variant="outline"
              class="h-9 gap-2 rounded-lg px-4"
              :disabled="approving"
              @click="rejectOpen = true"
            >
              <Icon name="solar:close-circle-linear" class="size-4 text-red-500" /> Reject
            </Button>
          </template>
        </template>
      </AppPageHeader>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-10">

        <!-- Left (70%): workflow canvas, centred vertically + horizontally -->
        <div
          class="relative flex min-h-[520px] items-center justify-center rounded-2xl border border-border bg-card px-6 py-10 lg:col-span-7"
          style="background-image: radial-gradient(hsl(var(--muted-foreground) / 0.28) 1px, transparent 1px); background-size: 14px 14px;"
        >
          <p class="absolute top-4 left-5 text-[13px] font-medium text-muted-foreground">Workflow</p>
          <AppExpenseTracker :expense="expense" />
        </div>

        <!-- Right (30%): action + details + receipt -->
        <div class="flex flex-col gap-4 lg:col-span-3">
          <Card class="gap-0 rounded-xl px-6 py-5">
            <p class="mb-4 text-[14px] font-medium text-foreground">Details</p>
            <div class="flex flex-col gap-3">
              <div class="flex items-start justify-between gap-4">
                <span class="shrink-0 text-sm text-muted-foreground">Date</span>
                <span class="text-[13px] text-foreground">{{ expense.expense_date ? fmtDate(expense.expense_date) : fmtDate(expense.created_at) }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="shrink-0 text-sm text-muted-foreground">Category</span>
                <span class="flex items-center gap-1.5 text-[13px] capitalize text-foreground">
                  <span class="size-2 shrink-0 rounded-full" :style="{ background: catColor(expense.category) }" />
                  {{ expense.category }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="shrink-0 text-sm text-muted-foreground">Team</span>
                <span class="text-[13px] text-foreground">{{ (expense as any).team_name ?? '—' }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="shrink-0 text-sm text-muted-foreground">Submitted by</span>
                <span class="flex min-w-0 flex-col items-end text-right">
                  <template v-if="expense.submitter_name">
                    <span class="text-[13px] font-medium text-foreground">{{ expense.submitter_name }}</span>
                    <span v-if="expense.submitter_email" class="break-all text-[12px] text-muted-foreground">{{ expense.submitter_email }}</span>
                  </template>
                  <span v-else class="break-all text-[13px] text-foreground">{{ expense.submitter_email ?? '—' }}</span>
                </span>
              </div>
              <div v-if="expense.description" class="flex items-start justify-between gap-4">
                <span class="shrink-0 text-sm text-muted-foreground">Description</span>
                <span class="text-right text-[13px] text-foreground">{{ expense.description }}</span>
              </div>
            </div>
          </Card>

          <Card class="gap-0 rounded-xl px-6 py-5">
            <p class="mb-4 text-[14px] font-medium text-foreground">Receipt</p>
            <div v-if="expense.receipt_url">
              <div
                class="cursor-zoom-in overflow-hidden rounded-xl border border-border bg-card"
                @click="receiptZoom = true"
              >
                <img :src="expense.receipt_url" class="max-h-[360px] w-full object-contain" />
              </div>
              <Button variant="ghost" size="sm" class="mt-2 w-full gap-1 text-muted-foreground" @click="receiptZoom = true">
                <Icon name="solar:magnifer-zoom-in-linear" class="size-3" /> View full size
              </Button>
            </div>
            <div v-else class="flex flex-col items-center gap-2 py-8">
              <div class="flex size-12 items-center justify-center rounded-xl border-2 border-dashed border-border">
                <Icon name="solar:document-text-linear" class="size-5 text-muted-foreground/40" />
              </div>
              <p class="text-[12.5px] text-muted-foreground">No receipt attached</p>
            </div>
          </Card>
        </div>
      </div>
    </template>

    <!-- ── Reject dialog ──────────────────────────────────────────────── -->
    <Dialog v-model:open="rejectOpen">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reject expense</DialogTitle>
          <DialogDescription>
            Provide a reason for rejection. This will be visible to the employee.
          </DialogDescription>
        </DialogHeader>
        <div class="py-2">
          <Input
            v-model="rejectReason"
            placeholder="e.g. Missing receipt, wrong category…"
            @keydown.enter="submitReject"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" @click="rejectOpen = false">Cancel</Button>
          <Button
            variant="destructive"
            :disabled="rejectLoading || !rejectReason.trim()"
            @click="submitReject"
          >
            <svg v-if="rejectLoading" class="animate-spin size-3.5 mr-1.5 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            {{ rejectLoading ? 'Rejecting…' : 'Confirm Reject' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Receipt zoom ────────────────────────────────────────────────── -->
    <Dialog v-model:open="receiptZoom">
      <DialogContent class="sm:max-w-3xl p-2">
        <img
          v-if="expense?.receipt_url"
          :src="expense.receipt_url"
          class="w-full rounded-xl object-contain max-h-[85vh]"
        />
      </DialogContent>
    </Dialog>

  </AppPage>
</template>
