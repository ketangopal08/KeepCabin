import { createClient } from '@supabase/supabase-js'

export type Category = {
  id: string
  name: string
  color: string
  created_at: string
}

export type Receipt = {
  id: string
  filename: string
  drive_file_id: string | null
  storage_url: string
  ocr_text: string | null
  category_id: string | null
  category_suggested: boolean
  created_at: string
}

export function useSupabase() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
}
