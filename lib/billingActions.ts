// Server-only: applies a WebhookEffect to the subscriptions table (shared by verify + webhook).
import { getSubscription, serviceClient } from './billing'
import { rzp, upgradeCleanup } from './razorpay'
import type { WebhookEffect } from './razorpay'

async function updateRow(orgId: string, patch: Record<string, unknown>) {
  const { error } = await serviceClient()
    .from('subscriptions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
  if (error) throw createError({ statusCode: 500, message: error.message })
}

/** Idempotent and race-safe: verify + several webhooks may apply the same promotion concurrently. */
export async function applyEffect(orgId: string, effect: WebhookEffect): Promise<void> {
  if (effect.kind === 'ignore') return

  if (effect.kind === 'update') {
    await updateRow(orgId, effect.patch)
    return
  }

  const prior = await getSubscription(orgId)
  if (!prior) return

  if (effect.kind === 'scheduleDowngrade') {
    // The new (cheaper) plan's mandate is authorised — only now end the current plan at cycle end.
    if (prior.cancel_at_period_end || !effect.oldSubscriptionId) return
    await rzp(`/subscriptions/${effect.oldSubscriptionId}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: 1 } })
    await updateRow(orgId, { cancel_at_period_end: true })
    return
  }

  // promote — conditional update: only the caller that actually moves pending → active continues.
  const newId = effect.patch.razorpay_subscription_id as string
  const { data: claimed, error } = await serviceClient()
    .from('subscriptions')
    .update({ ...effect.patch, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('pending_razorpay_subscription_id', newId)
    .select('org_id')
  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!claimed?.length) return // someone else already promoted it

  // Upgrade: end the old plan now and refund its unused days (nothing to do on the downgrade path).
  const old = effect.oldSubscriptionId
  if (!old || old === newId) return
  const { cancelOld, refundPaise } = upgradeCleanup(prior, new Date())

  if (cancelOld) {
    try {
      await rzp(`/subscriptions/${old}/cancel`, { method: 'POST', body: { cancel_at_cycle_end: 0 } })
    } catch (e) {
      // Old plan would keep renewing — don't refund; leave it visible in logs for manual follow-up.
      console.error('[billing] failed to cancel old subscription; refund skipped', { orgId, old }, e)
      return
    }
  }

  if (refundPaise > 0 && prior.last_payment_id) {
    try {
      await rzp(`/payments/${prior.last_payment_id}/refund`, {
        method: 'POST',
        body: { amount: refundPaise, notes: { reason: 'Plan upgrade proration', org_id: orgId } },
      })
    } catch (e) {
      console.error('[billing] proration refund failed', { orgId, payment: prior.last_payment_id, refundPaise }, e)
    }
  }
}
