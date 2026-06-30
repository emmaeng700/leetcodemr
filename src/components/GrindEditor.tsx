'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { RotateCcw, Code2, Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react'
import GrindInterviewApproach from '@/components/GrindInterviewApproach'
import { useVisualViewportHeight } from '@/hooks/useVisualViewportHeight'
import { saveGrindSession } from '@/lib/db'
import {
  writeGrindDraft,
  clearGrindStartedAt,
  type GrindLang,
} from '@/lib/grindStorage'
import {
  applyGrindStampOnEdit,
} from '@/lib/grindStamp'
import {
  ensureGrindStarterCached,
  resolveGrindStarterSync,
} from '@/lib/grindStarter'
import { resolveGrindCodeForLoad } from '@/lib/grindSync'
import type { GrindQuestion } from '@/lib/grindQuestions'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })

interface GrindEditorProps {
  question: GrindQuestion
  className?: string
}

export default function GrindEditor({ question, className = '' }: GrindEditorProps) {
  const vvHeight = useVisualViewportHeight()
  const [lang, setLang] = useState<GrindLang>('python3')
  const [code, setCode] = useState('')
  const [starter, setStarter] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedFlash, setSavedFlash] = useState(false)
  const [syncState, setSyncState] = useState<'local' | 'synced' | 'offline'>('local')
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [extensions, setExtensions] = useState<any[]>([])
  const [editorTheme, setEditorTheme] = useState<any>(null)
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

      const loaded = await resolveGrindCodeForLoad(question.id, lang, resolvedStarter)
      if (cancelled || gen !== loadGenRef.current) return

      setCode(loaded.code)
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
  }, [question.id, question.slug, question.title, question.set, lang, question.starterPython, question.starterCpp])

  useEffect(() => {
    const onOnline = () => {
      setSyncState(prev => (prev === 'offline' ? 'local' : prev))
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const stamped = applyGrindStampOnEdit(question.id, lang, codeRef.current)
        if (stamped !== codeRef.current) {
          codeRef.current = stamped
          setCode(stamped)
          writeGrindDraft(question.id, lang, stamped)
        }
        saveGrindSession(question.id, lang, codeRef.current)
          .then(() => setSyncState('synced'))
          .catch(() => setSyncState('local'))
      }
    }
    const onOffline = () => setSyncState('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [question.id, lang])

  useEffect(() => {
    const refreshIfNewer = async () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || loading) return
      const base = starter || resolveGrindStarterSync(question, lang)
      const loaded = await resolveGrindCodeForLoad(question.id, lang, base)
      if (loaded.code !== codeRef.current) {
        codeRef.current = loaded.code
        setCode(loaded.code)
        setSyncState(loaded.synced ? 'synced' : 'local')
      }
    }
    document.addEventListener('visibilitychange', refreshIfNewer)
    window.addEventListener('focus', refreshIfNewer)
    return () => {
      document.removeEventListener('visibilitychange', refreshIfNewer)
      window.removeEventListener('focus', refreshIfNewer)
    }
  }, [question.id, lang, starter, loading, question])

  const handleChange = useCallback(
    (val: string) => {
      const next = applyGrindStampOnEdit(question.id, lang, val)
      setCode(next)
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
    writeGrindDraft(question.id, lang, starter)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      saveGrindSession(question.id, lang, starter).catch(() => {})
    }
    setSyncState(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'offline')
  }, [starter, question.id, lang])

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
      <div className="flex items-center gap-2">
        {syncLabel}
        <span className="text-[10px] text-gray-600 hidden sm:inline">no submit - write from memory</span>
      </div>
      <button
        type="button"
        onClick={reset}
        className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs text-gray-300 bg-[#313244] hover:bg-[#45475a] transition-colors"
      >
        <RotateCcw size={11} /> Reset to starter
      </button>
    </div>
  )

  const interviewPanel = question.interviewApproach
    ? <GrindInterviewApproach script={question.interviewApproach} />
    : null

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
      ? { zIndex: 9999, top: 0, left: 0, right: 0, height: vvHeight, bottom: 'auto' as const }
      : { zIndex: 9999 }

  return (
    <>
      <div className={`grind-editor-card flex flex-col h-full min-h-0 bg-[#1e1e2e] rounded-xl border border-gray-700 shadow-sm overflow-hidden ${className}`}>
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
              className="md:hidden px-2 py-1 rounded-md text-xs font-mono bg-[#313244] text-indigo-300 border border-[#585b70]"
            >
              {editorExpanded ? 'Close' : 'Full'}
            </button>
          </div>
        </div>

        <div className={`grind-editor-body flex-1 min-h-0 flex flex-col ${editorExpanded ? 'invisible' : ''}`}>
          <div className="practice-cm-wrap relative flex-1 min-h-0">
            {editorBody('100%', false)}
          </div>
          {footerBar}
          {interviewPanel}
        </div>
      </div>

      {editorExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="practice-fs-portal grind-editor-card fixed inset-0 flex flex-col bg-[#1e1e2e]"
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
            <div className="grind-editor-body flex-1 min-h-0 flex flex-col">
              <div className="practice-cm-wrap relative flex-1 min-h-0">{editorBody('100%', true)}</div>
              {footerBar}
              {interviewPanel}
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
