import { useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
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

export default function App() {
  const [showTour, setShowTour] = useState(() => !hasCompletedOnboarding())

  return (
    <HashRouter>
      {showTour && <OnboardingTour onDone={() => setShowTour(false)} />}
      <div className="flex flex-col min-h-svh pb-16 w-full max-w-lg mx-auto">
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
      <BottomNav />
    </HashRouter>
  )
}
