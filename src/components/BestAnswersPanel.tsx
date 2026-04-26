'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ExternalLink, Loader2, AlertCircle, Copy, Check,
  LayoutGrid, Layers, ChevronLeft, ChevronRight,
} from 'lucide-react'

export const BEST_ANSWER_SITES = [
  { key: 'walkccc',    label: 'WalkCC',      color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5'    },
  { key: 'doocs',      label: 'LeetDoocs',   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { key: 'simplyleet', label: 'SimplyLeet',  color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/5'  },
  { key: 'leetcodeca', label: 'LeetCode.ca', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/5'  },
] as const

type SiteKey = (typeof BEST_ANSWER_SITES)[number]['key']

interface CodeBlock { code: string; lang: string }
interface SiteState {
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

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const ref = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    ref.current.textContent = code
    import('highlight.js/lib/core').then(async ({ default: hljs }) => {
      const [py, cpp] = await Promise.all([
        import('highlight.js/lib/languages/python'),
        import('highlight.js/lib/languages/cpp'),
      ])
      if (!hljs.getLanguage('python')) hljs.registerLanguage('python', py.default)
      if (!hljs.getLanguage('cpp'))    hljs.registerLanguage('cpp',    cpp.default)
      if (!ref.current) return
      const validLang = hljs.getLanguage(lang) ? lang : 'python'
      ref.current.innerHTML = hljs.highlight(code, { language: validLang }).value
    })
  }, [code, lang])

  const copy = () =>
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 hover:bg-white border border-gray-200 text-gray-600 hover:text-gray-900 text-[10px] font-medium shadow-sm transition-all"
      >
        {copied ? <><Check size={10} className="text-green-500" /> Copied</> : <><Copy size={10} /> Copy</>}
      </button>
      <pre className="text-[11px] leading-relaxed bg-[#1e1e2e] text-gray-100 rounded-lg p-3 pt-8 overflow-x-auto border border-gray-700/40 whitespace-pre">
        <code ref={ref} className="hljs text-gray-100" />
      </pre>
    </div>
  )
}

export type BestAnswersPanelProps = {
  questionId: number
  slug: string
  active: boolean
  theme?: 'default' | 'dark'
  layout?: 'compact' | 'full'
  className?: string
}

export default function BestAnswersPanel({
  questionId,
  slug,
  active,
  theme = 'default',
  layout = 'compact',
  className = '',
}: BestAnswersPanelProps) {
  const [states, setStates]     = useState<Record<SiteKey, SiteState>>(emptyStates)
  const [viewMode, setViewMode] = useState<'grid' | 'flashcard'>('grid')
  const [cardIdx, setCardIdx]   = useState(0)

  /* inject highlight.js stylesheet once */
  useEffect(() => {
    if (!document.getElementById('hljs-theme-best-answers')) {
      const link = document.createElement('link')
      link.id   = 'hljs-theme-best-answers'
      link.rel  = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      document.head.appendChild(link)
    }
  }, [])

  /* fetch external sites (only when this tab is visible) */
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
            url:    data.url   ?? '',
            error:  data.error,
          },
        }))
      )
      .catch(err =>
        setStates(prev => ({
          ...prev,
          [site]: { status: 'error', blocks: [], url: '', error: String(err) },
        }))
      )
  }, [])

  useEffect(() => {
    if (!active || !slug || !Number.isFinite(questionId) || questionId <= 0) return
    setStates(emptyStates())
    for (const s of BEST_ANSWER_SITES) fetchSite(s.key, questionId, slug)
  }, [active, slug, questionId, fetchSite])

  type DeckCard = {
    siteKey: SiteKey
    siteLabel: string
    siteColor: string
    url: string
    code: string
    lang: string
  }

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
    // Prefer Python cards first, then C++.
    cards.sort((a, b) => (a.lang === b.lang ? 0 : a.lang === 'python' ? -1 : 1))
    return cards
  }, [states])

  useEffect(() => {
    // Reset deck navigation when question changes / answers refetch.
    setCardIdx(0)
  }, [questionId, slug])

  useEffect(() => {
    // Clamp idx if the deck shrinks.
    if (cardIdx >= deck.length) setCardIdx(0)
  }, [deck.length, cardIdx])

  const subtle    = theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-subtle,#6b7280)]'
  const grid      = layout === 'full' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-3'
  const panelMaxH = layout === 'full' ? 'max-h-[22rem]' : 'max-h-[18rem]'

  return (
    <div className={className}>

      {/* ── View mode toggle ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setViewMode('grid')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            viewMode === 'grid'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow'
              : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600'
          }`}
        >
          <LayoutGrid size={12} /> Grid
        </button>
        <button
          onClick={() => setViewMode('flashcard')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            viewMode === 'flashcard'
              ? 'bg-indigo-600 border-indigo-500 text-white shadow'
              : 'bg-gray-800/60 border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600'
          }`}
        >
          <Layers size={12} /> Flashcard
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          GRID MODE
      ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'grid' && (
        <div className={grid}>
          {BEST_ANSWER_SITES.map(site => {
            const s = states[site.key]
            const borderCls = theme === 'dark' ? 'border-gray-700/60' : site.border
            const bgCls     = theme === 'dark' ? 'bg-gray-800/20'     : site.bg
            return (
              <div key={site.key} className={`rounded-xl border ${borderCls} ${bgCls} flex flex-col overflow-hidden`}>
                <div className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${theme === 'dark' ? 'border-gray-700/50' : 'border-[var(--border,#e5e7eb)]'}`}>
                  <span className={`text-xs font-bold ${site.color}`}>{site.label}</span>
                  {s.url && (
                    <a href={s.url} target="_blank" rel="noopener noreferrer"
                      className={`flex items-center gap-1 text-[10px] transition-colors ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-[var(--text-muted,#9ca3af)] hover:text-[var(--text,#111)]'}`}>
                      <ExternalLink size={11} /> Open
                    </a>
                  )}
                </div>
                <div className={`flex-1 overflow-y-auto p-2 ${panelMaxH}`}>
                  {s.status === 'idle'    && <div className={`py-8 text-center text-[11px] ${subtle}`}>Waiting…</div>}
                  {s.status === 'loading' && (
                    <div className={`flex items-center justify-center gap-2 py-8 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-muted,#9ca3af)]'}`}>
                      <Loader2 size={13} className="animate-spin" /> Fetching…
                    </div>
                  )}
                  {s.status === 'error' && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <AlertCircle size={16} className="text-gray-600" />
                      <p className={`text-xs ${subtle}`}>Could not load solutions</p>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">Open on site →</a>}
                    </div>
                  )}
                  {s.status === 'done' && s.blocks.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <p className={`text-xs ${subtle}`}>No Python / C++ solution found</p>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">Open on site →</a>}
                    </div>
                  )}
                  {s.status === 'done' && [...s.blocks].sort((a, b) => a.lang === b.lang ? 0 : a.lang === 'python' ? -1 : 1).map((b, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      <HighlightedCode code={b.code} lang={b.lang} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          FLASHCARD MODE — 3-D flip card
          Front  = study prompt
          Back   = fetched “best answers” (includes SimplyLeet)
      ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'flashcard' && (
        <div className="flex flex-col gap-3">

          {/* deck controls */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCardIdx(i => (deck.length ? (i - 1 + deck.length) % deck.length : 0))}
              disabled={deck.length <= 1}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                deck.length <= 1
                  ? 'bg-gray-800/30 border-gray-800/30 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800/60 border-gray-700/50 text-gray-300 hover:text-gray-100 hover:border-gray-600'
              }`}
            >
              <ChevronLeft size={12} /> Prev
            </button>

            <div className="text-xs text-gray-500">
              {deck.length ? (
                <span>
                  Card <span className="text-gray-300 font-semibold">{cardIdx + 1}</span> / {deck.length}
                </span>
              ) : (
                <span>Waiting for best answers…</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCardIdx(i => (deck.length ? (i + 1) % deck.length : 0))}
              disabled={deck.length <= 1}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                deck.length <= 1
                  ? 'bg-gray-800/30 border-gray-800/30 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-800/60 border-gray-700/50 text-gray-300 hover:text-gray-100 hover:border-gray-600'
              }`}
            >
              Next <ChevronRight size={12} />
            </button>
          </div>

          {/* Answer-only card (no flip / recall prompt) */}
          {(() => {
            const card = deck[cardIdx]
            return (
              <div className="rounded-2xl border-2 border-indigo-500/30 bg-gradient-to-br from-[#0f1729] to-gray-900 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-indigo-500/20 bg-indigo-600/10">
                  <div className="text-[11px] text-gray-500">
                    <span className="font-semibold text-gray-300">★ Best Answer</span>
                    {card ? (
                      <>
                        <span className="mx-2 text-gray-600">·</span>
                        <span className={`font-bold ${card.siteColor}`}>{card.siteLabel}</span>
                        <span className="mx-2 text-gray-600">·</span>
                        <span className="font-semibold text-gray-300">{card.lang === 'cpp' ? 'C++' : card.lang}</span>
                      </>
                    ) : null}
                  </div>
                  {card?.url ? (
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-indigo-400 hover:underline"
                    >
                      <ExternalLink size={11} /> Open
                    </a>
                  ) : (
                    <a
                      href={`/answers?id=${questionId}&slug=${encodeURIComponent(slug)}`}
                      className="text-[10px] text-indigo-400 hover:underline"
                    >
                      Answers page →
                    </a>
                  )}
                </div>

                <div className="p-3" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  {card ? (
                    <HighlightedCode code={card.code} lang={card.lang} />
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500 py-10">
                      <Loader2 size={16} className="animate-spin text-gray-600" />
                      <span>Fetching best answers…</span>
                    </div>
                  )}
                </div>

                <div className="px-4 py-2.5 border-t border-gray-700/40 bg-gray-800/30 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className="flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <LayoutGrid size={10} /> Community solutions
                  </button>
                  <span className="text-[10px] text-gray-600">
                    {deck.length ? `${cardIdx + 1} / ${deck.length}` : '…'}
                  </span>
                </div>
              </div>
            )
          })()}

        </div>
      )}
    </div>
  )
}
