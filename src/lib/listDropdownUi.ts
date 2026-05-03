/**
 * Shared List (question picker) dropdown layout — mobile: viewport-centered sheet
 * below navbar; sm+: anchored under the trigger (left or right).
 */

export const listDropdownMobileBackdrop =
  'fixed inset-0 top-14 z-[99] bg-black/25 sm:hidden'

/** Mobile-only tree (e.g. section already hidden on md+) — no sm:hidden on backdrop. */
export const listDropdownMobileBackdropDense = 'fixed inset-0 top-14 z-[99] bg-black/25'

export function listDropdownMobilePanelClasses(smAlign: 'left' | 'right') {
  const sm =
    smAlign === 'left' ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'
  return [
    'fixed left-1/2 top-[calc(56px+3.25rem)] z-[120] isolate opacity-100',
    'max-h-[min(70vh,22rem)] w-[min(calc(100vw-2rem),20rem)] -translate-x-1/2',
    'overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5',
    'sm:absolute sm:top-full sm:mt-1 sm:max-h-[min(70vh,20rem)] sm:translate-x-0',
    'sm:w-[min(calc(100vw-2rem),20rem)]',
    sm,
  ].join(' ')
}

/** Panel when the parent is mobile-only (no sm: anchor variant). */
export const listDropdownMobilePanelViewportOnly =
  'fixed left-1/2 top-[calc(56px+3.25rem)] z-[120] isolate opacity-100 max-h-[min(70vh,22rem)] w-[min(calc(100vw-2rem),20rem)] -translate-x-1/2 overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white shadow-2xl ring-1 ring-black/5'
