import { useEffect, useState } from 'react'

export type MobileViewport = {
  /** Visible viewport height (shrinks when keyboard opens). null on desktop. */
  height: number | null
  /** Top offset when the layout viewport is shifted (iOS). */
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
        setVp({ height: null, offsetTop: 0, keyboardOpen: false })
        return
      }
      const keyboardOpen = vv.height < window.innerHeight * 0.72
      setVp({
        height: vv.height,
        offsetTop: vv.offsetTop,
        keyboardOpen,
      })
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
