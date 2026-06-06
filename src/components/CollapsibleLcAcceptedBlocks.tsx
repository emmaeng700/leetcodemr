'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Loader2, Star } from 'lucide-react'
import { labelForLang } from '@/lib/bestAnswersMerge'
import type { LeetCodeAcceptedBlock } from '@/lib/useLeetCodeAcceptedBlocks'

type Props = {
  blocks: LeetCodeAcceptedBlock[]
  loading?: boolean
  resetKey?: string | number
  renderCode: (code: string, lang: string) => ReactNode
  className?: string
}

/** Your LeetCode AC blocks - each language collapsed until clicked. */
export default function CollapsibleLcAcceptedBlocks({
  blocks,
  loading,
  resetKey,
  renderCode,
  className = 'mb-4',
}: Props) {
  const [expandedLangs, setExpandedLangs] = useState<Set<string>>(new Set())

  useEffect(() => {
    setExpandedLangs(new Set())
  }, [resetKey])

  if (blocks.length === 0) return null

  const toggleLang = (lang: string) => {
    setExpandedLangs(prev => {
      const next = new Set(prev)
      if (next.has(lang)) next.delete(lang)
      else next.add(lang)
      return next
    })
  }

  return (
    <div className={`rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-500/20 bg-amber-600/10">
        <Star size={12} className="text-amber-400 fill-amber-400 shrink-0" />
        <span className="text-xs font-bold text-amber-300">Your LeetCode - most recent accepted</span>
        {loading && <Loader2 size={12} className="animate-spin text-amber-500/70 ml-auto" />}
      </div>
      <div className="p-2 space-y-1">
        {blocks.map(b => {
          const open = expandedLangs.has(b.lang)
          return (
            <div key={b.lang} className="rounded-lg border border-amber-500/15 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleLang(b.lang)}
                style={{ touchAction: 'manipulation' }}
                className="w-full flex items-center gap-2 px-2.5 py-2 text-left bg-amber-600/5 hover:bg-amber-600/10 transition-colors"
                aria-expanded={open}
              >
                {open
                  ? <ChevronDown size={12} className="text-amber-400 shrink-0" />
                  : <ChevronRight size={12} className="text-amber-400 shrink-0" />}
                <span className="text-[11px] font-bold text-amber-300">
                  {'\u2605'} {labelForLang(b.lang)}
                </span>
                <span className="ml-auto text-[10px] font-medium text-amber-500/80">
                  {open ? 'Hide' : 'Show'}
                </span>
              </button>
              {open && (
                <div className="px-2 pb-2 pt-1 border-t border-amber-500/10">
                  {renderCode(b.code, b.lang)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
