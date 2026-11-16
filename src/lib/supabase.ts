import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const hasRealSupabaseValues = !!(url && key && url.trim().length > 0 && key.trim().length > 0 && !url.includes('your-project'))

export const supabaseConfigured = hasRealSupabaseValues

export const supabaseConfigError = hasRealSupabaseValues
  ? null
  : 'Missing or incomplete Supabase environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your local .env file.'

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true } }
)
