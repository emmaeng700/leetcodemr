type BridgeKind = 'ping' | 'graphql' | 'submit' | 'test' | 'check'

type BridgeRequest = {
  __lm_lc_bridge__: true
  direction: 'page->ext'
  id: string
  kind: BridgeKind
  body?: any
}

type BridgeResponse = {
  __lm_lc_bridge__: true
  direction: 'ext->page'
  id: string
  ok: boolean
  error?: string
  httpStatus?: number
  bodyText?: string
}

function uuid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

export async function extBridgeRequest(kind: BridgeKind, body?: any, timeoutMs = 15_000): Promise<BridgeResponse> {
  if (typeof window === 'undefined') {
    throw new Error('Bridge only available in browser.')
  }

  const id = uuid()
  const req: BridgeRequest = { __lm_lc_bridge__: true, direction: 'page->ext', id, kind, body }

  return await new Promise<BridgeResponse>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMsg)
      reject(new Error('Extension bridge timeout.'))
    }, timeoutMs)

    function onMsg(e: MessageEvent) {
      const data = e.data as BridgeResponse
      if (!data || data.__lm_lc_bridge__ !== true) return
      if (data.direction !== 'ext->page') return
      if (data.id !== id) return
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMsg)
      resolve(data)
    }

    window.addEventListener('message', onMsg)
    window.postMessage(req, '*')
  })
}

// Positive TTL: trust a healthy bridge for 30s without re-pinging.
// Negative TTL: don't hammer the timeout on every submit when no extension is present.
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
