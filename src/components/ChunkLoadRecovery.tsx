'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'lm-chunk-reload'

/** Recover from stale Turbopack/Next chunks (often after SW or HMR mismatch). */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    const reloadOnce = () => {
      if (typeof sessionStorage === 'undefined') {
        window.location.reload()
        return
      }
      if (sessionStorage.getItem(RELOAD_KEY)) return
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
      const msg = String(event.message ?? '')
      if (/ChunkLoadError|Loading chunk .* failed/i.test(msg)) {
        reloadOnce()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event.reason?.message ?? event.reason ?? '')
      if (/ChunkLoadError|Loading chunk .* failed/i.test(reason)) {
        reloadOnce()
      }
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    sessionStorage.removeItem(RELOAD_KEY)

    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
