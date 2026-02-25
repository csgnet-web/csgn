import { Link } from 'react-router-dom'
import { Twitter, Youtube, MessageCircle, ExternalLink } from 'lucide-react'

const footerLinks = {
  Platform: [
    { label: 'Watch Live', href: '/', external: false },
    { label: 'Schedule', href: '/schedule', external: false },
    { label: 'Apply to Stream', href: '/apply', external: false },
    { label: 'Queue', href: '/queue', external: false },
  ],
  Company: [
    { label: 'About', href: '/about', external: false },
    { label: 'Team', href: '/about#team', external: false },
    { label: 'Business Plan', href: '/about#vision', external: false },
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
    <footer className="relative border-t border-white/[0.06] bg-[#06060e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center font-display font-bold text-sm text-white">
                CS
              </div>
              <span className="font-display font-bold text-lg text-white">CSGN</span>
            </Link>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              The 24/7 crypto-native streaming network. The ESPN and TMZ of crypto.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://x.com/caborgg"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="#"
                className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all"
              >
                <MessageCircle className="w-4 h-4" />
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

        <div className="mt-16 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">
            &copy; {new Date().getFullYear()} CSGN — Crypto Sports & Gaming Network. All rights reserved.
          </p>
          <p className="text-xs text-gray-600">
            Built on <span className="text-primary-400">Solana</span> &middot; Powered by pump.fun
          </p>
        </div>
      </div>
    </footer>
  )
}
