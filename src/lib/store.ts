import { useSyncExternalStore } from 'react'
import { loadConfig } from './config'
import { isUnreachable, UNREACHABLE } from './reach'
import { sb } from './supabase'
import { OPTIONAL_COLUMNS, OPTIONAL_TABLES, TABLES, type Data, type Table } from './types'

// All of the user's gym data lives in memory, mirrored to localStorage per user + project.
// Cached data shows instantly; it is re-fetched when older than 6 hours, on manual refresh,
// and shortly after every write. Writes apply to the screen immediately and go to Supabase
// through one ordered queue (inserts carry client-made ids, so later edits can follow them).

export const MAX_AGE_MS = 6 * 60 * 60 * 1000
const PAGE = 1000 // PostgREST's max rows per request
const PREFIX = 'gym.cache.'
const PATCH_DELAY_MS = 600
const REFRESH_AFTER_WRITE_MS = 1500

type State = {
  data: Data | null
  fetchedAt: number
  stale: boolean
  loading: boolean
  error: string // load/refresh error
  writeError: string // a save failed
  pending: number // writes not yet confirmed
}

type Op =
  | { kind: 'insert'; table: Table; row: Record<string, unknown> }
  | { kind: 'update'; table: Table; id: string; patch: Record<string, unknown> }
  | { kind: 'delete'; table: Table; id: string }
  | { kind: 'upsert'; table: Table; row: Record<string, unknown>; onConflict: string }

let state: State = { data: null, fetchedAt: 0, stale: true, loading: false, error: '', writeError: '', pending: 0 }
let userId = ''
const listeners = new Set<() => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export function useStore() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  )
}

// ---------- cache ----------

const cacheKey = () => `${PREFIX}${loadConfig().url}.${userId}`

function readCache(): { at: number; stale?: boolean; data: Data } | null {
  try {
    const raw = localStorage.getItem(cacheKey())
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeCache(data: Data, at: number, stale = false) {
  try {
    localStorage.setItem(cacheKey(), JSON.stringify({ at, stale, data }))
  } catch {
    // storage full or blocked
  }
}

export function clearCache() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX)) localStorage.removeItem(k)
  } catch {
    // ignore
  }
}

// ---------- loading ----------

async function fetchTable(table: Table) {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error, status } = await sb()
      .from(TABLES[table])
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) {
      // a newer table whose SQL hasn't been run yet: load as empty instead of failing everything
      if (OPTIONAL_TABLES.includes(table) && /could not find the table|does not exist/i.test(error.message)) return []
      throw Object.assign(new Error(error.message), { status })
    }
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

let writeVersion = 0 // bumps on every local change, so a refresh that raced a write is dropped

export async function refresh() {
  if (state.loading) return
  if (busyWriting()) return scheduleRefresh()
  set({ loading: true })
  const version = writeVersion
  try {
    const tables = Object.keys(TABLES) as Table[]
    const results = await Promise.all(tables.map(fetchTable))
    const data = Object.fromEntries(tables.map((t, i) => [t, results[i]])) as Data
    data.sets = data.sets.map((s) => ({ ...s, weight: s.weight === null ? null : Number(s.weight) }))
    if (version !== writeVersion || busyWriting()) {
      set({ loading: false })
      return scheduleRefresh()
    }
    const at = Date.now()
    writeCache(data, at)
    set({ data, fetchedAt: at, stale: false, loading: false, error: '' })
  } catch (err) {
    const e = err as Error & { status?: number }
    set({ loading: false, error: isUnreachable(e.message, e.status) ? UNREACHABLE : e.message })
  }
}

// Caches written before a table existed lack its key.
function withDefaults(d: Data): Data {
  const out = { ...d }
  for (const t of Object.keys(TABLES) as Table[]) if (!Array.isArray(out[t])) (out as Record<Table, unknown[]>)[t] = []
  return out
}

export function startStore(uid: string) {
  userId = uid
  const cached = readCache()
  set({
    data: cached?.data ? withDefaults(cached.data) : null,
    fetchedAt: cached?.at ?? 0,
    stale: !cached || !!cached.stale || Date.now() - cached.at > MAX_AGE_MS,
    error: '',
    writeError: '',
  })
  if (state.stale) refresh()
}

// Re-fetch once the data passes 6 hours, while open or when the app comes back to the foreground.
if (typeof window !== 'undefined') {
  const check = () => {
    if (!userId || document.visibilityState !== 'visible') return
    if (state.stale || Date.now() - state.fetchedAt > MAX_AGE_MS) refresh()
  }
  setInterval(check, 60_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPatches()
    else check()
  })
  window.addEventListener('pagehide', flushPatches)
}

// ---------- writes ----------

const queue: Op[] = []
let running = false
const patches = new Map<string, { table: Table; id: string; patch: Record<string, unknown>; timer: number }>()
let refreshTimer = 0

const busyWriting = () => running || queue.length > 0 || patches.size > 0

function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = window.setTimeout(() => {
    if (busyWriting()) scheduleRefresh()
    else refresh()
  }, REFRESH_AFTER_WRITE_MS)
}

function updatePending() {
  set({ pending: queue.length + patches.size + (running ? 1 : 0) })
}

function enqueue(op: Op) {
  queue.push(op)
  updatePending()
  run()
}

// Optional columns the database turned out not to have yet (their SQL not run): left out of writes.
const missingColumns = new Map<Table, Set<string>>()

function without(table: Table, obj: Record<string, unknown>) {
  const miss = missingColumns.get(table)
  if (!miss) return obj
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !miss.has(k)))
}

function sendOnce(op: Op) {
  const q = sb().from(TABLES[op.table])
  switch (op.kind) {
    case 'insert':
      return q.insert(without(op.table, op.row))
    case 'update': {
      const patch = without(op.table, op.patch)
      if (!Object.keys(patch).length) return Promise.resolve({ error: null, status: 204 } as unknown as Awaited<ReturnType<typeof q.delete>>)
      return q.update(patch).eq('id', op.id)
    }
    case 'delete':
      return q.delete().eq('id', op.id)
    case 'upsert':
      return q.upsert(without(op.table, op.row), { onConflict: op.onConflict })
  }
}

async function send(op: Op) {
  for (;;) {
    const res = await sendOnce(op)
    const col = res?.error?.message?.match(/could not find the '([^']+)' column/i)?.[1]
    if (col && OPTIONAL_COLUMNS[op.table]?.includes(col) && !missingColumns.get(op.table)?.has(col)) {
      missingColumns.set(op.table, new Set([...(missingColumns.get(op.table) ?? []), col]))
      continue // retry without it
    }
    return res
  }
}

async function run() {
  if (running) return
  running = true
  updatePending()
  while (queue.length) {
    const op = queue[0]
    let res: Awaited<ReturnType<typeof send>> | undefined
    let thrown: (Error & { status?: number }) | undefined
    try {
      res = await send(op)
    } catch (err) {
      thrown = err as Error & { status?: number }
    }
    const message = thrown?.message ?? res?.error?.message
    const status = thrown?.status ?? res?.status
    if (message && isUnreachable(message, status)) {
      // keep the op; Retry (or the next write) resumes the queue
      running = false
      set({ writeError: UNREACHABLE })
      updatePending()
      return
    }
    queue.shift()
    if (message) set({ writeError: `Couldn't save: ${message}` })
    else if (state.writeError === UNREACHABLE) set({ writeError: '' })
  }
  running = false
  updatePending()
  markStale()
  scheduleRefresh()
}

export function retryWrites() {
  set({ writeError: '' })
  if (queue.length) run()
  else refresh()
}

function markStale() {
  if (state.data) writeCache(state.data, state.fetchedAt, true)
}

function flushPatch(key: string) {
  const p = patches.get(key)
  if (!p) return
  clearTimeout(p.timer)
  patches.delete(key)
  enqueue({ kind: 'update', table: p.table, id: p.id, patch: p.patch })
}

export function flushPatches() {
  for (const key of [...patches.keys()]) flushPatch(key)
}

function mutate(fn: (d: Data) => Data) {
  if (!state.data) return
  writeVersion++
  set({ data: fn(state.data) })
}

export function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16),
  )
}

export function insertRow<T extends Table>(table: T, row: Data[T][number]) {
  mutate((d) => ({ ...d, [table]: [...d[table], { created_at: new Date().toISOString(), ...row }] }))
  enqueue({ kind: 'insert', table, row: row as Record<string, unknown> })
}

// Edits are applied locally right away and sent after a short pause (typing coalesces).
export function updateRow<T extends Table>(table: T, id: string, patch: Partial<Data[T][number]>, immediate = false) {
  mutate((d) => ({ ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  const key = `${table}:${id}`
  const existing = patches.get(key)
  if (existing) clearTimeout(existing.timer)
  const merged = { ...existing?.patch, ...patch } as Record<string, unknown>
  patches.set(key, { table, id, patch: merged, timer: window.setTimeout(() => flushPatch(key), PATCH_DELAY_MS) })
  updatePending()
  if (immediate) flushPatch(key)
}

export function deleteRow(table: Table, id: string) {
  patches.delete(`${table}:${id}`)
  mutate((d) => cascadeDelete(d, table, id))
  enqueue({ kind: 'delete', table, id })
}

export function upsertRow(table: Table, row: Record<string, unknown>, onConflict: string) {
  mutate((d) => {
    const rows = d[table] as unknown as { id: string }[]
    const exists = rows.some((r) => r.id === row.id)
    return { ...d, [table]: exists ? rows.map((r) => (r.id === row.id ? { ...r, ...row } : r)) : [...rows, row] }
  })
  enqueue({ kind: 'upsert', table, row: { user_id: userId, ...row }, onConflict })
}

// Mirrors the database's ON DELETE CASCADE locally.
function cascadeDelete(d: Data, table: Table, id: string): Data {
  if (table === 'days') {
    const logIds = new Set(d.logs.filter((l) => l.day_id === id).map((l) => l.id))
    return {
      ...d,
      days: d.days.filter((x) => x.id !== id),
      logs: d.logs.filter((l) => !logIds.has(l.id)),
      sets: d.sets.filter((s) => !logIds.has(s.log_id)),
    }
  }
  if (table === 'dayTypes') {
    return {
      ...d,
      dayTypes: d.dayTypes.filter((t) => t.id !== id),
      days: d.days.map((day) => (day.type_id === id ? { ...day, type_id: null } : day)),
    }
  }
  if (table === 'logs') return { ...d, logs: d.logs.filter((l) => l.id !== id), sets: d.sets.filter((s) => s.log_id !== id) }
  return { ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) }
}

export const currentUserId = () => userId
export const getData = () => state.data

export function resetStore() {
  userId = ''
  set({ data: null, fetchedAt: 0, stale: true, error: '', writeError: '' })
}
