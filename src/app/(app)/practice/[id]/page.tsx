'use client'
import { useState, useEffect, useRef } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, Code2, BookOpen, ExternalLink, Loader2, Trophy, List } from 'lucide-react'
import { getProgress, updateProgress, addTimeSpent, completeReview, failReview, getStudyPlan } from '@/lib/db'
import { formatTime, isDue, stripScripts} from '@/lib/utils'
import { getPatternForQuestion } from '@/lib/patternUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import toast from 'react-hot-toast'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'

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
      <h3 className="font-bold text-[var(--text)] text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4 leading-relaxed max-w-xs">
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
      <p className="text-xs text-[var(--text-subtle)] mt-3">You can still use the code editor on the right to practice.</p>
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
  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

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

  async function handleFailReview() {
    if (reviewDone) return
    setReviewDone(true)
    const result = await failReview(id)
    setNextReview(result.next_review)
    toast(`Again scheduled — next review: ${result.next_review}`)
  }

  async function handleMarkSolved() {
    if (!question) return
    const newSolved = !solved
    setSolved(newSolved)
    await updateProgress(id, { solved: newSolved })
    if (newSolved) {
      const pattern = getPatternForQuestion(question.tags ?? [])
      const SOLVE_MSGS = [
        `${pattern ? `${pattern} pattern ` : ''}locked in! Keep the streak alive 🔥`,
        `One more down${pattern ? ` in ${pattern}` : ''}! You're building real pattern recognition 🧠`,
        `${pattern ?? 'Question'} solved — each rep makes the next one easier 💪`,
        `Another one bites the dust${pattern ? ` (${pattern})` : ''}! Stay consistent 🚀`,
        `Nailed it${pattern ? ` — ${pattern} is getting clearer` : ''}! That muscle memory is building 🏆`,
      ]
      const msg = SOLVE_MSGS[Math.floor(Math.random() * SOLVE_MSGS.length)]
      toast.success(msg, { duration: 3500 })
    } else {
      toast.success('Unmarked')
    }
  }

  // Show skeleton top bar immediately, fill in once question loads
  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 gap-2 sm:gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          {question ? (
            <>
              <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0 hidden sm:inline">#{question.id}</span>
              <h1 className="font-bold text-[var(--text)] text-sm leading-snug truncate">{question.title}</h1>
              <div className="shrink-0 hidden sm:block"><DifficultyBadge difficulty={question.difficulty} /></div>
              <a
                href={`https://leetcode.com/problems/${question.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[var(--text-muted)] hover:text-orange-400 transition-colors hidden sm:inline"
                title="Open on LeetCode"
              >
                <ExternalLink size={12} />
              </a>
            </>
          ) : (
            <div className="h-4 w-32 sm:w-48 bg-[var(--bg-muted)] rounded animate-pulse" />
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 overflow-visible">
          {/* Question list */}
          {planOrder.length > 0 && (() => {
            const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
            const currentIdx = planOrder.indexOf(id)
            const prevId = currentIdx > 0 ? planOrder[currentIdx - 1] : null
            const nextId = currentIdx < planOrder.length - 1 ? planOrder[currentIdx + 1] : null
            const practiceListItems = planOrder.map((qid) => {
              const lq = qMap[qid]
              if (!lq) return null
              return (
                <button
                  key={qid}
                  type="button"
                  onClick={() => { router.push(`/practice/${qid}`); setShowList(false) }}
                  className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-indigo-600/10 border-b border-[var(--border-soft)] ${qid === id ? 'bg-indigo-600/15' : ''}`}
                >
                  <span className="shrink-0 tabular-nums text-xs font-mono text-[var(--text-subtle)]">#{lq.id}</span>
                  <span className="min-w-0 flex-1 truncate text-[var(--text)]">{lq.title}</span>
                  <span
                    className={`text-xs font-semibold shrink-0 ${lq.difficulty === 'Easy' ? 'text-green-600' : lq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}
                  >
                    {lq.difficulty[0]}
                  </span>
                </button>
              )
            })
            return (
              <div className="flex items-center gap-1">
                <button onClick={() => prevId && router.push(`/practice/${prevId}`)} disabled={!prevId}
                  className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-30 transition-colors bg-[var(--bg-muted)]">
                  <ArrowLeft size={13} />
                </button>
                <div ref={listWrapRef} className="relative z-10">
                  <button type="button" onClick={() => setShowList(v => !v)}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-indigo-500/50 transition-colors bg-[var(--bg-muted)]">
                    <List size={12} />
                    <span className="font-mono">{currentIdx + 1}/{planOrder.length}</span>
                  </button>
                  {showList && (
                    <>
                      <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
                      <div className={listDropdownMobilePanelClasses('right')}>{practiceListItems}</div>
                    </>
                  )}
                </div>
                <button onClick={() => nextId && router.push(`/practice/${nextId}`)} disabled={!nextId}
                  className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-30 transition-colors bg-[var(--bg-muted)]">
                  <ArrowLeft size={13} className="rotate-180" />
                </button>
              </div>
            )
          })()}
          <div className="hidden sm:flex items-center gap-1.5 bg-[var(--bg-muted)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-sm font-mono font-semibold text-[var(--text-muted)]">
            <Clock size={13} />
            {formatTime(timer)}
          </div>
          <button
            onClick={handleMarkSolved}
            disabled={!question}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors border disabled:opacity-40 ${
              solved
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-500/50 hover:text-green-400'
            }`}
          >
            <CheckCircle size={13} className={solved ? 'fill-green-500 text-white' : ''} />
            <span className="hidden sm:inline">{solved ? 'Solved ✓' : 'Mark Solved'}</span>
            <span className="sm:hidden">{solved ? '✓' : 'Solve'}</span>
          </button>
        </div>
      </div>

      {/* SR review actions */}
      {due && (
        <div className="px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-indigo-50/60 dark:bg-indigo-950/30 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              🧠 Spaced repetition review due
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFailReview}
                disabled={reviewDone}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-[var(--bg-card)] text-indigo-700 dark:text-indigo-300 hover:border-indigo-300 dark:hover:border-indigo-400/60 disabled:opacity-50"
              >
                Again
              </button>
              <button
                onClick={handleCompleteReview}
                disabled={reviewDone}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile panel tabs */}
      <div className="flex md:hidden border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        <button onClick={() => setMobilePanel('description')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)]'}`}>
          📖 Description
        </button>
        <button onClick={() => setMobilePanel('editor')}
          className={`flex-1 py-2.5 text-xs font-semibold border-b-2 transition-colors ${mobilePanel === 'editor' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)]'}`}>
          💻 Editor
        </button>
      </div>

      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Question description */}
        <div className={`${mobilePanel === 'description' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[42%] md:shrink-0 border-r border-[var(--border)] bg-[var(--bg-card)] overflow-hidden text-[var(--text)]`}>
          {/* Tab bar */}
          <div className="flex border-b border-[var(--border)] bg-[var(--bg-card)]/80 shrink-0 items-center">
            <button
              onClick={() => setLeftTab('description')}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                leftTab === 'description'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
              }`}
            >
              <BookOpen size={12} /> Description
              {/* Subtle live fetch indicator */}
              {lcLoading && (
                <Loader2 size={10} className="animate-spin text-[var(--text-muted)] ml-1" />
              )}
            </button>
            {question && (question.python_solution || question.cpp_solution) && (
              <button
                onClick={() => setLeftTab('solution')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                  leftTab === 'solution'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
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
                    : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'
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
                      <span key={t} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}

                {/* Live LeetCode HTML content */}
                {lcContent ? (
                  <div className="lc-description text-sm text-[var(--text)]"
                    dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                ) : isPremium ? (
                  <PremiumBlock slug={question?.slug} />
                ) : lcLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                    <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-4" />
                    <div className="h-3 bg-slate-700 rounded w-full" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-3/4" />
                    <div className="h-3 bg-slate-700 rounded w-5/6" />
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                    {question?.description || (
                      <span className="text-[var(--text-subtle)] italic text-xs">
                        Description unavailable.{' '}
                        <a href={`https://leetcode.com/problems/${question?.slug}/`} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                      </span>
                    )}
                  </div>
                )}

                {/* Company tags */}
                {question && (question.source || []).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <p className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Asked by</p>
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
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading editor...
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
