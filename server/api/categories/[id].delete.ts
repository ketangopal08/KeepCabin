import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()

  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) throw createError({ statusCode: 500, message: error.message })
  setResponseStatus(event, 204)
  return null
})
