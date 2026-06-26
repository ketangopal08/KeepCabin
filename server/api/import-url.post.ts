import { createClient } from '@supabase/supabase-js'
import type { Receipt } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ imageUrl: string }>(event)
  const config = useRuntimeConfig()

  const imgRes = await fetch(body.imageUrl)
  if (!imgRes.ok) {
    throw createError({ statusCode: 400, message: 'Image URL unreachable' })
  }

  const buffer = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const filename = body.imageUrl.split('/').pop()?.split('?')[0] ?? 'imported.jpg'
  const path = `imported/${Date.now()}-${filename}`

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, buffer, { contentType, upsert: false })

  if (uploadError) {
    throw createError({ statusCode: 500, message: uploadError.message })
  }

  const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)

  const { data: receipt, error: dbError } = await supabase
    .from('receipts')
    .insert({ filename, storage_url: urlData.publicUrl } satisfies Partial<Receipt>)
    .select()
    .single()

  if (dbError) throw createError({ statusCode: 500, message: dbError.message })

  return { receipt: receipt as Receipt }
})
