'use client'
import { Play, X } from 'lucide-react'
import { cycleLapMotivation, currentCycleLap, isCycleFullyComplete } from '@/lib/cycleLapMessages'

interface Props {
  acceptedCount: number
  rangeSize: number
  cycleReps: number
  repTarget: number
  onCancel: () => void
  needsResume?: boolean
  onResume?: () => void
  resumeQuestionNum?: number
}

export default function CycleProgressBanner({
  acceptedCount,
  rangeSize,
  cycleReps,
  repTarget,
  onCancel,
  needsResume,
  onResume,
  resumeQuestionNum,
}: Props) {
  const pct = rangeSize > 0 ? Math.round((acceptedCount / rangeSize) * 100) : 0
  const currentLap = currentCycleLap(cycleReps, repTarget)
  const allLapsDone = isCycleFullyComplete(cycleReps, repTarget)

  return (
    <div className="relative border-b border-indigo-200 bg-gradient-to-b from-indigo-50 to-indigo-50/40 px-4 py-4 sm:py-5 shrink-0">
      <button
        type="button"
        onClick={onCancel}
        className="absolute right-3 top-3 p-1.5 rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
        title="End cycle"
      >
        <X size={14} />
      </button>

      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
          <span className="text-3xl sm:text-4xl font-black tabular-nums text-indigo-700">
            {acceptedCount}/{rangeSize}
          </span>
          <span className="text-base sm:text-lg font-semibold text-indigo-500">accepted</span>
        </div>

        <p className="mt-1 text-sm sm:text-base font-bold text-indigo-600 tabular-nums">
          {allLapsDone
            ? `Lap ${repTarget}/${repTarget} complete`
            : `Lap ${currentLap}/${repTarget}`}
        </p>

        {!allLapsDone && (
          <p className="mt-2 max-w-md text-sm sm:text-base font-medium text-indigo-800/90 leading-snug">
            {cycleLapMotivation(cycleReps)}
          </p>
        )}

        <div className="mt-3 w-full max-w-md h-3 sm:h-3.5 bg-indigo-200/80 rounded-full overflow-hidden border border-indigo-300/80">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, minWidth: acceptedCount > 0 ? '8px' : '0' }}
          />
        </div>

        {needsResume && onResume && resumeQuestionNum != null && (
          <button
            type="button"
            onClick={onResume}
            className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-colors"
          >
            <Play size={14} /> Resume question #{resumeQuestionNum}
          </button>
        )}
      </div>
    </div>
  )
}
