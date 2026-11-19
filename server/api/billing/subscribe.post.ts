import { getOrgContext, requireRole } from '~~/lib/org'
import { getOrgPlan, serviceClient } from '~~/lib/billing'
import { classifyChange } from '~~/lib/plans'
import type { BillingInterval } from '~~/lib/plans'
import { planIdFor, rzp } from '~~/lib/razorpay'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const body = await readBody<{ plan: 'pro' | 'business'; interval: BillingInterval }>(event)
  if (!['pro', 'business'].includes(body?.plan) || !['monthly', 'yearly'].includes(body?.interval)) {
    throw createError({ statusCode: 400, message: 'Choose Pro or Business, monthly or yearly.' })
  }

  const { plan, trial, sub } = await getOrgPlan(ctx.org)
  if (plan === 'enterprise' && !trial) throw createError({ statusCode: 400, message: 'Enterprise plans are managed by our team.' })

  // A trial hasn't been paid for, so it counts as Free.
  const current = trial ? { plan: 'free' as const, interval: null } : { plan, interval: sub?.interval ?? null }
  const change = classifyChange(current, { plan: body.plan, interval: body.interval })
  if (change === 'same') throw createError({ statusCode: 400, message: 'You are already on this plan.' })

  const config = useRuntimeConfig()
  const db = serviceClient()

  // Drop an earlier abandoned checkout, if any (best effort).
  if (sub?.pending_razorpay_subscription_id) {
    await rzp(`/subscriptions/${sub.pending_razorpay_subscription_id}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: 0 } })
      .catch(() => {})
  }

  const createBody: Record<string, unknown> = {
    plan_id: planIdFor(body.plan, body.interval),
    total_count: body.interval === 'monthly' ? 120 : 10,
    customer_notify: 1,
    notes: { org_id: ctx.org.id, plan: body.plan, interval: body.interval },
  }

  const isDowngrade = change === 'downgrade' && !!sub?.razorpay_subscription_id && !!sub.current_period_end
  if (isDowngrade) createBody.start_at = Math.floor(new Date(sub!.current_period_end!).getTime() / 1000)

  const created = await rzp<{ id: string }>('/subscriptions', { method: 'POST', body: createBody })

  // Note: on a downgrade the current plan is NOT cancelled here — only once the new mandate is
  // authorised (verify / subscription.authenticated), so an abandoned checkout loses nothing.
  const pending = {
    pending_razorpay_subscription_id: created.id,
    pending_plan: body.plan,
    pending_interval: body.interval,
    updated_at: new Date().toISOString(),
  }
  const { error } = sub
    ? await db.from('subscriptions').update(pending).eq('org_id', ctx.org.id)
    : await db.from('subscriptions').insert({ org_id: ctx.org.id, plan: 'free', status: 'expired', ...pending })
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { subscriptionId: created.id, keyId: config.public.razorpayKeyId, change }
})
