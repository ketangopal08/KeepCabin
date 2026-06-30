import { getOrgContext } from '~~/lib/org'

export default defineEventHandler(async (event) => {
  const ctx = await getOrgContext(event)
  if (!ctx) throw createError({ statusCode: 401, message: 'Unauthorized' })
  return ctx
})
