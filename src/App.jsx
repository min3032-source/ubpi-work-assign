import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRedirect from './components/RoleRedirect'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import ChangePasswordPage from './pages/ChangePasswordPage'
import EmployeePage from './pages/EmployeePage'
import ManagerPage from './pages/ManagerPage'
import DirectorPage from './pages/DirectorPage'
import AdminPage from './pages/AdminPage'
import WorkAssignment from './pages/WorkAssignment'
import ProjectPage from './pages/ProjectPage'
import WorkPoolPage from './pages/WorkPoolPage'
import WorkAssignPage from './pages/WorkAssignPage'
import WorkStatusPage from './pages/WorkStatusPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <Navbar />
          <main className="main-content">
            <Routes>
              <Route path="/login"           element={<LoginPage />} />
              <Route path="/change-password" element={<ChangePasswordPage />} />
              <Route path="/"               element={<RoleRedirect />} />
              <Route path="/employee" element={
                <ProtectedRoute roles={['employee']}>
                  <EmployeePage />
                </ProtectedRoute>
              } />
              <Route path="/manager"  element={
                <ProtectedRoute roles={['manager']}>
                  <ManagerPage />
                </ProtectedRoute>
              } />
              <Route path="/director" element={
                <ProtectedRoute roles={['director']}>
                  <DirectorPage />
                </ProtectedRoute>
              } />
              <Route path="/admin"    element={
                <ProtectedRoute roles={['admin']}>
                  <AdminPage />
                </ProtectedRoute>
              } />
              <Route path="/assign"   element={
                <ProtectedRoute roles={['manager', 'admin']}>
                  <WorkAssignment />
                </ProtectedRoute>
              } />
              <Route path="/projects" element={
                <ProtectedRoute roles={['manager', 'director', 'admin']}>
                  <ProjectPage />
                </ProtectedRoute>
              } />
              <Route path="/workpool" element={
                <ProtectedRoute>
                  <WorkPoolPage />
                </ProtectedRoute>
              } />
              <Route path="/workassign" element={
                <ProtectedRoute roles={['manager', 'admin']}>
                  <WorkAssignPage />
                </ProtectedRoute>
              } />
              <Route path="/workstatus" element={
                <ProtectedRoute>
                  <WorkStatusPage />
                </ProtectedRoute>
              } />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
