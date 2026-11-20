import { getOrgContext } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('org_id', ctx.org.id)
    .single()

  if (error || !data) throw createError({ statusCode: 404, message: 'Expense not found' })

  let payout_date: string | null = null
  if (data.payout_id) {
    const { data: payout } = await supabase
      .from('payouts')
      .select('id, cycle_date')
      .eq('id', data.payout_id)
      .eq('org_id', ctx.org.id)
      .maybeSingle()
    payout_date = payout?.cycle_date ?? null
  }

  let submitter_name: string | null = null
  let submitter_email: string | null = null
  try {
    const { data: u } = await supabase.auth.admin.getUserById(data.submitted_by)
    submitter_name = u?.user?.user_metadata?.full_name ?? null
    submitter_email = u?.user?.email ?? null
  } catch { /* leave null */ }

  let team_name: string | null = null
  if (data.team_id) {
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', data.team_id)
      .eq('org_id', ctx.org.id)
      .maybeSingle()
    team_name = team?.name ?? null
  }
  return { ...data, payout_date, submitter_name, submitter_email, team_name }
})
