import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import EmployeeEvaluation from './pages/EmployeeEvaluation'
import ManagerDashboard from './pages/ManagerDashboard'
import WorkAssignment from './pages/WorkAssignment'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<EmployeeEvaluation />} />
            <Route path="/manager" element={<ManagerDashboard />} />
            <Route path="/assign" element={<WorkAssignment />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
