/**
 * LeetCode list page only - AC status from leetcode.com submission history.
 * Stored in localStorage; never writes Supabase progress or Learn/Daily state.
 */

import { getCookieFromHeader, parseStoredLcSession, formatLcSessionJar } from '@/lib/leetcodeHttp'
import { resolveLeetCodeSlug } from '@/lib/utils'

export const LC_LIST_SYNC_KEY = 'lm_leetcode_list_sync'

export type LcListSyncState = {
  syncedAt: string
  solvedIds: number[]
  /** Unique problems with AC on LeetCode (all slugs from submission history). */
  totalAcProblems: number
  /** AC problems that match this app's Sets 1-3 list. */
  grindAcCount: number
  /** AC on LeetCode but not in this app's Sets 1-3 list. */
  extraAcCount: number
}

export function readLcListSync(): LcListSyncState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LC_LIST_SYNC_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LcListSyncState>
    if (!parsed?.syncedAt || !Array.isArray(parsed.solvedIds)) return null
    const totalAcProblems =
      typeof parsed.totalAcProblems === 'number'
        ? parsed.totalAcProblems
        : parsed.solvedIds.length
    const grindAcCount =
      typeof parsed.grindAcCount === 'number'
        ? parsed.grindAcCount
        : parsed.solvedIds.length
    const extraAcCount =
      typeof parsed.extraAcCount === 'number'
        ? parsed.extraAcCount
        : Math.max(0, totalAcProblems - grindAcCount)
    return {
      syncedAt: parsed.syncedAt,
      solvedIds: parsed.solvedIds,
      totalAcProblems,
      grindAcCount,
      extraAcCount,
    }
  } catch {
    return null
  }
}

export function writeLcListSync(state: LcListSyncState): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LC_LIST_SYNC_KEY, JSON.stringify(state))
}

export function clearLcListSync(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LC_LIST_SYNC_KEY)
}

export async function loadLcSessionForSync(): Promise<{ session: string; csrf: string }> {
  const fromLocal = parseStoredLcSession(
    localStorage.getItem('lc_session'),
    localStorage.getItem('lc_csrf'),
  )
  let session = fromLocal.session
  let csrf = fromLocal.csrf || getCookieFromHeader(fromLocal.session, 'csrftoken')

  if (!session) {
    try {
      const d = await fetch('/api/lc-session').then(r => r.json())
      const parsed = parseStoredLcSession(d.lc_session, d.lc_csrf)
      session = parsed.session
      csrf = parsed.csrf || getCookieFromHeader(parsed.session, 'csrftoken')
      if (session) {
        const { jar, csrf: jarCsrf } = formatLcSessionJar(d.lc_session ?? session, csrf)
        localStorage.setItem('lc_session', jar)
        session = jar
        const finalCsrf = jarCsrf || csrf
        csrf = finalCsrf
        if (finalCsrf) localStorage.setItem('lc_csrf', finalCsrf)
      }
    } catch { /* ignore */ }
  }

  if (session && !csrf) {
    try {
      const r = await fetch('/api/lc-csrf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session }),
      })
      const d = await r.json() as { csrf?: string }
      csrf = d.csrf ?? ''
    } catch { /* ignore */ }
  }

  if (session && typeof window !== 'undefined') {
    const { jar, csrf: jarCsrf } = formatLcSessionJar(
      localStorage.getItem('lc_session') || session,
      csrf,
    )
    localStorage.setItem('lc_session', jar)
    csrf = jarCsrf || csrf
    if (csrf) localStorage.setItem('lc_csrf', csrf)
    session = jar
  }

  return { session, csrf }
}

/** Load session from local/Supabase; if missing, auto-apply newest saved token. */
export async function ensureLcSessionForSync(): Promise<{ session: string; csrf: string }> {
  let creds = await loadLcSessionForSync()
  if (creds.session) return creds

  try {
    const r = await fetch('/api/clipboard', { cache: 'no-store' })
    const d = await r.json() as { items?: Array<{ is_token: boolean; content: string }> }
    const token = (d.items ?? []).find(i => i.is_token && i.content?.trim())
    if (token) {
      await persistLcSessionFromPaste(token.content)
      creds = await loadLcSessionForSync()
    }
  } catch { /* ignore */ }

  return creds
}

/** Save LeetCode cookie to localStorage + Supabase (clipboard Use, paste panel, etc.). */
export async function persistLcSessionFromPaste(
  rawSession: string,
  rawCsrf = '',
): Promise<{ session: string; csrf: string; ok: boolean }> {
  const parsed = parseStoredLcSession(rawSession, rawCsrf)
  if (!parsed.session) return { session: '', csrf: '', ok: false }

  let csrf = parsed.csrf || getCookieFromHeader(rawSession, 'csrftoken')
  if (!csrf) {
    try {
      const r = await fetch('/api/lc-csrf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: rawSession }),
      })
      const d = await r.json() as { csrf?: string }
      csrf = d.csrf ?? ''
    } catch { /* ignore */ }
  }

  const { jar, csrf: finalCsrf } = formatLcSessionJar(rawSession, csrf)
  if (!jar) return { session: '', csrf: '', ok: false }
  csrf = finalCsrf

  if (typeof window !== 'undefined') {
    localStorage.setItem('lc_session', jar)
    if (csrf) localStorage.setItem('lc_csrf', csrf)
  }

  try {
    await fetch('/api/lc-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lc_session: jar, lc_csrf: csrf }),
    })
  } catch { /* local session still usable on this device */ }

  return { session: jar, csrf, ok: true }
}

function buildSlugToIdMap(questions: Array<{ id: number; slug: string }>): Map<string, number> {
  const map = new Map<string, number>()
  for (const q of questions) {
    map.set(q.slug, q.id)
    map.set(resolveLeetCodeSlug(q.id, q.slug), q.id)
  }
  return map
}

/** Pull Accepted slugs from LeetCode and map to app question ids for this list only. */
export async function syncLeetCodeListAccepted(
  questions: Array<{ id: number; slug: string }>,
  session: string,
  csrf: string,
): Promise<{ solvedIds: number[]; totalAcProblems: number; grindAcCount: number; extraAcCount: number; error?: string }> {
  if (!session || !csrf) {
    return { solvedIds: [], totalAcProblems: 0, grindAcCount: 0, extraAcCount: 0, error: 'Connect your LeetCode session first (Practice editor Session panel).' }
  }

  const res = await fetch('/api/leetcode/ac-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, csrfToken: csrf }),
  })

  let data: { bySlug?: Record<string, number>; error?: string; code?: string }
  try {
    data = await res.json()
  } catch {
    return { solvedIds: [], totalAcProblems: 0, grindAcCount: 0, extraAcCount: 0, error: 'Sync failed - invalid response.' }
  }

  if (data.error === 'no_session' || data.code === 'lc_no_session') {
    return { solvedIds: [], totalAcProblems: 0, grindAcCount: 0, extraAcCount: 0, error: 'No LeetCode session saved.' }
  }
  if (data.code === 'lc_not_logged_in' || /not logged in|expired/i.test(data.error ?? '')) {
    return {
      solvedIds: [],
      totalAcProblems: 0,
      grindAcCount: 0,
      extraAcCount: 0,
      error: 'LeetCode session expired — open leetcode.com, copy Cookie (F12 → Network), then Clipboard → Use.',
    }
  }
  if (data.error && !data.bySlug) {
    return { solvedIds: [], totalAcProblems: 0, grindAcCount: 0, extraAcCount: 0, error: String(data.error) }
  }

  const slugToId = buildSlugToIdMap(questions)
  const solvedIds = new Set<number>()
  const bySlug = data.bySlug ?? {}
  const totalAcProblems = Object.values(bySlug).filter(c => (c ?? 0) >= 1).length
  for (const [slug, count] of Object.entries(data.bySlug ?? {})) {
    if ((count ?? 0) < 1) continue
    const id = slugToId.get(slug)
    if (id) solvedIds.add(id)
  }

  const grindAcCount = solvedIds.size
  const extraAcCount = Math.max(0, totalAcProblems - grindAcCount)

  const state: LcListSyncState = {
    syncedAt: new Date().toISOString(),
    solvedIds: Array.from(solvedIds).sort((a, b) => a - b),
    totalAcProblems,
    grindAcCount,
    extraAcCount,
  }
  writeLcListSync(state)
  return { solvedIds: state.solvedIds, totalAcProblems, grindAcCount, extraAcCount }
}

export function formatSyncTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
