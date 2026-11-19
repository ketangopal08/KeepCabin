import { getSubscription, serviceClient } from '~~/lib/billing'
import { applyEffect } from '~~/lib/billingActions'
import { applyWebhookEvent, verifyWebhookSignature } from '~~/lib/razorpay'

// Razorpay webhook receiver. No user auth — the HMAC signature is the auth.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  const signature = getHeader(event, 'x-razorpay-signature') ?? ''
  if (!config.razorpayWebhookSecret || !verifyWebhookSignature(raw, signature, config.razorpayWebhookSecret)) {
    throw createError({ statusCode: 400, message: 'Invalid signature' })
  }

  const payload = JSON.parse(raw)
  const subEntity = payload?.payload?.subscription?.entity
  const payEntity = payload?.payload?.payment?.entity
  const subId: string | undefined = subEntity?.id ?? payEntity?.subscription_id
  const eventId = getHeader(event, 'x-razorpay-event-id') ?? `${payload.event}:${subId}:${payload.created_at}`

  const db = serviceClient()

  // Claim the event id first (atomic dedupe). A unique violation means it was already handled.
  const { error: claimErr } = await db.from('billing_events').insert({ id: eventId, type: payload.event ?? 'unknown', payload })
  if (claimErr) {
    if (claimErr.code === '23505') return { ok: true, duplicate: true }
    throw createError({ statusCode: 500, message: claimErr.message })
  }

  try {
    // Find the org: notes.org_id first, then by active / pending subscription id.
    let orgId: string | undefined = subEntity?.notes?.org_id ?? payEntity?.notes?.org_id
    if (!orgId && subId) {
      const byActive = await db.from('subscriptions').select('org_id').eq('razorpay_subscription_id', subId).maybeSingle()
      orgId = byActive.data?.org_id
      if (!orgId) {
        const byPending = await db.from('subscriptions').select('org_id').eq('pending_razorpay_subscription_id', subId).maybeSingle()
        orgId = byPending.data?.org_id
      }
    }

    if (orgId) {
      const sub = await getSubscription(orgId)
      await applyEffect(orgId, applyWebhookEvent(sub, payload))
    }
  } catch (e) {
    // Release the claim so Razorpay's retry can process it again.
    await db.from('billing_events').delete().eq('id', eventId)
    throw e
  }

  return { ok: true }
})
