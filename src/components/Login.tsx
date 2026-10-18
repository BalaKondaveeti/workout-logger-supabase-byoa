import { useState, type FormEvent } from 'react'
import { isDefaultConfig, loadConfig } from '../lib/config'
import { isUnreachable, UNREACHABLE } from '../lib/reach'
import { sb } from '../lib/supabase'
import { ErrorNotice } from './ErrorNotice'

// Email + password sign-in (Supabase Auth). The account is shared with any other app on the same project.
export function Login({ onChangeProject }: { onChangeProject: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error } = await sb().auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      const e = err as Error & { status?: number }
      setError(isUnreachable(e.message, e.status) ? UNREACHABLE : e.message)
    } finally {
      setBusy(false)
    }
  }

  const host = (() => {
    try {
      return new URL(loadConfig().url).hostname
    } catch {
      return loadConfig().url
    }
  })()

  return (
    <div className="centered">
      <form className="narrow form" onSubmit={submit}>
        <h1>Gym log</h1>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <ErrorNotice error={error} onRetry={error === UNREACHABLE ? () => submit() : undefined} />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="project-switch">
          <span className="hint">
            Project: {host}
            {isDefaultConfig() ? ' (default)' : ''}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onChangeProject}>
            Change Supabase project
          </button>
        </div>
      </form>
    </div>
  )
}
