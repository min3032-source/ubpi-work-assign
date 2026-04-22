import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '자기평가' },
    { path: '/manager', label: '팀장 화면' },
    { path: '/assign', label: '업무분장' },
  ]

  return (
    <nav className="navbar">
      <div className="nav-brand">업무분장 관리</div>
      <div className="nav-links">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
