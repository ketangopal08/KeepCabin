import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import { createNotifications, expenseLabel } from '~~/lib/notifications'
import { assertCanAct, loadMembers, logEntry } from '~~/lib/expenseActions'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'finance', 'owner')
  const id = getRouterParam(event, 'id')
  const { reason } = await readBody<{ reason: string }>(event)
  if (!reason?.trim()) throw createError({ statusCode: 400, message: 'Rejection reason required' })

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_finance')
    .single()

  if (!expense) throw createError({ statusCode: 404, message: 'Expense not found or not rejectable' })

  const members = await loadMembers(ctx.org.id)
  assertCanAct('finance', ctx, expense, members)

  const trimmed = reason.trim()
  const newLog = [...(expense.action_log ?? []), logEntry(ctx, 'rejected', trimmed)]

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({
      status: 'rejected',
      rejection_reason: trimmed,
      action_log: newLog,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_finance')
    .select('id')

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!updated?.length) throw createError({ statusCode: 409, message: 'Already handled' })

  const managers = members
    .filter(m => m.role === 'manager' && m.team_id === expense.team_id && m.user_id !== expense.submitted_by)
    .map(m => m.user_id)
  const recipients = [...new Set([expense.submitted_by, ...managers])]

  await createNotifications(supabase, recipients.map(user_id => ({
    org_id: ctx.org.id,
    user_id,
    type: 'expense_rejected',
    title: 'Expense rejected by Finance',
    body: `The ${expenseLabel(expense)} was rejected by Finance: ${trimmed}`,
    expense_id: expense.id,
  })))

  return { ok: true }
})
