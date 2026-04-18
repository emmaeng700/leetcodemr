'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { stripScripts, leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'
import { getPatternForQuestion } from '@/lib/patternUtils'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useParams, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { listDropdownMobileBackdrop, listDropdownMobilePanelClasses } from '@/lib/listDropdownUi'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Loader2, Trophy, Gauge, List, Sparkles, StickyNote, Star } from 'lucide-react'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import WhiteboardNotes from '@/components/WhiteboardNotes'
import { addMasteryRunEvent, getStudyPlan, getProgress, updateProgress } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
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
      <h3 className="font-bold text-[var(--text)] text-base mb-1">LeetCode Premium Question</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4 max-w-xs">Requires a LeetCode Premium subscription.</p>
      {slug && (
        <a href={leetCodeUrl(slug)} target="_blank" rel="noopener noreferrer"
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
  const [starred, setStarred] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'best' | 'notes' | 'accepted' | 'editor'>('description')

  const [lcContent, setLcContent] = useState<string | null>(null)
  const [lcLoading, setLcLoading] = useState(false)
  const [lcFailed, setLcFailed] = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  const lcTitleSlug = useMemo(
    () => (question ? resolveLeetCodeSlug(question.id, question.slug) : undefined),
    [question],
  )

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } = useAcceptedSolutions(lcTitleSlug, activeTab === 'accepted')

  const listWrapRef = useRef<HTMLDivElement>(null)
  useClickOutside(listWrapRef, () => setShowList(false), showList)

  useEffect(() => {
    async function load() {
      const [qs, plan, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getStudyPlan(),
        getProgress(),
      ])
      const q = (qs as Question[]).find((q: Question) => q.id === id)
      if (!q) return
      setQuestion(q)
      setAllQuestions(qs as Question[])
      if (plan?.question_order?.length) setPlanOrder(plan.question_order)
      else setPlanOrder((qs as Question[]).map((q: Question) => q.id))
      setStarred(!!prog[String(id)]?.starred)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!question) return
    setOpenQuestionContext({ id: question.id, slug: question.slug, title: question.title })
  }, [question])

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
        variables: { titleSlug: resolveLeetCodeSlug(question.id, question.slug) },
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
  }, [question?.id, question?.slug])

  // Derive index directly from plan order — no URL param needed
  const currentIdx = planOrder.indexOf(id)
  const prevId = currentIdx >= 0 ? planOrder[(currentIdx - 1 + planOrder.length) % planOrder.length] ?? null : null
  const nextId = currentIdx >= 0 ? planOrder[(currentIdx + 1) % planOrder.length] ?? null : null

  function goTo(qid: number) {
    router.push(`/speedster/${qid}`)
  }

  const qMap = Object.fromEntries(allQuestions.map(q => [q.id, q]))

  const speedsterQuestionListItems = planOrder.map((qid) => {
    const lq = qMap[qid]
    if (!lq) return null
    return (
      <button
        key={qid}
        type="button"
        onClick={() => { goTo(qid); setShowList(false) }}
        className={`flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-yellow-50  border-b border-[var(--border-soft)] ${qid === id ? 'bg-yellow-50 ' : ''}`}
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
    <div className="flex flex-col h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex flex-wrap items-center px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 gap-x-2 gap-y-1">
        {/* Back + badge */}
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => router.push('/speedster')} className="text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 px-1.5 sm:px-2 py-0.5 rounded-lg shrink-0">
            <Gauge size={11} className="text-yellow-600" />
            <span className="hidden sm:inline text-xs font-bold text-yellow-700">Speedster</span>
          </div>
        </div>

        {/* Prev / List / Next — stays on same line as back+badge on mobile (ml-auto), inline on sm+ */}
        {planOrder.length > 0 && (
          <div className="ml-auto flex items-center gap-1 shrink-0 overflow-visible">
            <button type="button" onClick={() => prevId && goTo(prevId)} disabled={!prevId}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-yellow-300 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ArrowLeft size={15} />
            </button>
            <div ref={listWrapRef} className="relative z-10">
              <button type="button" onClick={() => setShowList(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] hover:border-yellow-300 transition-colors">
                <List size={12} />
                <span className="font-mono">{currentIdx >= 0 ? `${currentIdx + 1}/${planOrder.length}` : '—'}</span>
              </button>
              {showList && (
                <>
                  <div className={listDropdownMobileBackdrop} aria-hidden onClick={() => setShowList(false)} />
                  <div className={listDropdownMobilePanelClasses('right')}>{speedsterQuestionListItems}</div>
                </>
              )}
            </div>
            <button onClick={() => nextId && goTo(nextId)} disabled={!nextId}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-yellow-300 hover:text-yellow-600 disabled:opacity-30 transition-colors">
              <ArrowRight size={15} />
            </button>
          </div>
        )}

        {/* Star */}
        {question && (
          <button
            onClick={() => { const n = !starred; setStarred(n); updateProgress(id, { starred: n }) }}
            className={`p-1.5 rounded-lg border transition-colors shrink-0 ${starred ? 'bg-yellow-50 border-yellow-200' : 'border-[var(--border)] hover:border-yellow-300'}`}
            aria-label={starred ? 'Unstar' : 'Star'}
          >
            <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
          </button>
        )}

        {/* Title — own full-width line on mobile, inline on sm+ */}
        {question ? (
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0 hidden sm:inline">#{question.id}</span>
            <h1 className="font-bold text-[var(--text)] text-sm leading-snug">{question.title}</h1>
            <div className="shrink-0 hidden sm:block"><DifficultyBadge difficulty={question.difficulty} /></div>
            <a href={leetCodeUrl(lcTitleSlug!)} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-gray-300 hover:text-orange-400 transition-colors hidden sm:inline">
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="order-last w-full sm:order-none h-4 w-32 bg-gray-100 rounded animate-pulse" />
        )}
      </div>

      {/* Pattern context strip */}
      {question && (() => { const p = getPatternForQuestion(question.tags ?? []); return p ? (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[var(--border)] bg-[var(--bg-muted)]/60 shrink-0">
          <span className="text-[11px] font-bold text-[var(--text-subtle)] uppercase tracking-wide shrink-0">🧩</span>
          <span className="text-xs font-semibold text-[var(--text)]">{p}</span>
        </div>
      ) : null })()}

      {/* Unified tab bar */}
      <div className="flex overflow-x-auto scrollbar-none border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        <button onClick={() => setActiveTab('description')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${activeTab === 'description' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          <BookOpen size={12} /> Description
          {lcLoading && <Loader2 size={10} className="animate-spin text-[var(--text-muted)]" />}
        </button>
        {question && (
          <button onClick={() => setActiveTab('best')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${activeTab === 'best' ? 'border-amber-500 text-amber-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <Sparkles size={12} /> Best answers
          </button>
        )}
        {question && (
          <button onClick={() => setActiveTab('notes')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${activeTab === 'notes' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <StickyNote size={12} /> Notes
          </button>
        )}
        {question && (
          <button onClick={() => setActiveTab('accepted')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${activeTab === 'accepted' ? 'border-green-500 text-green-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
            <Trophy size={12} /> My Solutions
          </button>
        )}
        <button onClick={() => setActiveTab('editor')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${activeTab === 'editor' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          💻 Editor
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Description panel */}
        <div className={`${activeTab !== 'editor' ? 'flex' : 'hidden'} flex-col w-full flex-1 bg-[var(--bg-card)] overflow-hidden text-[var(--text)]`}>
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'description' && (
              <>
                {question && (question.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {question.tags.map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                {lcContent ? (
                  <div className="lc-description text-sm text-[var(--text)]" dangerouslySetInnerHTML={{ __html: stripScripts(lcContent) }} />
                ) : isPremium ? (
                  <PremiumBlock slug={lcTitleSlug} />
                ) : lcLoading ? (
                  <div className="space-y-3 animate-pulse">
                    {[1,2,3,4,5].map(i => <div key={i} className="h-3 bg-gray-100 rounded" style={{ width: `${70 + i * 5}%` }} />)}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                    {question?.description || (
                      <span className="text-[var(--text-subtle)] italic text-xs">
                        Description unavailable.{' '}
                        <a href={leetCodeUrl(lcTitleSlug!)} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                      </span>
                    )}
                  </div>
                )}
                {question && (question.source || []).length > 0 && (
                  <div className="mt-6 pt-4 border-t border-[var(--border)]">
                    <p className="text-xs font-semibold text-[var(--text-subtle)] uppercase tracking-wide mb-2">Asked by</p>
                    <div className="flex flex-wrap gap-1.5">
                      {question.source.map(s => (
                        <span key={s} className="text-xs bg-blue-50  text-blue-600  px-2 py-0.5 rounded-full font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            {activeTab === 'notes' && question && (
              <WhiteboardNotes storageKey={`lm_whiteboard:${question.id}:${question.slug}`} />
            )}
            {activeTab === 'best' && question && (
              <BestAnswersPanel questionId={question.id} slug={lcTitleSlug ?? question.slug} active={activeTab === 'best'} />
            )}
            {activeTab === 'accepted' && (
              <AcceptedSolutions
                submissions={submissions} loading={subsLoading} selectedSub={selectedSub}
                subCodeLoading={subCodeLoading} copied={copiedSub}
                onSelect={loadSubCode} onCopy={copyCode} onBack={clearSub}
              />
            )}
          </div>

        </div>

        {/* Editor panel */}
        <div className={`${activeTab === 'editor' ? 'flex' : 'hidden'} w-full flex-1 min-h-0 overflow-x-hidden`}>
          {question ? (
            <LeetCodeEditor
              appQuestionId={question.id}
              slug={question.slug}
              onAccepted={async () => {
                const res = await addMasteryRunEvent(question.id, 1)
                if (!res.ok) {
                  toast.error(`Failed to save mastery run — ${res.error ?? 'check Supabase RLS'}`)
                  return
                }
                toast.success('Mastery run saved')
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--text-subtle)] text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading editor...
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
