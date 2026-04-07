'use client'

import { useEffect, type RefObject } from 'react'

/** Close when user taps/clicks outside `ref` (e.g. dropdown wrapper). */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClose: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    function onDown(e: MouseEvent | TouchEvent) {
      const el = ref.current
      if (!el) return
      const target = e.target as Node
      if (el.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [ref, onClose, enabled])
}
