import { useState, type FormEvent } from 'react'
import { clearConfig, DEFAULT_CONFIG, isDefaultConfig, loadConfig, normalizeUrl, saveConfig, verifyConfig } from '../lib/config'

// Change which Supabase project this browser uses. Pre-filled with the current one.
export function Setup({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [url, setUrl] = useState(() => loadConfig().url)
  const [key, setKey] = useState(() => loadConfig().key)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const config = { url: normalizeUrl(url), key: key.trim() }
    try {
      await verifyConfig(config)
      if (isDefaultConfig(config)) clearConfig()
      else saveConfig(config)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centered">
      <form className="narrow form" onSubmit={submit}>
        <h1>Supabase project</h1>
        <p className="hint">
          Find these in your Supabase project under Project Settings → API. A different project is saved only in this browser.
        </p>
        <label className="field">
          <span>Project URL</span>
          <input
            className="input"
            placeholder="https://xxxx.supabase.co"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            required
          />
        </label>
        <label className="field">
          <span>Publishable (anon) key</span>
          <input
            className="input"
            placeholder="sb_publishable_… or eyJ…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Checking…' : 'Save'}
        </button>
        {(url !== DEFAULT_CONFIG.url || key !== DEFAULT_CONFIG.key) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setUrl(DEFAULT_CONFIG.url)
              setKey(DEFAULT_CONFIG.key)
            }}
          >
            Use default project
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </form>
    </div>
  )
}
