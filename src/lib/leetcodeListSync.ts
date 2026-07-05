/**
 * LeetCode list page only - AC status from leetcode.com submission history.
 * Stored in localStorage; never writes Supabase progress or Learn/Daily state.
 */

import { getCookieFromHeader, parseStoredLcSession } from '@/lib/leetcodeHttp'
import { resolveLeetCodeSlug } from '@/lib/utils'

export const LC_LIST_SYNC_KEY = 'lm_leetcode_list_sync'

export type LcListSyncState = {
  syncedAt: string
  solvedIds: number[]
}

export function readLcListSync(): LcListSyncState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(LC_LIST_SYNC_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LcListSyncState
    if (!parsed?.syncedAt || !Array.isArray(parsed.solvedIds)) return null
    return parsed
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
        localStorage.setItem('lc_session', parsed.session)
        if (csrf) localStorage.setItem('lc_csrf', csrf)
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
      if (csrf) localStorage.setItem('lc_csrf', csrf)
    } catch { /* ignore */ }
  }

  return { session, csrf }
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
): Promise<{ solvedIds: number[]; error?: string }> {
  if (!session || !csrf) {
    return { solvedIds: [], error: 'Connect your LeetCode session first (Practice editor Session panel).' }
  }

  const res = await fetch('/api/leetcode/ac-counts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session, csrfToken: csrf }),
  })

  let data: { bySlug?: Record<string, number>; error?: string }
  try {
    data = await res.json()
  } catch {
    return { solvedIds: [], error: 'Sync failed - invalid response.' }
  }

  if (data.error === 'no_session') {
    return { solvedIds: [], error: 'No LeetCode session saved.' }
  }
  if (data.error && !data.bySlug) {
    return { solvedIds: [], error: String(data.error) }
  }

  const slugToId = buildSlugToIdMap(questions)
  const solvedIds = new Set<number>()
  for (const [slug, count] of Object.entries(data.bySlug ?? {})) {
    if ((count ?? 0) < 1) continue
    const id = slugToId.get(slug)
    if (id) solvedIds.add(id)
  }

  const state: LcListSyncState = {
    syncedAt: new Date().toISOString(),
    solvedIds: Array.from(solvedIds).sort((a, b) => a - b),
  }
  writeLcListSync(state)
  return { solvedIds: state.solvedIds }
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
