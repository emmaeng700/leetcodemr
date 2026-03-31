'use client'
import { useState, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import pythonLang from 'highlight.js/lib/languages/python'
import cppLang from 'highlight.js/lib/languages/cpp'
import { CODE_HIGHLIGHT_TOKEN_CSS } from '@/lib/codeHighlightTheme'

hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('cpp', cppLang)

interface CodePanelProps {
  pythonCode?: string
  cppCode?: string
}

export default function CodePanel({ pythonCode = '', cppCode = '' }: CodePanelProps) {
  const [lang, setLang] = useState<'python' | 'cpp'>('python')
  const [copied, setCopied] = useState(false)
  const codeRef = useRef<HTMLElement>(null)

  const code = lang === 'python' ? pythonCode : cppCode

  useEffect(() => {
    if (codeRef.current && code) {
      codeRef.current.removeAttribute('data-highlighted')
      codeRef.current.textContent = code
      hljs.highlightElement(codeRef.current)
    }
  }, [code, lang])

  const copy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        .hljs { background: #282c34; color: #abb2bf; }
        ${CODE_HIGHLIGHT_TOKEN_CSS}
        .code-block { counter-reset: line; }
        .code-block code { display: block; }
      `}</style>
      <div className="rounded-xl overflow-hidden border border-gray-700 bg-[#282c34]">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-[#21252b] border-b border-gray-700">
          <div className="flex gap-1">
            {(['python', 'cpp'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  lang === l ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {l === 'python' ? 'Python' : 'C++'}
              </button>
            ))}
          </div>
          <button
            onClick={copy}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {code ? (
          <div className="overflow-x-auto code-block">
            <pre className="p-4 text-[11px] sm:text-[12px] md:text-[13px] leading-relaxed m-0">
              <code ref={codeRef} className={`language-${lang}`}>
                {code}
              </code>
            </pre>
          </div>
        ) : (
          <div className="text-gray-500 text-sm text-center py-12">
            No {lang === 'python' ? 'Python' : 'C++'} solution available.
          </div>
        )}
      </div>
    </>
  )
}
