'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Rocket, Zap, Library } from 'lucide-react'
import dynamic from 'next/dynamic'

const NeetCodePage = dynamic(() => import('../neetcode/page'),     { ssr: false })
const LeetCodePage = dynamic(() => import('../leetcode-api/page'), { ssr: false })
const AnswersPage  = dynamic(() => import('../answers/page'),      { ssr: false })

const TABS = [
  { key: 'neetcode',    label: 'NeetCode 150', icon: Rocket,  Page: NeetCodePage },
  { key: 'leetcode',    label: 'LeetCode',     icon: Zap,     Page: LeetCodePage },
  { key: 'answers',     label: 'Answers',      icon: Library, Page: AnswersPage  },
]

function SitesInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [active, setActive] = useState(searchParams.get('tab') ?? 'neetcode')

  const go = (key: string) => {
    setActive(key)
    router.replace(`/sites?tab=${key}`, { scroll: false })
  }

  const current = TABS.find(t => t.key === active) ?? TABS[0]

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => go(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
              active === key
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
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
