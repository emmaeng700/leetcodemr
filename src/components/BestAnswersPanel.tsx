'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ExternalLink, Loader2, AlertCircle, Copy, Check } from 'lucide-react'

export const BEST_ANSWER_SITES = [
  { key: 'walkccc', label: 'WalkCC', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
  { key: 'doocs', label: 'LeetDoocs', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { key: 'simplyleet', label: 'SimplyLeet', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/5' },
  { key: 'leetcodeca', label: 'LeetCode.ca', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5' },
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
  walkccc: { status: 'idle', blocks: [], url: '' },
  doocs: { status: 'idle', blocks: [], url: '' },
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
      if (!hljs.getLanguage('cpp')) hljs.registerLanguage('cpp', cpp.default)
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
          <>
            <Check size={10} className="text-green-500" /> Copied
          </>
        ) : (
          <>
            <Copy size={10} /> Copy
          </>
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
  const [states, setStates] = useState<Record<SiteKey, SiteState>>(emptyStates)

  useEffect(() => {
    if (!document.getElementById('hljs-theme-best-answers')) {
      const link = document.createElement('link')
      link.id = 'hljs-theme-best-answers'
      link.rel = 'stylesheet'
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
            url: data.url ?? '',
            error: data.error,
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
    for (const s of BEST_ANSWER_SITES) {
      fetchSite(s.key, questionId, slug)
    }
  }, [active, slug, questionId, fetchSite])

  const subtle =
    theme === 'dark' ? 'text-gray-500' : 'text-[var(--text-subtle)]'
  const grid =
    layout === 'full' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'grid grid-cols-1 gap-3'
  const panelMaxH = layout === 'full' ? 'max-h-[22rem]' : 'max-h-[18rem]'

  return (
    <div className={`${className}`}>
      <p className={`text-xs ${subtle} mb-3`}>
        Python &amp; C++ snippets aggregated from community solution sites (same as the{' '}
        <a
          href={`/answers?id=${questionId}&slug=${encodeURIComponent(slug)}`}
          className={theme === 'dark' ? 'text-indigo-400 hover:underline' : 'text-indigo-500 hover:underline'}
        >
          Answers
        </a>{' '}
        page).
      </p>
      <div className={grid}>
        {BEST_ANSWER_SITES.map(site => {
          const s = states[site.key]
          const borderCls = theme === 'dark' ? 'border-gray-700/60' : site.border
          const bgCls = theme === 'dark' ? 'bg-gray-800/20' : site.bg
          return (
            <div
              key={site.key}
              className={`rounded-xl border ${borderCls} ${bgCls} flex flex-col overflow-hidden`}
            >
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
                {s.status === 'done' &&
                  s.blocks.map((b, i) => (
                    <div key={i} className="mb-3 last:mb-0">
                      <HighlightedCode code={b.code} lang={b.lang} />
                    </div>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
