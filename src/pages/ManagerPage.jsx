import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getTasks, addTask, updateTask, deleteTask,
  getAssignments, getSecondaryAssignments, getEvaluations, getEmployees,
  setWorkflowStatus,
} from '../lib/storage'
import { GRADE_OPTIONS, TYPE_OPTIONS, PROJECTS } from '../lib/constants'

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

const PROJ_ORDER    = ['U-시리즈', '청년아카데미', '로컬창업', '소상공인', '마을기업', '공통업무']
const PRIORITY_LABEL = { 1: '1순위', 2: '2순위', 3: '3순위' }
const DIFF_LABELS    = ['', '매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움']

export default function ManagerPage() {
  const { profile } = useAuth()
  const navigate    = useNavigate()

  const [tasks, setTasks]                     = useState([])
  const [assignments, setAssignments]         = useState({})
  const [secondaryAssignments, setSec]        = useState({})
  const [evaluations, setEvaluations]         = useState({})
  const [employees, setEmployees]             = useState([])
  const [loading, setLoading]                 = useState(true)
  const [activeTab, setActiveTab]             = useState('submission')
  const [approving, setApproving]             = useState(false)
  const [approved, setApproved]               = useState(false)

  // 업무 관리 상태
  const [newTask, setNewTask] = useState({ name: '', project: PROJECTS[0], difficulty: 3 })
  const [showAddTask, setShowAddTask] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editTaskForm, setEditTaskForm]   = useState({})

  useEffect(() => {
    if (!profile?.team_id) return
    ;(async () => {
      const [t, a, sa, ev, emp] = await Promise.all([
        getTasks(profile.team_id),
        getAssignments(profile.team_id),
        getSecondaryAssignments(profile.team_id),
        getEvaluations(profile.team_id),
        getEmployees(profile.team_id),
      ])
      setTasks(t || [])
      setAssignments(a || {})
      setSec(sa || {})
      setEvaluations(ev || {})
      setEmployees(emp || [])
      setLoading(false)
    })()
  }, [profile])

  const submittedCount = employees.filter((e) => evaluations[e.name]).length
  const submittedPct   = employees.length > 0 ? Math.round((submittedCount / employees.length) * 100) : 0

  // 업무량 포인트 계산 (직급별 가중치)
  const gradeWeight = { 책임: 1.3, 선임: 1.0, 주임: 0.8 }
  const empPoints = employees.map((emp) => {
    const empTasks = tasks.filter(
      (t) => assignments[t.id] === emp.name || secondaryAssignments[t.id] === emp.name,
    )
    const rawPoints = empTasks.reduce(
      (s, t) => s + (t.difficulty || 3) * (secondaryAssignments[t.id] === emp.name ? 0.5 : 1),
      0,
    )
    const weight = gradeWeight[emp.grade] || 1.0
    return { emp, rawPoints, weightedPoints: rawPoints / weight, taskCount: empTasks.length }
  })
  const maxPts = Math.max(...empPoints.map((e) => e.rawPoints), 1)

  // 난이도 분석
  const taskOpinions = tasks.map((task) => {
    const opinions = employees
      .filter((emp) => evaluations[emp.name]?.difficultyRatings?.[task.id] !== undefined)
      .map((emp) => ({
        name: emp.name,
        rating: evaluations[emp.name].difficultyRatings[task.id],
        note: evaluations[emp.name].difficultyNotes?.[task.id] || '',
      }))
    if (opinions.length === 0) return null
    const avg     = opinions.reduce((s, o) => s + o.rating, 0) / opinions.length
    const isCommon = task.project === '공통업무'
    const diff    = isCommon ? 0 : Math.abs(avg - task.difficulty)
    return { task, opinions, avg, diff, isCommon }
  }).filter(Boolean).sort((a, b) => b.diff - a.diff)

  // 희망업무 분석
  const desiredByTask = tasks.map((task) => {
    const wants = { 1: [], 2: [], 3: [], other: [] }
    employees.forEach((emp) => {
      const ev = evaluations[emp.name]
      if (!ev?.desiredTasks?.includes(task.id)) return
      const p = ev.desiredTaskPriorities?.[task.id] || 0
      if (p >= 1 && p <= 3) wants[p].push(emp.name)
      else wants.other.push(emp.name)
    })
    const total = wants[1].length + wants[2].length + wants[3].length + wants.other.length
    return { task, wants, total }
  }).filter((d) => d.total > 0).sort((a, b) => b.total - a.total)

  const desiredByEmployee = employees.map((emp) => {
    const ev = evaluations[emp.name]
    if (!ev?.desiredTasks?.length) return null
    const list = ev.desiredTasks
      .map((id) => {
        const task = tasks.find((t) => t.id === id)
        return task ? { task, priority: ev.desiredTaskPriorities?.[id] || 0 } : null
      })
      .filter(Boolean)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    return { emp, list }
  }).filter(Boolean)

  const handleApprove = async () => {
    if (!window.confirm(`팀장 검토를 완료하고 부장에게 전달하시겠습니까?\n(${submittedCount}/${employees.length}명 제출)`)) return
    setApproving(true)
    await setWorkflowStatus('director_review', profile.team_id)
    setApproving(false)
    setApproved(true)
  }

  // ── 업무 CRUD ──
  const handleAddTask = async () => {
    if (!newTask.name.trim()) return
    const t = await addTask({
      id: `t${Date.now()}`,
      name: newTask.name.trim(),
      project: newTask.project,
      difficulty: newTask.difficulty,
      team_id: profile.team_id,
    })
    setTasks((p) => [...p, t])
    setNewTask({ name: '', project: PROJECTS[0], difficulty: 3 })
    setShowAddTask(false)
  }

  const handleSaveTask = async () => {
    await updateTask(editingTaskId, {
      name: editTaskForm.name,
      project: editTaskForm.project,
      difficulty: editTaskForm.difficulty,
    })
    setTasks((p) => p.map((t) => t.id === editingTaskId ? { ...t, ...editTaskForm } : t))
    setEditingTaskId(null)
  }

  const handleDeleteTask = async (id) => {
    if (!window.confirm('업무를 삭제하시겠습니까?')) return
    await deleteTask(id)
    setTasks((p) => p.filter((t) => t.id !== id))
  }

  const taskGroups = PROJ_ORDER
    .filter((p) => tasks.some((t) => t.project === p))
    .map((p) => ({ project: p, list: tasks.filter((t) => t.project === p) }))

  const TABS = [
    { key: 'submission', label: `제출 현황 (${submittedCount}/${employees.length})` },
    { key: 'difficulty', label: `난이도 분석 (${taskOpinions.length})` },
    { key: 'desired',    label: `희망업무 (${desiredByTask.length})` },
    { key: 'tasks',      label: `업무 관리 (${tasks.length})` },
    { key: 'balance',    label: '업무량 균형' },
  ]

  if (!profile) return null
  if (loading)  return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>팀장 화면</h1>
          <p>{profile.teams?.departments?.name} &gt; {profile.teams?.name}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-secondary" style={{ fontSize: 13 }}
            onClick={() => navigate(`/assign?teamId=${profile.team_id}`)}>
            업무 배정 →
          </button>
          {approved ? (
            <div className="badge-status success" style={{ padding: '8px 16px' }}>✅ 부장에게 전달 완료</div>
          ) : (
            <button className="btn-approve" disabled={approving} onClick={handleApprove}>
              {approving ? '처리 중...' : '✅ 부장에게 전달'}
            </button>
          )}
        </div>
      </div>

      {submittedCount < employees.length && !approved && (
        <div className="alert-warning">
          ⚠ {employees.length - submittedCount}명이 아직 의견을 제출하지 않았습니다.
        </div>
      )}

      <div className="tabs">
        {TABS.map((tab) => (
          <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭1: 제출 현황 */}
      {activeTab === 'submission' && (
        <div className="section-body">
          <div className="progress-section">
            <div className="progress-header">
              <span className="progress-label">{submittedCount}/{employees.length}명 제출 완료</span>
              <span className="progress-pct">{submittedPct}%</span>
            </div>
            <div className="progress-bar-wrap">
              <div className="progress-fill" style={{ width: `${submittedPct}%` }} />
            </div>
          </div>
          <div className="emp-status-list">
            {employees.map((emp) => {
              const ev = evaluations[emp.name]
              return (
                <div key={emp.id} className={`emp-status-row ${ev ? 'submitted' : 'pending'}`}>
                  <div className="emp-status-info">
                    <span className="emp-status-name">{emp.name}</span>
                    <span className="emp-status-meta">{emp.grade} · {emp.type}</span>
                  </div>
                  <div className="emp-status-right">
                    {ev ? (
                      <>
                        <span className="badge-status success">제출완료</span>
                        <span className="emp-status-date">
                          {ev.submittedAt ? new Date(ev.submittedAt).toLocaleDateString('ko-KR') : ''}
                        </span>
                      </>
                    ) : (
                      <span className="badge-status pending">미제출</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 탭2: 난이도 분석 */}
      {activeTab === 'difficulty' && (
        <div className="section-body">
          {taskOpinions.length === 0 ? (
            <div className="empty-state">아직 제출된 난이도 의견이 없습니다</div>
          ) : (
            <div className="opinion-list">
              {taskOpinions.map(({ task, opinions, avg, diff, isCommon }) => {
                const lv    = task.difficulty ? levelInfo(task.difficulty) : null
                const isBig = !isCommon && diff >= 1.5
                return (
                  <div key={task.id} className={`opinion-card ${isBig ? 'big-diff' : ''}`}>
                    <div className="opinion-card-header">
                      <div className="opinion-task-info">
                        <span className="opinion-task-name">{task.name}</span>
                        <span className="opinion-project">{task.project}</span>
                      </div>
                      <div className="opinion-scores">
                        {!isCommon && lv && (
                          <>
                            <div className="opinion-score-item">
                              <span className="opinion-score-label">팀장 설정</span>
                              <span className="opinion-score-val">
                                <span className={`diff-level-badge ${lv.cls}`}>{lv.label}</span>
                                {task.difficulty}점
                              </span>
                            </div>
                            <div className="opinion-arrow">→</div>
                          </>
                        )}
                        <div className="opinion-score-item">
                          <span className="opinion-score-label">직원 평균</span>
                          <span className={`opinion-score-val ${isBig ? 'text-danger' : ''}`}>
                            {avg.toFixed(1)}점
                            {isBig && <span className="opinion-gap-badge">⚠ {diff.toFixed(1)}점 차이</span>}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="opinion-employees">
                      {opinions.map((o) => (
                        <div key={o.name} className="opinion-emp-row">
                          <span className="opinion-emp-name">{o.name}</span>
                          <span className="opinion-emp-rating">{o.rating}점</span>
                          {o.note && <span className="opinion-emp-note">"{o.note}"</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 탭3: 희망업무 */}
      {activeTab === 'desired' && (
        <div className="section-body">
          {desiredByTask.length === 0 ? (
            <div className="empty-state">아직 제출된 희망업무가 없습니다</div>
          ) : (
            <>
              <h3 className="section-sub-title">업무별 희망 현황</h3>
              <div className="desired-overview">
                {desiredByTask.map(({ task, wants }) => {
                  const hasConflict = wants[1].length > 1 || wants[2].length > 1 || wants[3].length > 1
                  return (
                    <div key={task.id} className={`desired-stat-card ${hasConflict ? 'conflict' : ''}`}>
                      <div className="desired-stat-top">
                        <span className="desired-task-name">{task.name}</span>
                        <span className="desired-project-tag">{task.project}</span>
                        {hasConflict && <span className="conflict-badge">중복 신청</span>}
                      </div>
                      {[1, 2, 3].map((p) => wants[p].length > 0 && (
                        <div key={p} className="desired-priority-row">
                          <span className={`priority-badge p${p}`}>{PRIORITY_LABEL[p]}</span>
                          <span className="priority-names">{wants[p].join(', ')}</span>
                          {wants[p].length > 1 && <span className="conflict-count">⚠ {wants[p].length}명</span>}
                        </div>
                      ))}
                      {wants.other.length > 0 && (
                        <div className="desired-priority-row">
                          <span className="priority-badge p0">순위 없음</span>
                          <span className="priority-names">{wants.other.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <h3 className="section-sub-title" style={{ marginTop: 28 }}>직원별 희망업무</h3>
              <div className="emp-desired-list">
                {desiredByEmployee.map(({ emp, list }) => (
                  <div key={emp.id} className="emp-desired-row">
                    <div className="emp-desired-name">{emp.name}</div>
                    <div className="emp-desired-tasks">
                      {list.map(({ task, priority }) => (
                        <span key={task.id} className="emp-desired-chip">
                          {task.name}
                          {priority > 0 && <span className={`priority-badge p${priority}`}>{PRIORITY_LABEL[priority]}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 탭4: 업무 관리 */}
      {activeTab === 'tasks' && (
        <div className="section-body">
          <div className="mgmt-header">
            <span className="mgmt-count">전체 {tasks.length}개 업무</span>
            <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}
              onClick={() => setShowAddTask((v) => !v)}>
              + 업무 추가
            </button>
          </div>

          {showAddTask && (
            <div className="admin-form-card" style={{ marginBottom: 16 }}>
              <div className="form-row">
                <input className="form-input" placeholder="업무명"
                  value={newTask.name}
                  onChange={(e) => setNewTask((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()} />
                <select className="form-select" value={newTask.project}
                  onChange={(e) => setNewTask((p) => ({ ...p, project: e.target.value }))}>
                  {[...PROJECTS, '공통업무'].map((p) => <option key={p}>{p}</option>)}
                </select>
                <select className="form-select" value={newTask.difficulty}
                  onChange={(e) => setNewTask((p) => ({ ...p, difficulty: Number(e.target.value) }))}>
                  {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}점 - {DIFF_LABELS[n]}</option>)}
                </select>
                <button className="btn-sm primary" onClick={handleAddTask}>추가</button>
                <button className="btn-sm" onClick={() => setShowAddTask(false)}>취소</button>
              </div>
            </div>
          )}

          {taskGroups.map(({ project, list }) => (
            <div key={project} style={{ marginBottom: 16 }}>
              <div className="org-dept-label">{project}</div>
              <div className="emp-status-list">
                {list.map((task) => (
                  <div key={task.id} className="emp-status-row">
                    {editingTaskId === task.id ? (
                      <>
                        <div className="form-row" style={{ flex: 1 }}>
                          <input className="inline-input" value={editTaskForm.name}
                            onChange={(e) => setEditTaskForm((p) => ({ ...p, name: e.target.value }))} />
                          <select className="inline-select" value={editTaskForm.project}
                            onChange={(e) => setEditTaskForm((p) => ({ ...p, project: e.target.value }))}>
                            {[...PROJECTS, '공통업무'].map((p) => <option key={p}>{p}</option>)}
                          </select>
                          <select className="inline-select" value={editTaskForm.difficulty}
                            onChange={(e) => setEditTaskForm((p) => ({ ...p, difficulty: Number(e.target.value) }))}>
                            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}점</option>)}
                          </select>
                        </div>
                        <div className="action-btns">
                          <button className="btn-sm primary" onClick={handleSaveTask}>저장</button>
                          <button className="btn-sm" onClick={() => setEditingTaskId(null)}>취소</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="emp-status-info">
                          <span className="emp-status-name">{task.name}</span>
                          <span className={`diff-level-badge ${levelInfo(task.difficulty).cls}`}>
                            {levelInfo(task.difficulty).label} {task.difficulty}점
                          </span>
                        </div>
                        <div className="action-btns">
                          <button className="btn-sm" onClick={() => {
                            setEditingTaskId(task.id)
                            setEditTaskForm({ name: task.name, project: task.project, difficulty: task.difficulty })
                          }}>수정</button>
                          <button className="btn-sm danger" onClick={() => handleDeleteTask(task.id)}>삭제</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 탭5: 업무량 균형 */}
      {activeTab === 'balance' && (
        <div className="section-body">
          <div className="card">
            <h2>업무량 균형 분석</h2>
            <p className="step-desc" style={{ marginBottom: 20 }}>
              직급별 가중치 적용 — 책임 ×1.3 / 선임 ×1.0 / 주임 ×0.8
            </p>
            <div className="balance-chart">
              {empPoints.map(({ emp, rawPoints, weightedPoints, taskCount }) => {
                const pct   = maxPts > 0 ? (rawPoints / maxPts) * 100 : 0
                const level = pct > 75 ? 'high' : pct > 0 ? 'normal' : 'empty'
                return (
                  <div key={emp.id} className="balance-row">
                    <div className="balance-name">
                      <span className="b-name">{emp.name}</span>
                      <span className="b-type">{emp.grade}</span>
                    </div>
                    <div className="balance-bar-wrap">
                      <div className={`balance-bar bar-${level}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="balance-stats">
                      <span>{taskCount}개</span>
                      <span className="b-score">난이도합 {rawPoints}</span>
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        가중 {weightedPoints.toFixed(1)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="balance-legend">
              <span><span className="dot bar-high" /> 높음</span>
              <span><span className="dot bar-normal" /> 적정</span>
              <span><span className="dot bar-empty" /> 미배정</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
