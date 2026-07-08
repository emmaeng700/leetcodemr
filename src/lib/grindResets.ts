import { supabase } from './supabase'

const USER_ID = 'emmanuel'
const LOCAL_KEY = 'lm_grind_reset_counts'

export const GRIND_RESET_CHANGED = 'lm-grind-reset-changed'

export function notifyGrindResetChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(GRIND_RESET_CHANGED))
}

function readAllLocal(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function writeAllLocal(counts: Record<string, number>): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(counts))
    notifyGrindResetChanged()
  } catch {
    /* quota */
  }
}

function isMissingTableError(message: string | undefined | null): boolean {
  if (!message) return false
  return /does not exist|relation.*not found/i.test(message)
}

export function readGrindResetCount(questionId: number): number {
  const all = readAllLocal()
  return all[String(questionId)] ?? 0
}

export function readAllGrindResetCounts(): Record<number, number> {
  const raw = readAllLocal()
  const out: Record<number, number> = {}
  for (const [k, v] of Object.entries(raw)) {
    const id = Number(k)
    if (Number.isFinite(id) && id > 0) out[id] = v
  }
  return out
}

function mergeCountMaps(
  ...maps: Array<Record<string, number> | Record<number, number>>
): Record<string, number> {
  const merged: Record<string, number> = {}
  for (const map of maps) {
    for (const [k, v] of Object.entries(map)) {
      const count = Number(v)
      if (count > 0) merged[k] = Math.max(merged[k] ?? 0, count)
    }
  }
  return merged
}

function persistMergedCounts(merged: Record<string, number>): Record<number, number> {
  writeAllLocal(merged)
  const out: Record<number, number> = {}
  for (const [k, v] of Object.entries(merged)) {
    const id = Number(k)
    if (Number.isFinite(id) && id > 0) out[id] = v
  }
  return out
}

/** Increment locally and return the new count. Syncs to Supabase if online. */
export function incrementGrindResetCount(questionId: number): number {
  const all = readAllLocal()
  const next = (all[String(questionId)] ?? 0) + 1
  all[String(questionId)] = next
  writeAllLocal(all)
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    void pushCountToSupabase(questionId, next)
  }
  return next
}

async function pushCountToSupabase(questionId: number, localCount: number): Promise<void> {
  try {
    const { data: existing, error: readErr } = await supabase
      .from('grind_reset_counts')
      .select('count')
      .eq('user_id', USER_ID)
      .eq('question_id', questionId)
      .maybeSingle()
    if (readErr) {
      if (!isMissingTableError(readErr.message)) {
        console.error('[grindResets] push read:', readErr.message)
      }
      return
    }
    const remoteCount: number = (existing as { count?: number } | null)?.count ?? 0
    const finalCount = Math.max(localCount, remoteCount)
    const { error } = await supabase.from('grind_reset_counts').upsert(
      { user_id: USER_ID, question_id: questionId, count: finalCount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,question_id' },
    )
    if (error && !isMissingTableError(error.message)) {
      console.error('[grindResets] push upsert:', error.message)
    }
  } catch {
    /* offline or network */
  }
}

async function mergeViaApi(local: Record<number, number>): Promise<Record<number, number> | null> {
  try {
    const res = await fetch('/api/grind-reset-counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counts: local }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { counts?: Record<string, number> }
    if (!data.counts) return null
    return persistMergedCounts(mergeCountMaps(local, data.counts))
  } catch {
    return null
  }
}

/**
 * Fetch from Supabase (or API fallback) and merge with local (max per question).
 * Persists merged result to localStorage. Safe offline — returns local only.
 */
export async function loadAndMergeGrindResetCounts(): Promise<Record<number, number>> {
  const local = readAllGrindResetCounts()
  if (typeof navigator !== 'undefined' && !navigator.onLine) return local

  try {
    const { data, error } = await supabase
      .from('grind_reset_counts')
      .select('question_id, count')
      .eq('user_id', USER_ID)

    if (error) {
      if (isMissingTableError(error.message)) {
        const viaApi = await mergeViaApi(local)
        return viaApi ?? local
      }
      return local
    }

    const remote: Record<string, number> = {}
    for (const row of (data ?? []) as { question_id: number; count: number }[]) {
      const id = Number(row.question_id)
      if (Number.isFinite(id) && id > 0) remote[String(id)] = row.count ?? 0
    }
    return persistMergedCounts(mergeCountMaps(local, remote))
  } catch {
    const viaApi = await mergeViaApi(local)
    return viaApi ?? local
  }
}

/** Push all locally-stored counts to Supabase. Call when coming back online. */
export async function syncAllGrindResetsToSupabase(): Promise<void> {
  const local = readAllGrindResetCounts()
  if (Object.keys(local).length === 0) return

  if (typeof navigator !== 'undefined' && navigator.onLine) {
    const viaApi = await mergeViaApi(local)
    if (viaApi) return
  }

  for (const [id, count] of Object.entries(local)) {
    if (count > 0) await pushCountToSupabase(Number(id), count)
  }
}
