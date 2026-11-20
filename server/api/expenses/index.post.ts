import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import type { ActionLogEntry } from '~~/lib/supabase'
import { assertWithinLimit } from '~~/lib/billing'
import { createNotifications, expenseLabel } from '~~/lib/notifications'
import { loadMembers } from '~~/lib/expenseActions'
import { stepApprovers } from '~~/lib/payouts'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'employee', 'manager', 'finance')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const body = await readBody<{
    amount: number
    vendor: string
    expense_date: string
    description: string
    category: string
    receipt_url: string
    ocr_text?: string
  }>(event)

  if (!body.amount || body.amount <= 0) throw createError({ statusCode: 400, message: 'Valid amount required' })
  if (!body.receipt_url) throw createError({ statusCode: 400, message: 'Receipt required' })
  if (!body.category) throw createError({ statusCode: 400, message: 'Category required' })
  if (!ctx.member.team_id) throw createError({ statusCode: 400, message: 'You are not assigned to a team' })
  await assertWithinLimit(ctx, 'expenses')

  const log: ActionLogEntry[] = [{
    actor_id: ctx.member.user_id,
    actor_name: ctx.member.role.charAt(0).toUpperCase() + ctx.member.role.slice(1),
    action: 'submitted',
    timestamp: new Date().toISOString(),
  }]

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      org_id: ctx.org.id,
      team_id: ctx.member.team_id,
      submitted_by: ctx.member.user_id,
      amount: body.amount,
      vendor: body.vendor ?? null,
      expense_date: body.expense_date ?? null,
      description: body.description ?? null,
      category: body.category,
      receipt_url: body.receipt_url,
      ocr_text: body.ocr_text ?? null,
      status: 'pending_manager',
      action_log: log,
    })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })

  const members = await loadMembers(ctx.org.id)
  await createNotifications(supabase, stepApprovers('manager', data, members).map(user_id => ({
    org_id: ctx.org.id,
    user_id,
    type: 'expense_submitted',
    title: 'New expense to review',
    body: `A ${expenseLabel(data)} is waiting for your review.`,
    expense_id: data.id,
  })))

  return data
})
