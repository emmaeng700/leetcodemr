'use client'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ExternalLink, Loader2, Search, AlertCircle } from 'lucide-react'

type QuestionRow = { id: number; slug: string; title?: string }
interface CodeBlock { code: string; lang: string }
interface SiteState {
  status: 'idle' | 'loading' | 'done' | 'error'
  blocks: CodeBlock[]
  url: string
  error?: string
}

const SITES = [
  { key: 'walkccc',    label: 'WalkCC',      color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5'    },
  { key: 'doocs',      label: 'LeetDoocs',   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { key: 'simplyleet', label: 'SimplyLeet',  color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/5'  },
  { key: 'leetcodeca', label: 'LeetCode.ca', color: 'text-orange-400',  border: 'border-orange-500/30',  bg: 'bg-orange-500/5'  },
] as const

type SiteKey = typeof SITES[number]['key']

const LANG_LABEL: Record<string, string> = {
  python: 'Python', cpp: 'C++', java: 'Java',
  javascript: 'JavaScript', typescript: 'TypeScript',
  go: 'Go', rust: 'Rust', ruby: 'Ruby', swift: 'Swift',
  kotlin: 'Kotlin', scala: 'Scala', text: 'Code',
}

const INIT = (): Record<SiteKey, SiteState> => ({
  walkccc:    { status: 'idle', blocks: [], url: '' },
  doocs:      { status: 'idle', blocks: [], url: '' },
  simplyleet: { status: 'idle', blocks: [], url: '' },
  leetcodeca: { status: 'idle', blocks: [], url: '' },
})

/* ── Syntax highlighting with highlight.js ── */
function HighlightedCode({ code, lang }: { code: string; lang: string }) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.textContent = code
    import('highlight.js/lib/core').then(async ({ default: hljs }) => {
      const [py, cpp, java, js, ts, go, rust] = await Promise.all([
        import('highlight.js/lib/languages/python'),
        import('highlight.js/lib/languages/cpp'),
        import('highlight.js/lib/languages/java'),
        import('highlight.js/lib/languages/javascript'),
        import('highlight.js/lib/languages/typescript'),
        import('highlight.js/lib/languages/go'),
        import('highlight.js/lib/languages/rust'),
      ])
      if (!hljs.getLanguage('python'))     hljs.registerLanguage('python',     py.default)
      if (!hljs.getLanguage('cpp'))        hljs.registerLanguage('cpp',        cpp.default)
      if (!hljs.getLanguage('java'))       hljs.registerLanguage('java',       java.default)
      if (!hljs.getLanguage('javascript')) hljs.registerLanguage('javascript', js.default)
      if (!hljs.getLanguage('typescript')) hljs.registerLanguage('typescript', ts.default)
      if (!hljs.getLanguage('go'))         hljs.registerLanguage('go',         go.default)
      if (!hljs.getLanguage('rust'))       hljs.registerLanguage('rust',       rust.default)

      if (!ref.current) return
      const validLang = hljs.getLanguage(lang) ? lang : 'text'
      if (validLang === 'text') {
        ref.current.textContent = code
      } else {
        ref.current.innerHTML = hljs.highlight(code, { language: validLang }).value
      }
    })
  }, [code, lang])

  return (
    <pre className="text-[11px] leading-relaxed bg-[#080e1c] rounded-lg p-3 overflow-x-auto border border-gray-800/60 whitespace-pre">
      <code ref={ref} />
    </pre>
  )
}

export default function AnswersPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [query,     setQuery]     = useState('')
  const [showDrop,  setShowDrop]  = useState(false)
  const [selected,  setSelected]  = useState<QuestionRow | null>(null)
  const [states,    setStates]    = useState<Record<SiteKey, SiteState>>(INIT)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/questions_full.json').then(r => r.json()).then(setQuestions).catch(() => {})

    // Inject atom-one-dark theme for hljs
    if (!document.getElementById('hljs-theme')) {
      const link = document.createElement('link')
      link.id   = 'hljs-theme'
      link.rel  = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setShowDrop(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || selected) return []
    const byId = q.replace(/^#/, '')
    return questions.filter(x => {
      if (byId && String(x.id).startsWith(byId)) return true
      if ((x.slug ?? '').toLowerCase().includes(q)) return true
      if ((x.title ?? '').toLowerCase().includes(q)) return true
      return false
    }).slice(0, 8)
  }, [query, questions, selected])

  const fetchSite = useCallback((site: SiteKey, q: QuestionRow) => {
    setStates(prev => ({ ...prev, [site]: { status: 'loading', blocks: [], url: '' } }))
    fetch(`/api/answers?site=${site}&slug=${encodeURIComponent(q.slug)}&id=${q.id}`)
      .then(r => r.json())
      .then(data => {
        setStates(prev => ({
          ...prev,
          [site]: {
            status: (data.error && !data.blocks?.length) ? 'error' : 'done',
            blocks: data.blocks ?? [],
            url:    data.url   ?? '',
            error:  data.error,
          },
        }))
      })
      .catch(err => {
        setStates(prev => ({ ...prev, [site]: { status: 'error', blocks: [], url: '', error: String(err) } }))
      })
  }, [])

  const selectQuestion = (q: QuestionRow) => {
    setSelected(q)
    setQuery(`#${q.id} ${q.title ?? q.slug}`)
    setShowDrop(false)
    setStates(INIT())
    SITES.forEach(s => fetchSite(s.key, q))
  }

  const clear = () => { setSelected(null); setQuery(''); setStates(INIT()) }

  return (
    <div className="min-h-screen bg-[#0b1020] text-gray-100 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-6">

        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-100">Answers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Compare solutions across 4 sites instantly</p>
        </div>

        {/* Search */}
        <div ref={wrapRef} className="relative mb-6">
          <div className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-4 py-3">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setSelected(null); setShowDrop(true) }}
              onFocus={() => setShowDrop(true)}
              placeholder="Search by question name or number…"
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
            />
            {query && (
              <button onClick={clear} className="text-xs text-gray-500 hover:text-gray-300 shrink-0">✕</button>
            )}
          </div>

          {showDrop && matches.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0d1425] border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
              {matches.map(m => (
                <button
                  key={m.id}
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
            Showing answers for <span className="text-gray-300 font-semibold">#{selected.id} {selected.title ?? selected.slug}</span>
          </p>
        )}

        {/* 4 panels */}
        {selected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SITES.map(site => {
              const s = states[site.key]
              return (
                <div key={site.key} className={`rounded-xl border ${site.border} ${site.bg} flex flex-col overflow-hidden`}>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800/50 shrink-0">
                    <span className={`text-sm font-bold ${site.color}`}>{site.label}</span>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        <ExternalLink size={11} /> Open
                      </a>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-3 max-h-[22rem]">
                    {s.status === 'idle' && (
                      <div className="py-10 text-center text-xs text-gray-600">Waiting…</div>
                    )}
                    {s.status === 'loading' && (
                      <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
                        <Loader2 size={13} className="animate-spin" />
                        <span className="text-xs">Fetching…</span>
                      </div>
                    )}
                    {s.status === 'error' && (
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <AlertCircle size={16} className="text-gray-600" />
                        <p className="text-xs text-gray-500">Could not load solutions</p>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:underline">Open on site →</a>
                        )}
                      </div>
                    )}
                    {s.status === 'done' && s.blocks.length === 0 && (
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <p className="text-xs text-gray-500">No solutions found</p>
                        {s.url && (
                          <a href={s.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-indigo-400 hover:underline">Open on site →</a>
                        )}
                      </div>
                    )}
                    {s.status === 'done' && s.blocks.map((b, i) => (
                      <div key={i} className="mb-4 last:mb-0">
                        <div className="mb-1.5">
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-400">
                            {LANG_LABEL[b.lang] ?? b.lang}
                          </span>
                        </div>
                        <HighlightedCode code={b.code} lang={b.lang} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <Search size={30} className="text-gray-800 mb-3" />
            <p className="text-gray-600 text-sm">Search a question to compare answers across all sites</p>
          </div>
        )}
      </div>
    </div>
  )
}
