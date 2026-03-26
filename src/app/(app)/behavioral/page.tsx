'use client'
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Shuffle, RotateCcw, ChevronLeft, ChevronRight, CheckCircle, Circle, RefreshCw, Loader2 } from 'lucide-react'
import { getBehavioralVisited, addBehavioralVisited } from '@/lib/db'
import { shuffle } from '@/lib/utils'
import { createBrowserClient } from '@supabase/ssr'
import { isAdmin } from '@/lib/auth'

interface Story {
  title: string
  situation: string
  task: string
  action: string
  result: string
}

interface BehavioralQuestion {
  id: number
  category: string
  question: string
  stories: Story[]
}

const CATEGORIES = [
  'All', 'Background', 'Conflict & Communication', 'Failure & Growth', 'Leadership',
  'Pressure & Resilience', 'Decision Making', 'Initiative', 'Learning & Adaptability',
  'Prioritisation', 'Problem Solving', 'Stakeholder Management', 'Collaboration',
  'Technical', 'Motivation', 'Design & Product', 'Communication', 'Achievement', 'Judgment',
]

const STAR = [
  { key: 'situation' as keyof Story, label: 'S — Situation', cls: 'bg-blue-50 border-blue-200 text-blue-900' },
  { key: 'task' as keyof Story,      label: 'T — Task',      cls: 'bg-purple-50 border-purple-200 text-purple-900' },
  { key: 'action' as keyof Story,    label: 'A — Action',    cls: 'bg-orange-50 border-orange-200 text-orange-900' },
  { key: 'result' as keyof Story,    label: 'R — Result',    cls: 'bg-green-50 border-green-200 text-green-900' },
]

const STORY_STYLES = [
  { idle: 'bg-indigo-50 text-indigo-700 border-indigo-200', active: 'bg-indigo-600 text-white border-indigo-600' },
  { idle: 'bg-emerald-50 text-emerald-700 border-emerald-200', active: 'bg-emerald-600 text-white border-emerald-600' },
  { idle: 'bg-amber-50 text-amber-700 border-amber-200', active: 'bg-amber-600 text-white border-amber-600' },
]

export default function BehavioralPage() {
  const [allQuestions, setAllQuestions] = useState<BehavioralQuestion[]>([])
  const [cat, setCat] = useState('All')
  const [deck, setDeck] = useState<BehavioralQuestion[]>([])
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [fading, setFading] = useState(false)
  const [isShuffled, setIsShuffled] = useState(false)
  const [visited, setVisited] = useState<Set<number>>(new Set())
  const [storyTab, setStoryTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [regenCount, setRegenCount] = useState(0)
  const [regenerating, setRegenerating] = useState(false)
  const [regenError, setRegenError] = useState('')
  const [regenProgress, setRegenProgress] = useState(0)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data.user?.id ?? null
      const email = data.user?.email ?? null
      setUserId(uid)
      setUserEmail(email)

      if (!uid) {
        setLoading(false)
        return
      }

      // Fetch visited
      const vis = await getBehavioralVisited(uid)
      setVisited(vis)

      // Admin: load from JSON
      if (isAdmin(email)) {
        const qs = await fetch('/behavioral_questions.json').then(r => r.json())
        setAllQuestions(qs)
        setDeck(qs)
        setLoading(false)
        return
      }

      // Regular user: check if they have behavioral answers in DB
      const { data: profile } = await supabase
        .from('profiles')
        .select('behavioral_generated, behavioral_regen_count')
        .eq('id', uid)
        .single()

      setRegenCount(profile?.behavioral_regen_count ?? 0)

      if (profile?.behavioral_generated) {
        // Load from DB
        await loadUserAnswers(supabase, uid)
      } else {
        // Fallback to JSON
        const qs = await fetch('/behavioral_questions.json').then(r => r.json())
        setAllQuestions(qs)
        setDeck(qs)
      }
      setLoading(false)
    })
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadUserAnswers(supabase: any, uid: string) {
    // Load the questions template for structure
    const [questionsTemplate, answersRes] = await Promise.all([
      fetch('/behavioral_questions.json').then(r => r.json()),
      supabase
        .from('behavioral_answers')
        .select('*')
        .eq('user_id', uid)
        .order('question_index', { ascending: true })
        .order('story_index', { ascending: true }),
    ])

    const dbAnswers = answersRes.data || []

    // Group answers by question_index
    const answersByQ: Record<number, Array<{ story_index: number; situation: string; task_text: string; action: string; result: string }>> = {}
    for (const a of dbAnswers) {
      if (!answersByQ[a.question_index]) answersByQ[a.question_index] = []
      answersByQ[a.question_index].push(a)
    }

    // Map to same structure as behavioral_questions.json
    const mapped: BehavioralQuestion[] = questionsTemplate.map((q: any, i: number) => {
      const qAnswers = answersByQ[i] || []
      return {
        id: q.id,
        category: q.category,
        question: q.question,
        stories: qAnswers.length > 0
          ? qAnswers.map((a, si) => ({
              title: `Story ${si + 1}`,
              situation: a.situation,
              task: a.task_text,
              action: a.action,
              result: a.result,
            }))
          : q.stories, // fallback to original if no DB answers for this question
      }
    })

    setAllQuestions(mapped)
    setDeck(mapped)
  }

  useEffect(() => {
    if (!allQuestions.length) return
    const filtered = cat === 'All' ? allQuestions : allQuestions.filter(q => q.category === cat)
    setDeck(isShuffled ? shuffle(filtered) : filtered)
    setIdx(0)
    setFlipped(false)
    setStoryTab(0)
  }, [cat, isShuffled, allQuestions])

  const card = deck[idx] || null

  const fadeSwap = useCallback((fn: () => void) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }, [])

  const go = useCallback((dir: number) => {
    if (!deck.length) return
    fadeSwap(() => {
      setIdx(i => (i + dir + deck.length) % deck.length)
      setFlipped(false)
      setStoryTab(0)
    })
  }, [deck, fadeSwap])

  const handleFlip = useCallback(() => {
    if (!card || !userId) return
    fadeSwap(() => {
      const nowFlipping = !flipped
      setFlipped(nowFlipping)
      setStoryTab(0)
      if (nowFlipping && !visited.has(card.id)) {
        const next = new Set(visited)
        next.add(card.id)
        setVisited(next)
        addBehavioralVisited(userId, card.id)
      }
    })
  }, [card, flipped, fadeSwap, visited, userId])

  const reset = () => {
    setIdx(0)
    setFlipped(false)
    setStoryTab(0)
  }

  async function handleRegenerate() {
    if (regenCount >= 3) return
    setRegenerating(true)
    setRegenError('')
    setRegenProgress(0)

    const savedResume = localStorage.getItem('onboarding_resume') || ''
    if (!savedResume) {
      setRegenError('No resume found. Please go to Profile to update your resume first.')
      setRegenerating(false)
      return
    }

    const interval = setInterval(() => {
      setRegenProgress(p => Math.min(p + 2, 60))
    }, 500)

    const res = await fetch('/api/generate-behavioral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume_text: savedResume }),
    })

    clearInterval(interval)

    if (res.ok) {
      setRegenCount(c => c + 1)
      setRegenProgress(63)
      // Reload answers
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      if (userId) await loadUserAnswers(supabase, userId)
    } else {
      const err = await res.json()
      setRegenError(err.error || 'Regeneration failed')
    }
    setRegenerating(false)
    setRegenProgress(0)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [go, handleFlip])

  if (loading) return <div className="text-center py-32 text-gray-400 animate-pulse text-sm">Loading...</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-0.5">
            <BookOpen className="text-indigo-500" /> Behavioural
          </h1>
          {!isAdmin(userEmail) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{regenCount}/3 regenerations used</span>
              {regenCount < 3 && (
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-50"
                >
                  {regenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  {regenerating ? `Regenerating... ${regenProgress}/63` : 'Regenerate from resume'}
                </button>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400">Tap card to reveal STAR stories · ← → to navigate · Space to flip</p>
        {regenError && <p className="text-red-500 text-xs font-semibold mt-1">{regenError}</p>}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-full">
          {deck.length === 0 ? '0 / 0' : `${idx + 1} / ${deck.length}`}
        </span>
        <span className="text-xs font-semibold bg-green-50 text-green-600 border border-green-200 px-3 py-1.5 rounded-full flex items-center gap-1">
          <CheckCircle size={11} /> {visited.size} / {allQuestions.length} visited
        </span>
        <button
          onClick={() => setIsShuffled(s => !s)}
          className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            isShuffled ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
          }`}
        >
          <Shuffle size={11} /> Shuffle
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border bg-white text-gray-500 border-gray-200 hover:border-gray-400 transition-colors"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors shrink-0 ${
              cat === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Card */}
      {card && (
        <>
          <div
            onClick={handleFlip}
            className="cursor-pointer select-none mb-4"
            style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.18s ease' }}
          >
            {!flipped ? (
              /* FRONT */
              <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-gray-100">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                    {card.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (!userId) return
                        const next = new Set(visited)
                        if (next.has(card.id)) { next.delete(card.id) } else { next.add(card.id); addBehavioralVisited(userId, card.id) }
                        setVisited(next)
                      }}
                      className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors ${
                        visited.has(card.id) ? 'bg-green-50 text-green-600 border-green-300' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-green-300 hover:text-green-500'
                      }`}
                    >
                      {visited.has(card.id) ? <><CheckCircle size={11} /> Visited</> : <><Circle size={11} /> Mark visited</>}
                    </button>
                    <span className="hidden sm:inline text-xs text-gray-300 font-medium">Tap to reveal →</span>
                  </div>
                </div>
                <div className="px-4 py-8 sm:py-10 flex items-center justify-center min-h-[140px]">
                  <p className="text-lg sm:text-xl font-bold text-gray-800 text-center leading-snug">{card.question}</p>
                </div>
                <div className="px-5 pb-4 flex justify-center">
                  <span className="text-xs text-gray-400">
                    {card.stories.length} STAR {card.stories.length === 1 ? 'story' : 'stories'} prepared
                  </span>
                </div>
              </div>
            ) : (
              /* BACK */
              <div className="bg-white rounded-2xl border border-indigo-200 shadow-md overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-5 pt-4 pb-3 border-b border-indigo-100 bg-indigo-50">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 shrink-0">
                      {card.category}
                    </span>
                    <span className="text-sm font-bold text-indigo-800 leading-snug">{card.question}</span>
                  </div>
                  <span className="hidden sm:inline text-xs text-indigo-400 font-medium shrink-0">← Flip back</span>
                </div>

                {/* Story tabs */}
                <div className="px-5 pt-4 pb-0 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  {card.stories.map((story, i) => (
                    <button
                      key={i}
                      onClick={() => setStoryTab(i)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${
                        storyTab === i ? STORY_STYLES[i % 3].active : STORY_STYLES[i % 3].idle
                      }`}
                    >
                      Story {i + 1} — {story.title}
                    </button>
                  ))}
                </div>

                {/* STAR sections */}
                <div className="px-5 py-4 space-y-2" onClick={e => e.stopPropagation()}>
                  {STAR.map(({ key, label, cls }) => (
                    <div key={key} className={`rounded-xl border p-3 ${cls}`}>
                      <div className="text-xs font-bold mb-1">{label}</div>
                      <p className="text-sm leading-relaxed">{card.stories[storyTab]?.[key]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Nav */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => go(-1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm font-medium"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-xs text-gray-400 font-medium">{idx + 1} / {deck.length}</span>
            <button
              onClick={() => go(1)}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm font-medium"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}

      {deck.length === 0 && (
        <div className="text-center py-20 text-gray-400 text-sm">No questions in this category.</div>
      )}
    </div>
  )
}
