import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { AuthModal } from '@/components/auth/AuthModal'
import { lazy, Suspense } from 'react'

const Home = lazy(() => import('@/pages/Home'))
const Watch = lazy(() => import('@/pages/Watch'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const Apply = lazy(() => import('@/pages/Apply'))
const About = lazy(() => import('@/pages/About'))
const Tokenomics = lazy(() => import('@/pages/Tokenomics'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Admin = lazy(() => import('@/pages/Admin'))

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center font-display font-bold text-white animate-pulse">
          CS
        </div>
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

function AppContent() {
  const [authModal, setAuthModal] = useState<{ open: boolean; mode: 'login' | 'signup' }>({
    open: false,
    mode: 'login',
  })
  const location = useLocation()

  const openAuth = (mode: 'login' | 'signup') => setAuthModal({ open: true, mode })
  const closeAuth = () => setAuthModal({ open: false, mode: 'login' })

  // Hide footer on Watch page for immersive experience
  const hideFooter = location.pathname === '/watch'

  return (
    <div className="min-h-screen bg-[#06060e]">
      <Header onOpenAuth={openAuth} />
      <AuthModal isOpen={authModal.open} onClose={closeAuth} initialMode={authModal.mode} />

      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/about" element={<About />} />
            <Route path="/tokenomics" element={<Tokenomics />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
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
