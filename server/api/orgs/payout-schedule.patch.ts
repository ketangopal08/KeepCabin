import { getOrgContext, requireRole } from '~~/lib/org'
import { serviceClient } from '~~/lib/billing'

const SCHEDULES = ['semi_monthly', 'monthly', 'weekly']

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'owner')
  const body = await readBody<{ schedule?: string }>(event)
  const schedule = body?.schedule
  if (!schedule || !SCHEDULES.includes(schedule)) {
    throw createError({ statusCode: 400, message: 'Invalid schedule' })
  }

  const { error } = await serviceClient()
    .from('organizations')
    .update({ payout_schedule: schedule })
    .eq('id', ctx.org.id)
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true, schedule }
})
