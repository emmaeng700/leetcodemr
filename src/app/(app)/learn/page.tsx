'use client'
import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { BookOpen, RefreshCw } from 'lucide-react'
import dynamic from 'next/dynamic'

const CyclesPage = dynamic(() => import('../cycles/page'), { ssr: false })

const TABS = [
  { key: 'questions', label: 'Questions', icon: BookOpen  },
  { key: 'cycles',    label: 'Cycles',    icon: RefreshCw },
]

function LearnHub() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const tab = searchParams.get('tab') ?? 'questions'

  // "questions" tab → restore last-visited question and navigate into the learn flow
  useEffect(() => {
    if (tab !== 'questions') return
    try {
      const saved = parseInt(localStorage.getItem('lm_learn_idx') ?? '0', 10)
      const idx   = Number.isFinite(saved) && saved > 0 ? saved : 0
      router.replace(`/learn/${idx}`)
    } catch {
      router.replace('/learn/0')
    }
  }, [tab, router])

  // While "questions" tab is active the redirect is in flight — show nothing
  if (tab === 'questions') return null

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => router.replace(`/learn?tab=${key}`, { scroll: false })}
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
        {tab === 'cycles' && <CyclesPage />}
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
