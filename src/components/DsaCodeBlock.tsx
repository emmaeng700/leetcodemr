'use client'
import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import cppLang from 'highlight.js/lib/languages/cpp'
import pythonLang from 'highlight.js/lib/languages/python'
import javaLang from 'highlight.js/lib/languages/java'

hljs.registerLanguage('cpp', cppLang)
hljs.registerLanguage('python', pythonLang)
hljs.registerLanguage('java', javaLang)

function hljsLang(lang: string): string {
  const l = lang.toLowerCase()
  if (l === 'c++' || l === 'cpp') return 'cpp'
  if (l === 'python' || l === 'py') return 'python'
  if (l === 'java') return 'java'
  return 'cpp'
}

interface Props {
  code: string
  lang: string
}

export default function DsaCodeBlock({ code, lang }: Props) {
  const codeRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const resolved = hljsLang(lang)

  useEffect(() => {
    if (codeRef.current && code) {
      codeRef.current.removeAttribute('data-highlighted')
      codeRef.current.textContent = code
      hljs.highlightElement(codeRef.current)
    }
  }, [code, lang])

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <style>{`
        .dsa-hljs { background: transparent; color: #abb2bf; }
        .dsa-hljs .hljs-keyword  { color: #c678dd; }
        .dsa-hljs .hljs-built_in { color: #e6c07b; }
        .dsa-hljs .hljs-string   { color: #98c379; }
        .dsa-hljs .hljs-number   { color: #d19a66; }
        .dsa-hljs .hljs-comment  { color: #676e7d; font-style: italic; }
        .dsa-hljs .hljs-function .hljs-title,
        .dsa-hljs .hljs-title.function_ { color: #61afef; }
        .dsa-hljs .hljs-class .hljs-title,
        .dsa-hljs .hljs-title.class_    { color: #e5c07b; }
        .dsa-hljs .hljs-params    { color: #abb2bf; }
        .dsa-hljs .hljs-operator  { color: #56b6c2; }
        .dsa-hljs .hljs-type      { color: #e5c07b; }
        .dsa-hljs .hljs-literal   { color: #56b6c2; }
        .dsa-hljs .hljs-variable  { color: #e06c75; }
        .dsa-hljs .hljs-attr      { color: #e06c75; }
        .dsa-hljs .hljs-punctuation { color: #abb2bf; }
        .dsa-hljs .hljs-meta      { color: #e06c75; }
        .dsa-hljs .hljs-preprocessor { color: #e06c75; }
        .dsa-pre { font-size: 10px; }
        @media (min-width: 640px)  { .dsa-pre { font-size: 11px; } }
        @media (min-width: 1024px) { .dsa-pre { font-size: 12px; } }
      `}</style>
      <div className="relative group">
        <button
          onClick={copy}
          className="absolute top-2 right-2 z-10 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-200 transition-colors bg-gray-800 hover:bg-gray-700 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100"
        >
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <pre className="dsa-pre overflow-x-auto leading-relaxed m-0 p-4">
          <code ref={codeRef} className={`language-${resolved} dsa-hljs`}>
            {code}
          </code>
        </pre>
      </div>
    </>
  )
}
