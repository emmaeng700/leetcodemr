'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { extractPythonWordsForCompletion } from '@/lib/line-game/extractPythonWords'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then((m) => m.default), { ssr: false })

/** Match @codemirror/lang-python globalCompletion guard — skip strings/comments/property names. */
const PYTHON_COMPLETION_SKIP_NODES = ['String', 'FormatString', 'Comment', 'PropertyName'] as const

let themeExtensionsPromise: Promise<Extension[]> | null = null

function loadThemeExtensions(): Promise<Extension[]> {
  if (!themeExtensionsPromise) {
    themeExtensionsPromise = (async () => {
      const [{ oneDark }, cmView] = await Promise.all([
        import('@codemirror/theme-one-dark'),
        import('@codemirror/view'),
      ])
      const slotTheme = cmView.EditorView.theme({
        '&': {
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
        },
        '&.cm-focused': { outline: 'none' },
        '.cm-scroller': {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          backgroundColor: 'transparent !important',
          minHeight: '2rem',
          maxHeight: '14rem',
          lineHeight: '1.55',
          fontSize: 'clamp(11px, 1.8vw, 13px)',
        },
        '.cm-content': {
          paddingTop: '6px',
          paddingBottom: '6px',
          caretColor: '#abb2bf',
        },
        '.cm-placeholder': { color: '#5c6370' },
        '.cm-gutters': { display: 'none !important' },
        '.cm-activeLineGutter': { display: 'none !important' },
        '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.05)' },
      })
      return [oneDark, slotTheme]
    })()
  }
  return themeExtensionsPromise
}

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  /** Full solution source — identifiers here get completion (same as visible hljs lines). */
  completionContext?: string
}

/**
 * Python CodeMirror line slot: highlighting + autocomplete, including words from the rest of the solution.
 */
export default function LineGameCodeInput({
  value,
  onChange,
  placeholder,
  className,
  completionContext = '',
}: Props) {
  const [extensions, setExtensions] = useState<Extension[] | null>(null)

  const wordsKey = useMemo(() => {
    const words = extractPythonWordsForCompletion(completionContext)
    return words.join('\0')
  }, [completionContext])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [{ python, pythonLanguage }, { completeFromList, ifNotIn }, themeExts] = await Promise.all([
        import('@codemirror/lang-python'),
        import('@codemirror/autocomplete'),
        loadThemeExtensions(),
      ])
      const words = extractPythonWordsForCompletion(completionContext)
      const options = words.map((label) => ({
        label,
        type: 'variable' as const,
        section: 'This solution',
        boost: 4,
      }))
      const solutionSource =
        options.length > 0
          ? ifNotIn([...PYTHON_COMPLETION_SKIP_NODES], completeFromList(options))
          : null

      const ext: Extension[] = [
        python(),
        ...(solutionSource
          ? [pythonLanguage.data.of({ autocomplete: solutionSource })]
          : []),
        ...themeExts,
      ]
      if (!cancelled) setExtensions(ext)
    })()
    return () => {
      cancelled = true
    }
  }, [wordsKey])

  if (!extensions) {
    return (
      <div
        className={`min-h-8 animate-pulse rounded-r-sm bg-[#282c34]/90 ${className ?? ''}`}
        aria-hidden
      />
    )
  }

  return (
    <CodeMirror
      value={value}
      onUpdate={(vu) => {
        if (vu.docChanged) onChange(vu.state.doc.toString())
      }}
      extensions={extensions}
      theme="none"
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        tabSize: 4,
        searchKeymap: false,
        lintKeymap: false,
      }}
      placeholder={placeholder}
      indentWithTab
      className={`text-left ${className ?? ''}`}
      minHeight="2rem"
      maxHeight="14rem"
    />
  )
}
