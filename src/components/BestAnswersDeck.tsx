'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, LayoutGrid, Loader2 } from 'lucide-react'

import { BEST_ANSWER_SITES } from '@/components/BestAnswersPanel'

type SiteKey = (typeof BEST_ANSWER_SITES)[number]['key']

type CodeBlock = { code: string; lang: string }
type SiteState = {
  status: 'idle' | 'loading' | 'done' | 'error'
  blocks: CodeBlock[]
  url: string
  error?: string
}

const emptyStates = (): Record<SiteKey, SiteState> => ({
  walkccc:    { status: 'idle', blocks: [], url: '' },
  doocs:      { status: 'idle', blocks: [], url: '' },
  simplyleet: { status: 'idle', blocks: [], url: '' },
  leetcodeca: { status: 'idle', blocks: [], url: '' },
})

export type BestAnswersDeckProps = {
  questionId: number
  slug: string
  active: boolean
  className?: string
}

type DeckCard = {
  siteKey: SiteKey
  siteLabel: string
  siteColor: string
  url: string
  code: string
  lang: string
}

function CodeBlockView({ code }: { code: string }) {
  return (
    <pre className="text-[11px] leading-relaxed bg-[#1e1e2e] text-gray-100 rounded-lg p-3 overflow-x-auto border border-gray-700/40 whitespace-pre">
      <code>{code}</code>
    </pre>
  )
}

export default function BestAnswersDeck({ questionId, slug, active, className = '' }: BestAnswersDeckProps) {
  const [states, setStates] = useState<Record<SiteKey, SiteState>>(emptyStates)
  const [idx, setIdx] = useState(0)

  const fetchSite = useCallback((site: SiteKey, id: number, qslug: string) => {
    setStates(prev => ({ ...prev, [site]: { status: 'loading', blocks: [], url: '' } }))
    fetch(`/api/answers?site=${site}&slug=${encodeURIComponent(qslug)}&id=${id}`)
      .then(r => r.json())
      .then(data =>
        setStates(prev => ({
          ...prev,
          [site]: {
            status: data.error && !data.blocks?.length ? 'error' : 'done',
            blocks: data.blocks ?? [],
            url: data.url ?? '',
            error: data.error,
          },
        })),
      )
      .catch(err =>
        setStates(prev => ({
          ...prev,
          [site]: { status: 'error', blocks: [], url: '', error: String(err) },
        })),
      )
  }, [])

  useEffect(() => {
    if (!active || !slug || !Number.isFinite(questionId) || questionId <= 0) return
    setStates(emptyStates())
    for (const s of BEST_ANSWER_SITES) fetchSite(s.key, questionId, slug)
  }, [active, slug, questionId, fetchSite])

  const deck = useMemo((): DeckCard[] => {
    const cards: DeckCard[] = []
    for (const site of BEST_ANSWER_SITES) {
      const s = states[site.key]
      if (!s || !s.blocks?.length) continue
      for (const b of s.blocks) {
        cards.push({
          siteKey: site.key,
          siteLabel: site.label,
          siteColor: site.color,
          url: s.url,
          code: b.code,
          lang: b.lang,
        })
      }
    }
    cards.sort((a, b) => (a.lang === b.lang ? 0 : a.lang === 'python' ? -1 : 1))
    return cards
  }, [states])

  useEffect(() => {
    setIdx(0)
  }, [questionId, slug])

  useEffect(() => {
    if (idx >= deck.length) setIdx(0)
  }, [deck.length, idx])

  const card = deck[idx]
  const anyLoading = Object.values(states).some(s => s.status === 'loading')

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className="font-semibold text-gray-300">Best answers</span>
          {deck.length > 0 && (
            <span className="font-mono text-[11px] text-gray-500">
              {idx + 1}/{deck.length}
            </span>
          )}
          {anyLoading && <Loader2 size={12} className="animate-spin text-gray-600" />}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIdx(i => (deck.length ? (i - 1 + deck.length) % deck.length : 0))}
            disabled={deck.length <= 1}
            className="p-1.5 rounded-lg border border-gray-700/50 bg-gray-900/40 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-600 transition-colors"
            aria-label="Previous answer"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIdx(i => (deck.length ? (i + 1) % deck.length : 0))}
            disabled={deck.length <= 1}
            className="p-1.5 rounded-lg border border-gray-700/50 bg-gray-900/40 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-600 transition-colors"
            aria-label="Next answer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {!card ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-4 text-xs text-gray-500 flex items-center gap-2">
          {anyLoading ? <Loader2 size={14} className="animate-spin text-gray-600" /> : <LayoutGrid size={14} className="text-gray-600" />}
          <span>{anyLoading ? 'Fetching best answers...' : 'No best answers found yet.'}</span>
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-indigo-500/20 bg-indigo-600/10">
            <div className="text-[11px] text-gray-500">
              <span className={`font-bold ${card.siteColor}`}>{card.siteLabel}</span>
              <span className="mx-2 text-gray-600">-</span>
              <span className="font-semibold text-gray-300">{card.lang === 'cpp' ? 'C++' : card.lang}</span>
            </div>
            {card.url && (
              <a
                href={card.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-indigo-400 hover:underline"
              >
                <ExternalLink size={11} /> Open
              </a>
            )}
          </div>
          <div className="p-3">
            <CodeBlockView code={card.code} />
          </div>
        </div>
      )}
    </div>
  )
}

