/**
 * LeetCode Run/Submit/Check/GraphQL - extension bridge first (real browser cookies),
 * then Next.js API routes with the user's pasted session.
 */

import { extBridgeHealthy, extBridgeRequest, invalidateBridgeCache } from './leetcodeExtensionBridge'
import { hasCfClearance } from './leetcodeHttp'

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

function sessionFromBody(body: unknown): string {
  if (!body || typeof body !== 'object') return ''
  const b = body as Record<string, unknown>
  return String(b.session ?? '')
}

const NO_CF_ERROR =
  'Run/Submit cannot use a pasted session token alone (Cloudflare blocks the server). ' +
  'Install the LeetMastery Chrome extension: chrome://extensions → Developer mode → Load unpacked → select the extension/ folder in this repo. ' +
  'Stay logged into leetcode.com in Chrome, then retry Run.'

async function withExtensionFallback(
  kind: 'graphql' | 'test' | 'submit' | 'check',
  apiPath: string,
  body: unknown,
): Promise<JsonResult> {
  const isRunSubmit = kind === 'test' || kind === 'submit' || kind === 'check'
  const sess = sessionFromBody(body)
  const hasCf = hasCfClearance(sess)

  // Extension uses real browser cookies (incl. cf_clearance) — always try first for Run/Submit.
  if (isRunSubmit) invalidateLcTransportCache()
  if (await extBridgeHealthy()) {
    const ext = await viaExtension(kind, body)
    if (ext.ok || !isCloudflareBlock(ext.data, ext.status)) return ext
  }

  // Session token without cf_clearance cannot work through Vercel/localhost API.
  if (isRunSubmit && sess && !hasCf) {
    return {
      ok: false,
      status: 403,
      data: { error: NO_CF_ERROR },
      transport: 'api',
    }
  }

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

export function cloudflareHelp(transport: LcTransport, errorMsg?: string): string {
  if (transport !== 'api') return ''
  const err = String(errorMsg ?? '')
  if (/extension|cf_clearance|Cloudflare/i.test(err)) return ''
  return ' Install the LeetMastery Chrome extension, or paste the full Cookie header with cf_clearance.'
}
