import { Link } from 'react-router-dom'
import { Twitter, Youtube, MessageCircle, ExternalLink } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

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
    { label: 'Tokenomics', href: '/tokenomics', external: false },
    { label: 'Contact', href: '/about#contact', external: false },
  ],
  Community: [
    { label: 'Twitter / X', href: 'https://x.com/caborgg', external: true },
    { label: 'Discord', href: '#', external: true },
    { label: 'Telegram', href: '#', external: true },
    { label: 'pump.fun', href: 'https://pump.fun', external: true },
  ],
}

export function Footer() {
  return (
    <footer className="relative bg-navy-950 border-t-2 border-gold-500/30 overflow-hidden">
      {/* Field-line background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,179,0,0.06) 40px)',
        }}
      />
      {/* Top accent bar with gradient */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-gold-500 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Score-bug style header row */}
        <div className="flex items-center gap-4 mb-10 pb-6 border-b border-gold-500/15">
          <div className="h-[3px] flex-1 bg-gradient-to-r from-gold-500/0 to-gold-500/40" />
          <span
            className="text-gold-500/50 text-[10px] font-bold tracking-[0.4em] uppercase px-4"
            style={{ fontFamily: "'Share Tech Mono', monospace" }}
          >
            ◆ CSGN NETWORK ◆
          </span>
          <div className="h-[3px] flex-1 bg-gradient-to-l from-gold-500/0 to-gold-500/40" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand panel */}
          <div className="col-span-2 md:col-span-1">
            <Logo showTagline size="md" className="mb-5" />
            <p
              className="text-sm text-gray-400 leading-relaxed mb-6"
              style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif" }}
            >
              The 24/7 crypto-native streaming network. The ESPN and TMZ of crypto.
            </p>
            <div className="flex items-center gap-2">
              {[
                { Icon: Twitter,       href: 'https://x.com/caborgg' },
                { Icon: Youtube,       href: '#' },
                { Icon: MessageCircle, href: '#' },
              ].map(({ Icon, href }) => (
                <a
                  key={href}
                  href={href}
                  target={href !== '#' ? '_blank' : undefined}
                  rel="noopener noreferrer"
                  className="w-8 h-8 flex items-center justify-center bg-navy-800 border border-gold-500/25 text-gray-400 hover:text-gold-400 hover:border-gold-400/60 hover:bg-navy-700 transition-all"
                  style={{ borderRadius: '2px' }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              {/* Column header — scoreboard label style */}
              <div className="flex items-center gap-2 mb-5">
                <span className="w-1 h-4 bg-gold-500" />
                <h4
                  className="text-xs font-bold tracking-[0.25em] uppercase text-gold-400"
                  style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}
                >
                  {title}
                </h4>
              </div>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-gold-300 transition-colors inline-flex items-center gap-1.5 font-medium tracking-wide"
                        style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif" }}
                      >
                        {link.label}
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-gray-500 hover:text-gold-300 transition-colors font-medium tracking-wide"
                        style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif" }}
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

        {/* Bottom scoreboard bar */}
        <div className="mt-12 pt-6 border-t border-gold-500/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p
            className="text-xs text-gray-600 tracking-wider"
            style={{ fontFamily: "'Share Tech Mono', monospace" }}
          >
            &copy; {new Date().getFullYear()} CSGN &mdash; Crypto Sports &amp; Gaming Network
          </p>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-field-500 animate-live-pulse" />
            <p
              className="text-xs text-gray-600 tracking-wider"
              style={{ fontFamily: "'Share Tech Mono', monospace" }}
            >
              Built on <span className="text-gold-500">Solana</span> &middot; Powered by pump.fun
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
