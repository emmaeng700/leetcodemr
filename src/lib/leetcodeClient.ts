/**
 * LeetCode Run/Submit/Check/GraphQL - extension bridge first (real browser cookies),
 * then Next.js API routes with the user's pasted session.
 */

import { extBridgeHealthy, extBridgeRequest, invalidateBridgeCache } from './leetcodeExtensionBridge'

export type LcTransport = 'extension' | 'api'

let _route: LcTransport | null = null
let _routeAt = 0
const ROUTE_TTL = 20_000

export function invalidateLcTransportCache() {
  _route = null
  invalidateBridgeCache()
}

async function pickTransport(): Promise<LcTransport> {
  const now = Date.now()
  if (_route && now - _routeAt < ROUTE_TTL) return _route
  if (await extBridgeHealthy()) {
    _route = 'extension'
    _routeAt = now
    return _route
  }
  _route = 'api'
  _routeAt = now
  return _route
}

export async function getLcTransport(): Promise<LcTransport> {
  return pickTransport()
}

type JsonResult = {
  ok: boolean
  status: number
  data: Record<string, unknown>
  transport: LcTransport
  retryAfterSec?: number
}

function parseBridgeBody(bodyText: string | undefined): Record<string, unknown> {
  if (!bodyText) return {}
  try {
    return JSON.parse(bodyText) as Record<string, unknown>
  } catch {
    return { error: 'Invalid JSON from LeetCode bridge.' }
  }
}

function isCloudflareBlock(data: Record<string, unknown>, status: number): boolean {
  const err = String(data.error ?? '')
  return status === 403 || status === 502 || /cloudflare|non_json_html|HTML/i.test(err)
}

async function viaExtension(kind: 'graphql' | 'test' | 'submit' | 'check', body: unknown): Promise<JsonResult> {
  const r = await extBridgeRequest(kind, body)
  const data = r.ok ? parseBridgeBody(r.bodyText) : { error: r.error ?? 'Extension bridge failed.' }
  return {
    ok: !!r.ok && !data.error,
    status: r.httpStatus ?? (r.ok ? 200 : 502),
    data,
    transport: 'extension',
  }
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

async function withExtensionFallback(
  kind: 'graphql' | 'test' | 'submit' | 'check',
  apiPath: string,
  body: unknown,
): Promise<JsonResult> {
  const transport = await pickTransport()
  if (transport === 'extension') return viaExtension(kind, body)

  const api = await viaApi(apiPath, body)
  if (api.ok || !isCloudflareBlock(api.data, api.status)) return api

  invalidateLcTransportCache()
  if (await extBridgeHealthy()) return viaExtension(kind, body)
  return api
}

export async function lcGraphql(body: Record<string, unknown>): Promise<JsonResult> {
  return withExtensionFallback('graphql', '/api/leetcode', body)
}

export async function lcRunTest(body: Record<string, unknown>): Promise<JsonResult> {
  return withExtensionFallback('test', '/api/leetcode/test', body)
}

export async function lcSubmit(body: Record<string, unknown>): Promise<JsonResult> {
  return withExtensionFallback('submit', '/api/leetcode/submit', body)
}

export async function lcCheck(body: Record<string, unknown>): Promise<JsonResult> {
  return withExtensionFallback('check', '/api/leetcode/check', body)
}

export function cloudflareHelp(transport: LcTransport): string {
  if (transport !== 'api') return ''
  return (
    ' Paste the full Cookie header from leetcode.com (must include cf_clearance), ' +
    'or load the LeetMastery Chrome extension (extension/ folder) while logged into LeetCode.'
  )
}
