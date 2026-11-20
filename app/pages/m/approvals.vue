<script setup lang="ts">
// Mobile Approvals — managers/owners approve or reject team expenses.
// Data + actions copied from app/pages/app/approvals.vue (same API calls).
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { TransitionPresets, useTransition } from '@vueuse/core'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase     = useSupabase()
const { ctx, load } = useOrgContext()
const expenses     = ref<Expense[]>([])
const loading      = ref(true)
const loadError    = ref(false)
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

// Flatten groups into one keyed list so the whole thing animates in a single TransitionGroup
type Row = { kind: 'label'; key: string; label: string; count: number } | { kind: 'exp'; key: string; e: Expense }
const rows = computed<Row[]>(() => groups.value.flatMap(g => [
  ...(g.label ? [{ kind: 'label' as const, key: `g:${g.key}`, label: g.label, count: g.items.length }] : []),
  ...g.items.map(e => ({ kind: 'exp' as const, key: e.id, e })),
]))

// ── Hero ──────────────────────────────────────────────────────────────────────
const pendingTotal = computed(() => expenses.value.reduce((s, e) => s + Number(e.amount), 0))
const animatedTotal = useTransition(pendingTotal, { duration: 900, transition: TransitionPresets.easeOutExpo })
const fmtINR = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const submitterCount = computed(() => new Set(expenses.value.map(e => e.submitted_by)).size)

async function fetchPending() {
  loadError.value = false
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { await navigateTo('/login'); return }
    await load()
    const all = await $fetch<Expense[]>('/api/expenses' as string, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    expenses.value = all.filter(e => e.status === 'pending_manager' && e.submitted_by !== ctx.value?.member.user_id)
  } catch (e: any) {
    loadError.value = true
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
  <div>
    <MobilePageHeader title="Approvals" subtitle="Review expenses from your team" back="/m" />

    <MobilePullToRefresh :on-refresh="fetchPending">
      <div class="flex flex-col gap-5">
        <!-- ── Summary hero ──────────────────────────────────────── -->
        <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[12.5px] text-background/70">Awaiting your approval</p>
              <Skeleton v-if="loading" class="mt-1.5 h-8 w-36 rounded-lg bg-background/15" />
              <p v-else class="mt-1.5 text-[28px] font-semibold leading-none tabular-nums">{{ fmtINR(animatedTotal) }}</p>
            </div>
            <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-background/10">
              <Icon name="solar:clipboard-check-linear" class="size-5.5" />
            </span>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-2xl bg-background/10 px-3.5 py-3">
              <p class="text-[11.5px] text-background/70">Pending</p>
              <p class="text-[17px] font-semibold tabular-nums">{{ loading ? '—' : expenses.length }}</p>
            </div>
            <div class="rounded-2xl bg-background/10 px-3.5 py-3">
              <p class="text-[11.5px] text-background/70">From</p>
              <p class="text-[17px] font-semibold tabular-nums">
                {{ loading ? '—' : `${submitterCount} ${submitterCount === 1 ? 'person' : 'people'}` }}
              </p>
            </div>
          </div>
        </Card>

        <!-- ── Error ─────────────────────────────────────────────── -->
        <Card v-if="!loading && loadError" class="m-rise items-center gap-2 rounded-3xl border-0 bg-muted/60 p-8 text-center shadow-none ring-0" style="--d: 120ms">
          <Icon name="solar:danger-circle-linear" class="size-8 text-destructive" />
          <p class="text-[15px] font-medium text-foreground">Couldn't load approvals</p>
          <Button class="m-press mt-2 h-11 rounded-full bg-foreground px-6 text-background hover:bg-foreground/90" @click="fetchPending">
            Retry
          </Button>
        </Card>

        <!-- ── All caught up ─────────────────────────────────────── -->
        <Card v-else-if="!loading && expenses.length === 0" class="m-rise items-center gap-2 rounded-3xl border-0 bg-muted/60 p-8 text-center shadow-none ring-0" style="--d: 120ms">
          <span class="mb-1 flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
            <Icon name="solar:check-circle-linear" class="size-8 text-emerald-500" />
          </span>
          <p class="text-[15px] font-medium text-foreground">You're all caught up</p>
          <p class="text-[12.5px] text-muted-foreground">New requests from your team will show up here.</p>
        </Card>

        <template v-else>
          <!-- ── Search + filters ──────────────────────────────── -->
          <MobileApprFilters v-model:search="search" :filters="filters" class="m-rise" style="--d: 120ms" />

          <!-- ── List ──────────────────────────────────────────── -->
          <section class="m-rise" style="--d: 180ms">
            <div v-if="loading" class="flex flex-col gap-3">
              <Skeleton v-for="n in 3" :key="n" class="h-[212px] rounded-3xl" />
            </div>

            <Card v-else-if="filtered.length === 0" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
              <Icon name="solar:clipboard-list-linear" class="size-7 text-muted-foreground" />
              <p class="text-[14px] font-medium text-foreground">{{ search ? 'No matching expenses' : 'No pending approvals' }}</p>
              <p class="text-[12.5px] text-muted-foreground">
                {{ search ? 'Try a different search term.' : 'Expenses submitted by your team will appear here.' }}
              </p>
            </Card>

            <template v-else>
              <TransitionGroup name="m-list" tag="div" class="relative flex flex-col gap-3">
                <template v-for="(r, i) in rows" :key="r.key">
                  <p
                    v-if="r.kind === 'label'"
                    class="mt-1 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-foreground"
                  >
                    {{ r.label }} <span class="font-normal text-muted-foreground">{{ r.count }}</span>
                  </p>
                  <MobileApprExpenseCard
                    v-else
                    :expense="r.e"
                    :approving="approving.has(r.e.id)"
                    :rejecting="rejecting.has(r.e.id)"
                    class="m-rise"
                    :style="{ '--d': `${220 + Math.min(i, 6) * 60}ms` }"
                    @approve="approve(r.e.id)"
                    @reject="openReject(r.e.id)"
                  />
                </template>
              </TransitionGroup>
              <p class="mt-4 text-center text-[12px] text-muted-foreground">
                Showing {{ filtered.length }} of {{ expenses.length }} expenses
              </p>
            </template>
          </section>
        </template>
      </div>
    </MobilePullToRefresh>

    <!-- ── Reject sheet ──────────────────────────────────────────── -->
    <MobileApprRejectSheet
      v-model:open="rejectOpen"
      v-model:reason="rejectReason"
      :target="rejectTarget"
      :busy="!!rejectTarget && rejecting.has(rejectTarget.id)"
      :quick-reasons="quickReasons"
      @confirm="rejectTarget && reject(rejectTarget.id)"
    />
  </div>
</template>
