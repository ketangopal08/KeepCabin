<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import type { Expense } from '~~/lib/supabase'
import { TransitionPresets, useTransition } from '@vueuse/core'
import { personColor } from '~/utils/avatarColors'
import { statusMeta, statusText } from '~/utils/expenseStatus'
import type { BadgeVariant } from '~/utils/expenseStatus'

const statusTone: Record<BadgeVariant, string> = {
  warning: 'text-amber-400',
  info: 'text-sky-400',
  success: 'text-emerald-400',
  danger: 'text-red-400',
  neutral: 'text-muted-foreground',
}

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

// Home screen is dark (only while this page is mounted — other /m pages stay light)
useHead({ htmlAttrs: { class: 'dark' } })

const supabase = useSupabase()
const { user, load } = useOrgContext()
const { unread, refresh: refreshUnread } = useUnreadNotifications()

const expenses = ref<Expense[]>([])
const loading = ref(true)
const hideAmount = ref(false)
const search = ref('')
const statusFilter = ref<'all' | 'pending' | 'paid' | 'rejected'>('all')

// ── User ──────────────────────────────────────────────────────────────────────
const fullName = computed(() => (user.value as any)?.user_metadata?.full_name ?? user.value?.email ?? '')
const firstName = computed(() => {
  const n = fullName.value.split(/[\s@]/)[0] || 'there'
  return n.charAt(0).toUpperCase() + n.slice(1)
})
const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
})

// ── Money ─────────────────────────────────────────────────────────────────────
const OPEN = ['pending_manager', 'pending_finance', 'scheduled']
const myExpenses = computed(() => expenses.value.filter(e => e.submitted_by === user.value?.id))
const pendingReimbursement = computed(() =>
  myExpenses.value.filter(e => OPEN.includes(e.status)).reduce((s, e) => s + Number(e.amount), 0),
)
const fmtINR = (v: number) => '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// Count-up animation for the balance
const animatedBalance = useTransition(pendingReimbursement, { duration: 1100, transition: TransitionPresets.easeOutExpo })
const balanceWhole = computed(() => '₹' + Math.floor(animatedBalance.value).toLocaleString('en-IN'))
const balanceFraction = computed(() => '.' + (animatedBalance.value % 1).toFixed(2).slice(2))
const openCount = computed(() => myExpenses.value.filter(e => OPEN.includes(e.status)).length)

// ── Cash flow: paid vs pending for this week / month ─────────────────────────
const period = ref<'weekly' | 'monthly'>('monthly')
function setPeriod(p: 'weekly' | 'monthly') { period.value = p; haptic('selection') }
const range = computed(() => {
  const now = new Date()
  if (period.value === 'monthly') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)) // Monday
  return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6) }
})
const rangeLabel = computed(() => {
  const f = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${f(range.value.start)} - ${f(range.value.end)}`
})
const cashFlow = computed(() => {
  const { start, end } = range.value
  const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1)
  const inRange = myExpenses.value.filter((e) => {
    const iso = e.expense_date ?? e.created_at
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso)
    return d >= start && d < endOfDay
  })
  const paid = inRange.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0)
  const pending = inRange.filter(e => OPEN.includes(e.status)).reduce((s, e) => s + Number(e.amount), 0)
  const max = Math.max(paid, pending, 1)
  return { paid, pending, paidPct: (paid / max) * 100, pendingPct: (pending / max) * 100 }
})


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
  <div class="flex flex-col gap-4">
    <!-- ── Greeting ──────────────────────────────────────────────── -->
    <header class="m-rise flex items-center justify-between gap-3 pt-1">
      <p class="truncate text-[17px] text-foreground/90">
        {{ greeting }}, <span class="font-semibold text-foreground">{{ firstName }}</span>
      </p>
      <Button variant="ghost" size="icon" class="m-press relative rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground" as-child>
        <NuxtLink to="/m/notifications" aria-label="Notifications">
          <Icon name="solar:bell-linear" class="size-5.5" :class="unread > 0 ? 'm-wiggle' : ''" />
          <span v-if="unread > 0" class="absolute top-1.5 right-2 size-2 rounded-full bg-red-500 ring-2 ring-background" />
        </NuxtLink>
      </Button>
    </header>

    <!-- ── Main balance ──────────────────────────────────────────── -->
    <Card class="m-rise gap-0 rounded-3xl border border-white/[0.07] bg-secondary p-5 shadow-none ring-0" style="--d: 60ms">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-1">
          <p class="text-[19px] font-semibold text-foreground">Pending balance</p>
          <Button
            variant="ghost"
            size="icon-sm"
            class="m-press rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
            :aria-label="hideAmount ? 'Show amount' : 'Hide amount'"
            @click="hideAmount = !hideAmount"
          >
            <Icon :name="hideAmount ? 'solar:eye-closed-linear' : 'solar:eye-linear'" class="size-4" />
          </Button>
        </div>
        <Badge variant="outline" class="h-6 rounded-full border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[12px] font-semibold text-emerald-400">
          {{ openCount }} open
        </Badge>
      </div>

      <div class="mt-5 mb-6 h-11">
        <Skeleton v-if="loading" class="h-10 w-44 rounded-lg bg-white/10" />
        <Transition v-else name="m-swap" mode="out-in">
          <p :key="hideAmount ? 'h' : 's'" class="text-[42px] font-bold leading-none tracking-tight tabular-nums text-foreground">
            <template v-if="hideAmount">₹ • • • •</template>
            <template v-else>{{ balanceWhole }}<span class="font-normal text-muted-foreground">{{ balanceFraction }}</span></template>
          </p>
        </Transition>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <Button variant="outline" class="m-press h-10 gap-1.5 rounded-xl border-white/10 bg-white/[0.06] px-2 text-[14px] font-medium text-foreground/80 hover:bg-white/10 hover:text-foreground" as-child>
          <NuxtLink to="/m/expenses/new"><Icon name="solar:add-circle-linear" class="size-4" /> New</NuxtLink>
        </Button>
        <Button variant="outline" class="m-press h-10 gap-1.5 rounded-xl border-white/10 bg-white/[0.06] px-2 text-[14px] font-medium text-foreground/80 hover:bg-white/10 hover:text-foreground" as-child>
          <NuxtLink :to="current ? `/m/expenses/${current.id}` : '/m/expenses'"><Icon name="solar:transfer-horizontal-linear" class="size-4" /> Track</NuxtLink>
        </Button>
        <Button variant="outline" class="m-press h-10 gap-1.5 rounded-xl border-white/10 bg-white/[0.06] px-2 text-[14px] font-medium text-foreground/80 hover:bg-white/10 hover:text-foreground" as-child>
          <NuxtLink to="/m/payments"><Icon name="solar:plain-2-linear" class="size-4" /> Payouts</NuxtLink>
        </Button>
      </div>
    </Card>

    <!-- ── Submit an expense (promo) ─────────────────────────────── -->
    <Card class="m-rise gap-0 rounded-3xl border border-white/[0.07] bg-secondary p-5 shadow-none ring-0" style="--d: 100ms">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[17px] font-semibold text-foreground">Expense overview</p>
          <p class="mt-0.5 text-[14px] text-muted-foreground">Keep track of your claims.</p>
        </div>
        <Button size="sm" variant="secondary" class="m-press h-8 rounded-lg border border-white/10 bg-white/[0.08] px-3.5 text-[13.5px] font-medium text-foreground/80 hover:bg-white/15" as-child>
          <NuxtLink to="/m/expenses">View</NuxtLink>
        </Button>
      </div>

      <div class="relative mt-5 flex items-center gap-2 overflow-hidden rounded-2xl bg-white/[0.05] p-4">
        <div class="relative z-10 max-w-[64%]">
          <p class="text-[14px] leading-relaxed text-muted-foreground">
            Snap your receipt, add the details and follow it all the way to payout.
          </p>
          <Button size="sm" class="m-press mt-3 h-9 rounded-lg bg-[#2b8cff] px-4 text-[14.5px] font-semibold text-white hover:bg-[#2b8cff]/90" as-child>
            <NuxtLink to="/m/expenses/new">New expense</NuxtLink>
          </Button>
        </div>
        <div class="pointer-events-none absolute right-2 bottom-1 flex items-end" aria-hidden="true">
          <Icon name="solar:wad-of-money-bold-duotone" class="mb-1 -mr-3 size-10 text-amber-300/80" />
          <Icon name="solar:wallet-money-bold-duotone" class="size-24 text-[#ff6a3d]" />
        </div>
      </div>
    </Card>

    <!-- ── Cash flow ─────────────────────────────────────────────── -->
    <Card class="m-rise gap-0 rounded-3xl border border-white/[0.07] bg-secondary p-5 shadow-none ring-0" style="--d: 140ms">
      <div class="flex items-center justify-between gap-3">
        <p class="text-[17px] font-semibold text-foreground">Cash Flow</p>
        <div class="flex gap-0.5 rounded-xl border border-white/[0.07] bg-background/60 p-1">
          <Button
            v-for="p in (['weekly', 'monthly'] as const)"
            :key="p"
            variant="ghost"
            size="sm"
            class="m-press h-8 rounded-lg px-3.5 text-[14px] capitalize"
            :class="period === p ? 'bg-white/10 font-medium text-foreground/90 hover:bg-white/10' : 'font-normal text-muted-foreground hover:bg-transparent'"
            @click="setPeriod(p)"
          >{{ p }}</Button>
        </div>
      </div>

      <div class="mt-5 rounded-2xl bg-white/[0.05] p-4">
        <p class="text-[14px] text-muted-foreground">{{ rangeLabel }}</p>
        <Skeleton v-if="loading" class="mt-4 h-16 rounded-lg bg-white/10" />
        <template v-else>
          <div class="mt-4 flex items-center justify-between text-[14.5px]">
            <span class="text-foreground/90">Paid</span>
            <span class="font-semibold tabular-nums text-foreground">{{ fmtINR(cashFlow.paid) }}</span>
          </div>
          <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div class="h-full rounded-full bg-emerald-500 transition-[width] duration-700 ease-out" :style="{ width: `${cashFlow.paidPct}%` }" />
          </div>
          <div class="mt-4 flex items-center justify-between text-[14.5px]">
            <span class="text-foreground/90">Pending</span>
            <span class="font-semibold tabular-nums text-foreground">{{ fmtINR(cashFlow.pending) }}</span>
          </div>
          <div class="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.07]">
            <div class="h-full rounded-full bg-[#ff6a3d] transition-[width] duration-700 ease-out" :style="{ width: `${cashFlow.pendingPct}%` }" />
          </div>
        </template>
      </div>
    </Card>

    <!-- ── Search ────────────────────────────────────────────────── -->
    <div class="m-rise relative" style="--d: 120ms">
      <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        v-model="search"
        type="search"
        placeholder="Search expenses"
        class="h-13 rounded-2xl border-white/[0.07] bg-secondary pr-14 pl-11 text-base md:text-base dark:bg-secondary"
      />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="icon-lg"
            class="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-xl bg-foreground text-background transition-transform hover:bg-foreground/90 active:scale-90"
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
      <h2 class="mb-3 text-[17px] font-semibold text-foreground">Current Tracking</h2>
      <Skeleton v-if="loading" class="h-[184px] rounded-3xl" />
      <Card v-else-if="!current" class="items-center gap-2 rounded-3xl border border-white/[0.07] bg-secondary p-6 text-center shadow-none ring-0">
        <Icon name="solar:box-linear" class="size-7 text-muted-foreground" />
        <p class="text-sm font-medium text-foreground">Nothing to track yet</p>
        <p class="text-[12.5px] text-muted-foreground">Submit an expense and follow it until it's paid.</p>
      </Card>
      <NuxtLink v-else :to="`/m/expenses/${current.id}`" class="m-press block">
        <Card class="gap-0 rounded-3xl border border-white/[0.07] bg-secondary p-4 shadow-none ring-0">
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
        <h2 class="text-[17px] font-semibold text-foreground">Recent Activities</h2>
        <Button variant="link" size="sm" class="h-auto p-0 text-[13px] text-foreground" as-child>
          <NuxtLink to="/m/expenses">See all</NuxtLink>
        </Button>
      </div>

      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton v-for="n in 2" :key="n" class="h-[128px] rounded-3xl" />
      </div>
      <Card v-else-if="recent.length === 0" class="items-center rounded-3xl border border-white/[0.07] bg-secondary p-6 text-center shadow-none ring-0">
        <p class="text-[13px] text-muted-foreground">
          {{ search || statusFilter !== 'all' ? 'No expenses match your search.' : 'No activity yet.' }}
        </p>
      </Card>
      <TransitionGroup v-else name="m-list" tag="div" class="relative flex flex-col gap-2.5">
        <NuxtLink
          v-for="(e, i) in recent"
          :key="e.id"
          :to="`/m/expenses/${e.id}`"
          class="m-press m-rise block"
          :style="{ '--d': `${280 + i * 60}ms` }"
        >
          <Card class="flex-row items-center gap-3 rounded-2xl border border-white/[0.07] bg-secondary px-3.5 py-3 shadow-none ring-0">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold text-white"
              :style="{ background: personColor(e.vendor ?? e.category ?? '') }"
            >
              {{ (e.vendor ?? e.category ?? '?').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-medium text-foreground">{{ e.vendor ?? e.category }}</p>
              <p class="truncate text-[12.5px] text-muted-foreground">{{ expCode(e) }} · {{ fmtDate(e.expense_date ?? e.created_at) }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-[15px] font-semibold tabular-nums text-foreground">₹{{ Number(e.amount).toLocaleString('en-IN') }}</p>
              <p class="flex items-center justify-end gap-1 text-[11.5px] font-medium" :class="statusTone[statusMeta(e.status).variant]">
                <span class="size-1.5 rounded-full bg-current" />{{ statusText(e.status, e.payout_date) }}
              </p>
            </div>
            <Icon name="solar:alt-arrow-right-linear" class="size-5 shrink-0 text-muted-foreground" />
          </Card>
        </NuxtLink>
      </TransitionGroup>
    </section>
  </div>
  </MobilePullToRefresh>
</template>
