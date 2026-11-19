import { createClient } from '@supabase/supabase-js'

const BUCKET = 'avatars'
const MAX_BYTES = 2 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

// Uploads the signed-in user's profile photo and saves its URL in user_metadata.avatar_url.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = (getHeader(event, 'authorization') ?? '').replace('Bearer ', '')
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file')
  if (!file?.data?.length) throw createError({ statusCode: 400, message: 'No image provided' })
  const ext = TYPES[file.type ?? '']
  if (!ext) throw createError({ statusCode: 400, message: 'Use a PNG, JPG, WebP or GIF image' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 400, message: 'Image must be 2 MB or smaller' })

  // Create the public avatars bucket on first use.
  const { data: bucket } = await supabase.storage.getBucket(BUCKET)
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: Object.keys(TYPES),
    })
    if (error && !/already exists/i.test(error.message)) throw createError({ statusCode: 500, message: error.message })
  }

  // Remove previous photos, then upload the new one under a fresh name (avoids stale caches).
  const { data: old } = await supabase.storage.from(BUCKET).list(user.id)
  if (old?.length) await supabase.storage.from(BUCKET).remove(old.map(f => `${user.id}/${f.name}`))

  const path = `${user.id}/${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file.data, { contentType: file.type, upsert: true })
  if (upErr) throw createError({ statusCode: 500, message: upErr.message })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const { error: metaErr } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, avatar_url: publicUrl },
  })
  if (metaErr) throw createError({ statusCode: 500, message: metaErr.message })

  return { avatarUrl: publicUrl }
})
