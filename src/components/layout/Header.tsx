import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, ChevronDown, User, LogOut, LayoutDashboard, Shield } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { Logo } from '@/components/ui/Logo'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/contexts/AuthContext'

const navLinks = [
  { href: '/watch', label: 'Watch Live', live: true },
  { href: '/schedule', label: 'Schedule' },
  { href: '/queue', label: 'Queue', authOnly: true },
  { href: '/apply', label: 'Apply' },
  { href: '/about', label: 'About' },
]

export function Header() {
  const [scrolled, setScrolled]       = useState(false)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [authModal, setAuthModal]     = useState<{ open: boolean; mode: 'login' | 'signup' }>({
    open: false,
    mode: 'login',
  })

  const location = useLocation()
  const { user, profile, signOut } = useAuth()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const openAuth = (mode: 'login' | 'signup') => {
    setMobileOpen(false)
    setAuthModal({ open: true, mode })
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-navy-900/95 backdrop-blur-xl border-b-2 border-gold-500/60 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
            : 'bg-navy-950/80 backdrop-blur-sm border-b border-gold-500/20'
        }`}
      >
        {/* Gold accent top-line */}
        <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-gold-500 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 lg:h-[60px]">

            {/* Logo + wordmark */}
            <div className="flex items-center gap-3">
              <Logo showText={false} size="md" />
              <div className="hidden sm:flex flex-col leading-none">
                <span
                  className="text-white font-bold tracking-[0.18em] uppercase text-sm"
                  style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '1.15rem', letterSpacing: '0.2em' }}
                >
                  CSGN
                </span>
                <span className="text-gold-500/70 text-[9px] tracking-[0.25em] uppercase font-bold"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                  CRYPTO SPORTS &amp; GAMING
                </span>
              </div>
            </div>

            {/* Desktop Nav — scoreboard-style tab strip */}
            <nav className="hidden lg:flex items-center">
              {navLinks.map((link) => {
                const isActive  = location.pathname === link.href
                const isLocked  = !!link.authOnly && !user

                return (
                  <Link
                    key={link.href}
                    to={isLocked ? '#' : link.href}
                    onClick={(e) => {
                      if (isLocked) { e.preventDefault(); openAuth('login') }
                    }}
                    className={`
                      relative flex items-center gap-2 px-5 h-[60px]
                      text-[13px] font-bold tracking-[0.18em] uppercase
                      transition-all duration-200
                      ${isLocked
                        ? 'text-gray-600 cursor-not-allowed'
                        : isActive
                          ? 'text-gold-400 bg-gold-500/8'
                          : 'text-gray-300 hover:text-gold-300 hover:bg-white/[0.03]'
                      }
                    `}
                    style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}
                  >
                    {link.live && <LiveIndicator />}
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="navIndicator"
                        className="absolute bottom-0 left-0 right-0 h-[3px] bg-gold-500"
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Right side — user / score panel */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-navy-800 border border-gold-500/30 hover:border-gold-400/60 hover:bg-navy-700 transition-all cursor-pointer"
                    style={{ borderRadius: '2px' }}
                  >
                    <div
                      className="w-6 h-6 flex items-center justify-center text-xs font-bold text-navy-900 bg-gradient-to-b from-gold-400 to-gold-600"
                      style={{ borderRadius: '2px' }}
                    >
                      {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-bold text-white hidden sm:block max-w-[110px] truncate tracking-wide uppercase"
                      style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}>
                      {profile?.displayName || 'Player'}
                    </span>
                    <span className="hidden sm:inline text-[10px] text-gold-400 bg-gold-500/10 border border-gold-500/25 px-1.5 py-0.5"
                      style={{ fontFamily: "'Share Tech Mono', monospace", borderRadius: '2px' }}>
                      {(profile?.xp ?? 0).toLocaleString()} XP
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gold-500/70" />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scaleY: 0.92 }}
                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        exit={{ opacity: 0, y: 8, scaleY: 0.92 }}
                        style={{ transformOrigin: 'top', borderRadius: '2px' }}
                        className="absolute right-0 mt-1 w-52 py-1 bg-navy-900 border border-gold-500/25 shadow-2xl shadow-black/60 overflow-hidden"
                      >
                        {/* Gold accent stripe */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-gold-600 to-gold-400 mb-1" />
                        <Link
                          to="/account"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-gold-300 hover:bg-navy-800 transition-colors"
                          style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.08em' }}
                        >
                          <LayoutDashboard className="w-4 h-4 text-gold-500/60" />
                          ACCOUNT
                        </Link>
                        {profile?.role === 'admin' && (
                          <Link
                            to="/queue"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-gold-300 hover:bg-navy-800 transition-colors"
                            style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.08em' }}
                          >
                            <User className="w-4 h-4 text-gold-500/60" />
                            QUEUE
                          </Link>
                        )}
                        {profile?.role === 'admin' && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-gold-300 hover:bg-navy-800 transition-colors"
                            style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.08em' }}
                          >
                            <Shield className="w-4 h-4 text-gold-500/60" />
                            ADMIN PANEL
                          </Link>
                        )}
                        <div className="my-1 h-px bg-gold-500/10 mx-3" />
                        <button
                          onClick={() => { signOut(); setProfileOpen(false) }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-navy-800 transition-colors cursor-pointer"
                          style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.08em' }}
                        >
                          <LogOut className="w-4 h-4" />
                          SIGN OUT
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="hidden lg:flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openAuth('login')}>Sign In</Button>
                  <Button variant="primary" size="sm" onClick={() => openAuth('signup')}>Get Started</Button>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="lg:hidden p-2 text-gold-400/70 hover:text-gold-300 transition-colors cursor-pointer"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu — game side-panel style */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="absolute right-0 top-0 bottom-0 w-72 max-w-[85vw] bg-navy-900 border-l-2 border-gold-500/40 pt-20 overflow-hidden"
            >
              {/* Decorative field lines */}
              <div className="absolute inset-0 pointer-events-none opacity-20" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,179,0,0.15) 40px)'
              }} />
              {/* Top gold stripe */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold-600 to-gold-400" />

              <div className="relative flex flex-col gap-0.5 px-4">
                {navLinks.map((link, i) => {
                  const isLocked = !!link.authOnly && !user
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: i * 0.06 }}
                    >
                      <Link
                        to={isLocked ? '#' : link.href}
                        onClick={(e) => {
                          if (isLocked) { e.preventDefault(); openAuth('login'); return }
                          setMobileOpen(false)
                        }}
                        className={`
                          flex items-center gap-3 px-4 py-3 text-base font-bold uppercase tracking-widest
                          transition-all border-l-4
                          ${isLocked
                            ? 'text-gray-600 border-gray-700 bg-white/[0.01] cursor-not-allowed'
                            : location.pathname === link.href
                              ? 'text-gold-400 border-gold-500 bg-gold-500/8'
                              : 'text-gray-300 border-transparent hover:text-gold-300 hover:border-gold-500/40 hover:bg-white/[0.03]'
                          }
                        `}
                        style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}
                      >
                        {link.live && <LiveIndicator />}
                        {link.label}
                      </Link>
                    </motion.div>
                  )
                })}
              </div>

              {!user && (
                <div className="relative mt-8 px-4 flex flex-col gap-3">
                  <div className="h-px bg-gold-500/15 mb-1" />
                  <Button variant="secondary" size="lg" className="w-full" onClick={() => openAuth('login')}>
                    Sign In
                  </Button>
                  <Button variant="primary" size="lg" className="w-full" onClick={() => openAuth('signup')}>
                    Get Started
                  </Button>
                </div>
              )}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal
        isOpen={authModal.open}
        onClose={() => setAuthModal((s) => ({ ...s, open: false }))}
        initialMode={authModal.mode}
      />
    </>
  )
}
