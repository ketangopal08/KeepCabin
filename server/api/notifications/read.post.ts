import { getOrgContext } from '~~/lib/org'
import { serviceClient } from '~~/lib/billing'

// Mark notifications as read: { ids: string[] } for specific ones, or { all: true }.
export default defineEventHandler(async (event) => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })
  const body = await readBody<{ ids?: string[]; all?: boolean }>(event)

  let query = serviceClient()
    .from('notifications')
    .update({ read: true })
    .eq('user_id', ctx.member.user_id)
    .eq('org_id', ctx.org.id)
    .eq('read', false)

  if (!body?.all) {
    const ids = (body?.ids ?? []).filter(id => typeof id === 'string')
    if (!ids.length) return { ok: true }
    query = query.in('id', ids)
  }

  const { error } = await query
  if (error) throw createError({ statusCode: 500, message: error.message })
  return { ok: true }
})
