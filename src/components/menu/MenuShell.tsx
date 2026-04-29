import { useState, type ReactNode } from 'react'
import { BootSequence } from './BootSequence'
import { Ticker } from './Ticker'
import { GameMenu } from './GameMenu'
import { ControllerHints } from './ControllerHints'
import { CrtOverlay } from './CrtOverlay'
import { HeaderBar } from './HeaderBar'

const BOOT_KEY = 'csgn:boot:done:v1'

export function MenuShell({ children }: { children: ReactNode }) {
  const [booted, setBooted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    if (sessionStorage.getItem(BOOT_KEY) === '1') return true
    // Skip boot if the first paint is a deep route — the boot intro
    // only fits the "/" Dynasty Menu landing.
    if (window.location.pathname !== '/') {
      sessionStorage.setItem(BOOT_KEY, '1')
      return true
    }
    return false
  })

  if (!booted) {
    return (
      <BootSequence
        onComplete={() => {
          sessionStorage.setItem(BOOT_KEY, '1')
          setBooted(true)
        }}
      />
    )
  }

  return (
    <div className="csgn-stadium-bg min-h-screen flex flex-col">
      <CrtOverlay />

      <HeaderBar />
      <Ticker />

      {/* Main play area */}
      <main className="relative flex-1 flex flex-col md:flex-row gap-3 md:gap-4 px-3 md:px-5 py-3 md:py-4 min-h-0">
        {/* Left: Game mode menu (vertical on desktop, horizontal scroll on mobile) */}
        <aside className="md:w-[280px] lg:w-[320px] shrink-0 md:max-h-full md:overflow-y-auto">
          <GameMenu />
        </aside>

        {/* Right: Big preview panel */}
        <div className="flex-1 min-h-[60vh] md:min-h-0 metal-panel broadcast-border relative md:rounded-sm overflow-hidden">
          <div className="stadium-sweep" aria-hidden />
          {children}
        </div>
      </main>

      <ControllerHints />
    </div>
  )
}
