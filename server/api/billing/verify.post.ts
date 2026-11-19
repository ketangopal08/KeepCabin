import { getOrgContext, requireRole } from '~~/lib/org'
import { getSubscription } from '~~/lib/billing'
import { applyEffect } from '~~/lib/billingActions'
import { applyWebhookEvent, rzp, verifyPaymentSignature } from '~~/lib/razorpay'

// Called by Razorpay Checkout's success handler for instant feedback.
// The webhook remains the source of truth; both paths are idempotent.
export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const body = await readBody<{
    razorpay_payment_id: string
    razorpay_subscription_id: string
    razorpay_signature: string
  }>(event)

  const config = useRuntimeConfig()
  const ok = verifyPaymentSignature(
    body?.razorpay_payment_id ?? '',
    body?.razorpay_subscription_id ?? '',
    body?.razorpay_signature ?? '',
    config.razorpayKeySecret,
  )
  if (!ok) throw createError({ statusCode: 400, message: 'Invalid payment signature' })

  const sub = await getSubscription(ctx.org.id)
  if (sub?.razorpay_subscription_id === body.razorpay_subscription_id) return { ok: true } // already applied
  if (!sub || sub.pending_razorpay_subscription_id !== body.razorpay_subscription_id) {
    throw createError({ statusCode: 400, message: 'Unknown subscription' })
  }

  const [rzSub, rzPay] = await Promise.all([
    rzp(`/subscriptions/${body.razorpay_subscription_id}`),
    rzp(`/payments/${body.razorpay_payment_id}`),
  ])

  // A future-dated subscription (downgrade) is only authorised now: schedule the switch.
  // It becomes the active plan later, when Razorpay activates it and sends the webhook.
  if (rzSub?.status === 'authenticated') {
    await applyEffect(ctx.org.id, applyWebhookEvent(sub, {
      event: 'subscription.authenticated',
      payload: { subscription: { entity: rzSub } },
    }))
    return { ok: true, pending: true }
  }
  if (rzSub?.status !== 'active') return { ok: true, pending: true }

  const effect = applyWebhookEvent(sub, {
    event: 'subscription.charged',
    payload: { subscription: { entity: rzSub }, payment: { entity: rzPay } },
  })
  await applyEffect(ctx.org.id, effect)
  return { ok: true }
})
