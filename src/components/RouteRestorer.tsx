'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  currentAppRoute,
  isDefaultLandingRoute,
  readLastAppRoute,
  writeLastAppRoute,
} from '@/lib/lastAppRoute'

function isColdDocumentLoad(): boolean {
  if (typeof window === 'undefined') return false
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return nav?.type === 'reload' || nav?.type === 'navigate'
}

/**
 * Saves the current route while navigating and restores it when the PWA
 * cold-starts on the default /grind landing page (common on mobile).
 */
export default function RouteRestorer() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const restoreAttemptedRef = useRef(false)

  useEffect(() => {
    const current = currentAppRoute()

    if (!restoreAttemptedRef.current) {
      restoreAttemptedRef.current = true
      const saved = readLastAppRoute()
      if (
        isColdDocumentLoad()
        && isDefaultLandingRoute(pathname)
        && saved
        && saved !== current
      ) {
        router.replace(saved)
        return
      }
    }

    writeLastAppRoute(current)
  }, [pathname, search, router])

  useEffect(() => {
    const save = () => writeLastAppRoute(currentAppRoute())
    const onHide = () => {
      if (document.visibilityState === 'hidden') save()
    }
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [pathname, search])

  return null
}
