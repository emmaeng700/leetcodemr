'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Brain, CheckCircle, Star,
  BookOpen, List, Code2, ExternalLink, Loader2, FileText, StickyNote,
} from 'lucide-react'
import { getProgress, updateProgress, completeReview } from '@/lib/db'
import { isDue, formatLocalDate, nextIntervalDays } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import StatusRadio from '@/components/StatusRadio'
import LeetCodeEditor from '@/components/LeetCodeEditor'

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
  doocs_url?: string
}

function LearnInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initDiff    = searchParams.get('diff')    || 'All'
  const initSource  = searchParams.get('source')  || 'All'
  const initSearch  = searchParams.get('search')  || ''
  const initStarred = searchParams.get('starred') === '1'
  const initTagsRaw = searchParams.get('tags')    || ''
  const initTags    = initTagsRaw ? initTagsRaw.split(',') : []
  const initSolvedParam = searchParams.get('solved')
  const initSolved: null | boolean = initSolvedParam === 'true' ? true : initSolvedParam === 'false' ? false : null

  const [questions, setQuestions]   = useState<Question[]>([])
  const [progress, setProgress]     = useState<Record<string, any>>({})
  const [idx, setIdx]               = useState(Number(params.index ?? 0))
  const [notes, setNotes]           = useState('')
  const [saving, setSaving]         = useState(false)
  const [showList, setShowList]     = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [leftTab, setLeftTab]       = useState<'description' | 'notes' | 'solution'>('description')
  const [filterDiff, setFilterDiff]     = useState(initDiff)
  const [filterSource, setFilterSource] = useState(initSource)
  const [showFilters, setShowFilters]   = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Live LeetCode description
  const [lcContent, setLcContent]   = useState<string | null>(null)
  const [lcLoading, setLcLoading]   = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
    ]).then(([qs, prog]) => {
      setQuestions(qs)
      setProgress(prog)
    })
  }, [])

  const filtered = questions.filter(q => {
    if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
    if (filterSource !== 'All' && !(q.source || []).includes(filterSource)) return false
    if (initSearch && !q.title.toLowerCase().includes(initSearch.toLowerCase())) return false
    if (initTags.length > 0 && !(q.tags || []).some(t => initTags.includes(t))) return false
    const p = progress[String(q.id)] || {}
    if (initStarred && !p.starred) return false
    if (initSolved === true  && !p.solved) return false
    if (initSolved === false &&  p.solved) return false
    return true
  })

  const safeIdx   = Math.min(idx, Math.max(filtered.length - 1, 0))
  const q         = filtered[safeIdx] || null
  const p         = q ? (progress[String(q.id)] || {}) : {}
  const solved    = p.solved    || false
  const starred   = p.starred   || false
  const status    = p.status    || null
  const reviewCount = p.review_count || 0
  const nextReview  = p.next_review  || null
  const due = isDue(nextReview) && solved

  // Reset per question
  useEffect(() => {
    if (q) setNotes(progress[String(q.id)]?.notes || '')
    setReviewDone(false)
    setLcContent(null)
  }, [q?.id])

  // Fetch live LeetCode description
  useEffect(() => {
    if (!q?.slug) return
    let cancelled = false
    setLcLoading(true)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)

    fetch('/api/leetcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        query: `query questionContent($titleSlug: String!) {
          question(titleSlug: $titleSlug) { content }
        }`,
        variables: { titleSlug: q.slug },
      }),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled) setLcContent(data?.data?.question?.content || null) })
      .catch(() => {})
      .finally(() => { clearTimeout(timer); if (!cancelled) setLcLoading(false) })

    return () => { cancelled = true; ctrl.abort(); clearTimeout(timer) }
  }, [q?.slug])

  const goNext = () => {
    if (safeIdx < filtered.length - 1) {
      const ni = safeIdx + 1
      setIdx(ni)
      router.push(`/learn/${ni}`, { scroll: false })
    }
  }
  const goPrev = () => {
    if (safeIdx > 0) {
      const ni = safeIdx - 1
      setIdx(ni)
      router.push(`/learn/${ni}`, { scroll: false })
    }
  }
  const goTo = (i: number) => {
    setIdx(i)
    router.push(`/learn/${i}`, { scroll: false })
    setShowList(false)
  }

  const save = async (patch: any = {}) => {
    if (!q) return
    setSaving(true)
    const updated = { solved, starred, notes, status, ...patch, question_id: q.id }
    await updateProgress(q.id, updated)
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...prev[String(q.id)], ...updated } }))
    setSaving(false)
  }

  const handleCompleteReview = async () => {
    if (!q) return
    const result = await completeReview(q.id)
    setProgress(prev => ({
      ...prev,
      [String(q.id)]: { ...prev[String(q.id)], review_count: result.review_count, next_review: result.next_review },
    }))
    setReviewDone(true)
  }

  const solvedCount = filtered.filter(fq => progress[String(fq.id)]?.solved).length

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white shrink-0 flex-wrap">

        {/* Prev / counter / Next */}
        <button onClick={goPrev} disabled={safeIdx === 0}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
          <ChevronLeft size={15} />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowList(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-indigo-300 transition-colors"
          >
            <List size={12} />
            <span className="font-mono">{safeIdx + 1}/{filtered.length}</span>
            <span className="text-gray-400">·</span>
            <span className="text-green-600">{solvedCount} solved</span>
          </button>

          {/* Question list dropdown */}
          {showList && (
            <div ref={listRef} className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-80 max-h-80 overflow-y-auto">
              {filtered.map((fq, i) => {
                const fp = progress[String(fq.id)] || {}
                return (
                  <button key={fq.id} onClick={() => goTo(i)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-indigo-50 border-b border-gray-50 transition-colors text-sm ${i === safeIdx ? 'bg-indigo-50' : ''}`}>
                    <span className="text-xs text-gray-400 font-mono w-7 shrink-0">#{fq.id}</span>
                    <span className="flex-1 truncate text-gray-700">{fq.title}</span>
                    <span className={`text-xs font-semibold shrink-0 ${fq.difficulty === 'Easy' ? 'text-green-600' : fq.difficulty === 'Medium' ? 'text-yellow-600' : 'text-red-500'}`}>
                      {fq.difficulty[0]}
                    </span>
                    {fp.solved && <CheckCircle size={11} className="text-green-500 shrink-0" />}
                  </button>
                )
              })}
              {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">No questions match.</p>}
            </div>
          )}
        </div>

        <button onClick={goNext} disabled={safeIdx === filtered.length - 1}
          className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-30 transition-colors">
          <ChevronRight size={15} />
        </button>

        {/* Progress bar */}
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
          <div className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: filtered.length ? `${((safeIdx + 1) / filtered.length) * 100}%` : '0%' }} />
        </div>

        {/* Filters toggle */}
        <button onClick={() => setShowFilters(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${showFilters ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
          Filter {filterDiff !== 'All' || filterSource !== 'All' ? '•' : ''}
        </button>

        {q && (
          <>
            {/* Star */}
            <button onClick={() => save({ starred: !starred })}
              className={`p-1.5 rounded-lg border transition-colors ${starred ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200 hover:border-yellow-300'}`}>
              <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
            </button>

            {/* Mark solved */}
            <button onClick={() => save({ solved: !solved })}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${solved ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:border-green-300'}`}>
              <CheckCircle size={12} className={solved ? 'fill-green-500 text-white' : ''} />
              {solved ? 'Solved ✓' : 'Mark Solved'}
            </button>

            {/* Open on LeetCode */}
            <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-gray-300 hover:text-orange-400 transition-colors" title="Open on LeetCode">
              <ExternalLink size={14} />
            </a>
          </>
        )}
      </div>

      {/* Filter pills row */}
      {showFilters && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 overflow-x-auto scrollbar-none shrink-0">
          {['All', 'Easy', 'Medium', 'Hard'].map(d => (
            <button key={d} onClick={() => { setFilterDiff(d); setIdx(0); router.push('/learn/0', { scroll: false }) }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterDiff === d ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
              {d}
            </button>
          ))}
          <span className="w-px h-4 bg-gray-300 shrink-0" />
          {['All', 'Grind 169', 'Denny Zhang', 'Premium 98', 'CodeSignal 21'].map(s => (
            <button key={s} onClick={() => { setFilterSource(s); setIdx(0); router.push('/learn/0', { scroll: false }) }}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors shrink-0 ${filterSource === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {!q ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No questions match your filters.</div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* ── LEFT panel ── */}
          <div className="w-[42%] shrink-0 flex flex-col border-r border-gray-100 overflow-hidden">

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 bg-white shrink-0">
              <button onClick={() => setLeftTab('description')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <BookOpen size={12} /> Description
                {lcLoading && <Loader2 size={10} className="animate-spin text-gray-300 ml-0.5" />}
              </button>
              <button onClick={() => setLeftTab('notes')}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'notes' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                <StickyNote size={12} /> Notes
              </button>
              {(q.python_solution || q.cpp_solution) && (
                <button onClick={() => setLeftTab('solution')}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${leftTab === 'solution' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                  <Code2 size={12} /> Solution
                </button>
              )}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto">

              {/* ── Description tab ── */}
              {leftTab === 'description' && (
                <div className="p-4 space-y-4">

                  {/* Title + meta */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                      {status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border capitalize ${
                          status === 'mastered' ? 'bg-green-100 text-green-700 border-green-300'
                          : status === 'revised' ? 'bg-orange-100 text-orange-700 border-orange-300'
                          : status === 'reviewed' ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                          : 'bg-blue-100 text-blue-700 border-blue-300'
                        }`}>{status}</span>
                      )}
                    </div>
                    <h1 className="font-bold text-gray-800 text-base leading-snug">{q.title}</h1>
                    {solved && nextReview && !due && (
                      <p className="text-xs text-green-600 mt-1">
                        🗓 Next review: {formatLocalDate(nextReview)} · {nextIntervalDays(reviewCount + 1)}d interval
                      </p>
                    )}
                  </div>

                  {/* Tags */}
                  {(q.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {q.tags.map(t => (
                        <span key={t} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  )}

                  {/* SR review banner */}
                  {due && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Brain size={14} className="text-indigo-600" />
                        <span className="text-xs font-semibold text-indigo-700">Review #{reviewCount + 1} due!</span>
                      </div>
                      <button onClick={handleCompleteReview} disabled={reviewDone}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${reviewDone ? 'bg-green-100 text-green-600 border border-green-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                        {reviewDone ? `✓ Next in ${nextIntervalDays(reviewCount + 1)}d` : 'Mark Done'}
                      </button>
                    </div>
                  )}

                  {/* Live LeetCode description */}
                  {lcContent ? (
                    <div className="lc-description text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: lcContent }} />
                  ) : lcLoading ? (
                    <div className="space-y-2 animate-pulse">
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-5/6" />
                      <div className="h-3 bg-gray-100 rounded w-4/6" />
                      <div className="h-10 bg-gray-100 rounded w-full mt-2" />
                      <div className="h-3 bg-gray-100 rounded w-full" />
                      <div className="h-3 bg-gray-100 rounded w-3/4" />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {q.description || (
                        <span className="text-gray-400 italic text-xs">
                          No description cached.{' '}
                          <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer"
                            className="text-indigo-500 hover:underline">View on LeetCode ↗</a>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Question image (show if exists) */}
                  <img
                    src={`/question-images/${q.id}.jpg`}
                    alt={q.title}
                    className="w-full rounded-xl border border-gray-100"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />

                  {/* Company sources */}
                  {(q.source || []).length > 0 && (
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Asked by</p>
                      <div className="flex flex-wrap gap-1.5">
                        {q.source.map(s => (
                          <span key={s} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Knowledge level */}
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                        <Brain size={12} className="text-indigo-500" /> How well do you know this?
                      </span>
                      {solved && nextReview && (
                        <span className="text-xs text-green-600 font-medium">{formatLocalDate(nextReview)}</span>
                      )}
                    </div>
                    <StatusRadio
                      value={status}
                      onChange={s => {
                        if (s === 'mastered' && !solved) save({ status: s, solved: true })
                        else if (s === null && status === 'mastered') save({ status: null, solved: false })
                        else save({ status: s })
                      }}
                    />
                    {solved && nextReview ? (
                      <p className="text-xs text-green-600 mt-2">
                        ✅ Review #{reviewCount + 1} in {nextIntervalDays(reviewCount)} day{nextIntervalDays(reviewCount) !== 1 ? 's' : ''} · {formatLocalDate(nextReview)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-2">Mark Solved to start spaced repetition.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Notes tab ── */}
              {leftTab === 'notes' && (
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">📝 My Notes — {q.title}</p>
                  <textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    onBlur={() => save({ notes })}
                    rows={12}
                    placeholder="Write your notes, intuition, edge cases, time complexity…"
                    className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                  />
                  <button onClick={() => save({ notes })} disabled={saving}
                    className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save Notes'}
                  </button>
                </div>
              )}

              {/* ── Solution tab ── */}
              {leftTab === 'solution' && (
                <div className="p-4">
                  <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT panel — editor ── */}
          <div className="flex-1 overflow-y-auto">
            <LeetCodeEditor appQuestionId={q.id} slug={q.slug} />
          </div>
        </div>
      )}

      {/* LeetCode description styles */}
      <style>{`
        .lc-description pre { background:#f6f8fa; border-radius:6px; padding:12px; overflow-x:auto; font-size:12px; margin:8px 0; }
        .lc-description code { background:#f0f0f0; border-radius:3px; padding:1px 4px; font-size:12px; }
        .lc-description pre code { background:none; padding:0; }
        .lc-description p { margin:6px 0; font-size:13px; line-height:1.6; }
        .lc-description ul, .lc-description ol { padding-left:20px; margin:6px 0; font-size:13px; }
        .lc-description li { margin:3px 0; }
        .lc-description strong { font-weight:600; }
        .lc-description img { max-width:100%; border-radius:6px; margin:8px 0; }
        .lc-description sup { font-size:10px; }
      `}</style>
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-56px)] text-gray-400 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>}>
      <LearnInner />
    </Suspense>
  )
}
