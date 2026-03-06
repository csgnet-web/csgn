import { useState, useEffect } from 'react'

interface RotatingTextProps {
  texts: string[]
  interval?: number
  className?: string
}

/**
 * 3D rotating text prism — only the front face is visible.
 * Rotates every `interval` ms (default 7000).
 */
export function RotatingText({ texts, interval = 7000, className = '' }: RotatingTextProps) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % texts.length)
    }, interval)
    return () => clearInterval(id)
  }, [texts.length, interval])

  return (
    <span
      className={`rotating-text-container ${className}`}
      style={{ display: 'inline-block', position: 'relative', overflow: 'hidden' }}
    >
      {/* invisible sizer — keeps the container wide enough for the longest text */}
      <span className="invisible" aria-hidden="true">
        {texts.reduce((a, b) => (a.length >= b.length ? a : b), '')}
      </span>

      <span
        className="rotating-text-track"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.8s cubic-bezier(0.65, 0, 0.35, 1)',
          transform: `rotateX(${-index * 90}deg)`,
        }}
      >
        {texts.map((text, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: `rotateX(${i * 90}deg) translateZ(0.6em)`,
            }}
          >
            {text}
          </span>
        ))}
      </span>
    </span>
  )
}
