import { useEffect, useState } from 'react'
import { refresh, useStore } from '../lib/store'
import { RefreshIcon } from './Icons'

// "Saving…" / "Saved" for the autosaving log screen.
export function SaveStatus() {
  const { pending, writeError } = useStore()
  if (writeError) return <span className="status error-text">Not saved</span>
  return <span className="status muted">{pending ? 'Saving…' : 'Saved'}</span>
}

function ago(ms: number) {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}

// Manual refresh button with the age of the data.
export function Freshness() {
  const { fetchedAt, loading } = useStore()
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <button className="freshness" onClick={() => refresh()} disabled={loading} aria-label="Refresh">
      <RefreshIcon spinning={loading} />
      <span>{loading ? 'Refreshing…' : fetchedAt ? `Updated ${ago(Date.now() - fetchedAt)}` : 'Refresh'}</span>
    </button>
  )
}
