import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://kwbxkjlccpbmmjauaygh.supabase.co'
const supabaseAnonKey = 'sb_publishable_CprGFEvAqXTcQTR2EzFAuA_2VlPGPQ_'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  email: string
  is_premium: boolean
  download_count: number
  last_reset: string
  created_at: string
}