'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Copy, Check, Loader2, Trophy } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'
import { CODE_HIGHLIGHT_TOKEN_CSS } from '@/lib/codeHighlightTheme'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

interface Sub { id: string; lang: string; langName: string; runtime: string; memory: string; timestamp: string }

const HLJS_STYLE = `
  .accepted-solutions-hljs .hljs { background: #282c34; color: #abb2bf; }
  ${CODE_HIGHLIGHT_TOKEN_CSS}
`

const SKIN = {
  light: {
    emptyIcon: 'text-gray-300',
    emptyTitle: 'text-sm text-gray-500',
    emptyHint: 'text-xs text-gray-400',
    hint: 'text-xs text-gray-400 mb-3',
    spinLoad: 'text-indigo-400',
    spinCode: 'text-green-500',
    card: 'bg-green-50 border-green-100 hover:border-green-300 hover:bg-green-100',
    check: 'text-green-500',
    cardTitle: 'text-xs font-semibold text-gray-700',
    cardMeta: 'text-xs text-gray-400',
    cardRightMain: 'text-xs text-gray-500',
    cardRightSub: 'text-xs text-gray-400',
    backBtn: 'text-xs text-gray-400 hover:text-gray-700',
    copyBtn: 'text-xs text-gray-500 hover:text-gray-800',
    codeFrameBorder: 'border-gray-200',
  },
  dark: {
    emptyIcon: 'text-gray-600',
    emptyTitle: 'text-sm text-gray-200',
    emptyHint: 'text-xs text-gray-500',
    hint: 'text-xs text-gray-500 mb-3',
    spinLoad: 'text-indigo-400',
    spinCode: 'text-emerald-400',
    card: 'bg-emerald-950/35 border-emerald-800/60 hover:bg-emerald-900/40 hover:border-emerald-500/50',
    check: 'text-emerald-400',
    cardTitle: 'text-xs font-semibold text-gray-100',
    cardMeta: 'text-xs text-gray-500',
    cardRightMain: 'text-xs text-gray-400',
    cardRightSub: 'text-xs text-gray-500',
    backBtn: 'text-xs text-gray-400 hover:text-white',
    copyBtn: 'text-xs text-gray-400 hover:text-gray-100',
    codeFrameBorder: 'border-gray-600',
  },
} as const

export function useAcceptedSolutions(slug: string | undefined, active: boolean) {
  const [submissions, setSubmissions]       = useState<Sub[]>([])
  const [subsLoading, setSubsLoading]       = useState(false)
  const [selectedSub, setSelectedSub]       = useState<{ code: string; lang: string } | null>(null)
  const [subCodeLoading, setSubCodeLoading] = useState(false)
  const [copiedSub, setCopiedSub]           = useState(false)
  const loadedSlug                          = useRef<string | null>(null)

  useEffect(() => {
    if (!active || !slug) return
    if (loadedSlug.current === slug) return
    loadedSlug.current = slug
    setSubsLoading(true)
    setSubmissions([])
    setSelectedSub(null)
    const session   = localStorage.getItem('lc_session')  ?? ''
    const csrfToken = localStorage.getItem('lc_csrf')     ?? ''
    fetch('/api/leetcode', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session, csrfToken,
        query: `query($slug:String!,$offset:Int!,$limit:Int!){questionSubmissionList(questionSlug:$slug,offset:$offset,limit:$limit,status:10){submissions{id lang langName runtime memory timestamp}}}`,
        variables: { slug, offset: 0, limit: 3 },
      }),
    })
      .then(r => r.json())
      .then(d => setSubmissions(d?.data?.questionSubmissionList?.submissions ?? []))
      .catch(() => {})
      .finally(() => setSubsLoading(false))
  }, [active, slug])

  async function loadSubCode(id: string, langSlug: string) {
    setSubCodeLoading(true)
    setSelectedSub(null)
    const session   = localStorage.getItem('lc_session')  ?? ''
    const csrfToken = localStorage.getItem('lc_csrf')     ?? ''
    try {
      const res = await fetch('/api/leetcode', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session, csrfToken,
          query: `query($id:Int!){submissionDetails(submissionId:$id){code}}`,
          variables: { id: Number(id) },
        }),
      })
      const d = await res.json()
      const code = d?.data?.submissionDetails?.code ?? ''
      const hlLang = langSlug === 'python3' ? 'python' : langSlug === 'cpp' ? 'cpp' : langSlug
      setSelectedSub({ code, lang: hlLang })
    } catch { /* ignore */ }
    finally { setSubCodeLoading(false) }
  }

  async function copyCode() {
    if (!selectedSub?.code) return
    await navigator.clipboard.writeText(selectedSub.code)
    setCopiedSub(true)
    setTimeout(() => setCopiedSub(false), 2000)
  }

  return { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub: () => setSelectedSub(null) }
}

export default function AcceptedSolutions({
  submissions,
  loading,
  selectedSub,
  subCodeLoading,
  copied,
  onSelect,
  onCopy,
  onBack,
  surface = 'light',
}: {
  submissions: Sub[]
  loading: boolean
  selectedSub: { code: string; lang: string } | null
  subCodeLoading: boolean
  copied: boolean
  onSelect: (id: string, lang: string) => void
  onCopy: () => void
  onBack: () => void
  /** `dark` for LeetCode workspace; `light` for Practice / Learn / Speedster (solid white panel). */
  surface?: 'light' | 'dark'
}) {
  const codeRef = useRef<HTMLElement>(null)
  const skin = SKIN[surface]

  useEffect(() => {
    if (codeRef.current && selectedSub?.code) {
      codeRef.current.removeAttribute('data-highlighted')
      codeRef.current.textContent = selectedSub.code
      if (selectedSub.lang === 'python' || selectedSub.lang === 'cpp') hljs.highlightElement(codeRef.current)
    }
  }, [selectedSub])

  const scope = (
    <style>{HLJS_STYLE}</style>
  )

  if (loading) {
    return (
      <>
        {scope}
        <div className="accepted-solutions-hljs flex items-center justify-center py-12">
          <Loader2 size={18} className={`animate-spin ${skin.spinLoad}`} />
        </div>
      </>
    )
  }

  if (!loading && submissions.length === 0) {
    return (
      <>
        {scope}
        <div className="accepted-solutions-hljs flex flex-col items-center justify-center py-12 gap-2 text-center">
          <Trophy size={22} className={skin.emptyIcon} />
          <p className={skin.emptyTitle}>No accepted submissions yet.</p>
          <p className={skin.emptyHint}>Solve it and come back here!</p>
        </div>
      </>
    )
  }

  if (subCodeLoading) {
    return (
      <>
        {scope}
        <div className="accepted-solutions-hljs flex items-center justify-center py-12">
          <Loader2 size={18} className={`animate-spin ${skin.spinCode}`} />
        </div>
      </>
    )
  }

  if (selectedSub) {
    return (
      <>
        {scope}
        <div className="accepted-solutions-hljs flex flex-col h-full min-h-0">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <button type="button" onClick={onBack} className={`flex items-center gap-1 transition-colors ${skin.backBtn}`}>
              ← Back
            </button>
            <button type="button" onClick={onCopy} className={`flex items-center gap-1 transition-colors ${skin.copyBtn}`}>
              {copied ? (
                <>
                  <Check size={12} className="text-green-500" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>
          </div>
          <div className={`rounded-xl overflow-hidden border flex-1 min-h-0 flex flex-col ${skin.codeFrameBorder}`}>
            <div className="bg-[#21252b] px-4 py-2 border-b border-gray-700 shrink-0">
              <span className="text-xs font-semibold text-gray-400">
                {selectedSub.lang === 'cpp' ? 'C++' : selectedSub.lang === 'python' ? 'Python 3' : selectedSub.lang}
              </span>
            </div>
            <div className="overflow-auto bg-[#282c34] flex-1 min-h-0">
              <pre className="p-4 text-[12px] leading-relaxed m-0">
                <code ref={codeRef} className={`language-${selectedSub.lang}`}>
                  {selectedSub.code}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      {scope}
      <div className="accepted-solutions-hljs space-y-2">
        <p className={skin.hint}>Last 3 accepted submissions — click to view code</p>
        {submissions.map((s) => {
          const date = new Date(Number(s.timestamp) * 1000).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id, s.lang)}
              className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-lg transition-colors text-left ${skin.card}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle size={13} className={`shrink-0 ${skin.check}`} />
                <div className="min-w-0">
                  <p className={`${skin.cardTitle} truncate`}>{s.langName ?? s.lang}</p>
                  <p className={skin.cardMeta}>{date}</p>
                </div>
              </div>
              <div className="text-right shrink-0 pl-2">
                <p className={skin.cardRightMain}>{s.runtime}</p>
                <p className={skin.cardRightSub}>{s.memory}</p>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}
