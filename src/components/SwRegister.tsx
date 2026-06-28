'use client'
import { useEffect } from 'react'
import { OFFLINE_PAGES } from '@/lib/offlinePages'

function cacheOfflinePages(registration: ServiceWorkerRegistration) {
  const worker = registration.active || registration.waiting || registration.installing
  if (!worker) return
  worker.postMessage({ type: 'CACHE_PAGES', pages: [...OFFLINE_PAGES] })
}

function activateWaitingWorker(reg: ServiceWorkerRegistration) {
  const waiting = reg.waiting
  if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' })
}

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let reloading = false
    const onControllerChange = () => {
      if (reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(async reg => {
        await reg.update()
        activateWaitingWorker(reg)
        if (navigator.onLine) cacheOfflinePages(reg)
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed') activateWaitingWorker(reg)
            if (next.state === 'activated' && navigator.onLine) cacheOfflinePages(reg)
          })
        })
      })
      .catch(() => {})

    const onOnline = () => {
      navigator.serviceWorker.ready
        .then(reg => {
          activateWaitingWorker(reg)
          cacheOfflinePages(reg)
        })
        .catch(() => {})
    }
    window.addEventListener('online', onOnline)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  return null
}
