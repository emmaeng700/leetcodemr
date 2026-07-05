'use client'

import { useEffect, useState } from 'react'
import { Wifi, Download, CheckCircle2, Loader2 } from 'lucide-react'
import {
  isOfflineWarmupComplete,
  markOfflineWarmupComplete,
  runOfflineWarmup,
  type WarmupProgress,
} from '@/lib/offlineWarmup'

export default function OfflineWarmupGate({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState<WarmupProgress | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const isLocalDev =
      process.env.NODE_ENV === 'development' ||
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.local')
    if (isLocalDev) {
      markOfflineWarmupComplete('dev-skip')
      return
    }

    if (isOfflineWarmupComplete()) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      markOfflineWarmupComplete('skipped-offline')
      return
    }

    let cancelled = false
    setActive(true)

    runOfflineWarmup(p => {
      if (!cancelled) setProgress(p)
    })
      .then(() => {
        if (!cancelled) {
          setTimeout(() => setActive(false), 600)
        }
      })
      .catch(() => {
        if (!cancelled) {
          markOfflineWarmupComplete('partial')
          setFailed(true)
          setTimeout(() => setActive(false), 1200)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0

  return (
    <>
      {children}
      {active && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--bg)]/95 backdrop-blur-sm px-5"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                {progress?.phase === 'done' ? (
                  <CheckCircle2 size={20} className="text-green-600" />
                ) : (
                  <Download size={20} className="text-indigo-600" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[var(--text)] leading-tight">
                  {progress?.phase === 'done'
                    ? 'Ready for offline'
                    : 'Preparing offline mode'}
                </h2>
                <p className="text-[11px] text-[var(--text-subtle)] mt-0.5">
                  Runs once - Grind, search, and starters work without internet after this.
                </p>
              </div>
            </div>

            <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex items-start gap-2 min-h-[2.5rem]">
              {progress?.phase !== 'done' && !failed && (
                <Loader2 size={14} className="text-indigo-500 animate-spin shrink-0 mt-0.5" />
              )}
              <p className="text-xs text-[var(--text-muted)] leading-snug">
                {failed
                  ? 'Some items could not download - you can still use the app online.'
                  : progress?.label ?? 'Starting...'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[var(--border-soft)]">
              <Wifi size={12} className="text-[var(--text-subtle)]" />
              <span className="text-[10px] text-[var(--text-subtle)]">
                {pct}% - keep the app open until this finishes
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
