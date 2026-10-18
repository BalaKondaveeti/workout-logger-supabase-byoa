import { loadConfig } from './config'

// Shared message for "the Supabase project didn't answer" — usually a free project
// paused after a week without use. ErrorNotice turns it into a Restore / Retry prompt.
export const UNREACHABLE = "Can't reach your Supabase project."

// Network failures surface as status 0 / "Failed to fetch" (Chrome), "Load failed" (Safari),
// "NetworkError…" (Firefox); paused or waking projects answer with 5xx gateway codes.
export function isUnreachable(message?: string, status?: number) {
  if (status === 0 || status === 502 || status === 503 || status === 504 || (status !== undefined && status >= 520)) return true
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message ?? '')
}

// https://<ref>.supabase.co → https://supabase.com/dashboard/project/<ref>
export function dashboardUrl() {
  const host = (() => {
    try {
      return new URL(loadConfig().url).hostname
    } catch {
      return ''
    }
  })()
  const ref = host.endsWith('.supabase.co') ? host.split('.')[0] : ''
  return ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard'
}
