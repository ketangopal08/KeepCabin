<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense, ActionLogEntry } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { personColor, personInitials } from '~/utils/avatarColors'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

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
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
  haptic()
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

// ── Mobile presentation helpers ───────────────────────────────────────────────
function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}
function expCode(e: Expense) {
  return `EXP-${e.id.replace(/-/g, '').slice(0, 3).toUpperCase()}-${e.id.replace(/-/g, '').slice(-3).toUpperCase()}`
}
async function copy(text: string, label = 'Copied') {
  haptic()
  try {
    await navigator.clipboard.writeText(text)
    toast.success(label)
  } catch {
    toast.error('Could not copy')
  }
}

const code = computed(() => expense.value ? expCode(expense.value) : '')
const teamName = computed(() => (expense.value as any)?.team_name as string | null | undefined)
const submitterLabel = computed(() => expense.value?.submitter_name ?? expense.value?.submitter_email ?? '—')

const ACTION_LABEL: Record<string, string> = {
  submitted: 'Expense submitted',
  approved: 'Approved by manager',
  finance_approved: 'Approved by finance',
  rejected: 'Expense rejected',
  paid: 'Payout completed',
}
const ACTION_ROLE: Record<string, string> = {
  approved: 'Manager',
  finance_approved: 'Finance',
  rejected: 'Reviewer',
  paid: 'Finance',
}

// Newest first
const timeline = computed<ActionLogEntry[]>(() =>
  [...(expense.value?.action_log ?? [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
)

// Latest person who acted on the expense after submission (approver / rejecter / payer)
const reviewer = computed(() => timeline.value.find(x => x.action in ACTION_ROLE) ?? null)

function tlTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase()
}
function tlDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <MobilePageHeader title="Details" back="/m/expenses" class="!mb-0" />

    <!-- ── Loading ────────────────────────────────────────────────── -->
    <template v-if="loading">
      <div class="flex items-center gap-3">
        <Skeleton class="size-12 rounded-full" />
        <div class="flex flex-1 flex-col gap-1.5">
          <Skeleton class="h-3 w-20 rounded" />
          <Skeleton class="h-4 w-32 rounded" />
        </div>
        <Skeleton class="h-6 w-24 rounded-full" />
      </div>
      <Skeleton class="h-12 rounded-2xl" />
      <Skeleton class="h-13 rounded-full" />
      <Skeleton class="h-[300px] rounded-3xl" />
      <Skeleton class="h-[76px] rounded-3xl" />
      <Skeleton class="h-[220px] rounded-3xl" />
    </template>

    <!-- ── Error ──────────────────────────────────────────────────── -->
    <Card v-else-if="fetchError || !expense" class="m-rise items-center gap-3 rounded-3xl border-0 bg-muted/60 p-8 text-center shadow-none ring-0">
      <Icon name="solar:document-text-linear" class="size-7 text-muted-foreground" />
      <p class="text-sm font-medium text-foreground">{{ fetchError || 'Expense not found' }}</p>
      <Button variant="secondary" class="m-press mt-1 h-11 rounded-full px-5" as-child>
        <NuxtLink to="/m/expenses"><Icon name="solar:arrow-left-linear" class="size-4" />Back to Expenses</NuxtLink>
      </Button>
    </Card>

    <!-- ── Content ────────────────────────────────────────────────── -->
    <template v-else>
      <!-- ID row -->
      <div class="m-rise flex items-center gap-3" style="--d: 40ms">
        <div class="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon name="solar:bill-list-bold" class="size-6 text-foreground" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[11.5px] text-muted-foreground">Expense ID:</p>
          <div class="flex items-center gap-0.5">
            <p class="truncate text-[15px] font-semibold tracking-tight text-foreground">{{ code }}</p>
            <Button
              variant="ghost"
              size="icon-sm"
              class="m-press rounded-full text-muted-foreground"
              aria-label="Copy expense ID"
              @click="copy(code, 'Expense ID copied')"
            >
              <Icon name="solar:copy-linear" class="size-4" />
            </Button>
          </div>
        </div>
        <AppExpenseStatusBadge :status="expense.status" :payout-date="expense.payout_date" class="rounded-full px-3" />
      </div>

      <!-- Tracker -->
      <div class="m-rise px-1" style="--d: 90ms">
        <MobileTracker :expense="expense" />
      </div>

      <!-- Actions -->
      <div class="m-rise flex flex-col gap-2.5" style="--d: 140ms">
        <div v-if="canApproveOrReject" class="grid grid-cols-2 gap-2.5">
          <Button
            class="m-press h-13 rounded-full bg-foreground text-[15px] font-semibold text-background hover:bg-foreground/90"
            :disabled="approving"
            @click="approve"
          >
            <Icon v-if="approving" name="solar:refresh-linear" class="size-5 animate-spin" />
            <Icon v-else name="solar:check-circle-linear" class="size-5" />
            {{ approving ? 'Approving…' : 'Approve' }}
          </Button>
          <Button
            variant="secondary"
            class="m-press h-13 rounded-full text-[15px] font-semibold"
            :disabled="approving"
            @click="haptic(); rejectOpen = true"
          >
            <Icon name="solar:close-circle-linear" class="size-5 text-red-500" /> Reject
          </Button>
        </div>
        <Button
          v-if="expense.receipt_url"
          :variant="canApproveOrReject ? 'secondary' : 'default'"
          class="m-press h-13 w-full rounded-full text-[15px] font-semibold"
          :class="canApproveOrReject ? '' : 'bg-foreground text-background hover:bg-foreground/90'"
          @click="haptic(); receiptZoom = true"
        >
          <Icon name="solar:gallery-linear" class="size-5" /> View receipt
        </Button>
        <Button
          v-else
          variant="secondary"
          class="h-13 w-full rounded-full text-[15px] font-semibold"
          disabled
        >
          <Icon name="solar:document-text-linear" class="size-5" /> No receipt attached
        </Button>
      </div>

      <!-- Expense details -->
      <Card class="m-rise gap-0 rounded-3xl border-0 bg-muted/60 p-5 shadow-none ring-0" style="--d: 190ms">
        <p class="mb-4 text-[15px] font-semibold text-foreground">Expense Details</p>
        <div class="flex flex-col gap-3.5">
          <div class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Submitted by</span>
            <span class="min-w-0 text-right text-[13px] font-semibold break-all text-foreground">{{ submitterLabel }}</span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Team</span>
            <span class="text-right text-[13px] font-semibold text-foreground">{{ teamName ?? '—' }}</span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Vendor</span>
            <span class="text-right text-[13px] font-semibold text-foreground">{{ expense.vendor ?? '—' }}</span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Amount</span>
            <span class="text-right text-[13px] font-semibold tabular-nums text-foreground">₹{{ Number(expense.amount).toLocaleString('en-IN') }}</span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Category</span>
            <span class="flex items-center gap-1.5 text-[13px] font-semibold capitalize text-foreground">
              <span class="size-2 shrink-0 rounded-full" :style="{ background: catColor(expense.category) }" />
              {{ expense.category }}
            </span>
          </div>
          <div class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Date</span>
            <span class="text-right text-[13px] font-semibold text-foreground">{{ expense.expense_date ? fmtDate(expense.expense_date) : fmtDate(expense.created_at) }}</span>
          </div>
          <div v-if="expense.description" class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Description</span>
            <span class="text-right text-[13px] font-semibold text-foreground">{{ expense.description }}</span>
          </div>
          <div v-if="expense.payout_date" class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Payout date</span>
            <span class="text-right text-[13px] font-semibold text-foreground">{{ fmtDate(expense.payout_date) }}</span>
          </div>
          <div v-if="expense.utr_number" class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">UTR</span>
            <span class="flex min-w-0 items-center gap-0.5">
              <span class="text-right text-[13px] font-semibold break-all text-foreground">{{ expense.utr_number }}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                class="m-press rounded-full text-muted-foreground"
                aria-label="Copy UTR"
                @click="copy(expense?.utr_number ?? '', 'UTR copied')"
              >
                <Icon name="solar:copy-linear" class="size-3.5" />
              </Button>
            </span>
          </div>
          <div v-if="expense.status === 'rejected' && expense.rejection_reason" class="flex items-start justify-between gap-4">
            <span class="shrink-0 text-[12.5px] text-muted-foreground">Rejection reason</span>
            <span class="text-right text-[13px] font-semibold text-red-500">{{ expense.rejection_reason }}</span>
          </div>
        </div>
      </Card>

      <!-- People -->
      <div class="m-rise flex flex-col gap-3" style="--d: 240ms">
        <Card class="flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            :style="{ background: personColor(expense.submitter_email ?? expense.submitted_by) }"
          >
            {{ personInitials(expense.submitter_name ?? expense.submitter_email) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] font-semibold text-foreground">{{ submitterLabel }}</p>
            <p class="truncate text-[11.5px] text-muted-foreground">Submitter{{ teamName ? ` · ${teamName}` : '' }}</p>
          </div>
          <template v-if="expense.submitter_email">
            <Button
              variant="outline"
              size="icon-lg"
              class="m-press shrink-0 rounded-full border-0 bg-background"
              aria-label="Copy email"
              @click="copy(expense?.submitter_email ?? '', 'Email copied')"
            >
              <Icon name="solar:copy-linear" class="size-4.5" />
            </Button>
            <Button size="icon-lg" class="m-press shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90" as-child>
              <a :href="`mailto:${expense.submitter_email}`" aria-label="Email submitter" @click="haptic">
                <Icon name="solar:letter-linear" class="size-4.5" />
              </a>
            </Button>
          </template>
        </Card>

        <Card v-if="reviewer" class="flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
          <div
            class="flex size-11 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            :style="{ background: personColor(reviewer.actor_id ?? reviewer.actor_name) }"
          >
            {{ personInitials(reviewer.actor_name) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-[14px] font-semibold text-foreground">{{ reviewer.actor_name }}</p>
            <p class="truncate text-[11.5px] text-muted-foreground">{{ ACTION_ROLE[reviewer.action] }} · {{ tlDate(reviewer.timestamp) }}</p>
          </div>
          <div
            class="flex size-9 shrink-0 items-center justify-center rounded-full"
            :class="reviewer.action === 'rejected' ? 'bg-red-500/10 text-red-500' : 'bg-background text-foreground'"
          >
            <Icon :name="reviewer.action === 'rejected' ? 'solar:close-circle-linear' : 'solar:user-check-rounded-linear'" class="size-4.5" />
          </div>
        </Card>
      </div>

      <!-- Timeline -->
      <Card v-if="timeline.length" class="m-rise gap-0 rounded-3xl border-0 bg-muted/60 p-5 shadow-none ring-0" style="--d: 290ms">
        <p class="mb-4 text-[15px] font-semibold text-foreground">Timeline</p>
        <div class="flex flex-col">
          <div v-for="(t, i) in timeline" :key="`${t.action}-${t.timestamp}-${i}`" class="flex gap-3">
            <div class="w-14 shrink-0 text-right">
              <p class="text-[12px] font-semibold text-foreground">{{ tlTime(t.timestamp) }}</p>
              <p class="text-[10.5px] text-muted-foreground">{{ tlDate(t.timestamp) }}</p>
            </div>
            <div class="flex flex-col items-center">
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded-full"
                :class="t.action === 'rejected' ? 'bg-red-500 text-white' : i === 0 ? 'bg-foreground text-background' : 'bg-muted-foreground/30 text-foreground'"
              >
                <Icon :name="t.action === 'rejected' ? 'solar:close-circle-linear' : 'solar:check-read-linear'" class="size-3" />
              </span>
              <span v-if="i < timeline.length - 1" class="my-1 w-0 flex-1 border-l-2 border-dashed border-muted-foreground/30" />
            </div>
            <div class="min-w-0 flex-1" :class="i < timeline.length - 1 ? 'pb-5' : ''">
              <p class="text-[13px] font-semibold" :class="t.action === 'rejected' ? 'text-red-500' : 'text-foreground'">
                {{ ACTION_LABEL[t.action] ?? t.action }}
              </p>
              <p class="truncate text-[11.5px] text-muted-foreground">by {{ t.actor_name }}</p>
              <p v-if="t.note" class="mt-0.5 text-[11.5px] break-words text-muted-foreground">{{ t.note }}</p>
            </div>
          </div>
        </div>
      </Card>
    </template>

    <!-- ── Reject dialog ──────────────────────────────────────────── -->
    <Dialog v-model:open="rejectOpen">
      <DialogContent class="rounded-3xl sm:max-w-[400px]">
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
            class="h-12 rounded-full px-4 text-base md:text-base"
            @keydown.enter="submitReject"
          />
        </div>
        <DialogFooter class="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" class="m-press h-12 rounded-full" @click="rejectOpen = false">Cancel</Button>
          <Button
            variant="destructive"
            class="m-press h-12 rounded-full"
            :disabled="rejectLoading || !rejectReason.trim()"
            @click="submitReject"
          >
            <Icon v-if="rejectLoading" name="solar:refresh-linear" class="size-4 animate-spin" />
            {{ rejectLoading ? 'Rejecting…' : 'Confirm Reject' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Receipt sheet ──────────────────────────────────────────── -->
    <Sheet v-model:open="receiptZoom">
      <SheetContent side="bottom" class="max-h-[92dvh] gap-3 rounded-t-3xl px-4 pt-5 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <SheetHeader class="p-0">
          <SheetTitle class="text-[15px]">Receipt</SheetTitle>
          <SheetDescription v-if="expense" class="text-[12px]">{{ code }} · {{ expense.vendor ?? expense.category }}</SheetDescription>
        </SheetHeader>
        <div class="min-h-0 flex-1 overflow-auto rounded-2xl bg-muted/60">
          <img
            v-if="expense?.receipt_url"
            :src="expense.receipt_url"
            alt="Receipt"
            class="max-h-[75dvh] w-full object-contain"
          >
        </div>
      </SheetContent>
    </Sheet>
  </div>
</template>
