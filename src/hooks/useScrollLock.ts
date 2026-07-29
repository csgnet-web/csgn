import { useEffect } from 'react'

/**
 * Lock the page behind an overlay while it's open, compensating for the
 * scrollbar so the layout underneath doesn't jump sideways when the lock
 * engages. This is what stops modals from appearing to drift/move on mobile:
 * without it the page behind scrolls (and iOS rubber-banding drags the dialog
 * with it) whenever the user swipes over the overlay.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const { body } = document
    const prevOverflow = body.style.overflow
    const prevPadding = body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    return () => {
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPadding
    }
  }, [active])
}
