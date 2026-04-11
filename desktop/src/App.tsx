// CSS Imports
import './styles/App.css'
import './styles/editer.css'
import './styles/scroll-bar.css'

// Router Imports
import { Navigate, Route, Routes } from 'react-router-dom'
import DeskTopLayout from './components/layout/DeskTopLayout'
import SetupLayout from './components/layout/SetupLayout'
import ArchivePage from './pages/desktop/ArchivePage'
import DeskTopHome from './pages/desktop/DeskTopHome'
import DiaryDetailPage from './pages/desktop/DiaryDetailPage'
import DiaryPage from './pages/desktop/DiaryPage'
import SearchPage from './pages/desktop/SearchPage'
import SettingsPage from './pages/desktop/SettingsPage'
import SetupWizard from './pages/desktop/SetupWizard'
import ThemeDemoPage from './pages/desktop/ThemeDemoPage'

// Toast
import { Toaster } from './components/ui/toaster'

// Stores
import { useServerConfig } from './hooks/useServerConfig'

function App() {
  const { isConfigured, loading: configLoading } = useServerConfig()

  if (configLoading) {
    return null
  }

  return (
    <>
      <Routes>
        {!isConfigured ? (
          <>
            <Route element={<SetupLayout />}>
              <Route path="/setup" element={<SetupWizard />} />
            </Route>
            <Route path="/theme-demo" element={<ThemeDemoPage />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </>
        ) : (
          <>
            <Route element={<DeskTopLayout className="relative" />}>
              <Route path="/" element={<DeskTopHome />} />
              <Route path="/archive" element={<ArchivePage />} />
              <Route path="/diaries" element={<DiaryPage />} />
              <Route path="/diaries/:date" element={<DiaryDetailPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="/theme-demo" element={<ThemeDemoPage />} />
            <Route element={<SetupLayout />}>
              <Route path="/setup" element={<Navigate to="/" replace />} />
            </Route>
          </>
        )}
      </Routes>
      <Toaster />
    </>
  )
}

export default App
