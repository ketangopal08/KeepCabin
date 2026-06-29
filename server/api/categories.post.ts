import { createClient } from '@supabase/supabase-js'
import type { Category } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; color: string }>(event)
  const config = useRuntimeConfig()

  if (!body?.name || body.name.trim().length === 0 || body.name.length > 50) {
    throw createError({ statusCode: 400, message: 'name must be 1–50 characters' })
  }
  if (!body?.color || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    throw createError({ statusCode: 400, message: 'color must be a valid hex color (#rrggbb)' })
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: body.name.trim(), color: body.color })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data as Category
})
