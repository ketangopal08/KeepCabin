import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'
import type { OrgRole } from '~~/lib/supabase'

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
    .select('id, role, org_id')
    .eq('id', memberId)
    .single()

  if (!target || target.org_id !== ctx.org.id) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }
  if (target.role === 'owner') {
    throw createError({ statusCode: 403, message: 'Cannot change owner role' })
  }

  const { error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('id', memberId)

  if (error) throw createError({ statusCode: 500, message: error.message })
  return { ok: true }
})
