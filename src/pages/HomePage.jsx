import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="home-wrap">
      <div className="home-inner">
        <div className="home-header">
          <div className="home-org-logo">
            <span className="home-org-icon">🏛</span>
            <span className="home-org-name">울산경제일자리진흥원</span>
          </div>
          <h1 className="home-title">업무분장 관리 시스템</h1>
          <p className="home-sub">역할을 선택하여 시작하세요</p>
        </div>

        <div className="role-grid role-grid-4">
          <Link to="/survey" className="role-card role-employee">
            <div className="role-icon">👤</div>
            <div className="role-name">직원</div>
            <div className="role-desc">업무 난이도 의견 제출</div>
            <div className="role-arrow">→</div>
          </Link>

          <Link to="/manager" className="role-card role-manager">
            <div className="role-icon">📋</div>
            <div className="role-name">팀장</div>
            <div className="role-desc">팀 의견 취합 및 조정</div>
            <div className="role-arrow">→</div>
          </Link>

          <Link to="/director" className="role-card role-director">
            <div className="role-icon">✅</div>
            <div className="role-name">부장</div>
            <div className="role-desc">부서 현황 및 최종 확정</div>
            <div className="role-arrow">→</div>
          </Link>

          <Link to="/admin" className="role-card role-admin">
            <div className="role-icon">⚙️</div>
            <div className="role-name">관리자</div>
            <div className="role-desc">조직 구조 및 데이터 관리</div>
            <div className="role-arrow">→</div>
          </Link>
        </div>

        <div className="home-footer-note">
          부서 선택 → 팀 선택 → 이름 선택 순서로 진행됩니다
        </div>
      </div>
    </div>
  )
}
