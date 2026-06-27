'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Brain, Clock, GitBranch, RefreshCw, Bookmark } from 'lucide-react'
import dynamic from 'next/dynamic'
import SetReviewPage from '@/components/SetReviewPage'

const ReviewContent      = dynamic(() => import('./ReviewContent'),                    { ssr: false })
const QuickReviewPage    = dynamic(() => import('../quick-review/page'),               { ssr: false })
const PatternReviewPage  = dynamic(() => import('../pattern-review/PatternReviewContent'), { ssr: false })
const SRQueuePage        = dynamic(() => import('../sr-queue/page'),                   { ssr: false })
const BestSolutionsContent = dynamic(() => import('@/components/BestSolutionsContent'), { ssr: false })

function MyBestWithSets() {
  const [set, setSet] = useState<1 | 2 | 3>(1)
  const LABELS: Record<number, string> = { 1: 'Set 1 · 331 Qs', 2: 'Set 2 · NC250', 3: 'Set 3 · AM600' }
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex gap-1.5 px-4 pt-3 pb-1 shrink-0 border-b border-[var(--border)]">
        {([1, 2, 3] as const).map(s => (
          <button key={s} onClick={() => setSet(s)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              set === s
                ? 'bg-amber-500 text-white'
                : 'text-[var(--text-subtle)] hover:text-[var(--text)] bg-[var(--bg-card)] border border-[var(--border)]'
            }`}>
            {LABELS[s]}
          </button>
        ))}
      </div>
      <BestSolutionsContent set={set} />
    </div>
  )
}

const TABS = [
  { key: 'reviews',        label: 'Reviews',        icon: Brain,      Page: () => <ReviewContent />     },
  { key: 'my-best',        label: 'My Best',        icon: Bookmark,   Page: () => <MyBestWithSets />    },
  { key: 'quick-review',   label: 'Quick Review',   icon: Clock,      Page: () => <QuickReviewPage />   },
  { key: 'pattern-review', label: 'Pattern Review', icon: GitBranch,  Page: () => <PatternReviewPage /> },
  { key: 'sr-queue',       label: 'SR Queue',       icon: RefreshCw,  Page: () => <SRQueuePage />       },
  { key: 'sr-set2',        label: 'SR Set 2',       icon: RefreshCw,  Page: () => <SetReviewPage set={2} /> },
  { key: 'sr-set3',        label: 'SR Set 3',       icon: RefreshCw,  Page: () => <SetReviewPage set={3} /> },
]

function ReviewsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [active, setActive] = useState(searchParams.get('tab') ?? 'reviews')

  const go = (key: string) => {
    setActive(key)
    router.replace(`/review?tab=${key}`, { scroll: false })
  }

  const current = TABS.find(t => t.key === active) ?? TABS[0]

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">
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
      <div
        className={`flex-1 min-h-0 ${
          active === 'pattern-review' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
        }`}
      >
        <current.Page />
      </div>
    </div>
  )
}

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewsInner />
    </Suspense>
  )
}
