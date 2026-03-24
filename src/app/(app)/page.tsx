'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Star, CheckCircle2, Layers, BookOpen, CheckCircle, Target, Calendar, ChevronRight, Flame, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import { getProgress, updateProgress, getActivityLog, getDueReviews, getInterviewDate, setInterviewDate } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import toast from 'react-hot-toast'

interface Question {
  id: number
  title: string
  slug: string
  difficulty: string
  tags: string[]
  source: string[]
  python_solution?: string
  cpp_solution?: string
  description?: string
}

interface ProgressData {
  solved: boolean
  starred: boolean
  notes: string
  status?: string | null
  review_count?: number
  next_review?: string | null
}

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard']
const SOURCES = ['All', 'Grind 169', 'Denny Zhang', 'Premium 98', 'CodeSignal']

const QUICK_PATTERNS = [
  { name: 'Arrays & Hashing', tags: ['Array', 'Hash Table'] },
  { name: 'Two Pointers',     tags: ['Two Pointers'] },
  { name: 'Sliding Window',   tags: ['Sliding Window'] },
  { name: 'Binary Search',    tags: ['Binary Search'] },
  { name: 'Stack',            tags: ['Stack', 'Monotonic Stack'] },
  { name: 'Linked List',      tags: ['Linked List'] },
  { name: 'Trees & BST',      tags: ['Tree', 'Binary Tree', 'Binary Search Tree', 'BST'] },
  { name: 'Dynamic Programming', tags: ['Dynamic Programming', 'Memoization'] },
  { name: 'Graphs',           tags: ['Graph', 'Union Find', 'Topological Sort'] },
  { name: 'Heap',             tags: ['Heap', 'Heap (Priority Queue)'] },
  { name: 'Backtracking',     tags: ['Backtracking'] },
  { name: 'BFS',              tags: ['BFS', 'Breadth-First Search'] },
  { name: 'DFS',              tags: ['DFS', 'Depth-First Search'] },
]

function todayISO() { return new Date().toISOString().split('T')[0] }
function computeStreak(log: Record<string, number>) {
  let streak = 0
  const d = new Date()
  while (true) {
    const key = d.toISOString().split('T')[0]
    if (!log[key]) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
function seededRandom(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0
  return Math.abs(h)
}

function WeakestPatternWidget({ questions, progress }: { questions: Question[]; progress: Record<string, ProgressData> }) {
  const patternStats = QUICK_PATTERNS.map(p => {
    const qs = questions.filter(q => (q.tags || []).some(t => p.tags.includes(t)))
    const solvedCount = qs.filter(q => progress[String(q.id)]?.solved).length
    const pct = qs.length ? Math.round((solvedCount / qs.length) * 100) : 100
    return { ...p, total: qs.length, solved: solvedCount, pct }
  }).filter(p => p.total >= 3)
  const weakest = [...patternStats].sort((a, b) => a.pct - b.pct)[0]
  if (!weakest) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg">🎯</span>
        <div className="min-w-0">
          <p className="text-xs font-bold text-amber-800">Weakest Pattern</p>
          <p className="text-sm font-semibold text-amber-900 truncate">{weakest.name} — {weakest.solved}/{weakest.total} solved ({weakest.pct}%)</p>
        </div>
      </div>
      <Link href="/patterns" className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors shrink-0 whitespace-nowrap">
        Practice now →
      </Link>
    </div>
  )
}

function InterviewCountdownWidget({ questions, progress }: { questions: Question[]; progress: Record<string, ProgressData> }) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [editing, setEditing] = useState(false)
  const [streak, setStreak] = useState(0)
  const [dailyQ, setDailyQ] = useState<Question | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    async function load() {
      const [log, interviewData] = await Promise.all([getActivityLog(), getInterviewDate()])
      setStreak(computeStreak(log))
      if (interviewData?.target_date) setDate(interviewData.target_date)
      setLoaded(true)
    }
    load()
  }, [])
  useEffect(() => {
    if (!questions.length) return
    const todayKey = 'daily_q_' + todayISO()
    const stored = localStorage.getItem(todayKey)
    if (stored) { try { setDailyQ(JSON.parse(stored)); return } catch {} }
    const unsolved = questions.filter(q => !progress[String(q.id)]?.solved)
    const pool = unsolved.length ? unsolved : questions
    const seed = new Date().toDateString()
    const idx = seededRandom(seed) % pool.length
    const q = pool[idx]
    localStorage.setItem(todayKey, JSON.stringify({ id: q.id, title: q.title, difficulty: q.difficulty }))
    setDailyQ(q)
  }, [questions, progress])
  const handleDateSave = async (val: string) => {
    setDate(val)
    await setInterviewDate(val, '')
    setEditing(false)
  }
  const daysLeft = date ? Math.ceil((new Date(date + 'T12:00:00').getTime() - Date.now()) / 86400000) : null
  const diffColor: Record<string, string> = {
    Easy: 'bg-green-100 text-green-700 border-green-200',
    Medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    Hard: 'bg-red-100 text-red-700 border-red-200',
  }
  if (!loaded) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-gray-500 flex items-center gap-1"><Target size={13} /> Interview Countdown</span>
          {streak > 0 && <span className="flex items-center gap-1 text-xs font-bold text-orange-500"><Flame size={13} /> {streak}d streak</span>}
        </div>
        {editing ? (
          <div className="flex gap-2 items-center flex-wrap">
            <input type="date" defaultValue={date} min={todayISO()}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              onKeyDown={e => { if (e.key === 'Enter') handleDateSave((e.target as HTMLInputElement).value) }}
              onBlur={e => { if (e.target.value) handleDateSave(e.target.value); else setEditing(false) }}
              autoFocus />
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
          </div>
        ) : date ? (
          <div>
            <div className={`text-3xl font-black mb-0.5 ${daysLeft !== null && daysLeft <= 7 ? 'text-red-500' : daysLeft !== null && daysLeft <= 14 ? 'text-orange-500' : 'text-indigo-600'}`}>
              {daysLeft !== null && daysLeft <= 0 ? 'Today!' : daysLeft + 'd'}
            </div>
            <p className="text-xs text-gray-400">{daysLeft !== null && daysLeft <= 0 ? 'Interview day!' : 'until your interview'}</p>
            <button onClick={() => setEditing(true)} className="text-xs text-indigo-500 hover:underline mt-1">Change date</button>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-400 mb-2">Set your interview date to track countdown</p>
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">
              <Calendar size={12} /> Set date
            </button>
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">⭐ Today's Question</div>
        {dailyQ ? (
          <div>
            <div className="flex items-start gap-2 mb-2">
              <span className={'text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ' + (diffColor[dailyQ.difficulty] || 'bg-gray-100 text-gray-600 border-gray-200')}>{dailyQ.difficulty}</span>
              <span className="text-sm font-semibold text-gray-800 leading-snug">{dailyQ.title}</span>
            </div>
            <button onClick={() => router.push('/question/' + dailyQ.id)} className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors">
              Solve now <ChevronRight size={13} />
            </button>
          </div>
        ) : <p className="text-xs text-gray-400">Loading…</p>}
      </div>
    </div>
  )
}

function DueReviewBanner() {
  const router = useRouter()
  const [due, setDue] = useState<Array<{ id: number; review_count: number; next_review: string }>>([])
  const [open, setOpen] = useState(true)
  useEffect(() => { getDueReviews().then(setDue).catch(() => {}) }, [])
  if (!due.length) return null
  function daysOverdue(nr: string) {
    const [y, m, d] = nr.split('-').map(Number)
    const diff = Math.round((new Date().setHours(0,0,0,0) - new Date(y, m-1, d).getTime()) / 86400000)
    if (diff === 0) return 'due today'
    if (diff === 1) return '1 day overdue'
    return diff + ' days overdue'
  }
  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl mb-5 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-100 transition-colors">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-indigo-600" />
          <span className="text-sm font-bold text-indigo-700">🧠 Spaced Repetition — {due.length} question{due.length > 1 ? 's' : ''} due for review</span>
        </div>
        {open ? <ChevronUp size={15} className="text-indigo-400" /> : <ChevronDown size={15} className="text-indigo-400" />}
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {due.map(q => (
            <button key={q.id} onClick={() => router.push('/question/' + q.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs hover:border-indigo-400 hover:shadow-sm transition-all text-left">
              <span className="text-gray-400 font-mono">#{q.id}</span>
              <span className="text-indigo-400 text-xs">· Review #{q.review_count + 1} · {daysOverdue(q.next_review)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function HomePage() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [progress, setProgress] = useState<Record<string, ProgressData>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('All')
  const [source, setSource] = useState('All')
  const [showStarred, setShowStarred] = useState(false)
  const [showSolved, setShowSolved] = useState<null | boolean>(null)

  useEffect(() => {
    Promise.all([fetch('/questions_full.json').then(r => r.json()), getProgress()]).then(([qs, prog]) => {
      setQuestions(qs); setProgress(prog); setLoading(false)
    })
  }, [])

  const DIFF_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 }

  const filtered = questions.filter(q => {
    if (difficulty !== 'All' && q.difficulty !== difficulty) return false
    if (source !== 'All' && !(q.source || []).includes(source)) return false
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !String(q.id).includes(search)) return false
    const p = progress[String(q.id)] || {}
    if (showStarred && !p.starred) return false
    if (showSolved === true && !p.solved) return false
    if (showSolved === false && p.solved) return false
    return true
  }).sort((a, b) => (DIFF_ORDER[a.difficulty] ?? 1) - (DIFF_ORDER[b.difficulty] ?? 1))

  const solved = Object.values(progress).filter(p => p.solved).length

  async function toggleSolved(e: React.MouseEvent, q: Question) {
    e.preventDefault()
    const p = progress[String(q.id)] || { solved: false, starred: false, notes: '' }
    const newSolved = !p.solved
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...p, solved: newSolved } }))
    await updateProgress(q.id, { solved: newSolved })
    toast.success(newSolved ? 'Marked solved!' : 'Unmarked')
  }

  async function toggleStarred(e: React.MouseEvent, q: Question) {
    e.preventDefault()
    const p = progress[String(q.id)] || { solved: false, starred: false, notes: '' }
    const newStarred = !p.starred
    setProgress(prev => ({ ...prev, [String(q.id)]: { ...p, starred: newStarred } }))
    await updateProgress(q.id, { starred: newStarred })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-4 mb-5 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle size={16} className="text-green-500" />
          <span className="text-sm font-bold text-gray-700">{solved} / {questions.length} solved</span>
        </div>
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: (questions.length ? Math.round((solved / questions.length) * 100) : 0) + '%' }} />
        </div>
        <span className="text-sm font-semibold text-indigo-600">{questions.length ? Math.round((solved / questions.length) * 100) : 0}%</span>
      </div>

      {!loading && <InterviewCountdownWidget questions={questions} progress={progress} />}
      <DueReviewBanner />
      {!loading && <WeakestPatternWidget questions={questions} progress={progress} />}

      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 shadow-sm">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search questions..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={'px-3 py-1 rounded-full text-xs font-semibold transition-colors ' + (difficulty === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>{d}</button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {SOURCES.map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={'px-3 py-1 rounded-full text-xs font-semibold transition-colors ' + (source === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>{s}</button>
            ))}
          </div>
          <button onClick={() => setShowStarred(v => !v)}
            className={'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors ' + (showStarred ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
            <Star size={12} /> Starred
          </button>
          <button onClick={() => setShowSolved(v => v === null ? false : v === false ? true : null)}
            className={'flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors ' + (showSolved === false ? 'bg-orange-400 text-white' : showSolved === true ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
            <CheckCircle2 size={12} />
            {showSolved === false ? 'Unsolved' : showSolved === true ? 'Solved' : 'All'}
          </button>
          <span className="ml-auto text-xs text-gray-400">{filtered.length} questions</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
          <span className="text-xs text-gray-400 self-center">Study {filtered.length} as:</span>
          <Link href="/flashcards" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors">
            <Layers size={12} /> Flashcards
          </Link>
          <Link href="/learn/0" className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors">
            <BookOpen size={12} /> Learn mode
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-gray-400 text-sm animate-pulse">Loading questions...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(q => {
            const p = progress[String(q.id)] || { solved: false, starred: false, notes: '' }
            return (
              <div key={q.id} className={'group rounded-xl border p-4 transition-all duration-150 hover:shadow-md hover:border-indigo-300 ' + (p.solved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100')}>
                <div className="flex items-start justify-between gap-2">
                  <Link href={'/question/' + q.id} className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs text-gray-400 font-mono shrink-0">#{q.id}</span>
                    <h3 className="font-semibold text-gray-800 text-sm truncate group-hover:text-indigo-600 transition-colors">{q.title}</h3>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={e => toggleStarred(e, q)}>
                      <Star size={14} className={p.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 hover:text-yellow-400'} />
                    </button>
                    <button onClick={e => toggleSolved(e, q)}>
                      <CheckCircle2 size={14} className={p.solved ? 'text-green-500 fill-green-500' : 'text-gray-300 hover:text-green-400'} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <DifficultyBadge difficulty={q.difficulty} />
                  {(q.tags || []).slice(0, 2).map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                  ))}
                  {q.python_solution && <span className="text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">Py</span>}
                </div>
                {(q.source || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(q.source || []).map(s => (
                      <span key={s} className="text-xs bg-indigo-50 text-indigo-400 px-2 py-0.5 rounded-full">{s}</span>
                    ))}
                  </div>
                )}
                {p.notes && <p className="text-xs text-gray-400 mt-2 italic truncate">📝 {p.notes}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
