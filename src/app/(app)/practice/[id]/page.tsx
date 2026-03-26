'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, Code2, ChevronDown, ChevronUp } from 'lucide-react'
import { getProgress, updateProgress, addTimeSpent } from '@/lib/db'
import { formatTime } from '@/lib/utils'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import toast from 'react-hot-toast'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  python_solution?: string
  cpp_solution?: string
  starter_python?: string
  starter_cpp?: string
}

export default function PracticePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [solved, setSolved] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())
  const [userId, setUserId] = useState<string | null>(null)
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    const uid = localStorage.getItem('lc_user_id')
    setUserId(uid)
    userIdRef.current = uid
    if (!uid) { setLoading(false); return }
    async function load() {
      const [qs, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(uid!),
      ])
      const q = (qs as Question[]).find((q: Question) => q.id === id)
      if (!q) { setLoading(false); return }
      setQuestion(q)
      const p = prog[String(id)] || {}
      setSolved(!!p.solved)
      setLoading(false)
    }
    load()
  }, [id])

  // Timer — track time spent on question
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    startRef.current = Date.now()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      const elapsed = Math.round((Date.now() - startRef.current) / 1000)
      if (elapsed > 5 && userIdRef.current) addTimeSpent(userIdRef.current, id, elapsed)
    }
  }, [id])

  async function handleMarkSolved() {
    if (!userId) return
    const newSolved = !solved
    setSolved(newSolved)
    await updateProgress(userId, id, { solved: newSolved })
    toast.success(newSolved ? 'Marked as solved! 🎉' : 'Unmarked')
  }

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  if (!question) return <div className="text-center py-32 text-red-400 text-sm">Question not found.</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-mono shrink-0">#{question.id}</span>
              <h1 className="font-bold text-gray-800 text-base leading-snug truncate">{question.title}</h1>
              <DifficultyBadge difficulty={question.difficulty} />
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(question.tags || []).slice(0, 3).map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Timer */}
          <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold text-gray-600">
            <Clock size={13} />
            {formatTime(timer)}
          </div>

          {/* Mark Solved */}
          <button
            onClick={handleMarkSolved}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
              solved
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-green-300'
            }`}
          >
            <CheckCircle size={13} className={solved ? 'fill-green-500 text-white' : ''} />
            {solved ? 'Solved ✓' : 'Mark Solved'}
          </button>
        </div>
      </div>

      {/* Full-featured Practice Editor */}
      <LeetCodeEditor appQuestionId={question.id} slug={question.slug} />

      {/* Solution panel */}
      {(question.python_solution || question.cpp_solution) && (
        <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setShowSolution(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-semibold text-gray-600"
          >
            <span className="flex items-center gap-2">
              <Code2 size={14} /> View Solution
            </span>
            {showSolution ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showSolution && (
            <div className="p-4">
              <CodePanel pythonCode={question.python_solution} cppCode={question.cpp_solution} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
