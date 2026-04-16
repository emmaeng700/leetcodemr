'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2, Search } from 'lucide-react'
import BestAnswersPanel from '@/components/BestAnswersPanel'
import { getOpenQuestionContext, setOpenQuestionContext } from '@/lib/openQuestionContext'

type QuestionRow = { id: number; slug: string; title?: string }

const SEARCH_Q = `query($q:String!){problemsetQuestionListV2(categorySlug:"",limit:15,skip:0,searchKeyword:$q,filters:{filterCombineType:ALL}){questions{titleSlug title questionFrontendId}}}`

function AnswersPageInner() {
  const searchParams = useSearchParams()
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [query, setQuery] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const [selected, setSelected] = useState<QuestionRow | null>(null)
  const [session, setSession] = useState('')
  const [csrf, setCsrf] = useState('')
  const [lcResults, setLcResults] = useState<QuestionRow[]>([])
  const [lcSearching, setLcSearching] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef(0)
  const skipAutoRef = useRef(false)
  const autoAppliedRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/questions_full.json')
      .then(r => r.json())
      .then(setQuestions)
      .catch(() => {})
  }, [])

  useEffect(() => {
    const ls = localStorage.getItem('lc_session') ?? ''
    const lc = localStorage.getItem('lc_csrf') ?? ''
    if (ls && lc) {
      setSession(ls)
      setCsrf(lc)
    } else {
      fetch('/api/lc-session')
        .then(r => r.json())
        .then(d => {
          if (d.lc_session && d.lc_csrf) {
            setSession(d.lc_session)
            setCsrf(d.lc_csrf)
          }
        })
        .catch(() => {})
    }
  }, [])

  /** Open problem from ?id=&slug= URL or last problem from Practice / Learn / etc. */
  useEffect(() => {
    if (skipAutoRef.current) return

    const idRaw = searchParams.get('id')
    const slugRaw = searchParams.get('slug')
    let id = idRaw ? parseInt(idRaw, 10) : NaN
    let slug = (slugRaw ?? '').trim()
    let title = searchParams.get('title')?.trim() || undefined

    const fromUrl = Number.isFinite(id) && id > 0
    const ctx = getOpenQuestionContext()

    if (!fromUrl && ctx) {
      id = ctx.id
      slug = ctx.slug
      title = ctx.title ?? title
    } else if (fromUrl && !slug && ctx && ctx.id === id) {
      slug = ctx.slug
      title = title ?? ctx.title
    }

    if (!Number.isFinite(id) || id <= 0) return

    if (!slug && questions.length > 0) {
      const row = questions.find(q => q.id === id)
      if (row) {
        slug = row.slug
        title = title ?? row.title
      }
    }

    if (!slug) return

    const key = `${id}:${slug}`
    if (autoAppliedRef.current === key) return
    autoAppliedRef.current = key

    setSelected({ id, slug, title })
    setQuery(`#${id} ${title ?? slug}`)
    setShowDrop(false)
    setLcResults([])
  }, [searchParams, questions])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q || q.length < 2 || selected || !session) {
      setLcResults([])
      return
    }
    const t = setTimeout(async () => {
      const rid = ++searchRef.current
      setLcSearching(true)
      try {
        const res = await fetch('/api/leetcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session, csrfToken: csrf, query: SEARCH_Q, variables: { q } }),
        })
        const data = await res.json()
        if (searchRef.current !== rid) return
        const qs: Array<{ titleSlug: string; title: string; questionFrontendId: string }> =
          data?.data?.problemsetQuestionListV2?.questions ?? []
        setLcResults(qs.map(x => ({ id: parseInt(x.questionFrontendId), slug: x.titleSlug, title: x.title })))
      } catch {
        if (searchRef.current === rid) setLcResults([])
      } finally {
        if (searchRef.current === rid) setLcSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, selected, session, csrf])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || selected) return []
    const byId = q.replace(/^#/, '')
    const local = questions
      .filter(x => {
        if (byId && String(x.id).startsWith(byId)) return true
        if ((x.slug ?? '').toLowerCase().includes(q)) return true
        if ((x.title ?? '').toLowerCase().includes(q)) return true
        return false
      })
      .slice(0, 6)
    const localIds = new Set(local.map(x => x.id))
    return [...local, ...lcResults.filter(x => !localIds.has(x.id))].slice(0, 12)
  }, [query, questions, selected, lcResults])

  const selectQuestion = (q: QuestionRow) => {
    setOpenQuestionContext(q)
    setSelected(q)
    setQuery(`#${q.id} ${q.title ?? q.slug}`)
    setShowDrop(false)
    setLcResults([])
  }

  const clear = () => {
    skipAutoRef.current = true
    autoAppliedRef.current = null
    setSelected(null)
    setQuery('')
    setLcResults([])
  }

  return (
    <div className="min-h-screen bg-[#0b1020] text-gray-100 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-100">Answers</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Compare Python solutions across 4 sites — opens your last active problem automatically
          </p>
        </div>

        <div ref={wrapRef} className="relative mb-6">
          <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setSelected(null)
                setShowDrop(true)
              }}
              onFocus={() => setShowDrop(true)}
              placeholder="Search any LeetCode question…"
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
            />
            {lcSearching && <Loader2 size={13} className="animate-spin text-gray-500 shrink-0" />}
            {query && !lcSearching && (
              <button type="button" onClick={clear} className="text-xs text-gray-500 hover:text-gray-300 shrink-0" aria-label="Clear">
                {'\u2715'}
              </button>
            )}
          </div>

          {showDrop && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0d1425] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              {matches.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onMouseDown={() => selectQuestion(m)}
                  className="w-full px-4 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-gray-800/60 last:border-b-0 flex items-center gap-3"
                >
                  <span className="text-xs font-bold text-indigo-400 shrink-0">#{m.id}</span>
                  <span className="text-sm text-gray-200 truncate">{m.title ?? m.slug}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <p className="text-xs text-gray-500 mb-4">
            Showing answers for{' '}
            <span className="text-gray-300 font-semibold">
              #{selected.id} {selected.title ?? selected.slug}
            </span>
          </p>
        )}

        {selected ? (
          <BestAnswersPanel
            questionId={selected.id}
            slug={selected.slug}
            active
            theme="default"
            layout="full"
            className="text-gray-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Search size={30} className="text-gray-800 mb-3" />
            <p className="text-gray-600 text-sm">Search a question, or open one in Practice / Learn first</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AnswersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b1020] flex items-center justify-center text-gray-500 text-sm gap-2"><Loader2 size={16} className="animate-spin" /> Loading…</div>}>
      <AnswersPageInner />
    </Suspense>
  )
}
