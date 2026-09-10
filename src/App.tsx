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
import { ROUTE_CHUNKS } from '@/lib/routePrefetch'

// Routes the nav can PREFETCH share their import thunk with lib/routePrefetch.ts,
// so warming a chunk on hover and loading it on navigation are provably the same
// chunk. Two copies of the specifier would emit two chunks and the prefetch
// would quietly warm the wrong one.
const Watch = lazy(ROUTE_CHUNKS['/watch'])
const Schedule = lazy(ROUTE_CHUNKS['/schedule'])
const About = lazy(ROUTE_CHUNKS['/about'])
const Dashboard = lazy(ROUTE_CHUNKS['/account'])
const Admin = lazy(ROUTE_CHUNKS['/admin'])
const Terms = lazy(ROUTE_CHUNKS['/terms'])
const Privacy = lazy(ROUTE_CHUNKS['/privacy'])
const Participate = lazy(ROUTE_CHUNKS['/participate'])
const Treasury = lazy(ROUTE_CHUNKS['/treasury'])
const Studio = lazy(ROUTE_CHUNKS['/studio'])
const Share = lazy(ROUTE_CHUNKS['/share'])

// Routes nothing links to from the nav — an OBS surface, a profile page reached
// by handle, the two OAuth landings — so there is nothing to warm them from.
const PublicProfile = lazy(() => import('@/pages/PublicProfile'))
const Player = lazy(() => import('@/pages/Player'))
const OldPlayer = lazy(() => import('@/pages/OldPlayer'))
const TwitchComplete = lazy(() => import('@/pages/TwitchComplete'))
const TikTokComplete = lazy(() => import('@/pages/TikTokComplete'))
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
  // Both player routes are chrome-free OBS capture surfaces.
  const isPlayerPage = location.pathname === '/player' || location.pathname === '/oldplayer'
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
            {/* Where Android's share sheet lands. See public/manifest.webmanifest. */}
            <Route path="/share" element={<Share />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/player" element={<Player />} />
            {/* The revert path — same player, clips off. See OldPlayer.tsx. */}
            <Route path="/oldplayer" element={<OldPlayer />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/auth/twitch/complete" element={<TwitchComplete />} />
            {/* Where a TikTok sign-up lands. Named without /complete because
                the callback builds this URL server-side and a shorter path is
                one less thing to get wrong in the TikTok developer console. */}
            <Route path="/auth/tiktok" element={<TikTokComplete />} />
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
