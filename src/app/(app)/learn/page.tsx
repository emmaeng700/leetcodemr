'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BookOpen, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'
import { clampCycleIdx, getCycleState } from '@/lib/db'
import { getSetCycleState, clampSetCycleIdx } from '@/lib/setProgress'
import { parseLearnSet, learnHubHref, type LearnSet } from '@/lib/learnNav'
import LearnSetTabs from '@/components/LearnSetTabs'

const CyclesPage = dynamic(() => import('../cycles/page'), { ssr: false })
const SetCyclesPage = dynamic(() => import('@/components/SetCyclesPage'), { ssr: false })

const SUB_TABS = [
  { key: 'questions' as const, label: 'Questions', icon: BookOpen },
  { key: 'cycles' as const, label: 'Cycles', icon: RefreshCw },
]

function resolveQuestionIndex(set: LearnSet): number {
  if (set === 1) {
    let idx = 0
    try {
      const saved = parseInt(localStorage.getItem('lm_learn_idx') ?? '0', 10)
      idx = Number.isFinite(saved) ? saved : 0
    } catch {}
    return Math.max(0, idx)
  }
  if (set === 2) {
    try {
      const state = getSetCycleState(2)
      if (state?.cycleRange) {
        const isFresh = (state.cycleReps ?? 0) === 0
          && (state.cyclePos ?? 0) === 0
          && (state.cycleAccepted?.length ?? 0) === 0
        return Math.max(0, isFresh ? state.cycleRange.start : clampSetCycleIdx(state.cycleIdx, state.cycleRange))
      }
      const saved = parseInt(localStorage.getItem('lm_learn2_idx') ?? '0', 10)
      return Math.max(0, Number.isFinite(saved) ? saved : 0)
    } catch {
      return 0
    }
  }
  try {
    const state = getSetCycleState(3)
    if (state?.cycleRange) {
      const isFresh = (state.cycleReps ?? 0) === 0
        && (state.cyclePos ?? 0) === 0
        && (state.cycleAccepted?.length ?? 0) === 0
      return Math.max(0, isFresh ? state.cycleRange.start : clampSetCycleIdx(state.cycleIdx, state.cycleRange))
    }
    const saved = parseInt(localStorage.getItem('lm_learn3_idx') ?? '0', 10)
    return Math.max(0, Number.isFinite(saved) ? saved : 0)
  } catch {
    return 0
  }
}

function questionPath(set: LearnSet, idx: number): string {
  if (set === 2) return `/learn2/${idx}`
  if (set === 3) return `/learn3/${idx}`
  return `/learn/${idx}`
}

function LearnHub() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const set = parseLearnSet(searchParams.get('set'))
  const tab = searchParams.get('tab') === 'cycles' ? 'cycles' : 'questions'

  useEffect(() => {
    if (tab !== 'questions') return
    let cancelled = false
    ;(async () => {
      let idx = resolveQuestionIndex(set)
      if (set === 1) {
        try {
          const state = await getCycleState()
          if (!cancelled && state?.cycleRange) {
            const isFresh = (state.cycleReps ?? 0) === 0
              && (state.cyclePos ?? 0) === 0
              && (state.cycleAccepted?.length ?? 0) === 0
            const fallback = idx
            idx = isFresh
              ? state.cycleRange.start
              : clampCycleIdx(state.cycleIdx ?? fallback, state.cycleRange)
          }
        } catch {}
      }
      if (!cancelled) router.replace(questionPath(set, Math.max(0, idx)))
    })()
    return () => { cancelled = true }
  }, [set, tab, router])

  if (tab === 'questions') return null

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      <LearnSetTabs activeSet={set} hubTab={tab} />
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => router.replace(learnHubHref(set, key), { scroll: false })}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              tab === key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {set === 1 && tab === 'cycles' && <CyclesPage />}
        {set === 2 && tab === 'cycles' && <SetCyclesPage set={2} />}
        {set === 3 && tab === 'cycles' && <SetCyclesPage set={3} />}
      </div>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense>
      <LearnHub />
    </Suspense>
  )
}
