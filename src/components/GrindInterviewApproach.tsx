'use client'

import { GraduationCap } from 'lucide-react'

function renderLine(line: string, i: number) {
  if (/^# PHASE \d+ [-—]/.test(line))
    return <span key={i} className="block text-violet-300 font-bold">{line}{'\n'}</span>
  if (/^# "(.*)"/.test(line) || /^#  /.test(line))
    return <span key={i} className="block text-amber-200">{line}{'\n'}</span>
  if (/^class /.test(line) || /^    def /.test(line))
    return <span key={i} className="block text-sky-400">{line}{'\n'}</span>
  if (/^#/.test(line))
    return <span key={i} className="block text-gray-400">{line}{'\n'}</span>
  return <span key={i} className="block text-[#abb2bf]">{line}{'\n'}</span>
}

/** STAR-LC interview script panel — always shown under the Grind editor footer when available. */
export default function GrindInterviewApproach({ script }: { script: string }) {
  return (
    <div className="border-t border-gray-700 bg-[#181825] shrink-0 flex flex-col max-h-[min(38vh,300px)] min-h-0">
      <div className="px-4 py-2 border-b border-gray-700/60 shrink-0">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400">
          <GraduationCap size={11} /> Interview Approach | STAR-LC
        </span>
      </div>
      <div className="overflow-y-auto flex-1 min-h-0 bg-[#282c34]">
        <pre className="p-3 text-[10.5px] leading-relaxed whitespace-pre-wrap break-words font-mono">
          {script.split('\n').map(renderLine)}
        </pre>
      </div>
    </div>
  )
}
