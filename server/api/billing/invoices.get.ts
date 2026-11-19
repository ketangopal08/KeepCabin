import { getOrgContext, requireRole } from '~~/lib/org'
import { getSubscription } from '~~/lib/billing'
import { rzp } from '~~/lib/razorpay'

export interface BillingInvoice {
  id: string
  date: string | null
  /** paise */
  amount: number
  status: string
  url: string | null
}

// Invoices Razorpay generated for this workspace's subscription (owner only).
export default defineEventHandler(async (event): Promise<BillingInvoice[]> => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const sub = await getSubscription(ctx.org.id)
  if (!sub?.razorpay_subscription_id) return []

  const res = await rzp<{ items?: any[] }>(`/invoices?subscription_id=${encodeURIComponent(sub.razorpay_subscription_id)}&count=50`)
  return (res.items ?? []).map(inv => {
    const at = inv.paid_at ?? inv.issued_at ?? inv.date ?? inv.created_at
    return {
      id: inv.id,
      date: at ? new Date(at * 1000).toISOString() : null,
      amount: inv.amount_paid || inv.amount || 0,
      status: inv.status ?? 'unknown',
      url: inv.short_url ?? null,
    }
  })
})
