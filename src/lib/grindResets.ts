import { supabase } from './supabase'

const USER_ID = 'emmanuel'
const LOCAL_KEY = 'lm_grind_reset_counts'

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
  } catch {
    /* quota */
  }
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
    if (readErr) return
    const remoteCount: number = (existing as { count?: number } | null)?.count ?? 0
    const finalCount = Math.max(localCount, remoteCount)
    await supabase.from('grind_reset_counts').upsert(
      { user_id: USER_ID, question_id: questionId, count: finalCount, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,question_id' },
    )
  } catch {
    /* offline or table not yet created */
  }
}

/**
 * Fetch from Supabase and merge with local (take max per question).
 * Returns the merged map — also persists it back to localStorage.
 * Safe to call offline: returns local state immediately.
 */
export async function loadAndMergeGrindResetCounts(): Promise<Record<number, number>> {
  const local = readAllGrindResetCounts()
  if (typeof navigator !== 'undefined' && !navigator.onLine) return local

  try {
    const { data, error } = await supabase
      .from('grind_reset_counts')
      .select('question_id, count')
      .eq('user_id', USER_ID)
    if (error) return local

    const merged: Record<number, number> = { ...local }
    for (const row of (data ?? []) as { question_id: number; count: number }[]) {
      const id = Number(row.question_id)
      merged[id] = Math.max(merged[id] ?? 0, row.count ?? 0)
    }
    const asStr: Record<string, number> = {}
    for (const [k, v] of Object.entries(merged)) asStr[k] = v
    writeAllLocal(asStr)
    return merged
  } catch {
    return local
  }
}

/** Push all locally-stored counts to Supabase. Call when coming back online. */
export async function syncAllGrindResetsToSupabase(): Promise<void> {
  const local = readAllGrindResetCounts()
  for (const [id, count] of Object.entries(local)) {
    if (count > 0) await pushCountToSupabase(Number(id), count)
  }
}
