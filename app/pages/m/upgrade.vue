<script setup lang="ts">
import { toast } from 'vue-sonner'
import { PLANS, PLAN_ORDER } from '~~/lib/plans'
import type { PlanId } from '~~/lib/plans'

// Tab bar hidden: the screen has its own sticky plan CTA at the bottom.
definePageMeta({ layout: 'mobile', middleware: 'mobile', hideTabBar: true, pageTransition: { name: 'm-page', mode: 'out-in' } })

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

const billing = ref<'monthly' | 'yearly'>('monthly')
function setBilling(v: string) { billing.value = v as 'monthly' | 'yearly' }

const { billing: status, loading: statusLoading, load, checkout, cancel } = useBilling()
onMounted(() => load())

const plans = PLAN_ORDER.map(id => PLANS[id])
type Plan = (typeof plans)[number]

const currentPlan = computed<PlanId | null>(() => status.value?.plan ?? null)
const onTrial = computed(() => !!status.value?.trial)
const canManage = computed(() => !!status.value?.canManage)
const busyPlan = ref<PlanId | null>(null)

function price(p: Plan) {
  return billing.value === 'monthly' ? p.monthly : p.yearly
}

// The plan the workspace actually pays for (a trial counts as Free).
const paidPlan = computed<PlanId>(() => (onTrial.value ? 'free' : currentPlan.value ?? 'free'))
const isCurrent = (p: Plan) => p.id === paidPlan.value && (p.id === 'free' || status.value?.interval === billing.value)

function ctaLabel(p: Plan) {
  if (isCurrent(p)) return 'Current plan'
  if (p.id === 'enterprise') return 'Contact sales'
  if (p.id === 'free') return paidPlan.value === 'free' ? 'Current plan' : 'Cancel to switch'
  if (!canManage.value) return 'Ask your owner to upgrade'
  const order = PLAN_ORDER.indexOf(p.id) - PLAN_ORDER.indexOf(paidPlan.value)
  if (order < 0 || (order === 0 && billing.value === 'monthly')) return `Switch to ${p.name}`
  return `Upgrade to ${p.name}`
}

function ctaDisabled(p: Plan) {
  if (p.id === 'enterprise') return false
  if (isCurrent(p) || p.id === 'free') return true
  return !canManage.value || busyPlan.value !== null || status.value?.pendingPlan != null
}

async function choose(p: Plan) {
  if (p.id === 'enterprise') { toast.info('Our sales team will reach out to you shortly.'); return }
  if (p.id !== 'pro' && p.id !== 'business') return
  busyPlan.value = p.id
  try {
    await checkout(p.id, billing.value)
  } finally {
    busyPlan.value = null
  }
}

// ── Your plan ────────────────────────────────────────────────────────────────
const cancelOpen = ref(false)
const cancelling = ref(false)
async function confirmCancel() {
  cancelling.value = true
  try { await cancel() } finally { cancelling.value = false; cancelOpen.value = false }
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

const meters = computed(() => {
  const s = status.value
  if (!s) return []
  return [
    { label: 'Members', used: s.usage.members + s.usage.pendingInvites, cap: s.limits.members, hint: s.usage.pendingInvites ? `incl. ${s.usage.pendingInvites} pending invite${s.usage.pendingInvites > 1 ? 's' : ''}` : '' },
    { label: 'Teams', used: s.usage.teams, cap: s.limits.teams, hint: '' },
    { label: 'Expenses this month', used: s.usage.expensesThisMonth, cap: s.limits.expensesPerMonth, hint: '' },
  ]
})
const pct = (used: number, cap: number | null) => (cap ? Math.min(100, Math.round((used / cap) * 100)) : 0)

// ── Comparison (shown for the plan in focus) ─────────────────────────────────
type Cell = boolean | string
const comparison: { group: string; rows: { label: string; values: Cell[] }[] }[] = [
  {
    group: 'Team & usage',
    rows: [
      { label: 'Members',               values: ['Up to 3', 'Up to 15', 'Up to 50', 'Custom'] },
      { label: 'Teams',                 values: ['1 + Finance', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Expenses per month',    values: ['30', '500', 'Unlimited', 'Unlimited'] },
    ],
  },
  {
    group: 'Approvals & payments',
    rows: [
      { label: 'Manager approval',          values: [true, true, true, true] },
      { label: 'Finance payment step',      values: [true, true, true, true] },
      { label: 'Custom approval policies',  values: [false, false, 'Coming soon', 'Coming soon'] },
      { label: 'Multi-currency',            values: [false, false, 'Coming soon', 'Coming soon'] },
    ],
  },
  {
    group: 'Reports & integrations',
    rows: [
      { label: 'CSV export',                 values: ['Current month', 'Any range', 'Any range', 'Any range'] },
      { label: 'Google Drive sync',          values: [false, true, true, true] },
      { label: 'Tally / Zoho Books export',  values: [false, false, 'Coming soon', 'Coming soon'] },
      { label: 'API access',                 values: [false, false, false, true] },
    ],
  },
  {
    group: 'Security & support',
    rows: [
      { label: 'Audit log',           values: [false, false, 'Coming soon', 'Coming soon'] },
      { label: 'SSO / SAML',          values: [false, false, false, true] },
      { label: 'Support',             values: ['Community', 'Priority email', 'Chat', 'Dedicated manager'] },
    ],
  },
]

const faqs = [
  { q: 'How is pricing calculated?', a: 'Each plan has a flat monthly or yearly price with a member limit. You are never charged per member.' },
  { q: 'Can I switch plans later?', a: 'Yes. Upgrades apply immediately and the unused part of your current plan is refunded. Downgrades take effect at the end of your current billing period.' },
  { q: 'What happens to my data on the Free plan?', a: 'Nothing is deleted. If you exceed Free limits you keep read access to all history; new submissions pause until you upgrade or the month resets.' },
  { q: 'Do prices include GST?', a: 'Prices are shown in INR and exclude 18% GST, which is added at checkout. A GST invoice is issued for every payment.' },
  { q: 'Which payment methods are supported?', a: 'UPI AutoPay, credit and debit cards, and e-mandate. Payments renew automatically until you cancel.' },
  { q: 'Is there a free trial of Pro?', a: 'Every workspace can try Pro free for 14 days. No card is required, and you return to Free automatically if you do not upgrade.' },
]
const openFaq = ref<number | null>(null)

const highlights = [
  { icon: 'solar:shield-check-linear', title: 'Bank-grade security', desc: 'Encrypted at rest and in transit.' },
  { icon: 'solar:lock-keyhole-linear',        title: 'Cancel anytime',      desc: 'No lock-in on monthly plans.' },
  { icon: 'solar:headphones-round-linear',  title: 'Human support',       desc: 'Real people, fast replies.' },
]

// ── Swipeable plan carousel ──────────────────────────────────────────────────
const scroller = ref<HTMLElement | null>(null)
const active = ref(PLAN_ORDER.indexOf('pro'))
const activePlan = computed(() => plans[active.value] ?? plans[0]!)

function onScroll() {
  const el = scroller.value
  if (!el) return
  const center = el.scrollLeft + el.clientWidth / 2
  let best = 0
  let bestDist = Infinity
  Array.from(el.children).forEach((c, i) => {
    const child = c as HTMLElement
    const d = Math.abs(child.offsetLeft + child.offsetWidth / 2 - center)
    if (d < bestDist) { bestDist = d; best = i }
  })
  if (best !== active.value) { active.value = best; haptic() }
}

function scrollToPlan(i: number, smooth = true) {
  const el = scroller.value
  const child = el?.children[i] as HTMLElement | undefined
  if (!el || !child) return
  el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' })
  active.value = i
}

// Open on the current paid plan (or Pro when on Free / trial) once billing is known.
let positioned = false
watch(status, async (s) => {
  if (!s || positioned) return
  positioned = true
  await nextTick()
  const target = paidPlan.value === 'free' ? 'pro' : paidPlan.value
  scrollToPlan(PLAN_ORDER.indexOf(target), false)
}, { immediate: true })
onMounted(() => nextTick(() => { if (!positioned) scrollToPlan(active.value, false) }))
</script>

<template>
  <div class="flex flex-col">
    <MobilePageHeader title="Upgrade" subtitle="Plans & billing" back="/m/settings" />

    <!-- ── Your plan ───────────────────────────────────────────────── -->
    <Skeleton v-if="statusLoading && !status" class="m-rise mb-6 h-[220px] rounded-3xl" />
    <Card
      v-else-if="status"
      class="m-rise relative mb-6 gap-0 overflow-hidden rounded-3xl border-0 bg-foreground p-5 text-background shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] ring-0"
      style="--d: 60ms"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[12.5px] text-background/70">Your plan</p>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <p class="text-[24px] font-semibold leading-none">{{ PLANS[status.plan].name }}</p>
            <Icon v-if="status.plan !== 'free'" name="solar:crown-linear" class="size-5 text-amber-400" />
          </div>
        </div>
        <div
          class="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
          :style="{ background: `linear-gradient(135deg, ${PLANS[status.plan].gradient[0]} 0%, ${PLANS[status.plan].gradient[1]} 100%)` }"
        >
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
          <Icon :name="PLANS[status.plan].icon" class="relative size-5 text-white" />
        </div>
      </div>

      <div v-if="status.trial || status.status === 'past_due'" class="mt-3 flex flex-wrap gap-1.5">
        <Badge v-if="status.trial" variant="secondary" class="rounded-full">Trial · ends {{ fmtDate(status.trialEndsAt) }}</Badge>
        <Badge v-if="status.status === 'past_due'" variant="destructive" class="rounded-full">Payment failed — Razorpay is retrying</Badge>
      </div>

      <p class="mt-2.5 text-[12.5px] text-background/70">
        <template v-if="status.trial">You're trying Pro for free. Upgrade any time to keep it.</template>
        <template v-else-if="status.plan === 'free'">Upgrade to unlock more members, teams and reports.</template>
        <template v-else-if="status.cancelAtPeriodEnd && !status.pendingPlan">Cancelled · stays active until {{ fmtDate(status.currentPeriodEnd) }}</template>
        <template v-else-if="status.currentPeriodEnd">Billed {{ status.interval }} · renews {{ fmtDate(status.currentPeriodEnd) }}</template>
      </p>
      <p v-if="status.pendingPlan && status.cancelAtPeriodEnd" class="mt-1 text-[12.5px] text-background/70">
        Switching to {{ PLANS[status.pendingPlan].name }} on {{ fmtDate(status.currentPeriodEnd) }}
      </p>

      <Separator class="my-4 bg-background/15" />

      <div class="flex flex-col gap-3.5">
        <div v-for="m in meters" :key="m.label">
          <div class="flex items-baseline justify-between text-[12.5px]">
            <span class="text-background/70">{{ m.label }}</span>
            <span class="font-semibold tabular-nums">{{ m.used }} / {{ m.cap ?? 'Unlimited' }}</span>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-background/15">
            <div
              class="h-full rounded-full transition-all duration-700"
              :class="m.cap && m.used >= m.cap ? 'bg-destructive' : 'bg-background'"
              :style="{ width: m.cap ? `${pct(m.used, m.cap)}%` : '0%' }"
            />
          </div>
          <p v-if="m.hint" class="mt-1 text-[11px] text-background/60">{{ m.hint }}</p>
        </div>
      </div>

      <Button
        v-if="canManage && !status.trial && status.plan !== 'free' && status.plan !== 'enterprise' && !status.cancelAtPeriodEnd"
        variant="ghost"
        class="m-press mt-4 h-10 w-full rounded-full bg-background/10 text-[13px] font-semibold text-background hover:bg-background/15 hover:text-background"
        @click="cancelOpen = true; haptic()"
      >
        Cancel subscription
      </Button>
    </Card>

    <Dialog v-model:open="cancelOpen">
      <DialogContent class="max-w-[calc(100%-2rem)] rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel subscription?</DialogTitle>
          <DialogDescription>
            Your {{ status ? PLANS[status.plan].name : '' }} plan stays active until {{ fmtDate(status?.currentPeriodEnd) }}.
            After that your workspace moves to Free. No data is deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2">
          <Button variant="outline" class="h-11 rounded-full" @click="cancelOpen = false">Keep plan</Button>
          <Button variant="destructive" class="h-11 rounded-full" :disabled="cancelling" @click="confirmCancel">Cancel subscription</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Billing toggle ──────────────────────────────────────────── -->
    <div class="m-rise mb-4 flex flex-col items-center gap-2" style="--d: 120ms">
      <div class="grid w-full grid-cols-2 gap-1 rounded-full bg-muted/60 p-1">
        <Button
          v-for="t in [{ id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }]"
          :key="t.id"
          variant="ghost"
          class="m-press h-10 rounded-full text-[13px] font-semibold"
          :class="billing === t.id ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground hover:bg-transparent'"
          @click="setBilling(t.id); haptic()"
        >
          {{ t.label }}
        </Button>
      </div>
      <Badge variant="secondary" class="h-6 rounded-full px-2.5 text-[12px] font-normal">2 months free with yearly</Badge>
    </div>

    <!-- ── Plans (swipe) ───────────────────────────────────────────── -->
    <section class="m-rise" style="--d: 180ms">
      <div
        ref="scroller"
        class="m-plans relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-8 pb-2"
        @scroll.passive="onScroll"
      >
        <Card
          v-for="(p, i) in plans"
          :key="p.id"
          class="relative w-full shrink-0 snap-center gap-0 rounded-3xl border-0 p-5 shadow-none ring-0 transition-[transform,opacity] duration-300"
          :class="[
            isCurrent(p) ? 'bg-foreground text-background' : 'bg-muted/60',
            active === i ? 'scale-100 opacity-100' : 'scale-[.96] opacity-70',
          ]"
          @click="active !== i && scrollToPlan(i)"
        >
          <div class="flex items-start justify-between gap-2">
            <div
              class="relative flex size-11 items-center justify-center overflow-hidden rounded-2xl shadow-sm"
              :style="{ background: `linear-gradient(135deg, ${p.gradient[0]} 0%, ${p.gradient[1]} 100%)` }"
            >
              <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
              <Icon :name="p.icon" class="relative size-5 text-white" />
            </div>
            <div class="flex flex-col items-end gap-1">
              <Badge v-if="isCurrent(p)" class="h-6 gap-1 rounded-full bg-background px-2.5 text-[11.5px] font-semibold text-foreground">
                <Icon name="solar:check-circle-bold" class="size-3.5 text-emerald-500" /> Current plan
              </Badge>
              <Badge v-if="p.popular" :variant="isCurrent(p) ? 'secondary' : 'default'" class="h-6 rounded-full px-2.5 text-[11.5px] font-medium">Most popular</Badge>
            </div>
          </div>

          <p class="mt-4 text-[17px] font-semibold">{{ p.name }}</p>
          <p class="mt-0.5 min-h-[34px] text-[12.5px] leading-snug" :class="isCurrent(p) ? 'text-background/70' : 'text-muted-foreground'">{{ p.tagline }}</p>

          <!-- price -->
          <Transition name="m-swap" mode="out-in">
            <div :key="billing" class="mt-4">
              <div class="flex items-end gap-1.5">
                <template v-if="price(p) !== null">
                  <span class="text-[32px] font-semibold leading-none tabular-nums">₹{{ price(p)!.toLocaleString('en-IN') }}</span>
                  <span class="pb-1 text-[12px]" :class="isCurrent(p) ? 'text-background/70' : 'text-muted-foreground'">{{ p.monthly === 0 ? '/ month' : billing === 'yearly' ? '/ year + GST' : '/ month + GST' }}</span>
                </template>
                <span v-else class="text-[32px] font-semibold leading-none">Custom</span>
              </div>
              <p class="mt-1.5 h-5 text-[12px]" :class="isCurrent(p) ? 'text-background/70' : 'text-muted-foreground'">
                <template v-if="p.monthly === 0">Free forever</template>
                <template v-else-if="price(p) === null">Tailored to your organization</template>
                <template v-else-if="billing === 'yearly'">Billed yearly · ₹{{ p.yearly!.toLocaleString('en-IN') }} + GST</template>
                <template v-else>Billed monthly · cancel anytime</template>
              </p>
            </div>
          </Transition>

          <Separator class="my-4" :class="isCurrent(p) ? 'bg-background/15' : ''" />

          <!-- features -->
          <p class="mb-2.5 text-[12.5px] font-semibold">{{ p.includesFrom ?? 'Includes' }}</p>
          <ul class="flex flex-col gap-2">
            <li v-for="f in p.features" :key="f" class="flex items-start gap-2 text-[13px]">
              <Icon name="solar:check-circle-linear" class="mt-px size-4 shrink-0 text-emerald-500" />
              {{ f }}
            </li>
            <li v-for="f in p.comingSoon ?? []" :key="f" class="flex items-start gap-2 text-[13px]" :class="isCurrent(p) ? 'text-background/60' : 'text-muted-foreground'">
              <Icon name="solar:clock-circle-linear" class="mt-px size-4 shrink-0" />
              <span>{{ f }} <Badge variant="secondary" class="ml-0.5 h-5 rounded-full px-1.5 text-[10.5px] font-normal">Soon</Badge></span>
            </li>
          </ul>
        </Card>
      </div>

      <!-- dots -->
      <div class="mt-3 flex items-center justify-center gap-1">
        <Button
          v-for="(p, i) in plans"
          :key="p.id"
          variant="ghost"
          size="icon-xs"
          class="rounded-full hover:bg-transparent"
          :aria-label="`Show ${p.name}`"
          @click="scrollToPlan(i); haptic()"
        >
          <span
            class="h-1.5 rounded-full transition-all duration-300"
            :class="active === i ? 'w-5 bg-foreground' : 'w-1.5 bg-muted-foreground/40'"
          />
        </Button>
      </div>
    </section>

    <!-- ── What's in the plan in focus ─────────────────────────────── -->
    <section class="m-rise mt-6" style="--d: 240ms">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-[15px] font-semibold text-foreground">What's in {{ activePlan.name }}</h2>
        <span v-if="activePlan.id === currentPlan" class="text-[12px] text-muted-foreground">(current)</span>
      </div>
      <Card class="gap-0 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
        <template v-for="(g, gi) in comparison" :key="g.group">
          <p class="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground" :class="gi > 0 ? 'mt-4' : ''">{{ g.group }}</p>
          <div v-for="r in g.rows" :key="r.label" class="flex items-center justify-between gap-3 py-2">
            <span class="text-[13px] text-foreground">{{ r.label }}</span>
            <Transition name="m-swap" mode="out-in">
              <span :key="`${r.label}-${active}`" class="shrink-0 text-right">
                <Icon v-if="r.values[active] === true" name="solar:check-circle-bold" class="size-4.5 text-emerald-500" />
                <Icon v-else-if="r.values[active] === false" name="solar:minus-circle-linear" class="size-4.5 text-muted-foreground/50" />
                <span v-else class="text-[13px] font-semibold text-foreground">{{ r.values[active] }}</span>
              </span>
            </Transition>
          </div>
        </template>
      </Card>
    </section>

    <!-- ── Highlights ──────────────────────────────────────────────── -->
    <section class="m-rise mt-6 flex flex-col gap-2" style="--d: 300ms">
      <Card v-for="h in highlights" :key="h.title" class="flex-row items-center gap-3 rounded-3xl border-0 bg-muted/60 p-3.5 shadow-none ring-0">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-background">
          <Icon :name="h.icon" class="size-5 text-foreground" />
        </span>
        <div>
          <p class="text-[13px] font-semibold text-foreground">{{ h.title }}</p>
          <p class="text-[12px] text-muted-foreground">{{ h.desc }}</p>
        </div>
      </Card>
    </section>

    <!-- ── FAQ ─────────────────────────────────────────────────────── -->
    <section class="m-rise mt-6" style="--d: 360ms">
      <h2 class="mb-3 text-[15px] font-semibold text-foreground">Frequently asked questions</h2>
      <div class="flex flex-col gap-2">
        <Card v-for="(f, i) in faqs" :key="f.q" class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 p-0 shadow-none ring-0">
          <Button
            variant="ghost"
            class="h-auto w-full items-start justify-between gap-3 rounded-none px-4 py-3.5 text-left font-normal whitespace-normal hover:bg-transparent"
            :aria-expanded="openFaq === i"
            @click="openFaq = openFaq === i ? null : i; haptic()"
          >
            <span class="text-[13.5px] font-semibold leading-snug text-foreground">{{ f.q }}</span>
            <span
              class="flex size-6 shrink-0 items-center justify-center rounded-full bg-background transition-transform duration-300"
              :class="openFaq === i ? 'rotate-180' : ''"
            >
              <Icon name="solar:alt-arrow-down-linear" class="size-3.5 text-muted-foreground" />
            </span>
          </Button>
          <Transition name="m-faq">
            <div v-if="openFaq === i" class="m-faq-body">
              <div class="overflow-hidden">
                <p class="px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">{{ f.a }}</p>
              </div>
            </div>
          </Transition>
        </Card>
      </div>
    </section>

    <!-- ── Contact banner ──────────────────────────────────────────── -->
    <Card class="m-rise mt-6 gap-0 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0" style="--d: 420ms">
      <div class="flex items-start gap-3">
        <div class="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-violet-400 to-violet-700 shadow-sm">
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
          <Icon name="solar:letter-linear" class="relative size-5 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[14px] font-semibold text-foreground">Need a custom plan?</p>
          <p class="text-[12.5px] text-muted-foreground">Talk to us about volume pricing, onboarding, or special requirements.</p>
        </div>
      </div>
      <Button variant="outline" class="m-press mt-3 h-11 w-full rounded-full bg-background font-semibold" @click="choose(plans[3]!); haptic()">
        Contact sales
      </Button>
    </Card>

    <!-- ── Sticky CTA for the plan in focus ────────────────────────── -->
    <div
      class="fixed inset-x-0 bottom-0 z-40 bg-background/90 px-4 pt-3 backdrop-blur-xl"
      style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)"
    >
      <div class="mx-auto w-full max-w-md">
        <Button
          class="m-press h-13 w-full rounded-full text-[15px] font-semibold"
          :variant="isCurrent(activePlan) ? 'secondary' : 'default'"
          :disabled="ctaDisabled(activePlan)"
          @click="choose(activePlan); haptic()"
        >
          <Icon v-if="busyPlan === activePlan.id" name="solar:refresh-linear" class="size-4 animate-spin" />
          <Transition name="m-swap" mode="out-in">
            <span :key="`${activePlan.id}-${billing}-${ctaLabel(activePlan)}`">
              {{ ctaLabel(activePlan) }}<template v-if="!ctaDisabled(activePlan) && price(activePlan)"> · ₹{{ price(activePlan)!.toLocaleString('en-IN') }}</template>
            </span>
          </Transition>
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.m-plans {
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.m-plans::-webkit-scrollbar { display: none; }

/* Smooth height expand/collapse via grid-template-rows 0fr → 1fr */
.m-faq-body {
  display: grid;
  grid-template-rows: 1fr;
}
.m-faq-enter-active,
.m-faq-leave-active {
  transition: grid-template-rows 300ms cubic-bezier(.16, 1, .3, 1), opacity 220ms ease;
}
.m-faq-enter-from,
.m-faq-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
</style>
