/**
 * LeetCode Run/Submit/Check/GraphQL via same-origin API routes.
 * Session + csrftoken from localStorage are forwarded to LeetCode on the server.
 */

export type LcTransport = 'api'

type JsonResult = {
  ok: boolean
  status: number
  data: Record<string, unknown>
  transport: LcTransport
  retryAfterSec?: number
}

async function viaApi(path: string, body: unknown): Promise<JsonResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const retryAfterHeader = res.headers.get('Retry-After')
  let data: Record<string, unknown> = {}
  try {
    data = JSON.parse(await res.text()) as Record<string, unknown>
  } catch {
    data = { error: 'Invalid JSON from API route.' }
  }
  const retryAfterSec = data.retryAfterSec != null
    ? Number(data.retryAfterSec)
    : retryAfterHeader
      ? Number(retryAfterHeader)
      : undefined
  return {
    ok: res.ok && !data.error,
    status: res.status,
    data,
    transport: 'api',
    retryAfterSec: Number.isFinite(retryAfterSec) ? retryAfterSec : undefined,
  }
}

export async function getLcTransport(): Promise<LcTransport> {
  return 'api'
}

export function invalidateLcTransportCache() {
  /* no-op: API-only transport */
}

export async function lcGraphql(body: Record<string, unknown>): Promise<JsonResult> {
  return viaApi('/api/leetcode', body)
}

export async function lcRunTest(body: Record<string, unknown>): Promise<JsonResult> {
  return viaApi('/api/leetcode/test', body)
}

export async function lcSubmit(body: Record<string, unknown>): Promise<JsonResult> {
  return viaApi('/api/leetcode/submit', body)
}

export async function lcCheck(body: Record<string, unknown>): Promise<JsonResult> {
  return viaApi('/api/leetcode/check', body)
}

export function cloudflareHelp(_transport: LcTransport, _errorMsg?: string): string {
  return ''
}
