import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner', 'manager')
  const teamId = event.context.params!.id

  // Manager can only view their own team
  if (ctx.member.role === 'manager' && ctx.member.team_id !== teamId) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: orgMembers } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', ctx.org.id)
    .eq('team_id', teamId)
    .order('created_at')

  if (!orgMembers?.length) return []

  const { data: { users } } = await supabase.auth.admin.listUsers()
  const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]))

  return orgMembers.map((m: any) => {
    const u = userMap[m.user_id]
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role,
      team_id: m.team_id,
      created_at: m.created_at,
      email: u?.email ?? null,
      full_name: u?.user_metadata?.full_name ?? null,
    }
  })
})
