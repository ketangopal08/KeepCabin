import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')

  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // Prevent duplicate org creation
  const { data: existing } = await supabase
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (existing) throw createError({ statusCode: 409, message: 'Already in an org' })

  const body = await readBody<{ name: string; size: string }>(event)
  if (!body.name?.trim()) throw createError({ statusCode: 400, message: 'Org name required' })

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name: body.name.trim(), size: body.size, owner_id: user.id })
    .select()
    .single()
  if (orgErr) throw createError({ statusCode: 500, message: orgErr.message })

  const { error: memberErr } = await supabase
    .from('org_members')
    .insert({ org_id: org.id, user_id: user.id, role: 'owner', team_id: null })
  if (memberErr) throw createError({ statusCode: 500, message: memberErr.message })

  return org
})
