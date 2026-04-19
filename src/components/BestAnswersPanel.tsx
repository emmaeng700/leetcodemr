'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ExternalLink, Loader2, AlertCircle, Copy, Check,
  LayoutGrid, Layers, Eye, EyeOff, ChevronLeft, ChevronRight,
} from 'lucide-react'

export const BEST_ANSWER_SITES = [
  { key: 'walkccc',    label: 'WalkCC',      color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5',    dot: 'bg-blue-400'    },
  { key: 'doocs',      label: 'LeetDoocs',   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' },
  { key: 'simplyleet', label: 'SimplyLeet',  color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/5',  dot: 'bg-purple-400'  },
  { key: 'leetcodeca', label: 'LeetCode.ca', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/5',  dot: 'bg-orange-400'  },
] as const

type SiteKey = (typeof BEST_ANSWER_SITES)[number]['key']

interface CodeBlock {
  code: string
  lang: string
}

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
      if (!hljs.getLanguage('cpp'))    hljs.registerLanguage('cpp', cpp.default)
      if (!ref.current) return
      const validLang = hljs.getLanguage(lang) ? lang : 'python'
      ref.current.innerHTML = hljs.highlight(code, { language: validLang }).value
    })
  }, [code, lang])

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-white/90 hover:bg-white border border-gray-200 text-gray-600 hover:text-gray-900 text-[10px] font-medium shadow-sm transition-all"
      >
        {copied ? (
          <><Check size={10} className="text-green-500" /> Copied</>
        ) : (
          <><Copy size={10} /> Copy</>
        )}
      </button>
      <pre className="text-[11px] leading-relaxed bg-[#1e1e2e] text-gray-100 rounded-lg p-3 pt-8 overflow-x-auto border border-gray-200 whitespace-pre">
        <code ref={ref} className="hljs text-gray-100" />
      </pre>
    </div>
  )
}

export type BestAnswersPanelProps = {
  questionId: number
  slug: string
  /** When false, skips network fetches (tab not visible). */
  active: boolean
  /** `default`: CSS variables (practice / learn / speedster). `dark`: leetcode-api slate. */
  theme?: 'default' | 'dark'
  /** `compact`: single column, shorter panels (embedded tabs). `full`: 2-col grid on md+ (/answers). */
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
  // flashcard state
  const [cardSite, setCardSite] = useState(0)   // 0-3 index into BEST_ANSWER_SITES
  const [revealed, setRevealed] = useState(false)
  const [blockIdx, setBlockIdx] = useState(0)   // which code block on the back face

  useEffect(() => {
    if (!document.getElementById('hljs-theme-best-answers')) {
      const link = document.createElement('link')
      link.id   = 'hljs-theme-best-answers'
      link.rel  = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      document.head.appendChild(link)
    }
  }, [])

  const fetchSite = useCallback((site: SiteKey, id: number, qslug: string) => {
    setStates(prev => ({ ...prev, [site]: { status: 'loading', blocks: [], url: '' } }))
    fetch(`/api/answers?site=${site}&slug=${encodeURIComponent(qslug)}&id=${id}`)
      .then(r => r.json())
      .then(data => {
        setStates(prev => ({
          ...prev,
          [site]: {
            status: data.error && !data.blocks?.length ? 'error' : 'done',
            blocks: data.blocks ?? [],
            url:    data.url   ?? '',
            error:  data.error,
          },
        }))
      })
      .catch(err => {
        setStates(prev => ({
          ...prev,
          [site]: { status: 'error', blocks: [], url: '', error: String(err) },
        }))
      })
  }, [])

  useEffect(() => {
    if (!active || !slug || !Number.isFinite(questionId) || questionId <= 0) return
    setStates(emptyStates())
    setCardSite(0)
    setRevealed(false)
    setBlockIdx(0)
    for (const s of BEST_ANSWER_SITES) fetchSite(s.key, questionId, slug)
  }, [active, slug, questionId, fetchSite])

  // Navigate to a different site in flashcard mode; reset card state
  const goSite = (i: number) => {
    const next = ((i % BEST_ANSWER_SITES.length) + BEST_ANSWER_SITES.length) % BEST_ANSWER_SITES.length
    setCardSite(next)
    setRevealed(false)
    setBlockIdx(0)
  }

  // ── derived styles ──────────────────────────────────────────────────────────
  const subtle     = theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-subtle)]'
  const grid       = layout === 'full' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-3'
  const panelMaxH  = layout === 'full' ? 'max-h-[22rem]' : 'max-h-[18rem]'
  const activeBtn  = 'bg-indigo-600 text-white'
  const inactiveBtn = 'text-gray-400 hover:text-gray-200'

  // ── flashcard data for current site ────────────────────────────────────────
  const fcSite    = BEST_ANSWER_SITES[cardSite]
  const fcState   = states[fcSite.key]
  const fcBlocks  = fcState.blocks
  const curBlock  = fcBlocks[blockIdx] ?? null
  const isLoading = fcState.status === 'idle' || fcState.status === 'loading'
  const hasBlocks = fcState.status === 'done' && fcBlocks.length > 0
  const isEmpty   = fcState.status === 'done' && fcBlocks.length === 0
  const isError   = fcState.status === 'error'

  return (
    <div className={className}>
      {/* ── Toolbar: description + Grid / Flashcard toggle ── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className={`text-xs ${subtle} flex-1`}>
          Python &amp; C++ snippets aggregated from community solution sites (same as the{' '}
          <a
            href={`/answers?id=${questionId}&slug=${encodeURIComponent(slug)}`}
            className={theme === 'dark' ? 'text-indigo-400 hover:underline' : 'text-indigo-500 hover:underline'}
          >
            Answers
          </a>{' '}
          page).
        </p>

        <div className="flex items-center gap-0.5 shrink-0 bg-gray-800/50 border border-gray-700/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${viewMode === 'grid' ? activeBtn : inactiveBtn}`}
          >
            <LayoutGrid size={11} /> Grid
          </button>
          <button
            onClick={() => setViewMode('flashcard')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all ${viewMode === 'flashcard' ? activeBtn : inactiveBtn}`}
          >
            <Layers size={11} /> Flashcard
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          GRID MODE  (existing behaviour, unchanged)
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'grid' && (
        <div className={grid}>
          {BEST_ANSWER_SITES.map(site => {
            const s = states[site.key]
            const borderCls = theme === 'dark' ? 'border-gray-700/60' : site.border
            const bgCls     = theme === 'dark' ? 'bg-gray-800/20'     : site.bg
            return (
              <div key={site.key} className={`rounded-xl border ${borderCls} ${bgCls} flex flex-col overflow-hidden`}>
                <div
                  className={`flex items-center justify-between px-3 py-2 border-b shrink-0 ${
                    theme === 'dark' ? 'border-gray-700/50' : 'border-[var(--border)]'
                  }`}
                >
                  <span className={`text-xs font-bold ${site.color}`}>{site.label}</span>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 text-[10px] transition-colors ${
                        theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                      }`}
                    >
                      <ExternalLink size={11} /> Open
                    </a>
                  )}
                </div>

                <div className={`flex-1 overflow-y-auto p-2 ${panelMaxH}`}>
                  {s.status === 'idle' && (
                    <div className={`py-8 text-center text-[11px] ${subtle}`}>Waiting…</div>
                  )}
                  {s.status === 'loading' && (
                    <div className={`flex items-center justify-center gap-2 py-8 ${theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-muted)]'}`}>
                      <Loader2 size={13} className="animate-spin" />
                      <span className="text-xs">Fetching…</span>
                    </div>
                  )}
                  {s.status === 'error' && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <AlertCircle size={16} className={theme === 'dark' ? 'text-gray-600' : 'text-[var(--text-muted)]'} />
                      <p className={`text-xs ${subtle}`}>Could not load solutions</p>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">
                          Open on site →
                        </a>
                      )}
                    </div>
                  )}
                  {s.status === 'done' && s.blocks.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <p className={`text-xs ${subtle}`}>No Python / C++ solution found</p>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:underline">
                          Open on site →
                        </a>
                      )}
                    </div>
                  )}
                  {s.status === 'done' && s.blocks.map((b, i) => (
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

      {/* ══════════════════════════════════════════════════════════════════════
          FLASHCARD MODE
      ══════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'flashcard' && (
        <div className="flex flex-col gap-4">

          {/* ── The card ── */}
          <div className="rounded-2xl border border-gray-700/50 bg-gray-900/60 overflow-hidden shadow-xl">

            {/* Card header: site badge + counter + source link */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${fcSite.dot}`} />
                <span className={`text-sm font-bold ${fcSite.color}`}>{fcSite.label}</span>
                {isLoading && <Loader2 size={11} className="animate-spin text-gray-500" />}
                {fcState.url && (
                  <a
                    href={fcState.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <ExternalLink size={10} /> source
                  </a>
                )}
              </div>
              <span className="text-[10px] text-gray-600 tabular-nums">
                {cardSite + 1} / {BEST_ANSWER_SITES.length}
              </span>
            </div>

            {/* ── FRONT face — shown until user reveals ── */}
            {!revealed && (
              <div className="flex flex-col items-center justify-center gap-5 py-12 px-6 text-center min-h-[260px]">

                {/* Loading */}
                {isLoading && (
                  <>
                    <Loader2 size={26} className="animate-spin text-gray-700" />
                    <p className="text-sm text-gray-500">Fetching solution from {fcSite.label}…</p>
                  </>
                )}

                {/* Error */}
                {isError && (
                  <>
                    <AlertCircle size={24} className="text-gray-700" />
                    <div className="space-y-1">
                      <p className="text-sm text-gray-400">Couldn&apos;t load {fcSite.label}</p>
                      <p className="text-xs text-gray-600">{fcState.error}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => goSite(cardSite + 1)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Skip to next site →
                    </button>
                  </>
                )}

                {/* Empty */}
                {isEmpty && (
                  <>
                    <p className="text-sm text-gray-400">No Python / C++ solution on {fcSite.label}</p>
                    {fcState.url && (
                      <a href={fcState.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:underline">
                        Open page →
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => goSite(cardSite + 1)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Skip to next site →
                    </button>
                  </>
                )}

                {/* Ready — main study prompt */}
                {hasBlocks && (
                  <>
                    <div className="space-y-2">
                      <p className="text-base font-semibold text-gray-200">Can you recall the solution?</p>
                      <p className="text-sm text-gray-500 max-w-xs">
                        Think through your approach before revealing the{' '}
                        <span className={`font-medium ${fcSite.color}`}>{fcSite.label}</span> answer
                        {fcBlocks.length > 1 && ` (${fcBlocks.length} solutions)`}.
                      </p>
                    </div>

                    <ul className="space-y-1.5 text-left w-full max-w-xs">
                      {[
                        'What is the time complexity?',
                        'Which data structure or technique?',
                        'Any edge cases to handle?',
                      ].map(q => (
                        <li key={q} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="text-gray-700 mt-px">·</span>
                          <span>{q}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => setRevealed(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900/30"
                    >
                      <Eye size={14} /> Reveal Answer
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── BACK face — solution code ── */}
            {revealed && (
              <div className="flex flex-col">

                {/* Multi-block navigation tab bar */}
                {fcBlocks.length > 1 && (
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/40 bg-gray-800/30">
                    <span className="text-[10px] text-gray-500">
                      Solution {blockIdx + 1} of {fcBlocks.length}
                      {curBlock && <span className="ml-1.5 text-gray-600 uppercase tracking-wide">{curBlock.lang}</span>}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => setBlockIdx(i => Math.max(0, i - 1))}
                        disabled={blockIdx === 0}
                        className="p-1.5 rounded text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockIdx(i => Math.min(fcBlocks.length - 1, i + 1))}
                        disabled={blockIdx === fcBlocks.length - 1}
                        className="p-1.5 rounded text-gray-400 hover:text-gray-200 disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Code */}
                <div className="p-3 max-h-[320px] overflow-y-auto">
                  {curBlock && <HighlightedCode code={curBlock.code} lang={curBlock.lang} />}
                </div>

                {/* Footer: hide + site navigation */}
                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-700/50 bg-gray-800/30">
                  <button
                    type="button"
                    onClick={() => { setRevealed(false); setBlockIdx(0) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 text-xs transition-all"
                  >
                    <EyeOff size={12} /> Hide
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => goSite(cardSite - 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 text-xs transition-all"
                    >
                      <ChevronLeft size={12} /> Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => goSite(cardSite + 1)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30 text-xs transition-all"
                    >
                      Next <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Site navigation dots ── */}
          <div className="flex items-center justify-center gap-6">
            {BEST_ANSWER_SITES.map((site, i) => {
              const s          = states[site.key]
              const isActive   = i === cardSite
              const countLabel =
                s.status === 'loading' ? '…' :
                s.status === 'error'   ? '✗' :
                s.status === 'done' && s.blocks.length === 0 ? '–' :
                s.status === 'done'    ? `${s.blocks.length}` : ''

              return (
                <button
                  key={site.key}
                  type="button"
                  onClick={() => goSite(i)}
                  className="flex flex-col items-center gap-1.5 group"
                  title={site.label}
                >
                  <span className={`block rounded-full transition-all duration-200 ${
                    isActive ? `w-3 h-3 ${site.dot}` : 'w-2 h-2 bg-gray-700 group-hover:bg-gray-500'
                  }`} />
                  <span className={`text-[10px] leading-none transition-colors ${
                    isActive ? `${site.color} font-semibold` : 'text-gray-600 group-hover:text-gray-400'
                  }`}>
                    {site.label}
                    {countLabel && <span className="ml-1 opacity-60">{countLabel}</span>}
                  </span>
                </button>
              )
            })}
          </div>

        </div>
      )}
    </div>
  )
}
