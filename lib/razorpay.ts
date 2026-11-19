// Server-only Razorpay helpers: signatures, webhook state machine, REST client.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { proratedRefundPaise } from './plans'
import type { BillingInterval, PlanId, SubscriptionRow } from './plans'

function hmacHex(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex')
}

function safeEqualHex(expected: string, given: string): boolean {
  if (!given || expected.length !== given.length) return false
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given))
}

/** Checkout success handler signature: HMAC(payment_id|subscription_id, key_secret) */
export function verifyPaymentSignature(paymentId: string, subscriptionId: string, signature: string, secret: string): boolean {
  return safeEqualHex(hmacHex(`${paymentId}|${subscriptionId}`, secret), signature)
}

/** Webhook X-Razorpay-Signature: HMAC(raw body, webhook secret) */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  return safeEqualHex(hmacHex(rawBody, secret), signature)
}

export type WebhookEffect =
  | { kind: 'ignore' }
  | { kind: 'update'; patch: Partial<SubscriptionRow> }
  | { kind: 'promote'; patch: Partial<SubscriptionRow>; oldSubscriptionId: string | null }
  /** A future-dated (downgrade) subscription was authorised: now end the old one at cycle end. */
  | { kind: 'scheduleDowngrade'; oldSubscriptionId: string | null }

export interface RazorpayEvent {
  event: string
  /** epoch seconds */
  created_at?: number
  payload: any
}

/** What to do with the old subscription once an upgrade has been promoted. Pure. */
export function upgradeCleanup(prior: SubscriptionRow, now: Date): { cancelOld: boolean; refundPaise: number } {
  const none = { cancelOld: false, refundPaise: 0 }
  if (!prior.razorpay_subscription_id || !prior.current_period_end) return none
  if (prior.status === 'expired') return none
  if (new Date(prior.current_period_end).getTime() <= now.getTime()) return none

  const cancelOld = prior.status === 'active' || prior.status === 'past_due'
  const refundPaise = prior.last_payment_id && prior.last_payment_amount && prior.current_period_start
    ? proratedRefundPaise(prior.last_payment_amount, new Date(prior.current_period_start), new Date(prior.current_period_end), now)
    : 0
  return { cancelOld, refundPaise }
}

const toIso = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toISOString() : null)

function periodPatch(sub: any): Partial<SubscriptionRow> {
  const patch: Partial<SubscriptionRow> = {}
  if (sub?.current_start) patch.current_period_start = toIso(sub.current_start)
  if (sub?.current_end) patch.current_period_end = toIso(sub.current_end)
  return patch
}

function paymentPatch(payment: any): Partial<SubscriptionRow> {
  return payment?.id ? { last_payment_id: payment.id, last_payment_amount: payment.amount ?? null } : {}
}

/** Pure: decides how a Razorpay event changes our subscription row. */
export function applyWebhookEvent(sub: SubscriptionRow | null, event: RazorpayEvent, now: Date = new Date()): WebhookEffect {
  if (!sub) return { kind: 'ignore' }

  const subEntity = event.payload?.subscription?.entity
  const payEntity = event.payload?.payment?.entity
  const subId: string | undefined = subEntity?.id ?? payEntity?.subscription_id

  if (!subId) return { kind: 'ignore' }
  const isActive = subId === sub.razorpay_subscription_id
  const isPending = subId === sub.pending_razorpay_subscription_id

  // Out-of-order delivery: never let an older event overwrite newer state.
  const eventAt = toIso(event.created_at)
  if (eventAt && sub.last_event_at && new Date(eventAt).getTime() < new Date(sub.last_event_at).getTime()) {
    return { kind: 'ignore' }
  }
  const stamp: Partial<SubscriptionRow> = eventAt ? { last_event_at: eventAt } : {}

  if (isPending) {
    if (event.event === 'subscription.activated' || event.event === 'subscription.charged') {
      return {
        kind: 'promote',
        oldSubscriptionId: sub.razorpay_subscription_id,
        patch: {
          plan: sub.pending_plan as PlanId,
          interval: sub.pending_interval as BillingInterval,
          status: 'active',
          razorpay_subscription_id: subId,
          cancel_at_period_end: false,
          ...periodPatch(subEntity),
          // Always overwrite: the old subscription's payment must never be refunded again later.
          last_payment_id: payEntity?.id ?? null,
          last_payment_amount: payEntity?.amount ?? null,
          pending_razorpay_subscription_id: null,
          pending_plan: null,
          pending_interval: null,
          ...stamp,
        },
      }
    }
    if (event.event === 'subscription.authenticated') {
      const startsLater = !!subEntity?.start_at && subEntity.start_at * 1000 > now.getTime() + 60_000
      return startsLater ? { kind: 'scheduleDowngrade', oldSubscriptionId: sub.razorpay_subscription_id } : { kind: 'ignore' }
    }
    if (event.event === 'subscription.cancelled' || event.event === 'subscription.halted') {
      return { kind: 'update', patch: { pending_razorpay_subscription_id: null, pending_plan: null, pending_interval: null } }
    }
    return { kind: 'ignore' }
  }

  if (!isActive) return { kind: 'ignore' }

  switch (event.event) {
    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.resumed':
      return { kind: 'update', patch: { status: 'active', ...periodPatch(subEntity), ...paymentPatch(payEntity), ...stamp } }
    case 'subscription.pending':
    case 'payment.failed':
      return { kind: 'update', patch: { status: 'past_due', ...stamp } }
    case 'subscription.halted':
      return { kind: 'update', patch: { status: 'expired', ...stamp } }
    case 'subscription.cancelled':
    case 'subscription.completed':
      return { kind: 'update', patch: { status: 'cancelled', ...stamp } }
    default:
      return { kind: 'ignore' }
  }
}

/** Razorpay plan id for a plan + interval, from runtime config. */
export function planIdFor(plan: 'pro' | 'business', interval: BillingInterval): string {
  const plans = useRuntimeConfig().razorpayPlans as Record<string, string>
  const id = plans[`${plan}_${interval}`]
  if (!id) throw createError({ statusCode: 500, message: `Razorpay plan id missing for ${plan} ${interval}` })
  return id
}

/** Minimal Razorpay REST client (Basic auth with key id + secret). */
export async function rzp<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const config = useRuntimeConfig()
  const auth = Buffer.from(`${config.public.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64')
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw createError({ statusCode: 502, message: json?.error?.description ?? `Razorpay error ${res.status}` })
  }
  return json as T
}
