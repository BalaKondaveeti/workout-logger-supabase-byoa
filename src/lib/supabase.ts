import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { loadConfig } from './config'

let client: SupabaseClient | null = null

export function initSupabase() {
  const config = loadConfig()
  client = config ? createClient(config.url, config.key) : null
  return client
}

// Only called from screens rendered after setup + login, so the client exists.
export function sb(): SupabaseClient {
  if (!client) throw new Error('Supabase is not configured')
  return client
}
