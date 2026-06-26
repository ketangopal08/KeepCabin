import { createClient } from '@supabase/supabase-js'
import type { Receipt } from '~~/lib/supabase'

function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return match ? (match[1] ?? null) : null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ folderUrl: string }>(event)
  const config = useRuntimeConfig()

  const folderId = extractFolderId(body.folderUrl)
  if (!folderId) {
    throw createError({ statusCode: 400, message: 'Invalid Google Drive folder URL' })
  }

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType+contains+'image/'&fields=files(id,name,mimeType)&key=${config.googleDriveApiKey}`
  )

  if (!driveRes.ok) {
    const err = await driveRes.json()
    const message = (err as any)?.error?.message ?? 'Google Drive API error'
    if (driveRes.status === 403) {
      throw createError({ statusCode: 403, message: 'Make sure the folder is publicly shared' })
    }
    throw createError({ statusCode: driveRes.status, message })
  }

  const { files } = await driveRes.json() as { files: { id: string; name: string; mimeType: string }[] }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const errors: string[] = []
  let inserted = 0

  for (const file of files) {
    try {
      const imageUrl = `https://drive.google.com/uc?export=download&id=${file.id}`
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`Failed to download ${file.name}`)

      const buffer = await imgRes.arrayBuffer()
      const path = `drive/${file.id}/${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, buffer, { contentType: file.mimeType || 'image/jpeg', upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)

      const { error: dbError } = await supabase.from('receipts').upsert({
        filename: file.name,
        drive_file_id: file.id,
        storage_url: urlData.publicUrl,
      } satisfies Partial<Receipt>, { onConflict: 'drive_file_id' })

      if (dbError) throw new Error(dbError.message)
      inserted++
    } catch (e: unknown) {
      errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  return { inserted, errors }
})
