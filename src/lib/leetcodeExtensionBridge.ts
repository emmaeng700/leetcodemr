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

export function hasLeetMasteryBridge(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    document.documentElement?.getAttribute('data-lm-bridge') === 'true'
  )
}

export async function extBridgeRequest(kind: BridgeKind, body?: any): Promise<BridgeResponse> {
  if (typeof window === 'undefined') {
    throw new Error('Bridge only available in browser.')
  }

  const id = uuid()
  const req: BridgeRequest = { __lm_lc_bridge__: true, direction: 'page->ext', id, kind, body }

  return await new Promise<BridgeResponse>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMsg)
      reject(new Error('Extension bridge timeout.'))
    }, 5000)

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

let _bridgeOk: boolean | null = null
let _bridgeAt = 0
const BRIDGE_TTL = 30_000

export async function extBridgeHealthy(): Promise<boolean> {
  if (!hasLeetMasteryBridge()) return false
  const now = Date.now()
  // Use cached result so a warm-up ping (e.g. from the session effect) benefits
  // subsequent lcFetch calls without re-pinging the service worker every time.
  if (_bridgeOk === true && now - _bridgeAt < BRIDGE_TTL) return true
  try {
    const r = await extBridgeRequest('ping')
    if (r.ok) { _bridgeOk = true; _bridgeAt = now }
    return !!r.ok
  } catch {
    // Don't cache failures — let the next call retry.
    return false
  }
}

