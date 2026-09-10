import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Twitter } from 'lucide-react'
import { CSGN_MINT } from '@/lib/slots'
import { X_HANDLE, X_PROFILE_URL } from '@/lib/social'

/**
 * THE FOOTER, AT THE SIZE A FOOTER SHOULD BE.
 *
 * ── What it stopped being ──────────────────────────────────────────────────
 *
 * A four-column sitemap: the logo with a tagline, a paragraph of positioning
 * ("The ESPN and TMZ of crypto"), two link columns duplicating the tab bar, a
 * contract-address strip, and a two-line legal row — about 700px of it, under
 * every page, on a phone. On the shorter pages it was taller than the page.
 *
 * The nav columns were the clearest waste: this app has a PERMANENT bottom tab
 * bar with Watch, Schedule, Post, $CSGN and You on it. A footer link to /watch
 * is a link to something already one tap away and always visible.
 *
 * So what is left is what a footer is actually for — the things that exist
 * nowhere else on the page: the token's contract address, where to find the
 * channel off-site, and the legal links.
 */
export function Footer() {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    void navigator.clipboard?.writeText(CSGN_MINT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <footer className="relative border-t border-white/[0.05] bg-[#05050d]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* The contract address is the one thing here somebody actually comes
            looking for, so it leads and it is a copy button. */}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy contract address"
          className="w-full inline-flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-left hover:bg-white/[0.05] transition-colors cursor-pointer group"
        >
          <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 shrink-0">$CSGN</span>
          <span className="flex-1 min-w-0 text-[11px] font-mono text-gray-400 truncate">{CSGN_MINT}</span>
          {copied
            ? <Check className="w-3.5 h-3.5 shrink-0 text-positive" />
            : <Copy className="w-3.5 h-3.5 shrink-0 text-gray-500 group-hover:text-white transition-colors" />}
        </button>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-[11px] text-gray-600">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <a
              href={X_PROFILE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-gray-300 transition-colors"
            >
              <Twitter className="w-3.5 h-3.5" /> @{X_HANDLE}
            </a>
            <a
              href={`https://dexscreener.com/solana/${CSGN_MINT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-300 transition-colors"
            >
              Chart
            </a>
            <Link to="/treasury" className="hover:text-gray-300 transition-colors">Treasury</Link>
            <Link to="/about" className="hover:text-gray-300 transition-colors">About</Link>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link to="/terms" className="hover:text-gray-400 underline underline-offset-2">Terms</Link>
            <span>·</span>
            <Link to="/privacy" className="hover:text-gray-400 underline underline-offset-2">Privacy</Link>
            <span>·</span>
            <span>&copy; {new Date().getFullYear()} CSGN</span>
          </span>
        </div>
      </div>
    </footer>
  )
}
