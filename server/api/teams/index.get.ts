import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner', 'manager', 'finance')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data } = await supabase
    .from('teams')
    .select('*')
    .eq('org_id', ctx.org.id)
    .order('created_at')
  return data ?? []
})
