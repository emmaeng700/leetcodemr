'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Wifi, WifiOff, X } from 'lucide-react'
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

  const grindHref = questionId ? `/grind?id=${questionId}` : '/grind'

  if (online && showBackOnline) {
    return (
      <div className="rounded-xl border border-green-300/60 bg-green-50 dark:bg-green-950/40 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Wifi size={16} className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">You are back online</p>
            <p className="text-[11px] text-green-700/90 dark:text-green-300/80">
              Drafts sync to your account. Visit other pages in the app below.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <Link
            href="/daily"
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-green-600 text-white hover:bg-green-700"
          >
            Daily
          </Link>
          <Link
            href="/questions"
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--bg-card)] border border-green-300/50 text-green-800 dark:text-green-200"
          >
            Questions
          </Link>
          <Link
            href={grindHref}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--bg-card)] border border-green-300/50 text-green-800 dark:text-green-200"
          >
            Full Grind
          </Link>
          <button
            type="button"
            onClick={() => setShowBackOnline(false)}
            className="p-1 rounded-md text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  if (!online) {
    return (
      <div className="rounded-xl border border-orange-300/50 bg-orange-50 dark:bg-orange-950/30 px-3 py-2 flex items-center gap-2 shrink-0">
        <WifiOff size={15} className="text-orange-600 dark:text-orange-400 shrink-0" />
        <p className="text-[11px] text-orange-800 dark:text-orange-200">
          Offline - code saves on this device. Reconnect to sync and browse other pages.
        </p>
      </div>
    )
  }

  return null
}
