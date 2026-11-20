import { getOrgContext } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })

  if (ctx.member.role === 'employee') {
    query = query.eq('submitted_by', ctx.member.user_id)
  } else if (ctx.member.role === 'manager') {
    query = query.eq('team_id', ctx.member.team_id!)
  }

  const { data, error } = await query
  if (error) throw createError({ statusCode: 500, message: error.message })
  const rows = data ?? []
  if (!rows.length) return rows

  // Add who submitted each expense (name + email live in Supabase Auth, not in org_members)
  const ids = new Set(rows.map((e: any) => e.submitted_by))
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const byId = new Map(users.filter((u: any) => ids.has(u.id)).map((u: any) => [u.id, u]))

  const payoutIds = [...new Set(rows.map((e: any) => e.payout_id).filter(Boolean))]
  const payoutDates = new Map<string, string>()
  if (payoutIds.length) {
    const { data: payouts } = await supabase
      .from('payouts')
      .select('id, cycle_date')
      .in('id', payoutIds)
      .eq('org_id', ctx.org.id)
    for (const p of payouts ?? []) payoutDates.set(p.id, p.cycle_date)
  }

  return rows.map((e: any) => {
    const u: any = byId.get(e.submitted_by)
    return { ...e, payout_date: e.payout_id ? (payoutDates.get(e.payout_id) ?? null) : null, submitter_name: u?.user_metadata?.full_name ?? null, submitter_email: u?.email ?? null }
  })
})
