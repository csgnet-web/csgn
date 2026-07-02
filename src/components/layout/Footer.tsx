import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, Twitter } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { CSGN_MINT } from '@/lib/slots'
import { X_HANDLE, X_PROFILE_URL } from '@/lib/social'

const footerLinks = {
  Platform: [
    { label: 'Watch Live', href: '/watch', external: false },
    { label: 'Schedule', href: '/schedule', external: false },
    { label: 'Apply to Stream', href: '/apply', external: false },
    { label: 'Queue', href: '/queue', external: false },
  ],
  Company: [
    { label: 'About', href: '/about', external: false },
    { label: 'Team', href: '/about#team', external: false },
    { label: 'Terms', href: '/terms', external: false },
    { label: 'Contact', href: '/about#contact', external: false },
  ],
  Community: [
    { label: `@${X_HANDLE} on X`, href: X_PROFILE_URL, external: true },
    { label: 'pump.fun', href: `https://pump.fun/coin/${CSGN_MINT}`, external: true },
    { label: 'DexScreener', href: `https://dexscreener.com/solana/${CSGN_MINT}`, external: true },
  ],
}

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Logo showTagline size="md" className="mb-5" />
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              The 24/7 crypto-native streaming network, live on X. The ESPN and TMZ of crypto.
            </p>
            <div className="flex items-center gap-3">
              <a
                href={X_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                title={`@${X_HANDLE} on X`}
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:border-primary-500/30 transition-all"
              >
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Link Groups */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors inline-flex items-center gap-1"
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Token CA strip */}
        <div className="mt-12">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy contract address"
            className="glass-panel w-full sm:w-auto inline-flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
          >
            <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 shrink-0">$CSGN CA</span>
            <span className="text-[11px] font-mono text-gray-300 truncate">{CSGN_MINT}</span>
            {copied
              ? <Check className="w-3.5 h-3.5 shrink-0 text-positive" />
              : <Copy className="w-3.5 h-3.5 shrink-0 text-gray-500 group-hover:text-white transition-colors" />}
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} CSGN &mdash; Crypto Sports &amp; Gaming Network. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">
            Built on <span className="text-primary-400">Solana</span> &middot; Powered by pump.fun &middot; Live on X
          </p>
        </div>
      </div>
    </footer>
  )
}
