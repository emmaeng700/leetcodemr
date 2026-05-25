'use client'
import { useEffect } from 'react'

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

    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        // Force a network check every time the app loads.
        // Critical for iOS PWA — Safari doesn't poll aggressively on its own.
        void reg.update()
      })
      .catch(() => {})

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
