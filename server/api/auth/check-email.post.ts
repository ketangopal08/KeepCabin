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

  // generateLink with type 'recovery' looks up the user by email server-side.
  // - User exists  → succeeds (we discard the link, no email is sent)
  // - User missing → 404 "User not found" error
  const { error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: body.email.trim(),
  })

  if (!error) {
    return { exists: true }
  }

  // 404 / 422 means user not found — anything else is a real server error
  const status = (error as any).status ?? (error as any).code
  const msg = error.message?.toLowerCase() ?? ''
  if (status === 404 || status === 422 || msg.includes('not found') || msg.includes('no user')) {
    return { exists: false }
  }

  throw createError({ statusCode: 500, message: error.message })
})
