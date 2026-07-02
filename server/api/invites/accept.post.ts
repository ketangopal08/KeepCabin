import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const { token } = await readBody<{ token: string }>(event)
  if (!token) throw createError({ statusCode: 400, message: 'Token required' })
  const authHeader = getHeader(event, 'authorization') ?? ''
  const accessToken = authHeader.replace('Bearer ', '')

  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: { user } } = await supabase.auth.getUser(accessToken)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { data: invite } = await supabase
    .from('invites')
    .select('*')
    .eq('token', token)
    .single()

  if (!invite) throw createError({ statusCode: 404, message: 'Invite not found' })
  if (invite.accepted) throw createError({ statusCode: 410, message: 'Already used' })
  if (new Date(invite.expires_at) < new Date()) {
    throw createError({ statusCode: 410, message: 'Expired' })
  }
  if (invite.email !== user.email) {
    throw createError({ statusCode: 403, message: 'This invite was sent to a different email' })
  }

  const { error: memberErr } = await supabase
    .from('org_members')
    .insert({
      org_id: invite.org_id,
      user_id: user.id,
      role: invite.role,
      team_id: invite.team_id,
    })
  if (memberErr) throw createError({ statusCode: 500, message: memberErr.message })

  await supabase.from('invites').update({ accepted: true }).eq('id', invite.id)

  return { ok: true }
})
