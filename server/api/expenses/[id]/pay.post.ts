import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import type { ActionLogEntry } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'finance', 'owner')
  const id = getRouterParam(event, 'id')
  const { utr_number } = await readBody<{ utr_number: string }>(event)
  if (!utr_number?.trim()) throw createError({ statusCode: 400, message: 'UTR number required' })

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_finance')
    .single()

  if (!expense) throw createError({ statusCode: 404, message: 'Expense not found or not payable' })
  if (expense.submitted_by === ctx.member.user_id) {
    throw createError({ statusCode: 403, message: "You can't pay your own expense" })
  }

  const newLog: ActionLogEntry[] = [
    ...(expense.action_log ?? []),
    {
      actor_id: ctx.member.user_id,
      actor_name: ctx.member.role.charAt(0).toUpperCase() + ctx.member.role.slice(1),
      action: 'paid',
      timestamp: new Date().toISOString(),
      note: `UTR: ${utr_number.trim()}`,
    },
  ]

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({
      status: 'paid',
      utr_number: utr_number.trim(),
      action_log: newLog,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .eq('status', 'pending_finance')
    .select('id')

  if (error) throw createError({ statusCode: 500, message: error.message })
  if (!updated?.length) throw createError({ statusCode: 409, message: 'Already handled' })

  supabase.functions.invoke('notify', {
    body: { type: 'finance_paid', expense_id: id, org_id: ctx.org.id },
  }).catch(() => {})

  return { ok: true }
})
