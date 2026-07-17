'use client'

import { memo, useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { RotateCcw, Wifi, WifiOff, Cloud, CloudOff } from 'lucide-react'
import { useMobileViewport } from '@/hooks/useMobileViewport'
import { saveGrindSession } from '@/lib/db'
import {
  writeGrindDraft,
} from '@/lib/grindStorage'
import { readGrindResetCount, incrementGrindResetCount, GRIND_RESET_CHANGED } from '@/lib/grindResets'
import {
  applyGrindStampOnEdit,
  getGrindSessionChipLabel,
} from '@/lib/grindStamp'
import {
  ensureGrindStarterCached,
  resolveGrindStarterSync,
} from '@/lib/grindStarter'
import { scheduleMidnightGrindRefresh } from '@/lib/grindPipeline'
import { runGrindRecheckPipeline } from '@/lib/grindRecheck'
import { resolveGrindCodeForLoad } from '@/lib/grindSync'
import {
  readGrindLcAcceptedCache,
  resolveGrindLcAcceptedCode,
  applyAcceptedResolveToCode,
  upsertAcceptedSection,
} from '@/lib/grindLcAccepted'
import type { GrindQuestion } from '@/lib/grindQuestions'
import { formatDescriptionPlain } from '@/lib/formatDescription'
import { loadQuestionsDataAllRows } from '@/lib/grindQuestions'
import { stripScripts } from '@/lib/utils'
import { useGrindLang } from '@/components/grind/GrindLangContext'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then(m => m.default), { ssr: false })

interface GrindEditorProps {
  question: GrindQuestion
  className?: string
  onReset?: (id: number) => void
}

function GrindEditor({ question, className = '', onReset }: GrindEditorProps) {
  const { height: vvHeight, keyboardOpen } = useMobileViewport()
  const { lang, setLang } = useGrindLang()
  // Re-render trigger for programmatic doc replacements; the text itself lives
  // in codeRef so keystrokes don't round-trip through React state.
  const [, setEditorEpoch] = useState(0)
  const [starter, setStarter] = useState('')
  const [loading, setLoading] = useState(true)
  const [savedFlash, setSavedFlash] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sessionLabel, setSessionLabel] = useState<string | null>(null)
  const [syncState, setSyncState] = useState<'local' | 'synced' | 'offline'>('local')
  const [resetCount, setResetCount] = useState(() => readGrindResetCount(question.id))
  const [editorExpanded, setEditorExpanded] = useState(false)
  const [portalDescCollapsed, setPortalDescCollapsed] = useState(false)
  const [extensions, setExtensions] = useState<any[]>([])
  const [editorTheme, setEditorTheme] = useState<any>(null)
  const [description, setDescription] = useState<string>('')
  const [descriptionHtml, setDescriptionHtml] = useState<string>('')
  // The inline editor is display:none on mobile; don't mount a second CodeMirror there.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  )
  const descCacheRef = useRef<Record<number, { plain: string; html: string }>>({})
  const editorViewRef = useRef<unknown>(null)
  const portalViewRef = useRef<unknown>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadGenRef = useRef(0)
  const codeRef = useRef('')

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  /**
   * Programmatically replace the editor contents. Keystrokes bypass the `code`
   * state (see handleChange), so the `value` prop can be stale — write into the
   * live CodeMirror views directly to guarantee the doc updates.
   */
  const setEditorDoc = useCallback((next: string) => {
    codeRef.current = next
    // Trigger a re-render so a CodeMirror that hasn't mounted yet (dynamic
    // import still resolving) picks up the fresh codeRef as its initial value.
    setEditorEpoch(e => e + 1)
    for (const ref of [editorViewRef, portalViewRef]) {
      const view = ref.current as { state?: { doc: { toString(): string; length: number } }; dispatch?: (spec: unknown) => void; dom?: HTMLElement } | null
      if (!view?.state || !view.dispatch) continue
      if (view.dom && !view.dom.isConnected) continue
      const cur = view.state.doc.toString()
      if (cur !== next) {
        view.dispatch({ changes: { from: 0, to: cur.length, insert: next } })
      }
    }
  }, [])

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

      let nextCode = loaded.code
      try {
        const accepted = await resolveGrindLcAcceptedCode(question.id, question.slug, lang)
        if (cancelled || gen !== loadGenRef.current) return
        nextCode = applyAcceptedResolveToCode(nextCode, lang, accepted)
        if (nextCode !== loaded.code) {
          writeGrindDraft(question.id, lang, nextCode)
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            saveGrindSession(question.id, lang, nextCode).catch(() => {})
          }
        }
      } catch { /* keep loaded code */ }

      setEditorDoc(nextCode)
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
  }, [question.id, question.slug, question.title, question.set, lang, question.starterPython, question.starterCpp, question.interviewApproach, setEditorDoc])
  
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
        setEditorDoc(piped.code)
      }
      setSessionLabel(piped.sessionLabel)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSyncState('offline')
      } else {
        setSyncState(piped.synced ? 'synced' : 'local')
      }
    },
    [setEditorDoc],
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
    let nextCode = piped.code
    try {
      const accepted = await resolveGrindLcAcceptedCode(question.id, question.slug, lang)
      nextCode = applyAcceptedResolveToCode(nextCode, lang, accepted)
      if (nextCode !== piped.code) {
        writeGrindDraft(question.id, lang, nextCode)
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          saveGrindSession(question.id, lang, nextCode).catch(() => {})
        }
      }
    } catch { /* keep pipeline code */ }
    applyRecheckResult({ ...piped, code: nextCode })
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
      codeRef.current = next
      // Keep keystrokes out of React state: only write back to the editor when
      // the stamp actually rewrote the text. Otherwise the whole tree
      // re-renders (and re-syncs two CodeMirror docs) on every key press.
      if (next !== val) setEditorDoc(next)
      const label = getGrindSessionChipLabel(question.id, lang, next)
      setSessionLabel(prev => (prev === label ? prev : label))
      writeGrindDraft(question.id, lang, next)
      setSavedFlash(true)
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
      flashTimerRef.current = setTimeout(() => setSavedFlash(false), 1200)

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setSyncState('offline')
          return
        }
        saveGrindSession(question.id, lang, next)
          .then(() => setSyncState(prev => (prev === 'synced' ? prev : 'synced')))
          .catch(() => setSyncState(prev => (prev === 'local' ? prev : 'local')))
      }, 2000)
    },
    [question.id, lang, setEditorDoc],
  )

  const reset = useCallback(() => {
    const cached = readGrindLcAcceptedCache(question.id, lang)
    const next = cached && !cached.empty
      ? upsertAcceptedSection(starter, lang, cached.code, 'ready')
      : cached?.empty
        ? upsertAcceptedSection(starter, lang, null, 'empty')
        : upsertAcceptedSection(starter, lang, null, 'uncached')
    setEditorDoc(next)
    setSessionLabel(getGrindSessionChipLabel(question.id, lang, next))
    writeGrindDraft(question.id, lang, next)
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      saveGrindSession(question.id, lang, next).catch(() => {})
    }
    setSyncState(typeof navigator !== 'undefined' && navigator.onLine ? 'synced' : 'offline')
    const count = incrementGrindResetCount(question.id)
    setResetCount(count)
    onReset?.(question.id)
  }, [starter, question.id, lang, onReset, setEditorDoc])

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
    <div className="grind-langs">
      {(['python3', 'cpp'] as const).map(l => (
        <button
          key={l}
          type="button"
          onPointerDown={e => e.preventDefault()}
          onClick={() => setLang(l)}
          className={l === 'python3' ? (lang === 'python3' ? 'on-py' : '') : (lang === 'cpp' ? 'on-cpp' : '')}
        >
          {l === 'python3' ? 'Py' : 'C++'}
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
    <div className="grind-editor-footer">
      <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
        {syncLabel}
        {sessionLabel && (
          <span
            className="text-[0.58rem] text-[#bac2de] bg-[#313244] border border-[#585b70] rounded-full px-2 py-0.5 truncate max-w-[11rem]"
            title={`Last grind: ${sessionLabel}`}
          >
            Last grind: {sessionLabel}
          </span>
        )}
        <span className="grind-editor-hint hidden md:inline">no submit - write from memory</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button" onClick={() => void copyCode()} className="grind-chip">
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button type="button" onClick={reset} className="grind-chip flex items-center gap-1">
          <span>Reset to starter</span>
          {resetCount > 0 && (
            <span className="grind-reset-count">↺{resetCount}</span>
          )}
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
          // codeRef holds the live text (keystrokes bypass the `code` state),
          // so a freshly (re)mounted editor — e.g. reopening the mobile portal —
          // always starts from what the user last typed.
          value={codeRef.current}
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

  // Always anchor to top:0 — using vvOffsetTop causes iOS to "pan" the portal
  // when the keyboard scrolls the layout viewport to reveal the editor.
  const mobilePortalStyle =
    vvHeight != null
      ? {
          zIndex: 9999,
          top: 0,
          left: 0,
          right: 0,
          height: vvHeight,
          maxHeight: vvHeight,
          bottom: 'auto' as const,
        }
      : { zIndex: 9999 }

  useEffect(() => {
    if (!keyboardOpen || !editorExpanded || typeof window === 'undefined') return
    // Prevent iOS from scrolling the page when it focuses the CM editor inside a fixed portal.
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [keyboardOpen, editorExpanded])

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

  useEffect(() => {
    const refresh = () => setResetCount(readGrindResetCount(question.id))
    refresh()
    window.addEventListener(GRIND_RESET_CHANGED, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(GRIND_RESET_CHANGED, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [question.id])

  useEffect(() => {
    if (!editorExpanded) {
      setPortalDescCollapsed(false)
      return
    }
    // On mobile, pre-collapse the description when the portal opens so there's
    // no layout shift when the keyboard appears (the editor takes full height immediately).
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    setPortalDescCollapsed(isMobile)
  }, [editorExpanded])

  useEffect(() => {
    // When switching questions, reset collapse state (mobile stays pre-collapsed once portal is open)
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) setPortalDescCollapsed(false)
  }, [question.id])

  const descriptionContent = descriptionHtml ? (
    <div
      className="grind-desc lc-description text-xs leading-relaxed"
      dangerouslySetInnerHTML={{ __html: stripScripts(descriptionHtml) }}
    />
  ) : description ? (
    <pre className="whitespace-pre-wrap text-xs leading-5 text-gray-200 font-sans">{description}</pre>
  ) : (
    <div className="text-xs text-gray-500">Description not cached yet.</div>
  )

  const descriptionPanel = (opts?: { portal?: boolean }) => {
    const portal = opts?.portal ?? false
    const hideDescBody = portal && (portalDescCollapsed || keyboardOpen)
    return (
      <div
        className={portal ? 'fs-desc-pane border-b border-[#313244] bg-[#11111b] shrink-0 flex flex-col min-h-0' : 'grind-desc-card'}
        role="region"
        aria-label="Problem description"
      >
        <div className={portal ? 'fs-desc-head flex items-center justify-between gap-2 px-3 py-2 bg-[#181825] border-b border-[#313244] text-[0.62rem] font-bold text-[#cdd6f4]' : 'grind-desc-head'}>
          <span>Problem Description</span>
          {portal && (
            <button
              type="button"
              onClick={() => setPortalDescCollapsed(v => !v)}
              disabled={keyboardOpen}
              className="grind-chip text-[0.55rem] py-0.5 px-2 disabled:opacity-40"
            >
              {hideDescBody ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
        {!hideDescBody && (
          <div className={portal ? 'fs-desc-body px-3 py-2 overflow-y-auto overscroll-contain min-h-0 max-h-[36vh] min-h-[6.5rem] text-[0.68rem] leading-relaxed text-[#cdd6f4]' : 'grind-desc-body grind-desc lc-description'}>
            {descriptionContent}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={`flex flex-col h-full min-h-0 ${className}`}>
        <div className="grind-editor-meta">
          <span className="truncate flex-1">
            #{question.id} - {question.title} (Set {question.set})
          </span>
          {typeof navigator !== 'undefined' && !navigator.onLine && (
            <WifiOff size={12} className="text-[#fab387] shrink-0" />
          )}
          <button
            type="button"
            className="grind-chip grind-mob-only"
            onPointerDown={e => e.preventDefault()}
            onClick={() => setEditorExpanded(true)}
          >
            Full
          </button>
        </div>

        <div className="grind-editor-stack">
          {!editorExpanded && descriptionPanel()}

          {!editorExpanded && (
            <div className="grind-mobile-cta">
              <p className="grind-mobile-cta-text">
                Read the problem above, then write your solution from memory.
              </p>
              <button type="button" className="grind-chip" onClick={() => setEditorExpanded(true)}>
                Write code
              </button>
            </div>
          )}

          {!isMobile && (
            <div className={`grind-editor-inline practice-cm-wrap relative flex-1 min-h-0 ${editorExpanded ? 'invisible' : ''}`}>
              {editorBody('100%', false)}
            </div>
          )}
        </div>

        {!editorExpanded && footerBar}
      </div>

      {editorExpanded &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`practice-fs-portal fixed inset-0 flex flex-col bg-[#1e1e2e] grind-shell${keyboardOpen ? ' kbd-open' : ''}`}
            style={mobilePortalStyle}
          >
            <div className="fs-bar flex items-center gap-2 px-3 py-2 bg-[#181825] border-b border-[#313244] shrink-0">
              <span className="flex-1 text-[0.65rem] text-[#a6adc8] truncate">
                #{question.id} - {question.title}
              </span>
              {keyboardOpen && (
                <button
                  type="button"
                  onClick={reset}
                  className="grind-chip text-[0.58rem] py-0.5 px-2 flex items-center gap-1 shrink-0"
                >
                  Reset
                  {resetCount > 0 && <span className="grind-reset-count">↺{resetCount}</span>}
                </button>
              )}
              {!keyboardOpen && resetCount > 0 && (
                <span className="grind-reset-count shrink-0">↺{resetCount}</span>
              )}
              {langToggle}
              <button type="button" onClick={() => setEditorExpanded(false)} className="grind-chip">
                Close
              </button>
            </div>
            {descriptionPanel({ portal: true })}
            <div className="relative flex-1 min-h-0 fs-editor practice-cm-wrap">{editorBody('100%', true)}</div>
            {!keyboardOpen && footerBar}
          </div>,
          document.body,
        )}
    </>
  )
}

// Memoized so parent page re-renders (cache-progress banner, viewport ticks)
// don't cascade into the CodeMirror tree.
export default memo(GrindEditor)
