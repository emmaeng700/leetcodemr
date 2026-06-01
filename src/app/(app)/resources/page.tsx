'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { MessageSquare, Server, Gem, Code2, Download } from 'lucide-react'
import dynamic from 'next/dynamic'

const BehavioralPage   = dynamic(() => import('../behavioral/page'),   { ssr: false })
const SystemDesignPage = dynamic(() => import('../system-design/page'), { ssr: false })
const GemsPage         = dynamic(() => import('../gems/page'),          { ssr: false })
const DsaPage          = dynamic(() => import('../dsa/page'),           { ssr: false })
const DownloadsPage    = dynamic(() => import('../downloads/page'),     { ssr: false })

const TABS = [
  { key: 'behavioral',    label: 'Behavioral',    icon: MessageSquare, Page: BehavioralPage   },
  { key: 'system-design', label: 'System Design', icon: Server,        Page: SystemDesignPage },
  { key: 'gems',          label: 'Gems',          icon: Gem,           Page: GemsPage         },
  { key: 'dsa',           label: 'DSA',           icon: Code2,         Page: DsaPage          },
  { key: 'downloads',     label: 'Downloads',     icon: Download,      Page: DownloadsPage    },
]

function ResourcesInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = searchParams.get('tab') ?? 'behavioral'
  const [active, setActive] = useState(initial)

  const go = (key: string) => {
    setActive(key)
    router.replace(`/resources?tab=${key}`, { scroll: false })
  }

  const current = TABS.find(t => t.key === active) ?? TABS[0]

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      {/* Tab bar */}
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

      {/* Active page content */}
      <div className="flex-1 min-h-0">
        <current.Page />
      </div>
    </div>
  )
}

export default function ResourcesPage() {
  return (
    <Suspense>
      <ResourcesInner />
    </Suspense>
  )
}
