import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'
import HomePage from './pages/HomePage'
import BrewPage from './pages/BrewPage'
import LibraryPage from './pages/LibraryPage'
import BrewDetailPage from './pages/BrewDetailPage'
import AnalysisPage from './pages/AnalysisPage'
import BeanAnalysisPage from './pages/BeanAnalysisPage'
import StockPage from './pages/StockPage'
import CaffeinePage from './pages/CaffeinePage'
import CafeVisitPage from './pages/CafeVisitPage'
import CafeVisitDetailPage from './pages/CafeVisitDetailPage'
import SettingsPage from './pages/SettingsPage'
import BrewLayoutPage from './pages/BrewLayoutPage'
import DataProvisionPage from './pages/DataProvisionPage'
import PrivacyPage from './pages/PrivacyPage'
import PassportPage from './pages/PassportPage'
import OnboardingTour, { hasCompletedOnboarding } from './components/OnboardingTour'

function AppRoutes() {
  const location = useLocation()

  return (
    // pathname を key にして遷移ごとにフェードインさせる。
    // ErrorBoundary も内側に置くことで、ある画面が落ちても別タブに移れば自動復帰する。
    // min-h-0 で、各ページの内部スクロール（overflow-y-auto）が固定高フレックス内で効くようにする。
    <div key={location.pathname} className="page-enter flex flex-col flex-1 min-h-0">
      <ErrorBoundary>
      <Routes>
        <Route path="/"                element={<HomePage />} />
        <Route path="/brew"            element={<BrewPage />} />
        <Route path="/brew/edit/:id"   element={<BrewPage />} />
        <Route path="/library"         element={<LibraryPage />} />
        <Route path="/library/:id"     element={<BrewDetailPage />} />
        <Route path="/analysis"          element={<AnalysisPage />} />
        <Route path="/analysis/bean/:id" element={<BeanAnalysisPage />} />
        <Route path="/caffeine"        element={<CaffeinePage />} />
        <Route path="/stock"           element={<StockPage />} />
        <Route path="/cafe"            element={<CafeVisitPage />} />
        <Route path="/cafe/edit/:id"   element={<CafeVisitPage />} />
        <Route path="/cafe/:id"        element={<CafeVisitDetailPage />} />
        <Route path="/settings"             element={<SettingsPage />} />
        <Route path="/settings/brew-layout"    element={<BrewLayoutPage />} />
        <Route path="/settings/data-provision" element={<DataProvisionPage />} />
        <Route path="/settings/privacy"        element={<PrivacyPage />} />
        <Route path="/passport"             element={<PassportPage />} />
      </Routes>
      </ErrorBoundary>
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
      {/* app-shell: 高さ100dvh の縦フレックス。中身(flex-1 で内部スクロール) ＋ フッター(通常フロー最下段)。
          フッターを fixed から外すことで、短いページでも常に画面最下部に接地する。 */}
      <div
        className="flex flex-col h-full"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <div className="flex-1 min-h-0 w-full max-w-lg mx-auto flex flex-col">
          <AppRoutes />
        </div>
        <BottomNav />
      </div>
      </ToastProvider>
    </HashRouter>
  )
}
