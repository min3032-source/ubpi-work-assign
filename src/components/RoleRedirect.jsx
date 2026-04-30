import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ROLE_ROUTES = {
  admin:    '/admin',
  director: '/director',
  manager:  '/manager',
  employee: '/employee',
}

export default function RoleRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) return <div className="page"><div className="empty-state">로딩 중...</div></div>
  if (!user || !profile) return <Navigate to="/login" replace />

  return <Navigate to={ROLE_ROUTES[profile.role] || '/login'} replace />
}
