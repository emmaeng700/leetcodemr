'use client'

const IMBIBITION_RUNS_STORAGE_KEY = 'lm_imbibition_runs_v1'
const IMBIBITION_LEVELS_STORAGE_KEY = 'lm_imbibition_levels_v1'
const IMBIBITION_ISOLATION_MIGRATION_KEY = 'lm_imbibition_isolation_migrated_v2'

export function ensureImbibitionIsolationMigration() {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(IMBIBITION_ISOLATION_MIGRATION_KEY) === '1') return
    window.localStorage.removeItem(IMBIBITION_RUNS_STORAGE_KEY)
    window.localStorage.removeItem(IMBIBITION_LEVELS_STORAGE_KEY)
    window.localStorage.setItem(IMBIBITION_ISOLATION_MIGRATION_KEY, '1')
  } catch {
    // ignore localStorage issues; app can still proceed with defaults
  }
}

function readRuns(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    ensureImbibitionIsolationMigration()
    const raw = window.localStorage.getItem(IMBIBITION_RUNS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {}
  } catch {
    return {}
  }
}

function writeRuns(runs: Record<string, number>) {
  if (typeof window === 'undefined') return
  ensureImbibitionIsolationMigration()
  window.localStorage.setItem(IMBIBITION_RUNS_STORAGE_KEY, JSON.stringify(runs))
}

export async function getImbibitionRunsByQuestion(): Promise<Record<string, number>> {
  return readRuns()
}

export async function addImbibitionRunEvent(questionId: number, count = 1) {
  const runs = readRuns()
  const key = String(questionId)
  runs[key] = (runs[key] ?? 0) + Math.max(1, count)
  writeRuns(runs)
  return { ok: true, error: null as string | null }
}

export async function resetImbibitionRuns(questionIds?: number[]) {
  if (!questionIds || questionIds.length === 0) {
    writeRuns({})
    return { ok: true, error: null as string | null }
  }

  const runs = readRuns()
  for (const qid of questionIds) {
    delete runs[String(qid)]
  }
  writeRuns(runs)
  return { ok: true, error: null as string | null }
}
