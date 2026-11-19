import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyPaymentSignature, verifyWebhookSignature, applyWebhookEvent, upgradeCleanup } from '../lib/razorpay'
import type { SubscriptionRow } from '../lib/plans'

const SECRET = 's3cret'
const hmac = (s: string) => createHmac('sha256', SECRET).update(s).digest('hex')

describe('signatures', () => {
  it('payment signature ok', () => expect(verifyPaymentSignature('pay_1', 'sub_1', hmac('pay_1|sub_1'), SECRET)).toBe(true))
  it('payment signature wrong', () => expect(verifyPaymentSignature('pay_1', 'sub_1', hmac('pay_1|sub_2'), SECRET)).toBe(false))
  it('payment signature different length', () => expect(verifyPaymentSignature('pay_1', 'sub_1', 'abc', SECRET)).toBe(false))
  it('webhook signature ok', () => expect(verifyWebhookSignature('{"a":1}', hmac('{"a":1}'), SECRET)).toBe(true))
  it('webhook signature wrong', () => expect(verifyWebhookSignature('{"a":1}', hmac('{"a":2}'), SECRET)).toBe(false))
  it('webhook signature empty', () => expect(verifyWebhookSignature('{"a":1}', '', SECRET)).toBe(false))
})

const row: SubscriptionRow = {
  org_id: 'o', plan: 'pro', interval: 'monthly', status: 'active',
  current_period_start: '2026-11-01T00:00:00.000Z', current_period_end: '2026-12-01T00:00:00.000Z',
  cancel_at_period_end: false, member_cap_override: null, razorpay_subscription_id: 'sub_old',
  pending_razorpay_subscription_id: 'sub_new', pending_plan: 'business', pending_interval: 'monthly',
  last_payment_id: 'pay_0', last_payment_amount: 176882, last_event_at: null,
}
const START = 1794960000 // 2026-11-18T00:00:00Z
const END = 1797552000   // 2026-12-18T00:00:00Z
const ev = (event: string, id: string, payment?: { id: string; amount: number }) => ({
  event,
  payload: {
    subscription: { entity: { id, current_start: START, current_end: END } },
    ...(payment ? { payment: { entity: payment } } : {}),
  },
})

describe('applyWebhookEvent', () => {
  it('activated for pending → promote', () => {
    expect(applyWebhookEvent(row, ev('subscription.activated', 'sub_new'))).toEqual({
      kind: 'promote',
      oldSubscriptionId: 'sub_old',
      patch: {
        plan: 'business', interval: 'monthly', status: 'active',
        razorpay_subscription_id: 'sub_new', cancel_at_period_end: false,
        current_period_start: '2026-11-18T00:00:00.000Z', current_period_end: '2026-12-18T00:00:00.000Z',
        last_payment_id: null, last_payment_amount: null,
        pending_razorpay_subscription_id: null, pending_plan: null, pending_interval: null,
      },
    })
  })
  it('charged for pending → promote with payment', () => {
    const eff = applyWebhookEvent(row, ev('subscription.charged', 'sub_new', { id: 'pay_9', amount: 471882 }))
    expect(eff.kind).toBe('promote')
    expect(eff.kind === 'promote' && eff.patch).toMatchObject({ last_payment_id: 'pay_9', last_payment_amount: 471882, plan: 'business' })
  })
  it('charged for active → update period + payment', () => {
    expect(applyWebhookEvent(row, ev('subscription.charged', 'sub_old', { id: 'pay_2', amount: 176882 }))).toEqual({
      kind: 'update',
      patch: {
        status: 'active',
        current_period_start: '2026-11-18T00:00:00.000Z', current_period_end: '2026-12-18T00:00:00.000Z',
        last_payment_id: 'pay_2', last_payment_amount: 176882,
      },
    })
  })
  it('pending → past_due', () => expect(applyWebhookEvent(row, ev('subscription.pending', 'sub_old'))).toEqual({ kind: 'update', patch: { status: 'past_due' } }))
  it('halted → expired', () => expect(applyWebhookEvent(row, ev('subscription.halted', 'sub_old'))).toEqual({ kind: 'update', patch: { status: 'expired' } }))
  it('cancelled for active → cancelled', () => expect(applyWebhookEvent(row, ev('subscription.cancelled', 'sub_old'))).toEqual({ kind: 'update', patch: { status: 'cancelled' } }))
  it('unknown id → ignore (e.g. old sub cancelled after upgrade)', () => expect(applyWebhookEvent(row, ev('subscription.cancelled', 'sub_ancient'))).toEqual({ kind: 'ignore' }))
  it('authenticated for pending → ignore', () => expect(applyWebhookEvent(row, ev('subscription.authenticated', 'sub_new'))).toEqual({ kind: 'ignore' }))
  it('cancelled for pending → clears pending', () => expect(applyWebhookEvent(row, ev('subscription.cancelled', 'sub_new'))).toEqual({
    kind: 'update', patch: { pending_razorpay_subscription_id: null, pending_plan: null, pending_interval: null },
  }))
  it('payment.failed for active → past_due', () => expect(applyWebhookEvent(row, {
    event: 'payment.failed',
    payload: { payment: { entity: { id: 'pay_x', amount: 176882, subscription_id: 'sub_old' } } },
  })).toEqual({ kind: 'update', patch: { status: 'past_due' } }))
  it('null row + activated → ignore', () => expect(applyWebhookEvent(null, ev('subscription.activated', 'sub_new'))).toEqual({ kind: 'ignore' }))

  // Review fix: promote without a payment must not keep the OLD subscription's payment (would refund it twice)
  it('activated without payment → promote clears last payment', () => {
    const eff = applyWebhookEvent(row, ev('subscription.activated', 'sub_new'))
    expect(eff.kind === 'promote' && eff.patch).toMatchObject({ last_payment_id: null, last_payment_amount: null })
  })

  // Review fix: a downgrade only cancels the old plan once the new mandate is authenticated
  it('authenticated for pending with future start → scheduleDowngrade', () => {
    const e = { event: 'subscription.authenticated', created_at: START, payload: { subscription: { entity: { id: 'sub_new', start_at: END } } } }
    expect(applyWebhookEvent(row, e, new Date('2026-11-18T10:00:00Z'))).toEqual({ kind: 'scheduleDowngrade', oldSubscriptionId: 'sub_old' })
  })

  // Review fix: out-of-order (stale) events are ignored
  it('event older than last processed → ignore', () => {
    const e = { ...ev('subscription.pending', 'sub_old'), created_at: START - 100 }
    expect(applyWebhookEvent({ ...row, last_event_at: '2026-11-18T00:00:00.000Z' }, e)).toEqual({ kind: 'ignore' })
  })
  it('newer event records last_event_at', () => {
    const e = { ...ev('subscription.pending', 'sub_old'), created_at: START + 60 }
    expect(applyWebhookEvent({ ...row, last_event_at: '2026-11-18T00:00:00.000Z' }, e)).toEqual({
      kind: 'update', patch: { status: 'past_due', last_event_at: '2026-11-18T00:01:00.000Z' },
    })
  })
})

describe('upgradeCleanup (old plan after an upgrade)', () => {
  const NOW = new Date('2026-11-16T00:00:00Z')
  it('active old plan → cancel now + half refund', () => expect(upgradeCleanup(row, NOW)).toEqual({ cancelOld: true, refundPaise: 88441 }))
  it('cancelled-at-period-end old plan still inside period → cancel now + refund', () =>
    expect(upgradeCleanup({ ...row, cancel_at_period_end: true }, NOW)).toEqual({ cancelOld: true, refundPaise: 88441 }))
  it('fully cancelled but still paid → no cancel call, still refund', () =>
    expect(upgradeCleanup({ ...row, status: 'cancelled' }, NOW)).toEqual({ cancelOld: false, refundPaise: 88441 }))
  it('period already over (downgrade path) → nothing', () =>
    expect(upgradeCleanup(row, new Date('2026-12-02T00:00:00Z'))).toEqual({ cancelOld: false, refundPaise: 0 }))
  it('no old subscription → nothing', () =>
    expect(upgradeCleanup({ ...row, razorpay_subscription_id: null }, NOW)).toEqual({ cancelOld: false, refundPaise: 0 }))
  it('expired old plan → nothing', () =>
    expect(upgradeCleanup({ ...row, status: 'expired' }, NOW)).toEqual({ cancelOld: false, refundPaise: 0 }))
})
