'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const CodeMirror = dynamic(() => import('@uiw/react-codemirror').then((m) => m.default), { ssr: false })

let extensionsPromise: Promise<Extension[]> | null = null

function loadLineGameExtensions(): Promise<Extension[]> {
  if (!extensionsPromise) {
    extensionsPromise = (async () => {
      const [{ python }, { oneDark }, cmView] = await Promise.all([
        import('@codemirror/lang-python'),
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
      return [python(), oneDark, slotTheme]
    })()
  }
  return extensionsPromise
}

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Python CodeMirror line slot: same highlighting + autocomplete stack as PracticeEditor (basicSetup).
 */
export default function LineGameCodeInput({ value, onChange, placeholder, className }: Props) {
  const [extensions, setExtensions] = useState<Extension[] | null>(null)

  useEffect(() => {
    let ok = true
    loadLineGameExtensions().then((ext) => {
      if (ok) setExtensions(ext)
    })
    return () => {
      ok = false
    }
  }, [])

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
