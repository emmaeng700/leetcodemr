type LcLocalHealth = { ok: boolean; authed?: boolean }

const LOCAL_BASE = 'http://127.0.0.1:8787'
const CACHE_MS = 15_000

let cached: { at: number; ok: boolean; authed: boolean } | null = null

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export async function getLocalConnectorStatus(): Promise<{ ok: boolean; authed: boolean }> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_MS) return { ok: cached.ok, authed: cached.authed }

  try {
    const res = await fetchWithTimeout(`${LOCAL_BASE}/health`, { method: 'GET' }, 500)
    const json = (await res.json()) as LcLocalHealth
    const ok = !!json?.ok && res.ok
    const authed = !!json?.authed
    cached = { at: now, ok, authed }
    return { ok, authed }
  } catch {
    cached = { at: now, ok: false, authed: false }
    return { ok: false, authed: false }
  }
}

export async function lcFetch(path: string, init: RequestInit): Promise<Response> {
  // Prefer local connector if available; otherwise fall back to app serverless routes.
  const isBrowser = typeof window !== 'undefined'
  if (!isBrowser) return fetch(path, init)

  const st = await getLocalConnectorStatus()
  if (!st.ok) return fetch(path, init)

  // Map app API routes to local connector routes.
  if (path === '/api/leetcode') return fetch(`${LOCAL_BASE}/leetcode/graphql`, init)
  if (path === '/api/leetcode/submit') return fetch(`${LOCAL_BASE}/leetcode/submit`, init)
  if (path === '/api/leetcode/test') return fetch(`${LOCAL_BASE}/leetcode/test`, init)
  if (path === '/api/leetcode/check') return fetch(`${LOCAL_BASE}/leetcode/check`, init)

  return fetch(path, init)
}

