'use client'
import { useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Suspense } from 'react'

const ALLOWED_FILES = new Set([
  'LeetMastery_By_Pattern_Python_Only_6up_Landscape.pdf',
  'LeetMastery_By_Pattern_Python_Only_Print_6up_Landscape.pdf',
  'LeetMastery_DSA_SystemDesign_Behavioral_Print_6up_Landscape.pdf',
])

function PreviewContent() {
  const params = useSearchParams()
  const router = useRouter()
  const file = params.get('file') ?? ''

  if (!ALLOWED_FILES.has(file)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-[var(--text-muted)]">
        <p className="text-sm">Invalid file.</p>
        <button onClick={() => router.push('/downloads')} className="text-sm text-indigo-500 underline">
          Back to Downloads
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Header bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 h-12 border-b border-[var(--border)] bg-[var(--bg-card)]">
        <button
          onClick={() => router.push('/downloads')}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <span className="text-xs text-[var(--text-subtle)] truncate">{file}</span>
      </div>

      {/* PDF iframe */}
      <iframe
        src={`/pdfs/${file}`}
        className="flex-1 w-full"
        title={file}
      />
    </>
  )
}

export default function PreviewPage() {
  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 3.5rem)' }}>
      <Suspense>
        <PreviewContent />
      </Suspense>
    </div>
  )
}
