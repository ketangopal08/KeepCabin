import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email: string }>(event)
  if (!body?.email || !body.email.includes('@')) {
    throw createError({ statusCode: 400, message: 'Invalid email' })
  }

  const config = useRuntimeConfig()
  if (!config.supabaseServiceKey) {
    throw createError({ statusCode: 500, message: 'Server misconfiguration: missing service key' })
  }

  const admin = createClient(config.public.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await admin.auth.admin.getUserByEmail(body.email.trim())
  if (error && error.message !== 'User not found') {
    throw createError({ statusCode: 500, message: error.message })
  }

  return { exists: !!data?.user }
})
