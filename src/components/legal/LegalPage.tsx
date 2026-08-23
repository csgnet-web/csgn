import type { ReactNode } from 'react'

/**
 * Shared shell for the legal pages.
 *
 * Numbered clauses with real headings, because the point of a legal page is
 * that a specific paragraph can be pointed at — by us, by a member, or by
 * somebody's lawyer. A single undifferentiated wall of text cannot be cited.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <header className="border-b border-white/[0.08] pb-6">
          <h1 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight">{title}</h1>
          <p className="mt-2 text-xs text-gray-500">Last updated {updated}</p>
        </header>

        <div className="mt-8 space-y-8">{children}</div>

        {/* Said out loud, because a boilerplate policy that pretends to be
            bespoke advice is the failure mode worth avoiding here. */}
        <p className="mt-12 pt-6 border-t border-white/[0.08] text-[11px] text-gray-600 leading-relaxed">
          These terms are a general-purpose starting point and are not legal advice. They have not
          been reviewed by a lawyer for your jurisdiction. If you fork this project, get your own
          advice before running a network of your own.
        </p>
      </div>
    </div>
  )
}

export function Clause({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold text-white">
        <span className="text-gray-600 font-mono mr-2">{n}</span>{title}
      </h2>
      <div className="mt-2.5 space-y-3 text-sm text-gray-400 leading-relaxed">{children}</div>
    </section>
  )
}
