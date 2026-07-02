import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { name } = await readBody<{ name: string }>(event)
  if (!name?.trim()) throw createError({ statusCode: 400, message: 'Team name required' })

  const { data, error } = await supabase
    .from('teams')
    .insert({ org_id: ctx.org.id, name: name.trim() })
    .select()
    .single()
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data
})
