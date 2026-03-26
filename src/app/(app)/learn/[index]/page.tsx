'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Brain, CheckCircle, Star,
  BookOpen, List, Eye, EyeOff
} from 'lucide-react'
import { getProgress, updateProgress, completeReview } from '@/lib/db'
import { isDue, formatLocalDate, nextIntervalDays } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import DescriptionRenderer from '@/components/DescriptionRenderer'
import StatusRadio from '@/components/StatusRadio'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import { createBrowserClient } from '@supabase/ssr'

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
  const initSolvedParam = searchParams.get('solved')
  const initSolved: null | boolean = initSolvedParam === 'true' ? true : initSolvedParam === 'false' ? false : null

  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [idx, setIdx] = useState(Number(params.index ?? 0))
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [showList, setShowList] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const [showSolutions, setShowSolutions] = useState(false)
  const [filterDiff, setFilterDiff] = useState(initDiff)
  const [filterSource, setFilterSource] = useState(initSource)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (!uid) { setLoading(false); return }
      Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(uid),
      ]).then(([qs, prog]) => {
        setQuestions(qs)
        setProgress(prog)
        setLoading(false)
      })
    })
  }, [])

  const filtered = questions.filter(q => {
    if (filterDiff !== 'All' && q.difficulty !== filterDiff) return false
    if (filterSource !== 'All' && !(q.source || []).includes(filterSource)) return false
    if (initSearch && !q.title.toLowerCase().includes(initSearch.toLowerCase())) return false
    const p = progress[String(q.id)] || {}
    if (initStarred && !p.starred) return false
    if (initSolved === true && !p.solved) return false
    if (initSolved === false && p.solved) return false
    return true
  })

  const safeIdx = Math.min(idx, Math.max(filtered.length - 1, 0))
  const q = filtered[safeIdx] || null
  const p = q ? (progress[String(q.id)] || {}) : {}
  const solved = p.solved || false
  const starred = p.starred || false
  const status = p.status || null
  const reviewCount = p.review_count || 0
  const nextReview = p.next_review || null
  const due = isDue(nextReview) && solved

  useEffect(() => {
    if (q) setNotes(progress[String(q.id)]?.notes || '')
    setShowSolutions(false)
    setReviewDone(false)
  }, [q?.id])


  const goNext = () => {
    if (safeIdx < filtered.length - 1) {
      const ni = safeIdx + 1
      setIdx(ni)
      router.push(`/learn/${ni}`, { scroll: false })
      setReviewDone(false)
    }
  }
  const goPrev = () => {
    if (safeIdx > 0) {
      const ni = safeIdx - 1
      setIdx(ni)
      router.push(`/learn/${ni}`, { scroll: false })
      setReviewDone(false)
    }
  }
  const goTo = (i: number) => {
    setIdx(i)
    router.push(`/learn/${i}`, { scroll: false })
    setShowList(false)
    setReviewDone(false)
  }

  const save = async (patch: any = {}) => {
    if (!q || !userId) return
    setSaving(true)
    const updated = { solved, starred, notes, status, ...patch, question_id: q.id }
    await updateProgress(userId, q.id, updated)
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...prev[String(q.id)], ...updated } }))
    setSaving(false)
  }

  const handleCompleteReview = async () => {
    if (!q || !userId) return
    const result = await completeReview(userId, q.id)
    setProgress(prev => ({
      ...prev,
      [String(q.id)]: {
        ...prev[String(q.id)],
        review_count: result.review_count,
        next_review: result.next_review,
      },
    }))
    setReviewDone(true)
  }

  if (loading) return (
    <div className="text-center py-32 text-gray-400 text-sm animate-pulse">Loading questions…</div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Filter bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {['All', 'Easy', 'Medium', 'Hard'].map(d => (
            <button
              key={d}
              onClick={() => { setFilterDiff(d); setIdx(0); router.push('/learn/0', { scroll: false }) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterDiff === d
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              }`}
            >{d}</button>
          ))}
          <span className="w-px h-5 bg-gray-200 shrink-0" />
          {['All', 'Grind 169', 'Denny Zhang', 'Premium 98', 'CodeSignal 21'].map(s => (
            <button
              key={s}
              onClick={() => { setFilterSource(s); setIdx(0); router.push('/learn/0', { scroll: false }) }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
                filterSource === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
              }`}
            >{s}</button>
          ))}
          <button
            onClick={() => setShowList(v => !v)}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:border-indigo-300 transition-colors shrink-0"
          >
            <List size={12} /> {showList ? 'Hide' : 'All Qs'}
          </button>
        </div>
      </div>

      {/* Question list dropdown */}
      {showList && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg mb-4 max-h-72 overflow-y-auto">
          {filtered.map((fq, i) => {
            const fp = progress[String(fq.id)] || {}
            return (
              <button
                key={fq.id}
                onClick={() => goTo(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-indigo-50 border-b border-gray-50 transition-colors ${
                  i === safeIdx ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="text-xs text-gray-400 font-mono w-8">#{fq.id}</span>
                <span className="text-sm font-medium text-gray-700 flex-1 truncate">{fq.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                  fq.difficulty === 'Easy' ? 'text-green-600 bg-green-50'
                  : fq.difficulty === 'Medium' ? 'text-yellow-600 bg-yellow-50'
                  : 'text-red-600 bg-red-50'
                }`}>{fq.difficulty}</span>
                {fp.solved && <CheckCircle size={13} className="text-green-500 shrink-0" />}
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No questions match filters.</p>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-400 font-mono shrink-0">
          {safeIdx + 1} / {filtered.length}
        </span>
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all"
            style={{ width: filtered.length ? `${((safeIdx + 1) / filtered.length) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {filtered.filter(fq => progress[String(fq.id)]?.solved).length} solved
        </span>
      </div>

      {!q ? (
        <div className="text-center py-24 text-gray-400">No questions match your filters.</div>
      ) : (
        <>
          {/* Review due banner */}
          {due && (
            <div className="mb-4 bg-indigo-50 border border-indigo-300 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Brain size={15} className="text-indigo-600" />
                <span className="text-sm font-semibold text-indigo-700">
                  Spaced repetition review #{reviewCount + 1} due!
                </span>
              </div>
              <button
                onClick={handleCompleteReview}
                disabled={reviewDone}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  reviewDone
                    ? 'bg-green-100 text-green-600 border border-green-300'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {reviewDone
                  ? `✓ Next review in ${nextIntervalDays(reviewCount + 1)} days`
                  : 'Done — Schedule Next Review'}
              </button>
            </div>
          )}

          {/* Question card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400 font-mono">#{q.id}</span>
                <DifficultyBadge difficulty={q.difficulty} />
                {(q.source || []).map(s => (
                  <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">
                    {s}
                  </span>
                ))}
                {status && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border capitalize ${
                    status === 'mastered' ? 'bg-green-100 text-green-700 border-green-300'
                    : status === 'revised' ? 'bg-orange-100 text-orange-700 border-orange-300'
                    : status === 'reviewed' ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                    : 'bg-blue-100 text-blue-700 border-blue-300'
                  }`}>{status}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => save({ starred: !starred })}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    starred ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200 hover:border-yellow-300'
                  }`}
                >
                  <Star size={13} className={starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'} />
                </button>
                <button
                  onClick={() => save({ solved: !solved })}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    solved ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-green-300'
                  }`}
                >
                  <CheckCircle size={12} className={solved ? 'fill-green-500 text-white' : ''} />
                  {solved ? 'Solved ✓' : 'Mark Solved'}
                </button>
              </div>
            </div>

            <h1 className="text-xl font-bold text-gray-800 mb-1">{q.title}</h1>

            {solved && nextReview && !due && (
              <p className="text-xs text-green-600 mb-2">
                🗓 Next review: {formatLocalDate(nextReview)} · {nextIntervalDays(reviewCount + 1)}d interval
              </p>
            )}

            <div className="flex flex-wrap gap-1 mb-4">
              {(q.tags || []).map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
            </div>

            {q.doocs_url && (
              <div className="mb-4">
                <a
                  href={q.doocs_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <BookOpen size={11} /> Read on doocs.org
                </a>
              </div>
            )}

            {/* Question image */}
            <div className="mb-4 rounded-xl border border-gray-200 shadow-sm bg-white p-3">
              <img
                src={`/question-images/${q.id}.jpg`}
                alt={`${q.title} full question`}
                className="w-full block rounded-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>

            <div className="border-t border-gray-50 pt-4">
              <DescriptionRenderer description={q.description} />
            </div>
          </div>

          {/* Status / knowledge level */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={14} className="text-indigo-500" />
              <span className="text-xs font-bold text-gray-600">How well do you know this?</span>
              {solved && nextReview && (
                <span className="ml-auto text-xs text-green-600 font-medium">
                  📅 {formatLocalDate(nextReview)}
                </span>
              )}
            </div>
            <StatusRadio
              value={status}
              onChange={s => {
                if (s === 'mastered' && !solved) {
                  save({ status: s, solved: true })
                } else if (s === null && status === 'mastered') {
                  save({ status: null, solved: false })
                } else {
                  save({ status: s })
                }
              }}
            />
            {solved && nextReview && (
              <p className="text-xs text-green-600 mt-2">
                ✅ Spaced repetition active — review #{reviewCount + 1} in {nextIntervalDays(reviewCount)} day{nextIntervalDays(reviewCount) !== 1 ? 's' : ''}
                {nextReview ? ` · ${formatLocalDate(nextReview)}` : ''}.
              </p>
            )}
            {!solved && (
              <p className="text-xs text-gray-400 mt-2">
                Mark this question as <strong>Solved</strong> to start spaced repetition reminders.
              </p>
            )}
          </div>

          {/* Practice editor */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-200 shrink" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 text-center">🧠 Practice</span>
              <div className="h-px flex-1 bg-gray-200 shrink" />
            </div>
            <LeetCodeEditor appQuestionId={q.id} slug={q.slug} />
          </div>

          {/* Solutions */}
          <div className="mb-4">
            <button
              onClick={() => setShowSolutions(v => !v)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border font-semibold text-sm transition-colors ${
                showSolutions
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              <span className="flex items-center gap-2">
                {showSolutions ? <EyeOff size={15} /> : <Eye size={15} />}
                {showSolutions ? 'Hide Solutions' : 'Reveal Solutions — Python & C++'}
              </span>
              <span className="text-xs opacity-60">{showSolutions ? 'click to hide' : 'try it yourself first!'}</span>
            </button>
            {showSolutions && (
              <div className="mt-3">
                <CodePanel pythonCode={q.python_solution} cppCode={q.cpp_solution} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
            <h2 className="text-sm font-bold text-gray-700 mb-2">📝 My Notes</h2>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={() => save({ notes })}
              rows={3}
              placeholder="Write your notes, intuition, edge cases…"
              className="w-full text-sm border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
            />
            <button
              onClick={() => save({ notes })}
              disabled={saving}
              className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          {/* Nav */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={goPrev}
              disabled={safeIdx === 0}
              className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 bg-white hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span><span className="sm:hidden">Prev</span>
            </button>
            <div className="text-center min-w-0 flex-1 px-1">
              <span className="text-xs text-gray-400 line-clamp-1">{q.title}</span>
            </div>
            <button
              onClick={goNext}
              disabled={safeIdx === filtered.length - 1}
              className="flex items-center gap-1 px-3 sm:px-5 py-2.5 rounded-xl border border-indigo-200 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function LearnPage() {
  return (
    <Suspense fallback={<div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>}>
      <LearnInner />
    </Suspense>
  )
}
