import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import { createNotifications, expenseLabel } from '~~/lib/notifications'
import { assertCanAct, loadMembers, logEntry } from '~~/lib/expenseActions'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'manager', 'owner', 'finance')
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
    .eq('status', 'pending_manager')
    .single()

  if (!expense) throw createError({ statusCode: 404, message: 'Expense not found or not rejectable' })

  const members = await loadMembers(ctx.org.id)
  assertCanAct('manager', ctx, expense, members)

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
    .eq('status', 'pending_manager')
    .select('id')

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!updated?.length) throw createError({ statusCode: 409, message: 'Already handled' })

  await createNotifications(supabase, [{
    org_id: ctx.org.id,
    user_id: expense.submitted_by,
    type: 'expense_rejected',
    title: 'Expense rejected',
    body: `Your ${expenseLabel(expense)} was rejected: ${trimmed}`,
    expense_id: expense.id,
  }])

  supabase.functions.invoke('notify', {
    body: { type: 'manager_rejected', expense_id: id, org_id: ctx.org.id },
  }).catch(() => {})

  return { ok: true }
})
