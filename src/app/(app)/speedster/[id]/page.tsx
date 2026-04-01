'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, BookOpen, Code2, ExternalLink, Loader2, Trophy, Gauge, List } from 'lucide-react'
import { getStudyPlan } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  description?: string
  python_solution?: string
  cpp_solution?: string
}

function PremiumBlock({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-bold text-gray-800 text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-gray-500 mb-4 max-w-xs">Requires a LeetCode Premium subscription.</p>
      {slug && (
        <a href={`https://leetcode.com/problems/${slug}/`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
          Open on LeetCode ↗
        </a>
      )}
    </div>
  )
}

export default function SpeedsterQuestionPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [showList, setShowList] = useState(false)
  const [leftTab, setLeftTab] = useState<'description' | 'solution' | 'accepted'>('description')
  const [mobilePanel, setMobilePanel] = useState<'description' | 'editor'>('description')

  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [lcFailed, setLcFailed] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(question?.slug, leftTab === 'accepted')

  useEffect(() => {
    async function load() {
      const [qs, plan] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getStudyPlan(),
      ])
      const q = (qs as Question[]).find((q: Question) => q.id === id)
      if (!q) return
      setQuestion(q)
      setAllQuestions(qs as Question[])
      if (plan?.question_order?.length) setPlanOrder(plan.question_order)
      else setPlanOrder((qs as Question[]).map((q: Question) => q.id))
    }
    load()
  }, [id])

  // Fetch live description
  useEffect(() => {
    if (!question?.slug) return
    let cancelled = false
    setLcLoading(true); setLcFailed(false); setIsPremium(false)
    setLcContent(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    const session = localStorage.getItem('lc_session') || ''
    const csrfToken = localStorage.getItem('lc_csrf') || ''
    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) { question(titleSlug: $titleSlug) { content isPaidOnly } }`,
        variables: { titleSlug: question.slug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const q = data?.data?.question
        if (q?.isPaidOnly && !q?.content) setIsPremium(true)
        else if (q?.content) setLcContent(q.content)
        else setLcFailed(true)
      })
      .catch(() => { if (!cancelled) setLcFailed(true) })
      .finally(() => { clearTimeout(timeout); if (!cancelled) setLcLoading(false) })
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout) }
  }, [question?.slug])

  // Derive index directly from plan order — no URL param needed
  const currentIdx = planOrder.indexOf(id)
  const prevId = currentIdx >= 0 ? planOrder[(currentIdx - 1 + planOrder.length) % planOrder.length] ?? null : null
  const nextId = currentIdx >= 0 ? planOrder[(currentIdx + 1) % planOrder.length] ?? null : null

  function goTo(qid: number) {
    router.push(`/speedster/${qid}`)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 bg-white shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.push('/speedster')} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-lg shrink-0">
            <Gauge size={11} className="text-yellow-600" />
            <span className="text-xs font-bold text-yellow-700">Speedster</span>
          </div>
          {question ? (
            <>
              <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:inline">#{question.id}</span>
              <h1 className="font-bold text-gray-800 text-sm leading-snug truncate">{question.title}</h1>
              <div className="shrink-0 hidden sm:block"><DifficultyBadge difficulty={question.difficulty} /></div>
              <a href={`https://leetcode.com/problems/${question.slug}/`} target="_blank" rel="noopener noreferrer"
                className="shrink-0 text-gray-300 hover:text-orange-400 transition-colors hidden sm:inline">
                <ExternalLink size={12} />
              </a>
            </>
          ) : (
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          )}
        </div>

        {/* Prev / List / Next */}
        {planOrder.length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => prevId && goTo(prevId)} disabled={!prevId}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div className="relative">
              <button onClick={() => setShowList(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-yellow-300 transition-colors">
                <List size={12} />
                <span className="font-mono">{currentIdx >= 0 ? `${currentIdx + 1}/${planOrder.length}` : '—'}</span>
              </button>
              {showList && (() => {
                const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
                return (
                  <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-[90vw] max-w-xs sm:w-80 max-h-80 overflow-y-auto">
                    {planOrder.map((qid) => {
                      const lq = qMap[qid]
                      if (!lq) return null
                      return (
                        <button key={qid} onClick={() => { goTo(qid); setShowList(false) }}
                          className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-yellow-50 border-b border-gray-50 transition-colors text-sm ${qid === id ? 'bg-yellow-50' : ''}`}>
                          <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{lq.id}</span>
                          <span className="flex-1 truncate text-gray-700">{lq.title}</span>
                          <span className={`text-xs font-semibold shrink-0 ${lq.difficulty === 'Easy' ? 'text-green-600' : lq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                            {lq.difficulty[0]}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
            <button onClick={() => nextId && goTo(nextId)} disabled={!nextId}
              className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-yellow-300 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Mobile panel tabs */}
      <div className="flex md:hidden border-b border-gray-100 bg-white shrink-0">
        <button onClick={() => setMobilePanel('description')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'description' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400'}`}>
          📖 Description
        </button>
        <button onClick={() => setMobilePanel('editor')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'editor' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400'}`}>
          💻 Editor
        </button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT */}
        <div className={`${mobilePanel === 'description' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[42%] md:shrink-0 border-r border-gray-100 overflow-hidden`}>
          <div className="flex border-b border-gray-100 bg-white shrink-0 items-center">
            <button onClick={() => setLeftTab('description')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'description' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <BookOpen size={12} /> Description
              {lcLoading && <Loader2 size={10} className="animate-spin text-gray-300 ml-1" />}
            </button>
            {question && (question.python_solution || question.cpp_solution) && (
              <button onClick={() => setLeftTab('solution')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'solution' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Code2 size={12} /> Solution
              </button>
            )}
            {question && (
              <button onClick={() => setLeftTab('accepted')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'accepted' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <Trophy size={12} /> My Solutions
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {leftTab === 'description' && (
              <>
                {question && (question.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {question.tags.map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                {lcContent ? (
                  <div className="prose prose-sm max-w-none text-gray-800 lc-description" dangerouslySetInnerHTML={{ __html: lcContent }} />
                ) : isPremium ? (
                  <PremiumBlock slug={question?.slug} />
                ) : lcLoading ? (
                  <div className="space-y-3 animate-pulse">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: `${70 + i * 5}%` }} />)}
                  </div>
                ) : (
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {question?.description || (
                      <span className="text-gray-400 italic text-xs">
                        Description unavailable.{' '}
                        <a href={`https://leetcode.com/problems/${question?.slug}/`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                      </span>
                    )}
                  </div>
                )}
                {question && (question.source || []).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Asked by</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.source.map(s => (
                        <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {leftTab === 'solution' && question && (
              <CodePanel pythonCode={question.python_solution} cppCode={question.cpp_solution} />
            )}
            {leftTab === 'accepted' && (
              <AcceptedSolutions
                submissions={submissions} loading={subsLoading} selectedSub={selectedSub}
                subCodeLoading={subCodeLoading} copied={copiedSub}
                onSelect={loadSubCode} onCopy={copyCode} onBack={clearSub}
              />
            )}
          </div>

        </div>

        {/* RIGHT — editor */}
        <div className={`${mobilePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-1 min-h-0 overflow-x-hidden`}>
          {question ? (
            <LeetCodeEditor appQuestionId={question.id} slug={question.slug} speedster />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading editor...
            </div>
          )}
        </div>
      </div>

      <style>{`
        .lc-description pre { background: #f6f8fa; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 12px; margin: 8px 0; }
        .lc-description code { background: #f0f0f0; border-radius: 3px; padding: 1px 4px; font-size: 12px; }
        .lc-description pre code { background: none; padding: 0; }
        .lc-description p { margin: 6px 0; font-size: 13px; line-height: 1.6; }
        .lc-description ul, .lc-description ol { padding-left: 20px; margin: 6px 0; font-size: 13px; }
        .lc-description li { margin: 3px 0; }
        .lc-description strong { font-weight: 600; }
        .lc-description img { max-width: 100%; border-radius: 6px; margin: 8px 0; }
        .lc-description .example-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin: 10px 0; }
        .lc-description sup { font-size: 10px; }
      `}</style>
    </div>
  )
}
