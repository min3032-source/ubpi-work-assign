import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getTasks, updateTask, getAssignments, getSecondaryAssignments,
  getEvaluations, getEmployees, getWorkflowStatus, setWorkflowStatus,
} from '../lib/storage'

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

export default function DirectorPage() {
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [secondaryAssignments, setSecondaryAssignments] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [employees, setEmployees] = useState([])
  const [localDiff, setLocalDiff] = useState({})
  const [stage, setStage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    async function load() {
      const [t, a, sa, e, emp, st] = await Promise.all([
        getTasks(), getAssignments(), getSecondaryAssignments(),
        getEvaluations(), getEmployees(), getWorkflowStatus(),
      ])
      setTasks(t || [])
      setAssignments(a || {})
      setSecondaryAssignments(sa || {})
      setEvaluations(e || {})
      setEmployees(emp || [])
      setStage(st || 'survey')
      const init = {}
      ;(t || []).forEach((task) => { init[task.id] = task.difficulty })
      setLocalDiff(init)
      if (st === 'confirmed') setConfirmed(true)
      setLoading(false)
    }
    load()
  }, [])

  const getEmpTasks = (name) =>
    tasks
      .filter((t) => assignments[t.id] === name || secondaryAssignments[t.id] === name)
      .map((t) => ({ ...t, role: assignments[t.id] === name ? '정담당' : '부담당' }))

  const taskOpinionAvg = (taskId) => {
    const ratings = employees
      .map((emp) => evaluations[emp.name]?.difficultyRatings?.[taskId])
      .filter((r) => r !== undefined)
    if (ratings.length === 0) return null
    return (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  }

  const handleConfirm = async () => {
    if (!window.confirm('업무분장을 최종 확정하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setSaving(true)
    const changed = tasks.filter((t) => localDiff[t.id] !== t.difficulty)
    await Promise.all(changed.map((t) => updateTask(t.id, { difficulty: localDiff[t.id] })))
    await setWorkflowStatus('confirmed')
    setSaving(false)
    setConfirmed(true)
  }

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  if (confirmed) {
    return (
      <div className="page">
        <Link to="/" className="back-link">← 메인으로</Link>
        <div className="announcement-card">
          <div className="announcement-top">
            <div className="announcement-icon">🎉</div>
            <h2>업무분장 최종 확정!</h2>
            <p>아래 내용으로 확정되었습니다</p>
          </div>
          <div className="announcement-grid">
            {employees.map((emp) => {
              const empTasks = getEmpTasks(emp.name)
              return (
                <div key={emp.id} className="announcement-emp-card">
                  <div className="announcement-emp-name">
                    {emp.name}
                    <span className="announcement-emp-meta">{emp.grade}</span>
                  </div>
                  <div className="announcement-tasks">
                    {empTasks.length === 0 ? (
                      <span className="text-muted">미배정</span>
                    ) : empTasks.map((t) => (
                      <span key={t.id} className={`ann-task-badge ${t.role === '정담당' ? 'ann-primary' : 'ann-secondary'}`}>
                        {t.name}
                        <span className="ann-role">{t.role}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const isReady = stage === 'director_review'

  return (
    <div className="page">
      <Link to="/" className="back-link">← 메인으로</Link>

      <div className="page-header">
        <h1>부장 확인화면</h1>
        <p>팀장 검토 내용을 확인하고 최종 확정해주세요</p>
      </div>

      {!isReady && (
        <div className="alert-warning">
          ⚠ 아직 팀장 승인이 완료되지 않았습니다. 팀장이 승인 후 이 화면을 사용해주세요.
        </div>
      )}

      {/* 요약 카드 */}
      <div className="summary-cards" style={{ marginBottom: 24 }}>
        <div className="summary-card">
          <div className="summary-num">{employees.filter((e) => evaluations[e.name]).length}/{employees.length}</div>
          <div className="summary-label">평가 제출</div>
        </div>
        <div className="summary-card info">
          <div className="summary-num">{tasks.length}</div>
          <div className="summary-label">전체 업무수</div>
        </div>
        <div className="summary-card">
          <div className="summary-num">{Object.keys(assignments).length + Object.keys(secondaryAssignments).length}</div>
          <div className="summary-label">배정된 업무</div>
        </div>
      </div>

      {/* 난이도 최종 결정 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>난이도 최종 결정</h2>
        <p className="step-desc">직원 의견 평균을 참고하여 난이도를 조정할 수 있습니다.</p>
        <div className="dir-task-table">
          <div className="dir-task-header-row">
            <span>업무명</span>
            <span>사업</span>
            <span>현재 난이도</span>
            <span>직원 의견 평균</span>
            <span>최종 난이도 조정</span>
          </div>
          {tasks.map((task) => {
            const avg = taskOpinionAvg(task.id)
            const lv = levelInfo(localDiff[task.id] || task.difficulty)
            const changed = localDiff[task.id] !== task.difficulty
            return (
              <div key={task.id} className={`dir-task-row ${changed ? 'changed' : ''}`}>
                <span className="dir-task-name">{task.name}</span>
                <span className="dir-task-project">{task.project}</span>
                <span>
                  <span className={`diff-level-badge ${levelInfo(task.difficulty).cls}`}>{levelInfo(task.difficulty).label}</span>
                  {task.difficulty}점
                </span>
                <span className={avg && Math.abs(avg - task.difficulty) >= 1.5 ? 'text-danger' : ''}>
                  {avg ? `${avg}점` : <span className="text-muted">-</span>}
                </span>
                <span className="dir-slider-cell">
                  <input type="range" min="1" max="5"
                    value={localDiff[task.id] || task.difficulty}
                    onChange={(e) => setLocalDiff((prev) => ({ ...prev, [task.id]: Number(e.target.value) }))}
                    className="tc-slider" style={{ width: 100 }} />
                  <span className={`diff-level-badge ${lv.cls}`}>{lv.label} {localDiff[task.id] || task.difficulty}점</span>
                  {changed && <span className="changed-badge">변경됨</span>}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 업무분장 확인 */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h2>업무분장 확인</h2>
        <div className="dir-assign-grid">
          {employees.map((emp) => {
            const empTasks = getEmpTasks(emp.name)
            return (
              <div key={emp.id} className="dir-emp-card">
                <div className="dir-emp-name">
                  {emp.name}
                  <span className="dir-emp-meta">{emp.grade} · {emp.type}</span>
                </div>
                <div className="dir-emp-tasks">
                  {empTasks.length === 0
                    ? <span className="text-muted">미배정</span>
                    : empTasks.map((t) => (
                      <span key={t.id} className={`task-pill ${t.role === '부담당' ? 'secondary' : ''}`}>
                        {t.name}<span className="pill-role">{t.role}</span>
                      </span>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 최종 확정 버튼 */}
      <div className="confirm-bar">
        <button className="btn-confirm" disabled={saving || !isReady} onClick={handleConfirm}>
          {saving ? '처리 중...' : '✅ 최종 확정하기'}
        </button>
        {!isReady && <span className="text-muted" style={{ fontSize: 13 }}>팀장 승인 후 활성화됩니다</span>}
      </div>
    </div>
  )
}
