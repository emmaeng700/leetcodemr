export type MasteryRunsMap = Record<string, number>

const KEY = 'lm_mastery_runs_v1'

function safeParse(raw: string | null): MasteryRunsMap {
  if (!raw) return {}
  try {
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return {}
    const out: MasteryRunsMap = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n)
    }
    return out
  } catch {
    return {}
  }
}

export function getMasteryRunsMap(): MasteryRunsMap {
  if (typeof window === 'undefined') return {}
  return safeParse(window.localStorage.getItem(KEY))
}

export function getMasteryRuns(questionId: number): number {
  const map = getMasteryRunsMap()
  return map[String(questionId)] ?? 0
}

export function incrementMasteryRuns(questionId: number, by = 1): number {
  if (typeof window === 'undefined') return 0
  const map = getMasteryRunsMap()
  const key = String(questionId)
  const next = Math.max(0, (map[key] ?? 0) + by)
  map[key] = next
  window.localStorage.setItem(KEY, JSON.stringify(map))
  return next
}

