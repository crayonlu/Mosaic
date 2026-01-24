// CSS Imports
import './styles/App.css'
import './styles/editer.css'
import './styles/scroll-bar.css'

// React
import { useEffect } from 'react'

// Router Imports
import { Navigate, Route, Routes } from 'react-router-dom'
import ArchivePage from './pages/desktop/ArchivePage'
import DeskTopHome from './pages/desktop/DeskTopHome'
import DiaryDetailPage from './pages/desktop/DiaryDetailPage'
import DiaryPage from './pages/desktop/DiaryPage'
import SearchPage from './pages/desktop/SearchPage'
import SettingsPage from './pages/desktop/SettingsPage'
import SetupWizard from './pages/desktop/SetupWizard'

// Toast
import { Toaster } from './components/ui/toaster'

// Stores
import { useServerConfig } from './hooks/use-server-config'
import { useStatsStore } from './stores/stats-store'

function App() {
  const loadHeatmap = useStatsStore(state => state.loadHeatmap)
  const { isConfigured, loading: configLoading, checkConfig } = useServerConfig()
  useEffect(() => {
    loadHeatmap()
  }, [loadHeatmap])

  if (configLoading) {
    return null
  }

  return (
    <>
      <Routes>
        {!isConfigured ? (
          <>
            <Route path="/setup" element={<SetupWizard />} />
            <Route path="*" element={<Navigate to="/setup" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<DeskTopHome />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/diaries" element={<DiaryPage />} />
            <Route path="/diaries/:date" element={<DiaryDetailPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/setup" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
      <Toaster />
    </>
  )
}

export default App
