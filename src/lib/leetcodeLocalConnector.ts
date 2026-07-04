const CONNECTOR_BASE =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_LC_CONNECTOR_URL) ||
  'http://127.0.0.1:8787'

let _healthy: boolean | null = null
let _healthyAt = 0
const HEALTHY_TTL = 30_000
const FAIL_TTL = 10_000

export function invalidateLocalConnectorCache() {
  _healthy = null
}

export async function localConnectorHealthy(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  if (_healthy === true && now - _healthyAt < HEALTHY_TTL) return true
  if (_healthy === false && now - _healthyAt < FAIL_TTL) return false
  try {
    const res = await fetch(`${CONNECTOR_BASE}/health`, { cache: 'no-store', signal: AbortSignal.timeout(1500) })
    const data = (await res.json()) as { ok?: boolean; authed?: boolean }
    _healthy = !!(res.ok && data.ok && data.authed)
    _healthyAt = now
    return _healthy
  } catch {
    _healthy = false
    _healthyAt = now
    return false
  }
}

export async function localConnectorPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${CONNECTOR_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
}

/** Back-compat passthrough used by older call sites. */
export async function lcFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(path, init)
}
