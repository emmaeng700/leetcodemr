'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { RotateCcw, Code2, Wifi, WifiOff, Cloud, CloudOff, Copy, Check } from 'lucide-react'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { saveGrindSession } from '@/lib/db'
import {
  writeGrindDraft,
  type GrindLang,
} from '@/lib/grindStorage'
import {
  applyGrindStampOnEdit,
  clearGrindStartedAt,
  getGrindSessionChipLabel,
} from '@/lib/grindStamp'
import {
  ensureGrindStarterCached,
  resolveGrindStarterSync,
} from '@/lib/grindStarter'
import { scheduleMidnightGrindRefresh } from '@/lib/grindPipeline'
import { runGrindRecheckPipeline } from '@/lib/grindRecheck'
import { resolveGrindCodeForLoad } from '@/lib/grindSync'
import type { GrindQuestion } from '@/lib/grindQuestions'
import { formatDescriptionPlain } from '@/lib/formatDescription'
import { loadQuestionsDataAllRows } from '@/lib/grindQuestions'
import { stripScripts } from '@/lib/utils'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })

interface GrindEditorProps {
  question: GrindQuestion
  className?: string
}

export default function GrindEditor({ question, className = '' }: GrindEditorProps) {
  const { height: vvHeight, keyboardOpen } = useMobileViewport()
  const [lang, setLang] = useState<GrindLang>('python3')
  const [code, setCode] = useState('')
  const [starter, setStarter] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sessionLabel, setSessionLabel] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<'local' | 'synced' | 'offline'>('local')
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [extensions, setExtensions] = useState<any[]>([])
  const [editorTheme, setEditorTheme] = useState<any>(null)
  const [description, setDescription] = useState<string>('')
  const [descriptionHtml, setDescriptionHtml] = useState<string>('')
  const descCacheRef = useRef<Record<number, { plain: string; html: string }>>({})
  const editorViewRef = useRef<unknown>(null)
  const portalViewRef = useRef<unknown>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadGenRef = useRef(0)
  const codeRef = useRef('')

  useEffect(() => {
    codeRef.current = code
  }, [code])

  useEffect(() => {
    async function loadExtensions() {
      const [{ python }, { cpp }, viewMod, stateMod, cmdMod] = await Promise.all([
        import('@codemirror/lang-python'),
        import('@codemirror/lang-cpp'),
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/commands'),
      ])
      const { keymap } = viewMod
      const { Prec } = stateMod
      const { indentWithTab } = cmdMod
      const { oneDark } = await import('@codemirror/theme-one-dark')
      const { indentationMarkers } = await import('@replit/codemirror-indentation-markers')
      const smartEnter = (view: any) => {
        const { from, to } = view.state.selection.main
        const line = view.state.doc.lineAt(from)
        const base = line.text.match(/^(\s*)/)?.[1] ?? ''
        const trimmed = line.text.trimEnd()
        const extra = trimmed.endsWith(':') || trimmed.endsWith('{') ? '    ' : ''
        const insert = '\n' + base + extra
        view.dispatch({
          changes: { from, to, insert },
          selection: { anchor: from + insert.length },
        })
        return true
      }
      setEditorTheme(oneDark)
      setExtensions([
        lang === 'python3' ? python() : cpp(),
        Prec.highest(keymap.of([{ key: 'Enter', run: smartEnter }, indentWithTab])),
        indentationMarkers(),
        viewMod.EditorView.lineWrapping,
      ])
    }
    void loadExtensions()
  }, [lang])

  useEffect(() => {
    const gen = ++loadGenRef.current
    let cancelled = false

    async function loadQuestionCode() {
      setLoading(true)

      const syncStarter = resolveGrindStarterSync(question, lang)
      setStarter(syncStarter)

      const resolvedStarter = await ensureGrindStarterCached(question, lang)
      if (cancelled || gen !== loadGenRef.current) return
      setStarter(resolvedStarter)

      const loaded = await resolveGrindCodeForLoad(
        question.id,
        lang,
        resolvedStarter,
        question.interviewApproach,
      )
      if (cancelled || gen !== loadGenRef.current) return

      setCode(loaded.code)
      setSessionLabel(loaded.sessionLabel)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncState('offline')
      } else {
        setSyncState(loaded.synced ? 'synced' : 'local')
      }
      setLoading(false)
    }

    void loadQuestionCode()
    return () => {
      cancelled = true
    }
  }, [question.id, question.slug, question.title, question.set, lang, question.starterPython, question.starterCpp, question.interviewApproach])
  
  useEffect(() => {
    let cancelled = false
    async function loadDescription() {
      const bakedHtml = question.descriptionHtml?.trim() ?? ''
      const bakedPlain = question.description?.trim()
        ? formatDescriptionPlain(question.description)
        : ''
      if (bakedHtml || bakedPlain) {
        const entry = { plain: bakedPlain, html: bakedHtml }
        descCacheRef.current[question.id] = entry
        if (!cancelled) {
          setDescription(entry.plain)
          setDescriptionHtml(entry.html)
        }
        return
      }

      const cached = descCacheRef.current[question.id]
      if (cached != null) {
        setDescription(cached.plain)
        setDescriptionHtml(cached.html)
        return
      }
      try {
        const all = await loadQuestionsDataAllRows()
        const row = all[question.id]
        const plain = formatDescriptionPlain(row?.description ?? '')
        const html = row?.descriptionHtml ?? ''
        descCacheRef.current[question.id] = { plain, html }
        if (!cancelled) {
          setDescription(plain)
          setDescriptionHtml(html)
        }
      } catch {
        if (!cancelled) {
          setDescription('')
          setDescriptionHtml('')
        }
      }
    }
    void loadDescription()
    return () => { cancelled = true }
  }, [question.id, question.description, question.descriptionHtml])

  useEffect(() => {
    if (!descriptionHtml || typeof navigator === 'undefined' || !navigator.onLine) return
    for (const m of descriptionHtml.matchAll(/\/description-images\/[a-zA-Z0-9._-]+/g)) {
      fetch(m[0], { cache: 'reload' }).catch(() => {})
    }
  }, [descriptionHtml])

  const applyRecheckResult = useCallback(
    (piped: { code: string; sessionLabel: string | null; synced: boolean }) => {
      if (piped.code !== codeRef.current) {
        codeRef.current = piped.code
        setCode(piped.code)
      }
      setSessionLabel(piped.sessionLabel)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncState('offline')
      } else {
        setSyncState(piped.synced ? 'synced' : 'local')
      }
    },
    [],
  )

  const runRecheck = useCallback(async () => {
    if (loading) return
    const base = starter || resolveGrindStarterSync(question, lang)
    const piped = await runGrindRecheckPipeline(
      question.id,
      lang,
      codeRef.current,
      base,
      question.interviewApproach,
    )
    applyRecheckResult(piped)
  }, [loading, starter, question, lang, applyRecheckResult])

  useEffect(() => {
    const onOnline = () => {
      void runRecheck()
    }
    const onOffline = () => setSyncState('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [runRecheck])

  useEffect(() => {
    const refreshIfNewer = () => {
      if (document.visibilityState !== 'visible' || loading) return
      void runRecheck()
    }
    document.addEventListener('visibilitychange', refreshIfNewer)
    window.addEventListener('focus', refreshIfNewer)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfNewer)
      window.removeEventListener('focus', refreshIfNewer)
    }
  }, [runRecheck, loading])

  useEffect(() => {
    const cancelMidnight = scheduleMidnightGrindRefresh(() => {
      void runRecheck()
    })
    return cancelMidnight
  }, [runRecheck])

  const handleChange = useCallback(
    (val: string) => {
      const next = applyGrindStampOnEdit(question.id, lang, val)
      setCode(next)
      setSessionLabel(getGrindSessionChipLabel(question.id, lang, next))
      writeGrindDraft(question.id, lang, next)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 1200)

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setSyncState('offline')
          return
        }
        saveGrindSession(question.id, lang, next)
          .then(() => setSyncState('synced'))
          .catch(() => setSyncState('local'))
      }, 2000)
    },
    [question.id, lang],
  )

  const reset = useCallback(() => {
    clearGrindStartedAt(question.id, lang)
    setCode(starter)
    setSessionLabel(null)
    writeGrindDraft(question.id, lang, starter)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      saveGrindSession(question.id, lang, starter).catch(() => {})
    }
    setSyncState(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'offline')
  }, [starter, question.id, lang])

  const copyCode = useCallback(async () => {
    const text = codeRef.current
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [])

  const langToggle = (
    <div className="flex items-center gap-1 bg-[#313244] rounded-lg p-0.5">
      {(['python3', 'cpp'] as const).map(l => (
        <button
          key={l}
          type="button"
          onPointerDown={e => e.preventDefault()}
          onClick={() => setLang(l)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
            lang === l
              ? l === 'python3'
                ? 'bg-blue-600 text-white'
                : 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          {l === 'python3' ? 'Python' : 'C++'}
        </button>
      ))}
    </div>
  )

  const syncLabel = (
    <span className="flex items-center gap-1 text-[10px] text-gray-500">
      {syncState === 'synced' ? (
        <>
          <Cloud size={10} className="text-green-400" /> Synced
        </>
      ) : syncState === 'offline' ? (
        <>
          <CloudOff size={10} className="text-orange-400" /> Offline - saved locally
        </>
      ) : (
        <>
          <Wifi size={10} className="text-blue-400" /> Saved locally
        </>
      )}
      {savedFlash && <span className="text-green-400 ml-1">ok</span>}
    </span>
  )

  const footerBar = (
    <div className="flex items-center justify-between px-4 py-2 bg-[#181825] border-t border-gray-700 flex-wrap gap-2 shrink-0">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        {syncLabel}
        {sessionLabel && (
          <span
            className="text-[10px] text-indigo-200/90 bg-indigo-950/50 border border-indigo-800/60 px-2 py-0.5 rounded-full truncate max-w-[14rem] sm:max-w-none"
            title={`Last grind: ${sessionLabel}`}
          >
            Last grind: {sessionLabel}
          </span>
        )}
        <span className="text-[10px] text-gray-600 hidden sm:inline">no submit - write from memory</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void copyCode()}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-300 bg-[#313244] hover:bg-[#45475a] transition-colors"
        >
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-300 bg-[#313244] hover:bg-[#45475a] transition-colors"
        >
          <RotateCcw size={11} /> Reset to starter
        </button>
      </div>
    </div>
  )

  const editorBody = (height: string, isPortal: boolean) => (
    <>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#1e1e2e]/80 text-xs text-gray-400">
          Loading starter...
        </div>
      )}
      {typeof window !== 'undefined' && CodeMirror && (
        <CodeMirror
          key={`${isPortal ? 'p' : 'n'}-${question.id}-${lang}`}
          value={code}
          height={height}
          theme={editorTheme ?? 'dark'}
          extensions={extensions}
          onChange={handleChange}
          onCreateEditor={(view: unknown) => {
            if (isPortal) portalViewRef.current = view
            else editorViewRef.current = view
          }}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
            indentOnInput: true,
            bracketMatching: true,
            closeBrackets: true,
          }}
          style={height === '100%' ? { height: '100%' } : undefined}
        />
      )}
    </>
  )

  const mobilePortalStyle =
    vvHeight != null
      ? { zIndex: 9999, top: 0, left: 0, right: 0, height: vvHeight, maxHeight: vvHeight, bottom: 'auto' as const }
      : { zIndex: 9999 }

  useEffect(() => {
    if (!keyboardOpen || typeof document === 'undefined') return
    document.body.classList.add('grind-kbd-open')
    return () => { document.body.classList.remove('grind-kbd-open') }
  }, [keyboardOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onFocusIn = (e: FocusEvent) => {
      if (!window.matchMedia('(max-width: 767px)').matches) return
      if (editorExpanded) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('.cm-editor')) setEditorExpanded(true)
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [editorExpanded])

  return (
    <>
      <div className={`flex flex-col h-full min-h-0 gap-2 ${className}`}>
        <div className="flex flex-col flex-1 min-h-0 bg-[#1e1e2e] rounded-xl border border-gray-700 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#181825] border-b border-gray-700 flex-wrap shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Code2 size={14} className="text-indigo-400 shrink-0" />
            <span className="text-xs font-bold text-gray-200 truncate">
              #{question.id} - {question.title}
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${
                question.set === 1
                  ? 'bg-indigo-900/40 text-indigo-300 border-indigo-700'
                  : question.set === 2
                    ? 'bg-emerald-900/40 text-emerald-300 border-emerald-700'
                    : 'bg-purple-900/40 text-purple-300 border-purple-700'
              }`}
            >
              Set {question.set}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {typeof navigator !== 'undefined' && !navigator.onLine && (
              <WifiOff size={12} className="text-orange-400" />
            )}
            {langToggle}
            <button
              type="button"
              onPointerDown={e => e.preventDefault()}
              onClick={() => setEditorExpanded(v => !v)}
              aria-label={editorExpanded ? 'Close full screen editor' : 'Open full screen editor'}
              className="md:hidden px-2 py-1 rounded-md text-xs font-mono bg-[#313244] text-indigo-300 border border-[#585b70] min-h-[44px] min-w-[44px]"
            >
              {editorExpanded ? 'Close' : 'Full'}
            </button>
          </div>
        </div>

        <div className={`practice-cm-wrap relative flex-1 min-h-0 ${editorExpanded ? 'invisible' : ''}`}>
          {editorBody('100%', false)}
        </div>
        {!editorExpanded && footerBar}
      </div>

        {!keyboardOpen && (
        <div
          className="bg-[#1e1e2e] rounded-xl border border-gray-700 shadow-sm overflow-hidden shrink-0"
          role="region"
          aria-label="Problem description"
        >
          <div className="px-4 py-2 bg-[#181825] border-b border-gray-700">
            <span className="text-xs font-bold text-gray-200">Problem Description</span>
          </div>
          <div className="px-4 py-3 h-40 sm:h-48 overflow-y-auto overscroll-contain">
            {descriptionHtml ? (
              <div
                className="grind-desc lc-description text-xs leading-relaxed"
                dangerouslySetInnerHTML={{ __html: stripScripts(descriptionHtml) }}
              />
            ) : description ? (
              <pre className="whitespace-pre-wrap text-xs leading-5 text-gray-200 font-sans">{description}</pre>
            ) : (
              <div className="text-xs text-gray-500">Description not cached yet.</div>
            )}
          </div>
        </div>
        )}
      </div>

      {editorExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="practice-fs-portal fixed inset-0 flex flex-col bg-[#1e1e2e]"
            style={mobilePortalStyle}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#181825] border-b border-gray-700 shrink-0">
              <span className="text-xs font-bold text-gray-200 truncate">
                #{question.id} - {question.title}
              </span>
              <div className="flex items-center gap-2">
                {langToggle}
                <button
                  type="button"
                  onClick={() => setEditorExpanded(false)}
                  className="px-2 py-1 rounded-md text-xs font-mono bg-indigo-700 text-white"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="relative flex-1 min-h-0">{editorBody('100%', true)}</div>
            {footerBar}
          </div>,
          document.body,
        )}
    </>
  )
}
