<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({ layout: 'app', middleware: 'auth' })

const billing = ref<'monthly' | 'yearly'>('monthly')
function setBilling(v: string) { billing.value = v as 'monthly' | 'yearly' }

// Current plan — placeholder until billing is wired to the backend
const currentPlan = 'free'

type Plan = {
  id: string
  name: string
  tagline: string
  icon: any
  gradient: [string, string]
  monthly: number | null   // per user / month, null = custom
  yearly: number | null    // per user / month, billed yearly
  popular?: boolean
  cta: string
  includesFrom?: string
  features: string[]
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For small teams getting started with expense tracking.',
    icon: 'solar:magic-stick-3-linear',
    gradient: ['#a1a1aa', '#52525b'],
    monthly: 0,
    yearly: 0,
    cta: 'Current plan',
    features: [
      'Up to 5 members',
      '1 team',
      '50 receipt scans / month',
      'Single-level approvals',
      'Monthly CSV export',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For growing companies that need speed and control.',
    icon: 'solar:rocket-2-linear',
    gradient: ['#60a5fa', '#4f46e5'],
    monthly: 499,
    yearly: 399,
    popular: true,
    cta: 'Upgrade to Pro',
    includesFrom: 'Everything in Free, plus',
    features: [
      'Unlimited members & teams',
      'Unlimited receipt scans (OCR)',
      'Manager + finance approval flow',
      'Advanced reports & any-range export',
      'Google Drive receipt sync',
      'Priority email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For finance teams running policy-driven workflows.',
    icon: 'solar:buildings-2-linear',
    gradient: ['#f472b6', '#e11d48'],
    monthly: 899,
    yearly: 719,
    cta: 'Upgrade to Business',
    includesFrom: 'Everything in Pro, plus',
    features: [
      'Custom approval policies & limits',
      'Multi-currency expenses',
      'Accounting export (Tally, Zoho Books)',
      'Audit log & activity history',
      'Role-based permissions',
      'Chat support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organizations with custom requirements.',
    icon: 'solar:diamond-linear',
    gradient: ['#fbbf24', '#ea580c'],
    monthly: null,
    yearly: null,
    cta: 'Contact sales',
    includesFrom: 'Everything in Business, plus',
    features: [
      'SSO / SAML login',
      'Custom integrations & API access',
      'Dedicated account manager',
      'Uptime SLA & priority onboarding',
      'Data residency in India',
    ],
  },
]

function price(p: Plan) {
  const v = billing.value === 'monthly' ? p.monthly : p.yearly
  return v
}

function choose(p: Plan) {
  if (p.id === currentPlan) return
  if (p.id === 'enterprise') { toast.info('Our sales team will reach out to you shortly.'); return }
  toast.info(`Checkout for ${p.name} is coming soon.`)
}

// ── Comparison table ─────────────────────────────────────────────────────────
type Cell = boolean | string
const comparison: { group: string; rows: { label: string; values: Cell[] }[] }[] = [
  {
    group: 'Team & usage',
    rows: [
      { label: 'Members',               values: ['Up to 5', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Teams',                 values: ['1', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Receipt scans (OCR)',   values: ['50 / month', 'Unlimited', 'Unlimited', 'Unlimited'] },
      { label: 'Receipt storage',       values: ['1 GB', '50 GB', '250 GB', 'Custom'] },
    ],
  },
  {
    group: 'Approvals & payments',
    rows: [
      { label: 'Manager approval',          values: [true, true, true, true] },
      { label: 'Finance payment step',      values: [false, true, true, true] },
      { label: 'Custom approval policies',  values: [false, false, true, true] },
      { label: 'Multi-currency',            values: [false, false, true, true] },
    ],
  },
  {
    group: 'Reports & integrations',
    rows: [
      { label: 'CSV export',                 values: ['Monthly', 'Any range', 'Any range', 'Any range'] },
      { label: 'Google Drive sync',          values: [false, true, true, true] },
      { label: 'Tally / Zoho Books export',  values: [false, false, true, true] },
      { label: 'API access',                 values: [false, false, false, true] },
    ],
  },
  {
    group: 'Security & support',
    rows: [
      { label: 'Audit log',           values: [false, false, true, true] },
      { label: 'SSO / SAML',          values: [false, false, false, true] },
      { label: 'Support',             values: ['Community', 'Priority email', 'Chat', 'Dedicated manager'] },
    ],
  },
]

const faqs = [
  { q: 'How is pricing calculated?', a: 'Paid plans are billed per active member each month. Members who did not submit or approve anything in a billing period are not charged.' },
  { q: 'Can I switch plans later?', a: 'Yes. Upgrades apply immediately and are prorated. Downgrades take effect at the end of your current billing period.' },
  { q: 'What happens to my data on the Free plan?', a: 'Nothing is deleted. If you exceed Free limits you keep read access to all history; new submissions pause until you upgrade or the month resets.' },
  { q: 'Do prices include GST?', a: 'Prices are shown in INR and exclude 18% GST, which is added at checkout. A GST invoice is issued for every payment.' },
  { q: 'Which payment methods are supported?', a: 'UPI, credit and debit cards, and net banking. Annual Business and Enterprise plans can also pay by bank transfer against an invoice.' },
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

    <!-- ── Billing tabs ────────────────────────────────────────────── -->
    <AppPageTabs
      :model-value="billing"
      :tabs="[{ id: 'monthly', label: 'Monthly' }, { id: 'yearly', label: 'Yearly' }]"
      @update:model-value="setBilling"
    >
      <Badge variant="secondary" class="h-6 rounded-full px-2.5 text-[12.5px] font-normal">Save 20% with yearly</Badge>
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
            <span class="pb-1 text-[13px] text-muted-foreground">/ user / month</span>
          </template>
          <span v-else class="text-[34px] leading-none font-normal text-foreground">Custom</span>
        </div>
        <p class="mt-2 h-5 text-[12.5px] text-muted-foreground">
          <template v-if="p.monthly === 0">Free forever</template>
          <template v-else-if="price(p) === null">Tailored to your organization</template>
          <template v-else-if="billing === 'yearly'">Billed yearly · ₹{{ (p.yearly! * 12).toLocaleString('en-IN') }} per user</template>
          <template v-else>Billed monthly</template>
        </p>

        <!-- CTA -->
        <Button
          class="mt-5 h-9 w-full rounded-lg"
          :variant="p.id === currentPlan ? 'secondary' : p.popular ? 'default' : 'outline'"
          :disabled="p.id === currentPlan"
          @click="choose(p)"
        >
          {{ p.cta }}
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

      <Table>
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="h-11 w-[34%] px-2 font-normal text-muted-foreground">Feature</TableHead>
            <TableHead v-for="p in plans" :key="p.id" class="h-11 font-medium text-foreground">
              {{ p.name }}
              <span v-if="p.id === currentPlan" class="ml-1 text-xs font-normal text-muted-foreground">(current)</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-for="g in comparison" :key="g.group">
            <TableRow class="hover:bg-transparent">
              <TableCell colspan="5" class="px-2 pt-6 pb-2 text-[13px] font-medium text-muted-foreground">{{ g.group }}</TableCell>
            </TableRow>
            <TableRow v-for="r in g.rows" :key="r.label" class="border-border">
              <TableCell class="px-2 py-3 text-foreground">{{ r.label }}</TableCell>
              <TableCell v-for="(v, i) in r.values" :key="i" class="py-3">
                <Icon name="solar:check-linear" v-if="v === true" class="size-4 text-emerald-500" />
                <Icon name="solar:minus-linear" v-else-if="v === false" class="size-4 text-muted-foreground/50" />
                <span v-else class="text-foreground/90">{{ v }}</span>
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
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
