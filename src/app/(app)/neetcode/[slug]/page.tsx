'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Clock, BookOpen, ExternalLink, Loader2, Trophy, Sparkles } from 'lucide-react'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import { formatTime, stripScripts, leetCodeUrl } from '@/lib/utils'
import LeetCodeEditor from '@/components/LeetCodeEditor'
import AcceptedSolutions, { useAcceptedSolutions } from '@/components/AcceptedSolutions'
import { createClient } from '@supabase/supabase-js'
import { NEETCODE_150 } from '@/lib/neetcode150'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const USER_ID = 'emmanuel'

const CONTENT_Q = `query($s:String!){question(titleSlug:$s){content isPaidOnly topicTags{name}}}`

const DIFF_COLOR: Record<string, string> = {
  Easy: 'text-green-400',
  Medium: 'text-yellow-400',
  Hard: 'text-red-400',
}

export default function NeetCodeQuestionPage() {
  const params = useParams()
  const router = useRouter()
  const slug = String(params.slug)

  const q = NEETCODE_150.flatMap(c => c.questions).find(x => x.slug === slug) ?? null

  const [content, setContent] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [contentLoading, setContentLoading] = useState(true)
  const [contentFailed, setContentFailed] = useState(false)
  const [isPremium, setIsPremium] = useState(false)
  const [solved, setSolved] = useState(false)
  const [activeTab, setActiveTab] = useState<'description' | 'best' | 'accepted' | 'editor'>('description')
  const leftPanelTab = activeTab === 'editor' ? 'description' : activeTab
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef = useRef(Date.now())

  const { submissions, subsLoading, selectedSub, subCodeLoading, copiedSub, loadSubCode, copyCode, clearSub } =
    useAcceptedSolutions(slug, activeTab === 'accepted')

  // Load solved status
  useEffect(() => {
    if (!q) return
    supabase
      .from('progress')
      .select('solved')
      .eq('user_id', USER_ID)
      .eq('question_id', q.id)
      .single()
      .then(({ data }) => { if (data) setSolved(!!data.solved) })
  }, [q?.id])

  // Fetch question content from LC API
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setContentLoading(true)
    setContentFailed(false)
    setIsPremium(false)

    async function doFetch() {
      let session = localStorage.getItem('lc_session') || ''
      let csrfToken = localStorage.getItem('lc_csrf') || ''
      if (!session) {
        try {
          const d = await fetch('/api/lc-session').then(r => r.json())
          if (d.lc_session) {
            session = d.lc_session
            csrfToken = d.lc_csrf || ''
            localStorage.setItem('lc_session', session)
            localStorage.setItem('lc_csrf', csrfToken)
          }
        } catch { /* silent */ }
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      try {
        const res = await fetch('/api/leetcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ session, csrfToken, query: CONTENT_Q, variables: { s: slug } }),
        })
        const data = await res.json()
        if (cancelled) return
        const question = data?.data?.question
        if (question?.isPaidOnly && !question?.content) {
          setIsPremium(true)
        } else if (question?.content) {
          setContent(question.content)
          setTags((question.topicTags ?? []).map((t: { name: string }) => t.name))
        } else {
          setContentFailed(true)
        }
      } catch {
        if (!cancelled) setContentFailed(true)
      } finally {
        clearTimeout(timeout)
        if (!cancelled) setContentLoading(false)
      }
    }

    doFetch()
    return () => { cancelled = true }
  }, [slug])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    startRef.current = Date.now()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function handleMarkSolved() {
    if (!q) return
    const newSolved = !solved
    setSolved(newSolved)
    await supabase.from('progress').upsert(
      { user_id: USER_ID, question_id: q.id, solved: newSolved },
      { onConflict: 'user_id,question_id' }
    )
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex flex-wrap items-center px-3 sm:px-4 py-2 sm:py-2.5 border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 gap-x-2 gap-y-1">
        <button onClick={() => router.back()} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>

        {q ? (
          <div className="order-last w-full sm:order-none sm:w-auto sm:flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-[var(--text-subtle)] font-mono shrink-0 hidden sm:inline">#{q.id}</span>
            <h1 className="font-bold text-[var(--text)] text-sm leading-snug truncate">{q.title}</h1>
            <span className={`text-xs font-bold shrink-0 hidden sm:inline ${DIFF_COLOR[q.difficulty]}`}>{q.difficulty}</span>
            <a href={leetCodeUrl(slug)} target="_blank" rel="noopener noreferrer"
              className="shrink-0 text-[var(--text-muted)] hover:text-orange-400 transition-colors hidden sm:inline"
              title="Open on LeetCode">
              <ExternalLink size={12} />
            </a>
          </div>
        ) : (
          <div className="order-last w-full sm:order-none h-4 w-48 bg-[var(--bg-muted)] rounded animate-pulse" />
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 bg-[var(--bg-muted)] border border-[var(--border)] px-3 py-1.5 rounded-lg text-sm font-mono font-semibold text-[var(--text-muted)]">
            <Clock size={13} />
            {formatTime(timer)}
          </div>
          <button
            onClick={handleMarkSolved}
            disabled={!q}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors border disabled:opacity-40 ${
              solved
                ? 'bg-green-50 text-green-600 border-green-200'
                : 'bg-[var(--bg-muted)] text-[var(--text-subtle)] border-[var(--border)] hover:border-green-500/50 hover:text-green-400'
            }`}
          >
            <CheckCircle size={13} className={solved ? 'fill-green-500 text-white' : ''} />
            <span className="hidden sm:inline">{solved ? 'Solved ✓' : 'Mark Solved'}</span>
            <span className="sm:hidden">{solved ? '✓' : 'Solve'}</span>
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-card)] shrink-0 scrollbar-none">
        <button onClick={() => setActiveTab('description')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'description' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          <BookOpen size={12} /> Description
          {contentLoading && <Loader2 size={10} className="animate-spin text-[var(--text-muted)]" />}
        </button>
        <button onClick={() => setActiveTab('best')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'best' ? 'border-amber-500 text-amber-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          <Sparkles size={12} /> Best answers
        </button>
        <button onClick={() => setActiveTab('accepted')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${leftPanelTab === 'accepted' ? 'border-green-500 text-green-600' : 'border-transparent text-[var(--text-subtle)] hover:text-[var(--text)]'}`}>
          <Trophy size={12} /> My Solutions
        </button>
      </div>

      {/* Content area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        {/* Non-editor tabs */}
        <div className="relative z-10 flex flex-col w-full md:w-[42%] md:shrink-0 bg-[var(--bg-card)] overflow-hidden text-[var(--text)] border-r border-[var(--border)]">
          <div className="flex-1 overflow-y-auto p-4">

            {leftPanelTab === 'description' && (
              <>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {tags.map(t => (
                      <span key={t} className="text-xs bg-[var(--bg-muted)] text-[var(--text-subtle)] px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                )}
                {content ? (
                  <div className="lc-description text-sm text-[var(--text)]"
                    dangerouslySetInnerHTML={{ __html: stripScripts(content) }} />
                ) : isPremium ? (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                    <div className="text-4xl mb-3">🔒</div>
                    <h3 className="font-bold text-[var(--text)] text-base mb-1">LeetCode Premium Question</h3>
                    <p className="text-sm text-[var(--text-muted)] mb-4 max-w-xs">This question requires a LeetCode Premium subscription.</p>
                    <a href={leetCodeUrl(slug)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors">
                      Open on LeetCode ↗
                    </a>
                  </div>
                ) : contentLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-5/6" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-4/6" />
                    <div className="h-10 bg-[var(--bg-muted)] rounded w-full mt-4" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-full" />
                    <div className="h-3 bg-[var(--bg-muted)] rounded w-3/4" />
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-[var(--text-subtle)] text-sm mb-3">
                      {contentFailed ? 'Could not load description — set up your LeetCode session to fetch it.' : 'No description available.'}
                    </p>
                    <a href={leetCodeUrl(slug)} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
                      <ExternalLink size={12} /> View on LeetCode
                    </a>
                  </div>
                )}
              </>
            )}

            {leftPanelTab === 'best' && q && (
              <BestAnswersPanel questionId={q.id} slug={slug} active={leftPanelTab === 'best'} />
            )}

            {leftPanelTab === 'accepted' && (
              <AcceptedSolutions
                submissions={submissions}
                loading={subsLoading}
                selectedSub={selectedSub}
                subCodeLoading={subCodeLoading}
                copied={copiedSub}
                onSelect={loadSubCode}
                onCopy={copyCode}
                onBack={clearSub}
              />
            )}
          </div>
        </div>

        {/* Editor panel */}
        <div className="relative z-0 flex flex-col w-full md:w-[58%] flex-1 min-h-[28rem] overflow-x-hidden border-t border-[var(--border)] md:border-t-0">
          <LeetCodeEditor
            appQuestionId={q?.id ?? 0}
            slug={slug}
            syncToApp={false}
          />
        </div>
      </div>
    </div>
  )
}
