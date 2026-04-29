import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { MenuShell } from '@/components/menu/MenuShell'

const DynastyMenu  = lazy(() => import('@/pages/DynastyMenu'))
const WatchLive    = lazy(() => import('@/pages/WatchLive'))
const DynastyHub   = lazy(() => import('@/pages/DynastyHub'))
const RaceForSlot  = lazy(() => import('@/pages/RaceForSlot'))
const SlotSchedule = lazy(() => import('@/pages/SlotSchedule'))
const Games        = lazy(() => import('@/pages/Games'))
const RookieWatch  = lazy(() => import('@/pages/RookieWatch'))
const Treasury     = lazy(() => import('@/pages/Treasury'))
const Commissioner = lazy(() => import('@/pages/Commissioner'))

function PanelLoading() {
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="font-mono text-[10px] tracking-[0.4em] text-primary-400 uppercase">LOADING SLOT</div>
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  )
}

function AppRoutes() {
  const location = useLocation()
  return (
    <Suspense fallback={<PanelLoading />}>
      <Routes location={location} key={location.pathname}>
        <Route path="/"          element={<DynastyMenu />} />
        <Route path="/watch"     element={<WatchLive />} />
        <Route path="/dynasty"   element={<DynastyHub />} />
        <Route path="/apply"     element={<RaceForSlot />} />
        <Route path="/schedule"  element={<SlotSchedule />} />
        <Route path="/games"     element={<Games />} />
        <Route path="/rookies"   element={<RookieWatch />} />
        <Route path="/treasury"  element={<Treasury />} />
        <Route path="/admin"     element={<Commissioner />} />
        <Route path="*"          element={<DynastyMenu />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <MenuShell>
        <AppRoutes />
      </MenuShell>
    </BrowserRouter>
  )
}
