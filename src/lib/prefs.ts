import { useSyncExternalStore } from 'react'
import type { Unit } from './types'

// Device-local preferences (localStorage). Missing or blocked storage falls back to defaults.

export type DisplayUnit = Unit | 'logged'

type Prefs = { displayUnit: DisplayUnit; showSides: boolean }

const KEY = 'gym.prefs'
const DEFAULTS: Prefs = { displayUnit: 'logged', showSides: false }
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
