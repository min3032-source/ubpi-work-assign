import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getWorkflowStatus } from '../lib/storage'

const STAGE_LABEL = {
  survey: '자기평가 수집 중',
  director_review: '부장 검토 대기',
  confirmed: '업무분장 확정 완료',
}

export default function HomePage() {
  const [stage, setStage] = useState('')

  useEffect(() => {
    getWorkflowStatus().then(setStage)
  }, [])

  return (
    <div className="home-wrap">
      <div className="home-inner">
        <div className="home-header">
          <h1 className="home-title">업무분장 관리</h1>
          <p className="home-sub">역할을 선택해 시작하세요</p>
          {stage && (
            <div className={`stage-badge stage-${stage}`}>
              현재 단계: {STAGE_LABEL[stage] || stage}
            </div>
          )}
        </div>

        <div className="role-grid">
          <Link to="/survey" className="role-card role-employee">
            <div className="role-icon">👤</div>
            <div className="role-name">직원</div>
            <div className="role-desc">자기평가 제출하기</div>
            <div className="role-arrow">→</div>
          </Link>

          <Link to="/manager" className="role-card role-manager">
            <div className="role-icon">📋</div>
            <div className="role-name">팀장</div>
            <div className="role-desc">평가 결과 확인 및 관리</div>
            <div className="role-arrow">→</div>
          </Link>

          <Link to="/director" className="role-card role-director">
            <div className="role-icon">✅</div>
            <div className="role-name">부장</div>
            <div className="role-desc">최종 확인 및 확정</div>
            <div className="role-arrow">→</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
