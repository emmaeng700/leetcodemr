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
import MobileSplitPanelTabs, { type MobileSplitPanel } from '@/components/MobileSplitPanelTabs'
import toast from 'react-hot-toast'
import { setOpenQuestionContext } from '@/lib/openQuestionContext'
import { getPatternForQuestion } from '@/lib/patternUtils'
import { checkAndRecordBreather } from '@/lib/breatherUtils'
import { leetCodeUrl, resolveLeetCodeSlug } from '@/lib/utils'

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
  status?: string | null
}

export default function QuestionPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [progress, setProgress] = useState<ProgressData>({ solved: false, starred: false })
  const [loading, setLoading] = useState(true)
  const [imageError, setImageError] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<MobileSplitPanel>('content')
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
      fullProgressRef.current = prog ?? {}
      const p = (prog ?? {})[String(id)] || { solved: false, starred: false }
      setProgress(p)
      setLoading(false)
    }
    load()
  }, [id])

  useEffect(() => {
    if (!question) return
    setOpenQuestionContext({ id: question.id, slug: question.slug, title: question.title })
  }, [question])

  async function save(patch: Partial<ProgressData> = {}) {
    const updated = { ...progress, ...patch }
    setProgress(updated)
    fullProgressRef.current = { ...fullProgressRef.current, [String(id)]: updated }
    await updateProgress(id, updated)
    if (patch.solved === true) {
      const completed = checkAndRecordBreather(id, allQuestionsRef.current, fullProgressRef.current)
      if (completed) {
        toast.success(`🎉 ${completed} pattern complete! Take 2 days to revise before moving on.`, { duration: 5000 })
      }
    }
  }

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  if (!question) return <div className="text-center py-32 text-red-400 text-sm">Question not found.</div>

  const topic = getPatternForQuestion(question.tags || []) ?? 'Other'

  const contentPanel = (
    <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <span className="text-xs text-gray-400 font-mono">#{question.id}</span>
          <DifficultyBadge difficulty={question.difficulty} />
          <span className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
            🧩 {topic}
          </span>
          {(question.source || []).map(s => (
            <span key={s} className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full border border-indigo-100">
              {s}
            </span>
          ))}
        </div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-800 leading-snug">{question.title}</h1>
        <div className="flex flex-wrap gap-1 mt-2">
          {(question.tags || []).map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {!imageError && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <BookOpen size={14} /> Problem
          </h2>
          <QuestionImage
            questionId={question.id}
            alt={question.title}
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {question.description && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <BookOpen size={14} /> Description
          </h2>
          <DescriptionRenderer description={question.description} />
        </div>
      )}

      {question.explanation && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Approach</h2>
          <DescriptionRenderer explanation={question.explanation} />
        </div>
      )}

      {(question.python_solution || question.cpp_solution) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <button
            type="button"
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
    </div>
  )

  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
          title="Back"
        >
          <ArrowLeft size={16} />
        </button>

        <h1 className="hidden sm:block min-w-0 flex-1 text-sm font-bold text-gray-800 truncate">{question.title}</h1>

        <div className="flex flex-wrap items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => save({ starred: !progress.starred })}
            className={`flex min-h-11 items-center gap-1 px-3 rounded-lg text-xs font-semibold transition-colors border ${
              progress.starred
                ? 'bg-yellow-50 text-yellow-600 border-yellow-200'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-yellow-300'
            }`}
          >
            <Star size={13} className={progress.starred ? 'fill-yellow-400' : ''} />
            <span className="hidden sm:inline">{progress.starred ? 'Starred' : 'Star'}</span>
          </button>

          <button
            type="button"
            onClick={() => save({ solved: !progress.solved })}
            className={`flex min-h-11 items-center gap-1 px-3 rounded-lg text-xs font-semibold transition-colors border ${
              progress.solved
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-green-300'
            }`}
          >
            <CheckCircle size={13} className={progress.solved ? 'fill-green-500 text-white' : ''} />
            <span className="hidden sm:inline">{progress.solved ? 'Solved' : 'Mark Solved'}</span>
          </button>

          <Link
            href={`/practice/${question.id}`}
            className="flex min-h-11 items-center gap-1 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors border border-indigo-600"
          >
            <Terminal size={13} />
            <span className="hidden sm:inline">Practice</span>
          </Link>

          {question.slug && (
            <a
              href={leetCodeUrl(resolveLeetCodeSlug(question.id, question.slug))}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center gap-1 px-3 rounded-lg text-xs font-semibold bg-orange-50 text-orange-500 border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              <ExternalLink size={13} />
              <span className="hidden sm:inline">LeetCode</span>
            </a>
          )}
        </div>
      </div>

      <div className="hidden"><MobileSplitPanelTabs panel={mobilePanel} onPanelChange={setMobilePanel} /></div>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col w-full bg-[var(--bg)] overflow-visible lg:overflow-y-auto border-b border-gray-100 lg:border-b-0 lg:border-r lg:w-[42%] lg:shrink-0">
          {contentPanel}
        </div>

        <div className="flex flex-col w-full min-h-[50dvh] lg:flex-1 lg:min-h-0 overflow-hidden border-t lg:border-t-0 border-gray-100">
          <LeetCodeEditor
            appQuestionId={question.id}
            slug={question.slug}
            questionTitle={question.title}
            preferredLangs={question.tags?.includes('JavaScript') ? ['javascript', 'python3', 'cpp'] : undefined}
          />
        </div>
      </div>
    </div>
  )
}
