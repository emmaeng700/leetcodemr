'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Play, CheckCircle, Clock, Code2, ChevronDown, ChevronUp } from 'lucide-react'
import { getProgress, updateProgress, getPracticeSession, savePracticeSession, addTimeSpent } from '@/lib/db'
import DifficultyBadge from '@/components/DifficultyBadge'
import CodePanel from '@/components/CodePanel'
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

type Language = 'python' | 'javascript' | 'java' | 'cpp'

const LANG_CONFIG: Record<Language, { label: string; pistonLang: string; pistonVersion: string; starter: string }> = {
  python:     { label: 'Python',     pistonLang: 'python',     pistonVersion: '3.10.0', starter: '# Write your Python solution here\n\n' },
  javascript: { label: 'JavaScript', pistonLang: 'javascript', pistonVersion: '18.15.0', starter: '// Write your JavaScript solution here\n\n' },
  java:       { label: 'Java',       pistonLang: 'java',       pistonVersion: '15.0.2', starter: 'public class Main {\n    public static void main(String[] args) {\n        // Write your Java solution here\n    }\n}\n' },
  cpp:        { label: 'C++',        pistonLang: 'c++',        pistonVersion: '10.2.0', starter: '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // Write your C++ solution here\n    return 0;\n}\n' },
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function PracticePage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState<Language>('python')
  const [code, setCode] = useState('')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [solved, setSolved] = useState(false)
  const [showSolution, setShowSolution] = useState(false)
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())

  useEffect(() => {
    async function load() {
      const [qs, prog] = await Promise.all([
        fetch('/questions_full.json').then(r => r.json()),
        getProgress(),
      ])
      const q = (qs as Question[]).find((q: Question) => q.id === id)
      if (!q) { setLoading(false); return }
      setQuestion(q)
      const p = prog[String(id)] || {}
      setSolved(!!p.solved)

      // Load saved session
      const session = await getPracticeSession(id, 'python')
      if (session?.code) {
        setCode(session.code)
      } else {
        setCode(q.starter_python || LANG_CONFIG.python.starter)
      }
      setLoading(false)
    }
    load()
  }, [id])

  // Change language — load saved code or starter
  useEffect(() => {
    if (!question) return
    async function loadLangCode() {
      const session = await getPracticeSession(id, lang)
      if (session?.code) {
        setCode(session.code)
      } else {
        const starters: Record<Language, string | undefined> = {
          python: question!.starter_python,
          cpp: question!.starter_cpp,
          javascript: undefined,
          java: undefined,
        }
        setCode(starters[lang] || LANG_CONFIG[lang].starter)
      }
    }
    loadLangCode()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

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

  async function runCode() {
    setRunning(true)
    setOutput('Running...')
    try {
      const cfg = LANG_CONFIG[lang]
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: cfg.pistonLang,
          version: cfg.pistonVersion,
          files: [{ content: code }],
        }),
      })
      const result = await res.json()
      const stdout = result?.run?.stdout || ''
      const stderr = result?.run?.stderr || ''
      const exitCode = result?.run?.code ?? -1
      setOutput(stdout + (stderr ? `\nSTDERR:\n${stderr}` : '') + `\n[Exit: ${exitCode}]`)

      // Save session
      await savePracticeSession(id, lang, code, result)
      toast.success('Code executed!')
    } catch (err) {
      setOutput(`Error running code: ${err}`)
      toast.error('Failed to run code')
    }
    setRunning(false)
  }

  async function handleMarkSolved() {
    const newSolved = !solved
    setSolved(newSolved)
    await updateProgress(id, { solved: newSolved })
    toast.success(newSolved ? 'Marked as solved!' : 'Unmarked')
  }

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>
  if (!question) return <div className="text-center py-32 text-red-400 text-sm">Question not found.</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-700 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono">#{question.id}</span>
              <h1 className="font-bold text-gray-800 text-lg">{question.title}</h1>
              <DifficultyBadge difficulty={question.difficulty} />
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {(question.tags || []).slice(0, 3).map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className="flex items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold text-gray-600">
            <Clock size={14} />
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
            <CheckCircle size={14} className={solved ? 'fill-green-500 text-white' : ''} />
            {solved ? 'Solved ✓' : 'Mark Solved'}
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-1">
            <Code2 size={14} className="text-gray-400" />
            <div className="flex gap-1">
              {(Object.keys(LANG_CONFIG) as Language[]).map(l => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                    lang === l ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {LANG_CONFIG[l].label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={runCode}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            {running ? 'Running...' : 'Run Code'}
          </button>
        </div>

        {/* Code textarea */}
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          spellCheck={false}
          className="w-full h-[500px] p-4 font-mono text-sm bg-gray-900 text-gray-100 resize-none focus:outline-none leading-relaxed"
          placeholder="Write your code here..."
        />
      </div>

      {/* Output panel */}
      <div className="mt-4 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Output</span>
        </div>
        <pre className="p-4 text-sm text-gray-200 font-mono overflow-x-auto min-h-[100px] whitespace-pre-wrap">
          {output || 'Run your code to see output here...'}
        </pre>
      </div>

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
