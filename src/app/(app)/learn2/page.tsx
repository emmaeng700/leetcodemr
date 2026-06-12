'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BookOpen, RefreshCw } from 'lucide-react'
import { getSetCycleState, clampSetCycleIdx } from '@/lib/setProgress'
import SetCyclesPage from '@/components/SetCyclesPage'

const TABS = [
  { key: 'questions', label: 'Questions', icon: BookOpen  },
  { key: 'cycles',    label: 'Cycles',    icon: RefreshCw },
]

function Learn2Hub() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get('tab') ?? 'questions'

  useEffect(() => {
    if (tab !== 'questions') return
    let idx = 0
    try {
      const state = getSetCycleState(2)
      if (state?.cycleRange) {
        const isFresh = (state.cycleReps ?? 0) === 0 && (state.cyclePos ?? 0) === 0 && (state.cycleAccepted?.length ?? 0) === 0
        idx = isFresh ? state.cycleRange.start : clampSetCycleIdx(state.cycleIdx, state.cycleRange)
      } else {
        const saved = parseInt(localStorage.getItem('lm_learn2_idx') ?? '0', 10)
        if (Number.isFinite(saved)) idx = saved
      }
    } catch {}
    router.replace(`/learn2/${Math.max(0, idx)}`)
  }, [tab, router])

  if (tab === 'questions') return null

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => router.replace(`/learn2?tab=${key}`, { scroll: false })}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              tab === key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
            }`}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'cycles' && <SetCyclesPage set={2} />}
      </div>
    </div>
  )
}

export default function Learn2Page() {
  return <Suspense><Learn2Hub /></Suspense>
}
