export interface SetQProgress {
  solved: boolean
  starred: boolean
  review_count: number
  next_review: string | null
  last_reviewed: string | null
  notes: string
}

export interface SetSavedCycle {
  id: string
  name: string
  rangeLabel: string
  range: { start: number; end: number }
  reps: number
  cyclePos?: number
  cycleIdx?: number
  cycleAccepted?: number[]
  cycleOrderedIds?: number[]
  createdAt: string
}

export interface SetCycleState {
  cycleRange: { start: number; end: number } | null
  cycleReps: number
  cyclePos: number
  cycleIdx?: number
  cycleAccepted: number[]
  cycleOrderedIds?: number[]
}

function key(set: 2 | 3, suffix: string) {
  return `lm_set${set}_${suffix}`
}

// ── Progress ──────────────────────────────────────────────────────────────────

export function getSetProgress(set: 2 | 3): Record<string, SetQProgress> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key(set, 'progress'))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveSetProgress(set: 2 | 3, progress: Record<string, SetQProgress>) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key(set, 'progress'), JSON.stringify(progress)) } catch {}
}

export function updateSetQProgress(
  set: 2 | 3,
  qId: number,
  update: Partial<SetQProgress>,
): SetQProgress {
  const all = getSetProgress(set)
  const current: SetQProgress = all[String(qId)] ?? {
    solved: false, starred: false, review_count: 0,
    next_review: null, last_reviewed: null, notes: '',
  }
  const next = { ...current, ...update }
  all[String(qId)] = next
  saveSetProgress(set, all)
  return next
}

// ── Cycles ────────────────────────────────────────────────────────────────────

export function getSetCycles(set: 2 | 3): SetSavedCycle[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(key(set, 'cycles'))
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveSetCycles(set: 2 | 3, cycles: SetSavedCycle[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key(set, 'cycles'), JSON.stringify(cycles)) } catch {}
}

// ── Cycle state ───────────────────────────────────────────────────────────────

export function getSetCycleState(set: 2 | 3): SetCycleState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key(set, 'cycle_state'))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveSetCycleState(set: 2 | 3, state: SetCycleState | null) {
  if (typeof window === 'undefined') return
  try {
    if (state) localStorage.setItem(key(set, 'cycle_state'), JSON.stringify(state))
    else localStorage.removeItem(key(set, 'cycle_state'))
  } catch {}
}

export function clampSetCycleIdx(
  idx: number | undefined | null,
  range: { start: number; end: number },
): number {
  if (typeof idx !== 'number' || !Number.isFinite(idx)) return range.start
  return Math.max(range.start, Math.min(idx, range.end))
}

// ── SR interval helper (same formula as main app) ────────────────────────────

export function srIntervalDays(reviewCount: number): number {
  const intervals = [1, 3, 7, 14, 30, 60, 90]
  return intervals[Math.min(reviewCount, intervals.length - 1)] ?? 90
}

export function nextReviewDate(reviewCount: number): string {
  const days = srIntervalDays(reviewCount)
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}
