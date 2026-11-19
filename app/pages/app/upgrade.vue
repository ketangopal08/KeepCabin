<script setup lang="ts">
import { toast } from 'vue-sonner'
import { PLANS, PLAN_ORDER } from '~~/lib/plans'
import type { PlanId } from '~~/lib/plans'

definePageMeta({ layout: 'app', middleware: 'auth' })

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

// ── Comparison table ─────────────────────────────────────────────────────────
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

const highlights = [
  { icon: 'solar:shield-check-linear', title: 'Bank-grade security', desc: 'Encrypted at rest and in transit.' },
  { icon: 'solar:lock-keyhole-linear',        title: 'Cancel anytime',      desc: 'No lock-in on monthly plans.' },
  { icon: 'solar:headphones-round-linear',  title: 'Human support',       desc: 'Real people, fast replies.' },
]
</script>

<template>
  <AppPage>

    <!-- ── Header ──────────────────────────────────────────────────── -->
    <AppPageHeader title="Upgrade" description="Choose the plan that fits your team. Upgrade or downgrade anytime." />

    <!-- ── Your plan ───────────────────────────────────────────────── -->
    <Skeleton v-if="statusLoading && !status" class="mb-8 h-[140px] w-full rounded-xl" />
    <Card v-else-if="status" class="mb-8 gap-0 rounded-xl px-5 py-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-[13px] text-muted-foreground">Your plan</p>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <p class="text-lg font-medium text-foreground">{{ PLANS[status.plan].name }}</p>
            <Icon v-if="status.plan !== 'free'" name="solar:crown-linear" class="size-4 text-amber-500" />
            <Badge v-if="status.trial" variant="secondary" class="rounded-full">Trial · ends {{ fmtDate(status.trialEndsAt) }}</Badge>
            <Badge v-if="status.status === 'past_due'" variant="destructive" class="rounded-full">Payment failed — Razorpay is retrying</Badge>
          </div>
          <p class="mt-1 text-[13px] text-muted-foreground">
            <template v-if="status.trial">You're trying Pro for free. Upgrade any time to keep it.</template>
            <template v-else-if="status.plan === 'free'">Upgrade to unlock more members, teams and reports.</template>
            <template v-else-if="status.cancelAtPeriodEnd && !status.pendingPlan">Cancelled · stays active until {{ fmtDate(status.currentPeriodEnd) }}</template>
            <template v-else-if="status.currentPeriodEnd">Billed {{ status.interval }} · renews {{ fmtDate(status.currentPeriodEnd) }}</template>
          </p>
          <p v-if="status.pendingPlan && status.cancelAtPeriodEnd" class="mt-1 text-[13px] text-muted-foreground">
            Switching to {{ PLANS[status.pendingPlan].name }} on {{ fmtDate(status.currentPeriodEnd) }}
          </p>
        </div>
        <Button
          v-if="canManage && !status.trial && status.plan !== 'free' && status.plan !== 'enterprise' && !status.cancelAtPeriodEnd"
          variant="outline"
          size="sm"
          class="rounded-lg"
          @click="cancelOpen = true"
        >
          Cancel subscription
        </Button>
      </div>

      <Separator class="my-4" />

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div v-for="m in meters" :key="m.label">
          <div class="flex items-baseline justify-between text-[13px]">
            <span class="text-muted-foreground">{{ m.label }}</span>
            <span class="tabular-nums text-foreground">{{ m.used }} / {{ m.cap ?? 'Unlimited' }}</span>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-all"
              :class="m.cap && m.used >= m.cap ? 'bg-destructive' : 'bg-primary'"
              :style="{ width: m.cap ? `${pct(m.used, m.cap)}%` : '0%' }"
            />
          </div>
          <p v-if="m.hint" class="mt-1 text-[12px] text-muted-foreground">{{ m.hint }}</p>
        </div>
      </div>
    </Card>

    <Dialog v-model:open="cancelOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel subscription?</DialogTitle>
          <DialogDescription>
            Your {{ status ? PLANS[status.plan].name : '' }} plan stays active until {{ fmtDate(status?.currentPeriodEnd) }}.
            After that your workspace moves to Free. No data is deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="cancelOpen = false">Keep plan</Button>
          <Button variant="destructive" :disabled="cancelling" @click="confirmCancel">Cancel subscription</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ── Billing tabs ────────────────────────────────────────────── -->
    <AppPageTabs
      :model-value="billing"
      :tabs="[{ id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }]"
      @update:model-value="setBilling"
    >
      <Badge variant="secondary" class="h-6 rounded-full px-2.5 text-[12.5px] font-normal">2 months free with yearly</Badge>
    </AppPageTabs>

    <!-- ── Plans ───────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card
        v-for="p in plans"
        :key="p.id"
        class="relative gap-0 rounded-xl px-5 py-5"
        :class="p.popular ? 'ring-2 ring-foreground/70' : ''"
      >
        <Badge v-if="p.popular" class="absolute top-5 right-5 h-6 rounded-full px-2.5 text-[12px] font-medium">Most popular</Badge>

        <!-- icon -->
        <div
          class="relative mb-4 flex size-10 items-center justify-center overflow-hidden rounded-[10px] shadow-sm"
          :style="{ background: `linear-gradient(135deg, ${p.gradient[0]} 0%, ${p.gradient[1]} 100%)` }"
        >
          <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
          <Icon :name="p.icon" class="relative size-5 text-white" />
        </div>

        <p class="text-[15px] font-medium text-foreground">{{ p.name }}</p>
        <p class="mt-1 min-h-[40px] text-[13px] leading-snug text-muted-foreground">{{ p.tagline }}</p>

        <!-- price -->
        <div class="mt-5 flex items-end gap-1.5">
          <template v-if="price(p) !== null">
            <span class="text-[34px] leading-none font-normal tabular-nums text-foreground">₹{{ price(p)!.toLocaleString('en-IN') }}</span>
            <span class="pb-1 text-[13px] text-muted-foreground">{{ p.monthly === 0 ? '/ month' : billing === 'yearly' ? '/ year + GST' : '/ month + GST' }}</span>
          </template>
          <span v-else class="text-[34px] leading-none font-normal text-foreground">Custom</span>
        </div>
        <p class="mt-2 h-5 text-[12.5px] text-muted-foreground">
          <template v-if="p.monthly === 0">Free forever</template>
          <template v-else-if="price(p) === null">Tailored to your organization</template>
          <template v-else-if="billing === 'yearly'">Billed yearly · ₹{{ p.yearly!.toLocaleString('en-IN') }} + GST</template>
          <template v-else>Billed monthly · cancel anytime</template>
        </p>

        <!-- CTA -->
        <Button
          class="mt-5 h-9 w-full rounded-lg"
          :variant="isCurrent(p) ? 'secondary' : p.popular ? 'default' : 'outline'"
          :disabled="ctaDisabled(p)"
          @click="choose(p)"
        >
          <Icon v-if="busyPlan === p.id" name="solar:refresh-linear" class="size-4 animate-spin" />
          {{ ctaLabel(p) }}
        </Button>

        <Separator class="my-5" />

        <!-- features -->
        <p v-if="p.includesFrom" class="mb-3 text-[13px] font-medium text-foreground">{{ p.includesFrom }}</p>
        <p v-else class="mb-3 text-[13px] font-medium text-foreground">Includes</p>
        <ul class="flex flex-col gap-2.5">
          <li v-for="f in p.features" :key="f" class="flex items-start gap-2.5 text-sm text-foreground/90">
            <Icon name="solar:check-linear" class="mt-0.5 size-4 shrink-0 text-emerald-500" />
            {{ f }}
          </li>
          <li v-for="f in p.comingSoon ?? []" :key="f" class="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Icon name="solar:clock-circle-linear" class="mt-0.5 size-4 shrink-0" />
            <span>{{ f }} <Badge variant="secondary" class="ml-1 h-5 rounded-full px-2 text-[11px] font-normal">Coming soon</Badge></span>
          </li>
        </ul>
      </Card>
    </div>

    <!-- ── Highlights ──────────────────────────────────────────────── -->
    <div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card v-for="h in highlights" :key="h.title" class="flex-row items-center gap-3 rounded-xl px-4 py-3.5">
        <div class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon :name="h.icon" class="size-4 text-foreground" />
        </div>
        <div>
          <p class="text-sm font-medium text-foreground">{{ h.title }}</p>
          <p class="text-[13px] text-muted-foreground">{{ h.desc }}</p>
        </div>
      </Card>
    </div>

    <!-- ── Comparison ──────────────────────────────────────────────── -->
    <div class="mt-14">
      <h2 class="text-base font-medium tracking-tight text-foreground">Compare plans</h2>
      <p class="mt-1 mb-5 text-sm text-muted-foreground">A detailed look at what's included in each plan.</p>

      <AppTableCard>
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent">
              <TableHead class="w-[34%]">Feature</TableHead>
              <TableHead v-for="p in plans" :key="p.id" class="font-medium text-foreground">
                {{ p.name }}
                <span v-if="p.id === currentPlan" class="ml-1 text-xs font-normal text-muted-foreground">(current)</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-for="g in comparison" :key="g.group">
              <TableRow class="hover:bg-transparent">
                <TableCell colspan="5" class="pt-6 pb-2 text-[13px] font-medium text-muted-foreground">{{ g.group }}</TableCell>
              </TableRow>
              <TableRow v-for="r in g.rows" :key="r.label" class="border-border">
                <TableCell class="text-foreground">{{ r.label }}</TableCell>
                <TableCell v-for="(v, i) in r.values" :key="i" class="py-3">
                  <Icon name="solar:check-linear" v-if="v === true" class="size-4 text-emerald-500" />
                  <Icon name="solar:minus-linear" v-else-if="v === false" class="size-4 text-muted-foreground/50" />
                  <span v-else class="text-foreground/90">{{ v }}</span>
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </AppTableCard>
    </div>

    <!-- ── FAQ ─────────────────────────────────────────────────────── -->
    <div class="mt-14">
      <h2 class="mb-5 text-base font-medium tracking-tight text-foreground">Frequently asked questions</h2>
      <div class="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div v-for="f in faqs" :key="f.q" class="border-t border-border py-5">
          <p class="text-[14px] font-medium text-foreground">{{ f.q }}</p>
          <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ f.a }}</p>
        </div>
      </div>
    </div>

    <!-- ── Contact banner ──────────────────────────────────────────── -->
    <Card class="mt-10 flex-row flex-wrap items-center gap-4 rounded-xl px-5 py-4">
      <div class="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-gradient-to-br from-violet-400 to-violet-700 shadow-sm">
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
        <Icon name="solar:letter-linear" class="relative size-5 text-white" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[14px] font-medium text-foreground">Need a custom plan?</p>
        <p class="text-[13px] text-muted-foreground">Talk to us about volume pricing, onboarding, or special requirements.</p>
      </div>
      <Button variant="outline" class="h-9 rounded-lg px-4" @click="choose(plans[3]!)">Contact sales</Button>
    </Card>

  </AppPage>
</template>
