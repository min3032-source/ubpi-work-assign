import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getTeams, getTasks, updateTask,
  getAssignments, getSecondaryAssignments,
  getEvaluations, getEmployees,
  getWorkflowStatus, setWorkflowStatus,
} from '../lib/storage'

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

export default function DirectorPage() {
  const { profile } = useAuth()

  const [teams, setTeams]           = useState([])
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [teamData, setTeamData]     = useState(null)  // { tasks, assignments, sec, evaluations, employees, stage }
  const [loading, setLoading]       = useState(true)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [localDiff, setLocalDiff]   = useState({})
  const [saving, setSaving]         = useState(false)
  const [confirmed, setConfirmed]   = useState(false)

  const deptId = profile?.teams?.departments?.id

  useEffect(() => {
    if (!deptId) return
    getTeams(deptId).then((t) => {
      setTeams(t || [])
      setLoading(false)
    })
  }, [deptId])

  const handleSelectTeam = async (team) => {
    setSelectedTeam(team)
    setConfirmed(false)
    setLoadingTeam(true)
    const [t, a, sa, ev, emp, st] = await Promise.all([
      getTasks(team.id),
      getAssignments(team.id),
      getSecondaryAssignments(team.id),
      getEvaluations(team.id),
      getEmployees(team.id),
      getWorkflowStatus(team.id),
    ])
    const tasks = t || []
    setTeamData({ tasks, assignments: a || {}, sec: sa || {}, evaluations: ev || {}, employees: emp || [], stage: st })
    const init = {}
    tasks.forEach((task) => { init[task.id] = task.difficulty })
    setLocalDiff(init)
    if (st === 'confirmed') setConfirmed(true)
    setLoadingTeam(false)
  }

  const getEmpTasks = (name) =>
    (teamData?.tasks || [])
      .filter((t) => teamData.assignments[t.id] === name || teamData.sec[t.id] === name)
      .map((t) => ({ ...t, role: teamData.assignments[t.id] === name ? '정담당' : '부담당' }))

  const taskOpinionAvg = (taskId) => {
    const emp = teamData?.employees || []
    const ratings = emp
      .map((e) => teamData.evaluations[e.name]?.difficultyRatings?.[taskId])
      .filter((r) => r !== undefined)
    if (ratings.length === 0) return null
    return (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
  }

  const handleConfirm = async () => {
    if (!window.confirm(`[${selectedTeam.name}] 업무분장을 최종 확정하시겠습니까?`)) return
    setSaving(true)
    const changed = (teamData?.tasks || []).filter((t) => localDiff[t.id] !== t.difficulty)
    await Promise.all(changed.map((t) => updateTask(t.id, { difficulty: localDiff[t.id] })))
    await setWorkflowStatus('confirmed', selectedTeam.id)
    setSaving(false)
    setConfirmed(true)
  }

  if (!profile) return null
  if (loading)  return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  const isReady = teamData?.stage === 'director_review'
  const submittedCount = teamData
    ? (teamData.employees || []).filter((e) => teamData.evaluations[e.name]).length
    : 0

  return (
    <div className="page">
      <div className="page-header">
        <h1>부장 화면</h1>
        <p>{profile.teams?.departments?.name} 소속 팀별 현황을 확인하고 최종 확정해주세요</p>
      </div>

      {/* 팀 선택 */}
      <div className="team-selector-row">
        {teams.length === 0 ? (
          <div className="empty-state">소속 팀이 없습니다. 관리자에게 문의하세요.</div>
        ) : (
          <div className="team-selector-grid">
            {teams.map((team) => (
              <button key={team.id}
                className={`team-selector-btn ${selectedTeam?.id === team.id ? 'active' : ''}`}
                onClick={() => handleSelectTeam(team)}>
                <div className="ts-name">👥 {team.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedTeam && loadingTeam && (
        <div className="empty-state">불러오는 중...</div>
      )}

      {selectedTeam && !loadingTeam && teamData && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{selectedTeam.name}</h2>
            {confirmed ? (
              <div className="badge-status success" style={{ padding: '8px 18px' }}>🎉 확정 완료</div>
            ) : (
              <button className="btn-confirm" disabled={saving || !isReady} onClick={handleConfirm}>
                {saving ? '처리 중...' : '✅ 최종 확정'}
              </button>
            )}
          </div>

          {!isReady && !confirmed && (
            <div className="alert-warning" style={{ marginBottom: 16 }}>
              ⚠ 아직 팀장 승인이 완료되지 않았습니다.
            </div>
          )}

          {/* 요약 */}
          <div className="summary-cards" style={{ marginBottom: 24 }}>
            <div className="summary-card">
              <div className="summary-num">{submittedCount}/{(teamData.employees || []).length}</div>
              <div className="summary-label">의견 제출</div>
            </div>
            <div className="summary-card info">
              <div className="summary-num">{(teamData.tasks || []).length}</div>
              <div className="summary-label">전체 업무</div>
            </div>
            <div className="summary-card">
              <div className="summary-num">
                {Object.keys(teamData.assignments).length + Object.keys(teamData.sec).length}
              </div>
              <div className="summary-label">배정된 업무</div>
            </div>
          </div>

          {/* 난이도 최종 조정 */}
          {!confirmed && (
            <div className="card" style={{ marginBottom: 20 }}>
              <h2>난이도 최종 조정</h2>
              <p className="step-desc">직원 의견 평균을 참고하여 난이도를 조정할 수 있습니다.</p>
              <div className="dir-task-table">
                <div className="dir-task-header-row">
                  <span>업무명</span><span>사업</span>
                  <span>현재 난이도</span><span>직원 의견 평균</span><span>최종 조정</span>
                </div>
                {(teamData.tasks || []).map((task) => {
                  const avg     = taskOpinionAvg(task.id)
                  const curDiff = localDiff[task.id] ?? task.difficulty
                  const lv      = levelInfo(curDiff)
                  const changed = curDiff !== task.difficulty
                  return (
                    <div key={task.id} className={`dir-task-row ${changed ? 'changed' : ''}`}>
                      <span className="dir-task-name">{task.name}</span>
                      <span className="dir-task-project">{task.project}</span>
                      <span>
                        <span className={`diff-level-badge ${levelInfo(task.difficulty).cls}`}>
                          {levelInfo(task.difficulty).label}
                        </span>
                        {task.difficulty}점
                      </span>
                      <span className={avg && Math.abs(avg - task.difficulty) >= 1.5 ? 'text-danger' : ''}>
                        {avg ? `${avg}점` : <span className="text-muted">-</span>}
                      </span>
                      <span className="dir-slider-cell">
                        <input type="range" min="1" max="5" value={curDiff}
                          onChange={(e) => setLocalDiff((p) => ({ ...p, [task.id]: Number(e.target.value) }))}
                          className="tc-slider" style={{ width: 100 }} />
                        <span className={`diff-level-badge ${lv.cls}`}>{lv.label} {curDiff}점</span>
                        {changed && <span className="changed-badge">변경됨</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 업무분장 확인 */}
          <div className="card">
            <h2>업무분장 {confirmed ? '(확정)' : '확인'}</h2>
            <div className="dir-assign-grid">
              {(teamData.employees || []).map((emp) => {
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

          {confirmed && (
            <div className="announcement-card" style={{ marginTop: 24 }}>
              <div className="announcement-top">
                <div className="announcement-icon">🎉</div>
                <h2>업무분장 최종 확정!</h2>
                <p>{selectedTeam.name} 업무분장이 확정되었습니다</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
