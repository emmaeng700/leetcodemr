'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProgress, getDueReviews, completeReview } from '@/lib/db'
import { isDue, formatLocalDate } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import { Brain, CheckCircle, Clock, CalendarCheck, Flame, Trophy, TrendingUp } from 'lucide-react'

interface Question {
  id: number
  title: string
  difficulty: string
  tags: string[]
}

function daysUntil(nextReview: string) {
  const [y, m, d] = nextReview.split('-').map(Number)
  const rev = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((rev.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
const STATUS_STYLE: Record<string, string> = {
  mastered: 'bg-green-100 text-green-700 border-green-300',
  revised:  'bg-orange-100 text-orange-700 border-orange-300',
  reviewed: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  learnt:   'bg-blue-100 text-blue-700 border-blue-300',
}
const STATUS_COUNTS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  learnt:   { bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-600',   label: 'Hard for me' },
  reviewed: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-600', label: 'Getting there' },
  revised:  { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-600', label: 'Easy for me' },
  mastered: { bg: 'bg-green-50 border-green-200',   text: 'text-green-600',  label: 'Mastered' },
}

export default function ReviewPage() {
  const [allQ, setAllQ] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    Promise.all([
      fetch('/questions_full.json').then(r => r.json()),
      getProgress(),
    ]).then(([qs, prog]) => {
      setAllQ(qs)
      setProgress(prog)
      setLoading(false)
    })
  }, [])

  const handleCompleteReview = async (qId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setCompleting(qId)
    const result = await completeReview(qId)
    setProgress(prev => ({
      ...prev,
      [String(qId)]: {
        ...prev[String(qId)],
        review_count: result.review_count,
        next_review: result.next_review,
      },
    }))
    setCompleting(null)
  }

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>

  const withProgress = allQ.map(q => ({ ...q, p: progress[String(q.id)] || {} }))
  const inSR = withProgress.filter(q => q.p.solved && q.p.next_review)
  const due = inSR.filter(q => isDue(q.p.next_review))
  const upcoming = inSR.filter(q => !isDue(q.p.next_review))
    .sort((a, b) => a.p.next_review.localeCompare(b.p.next_review))

  const hasStatus = withProgress.filter(q => q.p.status)
  const statusCounts = hasStatus.reduce((acc: Record<string, number>, q) => {
    acc[q.p.status] = (acc[q.p.status] || 0) + 1
    return acc
  }, {})

  const upcomingBuckets: Record<string, typeof upcoming> = {}
  upcoming.forEach(q => {
    const days = daysUntil(q.p.next_review)
    const label =
      days === 1 ? 'Tomorrow'
      : days <= 7 ? `In ${days} days`
      : days <= 14 ? 'Next week'
      : days <= 30 ? 'This month'
      : 'Later'
    if (!upcomingBuckets[label]) upcomingBuckets[label] = []
    upcomingBuckets[label].push(q)
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
        <Brain className="text-indigo-500" /> Spaced Repetition
      </h1>
      <p className="text-sm text-gray-400 mb-7">
        Track your review schedule. SR starts automatically when you mark a question <strong>Solved</strong>.
      </p>

      {/* Status counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {Object.entries(STATUS_COUNTS_COLORS).map(([key, style]) => (
          <div key={key} className={`rounded-xl border p-4 text-center ${style.bg}`}>
            <div className={`text-3xl font-black ${style.text}`}>{statusCounts[key] || 0}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{style.label}</div>
          </div>
        ))}
      </div>

      {/* SR stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Flame size={20} className="text-orange-400 mx-auto mb-1" />
          <div className="text-2xl font-black text-orange-500">{due.length}</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">Due Today</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Clock size={20} className="text-indigo-400 mx-auto mb-1" />
          <div className="text-2xl font-black text-indigo-500">{upcoming.length}</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">Scheduled</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
          <Trophy size={20} className="text-green-400 mx-auto mb-1" />
          <div className="text-2xl font-black text-green-500">{inSR.length}</div>
          <div className="text-xs text-gray-500 mt-0.5 font-medium">In SR (Solved)</div>
        </div>
      </div>

      {/* Due now */}
      {due.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Flame size={15} className="text-orange-500" /> Due for Review Now
            <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs">{due.length}</span>
          </h2>
          <div className="space-y-2">
            {due.map(q => (
              <div
                key={q.id}
                onClick={() => router.push(`/practice/${q.id}`)}
                className="flex items-center justify-between gap-2 flex-wrap bg-indigo-50 border border-indigo-200 rounded-xl px-3 sm:px-4 py-3 cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                  <span className="font-semibold text-gray-800 text-sm truncate group-hover:text-indigo-700">{q.title}</span>
                  <DifficultyBadge difficulty={q.difficulty} />
                  {q.p.status && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border hidden sm:inline ${STATUS_STYLE[q.p.status]}`}>
                      {q.p.status.charAt(0).toUpperCase() + q.p.status.slice(1)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-indigo-500 hidden sm:inline">Review #{(q.p.review_count || 0) + 1}</span>
                  <button
                    onClick={e => handleCompleteReview(q.id, e)}
                    disabled={completing === q.id}
                    className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    <CalendarCheck size={12} />
                    {completing === q.id ? 'Saving…' : 'Done'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {due.length === 0 && inSR.length > 0 && (
        <div className="mb-8 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle size={18} className="text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-700">All caught up! 🎉</p>
            <p className="text-xs text-green-600">No reviews due. Check back for your next scheduled review.</p>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {Object.keys(upcomingBuckets).length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={15} className="text-indigo-500" /> Upcoming Reviews
          </h2>
          <div className="space-y-4">
            {Object.entries(upcomingBuckets).map(([bucket, questions]) => (
              <div key={bucket}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{bucket}</p>
                <div className="space-y-1.5">
                  {questions.map(q => (
                    <div
                      key={q.id}
                      onClick={() => router.push(`/practice/${q.id}`)}
                      className="flex items-center justify-between gap-2 flex-wrap bg-white border border-gray-100 rounded-xl px-3 sm:px-4 py-2.5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                        <span className="font-semibold text-gray-700 text-sm truncate group-hover:text-indigo-600">{q.title}</span>
                        <DifficultyBadge difficulty={q.difficulty} />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-gray-400 hidden sm:inline">
                          📅 {formatLocalDate(q.p.next_review)}
                        </span>
                        <span className="text-xs text-indigo-400 hidden sm:inline">
                          Review #{(q.p.review_count || 0) + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All by status */}
      <section>
        <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-500" /> All Questions by Status
        </h2>
        {hasStatus.length === 0 && (
          <div className="bg-white border border-gray-100 rounded-xl p-6 text-center text-gray-400 text-sm">
            No questions tracked yet. Mark questions as <strong>Solved</strong> and set your status to start.
          </div>
        )}
        {['mastered', 'revised', 'reviewed', 'learnt'].map(st => {
          const qs = hasStatus.filter(q => q.p.status === st)
          if (!qs.length) return null
          const style = STATUS_COUNTS_COLORS[st]
          return (
            <div key={st} className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {style.label} — {qs.length} question{qs.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-1.5">
                {qs.map(q => (
                  <div
                    key={q.id}
                    onClick={() => router.push(`/practice/${q.id}`)}
                    className="flex items-center justify-between gap-2 flex-wrap bg-white border border-gray-100 rounded-xl px-3 sm:px-4 py-2.5 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                      <span className="font-semibold text-gray-700 text-sm truncate group-hover:text-indigo-600">{q.title}</span>
                      <DifficultyBadge difficulty={q.difficulty} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[st]}`}>
                        {style.label}
                      </span>
                      {q.p.solved && q.p.next_review && (
                        <span className="text-xs text-gray-400 hidden sm:inline">
                          {isDue(q.p.next_review) ? '🔴 Due now' : `📅 ${formatLocalDate(q.p.next_review)}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
