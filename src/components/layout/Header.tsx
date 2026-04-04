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
  { href: '/queue', label: 'Queue' },
  { href: '/apply', label: 'Apply' },
  { href: '/about', label: 'About' },
]

export function Header() {
  const [scrolled, setScrolled]     = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [authModal, setAuthModal]   = useState<{ open: boolean; mode: 'login' | 'signup' }>({
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
            ? 'bg-[#06060f]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,35,70,0.1)]'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">

            {/* Logo */}
            <Logo showText={false} size="md" />

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.href
                const isQueueRestricted = link.href === '/queue' && profile?.role !== 'admin'

                if (isQueueRestricted) {
                  return (
                    <span
                      key={link.href}
                      title="Coming soon"
                      className="relative px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 text-gray-600 cursor-not-allowed select-none"
                    >
                      {link.label}
                      <span className="text-[9px] font-semibold bg-white/[0.06] px-1.5 py-0.5 rounded text-gray-600 tracking-wide">SOON</span>
                    </span>
                  )
                }

                return (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${
                      isActive
                        ? 'text-white bg-white/[0.07]'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    {link.live && <LiveIndicator />}
                    {link.label}
                    {isActive && (
                      <motion.div
                        layoutId="navIndicator"
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary-500 rounded-full"
                      />
                    )}
                  </Link>
                )
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen(!profileOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center text-xs font-bold text-white">
                      {(profile?.displayName || user.email || 'U')[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-white hidden sm:block max-w-[120px] truncate">
                      {profile?.displayName || 'User'}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  </button>

                  <AnimatePresence>
                    {profileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        className="absolute right-0 mt-2 w-56 py-2 bg-[#0a0a18]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl"
                      >
                        <Link
                          to="/account"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Account
                        </Link>
                        {profile?.role === 'admin' && (
                          <Link
                            to="/queue"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <User className="w-4 h-4" />
                            Queue
                          </Link>
                        )}
                        {profile?.role === 'admin' && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Shield className="w-4 h-4" />
                            Admin Panel
                          </Link>
                        )}
                        <div className="my-1 border-t border-white/5" />
                        <button
                          onClick={() => { signOut(); setProfileOpen(false) }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
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
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <motion.nav
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[#09091a] border-l border-white/[0.06] p-6 pt-20"
            >
              <div className="flex flex-col gap-1">
                {navLinks.map((link) => {
                  const isQueueRestricted = link.href === '/queue' && profile?.role !== 'admin'

                  if (isQueueRestricted) {
                    return (
                      <span
                        key={link.href}
                        className="flex items-center gap-3 px-4 py-3 text-base font-medium rounded-xl text-gray-600 cursor-not-allowed select-none"
                      >
                        {link.label}
                        <span className="text-[10px] font-semibold bg-white/[0.06] px-2 py-0.5 rounded text-gray-600 tracking-wide ml-auto">SOON</span>
                      </span>
                    )
                  }

                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 text-base font-medium rounded-xl transition-all ${
                        location.pathname === link.href
                          ? 'text-white bg-white/[0.08]'
                          : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      {link.live && <LiveIndicator />}
                      {link.label}
                    </Link>
                  )
                })}
              </div>
              {!user && (
                <div className="mt-8 flex flex-col gap-3">
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

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModal.open}
        onClose={() => setAuthModal((s) => ({ ...s, open: false }))}
        initialMode={authModal.mode}
      />
    </>
  )
}
