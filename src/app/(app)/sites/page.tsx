'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Rocket, Zap, Library, Brain } from 'lucide-react'
import dynamic from 'next/dynamic'
import {
  NC150_TOTAL, AM600_TOTAL,
  countNc150NotInSet1, countAm600NotInSet1,
  getSet2Questions, getSet3Questions, totalAppQuestionCount,
} from '@/lib/questionSets'

const NeetCodePage   = dynamic(() => import('../neetcode/page'),     { ssr: false })
const AlgoMasterPage = dynamic(() => import('../algomaster/page'),   { ssr: false })
const LeetCodePage   = dynamic(() => import('../leetcode-api/page'), { ssr: false })
const AnswersPage    = dynamic(() => import('../answers/page'),      { ssr: false })

function SitesInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [active, setActive] = useState(searchParams.get('tab') ?? 'neetcode')
  const [appTotal, setAppTotal] = useState(0)
  const [ncNotIn331, setNcNotIn331] = useState(0)
  const [amNotIn331, setAmNotIn331] = useState(0)
  const [set2Count, setSet2Count] = useState(0)
  const [set3Count, setSet3Count] = useState(0)

  useEffect(() => {
    fetch('/questions_full.json')
      .then(r => r.json())
      .then((main: { id: number }[]) => {
        const mainIds = new Set(main.map(q => q.id))
        const s2 = getSet2Questions(mainIds, main)
        const s3 = getSet3Questions(mainIds, main)
        setAppTotal(totalAppQuestionCount(main.length, s2.length, s3.length))
        setNcNotIn331(countNc150NotInSet1(mainIds))
        setAmNotIn331(countAm600NotInSet1(mainIds))
        setSet2Count(s2.length)
        setSet3Count(s3.length)
      })
      .catch(() => {})
  }, [])

  const TABS = [
    {
      key: 'neetcode',
      label: 'NeetCode 150',
      sub: ncNotIn331 > 0 ? `${ncNotIn331} not in 331` : null,
      icon: Rocket,
      Page: NeetCodePage,
    },
    {
      key: 'algomaster',
      label: 'AlgoMaster 600',
      sub: amNotIn331 > 0 ? `${amNotIn331} not in 331` : null,
      icon: Brain,
      Page: AlgoMasterPage,
    },
    { key: 'leetcode', label: 'LeetCode', icon: Zap, Page: LeetCodePage, sub: null as string | null },
    { key: 'answers', label: 'Answers', icon: Library, Page: AnswersPage, sub: null as string | null },
  ]

  const go = (key: string) => {
    setActive(key)
    router.replace(`/sites?tab=${key}`, { scroll: false })
  }

  const current = TABS.find(t => t.key === active) ?? TABS[0]

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      {appTotal > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-b border-[var(--border)] bg-indigo-50/50 text-xs text-[var(--text-muted)]">
          <span>
            <span className="font-black text-indigo-600 text-sm tabular-nums">{appTotal}</span>
            {' '}total in app
          </span>
          <span>
            Set 1 <span className="font-bold text-[var(--text)]">{appTotal - set2Count - set3Count}</span>
            · Set 2 <span className="font-bold text-emerald-600">{set2Count}</span>
            · Set 3 <span className="font-bold text-emerald-600">{set3Count}</span>
          </span>
          <span className="text-[var(--text-subtle)]">
            NC150: {NC150_TOTAL} · AM600: {AM600_TOTAL}
          </span>
        </div>
      )}
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {TABS.map(({ key, label, sub, icon: Icon }) => (
          <button
            key={key}
            onClick={() => go(key)}
            className={`flex flex-col items-start gap-0.5 px-4 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              active === key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Icon size={13} />
              {label}
            </span>
            {sub && (
              <span className={`text-[10px] font-bold pl-[1.35rem] ${active === key ? 'text-amber-600' : 'text-amber-500/80'}`}>
                {sub}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <current.Page />
      </div>
    </div>
  )
}

export default function SitesPage() {
  return (
    <Suspense>
      <SitesInner />
    </Suspense>
  )
}
