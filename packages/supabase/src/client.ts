import { createClient } from '@supabase/supabase-js'
import { type Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co'
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing-anon-key'

export const supabase = createClient<Database>(url, anonKey)
