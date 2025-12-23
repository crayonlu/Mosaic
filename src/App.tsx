// CSS Imports
import './styles/App.css'
import './styles/editer.css'
import './styles/scroll-bar.css'

// Router Imports
import { Routes, Route } from 'react-router-dom'
import DeskTopHome from './pages/desktop/DeskTopHome'
import SettingsPage from './pages/desktop/SettingsPage'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<DeskTopHome />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </>
  )
}

export default App
