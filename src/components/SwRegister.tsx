'use client'
import { useEffect } from 'react'
import { cacheGrindOfflineAssets, OFFLINE_PAGES } from '@/lib/offlinePages'

function cacheOfflinePages(registration: ServiceWorkerRegistration) {
  const worker = registration.active || registration.waiting || registration.installing
  if (!worker) return
  worker.postMessage({ type: 'CACHE_PAGES', pages: [...OFFLINE_PAGES] })
  worker.postMessage({ type: 'CACHE_GRIND_ASSETS' })
}

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(reg => {
        void reg.update()
        if (navigator.onLine) {
          cacheOfflinePages(reg)
          void cacheGrindOfflineAssets()
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          next?.addEventListener('statechange', () => {
            if (next.state === 'activated' && navigator.onLine) {
              cacheOfflinePages(reg)
              void cacheGrindOfflineAssets()
            }
          })
        })
      })
      .catch(() => {})

    const onOnline = () => {
      navigator.serviceWorker.ready
        .then(reg => {
          cacheOfflinePages(reg)
          return cacheGrindOfflineAssets()
        })
        .catch(() => {})
    }
    window.addEventListener('online', onOnline)

    return () => window.removeEventListener('online', onOnline)
  }, [])

  return null
}
