import { createClient } from '@supabase/supabase-js'
import type { Receipt } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ categoryId: string | null; confirmed: boolean }>(event)
  const config = useRuntimeConfig()

  if (!id) throw createError({ statusCode: 400, message: 'id is required' })
  if (!body) throw createError({ statusCode: 400, message: 'body is required' })

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data, error } = await supabase
    .from('receipts')
    .update({
      category_id: body.categoryId ?? null,
      category_suggested: !body.confirmed,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data as Receipt
})
