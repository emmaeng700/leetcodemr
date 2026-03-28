'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Copy, Check, Loader2, Trophy } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

interface Sub { id: string; lang: string; langName: string; runtime: string; memory: string; timestamp: string }

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

export default function AcceptedSolutions({ submissions, loading, selectedSub, subCodeLoading, copied, onSelect, onCopy, onBack }: {
  submissions: Sub[]
  loading: boolean
  selectedSub: { code: string; lang: string } | null
  subCodeLoading: boolean
  copied: boolean
  onSelect: (id: string, lang: string) => void
  onCopy: () => void
  onBack: () => void
}) {
  const codeRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (codeRef.current && selectedSub?.code) {
      codeRef.current.removeAttribute('data-highlighted')
      codeRef.current.textContent = selectedSub.code
      if (selectedSub.lang === 'python' || selectedSub.lang === 'cpp') hljs.highlightElement(codeRef.current)
    }
  }, [selectedSub])

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-indigo-400" /></div>

  if (!loading && submissions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <Trophy size={22} className="text-gray-300" />
      <p className="text-sm text-gray-500">No accepted submissions yet.</p>
      <p className="text-xs text-gray-400">Solve it and come back here!</p>
    </div>
  )

  if (subCodeLoading) return <div className="flex items-center justify-center py-12"><Loader2 size={18} className="animate-spin text-green-500" /></div>

  if (selectedSub) return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors">← Back</button>
        <button onClick={onCopy} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors">
          {copied ? <><Check size={12} className="text-green-500" /> Copied!</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <div className="rounded-xl overflow-hidden border border-gray-200 flex-1 min-h-0">
        <div className="bg-[#21252b] px-4 py-2">
          <span className="text-xs font-semibold text-gray-400">{selectedSub.lang === 'cpp' ? 'C++' : selectedSub.lang === 'python' ? 'Python 3' : selectedSub.lang}</span>
        </div>
        <div className="overflow-auto bg-[#282c34] h-full">
          <pre className="p-4 text-[12px] leading-relaxed m-0">
            <code ref={codeRef} className={`language-${selectedSub.lang}`}>{selectedSub.code}</code>
          </pre>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 mb-3">Last 3 accepted submissions — click to view code</p>
      {submissions.map((s) => {
        const date = new Date(Number(s.timestamp) * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        return (
          <button key={s.id} onClick={() => onSelect(s.id, s.lang)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-green-50 border border-green-100 rounded-lg hover:border-green-300 hover:bg-green-100 transition-colors text-left">
            <div className="flex items-center gap-2">
              <CheckCircle size={13} className="text-green-500 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-700">{s.langName ?? s.lang}</p>
                <p className="text-xs text-gray-400">{date}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{s.runtime}</p>
              <p className="text-xs text-gray-400">{s.memory}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
