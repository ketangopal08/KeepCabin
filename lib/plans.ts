// Single source of truth for plans, prices and limits.
// Imported by both client and server — keep this file free of imports.

export type PlanId = 'free' | 'pro' | 'business' | 'enterprise'
export type BillingInterval = 'monthly' | 'yearly'
export type SubStatus = 'active' | 'past_due' | 'cancelled' | 'expired'
export type LimitKind = 'members' | 'teams' | 'expenses' | 'export' | 'driveSync'

/** null = unlimited */
export interface PlanLimits {
  members: number | null
  teams: number | null
  expensesPerMonth: number | null
  exportAnyRange: boolean
  driveSync: boolean
}

export interface PlanDisplay {
  id: PlanId
  name: string
  tagline: string
  icon: string
  gradient: [string, string]
  /** INR excl. GST, per month; null = custom */
  monthly: number | null
  /** INR excl. GST, per year; null = custom */
  yearly: number | null
  popular?: boolean
  includesFrom?: string
  features: string[]
  comingSoon?: string[]
}

export interface SubscriptionRow {
  org_id: string
  plan: PlanId
  interval: BillingInterval | null
  status: SubStatus
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  member_cap_override: number | null
  razorpay_subscription_id: string | null
  pending_razorpay_subscription_id: string | null
  pending_plan: PlanId | null
  pending_interval: BillingInterval | null
  last_payment_id: string | null
  /** paise */
  last_payment_amount: number | null
  /** created_at of the newest Razorpay event applied (ignores out-of-order deliveries) */
  last_event_at: string | null
}

export interface Usage {
  members: number
  pendingInvites: number
  teams: number
  expensesThisMonth: number
}

/** Response of GET /api/billing */
export interface BillingStatus {
  plan: PlanId
  trial: boolean
  trialEndsAt: string | null
  interval: BillingInterval | null
  status: SubStatus | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  pendingPlan: PlanId | null
  limits: PlanLimits
  usage: Usage
  canManage: boolean
}

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'business', 'enterprise']
export const TRIAL_DAYS = 14

export const PLANS: Record<PlanId, PlanDisplay & { limits: PlanLimits }> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'For small teams getting started with expense tracking.',
    icon: 'solar:magic-stick-3-linear',
    gradient: ['#a1a1aa', '#52525b'],
    monthly: 0,
    yearly: 0,
    features: ['Up to 3 members', '1 team + Finance', '30 expenses / month', 'Current-month CSV export'],
    limits: { members: 3, teams: 2, expensesPerMonth: 30, exportAnyRange: false, driveSync: false },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For growing companies that need speed and control.',
    icon: 'solar:rocket-2-linear',
    gradient: ['#60a5fa', '#4f46e5'],
    monthly: 1499,
    yearly: 14990,
    popular: true,
    includesFrom: 'Everything in Free, plus',
    features: ['Up to 15 members', 'Unlimited teams', '500 expenses / month', 'Any-range CSV export', 'Google Drive receipt sync', 'Priority email support'],
    limits: { members: 15, teams: null, expensesPerMonth: 500, exportAnyRange: true, driveSync: true },
  },
  business: {
    id: 'business',
    name: 'Business',
    tagline: 'For finance teams running policy-driven workflows.',
    icon: 'solar:buildings-2-linear',
    gradient: ['#f472b6', '#e11d48'],
    monthly: 3999,
    yearly: 39990,
    includesFrom: 'Everything in Pro, plus',
    features: ['Up to 50 members', 'Unlimited expenses', 'Chat support'],
    comingSoon: ['Custom approval policies', 'Multi-currency expenses', 'Tally / Zoho Books export', 'Audit log'],
    limits: { members: 50, teams: null, expensesPerMonth: null, exportAnyRange: true, driveSync: true },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large organizations with custom requirements.',
    icon: 'solar:diamond-linear',
    gradient: ['#fbbf24', '#ea580c'],
    monthly: null,
    yearly: null,
    includesFrom: 'Everything in Business, plus',
    features: ['SSO / SAML login', 'Custom integrations & API access', 'Dedicated account manager', 'Uptime SLA & priority onboarding', 'Data residency in India'],
    limits: { members: null, teams: null, expensesPerMonth: null, exportAnyRange: true, driveSync: true },
  },
}

const DAY_MS = 24 * 60 * 60 * 1000
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

function hasPaidAccess(sub: SubscriptionRow | null, now: Date): boolean {
  if (!sub || sub.plan === 'free') return false
  if (sub.status === 'active' || sub.status === 'past_due') return true
  if (sub.status === 'cancelled') {
    return !!sub.current_period_end && new Date(sub.current_period_end).getTime() > now.getTime()
  }
  return false
}

export function effectivePlan(
  sub: SubscriptionRow | null,
  orgCreatedAt: string,
  now: Date,
): { plan: PlanId; trial: boolean; limits: PlanLimits } {
  if (sub && hasPaidAccess(sub, now)) {
    const limits = { ...PLANS[sub.plan].limits }
    if (sub.plan === 'enterprise' && sub.member_cap_override != null) limits.members = sub.member_cap_override
    return { plan: sub.plan, trial: false, limits }
  }
  const age = now.getTime() - new Date(orgCreatedAt).getTime()
  if (age >= 0 && age < TRIAL_DAYS * DAY_MS) {
    return { plan: 'pro', trial: true, limits: { ...PLANS.pro.limits } }
  }
  return { plan: 'free', trial: false, limits: { ...PLANS.free.limits } }
}

/** Start of the current calendar month in IST, as a UTC Date. */
export function istMonthStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS)
}

/** Current month in IST as YYYY-MM. */
export function currentIstMonth(now: Date): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7)
}

export function proratedRefundPaise(amountPaise: number, periodStart: Date, periodEnd: Date, now: Date): number {
  const total = periodEnd.getTime() - periodStart.getTime()
  if (total <= 0) return 0
  const fraction = Math.min(1, Math.max(0, (periodEnd.getTime() - now.getTime()) / total))
  return Math.floor(amountPaise * fraction)
}

export function classifyChange(
  current: { plan: PlanId; interval: BillingInterval | null },
  target: { plan: PlanId; interval: BillingInterval },
): 'new' | 'upgrade' | 'downgrade' | 'same' {
  if (current.plan === 'free') return 'new'
  const diff = PLAN_ORDER.indexOf(target.plan) - PLAN_ORDER.indexOf(current.plan)
  if (diff > 0) return 'upgrade'
  if (diff < 0) return 'downgrade'
  if (current.interval === target.interval) return 'same'
  return target.interval === 'yearly' ? 'upgrade' : 'downgrade'
}

export function exportAllowed(limits: PlanLimits, month: string | undefined, now: Date): boolean {
  if (limits.exportAnyRange) return true
  return month === currentIstMonth(now)
}

/** true = one more is allowed */
export function checkLimit(limits: PlanLimits, kind: 'members' | 'teams' | 'expenses', used: number): boolean {
  const cap = kind === 'members' ? limits.members : kind === 'teams' ? limits.teams : limits.expensesPerMonth
  return cap === null || used < cap
}
