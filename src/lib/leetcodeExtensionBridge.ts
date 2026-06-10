type BridgeKind = 'ping' | 'graphql' | 'submit' | 'test' | 'check'

type BridgeRequest = {
  kind: BridgeKind
  body?: unknown
}

type BridgeResponse = {
  ok: boolean
  error?: string
  httpStatus?: number
  bodyText?: string
  pong?: boolean
}

// The content script stamps the extension ID onto the DOM via externally_connectable.
// chrome.runtime is injected by Chrome on permitted origins so the page can call
// sendMessage(extensionId, ...) directly — no postMessage relay needed.
function getExtId(): string | null {
  if (typeof document === 'undefined') return null
  return document.documentElement?.getAttribute('data-lm-ext-id') ?? null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr = (): any => (typeof globalThis !== 'undefined' ? (globalThis as any).chrome?.runtime : undefined)

export function hasLeetMasteryBridge(): boolean {
  return typeof window !== 'undefined' && !!getExtId() && !!cr()
}

export async function extBridgeRequest(kind: BridgeKind, body?: unknown, timeoutMs = 15_000): Promise<BridgeResponse> {
  const extId = getExtId()
  const runtime = cr()
  if (!extId || !runtime) throw new Error('Extension bridge not available.')

  return new Promise<BridgeResponse>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Extension bridge timeout.')), timeoutMs)

    runtime.sendMessage(extId, { kind, body } satisfies BridgeRequest, (resp: BridgeResponse | undefined) => {
      clearTimeout(timer)
      if (runtime.lastError) {
        reject(new Error(String(runtime.lastError.message ?? runtime.lastError)))
        return
      }
      resolve(resp ?? { ok: false, error: 'Empty response from extension.' })
    })
  })
}

let _bridgeOk: boolean | null = null
let _bridgeAt = 0
const HEALTHY_TTL = 30_000
const FAIL_TTL    = 10_000

export function invalidateBridgeCache() { _bridgeOk = null }

export async function extBridgeHealthy(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const now = Date.now()
  if (_bridgeOk === true  && now - _bridgeAt < HEALTHY_TTL) return true
  if (_bridgeOk === false && now - _bridgeAt < FAIL_TTL)    return false
  try {
    const r = await extBridgeRequest('ping', undefined, 3_000)
    _bridgeOk = !!r.ok
    _bridgeAt = now
    return !!r.ok
  } catch {
    _bridgeOk = false
    _bridgeAt = now
    return false
  }
}
