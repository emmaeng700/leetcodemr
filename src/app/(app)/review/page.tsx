'use client'
import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Brain, Clock, GitBranch, RefreshCw, Bookmark } from 'lucide-react'
import dynamic from 'next/dynamic'

const ReviewContent      = dynamic(() => import('./ReviewContent'),                    { ssr: false })
const QuickReviewPage    = dynamic(() => import('../quick-review/page'),               { ssr: false })
const PatternReviewPage  = dynamic(() => import('../pattern-review/page'),             { ssr: false })
const SRQueuePage        = dynamic(() => import('../sr-queue/page'),                   { ssr: false })
const BestSolutionsPage  = dynamic(() => import('../best-solutions/page'),             { ssr: false })

const TABS = [
  { key: 'reviews',        label: 'Reviews',        icon: Brain,      Page: ReviewContent     },
  { key: 'quick-review',   label: 'Quick Review',   icon: Clock,      Page: QuickReviewPage   },
  { key: 'pattern-review', label: 'Pattern Review', icon: GitBranch,  Page: PatternReviewPage },
  { key: 'sr-queue',       label: 'SR Queue',       icon: RefreshCw,  Page: SRQueuePage       },
  { key: 'my-best',        label: 'My Best',        icon: Bookmark,   Page: BestSolutionsPage },
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

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewsInner />
    </Suspense>
  )
}
