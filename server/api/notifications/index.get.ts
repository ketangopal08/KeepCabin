import { getOrgContext } from '~~/lib/org'
import { serviceClient } from '~~/lib/billing'

// The signed-in user's notifications in their current workspace (newest first).
export default defineEventHandler(async (event) => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { data, error } = await serviceClient()
    .from('notifications')
    .select('id, type, title, body, expense_id, read, created_at')
    .eq('user_id', ctx.member.user_id)
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return data ?? []
})
