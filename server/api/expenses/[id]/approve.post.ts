import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import { createNotifications, expenseLabel } from '~~/lib/notifications'
import { assertCanAct, loadMembers, logEntry } from '~~/lib/expenseActions'
import { stepApprovers } from '~~/lib/payouts'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'manager', 'owner', 'finance')
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_manager')
    .single()

  if (!expense) throw createError({ statusCode: 404, message: 'Expense not found or not approvable' })

  const members = await loadMembers(ctx.org.id)
  assertCanAct('manager', ctx, expense, members)

  const newLog = [...(expense.action_log ?? []), logEntry(ctx, 'approved')]

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({ status: 'pending_finance', action_log: newLog, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_manager')
    .select('id')

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!updated?.length) throw createError({ statusCode: 409, message: 'Already handled' })

  const label = expenseLabel(expense)
  await createNotifications(supabase, [
    {
      org_id: ctx.org.id,
      user_id: expense.submitted_by,
      type: 'expense_manager_approved',
      title: 'Approved by your manager',
      body: `Your ${label} is now with Finance for review.`,
      expense_id: expense.id,
    },
    ...stepApprovers('finance', expense, members).map(user_id => ({
      org_id: ctx.org.id,
      user_id,
      type: 'expense_to_finance',
      title: 'New expense to review',
      body: `A ${label} is waiting for Finance review.`,
      expense_id: expense.id,
    })),
  ])

  // Notify finance (fire-and-forget) — trigger edge function
  supabase.functions.invoke('notify', {
    body: { type: 'manager_approved', expense_id: id, org_id: ctx.org.id },
  }).catch(() => {})

  return { ok: true }
})
