import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = getQuery(event).token as string
  if (!token) throw createError({ statusCode: 400, message: 'Token required' })

  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: invite } = await supabase
    .from('invites')
    .select('*, organizations(name), teams(name)')
    .eq('token', token)
    .single()

  if (!invite) throw createError({ statusCode: 404, message: 'Invite not found' })
  if (invite.accepted) throw createError({ statusCode: 410, message: 'Invite already used' })
  if (new Date(invite.expires_at) < new Date()) {
    throw createError({ statusCode: 410, message: 'Invite has expired' })
  }

  return {
    email: invite.email,
    role: invite.role,
    org_name: invite.organizations?.name ?? '',
    team_name: invite.teams?.name ?? null,
  }
})
