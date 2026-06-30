import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import type { ActionLogEntry } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'manager')
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: expense } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('team_id', ctx.member.team_id!)
    .eq('status', 'pending_manager')
    .single()

  if (!expense) throw createError({ statusCode: 404, message: 'Expense not found or not approvable' })

  const newLog: ActionLogEntry[] = [
    ...(expense.action_log ?? []),
    {
      actor_id: ctx.member.user_id,
      actor_name: 'Manager',
      action: 'approved',
      timestamp: new Date().toISOString(),
    },
  ]

  const { error } = await supabase
    .from('expenses')
    .update({ status: 'pending_finance', action_log: newLog, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('team_id', ctx.member.team_id!)

  if (error) throw createError({ statusCode: 500, message: error.message })

  // Notify finance (fire-and-forget) — trigger edge function
  supabase.functions.invoke('notify', {
    body: { type: 'manager_approved', expense_id: id, org_id: ctx.org.id },
  }).catch(() => {})

  return { ok: true }
})
