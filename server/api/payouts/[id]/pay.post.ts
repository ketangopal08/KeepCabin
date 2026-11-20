import { getOrgContext, requireRole } from '~~/lib/org'
import { serviceClient } from '~~/lib/billing'
import { createNotifications } from '~~/lib/notifications'
import { logEntry } from '~~/lib/expenseActions'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'finance', 'owner')
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ utr_number?: string, expected_count?: number, expected_amount?: number }>(event)
  const utr = typeof body?.utr_number === 'string' ? body.utr_number.trim() : ''
  if (!utr) throw createError({ statusCode: 400, message: 'UTR number is required' })
  if (utr.length > 64) throw createError({ statusCode: 400, message: 'UTR number is too long' })
  const expectedCount = body?.expected_count
  const expectedAmount = body?.expected_amount
  if (typeof expectedCount !== 'number' || !Number.isFinite(expectedCount)
    || typeof expectedAmount !== 'number' || !Number.isFinite(expectedAmount)) {
    throw createError({ statusCode: 400, message: 'Expected count and amount are required' })
  }

  const supabase = serviceClient()
  const { data, error } = await supabase.rpc('pay_payout', {
    p_payout_id: id,
    p_org_id: ctx.org.id,
    p_utr: utr,
    p_actor: ctx.member.user_id,
    p_log: logEntry(ctx, 'paid', `UTR: ${utr}`),
    p_expected_count: expectedCount,
    p_expected_amount: expectedAmount,
  })

  if (error) {
    if (error.message?.includes('amount_changed')) {
      throw createError({ statusCode: 409, message: 'This payout changed — please review the new total and pay again.' })
    }
    if (error.message?.includes('not_payable')) {
      throw createError({ statusCode: 409, message: 'Already paid or not found' })
    }
    throw createError({ statusCode: 500, message: error.message })
  }

  const row: any = Array.isArray(data) ? data[0] : data
  if (!row) throw createError({ statusCode: 409, message: 'Already paid or not found' })
  const amount = Number(row.amount)
  const count = Number(row.expense_count)

  const { data: linked } = await supabase
    .from('expenses')
    .select('id')
    .eq('payout_id', id)
    .limit(1)

  await createNotifications(supabase, [{
    org_id: ctx.org.id,
    user_id: row.user_id,
    type: 'payout_paid',
    title: 'Reimbursement paid',
    body: `₹${amount.toLocaleString('en-IN')} for ${count} ${count === 1 ? 'expense' : 'expenses'} was paid. UTR ${utr}.`,
    expense_id: linked?.[0]?.id ?? null,
  }])

  return { ok: true, amount, expense_count: count }
})
