import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import type { OrgRole } from '~~/lib/supabase'
import { roleForTeam } from '~~/lib/teamRoles'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const memberId = event.context.params!.id
  const { role } = await readBody<{ role: OrgRole }>(event)

  if (!['manager', 'finance', 'employee'].includes(role)) {
    throw createError({ statusCode: 400, message: 'Invalid role' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: target } = await supabase
    .from('org_members')
    .select('id, role, org_id, team_id, teams(name)')
    .eq('id', memberId)
    .single()

  if (!target || target.org_id !== ctx.org.id) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }
  if (target.role === 'owner') {
    throw createError({ statusCode: 403, message: 'Cannot change owner role' })
  }

  // Members of the Finance team always keep the finance role
  const teamName = (target as any).teams?.name ?? null
  const finalRole = roleForTeam(role, teamName)

  const { error } = await supabase
    .from('org_members')
    .update({ role: finalRole })
    .eq('id', memberId)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { ok: true }
})
