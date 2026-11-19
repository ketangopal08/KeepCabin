import { getOrgContext } from '~~/lib/org'
import { getOrgPlan, getUsage } from '~~/lib/billing'
import { TRIAL_DAYS } from '~~/lib/plans'
import type { BillingStatus } from '~~/lib/plans'

export default defineEventHandler(async (event): Promise<BillingStatus> => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const [{ plan, trial, limits, sub }, usage] = await Promise.all([getOrgPlan(ctx.org), getUsage(ctx.org.id)])

  return {
    plan,
    trial,
    trialEndsAt: trial
      ? new Date(new Date(ctx.org.created_at).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : null,
    interval: trial ? null : sub?.interval ?? null,
    status: trial ? null : sub?.status ?? null,
    currentPeriodEnd: trial ? null : sub?.current_period_end ?? null,
    cancelAtPeriodEnd: !trial && !!sub?.cancel_at_period_end,
    // Only a scheduled (authorised) downgrade counts; an abandoned checkout must not lock the page.
    pendingPlan: sub?.cancel_at_period_end && sub.pending_razorpay_subscription_id ? sub.pending_plan : null,
    limits,
    usage,
    canManage: ctx.member.role === 'owner',
  }
})
