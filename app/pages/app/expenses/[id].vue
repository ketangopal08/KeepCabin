<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { ArrowLeft, Check, X, Clock, CreditCard, FileText, ZoomIn } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const route   = useRoute()
const supabase = useSupabase()
const { ctx, load } = useOrgContext()

const expense    = ref<Expense | null>(null)
const loading    = ref(true)
const fetchError = ref('')

const approving    = ref(false)
const rejectOpen   = ref(false)
const rejectReason = ref('')
const rejectLoading = ref(false)
const payOpen    = ref(false)
const utrNumber  = ref('')
const payLoading = ref(false)
const receiptZoom = ref(false)

const role      = computed(() => ctx.value?.member?.role)
const myTeamId  = computed(() => ctx.value?.member?.team_id)
const myUserId  = computed(() => ctx.value?.member?.user_id)

const canApproveOrReject = computed(() =>
  role.value === 'manager' &&
  expense.value?.status === 'pending_manager' &&
  expense.value?.team_id === myTeamId.value
)

const canPay = computed(() =>
  (role.value === 'finance' || role.value === 'owner') &&
  expense.value?.status === 'pending_finance'
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

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  pending_manager: { label: 'Pending Manager', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400', dot: 'bg-amber-500' },
  pending_finance: { label: 'Pending Payment', cls: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400', dot: 'bg-blue-500' },
  paid:            { label: 'Paid',            cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400', dot: 'bg-emerald-500' },
  rejected:        { label: 'Rejected',        cls: 'text-red-500 bg-red-50 dark:bg-red-950/40 dark:text-red-400', dot: 'bg-red-500' },
}

type StepState = 'done' | 'active' | 'rejected' | 'skipped' | 'pending'

const workflowSteps = computed(() => {
  const e = expense.value
  if (!e) return []
  const log = e.action_log ?? []
  const find = (action: string) => log.find(l => l.action === action)
  const submitted  = find('submitted')
  const approved   = find('approved')
  const rejected   = find('rejected')
  const paid       = find('paid')
  const isRejected = e.status === 'rejected'

  const steps: { key: string; label: string; sub: string; time?: string; state: StepState; note?: string }[] = [
    {
      key: 'submitted',
      label: 'Submitted',
      sub: submitted ? `by ${submitted.actor_name}` : '',
      time: submitted?.timestamp,
      state: 'done',
    },
    {
      key: 'manager',
      label: rejected ? 'Rejected by Manager' : approved ? 'Approved by Manager' : 'Manager Review',
      sub: approved ? `by ${approved.actor_name}` : rejected ? `by ${rejected.actor_name}` : 'Waiting for approval',
      time: approved?.timestamp ?? rejected?.timestamp,
      state: (approved ? 'done' : rejected ? 'rejected' : e.status === 'pending_manager' ? 'active' : 'pending') as StepState,
      note: rejected?.note,
    },
    {
      key: 'finance',
      label: paid ? 'Payment Processed' : 'Finance Payment',
      sub: paid ? `by ${paid.actor_name}` : isRejected ? 'Not applicable' : 'Waiting for payment',
      time: paid?.timestamp,
      state: (isRejected ? 'skipped' : paid ? 'done' : e.status === 'pending_finance' ? 'active' : 'pending') as StepState,
      note: paid?.note,
    },
  ]
  return steps
})

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

async function submitPay() {
  if (!utrNumber.value.trim()) { toast.error('Enter UTR number'); return }
  payLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await $fetch(`/api/expenses/${expenseId()}/pay` as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { utr_number: utrNumber.value.trim() },
    })
    toast.success('Payment recorded')
    payOpen.value = false
    utrNumber.value = ''
    await fetchExpense()
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Failed to record payment')
  } finally {
    payLoading.value = false
  }
}
</script>

<template>
  <div class="-m-6 flex h-[calc(100vh-44px)]">

    <!-- ── Loading ─────────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="w-[420px] shrink-0 border-r border-border flex flex-col gap-5 px-6 py-5">
        <Skeleton class="h-4 w-28 rounded" />
        <Skeleton class="h-7 w-48 rounded" />
        <Skeleton class="h-5 w-20 rounded-full" />
        <div class="flex flex-col gap-3 mt-4">
          <Skeleton v-for="n in 3" :key="n" class="h-14 rounded-xl" />
        </div>
      </div>
      <div class="flex-1 bg-muted/30 flex items-center justify-center">
        <Skeleton class="w-64 h-80 rounded-2xl" />
      </div>
    </template>

    <!-- ── Error ───────────────────────────────────────────────────────── -->
    <template v-else-if="fetchError || !expense">
      <div class="flex flex-col items-center justify-center w-full gap-4">
        <p class="text-[15px] font-semibold text-foreground">{{ fetchError || 'Expense not found' }}</p>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/app/expenses"><ArrowLeft class="size-3.5 mr-1.5" />Back to Expenses</NuxtLink>
        </Button>
      </div>
    </template>

    <!-- ── Content ─────────────────────────────────────────────────────── -->
    <template v-else>

      <!-- Left panel -->
      <div class="w-[420px] shrink-0 flex flex-col border-r border-border bg-background overflow-y-auto">

        <!-- Header -->
        <div class="px-5 pt-4 pb-3 border-b border-border shrink-0">
          <NuxtLink
            to="/app/expenses"
            class="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft class="size-3.5" /> All Expenses
          </NuxtLink>
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h1 class="text-[17px] font-semibold text-foreground leading-tight">
                {{ expense.vendor ?? 'Expense' }}
              </h1>
              <p class="text-[12.5px] text-muted-foreground mt-0.5">
                {{ expense.expense_date ? fmtDate(expense.expense_date) : fmtDate(expense.created_at) }}
                · {{ expense.category }}
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[22px] font-bold text-foreground leading-none">
                ₹{{ Number(expense.amount).toLocaleString('en-IN') }}
              </p>
            </div>
          </div>
          <div class="mt-3">
            <span
              class="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
              :class="STATUS_META[expense.status]?.cls"
            >
              <span class="size-1.5 rounded-full animate-pulse shrink-0"
                :class="[STATUS_META[expense.status]?.dot, expense.status === 'paid' || expense.status === 'rejected' ? '!animate-none' : '']" />
              {{ STATUS_META[expense.status]?.label ?? expense.status }}
            </span>
          </div>
        </div>

        <!-- Workflow stepper -->
        <div class="px-5 py-4 border-b border-border shrink-0">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">Workflow</p>
          <div class="flex flex-col">
            <div
              v-for="(step, i) in workflowSteps"
              :key="step.key"
              class="flex gap-3"
            >
              <!-- Connector column -->
              <div class="flex flex-col items-center w-6 shrink-0">
                <!-- Step circle -->
                <div
                  class="size-6 rounded-full flex items-center justify-center shrink-0 ring-2 ring-background"
                  :class="{
                    'bg-emerald-500 text-white': step.state === 'done',
                    'bg-red-500 text-white': step.state === 'rejected',
                    'bg-foreground text-background': step.state === 'active',
                    'bg-muted text-muted-foreground border border-border': step.state === 'pending' || step.state === 'skipped',
                  }"
                >
                  <Check v-if="step.state === 'done'" class="size-3.5 stroke-[2.5]" />
                  <X v-else-if="step.state === 'rejected'" class="size-3.5 stroke-[2.5]" />
                  <Clock v-else-if="step.state === 'active'" class="size-3 stroke-[2]" />
                  <span v-else class="text-[10px] font-bold">{{ i + 1 }}</span>
                </div>
                <!-- Connecting line -->
                <div
                  v-if="i < workflowSteps.length - 1"
                  class="w-px flex-1 my-1 min-h-[24px]"
                  :class="step.state === 'done' || step.state === 'rejected' ? 'bg-border' : 'bg-border/40'"
                />
              </div>

              <!-- Step content -->
              <div class="flex-1 min-w-0 pb-5" :class="i === workflowSteps.length - 1 ? 'pb-0' : ''">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p
                      class="text-[13px] font-medium leading-tight"
                      :class="{
                        'text-foreground': step.state !== 'pending' && step.state !== 'skipped',
                        'text-muted-foreground/50': step.state === 'pending' || step.state === 'skipped',
                      }"
                    >{{ step.label }}</p>
                    <p
                      class="text-[11.5px] mt-0.5"
                      :class="step.state === 'pending' || step.state === 'skipped' ? 'text-muted-foreground/40' : 'text-muted-foreground'"
                    >{{ step.sub }}</p>
                  </div>
                  <p v-if="step.time" class="text-[11px] text-muted-foreground shrink-0">
                    {{ fmtDate(step.time) }}<br>
                    <span class="text-muted-foreground/60">{{ fmtTime(step.time) }}</span>
                  </p>
                </div>
                <p v-if="step.note" class="mt-1.5 text-[11.5px] text-muted-foreground bg-muted rounded-lg px-2.5 py-1.5">
                  {{ step.note }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Expense details -->
        <div class="px-5 py-4 border-b border-border shrink-0">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</p>
          <div class="flex flex-col gap-2.5">
            <div v-if="expense.description" class="flex justify-between gap-4">
              <span class="text-[12.5px] text-muted-foreground shrink-0">Description</span>
              <span class="text-[12.5px] text-foreground text-right">{{ expense.description }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-[12.5px] text-muted-foreground shrink-0">Category</span>
              <span class="text-[12.5px] text-foreground capitalize">{{ expense.category }}</span>
            </div>
            <div v-if="expense.utr_number" class="flex justify-between gap-4">
              <span class="text-[12.5px] text-muted-foreground shrink-0">UTR / Reference</span>
              <span class="text-[12.5px] text-foreground font-mono">{{ expense.utr_number }}</span>
            </div>
            <div v-if="expense.rejection_reason" class="mt-1 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2.5">
              <p class="text-[11px] font-semibold text-red-500 uppercase tracking-wide mb-0.5">Rejection reason</p>
              <p class="text-[12.5px] text-red-600 dark:text-red-400">{{ expense.rejection_reason }}</p>
            </div>
          </div>
        </div>

        <!-- Role-based action panel -->
        <div v-if="canApproveOrReject || canPay" class="px-5 py-4 border-b border-border shrink-0">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Actions</p>

          <!-- Manager actions -->
          <div v-if="canApproveOrReject" class="flex gap-2">
            <Button
              class="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              :disabled="approving"
              @click="approve"
            >
              <svg v-if="approving" class="animate-spin size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <Check v-else class="size-3.5" />
              {{ approving ? 'Approving…' : 'Approve' }}
            </Button>
            <Button
              variant="outline"
              class="flex-1 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20"
              @click="rejectOpen = true"
            >
              <X class="size-3.5" /> Reject
            </Button>
          </div>

          <!-- Finance actions -->
          <div v-if="canPay" class="flex flex-col gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-[12px] font-medium text-foreground">UTR / Reference Number</label>
              <Input
                v-model="utrNumber"
                placeholder="e.g. UTR123456789"
                class="font-mono text-[13px]"
                @keydown.enter="submitPay"
              />
            </div>
            <Button
              class="gap-1.5"
              :disabled="payLoading || !utrNumber.trim()"
              @click="submitPay"
            >
              <svg v-if="payLoading" class="animate-spin size-3.5 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <CreditCard v-else class="size-3.5" />
              {{ payLoading ? 'Recording…' : 'Mark as Paid' }}
            </Button>
          </div>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />
      </div>

      <!-- Right panel: receipt -->
      <div class="flex-1 bg-muted/30 flex flex-col items-center justify-center overflow-auto p-8">
        <div v-if="expense.receipt_url" class="w-full max-w-[420px] flex flex-col gap-3">
          <div class="flex items-center justify-between mb-1">
            <p class="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
              <FileText class="size-3.5" /> Receipt
            </p>
            <button
              class="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              @click="receiptZoom = true"
            >
              <ZoomIn class="size-3.5" /> Zoom
            </button>
          </div>
          <div class="rounded-2xl overflow-hidden border border-border bg-card shadow-sm">
            <img
              :src="expense.receipt_url"
              class="w-full object-contain max-h-[70vh] cursor-zoom-in"
              @click="receiptZoom = true"
            />
          </div>
          <p class="text-[11.5px] text-muted-foreground text-center">
            Uploaded {{ fmtDate(expense.created_at) }}
          </p>
        </div>

        <div v-else class="flex flex-col items-center gap-3 text-center">
          <div class="size-16 rounded-2xl border-2 border-dashed border-border flex items-center justify-center">
            <FileText class="size-7 text-muted-foreground/40" />
          </div>
          <p class="text-[13px] text-muted-foreground">No receipt attached</p>
        </div>
      </div>

    </template>

    <!-- ── Reject dialog ─────────────────────────────────────────────── -->
    <Dialog v-model:open="rejectOpen">
      <DialogContent class="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Reject expense</DialogTitle>
          <DialogDescription>
            Provide a reason for rejection. The employee will be notified.
          </DialogDescription>
        </DialogHeader>
        <div class="py-2">
          <Input
            v-model="rejectReason"
            placeholder="e.g. Missing category, duplicate submission…"
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

    <!-- ── Receipt zoom ──────────────────────────────────────────────── -->
    <Dialog v-model:open="receiptZoom">
      <DialogContent class="sm:max-w-3xl p-2">
        <img
          v-if="expense?.receipt_url"
          :src="expense.receipt_url"
          class="w-full rounded-xl object-contain max-h-[85vh]"
        />
      </DialogContent>
    </Dialog>

  </div>
</template>
