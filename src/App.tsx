import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from '@/contexts/AuthContext'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { CSGNMark } from '@/components/ui/Logo'
import { lazy, Suspense } from 'react'

const Home = lazy(() => import('@/pages/Home'))
const Watch = lazy(() => import('@/pages/Watch'))
const Schedule = lazy(() => import('@/pages/Schedule'))
const Apply = lazy(() => import('@/pages/Apply'))
const About = lazy(() => import('@/pages/About'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Queue = lazy(() => import('@/pages/Queue'))
const Admin = lazy(() => import('@/pages/Admin'))

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
  const hideFooter = location.pathname === '/watch'

  return (
    <div className="min-h-screen bg-[#050507] csgn-bg">
      <Header />

      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Home />} />
            <Route path="/watch" element={<Watch />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/apply" element={<Apply />} />
            <Route path="/about" element={<About />} />
            <Route path="/account" element={<Dashboard />} />
            <Route path="/dashboard" element={<Navigate to="/account" replace />} />
            <Route path="/queue" element={<Queue />} />
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
