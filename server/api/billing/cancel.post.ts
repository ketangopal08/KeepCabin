import { getOrgContext, requireRole } from '~~/lib/org'
import { getSubscription, serviceClient } from '~~/lib/billing'
import { rzp } from '~~/lib/razorpay'

// Cancels at the end of the current billing period; the plan stays paid until then.
export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const sub = await getSubscription(ctx.org.id)

  if (!sub?.razorpay_subscription_id || !['active', 'past_due'].includes(sub.status)) {
    throw createError({ statusCode: 400, message: 'No active subscription to cancel.' })
  }
  if (sub.cancel_at_period_end) return { ok: true }

  await rzp(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: 1 } })

  const { error } = await serviceClient()
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('org_id', ctx.org.id)
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true }
})
