import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useScrollLock } from '@/hooks/useScrollLock'

/**
 * The one modal shell for the whole site.
 *
 * Solves the "popup moves around" problem properly:
 *  - **Body scroll-lock while open.** The page behind can't scroll, which is what
 *    made modals appear to drift on mobile (and what caused iOS rubber-banding to
 *    drag the dialog with it). The scrollbar's width is replaced with padding so
 *    desktop layout doesn't shift when the lock engages.
 *  - **Rendered in a portal** on `position: fixed` — never inside a transformed or
 *    scrolled ancestor, which is the other classic source of jumping.
 *  - **Its own internal scroll.** Tall content scrolls *inside* the dialog
 *    (`max-h`/`overflow-y-auto`), so the dialog itself never moves.
 *  - **No scale/slide animation.** A fade only: scale animations read as "movement"
 *    and fight the mobile keyboard when an input focuses.
 *  - **Dynamic viewport units** (`100dvh`) so the mobile browser chrome
 *    appearing/disappearing doesn't resize the dialog mid-interaction.
 *
 * Escape and backdrop click close it; the dialog itself never closes on click.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  maxWidth?: string
}) {
  useScrollLock(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-[fadeIn_120ms_ease-out]"
      style={{ height: '100dvh' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${maxWidth} bg-[#0c0c1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col`}
        style={{ maxHeight: 'calc(100dvh - 2rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="p-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <h3 className="font-bold text-white">{title}</h3>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {/* Tall content scrolls in here — the dialog itself stays put. */}
        <div className="overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
