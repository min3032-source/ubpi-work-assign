import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ROLE_LABELS = { admin: '관리자', director: '부장', manager: '팀장', employee: '팀원' }
const ROLE_COLORS = { admin: 'role-admin', director: 'role-director', manager: 'role-manager', employee: 'role-employee' }

export default function Navbar() {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (!user || location.pathname === '/login') return null

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <nav className="navbar">
      <div className="nav-brand">🏛 울산경제일자리진흥원 업무분장</div>

      <div style={{ flex: 1 }} />

      {profile && (
        <div className="nav-user">
          <span className={`nav-role-badge ${ROLE_COLORS[profile.role] || ''}`}>
            {ROLE_LABELS[profile.role] || profile.role}
          </span>
          <span className="nav-user-name">
            {profile.name}
            {profile.teams && (
              <span className="nav-team-info">
                &nbsp;·&nbsp;{profile.teams.departments?.name} {profile.teams.name}
              </span>
            )}
          </span>
          <button className="nav-logout-btn" onClick={handleSignOut}>로그아웃</button>
        </div>
      )}
    </nav>
  )
}
