import { useMobileViewport } from '@/hooks/useMobileViewport'

/** @deprecated Use useMobileViewport for keyboard-aware layout. */
export function useVisualViewportHeight(): number | null {
  return useMobileViewport().height
}
