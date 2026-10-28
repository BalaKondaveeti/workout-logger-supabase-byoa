import { useSyncExternalStore } from 'react'
import type { Unit } from './types'

// Device-local preferences (localStorage). Missing or blocked storage falls back to defaults.

export type DisplayUnit = Unit | 'logged'

// sides: exercise id -> show the Left / Right checkboxes on its sets
export type StatsRange = '4w' | '12w' | 'all'
type Prefs = { displayUnit: DisplayUnit; sides: Record<string, boolean>; statsRange: StatsRange }

const KEY = 'gym.prefs'
const DEFAULTS: Prefs = { displayUnit: 'logged', sides: {}, statsRange: '12w' }
const listeners = new Set<() => void>()

let prefs: Prefs = (() => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
})()

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  prefs = { ...prefs, [key]: value }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
  listeners.forEach((l) => l())
}

export function usePrefs() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => prefs,
  )
}

export const getPrefs = () => prefs
