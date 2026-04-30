import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="page"><div className="empty-state">로딩 중...</div></div>
  if (!user)    return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return children
}
