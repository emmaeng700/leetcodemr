'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  ExternalLink, Loader2, AlertCircle, Copy, Check,
  LayoutGrid, Layers, Eye, EyeOff, ChevronDown, ChevronUp,
} from 'lucide-react'

export const BEST_ANSWER_SITES = [
  { key: 'walkccc',    label: 'WalkCC',      color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5',    dot: 'bg-blue-400'    },
  { key: 'doocs',      label: 'LeetDoocs',   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', dot: 'bg-emerald-400' },
  { key: 'simplyleet', label: 'SimplyLeet',  color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/5',  dot: 'bg-purple-400'  },
  { key: 'leetcodeca', label: 'LeetCode.ca', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/5',  dot: 'bg-orange-400'  },
] as const

type SiteKey = (typeof BEST_ANSWER_SITES)[number]['key']

interface CodeBlock { code: string; lang: string }
interface SiteState {
  status: 'idle' | 'loading' | 'done' | 'error'
  blocks: CodeBlock[]
  url: string
  error?: string
}
interface Curated { python_solution?: string; explanation?: string }

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
      <pre className="text-[11px] leading-relaxed bg-[#1e1e2e] text-gray-100 rounded-lg p-3 pt-8 overflow-x-auto border border-gray-700/50 whitespace-pre">
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
  const [states, setStates]       = useState<Record<SiteKey, SiteState>>(emptyStates)
  const [viewMode, setViewMode]   = useState<'grid' | 'flashcard'>('grid')
  // flashcard state
  const [revealed, setRevealed]   = useState(false)
  const [showExpl, setShowExpl]   = useState(false)
  // curated solution from questions_full.json — loaded independently of external APIs
  const [curated, setCurated]     = useState<Curated | null>(null)  // null = not yet loaded
  const [curatedLoading, setCuratedLoading] = useState(false)

  // ── Inject highlight.js theme once ────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('hljs-theme-best-answers')) {
      const link = document.createElement('link')
      link.id   = 'hljs-theme-best-answers'
      link.rel  = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      document.head.appendChild(link)
    }
  }, [])

  // ── Fetch curated solution from local JSON (fast, browser-cached) ─────────
  // Runs whenever the question changes, regardless of tab visibility.
  useEffect(() => {
    if (!questionId || questionId <= 0) return
    setCurated(null)
    setRevealed(false)
    setShowExpl(false)
    setCuratedLoading(true)
    fetch('/questions_full.json')
      .then(r => r.json())
      .then((qs: Array<{ id: number; python_solution?: string; explanation?: string }>) => {
        const q = qs.find(x => x.id === questionId)
        setCurated(q ? { python_solution: q.python_solution, explanation: q.explanation } : {})
      })
      .catch(() => setCurated({}))
      .finally(() => setCuratedLoading(false))
  }, [questionId])

  // ── Fetch external site solutions (only when the tab is active) ───────────
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

  // ── Shared style helpers ───────────────────────────────────────────────────
  const subtle    = theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-subtle,#6b7280)]'
  const grid      = layout === 'full' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-3'
  const panelMaxH = layout === 'full' ? 'max-h-[22rem]' : 'max-h-[18rem]'
  const activeBtn   = 'bg-indigo-600 text-white shadow-sm'
  const inactiveBtn = 'text-gray-400 hover:text-gray-200'

  const hasSolution = !!(curated?.python_solution?.trim())
  const hasExplain  = !!(curated?.explanation?.trim())

  return (
    <div className={className}>
      {/* ── Top bar: subtitle + view toggle ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className={`text-xs ${subtle}`}>
          Compare community solutions or self-test in Flashcard mode.{' '}
          <a
            href={`/answers?id=${questionId}&slug=${encodeURIComponent(slug)}`}
            className="text-indigo-400 hover:underline"
          >
            Open Answers page →
          </a>
        </p>

        <div className="flex items-center gap-0.5 shrink-0 bg-gray-800/60 border border-gray-700/50 rounded-lg p-0.5">
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

      {/* ══════════════════════════════════════════════════════════════════
          GRID MODE — unchanged behaviour
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
                      className={`flex items-center gap-1 text-[10px] transition-colors ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-[var(--text-muted,#9ca3af)] hover:text-[var(--text,#111827)]'}`}>
                      <ExternalLink size={11} /> Open
                    </a>
                  )}
                </div>
                <div className={`flex-1 overflow-y-auto p-2 ${panelMaxH}`}>
                  {s.status === 'idle' && <div className={`py-8 text-center text-[11px] ${subtle}`}>Waiting…</div>}
                  {s.status === 'loading' && (
                    <div className={`flex items-center justify-center gap-2 py-8 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-muted,#9ca3af)]'}`}>
                      <Loader2 size={13} className="animate-spin" /> Fetching…
                    </div>
                  )}
                  {s.status === 'error' && (
                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                      <AlertCircle size={16} className={theme === 'dark' ? 'text-gray-600' : 'text-[var(--text-muted,#9ca3af)]'} />
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

      {/* ══════════════════════════════════════════════════════════════════
          FLASHCARD MODE
          Uses curated data from questions_full.json — no external API needed.
          Works instantly regardless of whether external sites have loaded.
      ══════════════════════════════════════════════════════════════════ */}
      {viewMode === 'flashcard' && (
        <div className="rounded-2xl border border-gray-700/60 bg-gray-900/70 overflow-hidden shadow-lg">

          {/* ── FRONT — study prompt ─────────────────────────────────────── */}
          {!revealed && (
            <div className="flex flex-col items-center justify-center gap-5 py-10 px-6 text-center min-h-[220px]">
              {curatedLoading && (
                <Loader2 size={22} className="animate-spin text-gray-600" />
              )}

              {!curatedLoading && (
                <>
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold text-gray-200">
                      Can you recall the solution?
                    </p>
                    <p className="text-xs text-gray-500 max-w-xs">
                      Think through your approach, then reveal the curated answer below.
                    </p>
                  </div>

                  <ul className="space-y-1 text-left w-full max-w-xs">
                    {[
                      'What is the time complexity?',
                      'Which data structure or technique?',
                      'Any edge cases to handle?',
                    ].map(q => (
                      <li key={q} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="mt-px text-gray-700">·</span>
                        <span>{q}</span>
                      </li>
                    ))}
                  </ul>

                  {hasSolution ? (
                    <button
                      type="button"
                      onClick={() => setRevealed(true)}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-indigo-900/40"
                    >
                      <Eye size={14} /> Reveal Answer
                    </button>
                  ) : (
                    /* No curated solution in JSON — offer Grid mode instead */
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-xs text-gray-600">No curated solution stored for this question.</p>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        View community solutions in Grid →
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── BACK — curated solution + explanation ─────────────────────── */}
          {revealed && (
            <div className="flex flex-col">

              {/* Source label */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/50">
                <span className="text-[11px] font-semibold text-indigo-300 tracking-wide uppercase">
                  ★ Curated Solution — Python
                </span>
                <button
                  type="button"
                  onClick={() => { setRevealed(false); setShowExpl(false) }}
                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <EyeOff size={11} /> Hide
                </button>
              </div>

              {/* Code */}
              <div className="p-3 max-h-[320px] overflow-y-auto">
                {hasSolution && (
                  <HighlightedCode code={curated!.python_solution!} lang="python" />
                )}
              </div>

              {/* Explanation toggle */}
              {hasExplain && (
                <div className="border-t border-gray-700/40">
                  <button
                    type="button"
                    onClick={() => setShowExpl(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-800/40 transition-all"
                  >
                    <span className="font-medium">Explanation</span>
                    {showExpl ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {showExpl && (
                    <div className="px-4 pb-4 text-xs text-gray-400 leading-relaxed whitespace-pre-wrap border-t border-gray-700/30 pt-3">
                      {curated!.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Footer: community solutions link */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700/50 bg-gray-800/30">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <LayoutGrid size={11} /> Community solutions
                </button>
                <a
                  href={`/answers?id=${questionId}&slug=${encodeURIComponent(slug)}`}
                  className="text-[10px] text-indigo-400 hover:underline"
                >
                  Open Answers page →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
