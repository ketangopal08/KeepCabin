import { createClient } from '@supabase/supabase-js'

// Removes the signed-in user's profile photo (files + user_metadata.avatar_url).
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = (getHeader(event, 'authorization') ?? '').replace('Bearer ', '')
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const { data: files } = await supabase.storage.from('avatars').list(user.id)
  if (files?.length) await supabase.storage.from('avatars').remove(files.map(f => `${user.id}/${f.name}`))

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar_url: null },
  })
  if (error) throw createError({ statusCode: 500, message: error.message })

  return { ok: true }
})
