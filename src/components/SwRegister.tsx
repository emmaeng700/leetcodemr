'use client'
import { useEffect } from 'react'
import { cacheGrindOfflineAssets, OFFLINE_PAGES } from '@/lib/offlinePages'

function cacheOfflinePages(registration: ServiceWorkerRegistration) {
  const worker = registration.active || registration.waiting || registration.installing
  if (!worker) return
  worker.postMessage({ type: 'CACHE_PAGES', pages: [...OFFLINE_PAGES] })
  worker.postMessage({ type: 'CACHE_GRIND_ASSETS' })
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
        if (navigator.onLine) {
          cacheOfflinePages(reg)
          await cacheGrindOfflineAssets()
        }
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          next?.addEventListener('statechange', () => {
            if (next.state === 'installed') activateWaitingWorker(reg)
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
        .then(async reg => {
          activateWaitingWorker(reg)
          cacheOfflinePages(reg)
          await cacheGrindOfflineAssets()
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
