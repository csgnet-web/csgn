import type { ReactNode } from 'react'

interface PanelShellProps {
  eyebrow: string
  title: string
  subtitle?: string
  badge?: string
  children: ReactNode
}

export function PanelShell({ eyebrow, title, subtitle, badge, children }: PanelShellProps) {
  return (
    <section className="relative h-full flex flex-col overflow-hidden">
      <div className="diag-wipe" key={title} aria-hidden />

      <header className="relative shrink-0 flex items-end justify-between gap-4 px-5 md:px-7 pt-5 md:pt-6 pb-4 border-b border-white/5">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.4em] uppercase text-primary-400">{eyebrow}</span>
            {badge && (
              <span className="font-mono text-[9px] tracking-[0.25em] uppercase px-1.5 py-0.5 rounded-sm bg-[color:var(--color-live)]/10 text-[color:var(--color-live)] border border-[color:var(--color-live)]/40">
                {badge}
              </span>
            )}
          </div>
          <h1 className="font-display font-black text-3xl md:text-5xl tracking-[0.04em] uppercase leading-[1.05] text-white mt-1">
            <span className="text-gradient">{title}</span>
          </h1>
          {subtitle && (
            <p className="font-mono text-[11px] md:text-xs uppercase tracking-[0.2em] text-white/45 mt-2 max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>
        <div className="hidden md:flex flex-col items-end gap-1">
          <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-white/40">CSGN BROADCAST</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[color:var(--color-live)] animate-live-pulse" />
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/70">SIGNAL · LOCKED</span>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto px-5 md:px-7 py-5 md:py-6">
        {children}
      </div>
    </section>
  )
}
