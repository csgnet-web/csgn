import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { AuthModalProvider } from '@/contexts/AuthModalProvider'
import { LiveSlotProvider } from '@/contexts/LiveSlotContext'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { BottomNav } from '@/components/layout/BottomNav'
import { CSGNMark } from '@/components/ui/Logo'
import { lazy, Suspense } from 'react'

const Watch = lazy(() => import('@/pages/Watch'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const About = lazy(() => import('@/pages/About'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const PublicProfile = lazy(() => import('@/pages/PublicProfile'))
const Admin = lazy(() => import('@/pages/Admin'))
const Player = lazy(() => import('@/pages/Player'))
const Terms = lazy(() => import('@/pages/Terms'))
const Privacy = lazy(() => import('@/pages/Privacy'))
const TwitchComplete = lazy(() => import('@/pages/TwitchComplete'))
const Participate = lazy(() => import('@/pages/Participate'))
const Treasury = lazy(() => import('@/pages/Treasury'))
const Studio = lazy(() => import('@/pages/Studio'))
const EmailComplete = lazy(() => import('@/pages/EmailComplete'))

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <CSGNMark className="w-12 h-12 animate-pulse" />
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

function AppContent() {
  const location = useLocation()
  const isPlayerPage = location.pathname === '/player'
  // Watch is a full-viewport app shell; /player is a chrome-free OBS capture.
  const isWatchPage = location.pathname === '/' || location.pathname === '/watch'
  const showFooter = !isPlayerPage && !isWatchPage

  return (
    <div className={`min-h-screen bg-[#050507]${isPlayerPage ? '' : ' csgn-bg'}`}>
      {!isPlayerPage && <Header />}

      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Watch />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/apply" element={<Navigate to="/schedule" replace />} />
            <Route path="/about" element={<About />} />
            {/* /about/streamer-quick-apply used to live here: an orphan page,
                linked from nowhere, describing an application-and-review flow
                that has not existed since claiming became self-serve. It sent
                people to csgn.fun/apply, which redirects to /schedule. */}
            <Route path="/about/streamer-quick-apply" element={<Navigate to="/schedule" replace />} />
            <Route path="/account" element={<Dashboard />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/dashboard" element={<Navigate to="/account" replace />} />
            <Route path="/queue" element={<Navigate to="/schedule" replace />} />
            <Route path="/vote" element={<Participate />} />
            <Route path="/participate" element={<Participate />} />
            <Route path="/treasury" element={<Treasury />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/player" element={<Player />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/auth/twitch/complete" element={<TwitchComplete />} />
            <Route path="/auth/email/complete" element={<EmailComplete />} />
          </Routes>
        </AnimatePresence>
      </Suspense>

      {showFooter && <Footer />}

      {/* The tab bar sits above everything except modals, on every route but the
          OBS capture. The spacer keeps the last line of a page clear of it —
          without it, every page's final element hides under the bar on a phone. */}
      {!isPlayerPage && (
        <>
          <div className="lg:hidden" style={{ height: 'var(--csgn-tabbar)' }} aria-hidden="true" />
          <BottomNav />
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LiveSlotProvider>
          {/* Inside both, because the sheet reads auth state and the tab bar
              reads the live slot — and outside AppContent so any route can open
              it without rendering its own copy. */}
          <AuthModalProvider>
            <AppContent />
          </AuthModalProvider>
        </LiveSlotProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
