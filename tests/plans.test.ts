import { describe, it, expect } from 'vitest'
import {
  PLANS, effectivePlan, istMonthStart, currentIstMonth, proratedRefundPaise,
  classifyChange, exportAllowed, checkLimit,
} from '../lib/plans'
import type { SubscriptionRow } from '../lib/plans'

const NOW = new Date('2026-11-18T10:00:00Z')
const OLD_ORG = '2026-01-01T00:00:00Z'
const row = (o: Partial<SubscriptionRow>): SubscriptionRow => ({
  org_id: 'o', plan: 'pro', interval: 'monthly', status: 'active',
  current_period_start: '2026-11-01T00:00:00Z', current_period_end: '2026-12-01T00:00:00Z',
  cancel_at_period_end: false, member_cap_override: null, razorpay_subscription_id: 'sub_1',
  pending_razorpay_subscription_id: null, pending_plan: null, pending_interval: null,
  last_payment_id: null, last_payment_amount: null, last_event_at: null, ...o,
})

describe('limits and prices', () => {
  it('free caps', () => expect(PLANS.free.limits).toEqual({ members: 3, teams: 2, expensesPerMonth: 30, exportAnyRange: false, driveSync: false }))
  it('pro caps', () => expect(PLANS.pro.limits).toEqual({ members: 15, teams: null, expensesPerMonth: 500, exportAnyRange: true, driveSync: true }))
  it('business caps', () => expect(PLANS.business.limits).toEqual({ members: 50, teams: null, expensesPerMonth: null, exportAnyRange: true, driveSync: true }))
  it('prices', () => {
    expect(PLANS.pro.monthly).toBe(1499); expect(PLANS.pro.yearly).toBe(14990)
    expect(PLANS.business.monthly).toBe(3999); expect(PLANS.business.yearly).toBe(39990)
    expect(PLANS.enterprise.monthly).toBeNull()
  })
})

describe('effectivePlan', () => {
  it('no row, old org → free', () => expect(effectivePlan(null, OLD_ORG, NOW)).toMatchObject({ plan: 'free', trial: false }))
  it('no row, org 3 days old → pro trial', () => expect(effectivePlan(null, '2026-11-15T00:00:00Z', NOW)).toMatchObject({ plan: 'pro', trial: true }))
  it('org exactly 14 days old → free', () => expect(effectivePlan(null, '2026-11-04T10:00:00Z', NOW).plan).toBe('free'))
  it('active pro', () => expect(effectivePlan(row({}), OLD_ORG, NOW)).toMatchObject({ plan: 'pro', trial: false }))
  it('past_due keeps paid even after period end', () => expect(effectivePlan(row({ status: 'past_due', current_period_end: '2026-11-10T00:00:00Z' }), OLD_ORG, NOW).plan).toBe('pro'))
  it('cancelled before period end keeps paid', () => expect(effectivePlan(row({ status: 'cancelled' }), OLD_ORG, NOW).plan).toBe('pro'))
  it('cancelled after period end → free', () => expect(effectivePlan(row({ status: 'cancelled', current_period_end: '2026-11-17T00:00:00Z' }), OLD_ORG, NOW).plan).toBe('free'))
  it('expired → free', () => expect(effectivePlan(row({ status: 'expired' }), OLD_ORG, NOW).plan).toBe('free'))
  it('pending fields ignored', () => expect(effectivePlan(row({ pending_plan: 'business', pending_razorpay_subscription_id: 'sub_2' }), OLD_ORG, NOW).plan).toBe('pro'))
  it('expired row within trial window → pro trial', () => expect(effectivePlan(row({ status: 'expired' }), '2026-11-15T00:00:00Z', NOW)).toMatchObject({ plan: 'pro', trial: true }))
  it('enterprise override cap', () => expect(effectivePlan(row({ plan: 'enterprise', member_cap_override: 200 }), OLD_ORG, NOW).limits.members).toBe(200))
  it('enterprise without override is unlimited', () => expect(effectivePlan(row({ plan: 'enterprise' }), OLD_ORG, NOW).limits.members).toBeNull())
  it('returned limits are a copy', () => {
    effectivePlan(null, OLD_ORG, NOW).limits.members = 999
    expect(PLANS.free.limits.members).toBe(3)
  })
})

describe('IST months', () => {
  it('01:30 IST on Dec 1 belongs to December', () => expect(istMonthStart(new Date('2026-11-30T20:00:00Z')).toISOString()).toBe('2026-11-30T18:30:00.000Z'))
  it('mid-month', () => expect(istMonthStart(NOW).toISOString()).toBe('2026-10-31T18:30:00.000Z'))
  it('currentIstMonth crosses into next month at IST midnight', () => expect(currentIstMonth(new Date('2026-11-30T20:00:00Z'))).toBe('2026-12'))
})

describe('proratedRefundPaise', () => {
  const s = new Date('2026-11-01T00:00:00Z'), e = new Date('2026-12-01T00:00:00Z')
  it('half period', () => expect(proratedRefundPaise(176882, s, e, new Date('2026-11-16T00:00:00Z'))).toBe(88441))
  it('after end → 0', () => expect(proratedRefundPaise(176882, s, e, new Date('2026-12-02T00:00:00Z'))).toBe(0))
  it('before start → full', () => expect(proratedRefundPaise(176882, s, e, new Date('2026-10-30T00:00:00Z'))).toBe(176882))
})

describe('classifyChange', () => {
  it('free → pro is new', () => expect(classifyChange({ plan: 'free', interval: null }, { plan: 'pro', interval: 'monthly' })).toBe('new'))
  it('pro → business upgrade', () => expect(classifyChange({ plan: 'pro', interval: 'monthly' }, { plan: 'business', interval: 'monthly' })).toBe('upgrade'))
  it('monthly → yearly upgrade', () => expect(classifyChange({ plan: 'pro', interval: 'monthly' }, { plan: 'pro', interval: 'yearly' })).toBe('upgrade'))
  it('business → pro downgrade', () => expect(classifyChange({ plan: 'business', interval: 'yearly' }, { plan: 'pro', interval: 'yearly' })).toBe('downgrade'))
  it('yearly → monthly downgrade', () => expect(classifyChange({ plan: 'pro', interval: 'yearly' }, { plan: 'pro', interval: 'monthly' })).toBe('downgrade'))
  it('same', () => expect(classifyChange({ plan: 'pro', interval: 'monthly' }, { plan: 'pro', interval: 'monthly' })).toBe('same'))
})

describe('exportAllowed', () => {
  it('free current IST month ok', () => expect(exportAllowed(PLANS.free.limits, '2026-11', NOW)).toBe(true))
  it('free past month blocked', () => expect(exportAllowed(PLANS.free.limits, '2026-10', NOW)).toBe(false))
  it('free all-time blocked', () => expect(exportAllowed(PLANS.free.limits, undefined, NOW)).toBe(false))
  it('pro any', () => expect(exportAllowed(PLANS.pro.limits, undefined, NOW)).toBe(true))
})

describe('checkLimit', () => {
  it('members at cap blocked (members + pending invites)', () => expect(checkLimit(PLANS.free.limits, 'members', 2 + 1)).toBe(false))
  it('members under cap ok', () => expect(checkLimit(PLANS.free.limits, 'members', 2)).toBe(true))
  it('unlimited teams ok', () => expect(checkLimit(PLANS.pro.limits, 'teams', 999)).toBe(true))
  it('expenses at 30 blocked on free', () => expect(checkLimit(PLANS.free.limits, 'expenses', 30)).toBe(false))
})
