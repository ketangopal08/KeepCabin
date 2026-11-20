import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import { createNotifications, expenseLabel } from '~~/lib/notifications'
import { assertCanAct, loadMembers, logEntry } from '~~/lib/expenseActions'
import { nextPayoutDate, type PayoutSchedule } from '~~/lib/payouts'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'finance', 'owner')
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_finance')
    .single()

  if (!expense) throw createError({ statusCode: 404, message: 'Expense not found or not approvable' })

  const members = await loadMembers(ctx.org.id)
  assertCanAct('finance', ctx, expense, members)

  const schedule = (ctx.org.payout_schedule ?? 'semi_monthly') as PayoutSchedule
  const cycle = nextPayoutDate(schedule, new Date())
  const cycleDate = new Date(`${cycle}T00:00:00Z`)
  const short = cycleDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const full = cycleDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  const { data: payoutId, error } = await supabase.rpc('schedule_expense', {
    p_expense_id: id,
    p_org_id: ctx.org.id,
    p_cycle_date: cycle,
    p_log: logEntry(ctx, 'finance_approved', `Pays on ${cycle}`),
  })

  if (error) {
    if (error.message?.includes('not_schedulable')) {
      throw createError({ statusCode: 409, message: 'Already handled' })
    }
    throw createError({ statusCode: 500, message: error.message })
  }

  await createNotifications(supabase, [{
    org_id: ctx.org.id,
    user_id: expense.submitted_by,
    type: 'expense_scheduled',
    title: `Approved — will be paid on ${short}`,
    body: `Your ${expenseLabel(expense)} will be paid on ${full}.`,
    expense_id: expense.id,
  }])

  return { ok: true, payout_id: payoutId, cycle_date: cycle }
})
