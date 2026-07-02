import { createClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { OrgContext, OrgRole } from './supabase'

export async function getOrgContext(event: H3Event): Promise<OrgContext | null> {
  const config = useRuntimeConfig()
  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return null

  const supabase = createClient(
    config.public.supabaseUrl,
    config.supabaseServiceKey,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null

  const { data: member } = await supabase
    .from('org_members')
    .select('*, organizations(*), teams(*)')
    .eq('user_id', user.id)
    .single()

  if (!member) return null

  return {
    org: member.organizations,
    member: {
      id: member.id,
      org_id: member.org_id,
      user_id: member.user_id,
      role: member.role as OrgRole,
      team_id: member.team_id,
      created_at: member.created_at,
    },
    team: member.teams ?? null,
  }
}

export function requireRole(ctx: OrgContext | null, ...roles: OrgRole[]): OrgContext {
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })
  if (!roles.includes(ctx.member.role)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return ctx
}
