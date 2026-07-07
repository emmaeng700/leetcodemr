'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const WAS_OFFLINE_KEY = 'lm_grind_was_offline'

function readWasOffline(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(WAS_OFFLINE_KEY) === '1' || !navigator.onLine
  } catch {
    return !navigator.onLine
  }
}

function writeWasOffline(value: boolean) {
  try {
    if (value) sessionStorage.setItem(WAS_OFFLINE_KEY, '1')
    else sessionStorage.removeItem(WAS_OFFLINE_KEY)
  } catch {
    /* ignore */
  }
}

export default function GrindConnectivityBanner() {
  const online = useOnlineStatus()
  const sp = useSearchParams()
  const questionId = Number(sp.get('id') || '0') || undefined
  const wasOfflineRef = useRef(false)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    wasOfflineRef.current = readWasOffline()
    if (!online) {
      wasOfflineRef.current = true
      writeWasOffline(true)
      setShowBackOnline(false)
      return
    }
    if (wasOfflineRef.current) {
      setShowBackOnline(true)
    }
  }, [online])

  if (online && showBackOnline) {
    return (
      <div className="grind-online-banner">
        <p>
          <strong>You&apos;re back online.</strong> Drafts can sync. Tap below to visit other pages in the app.
        </p>
        <div className="grind-banner-actions">
          <Link href="/daily" className="grind-chip grind-chip-primary">
            Daily
          </Link>
          <Link href="/questions" className="grind-chip">
            Questions
          </Link>
          <Link href={questionId ? `/grind?id=${questionId}` : '/grind'} className="grind-chip">
            Full Grind
          </Link>
          <button
            type="button"
            className="grind-chip"
            onClick={() => {
              setShowBackOnline(false)
              writeWasOffline(false)
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    )
  }

  if (!online) {
    return (
      <div className="grind-offline-banner">
        Offline - code saves on this device. Reconnect to sync and browse other pages.
      </div>
    )
  }

  return null
}
