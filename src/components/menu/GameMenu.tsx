import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GAME_MODES } from '@/data/dummy'

export function GameMenu() {
  const navigate = useNavigate()
  const location = useLocation()
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])

  const activeIndex = useMemo(() => {
    const i = GAME_MODES.findIndex(m => m.route === location.pathname)
    return i === -1 ? 0 : i
  }, [location.pathname])

  const [highlight, setHighlight] = useState(activeIndex)

  // Keep highlight in sync with route changes (e.g. arrow nav already changed route)
  useEffect(() => {
    setHighlight(activeIndex)
  }, [activeIndex])

  // Global keyboard nav — arrow keys move highlight & navigate; Enter "selects" (already routed).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore if user is typing in a field
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        const next = (highlight + 1) % GAME_MODES.length
        setHighlight(next)
        navigate(GAME_MODES[next].route)
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const prev = (highlight - 1 + GAME_MODES.length) % GAME_MODES.length
        setHighlight(prev)
        navigate(GAME_MODES[prev].route)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        navigate(GAME_MODES[highlight].route)
        // brief shake on the active row for feedback
        const el = itemRefs.current[highlight]
        if (el) {
          el.classList.remove('menu-shake')
          // force reflow to restart animation
          void el.offsetWidth
          el.classList.add('menu-shake')
        }
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1
        if (idx < GAME_MODES.length) {
          setHighlight(idx)
          navigate(GAME_MODES[idx].route)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [highlight, navigate])

  return (
    <nav
      aria-label="Game modes"
      className="relative flex md:flex-col gap-1.5 md:gap-2 overflow-x-auto md:overflow-visible scrollbar-thin px-2 md:px-0 py-2 md:py-0"
    >
      <div className="hidden md:flex items-center gap-2 px-4 mb-1">
        <span className="font-display font-black tracking-[0.22em] text-white text-xs">SELECT MODE</span>
        <span className="flex-1 h-px bg-gradient-to-r from-primary-600/60 to-transparent" />
      </div>

      {GAME_MODES.map((m, i) => {
        const isActive = i === highlight
        return (
          <button
            key={m.id}
            ref={el => { itemRefs.current[i] = el }}
            onMouseEnter={() => setHighlight(i)}
            onFocus={() => setHighlight(i)}
            onClick={() => navigate(m.route)}
            className={[
              'group focus-ring relative shrink-0 md:w-full text-left',
              'transition-all duration-150',
              'flex items-center gap-3 pl-4 pr-3 md:pr-4 py-3 md:py-3.5',
              isActive
                ? 'metal-panel-hot menu-active'
                : 'metal-panel hover:border-primary-500/60',
            ].join(' ')}
            style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}
          >
            {/* Number badge */}
            <span
              className={[
                'scoreboard-digits text-[10px] md:text-xs px-1.5 py-0.5 rounded-sm border',
                isActive
                  ? 'border-white/40 text-white bg-black/30'
                  : 'border-primary-700/40 text-primary-400 bg-black/30',
              ].join(' ')}
            >
              {m.number}
            </span>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <div
                className={[
                  'font-display font-black tracking-[0.12em] uppercase truncate',
                  'text-sm md:text-[15px]',
                  isActive ? 'text-white' : 'text-white/85 group-hover:text-white',
                ].join(' ')}
              >
                {m.label}
              </div>
              <div className="hidden md:block font-mono text-[10px] uppercase tracking-[0.22em] text-white/45 truncate">
                {m.sublabel}
              </div>
            </div>

            {/* Badge / arrow */}
            {m.badge && (
              <span
                className={[
                  'hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm font-mono text-[9px] tracking-[0.22em] uppercase',
                  m.badge === 'LIVE'
                    ? 'bg-[color:var(--color-live)]/15 text-[color:var(--color-live)] border border-[color:var(--color-live)]/40'
                    : m.badge === 'OPEN'
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-600/50'
                    : 'bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] border border-[color:var(--color-gold)]/40',
                ].join(' ')}
              >
                {m.badge === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-live)] animate-live-pulse" />}
                {m.badge}
              </span>
            )}

            <span
              className={[
                'hidden md:inline font-mono text-base transition-all',
                isActive ? 'text-primary-400 translate-x-1' : 'text-white/30',
              ].join(' ')}
            >
              ▸
            </span>
          </button>
        )
      })}

      <div className="hidden md:block px-4 pt-3 mt-2 border-t border-white/5">
        <div className="font-mono text-[10px] tracking-[0.25em] text-white/40 uppercase">
          Press <span className="ctrl-key mx-1">↑</span><span className="ctrl-key mx-1">↓</span> or <span className="ctrl-key mx-1">1-9</span>
        </div>
      </div>
    </nav>
  )
}
