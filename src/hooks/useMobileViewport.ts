import { useEffect, useState } from 'react'

export type MobileViewport = {
  /** Visible viewport height (shrinks when keyboard opens). null on desktop. */
  height: number | null
  /**
   * Top offset when the layout viewport is shifted (iOS).
   * Note: only refreshed when height/keyboardOpen change, to avoid re-rendering
   * consumers on every scroll frame. No current consumer reads it live.
   */
  offsetTop: number
  /** True when the software keyboard likely covers part of the screen. */
  keyboardOpen: boolean
}

const MOBILE_MQ = '(max-width: 767px)'

export function useMobileViewport(): MobileViewport {
  const [vp, setVp] = useState<MobileViewport>({
    height: null,
    offsetTop: 0,
    keyboardOpen: false,
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      if (!window.matchMedia(MOBILE_MQ).matches) {
        setVp(prev =>
          prev.height === null && !prev.keyboardOpen ? prev : { height: null, offsetTop: 0, keyboardOpen: false },
        )
        return
      }
      const height = Math.round(vv.height)
      const keyboardOpen = vv.height < window.innerHeight * 0.72
      // Bail out (keep the same object) when nothing consumers care about changed,
      // so visualViewport scroll events don't re-render the whole page.
      setVp(prev =>
        prev.height === height && prev.keyboardOpen === keyboardOpen
          ? prev
          : { height, offsetTop: Math.round(vv.offsetTop), keyboardOpen },
      )
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

  return vp
}
