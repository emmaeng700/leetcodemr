import { useEffect, useState } from 'react'

/** Visible viewport height on mobile (shrinks when the software keyboard opens). */
export function useVisualViewportHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      if (window.matchMedia('(max-width: 767px)').matches) {
        setHeight(vv.height)
      } else {
        setHeight(null)
      }
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return height
}
