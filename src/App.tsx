import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { ErrorNotice } from './components/ErrorNotice'
import { BarbellIcon, MenuIcon, PlusIcon } from './components/Icons'
import { Login } from './components/Login'
import { Setup } from './components/Setup'
import { today } from './lib/dates'
import { clearCache, refresh, resetStore, retryWrites, startStore, useStore } from './lib/store'
import { buildIndex } from './lib/derive'
import { daysSinceLastVisit, restLevel } from './lib/stats'
import { initSupabase, sb } from './lib/supabase'
import { ExerciseDetail } from './pages/ExerciseDetail'
import { Home } from './pages/Home'
import { AddExercise, NewExercise } from './pages/AddExercise'
import { MergeExercises } from './pages/MergeExercises'
import { LogDay } from './pages/LogDay'
import { Menu } from './pages/Menu'
import { MuscleDetail } from './pages/MuscleDetail'

const TABS = [
  { section: 'home', href: '#/', label: 'Home', icon: <BarbellIcon />, showLabel: true },
  { section: 'log', href: '#/log', label: 'Log', icon: <PlusIcon />, showLabel: true },
  { section: 'menu', href: '#/menu', label: 'Menu', icon: <MenuIcon />, showLabel: false },
]

// '#/log/2026-10-18?log=<id>' → parts ['log', '2026-10-18'], query
function parseRoute(hash: string) {
  const [path, query = ''] = hash.slice(1).split('?')
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(query) }
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash || '#/')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}

export default function App() {
  const [clientVersion, setClientVersion] = useState(() => (initSupabase(), 0)) // bumps when the project changes
  const [changingProject, setChangingProject] = useState(false)
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    sb()
      .auth.getSession()
      .then(({ data }) => setSession(data.session))
    const { data } = sb().auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        clearCache()
        resetStore()
      }
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [clientVersion])

  // Switching projects signs out first (accounts belong to a project).
  const changeProject = async () => {
    if (session && !confirm('Changing the Supabase project signs you out. Continue?')) return
    if (session) await sb().auth.signOut().catch(() => {})
    clearCache()
    setChangingProject(true)
  }

  const projectChanged = () => {
    initSupabase()
    setSession(undefined)
    setClientVersion((v) => v + 1)
    setChangingProject(false)
  }

  if (changingProject) return <Setup onDone={projectChanged} onCancel={() => setChangingProject(false)} />
  if (session === undefined) return <div className="centered muted">Loading…</div>
  if (!session) return <Login onChangeProject={changeProject} />
  return <Main key={session.user.id} userId={session.user.id} email={session.user.email} onChangeProject={changeProject} />
}

// More than 5 days since the last visit: switch the app to the red "overdue" theme
// (tokens in theme.css under [data-mood='overdue']) and match the browser/status bar color.
function useOverdueTheme(on: boolean) {
  useEffect(() => {
    const root = document.documentElement
    const metas = [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    const original = metas.map((m) => m.content)
    if (!on) return
    root.dataset.mood = 'overdue'
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
      metas.forEach((m) => (m.content = bg))
    }
    sync()
    dark.addEventListener('change', sync)
    return () => {
      dark.removeEventListener('change', sync)
      delete root.dataset.mood
      metas.forEach((m, i) => (m.content = original[i]))
    }
  }, [on])
}

function Main({ userId, email, onChangeProject }: { userId: string; email?: string; onChangeProject: () => void }) {
  const hash = useHashRoute()
  const { data, error, writeError } = useStore()
  useEffect(() => startStore(userId), [userId])
  const overdue = data ? restLevel(daysSinceLastVisit(buildIndex(data).dates)) === 'overdue' : false
  useOverdueTheme(overdue)

  if (!data) {
    return (
      <div className="centered">
        <div className="narrow">
          {error ? (
            <>
              <ErrorNotice error={error} onRetry={refresh} />
              <button className="btn btn-ghost" onClick={() => sb().auth.signOut()}>
                Sign out
              </button>
            </>
          ) : (
            <p className="muted center">Loading…</p>
          )}
        </div>
      </div>
    )
  }

  const { parts, query } = parseRoute(hash)
  const section = parts[0] === 'menu' ? 'menu' : parts[0] === 'log' ? 'log' : 'home'

  return (
    <>
      <nav className="nav">
        {TABS.map((t) => (
          <a
            key={t.section}
            href={t.section === 'log' ? `#/log/${today()}` : t.href}
            aria-label={t.label}
            aria-current={section === t.section ? 'page' : undefined}
          >
            {t.icon}
            {t.showLabel && <span>{t.label}</span>}
          </a>
        ))}
      </nav>
      <main className="app">
        {(writeError || (error && data)) && (
          <div className="notices">
            <ErrorNotice error={writeError || error} onRetry={writeError ? retryWrites : refresh} />
          </div>
        )}
        {parts[0] === 'merge' ? (
          <MergeExercises key={hash} from={query.get('from') ?? undefined} />
        ) : parts[0] === 'log' && parts[2] === 'new' ? (
          <NewExercise key={hash} date={parts[1]} name={query.get('name') ?? ''} />
        ) : parts[0] === 'menu' && parts[1] === 'exercises' && parts[2] === 'new' ? (
          <NewExercise key={hash} done="#/menu/exercises" cancel="#/menu/exercises" />
        ) : parts[0] === 'log' && parts[2] === 'add' ? (
          <AddExercise key={hash} date={parts[1]} />
        ) : parts[0] === 'log' ? (
          <LogDay key={parts[1] ?? 'today'} date={parts[1]} focusLog={query.get('log') ?? undefined} />
        ) : parts[0] === 'exercise' && parts[1] ? (
          <ExerciseDetail key={parts[1]} id={parts[1]} />
        ) : parts[0] === 'muscle' && parts[1] ? (
          <MuscleDetail key={parts[1]} id={parts[1]} />
        ) : parts[0] === 'menu' ? (
          <Menu path={parts.slice(1).join('/')} email={email} onSignOut={() => sb().auth.signOut()} onChangeProject={onChangeProject} />
        ) : (
          <Home />
        )}
      </main>
    </>
  )
}
