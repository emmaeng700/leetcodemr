'use client'
import { useState, useEffect, useRef } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, BookOpen, ExternalLink, Loader2, Trophy, List, Sparkles, Star } from 'lucide-react'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import { getProgress, updateProgress, addTimeSpent, completeReview, failReview, getStudyPlan, addMasteryRunEvent } from '@/lib/db'
import { formatTime, isDue, stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import DescriptionRenderer from '@/components/DescriptionRenderer'
import { getPatternForQuestion } from '@/lib/patternUtils'
import { checkAndRecordBreather } from '@/lib/breatherUtils'
import DifficultyBadge from '@/components/DifficultyBadge'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import toast from 'react-hot-toast'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'

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
          href={leetCodeUrl(slug)}
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
  const searchParams = useSearchParams()
  const flowMode = searchParams.get('from')
  const isReviewMode = flowMode === 'review'
  const isImbibitionMode = flowMode === 'imbibition'
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [planOrder, setPlanOrder] = useState<number[]>([])
  const [showList, setShowList] = useState(false)
  const [solved, setSolved] = useState(false)
  const [starred, setStarred] = useState(false)
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [reviewDone, setReviewDone] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'best' | 'accepted' | 'editor'>('description')

  const lcTitleSlug = question ? resolveLeetCodeSlug(question.id, question.slug) : undefined

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(lcTitleSlug, activeTab === 'accepted')
  const [timer, setTimer] = useState(0)
  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  // LeetCode live description state
  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [lcFailed, setLcFailed] = useState(false)
  const [lcFromCache, setLcFromCache] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const leftPanelTab = activeTab === 'editor' ? 'description' : activeTab

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())
  const progressRef = useRef<Record<string, { solved?: boolean }>>({})

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
      // In review mode, use the stored due queue so prev/next stays within the review session
      let modeQueue: number[] | null = null
      const queueKey = isReviewMode ? 'lm_review_queue' : isImbibitionMode ? 'lm_imbibition_queue' : null
      if (queueKey) {
        try {
          const stored = sessionStorage.getItem(queueKey)
          if (stored) modeQueue = JSON.parse(stored)
        } catch { /* ignore */ }
      }
      if (modeQueue) setPlanOrder(modeQueue)
      else if (plan?.question_order?.length) setPlanOrder(plan.question_order)
      else setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      setSolved(!!prog[String(id)]?.solved)
      setStarred(!!prog[String(id)]?.starred)
      setNextReview(prog[String(id)]?.next_review ?? null)
      progressRef.current = prog
    }
    load()
  }, [id, isImbibitionMode, isReviewMode])

  useEffect(() => {
    if (!question) return
    setOpenQuestionContext({ id: question.id, slug: question.slug, title: question.title })
  }, [question])

  // Fetch real LeetCode description in the background once we have the slug.
  // Reads session from localStorage first; if empty falls back to Supabase
  // so the live HTML loads correctly even when the user hasn't visited
  // the LeetCode page yet in this browser session.
  useEffect(() => {
    if (!question?.slug) return
    let cancelled = false
    setLcLoading(true)
    setLcFailed(false)
    setLcFromCache(false)
    setIsPremium(false)

    async function doFetch() {
      // Resolve session — localStorage first, Supabase fallback
      let session  = localStorage.getItem('lc_session')  || ''
      let csrfToken = localStorage.getItem('lc_csrf')    || ''
      if (!session || !csrfToken) {
        try {
          const d = await fetch('/api/lc-session').then(r => r.json())
          if (d.lc_session && d.lc_csrf) {
            session = d.lc_session; csrfToken = d.lc_csrf
            localStorage.setItem('lc_session', session)
            localStorage.setItem('lc_csrf', csrfToken)
          }
        } catch { /* ignore — will try without session */ }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)

      try {
        const res = await fetch('/api/leetcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            session, csrfToken,
            query: `query questionContent($titleSlug: String!) {
              question(titleSlug: $titleSlug) { content isPaidOnly }
            }`,
            variables: { titleSlug: resolveLeetCodeSlug(question!.id, question!.slug) },
          }),
        })
        const data = await res.json()
        if (cancelled) return
        const q = data?.data?.question
        if (q?.isPaidOnly && !q?.content) {
          setIsPremium(true)
        } else if (q?.content) {
          setLcContent(q.content)
        } else {
          setLcFailed(true)
          if (!cancelled && question?.description) setLcFromCache(true)
        }
      } catch {
        if (!cancelled) { setLcFailed(true); if (question?.description) setLcFromCache(true) }
      } finally {
        clearTimeout(timeout)
        if (!cancelled) setLcLoading(false)
      }
    }

    doFetch()
    return () => { cancelled = true }
  }, [question?.id, question?.slug])

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

  async function handleAcceptedRun() {
    if (!question) return
    const res = await addMasteryRunEvent(question.id, 1)
    if (!res.ok) {
      toast.error(`Couldn't save mastery run: ${res.error ?? 'unknown error'}`)
      return
    }
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
    progressRef.current = { ...progressRef.current, [String(id)]: { ...progressRef.current[String(id)], solved: newSolved } }
    await updateProgress(id, { solved: newSolved })
    if (newSolved) {
      const completed = checkAndRecordBreather(id, allQuestions, progressRef.current)
      if (completed) {
        toast.success(`🎉 ${completed} pattern complete! Take 2 days to revise before moving on.`, { duration: 5000 })
      } else {
        const pattern = getPatternForQuestion(question.tags ?? [])
        const SOLVE_MSGS = [
          `${pattern ? `${pattern} pattern ` : ''}locked in! Keep the streak alive 🔥`,
          `One more down${pattern ? ` in ${pattern}` : ''}! You're building real pattern recognition 🧠`,
          `${pattern ?? 'Question'} solved — each rep makes the next one easier 💪`,
          `Another one bites the dust${pattern ? ` (${pattern})` : ''}! Stay consistent 🚀`,
          `Nailed it${pattern ? ` — ${pattern} is getting clearer` : ''}! That muscle memory is building 🏆`,
        ]
        toast.success(SOLVE_MSGS[Math.floor(Math.random() * SOLVE_MSGS.length)], { duration: 3500 })
      }
    } else {
      toast.success('Unmarked')
    }
  }

  // Show skeleton top bar immediately, fill in once question loads
  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex flex-wrap items-center px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 gap-x-2 gap-y-1">
        {/* Back button */}
        <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>

        {/* Title — own full-width line on mobile, inline on sm+ */}
        {question ? (
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0 hidden sm:inline">#{question.id}</span>
            <h1 className="font-bold text-[var(--text)] text-sm leading-snug">{question.title}</h1>
            <div className="shrink-0 hidden sm:block"><DifficultyBadge difficulty={question.difficulty} /></div>
            <a
              href={leetCodeUrl(lcTitleSlug)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-[var(--text-muted)] hover:text-orange-400 transition-colors hidden sm:inline"
              title="Open on LeetCode"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="order-last w-full sm:order-none h-4 w-32 sm:w-48 bg-[var(--bg-muted)] rounded animate-pulse" />
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0 overflow-visible">
          {/* Question list */}
          {planOrder.length > 0 && (() => {
            const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))
            const currentIdx = planOrder.indexOf(id)
            const prevId = currentIdx > 0 ? planOrder[currentIdx - 1] : null
            const nextId = currentIdx < planOrder.length - 1 ? planOrder[currentIdx + 1] : null
            const navSuffix = isReviewMode ? '?from=review' : isImbibitionMode ? '?from=imbibition' : ''
            const practiceListItems = planOrder.map((qid) => {
              const lq = qMap[qid]
              if (!lq) return null
              return (
                <button
                  key={qid}
                  type="button"
                  onClick={() => { router.push(`/practice/${qid}${navSuffix}`); setShowList(false) }}
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
                {isReviewMode && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold shrink-0">
                    🔁 Review
                  </span>
                )}
                {isImbibitionMode && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold shrink-0">
                    🧠 Imbibition
                  </span>
                )}
                <button onClick={() => prevId && router.push(`/practice/${prevId}${navSuffix}`)} disabled={!prevId}
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
                <button onClick={() => nextId && router.push(`/practice/${nextId}${navSuffix}`)} disabled={!nextId}
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
            onClick={() => { const n = !starred; setStarred(n); updateProgress(id, { starred: n }) }}
            disabled={!question}
            className={`p-1.5 rounded-lg border transition-colors disabled:opacity-40 ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-[var(--bg-muted)] border-[var(--border)] hover:border-yellow-300'}`}
            aria-label={starred ? 'Unstar' : 'Star'}
          >
            <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
          </button>
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
        <div className="px-3 sm:px-4 py-2 border-b border-[var(--border)] bg-indigo-50/60  shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs font-semibold text-indigo-700 ">
              🧠 Spaced repetition review due
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleFailReview}
                disabled={reviewDone}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200  bg-white (--bg-card)] text-indigo-700  hover:border-indigo-300  disabled:opacity-50"
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

      {/* Pattern context strip */}
      {question && (() => { const p = getPatternForQuestion(question.tags ?? []); return p ? (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🧩</span>
          <span className="text-xs font-semibold text-[var(--text)]">{p}</span>
        </div>
      ) : null })()}

      {/* Unified tab bar */}
      <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 scrollbar-none">
        <button onClick={() => setActiveTab('description')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          <BookOpen size={12} /> Description
          {lcLoading && <Loader2 size={10} className="animate-spin text-[var(--text-muted)]" />}
          {lcFromCache && !lcLoading && <span className="text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 border border-amber-200 font-bold">Cached</span>}
        </button>
        {question && (
          <button onClick={() => setActiveTab('best')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'best' ? 'border-amber-500 text-amber-600 ' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <Sparkles size={12} /> Best answers
          </button>
        )}
        {question && (
          <button onClick={() => setActiveTab('accepted')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'accepted' ? 'border-green-500 text-green-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <Trophy size={12} /> My Solutions
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Description panel (all non-editor tabs) */}
        <div className="flex flex-col w-full md:w-[42%] md:shrink-0 bg-[var(--bg-card)] overflow-hidden text-[var(--text)] border-r border-[var(--border)]">
          <div className="flex-1 overflow-y-auto p-4">
            {leftPanelTab === 'description' && (
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
                  <PremiumBlock slug={lcTitleSlug} />
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
                  /* Live fetch failed — render cached plain-text description
                     with the same parser used on the learn page */
                  question?.description
                    ? <DescriptionRenderer description={question.description} />
                    : <span className="text-[var(--text-subtle)] italic text-xs">
                        Description unavailable.{' '}
                        <a href={leetCodeUrl(lcTitleSlug)} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                      </span>
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

            {leftPanelTab === 'best' && question && (
              <BestAnswersPanel questionId={question.id} slug={lcTitleSlug ?? question.slug} active={leftPanelTab === 'best'} />
            )}

            {leftPanelTab === 'accepted' && (
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

        {/* Editor panel */}
        <div className="flex flex-col w-full md:w-[58%] flex-1 min-h-[28rem] overflow-x-hidden border-t border-[var(--border)] md:border-t-0">
          {question ? (
            <LeetCodeEditor
              appQuestionId={question.id}
              slug={question.slug}
              onAccepted={async () => {
                await handleAcceptedRun()
                if (due && !reviewDone) await handleCompleteReview()
              }}
            />
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
