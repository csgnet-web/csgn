import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CSGNMark } from '@/components/ui/Logo'
import { lazy, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const Watch = lazy(() => import('@/pages/Watch'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const About = lazy(() => import('@/pages/About'))
const StreamerQuickApply = lazy(() => import('@/pages/StreamerQuickApply'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Queue = lazy(() => import('@/pages/Queue'))
const Admin = lazy(() => import('@/pages/Admin'))
const Player = lazy(() => import('@/pages/Player'))
const Terms = lazy(() => import('@/pages/Terms'))

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
  const { user } = useAuth()
  const location = useLocation()
  const isPlayerPage = location.pathname === '/player'
  const hideFooter = location.pathname === '/watch' || location.pathname === '/' || isPlayerPage

  return (
    <div className={`min-h-screen bg-[#050507]${isPlayerPage ? '' : ' csgn-bg'}`}>
      {!isPlayerPage && <Header />}

      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Watch />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/apply" element={<Navigate to="/queue" replace />} />
            <Route path="/about" element={<About />} />
            <Route path="/about/streamer-quick-apply" element={<StreamerQuickApply />} />
            <Route path="/account" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/account" replace />} />
            <Route path="/queue" element={user ? <Queue /> : <Navigate to="/watch" replace />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/player" element={<Player />} />
            <Route path="/terms" element={<Terms />} />
          </Routes>
        </AnimatePresence>
      </Suspense>

      {!hideFooter && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}
