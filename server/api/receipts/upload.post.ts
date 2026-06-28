import { createClient } from '@supabase/supabase-js'
import type { Receipt } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const config   = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const parts    = await readMultipartFormData(event)
  const filePart = parts?.find(p => p.name === 'file')

  if (!filePart?.data?.length) {
    throw createError({ statusCode: 400, message: 'No file provided' })
  }

  const filename    = filePart.filename ?? `receipt-${Date.now()}`
  const contentType = filePart.type ?? 'image/jpeg'
  const ext         = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  let storageUrl: string

  // Try Supabase storage; fall back to base64 data URL so it works without bucket setup
  const { error: storageError } = await supabase.storage
    .from('receipts')
    .upload(storagePath, filePart.data, { contentType })

  if (!storageError) {
    const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(storagePath)
    storageUrl = publicUrl
  } else {
    // No bucket configured — store inline so the receipt is still viewable
    storageUrl = `data:${contentType};base64,${filePart.data.toString('base64')}`
  }

  const { data, error: dbError } = await supabase
    .from('receipts')
    .insert({ filename, storage_url: storageUrl, drive_file_id: null })
    .select()
    .single()

  if (dbError) throw createError({ statusCode: 500, message: dbError.message })
  return data as Receipt
})
