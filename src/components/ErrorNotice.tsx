import { dashboardUrl, UNREACHABLE } from '../lib/reach'

// Shows an error; for "can't reach Supabase" it explains the likely pause and links to the dashboard.
export function ErrorNotice({ error, onRetry }: { error?: string; onRetry?: () => void }) {
  if (!error) return null
  if (error !== UNREACHABLE) return <p className="error">{error}</p>

  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  return (
    <div className="notice" role="alert">
      <strong>{offline ? "You're offline" : UNREACHABLE}</strong>
      <p className="hint">
        {offline
          ? 'Showing the data saved on this device. It will refresh when you are back online.'
          : 'Free Supabase projects pause after about a week without use. Open the dashboard, tap "Restore project", wait a minute or two, then retry.'}
      </p>
      <div className="inline">
        {!offline && (
          <a className="btn btn-primary btn-sm" href={dashboardUrl()} target="_blank" rel="noreferrer">
            Restore in Supabase
          </a>
        )}
        {onRetry && (
          <button className="btn btn-sm" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  )
}
