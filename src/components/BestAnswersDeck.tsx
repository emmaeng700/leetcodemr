'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Check, Copy, ExternalLink, LayoutGrid, Loader2, Star, ChevronDown } from 'lucide-react'

import {
  BEST_ANSWER_SITES,
  buildBestAnswerLangGroups,
  labelForLang,
  type BestAnswerDeckCard,
} from '@/lib/bestAnswersMerge'
import CollapsibleLcAcceptedBlocks from '@/components/CollapsibleLcAcceptedBlocks'
import { useLeetCodeAcceptedBlocks } from '@/lib/useLeetCodeAcceptedBlocks'

type SiteKey = (typeof BEST_ANSWER_SITES)[number]['key']

type CodeBlock = { code: string; lang: string }
type SiteState = {
  status: 'idle' | 'loading' | 'done' | 'error'
  blocks: CodeBlock[]
  url: string
  error?: string
}

const LANG_TAB: Record<string, { active: string; inactive: string }> = {
  python:     { active: 'bg-blue-600 text-white border-blue-600',           inactive: 'text-blue-400 border-blue-700/50 bg-blue-900/20 hover:border-blue-500' },
  cpp:        { active: 'bg-purple-600 text-white border-purple-600',       inactive: 'text-purple-400 border-purple-700/50 bg-purple-900/20 hover:border-purple-500' },
  javascript: { active: 'bg-yellow-500 text-gray-900 border-yellow-500',   inactive: 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20 hover:border-yellow-500' },
}

function langTabCls(lang: string, isActive: boolean) {
  const c = LANG_TAB[lang]
  if (!c) return isActive
    ? 'bg-indigo-600 text-white border-indigo-600'
    : 'text-indigo-400 border-indigo-700/50 bg-indigo-900/20 hover:border-indigo-500'
  return isActive ? c.active : c.inactive
}

function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const ref  = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!ref.current) return
    ref.current.textContent = code
    import('highlight.js/lib/core').then(async ({ default: hljs }) => {
      const [py, cpp, js] = await Promise.all([
        import('highlight.js/lib/languages/python'),
        import('highlight.js/lib/languages/cpp'),
        import('highlight.js/lib/languages/javascript'),
      ])
      if (!hljs.getLanguage('python'))     hljs.registerLanguage('python',     py.default)
      if (!hljs.getLanguage('cpp'))        hljs.registerLanguage('cpp',        cpp.default)
      if (!hljs.getLanguage('javascript')) hljs.registerLanguage('javascript', js.default)
      if (!ref.current) return
      const validLang = hljs.getLanguage(lang) ? lang : 'python'
      ref.current.innerHTML = hljs.highlight(code, { language: validLang, ignoreIllegals: true }).value
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
        className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-md bg-gray-700/80 hover:bg-gray-600 border border-gray-600 text-gray-300 hover:text-white text-[10px] font-medium transition-all"
      >
        {copied
          ? <><Check size={10} className="text-green-400" /> Copied</>
          : <><Copy size={10} /> Copy</>}
      </button>
      <pre className="text-[11px] leading-relaxed bg-[#1e1e2e] text-gray-100 rounded-lg p-3 pt-8 overflow-x-auto border border-gray-700/40 whitespace-pre">
        <code ref={ref} className="hljs text-gray-100" />
      </pre>
    </div>
  )
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

export default function BestAnswersDeck({ questionId, slug, active, className = '' }: BestAnswersDeckProps) {
  const [states,    setStates]    = useState<Record<SiteKey, SiteState>>(emptyStates)
  const [activeLang, setActiveLang] = useState<string | null>(null)
  const [langIdx,   setLangIdx]   = useState(0)
  const [lcCodeOpen, setLcCodeOpen] = useState(false)
  const { blocks: lcBlocks, loading: lcLoading } = useLeetCodeAcceptedBlocks(slug, active)

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (!document.getElementById('hljs-theme-best-answers')) {
      const link  = document.createElement('link')
      link.id     = 'hljs-theme-best-answers'
      link.rel    = 'stylesheet'
      link.href   = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      document.head.appendChild(link)
    }
  }, [])

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
    setActiveLang(null)
    setLangIdx(0)
    setLcCodeOpen(false)
    for (const s of BEST_ANSWER_SITES) fetchSite(s.key, questionId, slug)
  }, [active, slug, questionId, fetchSite])

  const langGroups = useMemo(
    () => buildBestAnswerLangGroups(states, lcBlocks, slug),
    [states, lcBlocks, slug],
  )

  const langs = langGroups.map(g => g.lang)

  useEffect(() => {
    if (langs.length > 0 && (activeLang === null || !langs.includes(activeLang))) {
      setActiveLang(langs[0])
      setLangIdx(0)
    }
  }, [langs, activeLang])

  useEffect(() => {
    setLangIdx(0)
    setLcCodeOpen(false)
  }, [activeLang, questionId, slug])

  useEffect(() => {
    setLcCodeOpen(false)
  }, [langIdx])

  const currentGroup = langGroups.find(g => g.lang === activeLang)
  const currentCards: BestAnswerDeckCard[] = currentGroup?.cards ?? []
  const card = currentCards[langIdx] ?? null
  const anyLoading = Object.values(states).some(s => s.status === 'loading') || lcLoading

  return (
    <div className={className}>
      {lcBlocks.length > 0 && (
        <CollapsibleLcAcceptedBlocks
          blocks={lcBlocks}
          loading={lcLoading}
          resetKey={`${questionId}-${slug}`}
          className="mb-3"
          renderCode={(code, lang) => <HighlightedCode code={code} lang={lang} />}
        />
      )}

      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300">Best answers</span>
          {currentCards.length > 1 && (
            <span className="font-mono text-[11px] text-gray-500">{langIdx + 1}/{currentCards.length}</span>
          )}
          {anyLoading && <Loader2 size={12} className="animate-spin text-gray-600" />}
        </div>

        {card?.url && (
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:underline"
          >
            <ExternalLink size={11} />
            {card.isLeetCodeAccepted ? 'LeetCode submissions' : card.siteLabel}
          </a>
        )}
      </div>

      {langs.length > 0 && (
        <div className="flex gap-1.5 mb-2 flex-wrap">
          {langGroups.map(({ lang, cards }) => {
            const hasMine = cards.some(c => c.isLeetCodeAccepted)
            return (
              <button
                key={lang}
                type="button"
                onClick={() => { setActiveLang(lang); setLangIdx(0) }}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors flex items-center gap-1 ${langTabCls(lang, activeLang === lang)}`}
              >
                {hasMine && <Star size={10} className={activeLang === lang ? 'fill-current' : 'fill-amber-400 text-amber-400'} />}
                {labelForLang(lang)}
                <span className="ml-0.5 font-normal opacity-60">·{cards.length}</span>
              </button>
            )
          })}
        </div>
      )}

      {!card ? (
        <div className="rounded-xl border border-gray-700/50 bg-gray-900/30 p-4 text-xs text-gray-500 flex items-center gap-2">
          {anyLoading
            ? <><Loader2 size={14} className="animate-spin text-gray-600" /><span>{lcLoading ? 'Loading your submissions…' : 'Fetching best answers…'}</span></>
            : <><LayoutGrid size={14} className="text-gray-600" /><span>No best answers found yet.</span></>}
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${
          card.isLeetCodeAccepted
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-gray-700/40 bg-gray-900/20'
        }`}>
          <div className={`flex items-center justify-between px-3 py-2 border-b ${
            card.isLeetCodeAccepted
              ? 'border-amber-500/20 bg-amber-600/10'
              : 'border-gray-700/40 bg-gray-900/30'
          }`}>
            {card.isLeetCodeAccepted ? (
              <button
                type="button"
                onClick={() => setLcCodeOpen(v => !v)}
                style={{ touchAction: 'manipulation' }}
                className="flex items-center gap-1.5 text-left min-w-0 flex-1"
                aria-expanded={lcCodeOpen}
              >
                {lcCodeOpen
                  ? <ChevronDown size={11} className="text-amber-400 shrink-0" />
                  : <ChevronRight size={11} className="text-amber-400 shrink-0" />}
                <Star size={11} className="fill-amber-400 text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-amber-400">
                  Your LeetCode · {labelForLang(card.lang)}
                </span>
                <span className="text-[10px] font-medium text-amber-500/80">
                  {lcCodeOpen ? 'Hide' : 'Show'}
                </span>
              </button>
            ) : (
              <span className={`text-[11px] font-bold ${card.siteColor}`}>{card.siteLabel}</span>
            )}

            {currentCards.length > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLangIdx(i => (i - 1 + currentCards.length) % currentCards.length)}
                  className="p-1 rounded border border-gray-700/50 bg-gray-900/40 text-gray-300 hover:border-gray-600 transition-colors"
                  aria-label="Previous answer"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setLangIdx(i => (i + 1) % currentCards.length)}
                  className="p-1 rounded border border-gray-700/50 bg-gray-900/40 text-gray-300 hover:border-gray-600 transition-colors"
                  aria-label="Next answer"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>

          <div className="p-2">
            {card.isLeetCodeAccepted && !lcCodeOpen ? (
              <p className="text-xs text-amber-500/80 text-center py-6">
                Tap Show to reveal your accepted solution.
              </p>
            ) : (
              <HighlightedCode code={card.code} lang={card.lang} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export { BEST_ANSWER_SITES }
