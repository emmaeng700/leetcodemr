import { buildExclusivePatternMap } from './patternUtils'

const STORAGE_KEY = 'lm_breathers_v1'

type BreatherMap = Record<string, string> // patternName → completedDateISO (Chicago)

function todayISO() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
}

function getBreathers(): BreatherMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function recordBreather(patternName: string) {
  const today = todayISO()
  const existing = getBreathers()
  existing[patternName] = today
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing))
}

export type ActiveBreather = { name: string; day: 1 | 2 }

export function getActiveBreathers(): ActiveBreather[] {
  const today = todayISO()
  const todayMs = new Date(today).getTime()
  const breathers = getBreathers()
  const active: ActiveBreather[] = []
  for (const [name, date] of Object.entries(breathers)) {
    const diffDays = Math.round((todayMs - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) active.push({ name, day: 1 })
    else if (diffDays === 1) active.push({ name, day: 2 })
    // diffDays >= 2: expired — ignore
  }
  return active
}

/**
 * Call after marking a question as solved.
 * Checks if all questions in its exclusive pattern are now solved.
 * If yes, records a 2-day breather in localStorage.
 * Returns the pattern name if a breather was just triggered, null otherwise.
 */
export function checkAndRecordBreather(
  justSolvedId: number,
  allQuestions: Array<{ id: number; tags: string[] }>,
  progress: Record<string, { solved?: boolean }>,
): string | null {
  const patternMap = buildExclusivePatternMap(allQuestions)
  const patternName = patternMap[justSolvedId]
  if (!patternName) return null

  const patternQs = allQuestions.filter(q => patternMap[q.id] === patternName)
  const allSolved = patternQs.every(
    q => q.id === justSolvedId || progress[String(q.id)]?.solved === true,
  )

  if (allSolved) {
    recordBreather(patternName)
    return patternName
  }
  return null
}
