import { useEffect, useState } from 'react'
import IntermissionBoard from './IntermissionBoard'

export interface VodItem {
  url: string
  title?: string
}

const BOARD_BREAK_MS = 60_000

/**
 * Intermission programming: rotates admin-configured promo/VOD MP4s with the
 * animated network board between items. Empty playlist → board only.
 * A bad/unreachable video advances automatically so the network never stalls.
 */
export default function VodRotator({ items }: { items: VodItem[] }) {
  const [index, setIndex] = useState(0)
  const [onBoard, setOnBoard] = useState(true)

  // Board break between items (and before the first)
  useEffect(() => {
    if (!onBoard || items.length === 0) return
    const t = setTimeout(() => setOnBoard(false), BOARD_BREAK_MS)
    return () => clearTimeout(t)
  }, [onBoard, items.length])

  const advance = () => {
    setIndex((i) => (i + 1) % Math.max(items.length, 1))
    setOnBoard(true)
  }

  if (items.length === 0 || onBoard) return <IntermissionBoard />

  const current = items[index % items.length]
  return (
    <div className="absolute inset-0 bg-black">
      <video
        key={current.url}
        src={current.url}
        autoPlay
        playsInline
        onEnded={advance}
        onError={advance}
        className="absolute inset-0 w-full h-full object-contain"
      />
      {current.title && (
        <div className="absolute bottom-10 left-12 px-4 py-2 rounded-lg bg-black/60 border border-white/[0.1]">
          <p className="text-sm font-bold tracking-[0.2em] uppercase text-gray-300">{current.title}</p>
        </div>
      )}
    </div>
  )
}
