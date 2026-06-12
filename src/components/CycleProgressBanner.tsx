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
  onNextTodo?: () => void
  onOpenList?: () => void
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
  onNextTodo,
  onOpenList,
}: Props) {
  const pct = rangeSize > 0 ? Math.round((acceptedCount / rangeSize) * 100) : 0
  const remaining = Math.max(0, rangeSize - acceptedCount)
  const currentLap = currentCycleLap(cycleReps, repTarget)
  const allLapsDone = isCycleFullyComplete(cycleReps, repTarget)

  return (
    <div className="relative border-b border-indigo-200 bg-gradient-to-b from-indigo-50 to-indigo-50/40 px-4 py-4 sm:py-5 shrink-0">
      <button
        type="button"
        onClick={onCancel}
        className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-rose-200 text-rose-500 hover:bg-rose-50 transition-colors"
        title="End cycle"
      >
        <X size={16} />
      </button>

      <div className="mx-auto flex max-w-lg flex-col items-center text-center pr-10">
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

        {!allLapsDone && remaining > 0 && (
          <p className="mt-2 text-xs text-indigo-600/90 max-w-md">
            {remaining} left this lap. Use Next to skip a hard one, or open the list to jump back
            (check = accepted, circle = still todo).
          </p>
        )}

        {!allLapsDone && remaining > 0 && (onNextTodo || onOpenList) && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            {onNextTodo && (
              <button
                type="button"
                onClick={onNextTodo}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                Next todo
              </button>
            )}
            {onOpenList && (
              <button
                type="button"
                onClick={onOpenList}
                className="px-3 py-1.5 rounded-lg border border-indigo-300 bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition-colors"
              >
                Lap list
              </button>
            )}
          </div>
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
