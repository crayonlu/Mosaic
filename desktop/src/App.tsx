// CSS Imports
import './styles/App.css'
import './styles/editer.css'
import './styles/scroll-bar.css'

// React
import { useEffect } from 'react'

// Router Imports
import { Routes, Route } from 'react-router-dom'
import DeskTopHome from './pages/desktop/DeskTopHome'
import ArchivePage from './pages/desktop/ArchivePage'
import SettingsPage from './pages/desktop/SettingsPage'
import SearchPage from './pages/desktop/SearchPage'

// Toast
import { Toaster } from './components/ui/toaster'

// Stores
import { useStatsStore } from './stores/stats-store'

function App() {
  const loadHeatmap = useStatsStore(state => state.loadHeatmap)

  useEffect(() => {
    loadHeatmap()
  }, [loadHeatmap])
  return (
    <>
      <Routes>
        <Route path="/" element={<DeskTopHome />} />
        <Route path="/archive" element={<ArchivePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <Toaster />
    </>
  )
}

export default App
