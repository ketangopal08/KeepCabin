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
  return data ?? []
})
