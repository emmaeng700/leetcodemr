'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Star, CheckCircle, ExternalLink, BookOpen, Code2, Terminal, Eye, EyeOff
} from 'lucide-react'
import { getProgress, updateProgress } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
import DescriptionRenderer from '@/components/DescriptionRenderer'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import QuestionImage from '@/components/QuestionImage'
import toast from 'react-hot-toast'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import { getPatternForQuestion } from '@/lib/patternUtils'
import { checkAndRecordBreather } from '@/lib/breatherUtils'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  description?: string
  explanation?: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
  doocs_url?: string
  starter_python?: string
  starter_cpp?: string
}

interface ProgressData {
  solved: boolean
  starred: boolean
  notes: string
  status?: string | null
}

export default function QuestionPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [progress, setProgress] = useState<ProgressData>({ solved: false, starred: false, notes: '' })
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const allQuestionsRef = useRef<Array<{ id: number; tags: string[] }>>([])
  const fullProgressRef = useRef<Record<string, { solved?: boolean }>>({})

  useEffect(() => {
    async function load() {
      const [qs, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
      ])
      const q = (qs as Question[]).find(q => q.id === id)
      if (!q) { setLoading(false); return }
      setQuestion(q)
      allQuestionsRef.current = qs as Question[]
      fullProgressRef.current = prog
      const p = prog[String(id)] || { solved: false, starred: false, notes: '' }
      setProgress(p)
      setNotes(p.notes || '')
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!question) return
    setOpenQuestionContext({ id: question.id, slug: question.slug, title: question.title })
  }, [question])

  async function save(patch: Partial<ProgressData> = {}) {
    setSaving(true)
    const updated = { ...progress, notes, ...patch }
    setProgress(updated)
    fullProgressRef.current = { ...fullProgressRef.current, [String(id)]: updated }
    await updateProgress(id, updated)
    if (patch.solved === true) {
      const completed = checkAndRecordBreather(id, allQuestionsRef.current, fullProgressRef.current)
      if (completed) {
        toast.success(`🎉 ${completed} pattern complete! Take 2 days to revise before moving on.`, { duration: 5000 })
      }
    }
    setSaving(false)
  }

  async function saveNotes() {
    setSaving(true)
    await updateProgress(id, { ...progress, notes })
    setSaving(false)
    toast.success('Notes saved!')
  }

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  if (!question) return <div className="text-center py-32 text-red-400 text-sm">Question not found.</div>

  return (
    <div className="w-full px-4 py-6">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5 mb-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span className="text-xs text-gray-400 font-mono">#{question.id}</span>
              <DifficultyBadge difficulty={question.difficulty} />
              {(() => {
                const topic = getPatternForQuestion(question.tags || []) ?? 'Other'
                return (
                  <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                    🧩 {topic}
                  </span>
                )
              })()}
              {(question.source || []).map(s => (
                <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">
                  {s}
                </span>
              ))}
            </div>
            <h1 className="text-xl font-bold text-gray-800">{question.title}</h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {(question.tags || []).map(tag => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => save({ starred: !progress.starred })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                progress.starred
                  ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-yellow-300'
              }`}
            >
              <Star size={13} className={progress.starred ? 'fill-yellow-400' : ''} />
              {progress.starred ? 'Starred' : 'Star'}
            </button>

            <button
              onClick={() => save({ solved: !progress.solved })}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                progress.solved
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-green-300'
              }`}
            >
              <CheckCircle size={13} className={progress.solved ? 'fill-green-500 text-white' : ''} />
              {progress.solved ? 'Solved ✓' : 'Mark Solved'}
            </button>

            <Link
              href={`/practice/${question.id}`}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors border border-indigo-600"
            >
              <Terminal size={13} /> Practice
            </Link>

            {question.slug && (
              <a
                href={`https://leetcode.com/problems/${question.slug}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-50 text-orange-500 border border-orange-200 hover:bg-orange-100 transition-colors"
              >
                <ExternalLink size={13} /> LeetCode
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Question Image */}
      {!imageError && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-5">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <BookOpen size={14} /> Problem
          </h2>
          <div className="p-1 sm:p-2">
            <QuestionImage
              questionId={question.id}
              alt={question.title}
              onError={() => setImageError(true)}
            />
          </div>
        </div>
      )}

      {/* Description */}
      {question.description && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <BookOpen size={14} /> Description
          </h2>
          <DescriptionRenderer description={question.description} />
        </div>
      )}

      {/* Explanation / Approach */}
      {question.explanation && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Approach</h2>
          <DescriptionRenderer explanation={question.explanation} />
        </div>
      )}

      {/* Solution Code — hidden until revealed */}
      {(question.python_solution || question.cpp_solution) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
          <button
            onClick={() => setShowSolution(v => !v)}
            className="w-full flex items-center justify-between gap-2 group"
          >
            <div className="flex items-center gap-2">
              <Code2 size={14} className="text-gray-500" />
              <h2 className="text-sm font-bold text-gray-700">Solution</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 group-hover:text-gray-600 transition-colors">
                {showSolution ? 'click to hide' : 'try it yourself first!'}
              </span>
              {showSolution
                ? <EyeOff size={15} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
                : <Eye size={15} className="text-indigo-400 group-hover:text-indigo-600 transition-colors" />
              }
            </div>
          </button>
          {showSolution && (
            <div className="mt-3">
              <CodePanel pythonCode={question.python_solution} cppCode={question.cpp_solution} />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <h2 className="text-sm font-bold text-gray-700 mb-2">My Notes</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={4}
          placeholder="Write your notes, intuition, edge cases..."
          className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
        />
        <button
          onClick={saveNotes}
          disabled={saving}
          className="mt-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Notes'}
        </button>
      </div>

      {/* Practice Editor */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">🧠 Practice</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <LeetCodeEditor appQuestionId={question.id} slug={question.slug} />
      </div>

    </div>
  )
}
