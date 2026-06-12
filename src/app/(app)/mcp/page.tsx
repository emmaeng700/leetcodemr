'use client'
import { useState, useEffect, Suspense, type ComponentType } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Timer, GitBranch, ClipboardList } from 'lucide-react'
import dynamic from 'next/dynamic'
import { MCP_TAB_KEYS, type McpTab } from '@/lib/mcpNav'

const MockPage = dynamic(() => import('../mock/page'), { ssr: false })
const PatternsPage = dynamic(() => import('../patterns/page'), { ssr: false })
const ClipboardPage = dynamic(() => import('../clipboard/page'), { ssr: false })

const TABS = [
  { key: 'mock' as const, label: 'Mock', icon: Timer },
  { key: 'patterns' as const, label: 'Patterns', icon: GitBranch },
  { key: 'clipboard' as const, label: 'Clipboard', icon: ClipboardList },
]

const PAGE_BY_TAB: Record<McpTab, ComponentType> = {
  mock: MockPage,
  patterns: PatternsPage,
  clipboard: ClipboardPage,
}

function McpInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initial = searchParams.get('tab')
  const [active, setActive] = useState<McpTab>(
    MCP_TAB_KEYS.includes(initial as McpTab) ? (initial as McpTab) : 'mock',
  )

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && MCP_TAB_KEYS.includes(t as McpTab)) setActive(t as McpTab)
  }, [searchParams])

  const go = (key: McpTab) => {
    setActive(key)
    const extra = new URLSearchParams(searchParams.toString())
    extra.set('tab', key)
    if (key !== 'patterns' && key !== 'mock') extra.delete('set')
    router.replace(`/mcp?${extra}`, { scroll: false })
  }

  const Page = PAGE_BY_TAB[active]

  return (
    <div className="flex flex-col min-h-[calc(100dvh-56px)]">
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
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
      <div className="flex-1 min-h-0 overflow-auto">
        <Page />
      </div>
    </div>
  )
}

export default function McpPage() {
  return (
    <Suspense fallback={
      <div className="text-center py-32 text-[var(--text-subtle)] animate-pulse text-sm">Loading...</div>
    }>
      <McpInner />
    </Suspense>
  )
}
