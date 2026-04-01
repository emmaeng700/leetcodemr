'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, Code2, BookOpen, ExternalLink, Loader2, Trophy, List } from 'lucide-react'
import { getProgress, updateProgress, addTimeSpent, completeReview, getStudyPlan } from '@/lib/db'
import { formatTime, isDue } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import toast from 'react-hot-toast'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  description?: string
  explanation?: string
  python_solution?: string
  cpp_solution?: string
}

function PremiumBlock({ slug }: { slug?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="font-bold text-gray-800 text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-gray-500 mb-4 leading-relaxed max-w-xs">
        This question requires a LeetCode Premium subscription to view the description.
        Your subscription may have lapsed or you may not have one active.
      </p>
      {slug && (
        <a
          href={`https://leetcode.com/problems/${slug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
        >
          Open on LeetCode ↗
        </a>
      )}
      <p className="text-xs text-gray-400 mt-3">You can still use the code editor on the right to practice.</p>
    </div>
  )
}

export default function PracticePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [showList, setShowList] = useState(false)
  const [solved, setSolved] = useState(false)
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState(false)
  const [leftTab, setLeftTab] = useState<'description' | 'solution' | 'accepted'>('description')

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(question?.slug, leftTab === 'accepted')
  const [mobilePanel, setMobilePanel] = useState<'description' | 'editor'>('description')
  const [timer, setTimer] = useState(0)

  // LeetCode live description state
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [lcFailed, setLcFailed] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())

  // Load local data immediately — no spinner blocking the page
  useEffect(() => {
    async function load() {
      const [qs, prog, plan] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
        getStudyPlan(),
      ])
      const q = (qs as Question[]).find((q: Question) => q.id === id)
      if (!q) return
      setQuestion(q)
      setAllQuestions(qs as Question[])
      if (plan?.question_order?.length) setPlanOrder(plan.question_order)
      else setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      setSolved(!!prog[String(id)]?.solved)
      setNextReview(prog[String(id)]?.next_review ?? null)
    }
    load()
  }, [id])

  // Fetch real LeetCode description in the background once we have the slug
  useEffect(() => {
    if (!question?.slug) return
    let cancelled = false
    setLcLoading(true)
    setLcFailed(false)
    setIsPremium(false)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const session  = localStorage.getItem('lc_session')  || ''
    const csrfToken = localStorage.getItem('lc_csrf')    || ''

    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        session, csrfToken,
        query: `query questionContent($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            content
            isPaidOnly
          }
        }`,
        variables: { titleSlug: question.slug },
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const q = data?.data?.question
        if (q?.isPaidOnly && !q?.content) {
          setIsPremium(true)
        } else if (q?.content) {
          setLcContent(q.content)
        } else {
          setLcFailed(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLcFailed(true)
      })
      .finally(() => {
        clearTimeout(timeout)
        if (!cancelled) setLcLoading(false)
      })

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeout)
    }
  }, [question?.slug])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    startRef.current = Date.now()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      const elapsed = Math.round((Date.now() - startRef.current) / 1000)
      if (elapsed > 5) addTimeSpent(id, elapsed)
    }
  }, [id])

  const due = isDue(nextReview) && solved

  async function handleCompleteReview() {
    if (reviewDone) return
    setReviewDone(true)
    const result = await completeReview(id)
    setNextReview(result.next_review)
    toast.success(`✓ Review done! Next review: ${result.next_review}`)
  }

  async function handleMarkSolved() {
    if (!question) return
    const newSolved = !solved
    setSolved(newSolved)
    await updateProgress(id, { solved: newSolved })
    toast.success(newSolved ? 'Marked as solved! 🎉' : 'Unmarked')
  }

  // Show skeleton top bar immediately, fill in once question loads
  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-gray-100 bg-white shrink-0 gap-2 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          {question ? (
            <>
              <span className="text-xs text-gray-400 font-mono shrink-0 hidden sm:inline">#{question.id}</span>
              <h1 className="font-bold text-gray-800 text-sm leading-snug truncate">{question.title}</h1>
              <div className="shrink-0 hidden sm:block"><DifficultyBadge difficulty={question.difficulty} /></div>
              <a
                href={`https://leetcode.com/problems/${question.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-gray-300 hover:text-orange-400 transition-colors hidden sm:inline"
                title="Open on LeetCode"
              >
                <ExternalLink size={12} />
              </a>
            </>
          ) : (
            <div className="h-4 w-32 sm:w-48 bg-gray-100 rounded animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Question list */}
          {planOrder.length > 0 && (() => {
            const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
            const currentIdx = planOrder.indexOf(id)
            const prevId = currentIdx > 0 ? planOrder[currentIdx - 1] : null
            const nextId = currentIdx < planOrder.length - 1 ? planOrder[currentIdx + 1] : null
            return (
              <div className="flex items-center gap-1">
                <button onClick={() => prevId && router.push(`/practice/${prevId}`)} disabled={!prevId}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
                  <ArrowLeft size={13} />
                </button>
                <div className="relative">
                  <button onClick={() => setShowList(v => !v)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 transition-colors">
                    <List size={12} />
                    <span className="font-mono hidden sm:inline">{currentIdx + 1}/{planOrder.length}</span>
                  </button>
                  {showList && (
                    <div className="absolute top-full right-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-[90vw] max-w-xs sm:w-80 max-h-80 overflow-y-auto">
                      {planOrder.map((qid, i) => {
                        const lq = qMap[qid]
                        if (!lq) return null
                        return (
                          <button key={qid} onClick={() => { router.push(`/practice/${qid}`); setShowList(false) }}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-indigo-50 border-b border-gray-50 transition-colors text-sm ${qid === id ? 'bg-indigo-50' : ''}`}>
                            <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{lq.id}</span>
                            <span className="flex-1 truncate text-gray-700">{lq.title}</span>
                            <span className={`text-xs font-semibold shrink-0 ${lq.difficulty === 'Easy' ? 'text-green-600' : lq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                              {lq.difficulty[0]}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <button onClick={() => nextId && router.push(`/practice/${nextId}`)} disabled={!nextId}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
                  <ArrowLeft size={13} className="rotate-180" />
                </button>
              </div>
            )
          })()}
          <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold text-gray-600">
            <Clock size={13} />
            {formatTime(timer)}
          </div>
          <button
            onClick={handleMarkSolved}
            disabled={!question}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors border disabled:opacity-40 ${
              solved
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-green-300'
            }`}
          >
            <CheckCircle size={13} className={solved ? 'fill-green-500 text-white' : ''} />
            <span className="hidden sm:inline">{solved ? 'Solved ✓' : 'Mark Solved'}</span>
            <span className="sm:hidden">{solved ? '✓' : 'Solve'}</span>
          </button>
        </div>
      </div>

      {/* Mobile panel tabs */}
      <div className="flex md:hidden border-b border-gray-100 bg-white shrink-0">
        <button onClick={() => setMobilePanel('description')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400'}`}>
          📖 Description
        </button>
        <button onClick={() => setMobilePanel('editor')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'editor' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400'}`}>
          💻 Editor
        </button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Question description */}
        <div className={`${mobilePanel === 'description' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[42%] md:shrink-0 border-r border-gray-100 overflow-hidden`}>
          {/* Tab bar */}
          <div className="flex border-b border-gray-100 bg-white shrink-0 items-center">
            <button
              onClick={() => setLeftTab('description')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                leftTab === 'description'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <BookOpen size={12} /> Description
              {/* Subtle live fetch indicator */}
              {lcLoading && (
                <Loader2 size={10} className="animate-spin text-gray-300 ml-1" />
              )}
            </button>
            {question && (question.python_solution || question.cpp_solution) && (
              <button
                onClick={() => setLeftTab('solution')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  leftTab === 'solution'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Code2 size={12} /> Solution
              </button>
            )}
            {question && (
              <button
                onClick={() => setLeftTab('accepted')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  leftTab === 'accepted'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Trophy size={12} /> My Solutions
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {leftTab === 'description' && (
              <>
                {/* Tags */}
                {question && (question.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {question.tags.map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}

                {/* Live LeetCode HTML content */}
                {lcContent ? (
                  <div className="prose prose-sm max-w-none text-gray-800 lc-description"
                    dangerouslySetInnerHTML={{ __html: lcContent }} />
                ) : isPremium ? (
                  <PremiumBlock slug={question?.slug} />
                ) : lcLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-5/6" />
                    <div className="h-3 bg-gray-100 rounded w-4/6" />
                    <div className="h-10 bg-gray-100 rounded w-full mt-4" />
                    <div className="h-3 bg-gray-100 rounded w-full" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-5/6" />
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

                {/* Company tags */}
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
                submissions={submissions}
                loading={subsLoading}
                selectedSub={selectedSub}
                subCodeLoading={subCodeLoading}
                copied={copiedSub}
                onSelect={loadSubCode}
                onCopy={copyCode}
                onBack={clearSub}
              />
            )}
          </div>
        </div>

        {/* RIGHT — LeetCode editor + tests */}
        <div className={`${mobilePanel === 'editor' ? 'flex flex-col' : 'hidden'} md:flex flex-1 min-h-0 overflow-x-hidden`}>
          {question ? (
            <LeetCodeEditor appQuestionId={question.id} slug={question.slug} onAccepted={due && !reviewDone ? handleCompleteReview : undefined} />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading editor...
            </div>
          )}
        </div>
      </div>

      {/* LeetCode description styles */}
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
