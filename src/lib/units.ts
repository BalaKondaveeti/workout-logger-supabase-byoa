import type { DisplayUnit } from './prefs'
import type { GymSet, Unit } from './types'

export const LB_PER_KG = 2.20462

export function convert(weight: number, from: Unit, to: Unit) {
  if (from === to) return weight
  return to === 'lb' ? weight * LB_PER_KG : weight / LB_PER_KG
}

export const toKg = (weight: number, unit: Unit) => convert(weight, unit, 'kg')

// Rounds to at most 1 decimal and drops a trailing .0
export const num = (n: number) => String(Math.round(n * 10) / 10)

// The unit a stored value is shown in.
export const shownUnit = (unit: Unit, display: DisplayUnit): Unit => (display === 'logged' ? unit : display)

export function fmtWeight(weight: number | null, unit: Unit, display: DisplayUnit) {
  if (weight === null) return '–'
  const u = shownUnit(unit, display)
  return `${num(convert(weight, unit, u))}${u}`
}

// "40kg×12", with " L"/" R" for one arm; each-arm is added by fmtSets.
export function fmtSet(s: GymSet, display: DisplayUnit, withArm = true) {
  let t = `${fmtWeight(s.weight, s.unit, display)}×${s.reps ?? '?'}`
  if (s.side) t += s.side === 'left' ? ' L' : ' R'
  else if (withArm && s.per_arm) t += ' ea'
  return t
}

// "40kg×12 · 45kg×10 · 45kg×8 (each arm)": the suffix covers all sets when they are all each-arm.
export function fmtSets(sets: GymSet[], display: DisplayUnit, sep = ' · ') {
  if (!sets.length) return ''
  const allEach = sets.every((s) => s.per_arm && !s.side)
  const text = sets.map((s) => fmtSet(s, display, !allEach)).join(sep)
  return allEach ? `${text} (each arm)` : text
}

// Weight × reps, doubled when done with each arm. In kg.
export function volumeKg(s: GymSet) {
  if (s.weight === null || !s.reps) return 0
  return toKg(s.weight, s.unit) * s.reps * (s.per_arm && !s.side ? 2 : 1)
}

// Epley estimated one-rep max, in kg.
export function e1rmKg(s: GymSet) {
  if (s.weight === null || !s.reps) return 0
  return toKg(s.weight, s.unit) * (1 + s.reps / 30)
}
