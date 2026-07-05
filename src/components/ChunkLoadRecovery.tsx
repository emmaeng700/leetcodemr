'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'lm-chunk-reload'
const MAX_RELOADS = 3

function isChunkLoadFailure(raw: string): boolean {
  return /ChunkLoadError|Failed to load chunk|Loading chunk .* failed|\/_next\/static\/chunks\//i.test(raw)
}

/** Recover from stale Turbopack/Next chunks (often after SW or HMR mismatch). */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    const reloadOnce = () => {
      if (typeof sessionStorage === 'undefined') {
        window.location.reload()
        return
      }
      const count = Number(sessionStorage.getItem(RELOAD_KEY) || '0')
      if (count >= MAX_RELOADS) return
      sessionStorage.setItem(RELOAD_KEY, String(count + 1))
      const url = new URL(window.location.href)
      url.searchParams.set('_cr', String(Date.now()))
      window.location.replace(url.toString())
    }

    const onError = (event: ErrorEvent) => {
      const msg = String(event.message ?? event.error?.message ?? '')
      if (isChunkLoadFailure(msg)) reloadOnce()
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const msg = String(
        (reason && typeof reason === 'object' && 'message' in reason ? reason.message : reason) ?? '',
      )
      if (isChunkLoadFailure(msg)) reloadOnce()
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)

    const resetTimer = window.setTimeout(() => {
      sessionStorage.removeItem(RELOAD_KEY)
    }, 5000)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      window.clearTimeout(resetTimer)
    }
  }, [])

  return null
}
