'use client'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism'

interface CodePanelProps {
  pythonCode?: string
  cppCode?: string
}

export default function CodePanel({ pythonCode = '', cppCode = '' }: CodePanelProps) {
  const [lang, setLang] = useState<'python' | 'cpp'>('python')
  const [copied, setCopied] = useState(false)

  const code = lang === 'python' ? pythonCode : cppCode

  const copy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
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
        <div className="text-[11px] sm:text-[12px] md:text-[13px] overflow-x-auto">
          <SyntaxHighlighter
            language={lang === 'python' ? 'python' : 'cpp'}
            style={oneDark}
            showLineNumbers
            wrapLines
            customStyle={{ margin: 0, borderRadius: 0, background: '#282c34' }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      ) : (
        <div className="text-gray-500 text-sm text-center py-12">
          No {lang === 'python' ? 'Python' : 'C++'} solution available.
        </div>
      )}
    </div>
  )
}
