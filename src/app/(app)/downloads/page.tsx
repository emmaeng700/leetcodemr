'use client'
import { Download, FileText, Printer, BookOpen, Eye } from 'lucide-react'

const PDFS = [
  {
    title: 'By Pattern — Colored (Python Only)',
    description: 'All 331 questions grouped by pattern, fewest to most. Colored syntax-highlighted Python solutions from 4 community sites. 6-up landscape — fits 6 mini-pages per printed sheet.',
    file: 'LeetMastery_By_Pattern_Python_Only_6up_Landscape.pdf',
    size: '7.2 MB',
    icon: BookOpen,
    accent: 'from-indigo-500 to-violet-500',
    badge: 'Colored',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  {
    title: 'By Pattern — Print Edition (Python Only)',
    description: 'Same content as above — all 331 questions, Python only, pattern-ordered. Clean black-and-white layout optimised for home printing. 6-up landscape.',
    file: 'LeetMastery_By_Pattern_Python_Only_Print_6up_Landscape.pdf',
    size: '7.7 MB',
    icon: Printer,
    accent: 'from-gray-600 to-gray-800',
    badge: 'Print / B&W',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  {
    title: 'DSA + System Design + Behavioral',
    description: 'Combined reference pack: DSA templates and patterns, System Design Q&A, and Behavioral STAR stories — all in one compact 6-up landscape PDF for quick review.',
    file: 'LeetMastery_DSA_SystemDesign_Behavioral_Print_6up_Landscape.pdf',
    size: '721 KB',
    icon: FileText,
    accent: 'from-emerald-500 to-teal-500',
    badge: 'Combined',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
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
          Study PDFs — 6-up landscape, print-ready.
        </p>
      </div>

      <div className="space-y-4">
        {PDFS.map(({ title, description, file, size, icon: Icon, accent, badge, badgeColor }) => (
          <div
            key={file}
            className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border)] shadow-sm overflow-hidden"
          >
            {/* Accent bar */}
            <div className={`h-1 bg-gradient-to-r ${accent}`} />

            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
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
                <a
                  href={`/pdfs/${file}`}
                  className="flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] active:scale-[0.98] transition-all"
                >
                  <Eye size={14} />
                  Preview
                </a>
                <a
                  href={`/api/download-pdf?file=${encodeURIComponent(file)}`}
                  className={`flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accent} shadow-sm hover:opacity-90 active:scale-[0.98] transition-all`}
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
