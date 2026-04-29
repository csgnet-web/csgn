import { useEffect, useState } from 'react'
import { bootLines } from '@/data/dummy'

interface BootSequenceProps {
  onComplete: () => void
}

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (step < bootLines.length) {
      const t = setTimeout(() => setStep(s => s + 1), 620)
      return () => clearTimeout(t)
    }
    const fadeT = setTimeout(() => setFading(true), 500)
    const doneT = setTimeout(() => onComplete(), 1100)
    return () => {
      clearTimeout(fadeT)
      clearTimeout(doneT)
    }
  }, [step, onComplete])

  return (
    <div
      className={`fixed inset-0 z-[80] csgn-stadium-bg flex flex-col items-center justify-center px-6 ${fading ? 'boot-fade-out' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="stadium-sweep" />
      </div>

      <div className="relative w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 metal-panel-hot flex items-center justify-center font-display font-black text-primary-400">
            C
          </div>
          <div>
            <div className="font-display font-black text-2xl tracking-[0.18em] text-white">
              CSGN <span className="text-primary-500">NETWORK</span>
            </div>
            <div className="font-mono text-[10px] tracking-[0.4em] text-white/40 uppercase">
              Crypto Sports & Gaming · Broadcast OS v6.06
            </div>
          </div>
        </div>

        <div className="metal-panel rounded-sm p-6 font-mono text-sm space-y-3 broadcast-border">
          {bootLines.slice(0, step).map((line, i) => (
            <div
              key={i}
              className="boot-line flex items-center justify-between gap-4 text-white/85"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-center gap-3">
                <span className="text-primary-500">▸</span>
                <span className="tracking-[0.16em] uppercase">{line}</span>
              </div>
              <span className="text-[color:var(--color-live)] tracking-widest text-xs">[ OK ]</span>
            </div>
          ))}
          {step < bootLines.length && (
            <div className="flex items-center gap-3 text-white/85">
              <span className="text-primary-500">▸</span>
              <span className="tracking-[0.16em] uppercase">{bootLines[step]}</span>
              <span className="boot-cursor text-primary-500">█</span>
            </div>
          )}
          {step >= bootLines.length && (
            <div className="pt-3 border-t border-white/10 text-primary-400 tracking-[0.2em] uppercase text-xs">
              ▸ ENTER DYNASTY MODE <span className="boot-cursor">█</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
          <span>© CSGN.FUN · 24/7 BROADCAST</span>
          <span>SEASON 02 · WEEK 17</span>
        </div>
      </div>
    </div>
  )
}
