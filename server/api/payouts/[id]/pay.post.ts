import { getOrgContext, requireRole } from '~~/lib/org'
import { serviceClient } from '~~/lib/billing'
import { createNotifications } from '~~/lib/notifications'
import { loadMembers, logEntry } from '~~/lib/expenseActions'

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
    .select('id, team_id')
    .eq('payout_id', id)

  // Managers of the teams these expenses came from also hear about the payment
  const teamIds = new Set((linked ?? []).map(e => e.team_id).filter(Boolean))
  const members = await loadMembers(ctx.org.id)
  const managers = [...new Set(members
    .filter(m => m.role === 'manager' && m.team_id && teamIds.has(m.team_id)
      && m.user_id !== row.user_id && m.user_id !== ctx.member.user_id)
    .map(m => m.user_id))]
  let employee = 'an employee'
  if (managers.length) {
    const { data: u } = await supabase.auth.admin.getUserById(row.user_id)
    employee = u?.user?.user_metadata?.full_name ?? u?.user?.email ?? employee
  }
  const paid = `₹${amount.toLocaleString('en-IN')} for ${count} ${count === 1 ? 'expense' : 'expenses'}`

  await createNotifications(supabase, [
    {
      org_id: ctx.org.id,
      user_id: row.user_id,
      type: 'payout_paid',
      title: 'Reimbursement paid',
      body: `${paid} was paid. UTR ${utr}.`,
      expense_id: linked?.[0]?.id ?? null,
    },
    ...managers.map(user_id => ({
      org_id: ctx.org.id,
      user_id,
      type: 'payout_paid_team',
      title: 'Team reimbursement paid',
      body: `${paid} was paid to ${employee}. UTR ${utr}.`,
      expense_id: linked?.[0]?.id ?? null,
    })),
  ])

  return { ok: true, amount, expense_count: count }
})
