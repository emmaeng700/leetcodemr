'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

type Props = {
  questionId?: number
}

export default function GrindConnectivityBanner({ questionId }: Props) {
  const online = useOnlineStatus()
  const wasOfflineRef = useRef(false)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    if (!online) {
      wasOfflineRef.current = true
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
          <Link href="/daily" className="grind-chip grind-chip-primary">Daily</Link>
          <Link href="/questions" className="grind-chip">Questions</Link>
          <Link href={questionId ? `/grind?id=${questionId}` : '/grind'} className="grind-chip">Full Grind</Link>
          <button type="button" className="grind-chip" onClick={() => setShowBackOnline(false)}>Dismiss</button>
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
