'use client'
import { Download, BookOpen, FileText } from 'lucide-react'

const FILES = [
  {
    title: 'Study-Order EPUB',
    description: '331 questions in priority study order: High Easy → High Medium → High Hard → Mid → Low. Interactive contents page with tap-to-jump links to every round and question. Syntax-highlighted Python solutions, problem images, and Quick Review summaries at the end of each chapter. Best read in Calibre (dark mode).',
    file: 'LeetMastery_Study_Order.epub',
    size: '4.1 MB',
    icon: BookOpen,
    accent: 'from-violet-500 to-purple-600',
    badge: 'EPUB',
    badgeColor: 'bg-violet-50 text-violet-700 border-violet-200',
    previewable: false,
  },
  {
    title: 'Study-Order PDF — 2×2 Landscape',
    description: '331 questions in the same 9-round priority order. Printed 4 mini-pages per sheet in landscape layout — bigger cells for easier reading. Includes problem descriptions, community Python solutions, and Quick Review summaries per round.',
    file: 'LeetMastery_Study_Order_2x2_Landscape.pdf',
    size: '8.2 MB',
    icon: FileText,
    accent: 'from-indigo-500 to-blue-600',
    badge: 'PDF · 2×2',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    previewable: true,
  },
]

export default function DownloadsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-[var(--text)] flex items-center gap-2 mb-1">
          <Download size={22} className="text-indigo-500" />
          Downloads
        </h1>
        <p className="text-sm text-[var(--text-subtle)]">
          Study materials — priority-ordered, 331 questions, 9 rounds.
        </p>
      </div>

      <div className="space-y-4">
        {FILES.map(({ title, description, file, size, icon: Icon, accent, badge, badgeColor, previewable }) => (
          <div
            key={file}
            className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
          >
            <div className={`h-1 bg-gradient-to-r ${accent}`} />

            <div className="p-5">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <div className={`bg-gradient-to-br ${accent} w-7 h-7 rounded-lg flex items-center justify-center shrink-0`}>
                      <Icon size={14} className="text-white" />
                    </div>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                      {badge}
                    </span>
                    <span className="text-xs text-[var(--text-subtle)] font-mono">{size}</span>
                  </div>
                  <h2 className="text-sm font-bold text-[var(--text)] mb-1">{title}</h2>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{description}</p>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                {previewable && (
                  <a
                    href={`/pdfs/${file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] active:scale-[0.98] transition-all"
                  >
                    Preview
                  </a>
                )}
                <a
                  href={`/api/download-pdf?file=${encodeURIComponent(file)}`}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accent} shadow-sm hover:opacity-90 active:scale-[0.98] transition-all ${previewable ? 'flex-1' : 'w-full'}`}
                >
                  <Download size={14} />
                  Download
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
