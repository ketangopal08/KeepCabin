<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { personColor, personInitials } from '~/utils/avatarColors'
import { TransitionPresets, useTransition } from '@vueuse/core'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase = useSupabase()
const { ctx, user, load } = useOrgContext()
const { unread, refresh: refreshUnread } = useUnreadNotifications()

const expenses = ref<Expense[]>([])
const loading = ref(true)
const hideAmount = ref(false)
const search = ref('')
const statusFilter = ref<'all' | 'pending' | 'paid' | 'rejected'>('all')

// ── User ──────────────────────────────────────────────────────────────────────
const fullName = computed(() => (user.value as any)?.user_metadata?.full_name ?? user.value?.email ?? '')
const firstName = computed(() => (fullName.value.split(/[\s@]/)[0] || 'there').toUpperCase())
const avatarUrl = ref('')
watch(user, (u: any) => { avatarUrl.value = u?.user_metadata?.avatar_url ?? '' }, { immediate: true })
const orgLine = computed(() => [ctx.value?.team?.name, ctx.value?.org?.name].filter(Boolean).join(', '))

// ── Money ─────────────────────────────────────────────────────────────────────
const OPEN = ['pending_manager', 'pending_finance', 'scheduled']
const myExpenses = computed(() => expenses.value.filter(e => e.submitted_by === user.value?.id))
const pendingReimbursement = computed(() =>
  myExpenses.value.filter(e => OPEN.includes(e.status)).reduce((s, e) => s + Number(e.amount), 0),
)
const fmtINR = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Count-up animation for the balance
const animatedBalance = useTransition(pendingReimbursement, { duration: 1100, transition: TransitionPresets.easeOutExpo })

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

// ── Current tracking: my latest expense still in the workflow ─────────────────
const current = computed(() =>
  myExpenses.value.find(e => OPEN.includes(e.status)) ?? myExpenses.value[0] ?? null,
)

// ── Recent activities ─────────────────────────────────────────────────────────
const recent = computed(() => {
  const q = search.value.trim().toLowerCase()
  return expenses.value
    .filter((e) => {
      if (statusFilter.value === 'pending' && !OPEN.includes(e.status)) return false
      if (statusFilter.value === 'paid' && e.status !== 'paid') return false
      if (statusFilter.value === 'rejected' && e.status !== 'rejected') return false
      if (!q) return true
      return [e.vendor, e.category, e.description, expCode(e), e.submitter_name]
        .some(v => v?.toLowerCase().includes(q))
    })
    .slice(0, 6)
})

// ── Formatting ────────────────────────────────────────────────────────────────
function expCode(e: Expense) {
  return `EXP-${e.id.replace(/-/g, '').slice(0, 3).toUpperCase()}-${e.id.replace(/-/g, '').slice(-3).toUpperCase()}`
}
function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso)
  return new Date(dateOnly ? `${iso}T00:00:00` : iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function payoutLine(e: Expense) {
  if (e.status === 'paid') return e.utr_number ? `UTR ${e.utr_number}` : 'Paid'
  if (e.status === 'rejected') return 'Not payable'
  if (e.payout_date) return `${fmtDate(e.payout_date)} (EST)`
  return 'Next payout cycle'
}

const filters = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'In progress' },
  { id: 'paid', label: 'Paid' },
  { id: 'rejected', label: 'Rejected' },
] as const

// ── Data ──────────────────────────────────────────────────────────────────────
async function fetchAll() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { await navigateTo('/login'); return }
  expenses.value = await $fetch<Expense[]>('/api/expenses', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => [])
  loading.value = false
}

async function refreshAll() {
  await Promise.all([fetchAll(), refreshUnread()])
}

onMounted(async () => { await load(); refreshUnread(); await fetchAll() })
</script>

<template>
  <MobilePullToRefresh :on-refresh="refreshAll">
  <div class="flex flex-col gap-5">
    <!-- ── Greeting ──────────────────────────────────────────────── -->
    <header class="m-rise flex items-center gap-3">
      <div
        class="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
        :style="{ background: avatarUrl ? undefined : personColor(fullName) }"
      >
        <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" @error="avatarUrl = ''">
        <template v-else>{{ personInitials(fullName) }}</template>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[17px] font-semibold text-foreground">Hello, {{ firstName }}</p>
        <p v-if="orgLine" class="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
          <Icon name="solar:buildings-2-linear" class="size-3.5 shrink-0" />{{ orgLine }}
        </p>
      </div>
      <Button variant="secondary" size="icon-lg" class="m-press relative rounded-full" as-child>
        <NuxtLink to="/m/notifications" aria-label="Notifications" @click="haptic">
          <Icon name="solar:bell-linear" class="size-5 text-red-500" :class="unread > 0 ? 'm-wiggle' : ''" />
          <span v-if="unread > 0" class="absolute top-2 right-2.5 size-2 rounded-full bg-red-500 ring-2 ring-secondary" />
        </NuxtLink>
      </Button>
    </header>

    <!-- ── Balance card ──────────────────────────────────────────── -->
    <Card class="m-rise relative gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0" style="--d: 60ms">
      <span class="m-sheen pointer-events-none absolute inset-0" aria-hidden="true" />
      <div class="flex items-start justify-between">
        <div>
          <p class="text-[12.5px] text-background/70">Pending reimbursement</p>
          <div class="mt-1.5 flex items-center gap-2.5">
            <Skeleton v-if="loading" class="h-8 w-36 rounded-lg bg-background/15" />
            <Transition v-else name="m-swap" mode="out-in">
              <p :key="hideAmount ? 'h' : 's'" class="text-[28px] font-semibold leading-none tabular-nums">
                {{ hideAmount ? '₹ • • • • •' : fmtINR(animatedBalance) }}
              </p>
            </Transition>
            <Button
              variant="ghost"
              size="icon-sm"
              class="m-press rounded-full text-background/80 hover:bg-background/10 hover:text-background"
              :aria-label="hideAmount ? 'Show amount' : 'Hide amount'"
              @click="hideAmount = !hideAmount; haptic()"
            >
              <Icon :name="hideAmount ? 'solar:eye-closed-linear' : 'solar:eye-linear'" class="size-4.5" />
            </Button>
          </div>
        </div>
        <Button size="sm" class="m-press h-9 rounded-full bg-background px-4 font-semibold text-foreground hover:bg-background/90" as-child>
          <NuxtLink to="/m/payments">Payouts</NuxtLink>
        </Button>
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3">
        <Button class="m-press h-12 rounded-full bg-background/90 font-semibold text-foreground hover:bg-background" as-child>
          <NuxtLink to="/m/expenses/new" @click="haptic">
            <Icon name="solar:document-add-linear" class="size-5" /> New Expense
          </NuxtLink>
        </Button>
        <Button class="m-press h-12 rounded-full bg-background/90 font-semibold text-foreground hover:bg-background" as-child>
          <NuxtLink :to="current ? `/m/expenses/${current.id}` : '/m/expenses'" @click="haptic">
            <Icon name="solar:map-point-wave-linear" class="size-5" /> Track Expense
          </NuxtLink>
        </Button>
      </div>
    </Card>

    <!-- ── Search ────────────────────────────────────────────────── -->
    <div class="m-rise relative" style="--d: 120ms">
      <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="search"
        type="search"
        placeholder="Search expenses"
        class="h-13 rounded-full pr-14 pl-11 text-base transition-shadow md:text-base focus-visible:shadow-[0_6px_24px_-10px_rgba(0,0,0,0.25)]"
      />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="icon-lg"
            class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full bg-foreground text-background transition-transform hover:bg-foreground/90 active:scale-90"
            aria-label="Filter"
          >
            <Icon name="solar:filter-linear" class="size-5" />
            <span v-if="statusFilter !== 'all'" class="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-44">
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup v-model="statusFilter">
            <DropdownMenuRadioItem v-for="f in filters" :key="f.id" :value="f.id">{{ f.label }}</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!-- ── Current tracking ──────────────────────────────────────── -->
    <section class="m-rise" style="--d: 180ms">
      <h2 class="mb-3 text-[15px] font-semibold text-foreground">Current Tracking</h2>
      <Skeleton v-if="loading" class="h-[184px] rounded-3xl" />
      <Card v-else-if="!current" class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
        <Icon name="solar:box-linear" class="size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">Nothing to track yet</p>
        <p class="text-[12.5px] text-muted-foreground">Submit an expense and follow it until it's paid.</p>
      </Card>
      <NuxtLink v-else :to="`/m/expenses/${current.id}`" class="m-press block" @click="haptic">
        <Card class="gap-0 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[11.5px] text-muted-foreground">Expense ID:</p>
              <p class="text-[14px] font-semibold tracking-tight text-foreground">{{ expCode(current) }}</p>
            </div>
            <AppExpenseStatusBadge :status="current.status" :payout-date="current.payout_date" class="rounded-full px-3" />
          </div>

          <div class="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p class="text-[11.5px] text-muted-foreground">Vendor:</p>
              <p class="truncate text-[13px] font-medium text-foreground">{{ current.vendor ?? current.category }}</p>
              <p class="text-[10.5px] text-muted-foreground">{{ fmtDate(current.expense_date ?? current.created_at) }}</p>
            </div>
            <div class="text-right">
              <p class="text-[11.5px] text-muted-foreground">Amount:</p>
              <p class="text-[13px] font-medium tabular-nums text-foreground">₹{{ Number(current.amount).toLocaleString('en-IN') }}</p>
              <p class="truncate text-[10.5px] text-muted-foreground">{{ payoutLine(current) }}</p>
            </div>
          </div>

          <MobileTracker :expense="current" class="mt-4" />
        </Card>
      </NuxtLink>
    </section>

    <!-- ── Recent activities ─────────────────────────────────────── -->
    <section class="m-rise" style="--d: 240ms">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-[15px] font-semibold text-foreground">Recent Activities</h2>
        <Button variant="link" size="sm" class="h-auto p-0 text-[13px] text-foreground" as-child>
          <NuxtLink to="/m/expenses">See all</NuxtLink>
        </Button>
      </div>

      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton v-for="n in 2" :key="n" class="h-[128px] rounded-3xl" />
      </div>
      <Card v-else-if="recent.length === 0" class="items-center rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
        <p class="text-[13px] text-muted-foreground">
          {{ search || statusFilter !== 'all' ? 'No expenses match your search.' : 'No activity yet.' }}
        </p>
      </Card>
      <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-3">
        <NuxtLink
          v-for="(e, i) in recent"
          :key="e.id"
          :to="`/m/expenses/${e.id}`"
          class="m-press m-rise block"
          :style="{ '--d': `${280 + i * 60}ms` }"
          @click="haptic"
        >
          <Card class="grid grid-cols-2 gap-x-3 gap-y-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
            <div class="min-w-0">
              <p class="text-[11.5px] text-muted-foreground">Expense ID:</p>
              <p class="flex items-center gap-1 text-[13px] font-semibold text-foreground">
                {{ expCode(e) }}
              </p>
            </div>
            <div class="min-w-0">
              <p class="text-[11.5px] text-muted-foreground">Item:</p>
              <p class="truncate text-[13px] font-semibold text-foreground">{{ e.vendor ?? e.category }}</p>
            </div>
            <div class="min-w-0">
              <p class="mb-1 text-[11.5px] text-muted-foreground">Status:</p>
              <AppExpenseStatusBadge :status="e.status" :payout-date="e.payout_date" class="rounded-full" />
            </div>
            <div class="min-w-0">
              <p class="text-[11.5px] text-muted-foreground">Amount · Date:</p>
              <p class="text-[13px] font-semibold tabular-nums text-foreground">₹{{ Number(e.amount).toLocaleString('en-IN') }}</p>
              <p class="text-[10.5px] text-muted-foreground">{{ fmtDate(e.expense_date ?? e.created_at) }}</p>
            </div>
          </Card>
        </NuxtLink>
      </TransitionGroup>
    </section>
  </div>
  </MobilePullToRefresh>
</template>

<style scoped>
/* Slow light sweep across the balance card */
@keyframes sheen {
  0%, 70% { transform: translateX(-120%) skewX(-18deg); }
  100%    { transform: translateX(220%) skewX(-18deg); }
}
.m-sheen::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, hsl(var(--background) / 0.14), transparent);
  animation: sheen 5s ease-in-out 1.2s infinite;
}
@media (prefers-reduced-motion: reduce) { .m-sheen::before { animation: none; display: none; } }
</style>
