'use client'
import { useEffect } from 'react'
import { OFFLINE_PAGES } from '@/lib/offlinePages'

function cacheOfflinePages(registration: ServiceWorkerRegistration) {
  const worker = registration.active || registration.waiting || registration.installing
  if (!worker) return
  worker.postMessage({ type: 'CACHE_PAGES', pages: [...OFFLINE_PAGES] })
}

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // When a new SW takes over (skipWaiting already fires in install),
    // reload so the page picks up the latest HTML/JS.
    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        void reg.update()
        if (navigator.onLine) cacheOfflinePages(reg)
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          next?.addEventListener('statechange', () => {
            if (next.state === 'activated' && navigator.onLine) cacheOfflinePages(reg)
          })
        })
      })
      .catch(() => {})

    const onOnline = () => {
      navigator.serviceWorker.ready.then(cacheOfflinePages).catch(() => {})
    }
    window.addEventListener('online', onOnline)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return null
}
