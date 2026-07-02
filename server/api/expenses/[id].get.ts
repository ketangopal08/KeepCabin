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
  return data
})
