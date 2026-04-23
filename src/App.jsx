import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SurveyPage from './pages/SurveyPage'
import ManagerPage from './pages/ManagerPage'
import DirectorPage from './pages/DirectorPage'
import WorkAssignment from './pages/WorkAssignment'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <main className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/survey" element={<SurveyPage />} />
            <Route path="/manager" element={<ManagerPage />} />
            <Route path="/director" element={<DirectorPage />} />
            <Route path="/assign" element={<WorkAssignment />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
