<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { ArrowLeft, Check, X, CreditCard, FileText, ZoomIn, UserCheck, BadgeCheck, Upload } from '@lucide/vue'

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
const utrNumber     = ref('')
const payLoading    = ref(false)
const receiptZoom   = ref(false)

const role     = computed(() => ctx.value?.member?.role)
const myTeamId = computed(() => ctx.value?.member?.team_id)

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
  pending_manager: { label: 'Pending Manager',  cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400',    dot: 'bg-amber-500'  },
  pending_finance: { label: 'Pending Payment',  cls: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400',        dot: 'bg-blue-500'   },
  paid:            { label: 'Paid',             cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400', dot: 'bg-emerald-500' },
  rejected:        { label: 'Rejected',         cls: 'text-red-500 bg-red-50 dark:bg-red-950/40 dark:text-red-400',             dot: 'bg-red-500'    },
}

const workflowSteps = computed(() => {
  const e = expense.value
  if (!e) return []
  const log      = e.action_log ?? []
  const find     = (action: string) => log.find((l: any) => l.action === action)
  const submitted = find('submitted')
  const approved  = find('approved')
  const rejected  = find('rejected')
  const paid      = find('paid')
  const isRej     = e.status === 'rejected'

  return [
    {
      key:   'submitted',
      step:  1,
      title: 'Expense Submitted',
      desc:  submitted ? `Submitted by ${submitted.actor_name}` : 'Submitted by employee',
      actor: submitted?.actor_name,
      time:  submitted?.timestamp ?? e.created_at,
      note:  null as string | null,
      state: 'done',
    },
    {
      key:   'manager',
      step:  2,
      title: isRej ? 'Rejected by Manager' : approved ? 'Manager Approved' : 'Awaiting Manager Approval',
      desc:  approved  ? `Approved by ${approved.actor_name}`
           : rejected  ? `Rejected by ${rejected.actor_name}`
           : 'Waiting for manager review',
      actor: approved?.actor_name ?? rejected?.actor_name ?? null,
      time:  approved?.timestamp ?? rejected?.timestamp ?? null,
      note:  rejected?.note ?? null,
      state: approved ? 'done' : isRej ? 'rejected' : e.status === 'pending_manager' ? 'active' : 'pending',
    },
    {
      key:   'finance',
      step:  3,
      title: paid ? 'Payment Processed' : isRej ? 'Payment Not Required' : 'Awaiting Finance Payment',
      desc:  paid   ? `Processed by ${paid.actor_name}`
           : isRej  ? 'Expense was rejected — no payment needed'
           : 'Waiting for finance to process payment',
      actor: paid?.actor_name ?? null,
      time:  paid?.timestamp ?? null,
      note:  paid?.note ?? null,
      state: isRej ? 'skipped' : paid ? 'done' : e.status === 'pending_finance' ? 'active' : 'pending',
    },
    {
      key:   'completed',
      step:  4,
      title: paid ? 'Expense Completed' : isRej ? 'Expense Closed' : 'Expense Completed',
      desc:  paid  ? 'All done. The expense has been fully processed.'
           : isRej ? 'This expense was rejected and is now closed.'
           : 'Will be marked complete after payment is processed.',
      actor: null as string | null,
      time:  paid?.timestamp ?? null,
      note:  null as string | null,
      state: paid ? 'done' : isRej ? 'rejected' : 'pending',
    },
  ]
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
  <div class="-m-6 flex flex-col" style="height:calc(100vh - 44px)">

    <!-- ── Loading ────────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="shrink-0 px-6 py-4 border-b border-border flex flex-col gap-3">
        <Skeleton class="h-4 w-28 rounded" />
        <Skeleton class="h-7 w-64 rounded" />
        <Skeleton class="h-5 w-32 rounded" />
      </div>
      <div class="flex-1 grid grid-cols-[1fr_360px] divide-x divide-border">
        <div class="px-6 py-5 flex flex-col gap-6">
          <Skeleton v-for="n in 3" :key="n" class="h-20 rounded-2xl" />
        </div>
        <div class="px-5 py-5 flex flex-col gap-4">
          <Skeleton class="h-24 rounded-xl" />
          <Skeleton class="h-40 rounded-xl" />
          <Skeleton class="h-48 rounded-xl" />
        </div>
      </div>
    </template>

    <!-- ── Error ──────────────────────────────────────────────────────── -->
    <template v-else-if="fetchError || !expense">
      <div class="flex-1 flex flex-col items-center justify-center gap-4">
        <p class="text-[15px] font-semibold text-foreground">{{ fetchError || 'Expense not found' }}</p>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/app/expenses"><ArrowLeft class="size-3.5 mr-1.5" />Back to Expenses</NuxtLink>
        </Button>
      </div>
    </template>

    <!-- ── Content ────────────────────────────────────────────────────── -->
    <template v-else>

      <!-- Header bar -->
      <div class="shrink-0 border-b border-border bg-background">
        <div class="px-6 pt-3 pb-1">
          <NuxtLink
            to="/app/expenses"
            class="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft class="size-3.5" /> All Expenses
          </NuxtLink>
        </div>
        <div class="px-6 pb-4 flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="text-[20px] font-semibold text-foreground leading-tight">{{ expense.vendor ?? 'Expense' }}</h1>
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
              <span class="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground capitalize">
                <span class="size-2 rounded-full shrink-0" :style="{ background: catColor(expense.category) }" />
                {{ expense.category }}
              </span>
              <span class="text-border">·</span>
              <span class="text-[12.5px] text-muted-foreground">
                {{ expense.expense_date ? fmtDate(expense.expense_date) : fmtDate(expense.created_at) }}
              </span>
              <template v-if="expense.description">
                <span class="text-border">·</span>
                <span class="text-[12.5px] text-muted-foreground truncate max-w-[280px]">{{ expense.description }}</span>
              </template>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span
              class="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-full"
              :class="STATUS_META[expense.status]?.cls"
            >
              <span
                class="size-1.5 rounded-full shrink-0"
                :class="[STATUS_META[expense.status]?.dot, ['paid','rejected'].includes(expense.status) ? '' : 'animate-pulse']"
              />
              {{ STATUS_META[expense.status]?.label ?? expense.status }}
            </span>
            <p class="text-[24px] font-bold text-foreground tabular-nums leading-none">
              ₹{{ Number(expense.amount).toLocaleString('en-IN') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Two-column body -->
      <div class="flex-1 grid grid-cols-[1fr_360px] divide-x divide-border min-h-0 overflow-hidden">

        <!-- ── Left: Workflow stepper ──────────────────────────────── -->
        <div class="overflow-y-auto px-8 py-8">
          <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-7">Workflow</p>

          <div class="flex flex-col max-w-lg">
            <div v-for="(step, idx) in workflowSteps" :key="step.key" class="flex gap-5">

              <!-- Circle + connector line -->
              <div class="flex flex-col items-center w-10 shrink-0">

                <!-- Step circle -->
                <div
                  class="size-8 rounded-full flex items-center justify-center shrink-0 transition-all"
                  :class="{
                    'bg-emerald-500 text-white':                               step.state === 'done',
                    'bg-red-500 text-white':                                   step.state === 'rejected',
                    'bg-amber-400 text-white':                                 step.state === 'active',
                    'bg-background border-2 border-border/50 text-muted-foreground/30': step.state === 'pending',
                    'bg-muted border border-border/40 text-muted-foreground/20': step.state === 'skipped',
                  }"
                >
                  <!-- submitted -->
                  <Upload     v-if="step.key === 'submitted'"                         class="size-3.5" />
                  <!-- manager -->
                  <X          v-else-if="step.key === 'manager' && step.state === 'rejected'" class="size-3.5 stroke-[2.5]" />
                  <UserCheck  v-else-if="step.key === 'manager'"                      class="size-3.5" />
                  <!-- finance -->
                  <CreditCard v-else-if="step.key === 'finance'"                      class="size-3.5" />
                  <!-- completed -->
                  <BadgeCheck v-else-if="step.key === 'completed'"                    class="size-3.5" />
                </div>

                <!-- Connector line -->
                <div
                  v-if="idx < workflowSteps.length - 1"
                  class="w-px flex-1 my-1.5"
                  :class="{
                    'bg-emerald-300 dark:bg-emerald-800': step.state === 'done',
                    'bg-red-300 dark:bg-red-800':         step.state === 'rejected',
                    'bg-amber-200 dark:bg-amber-800/50':  step.state === 'active',
                    'bg-border/25':                       step.state === 'pending' || step.state === 'skipped',
                  }"
                  style="min-height: 20px"
                />
              </div>

              <!-- Step content -->
              <div
                class="flex-1 min-w-0 pb-5 transition-opacity"
                :class="idx === workflowSteps.length - 1 ? 'pb-0' : ''"
                :style="step.state === 'pending' || step.state === 'skipped' ? 'opacity: 0.35' : ''"
              >
                <div class="flex items-start justify-between gap-4 pt-1">
                  <div>
                    <p class="text-[15px] font-semibold text-foreground leading-tight">{{ step.title }}</p>
                    <p class="text-[13px] text-muted-foreground mt-0.5 leading-snug">{{ step.desc }}</p>
                  </div>
                  <div v-if="step.time" class="shrink-0 text-right">
                    <p class="text-[12px] font-medium text-foreground">{{ fmtDate(step.time) }}</p>
                    <p class="text-[11px] text-muted-foreground/60 mt-0.5">{{ fmtTime(step.time) }}</p>
                  </div>
                </div>

                <!-- Step 1: submission receipt card -->
                <div
                  v-if="step.key === 'submitted'"
                  class="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3.5 py-3"
                >
                  <div class="size-10 rounded-lg overflow-hidden shrink-0 border border-border bg-muted flex items-center justify-center">
                    <img v-if="expense.receipt_url" :src="expense.receipt_url" class="w-full h-full object-cover" />
                    <FileText v-else class="size-4 text-muted-foreground/40" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[13px] font-medium text-foreground truncate">{{ expense.vendor ?? 'Expense' }}</p>
                    <p class="text-[12px] text-muted-foreground truncate mt-0.5">
                      {{ expense.description ?? expense.category }}
                    </p>
                  </div>
                  <p class="text-[14px] font-bold text-foreground shrink-0 tabular-nums">
                    ₹{{ Number(expense.amount).toLocaleString('en-IN') }}
                  </p>
                </div>

                <!-- Active pulse indicator -->
                <div v-if="step.state === 'active'" class="mt-3 inline-flex items-center gap-2">
                  <span class="relative flex size-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span class="relative inline-flex rounded-full size-2 bg-amber-400" />
                  </span>
                  <span class="text-[12px] text-amber-600 dark:text-amber-400 font-medium">In progress</span>
                </div>

                <!-- Rejection note -->
                <div
                  v-if="step.key === 'manager' && step.note"
                  class="mt-3 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/20 px-4 py-3"
                >
                  <p class="text-[11px] font-semibold text-red-500 uppercase tracking-wider mb-1.5">Rejection Reason</p>
                  <p class="text-[13px] text-red-600 dark:text-red-400 leading-relaxed">{{ step.note }}</p>
                </div>

                <!-- UTR / payment reference -->
                <div
                  v-if="step.key === 'finance' && step.note"
                  class="mt-3 inline-flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5 border border-border/50"
                >
                  <span class="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">UTR</span>
                  <span class="text-[12.5px] font-mono text-foreground">{{ step.note }}</span>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- ── Right: Details + Actions + Receipt ──────────────────── -->
        <div class="overflow-y-auto flex flex-col divide-y divide-border bg-background">

          <!-- Action panel (role-gated) -->
          <div v-if="canApproveOrReject || canPay" class="px-5 py-4 bg-muted/20">
            <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Your Action</p>

            <!-- Manager: approve / reject -->
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

            <!-- Finance: UTR + mark paid -->
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

          <!-- Expense details -->
          <div class="px-5 py-4">
            <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</p>
            <div class="flex flex-col gap-3">
              <div class="flex items-start justify-between gap-4">
                <span class="text-[12.5px] text-muted-foreground shrink-0">Amount</span>
                <span class="text-[13px] font-semibold text-foreground tabular-nums">₹{{ Number(expense.amount).toLocaleString('en-IN') }}</span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-[12.5px] text-muted-foreground shrink-0">Category</span>
                <span class="text-[13px] text-foreground capitalize flex items-center gap-1.5">
                  <span class="size-2 rounded-full shrink-0" :style="{ background: catColor(expense.category) }" />
                  {{ expense.category }}
                </span>
              </div>
              <div class="flex items-start justify-between gap-4">
                <span class="text-[12.5px] text-muted-foreground shrink-0">Date</span>
                <span class="text-[13px] text-foreground">{{ expense.expense_date ? fmtDate(expense.expense_date) : fmtDate(expense.created_at) }}</span>
              </div>
              <div v-if="expense.description" class="flex items-start justify-between gap-4">
                <span class="text-[12.5px] text-muted-foreground shrink-0">Description</span>
                <span class="text-[13px] text-foreground text-right">{{ expense.description }}</span>
              </div>
              <div v-if="expense.utr_number" class="flex items-start justify-between gap-4">
                <span class="text-[12.5px] text-muted-foreground shrink-0">UTR / Reference</span>
                <span class="text-[13px] text-foreground font-mono">{{ expense.utr_number }}</span>
              </div>
            </div>
          </div>

          <!-- Receipt -->
          <div class="px-5 py-4">
            <p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Receipt</p>

            <div v-if="expense.receipt_url">
              <div
                class="rounded-xl overflow-hidden border border-border bg-card cursor-zoom-in"
                @click="receiptZoom = true"
              >
                <img :src="expense.receipt_url" class="w-full object-contain max-h-[280px]" />
              </div>
              <button
                class="mt-2 w-full text-center text-[12px] text-muted-foreground hover:text-foreground flex items-center justify-center gap-1 transition-colors"
                @click="receiptZoom = true"
              >
                <ZoomIn class="size-3" /> View full size
              </button>
            </div>

            <div v-else class="flex flex-col items-center gap-2 py-8">
              <div class="size-12 rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                <FileText class="size-5 text-muted-foreground/40" />
              </div>
              <p class="text-[12.5px] text-muted-foreground">No receipt attached</p>
            </div>
          </div>

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

  </div>
</template>
