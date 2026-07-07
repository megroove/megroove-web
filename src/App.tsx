import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { ToastProvider } from './components/Toast'
import HomePage from './pages/HomePage'
import BrewPage from './pages/BrewPage'
import LibraryPage from './pages/LibraryPage'
import BrewDetailPage from './pages/BrewDetailPage'
import AnalysisPage from './pages/AnalysisPage'
import StockPage from './pages/StockPage'
import CaffeinePage from './pages/CaffeinePage'
import CafeVisitPage from './pages/CafeVisitPage'
import CafeVisitDetailPage from './pages/CafeVisitDetailPage'
import SettingsPage from './pages/SettingsPage'
import BrewLayoutPage from './pages/BrewLayoutPage'
import PassportPage from './pages/PassportPage'
import OnboardingTour, { hasCompletedOnboarding } from './components/OnboardingTour'

function AppRoutes() {
  const location = useLocation()

  return (
    // pathname を key にして遷移ごとにフェードインさせる
    <div key={location.pathname} className="page-enter flex flex-col flex-1">
      <Routes>
        <Route path="/"                element={<HomePage />} />
        <Route path="/brew"            element={<BrewPage />} />
        <Route path="/brew/edit/:id"   element={<BrewPage />} />
        <Route path="/library"         element={<LibraryPage />} />
        <Route path="/library/:id"     element={<BrewDetailPage />} />
        <Route path="/analysis"        element={<AnalysisPage />} />
        <Route path="/caffeine"        element={<CaffeinePage />} />
        <Route path="/stock"           element={<StockPage />} />
        <Route path="/cafe"            element={<CafeVisitPage />} />
        <Route path="/cafe/edit/:id"   element={<CafeVisitPage />} />
        <Route path="/cafe/:id"        element={<CafeVisitDetailPage />} />
        <Route path="/settings"             element={<SettingsPage />} />
        <Route path="/settings/brew-layout" element={<BrewLayoutPage />} />
        <Route path="/passport"             element={<PassportPage />} />
      </Routes>
    </div>
  )
}

export default function App() {
  const [showTour, setShowTour] = useState(() => !hasCompletedOnboarding())

  // ブラウザ都合の IndexedDB 削除（ストレージ逼迫時の自動消去）を防ぐよう要求する
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
  }, [])

  return (
    <HashRouter>
      <ToastProvider>
      {showTour && <OnboardingTour onDone={() => setShowTour(false)} />}
      <div className="flex flex-col min-h-svh pb-[calc(4rem+env(safe-area-inset-bottom))] w-full max-w-lg mx-auto">
        <AppRoutes />
      </div>
      <BottomNav />
      </ToastProvider>
    </HashRouter>
  )
}
