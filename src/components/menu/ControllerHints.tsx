interface Hint {
  keys: string[]
  label: string
}

const DEFAULT_HINTS: Hint[] = [
  { keys: ['↑', '↓'], label: 'Change Mode' },
  { keys: ['ENTER'],  label: 'Select' },
  { keys: ['ESC'],    label: 'Back' },
  { keys: ['M'],      label: 'Mute' },
  { keys: ['F'],      label: 'Fullscreen' },
]

export function ControllerHints({ hints = DEFAULT_HINTS, status = 'BROADCAST GREEN' }: { hints?: Hint[]; status?: string }) {
  return (
    <div className="relative h-12 border-t border-primary-700/40 bg-gradient-to-r from-black via-[#0a0205] to-black flex items-stretch">
      <div className="hidden md:flex items-center gap-2 px-4 bg-primary-600/90 clip-slant-r">
        <span className="font-display font-black text-xs tracking-[0.2em] text-white">CONTROLS</span>
      </div>

      <div className="flex-1 flex items-center gap-5 px-4 overflow-x-auto whitespace-nowrap">
        {hints.map((h, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {h.keys.map((k, j) => (
                <span key={j} className="ctrl-key">{k}</span>
              ))}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">{h.label}</span>
          </div>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-2 px-4 bg-black/80 border-l border-primary-700/40 clip-slant-l">
        <span className="w-2 h-2 rounded-full bg-[color:var(--color-live)] animate-live-pulse" />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/70">{status}</span>
      </div>
    </div>
  )
}
