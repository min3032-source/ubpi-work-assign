import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getTasks, getAssignments, getSecondaryAssignments,
  getEvaluations, getEmployees, setWorkflowStatus,
  addEmployee, updateEmployee, deleteEmployee,
} from '../lib/storage'
import { GRADE_OPTIONS, TYPE_OPTIONS, COMMON_TASKS } from '../lib/constants'

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

const PRIORITY_LABEL = { 1: '1순위', 2: '2순위', 3: '3순위' }

export default function ManagerPage() {
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [secondaryAssignments, setSecondaryAssignments] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [employees, setEmployees] = useState([])
  const [activeTab, setActiveTab] = useState('submission')
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  // 직원 관리 상태
  const [showAddForm, setShowAddForm] = useState(false)
  const [newEmp, setNewEmp] = useState({ name: '', grade: '선임', type: '정규직' })
  const [editingEmpId, setEditingEmpId] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => {
    async function load() {
      const [t, a, sa, e, emp] = await Promise.all([
        getTasks(), getAssignments(), getSecondaryAssignments(), getEvaluations(), getEmployees(),
      ])
      setTasks(t || [])
      setAssignments(a || {})
      setSecondaryAssignments(sa || {})
      setEvaluations(e || {})
      setEmployees(emp || [])
      setLoading(false)
    }
    load()
  }, [])

  const submittedCount = employees.filter((e) => evaluations[e.name]).length
  const submittedPct = employees.length > 0 ? Math.round((submittedCount / employees.length) * 100) : 0

  // 탭2: 업무별 난이도 의견 분석 (전체 업무 + 공통업무)
  const taskOpinions = [
    ...tasks.map((task) => {
      const opinions = employees
        .filter((emp) => evaluations[emp.name]?.difficultyRatings?.[task.id] !== undefined)
        .map((emp) => ({
          name: emp.name,
          rating: evaluations[emp.name].difficultyRatings[task.id],
          note: evaluations[emp.name].difficultyNotes?.[task.id] || '',
        }))
      if (opinions.length === 0) return null
      const avg = opinions.reduce((s, o) => s + o.rating, 0) / opinions.length
      const diff = Math.abs(avg - task.difficulty)
      return { task, opinions, avg, diff, isCommon: false }
    }),
    ...COMMON_TASKS.map((ct) => {
      const opinions = employees
        .filter((emp) => evaluations[emp.name]?.difficultyRatings?.[ct.id] !== undefined)
        .map((emp) => ({
          name: emp.name,
          rating: evaluations[emp.name].difficultyRatings[ct.id],
          note: evaluations[emp.name].difficultyNotes?.[ct.id] || '',
        }))
      if (opinions.length === 0) return null
      const avg = opinions.reduce((s, o) => s + o.rating, 0) / opinions.length
      return { task: { ...ct, difficulty: null }, opinions, avg, diff: 0, isCommon: true }
    }),
  ].filter(Boolean).sort((a, b) => b.diff - a.diff)

  // 탭3: 희망업무 현황 (전체 업무 + 공통업무)
  const allTasksForDesired = [
    ...tasks,
    ...COMMON_TASKS.map((ct) => ({ ...ct, difficulty: null })),
  ]

  const desiredByTask = allTasksForDesired.map((task) => {
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
      .map((taskId) => {
        const task = allTasksForDesired.find((t) => t.id === taskId)
        return { task, priority: ev.desiredTaskPriorities?.[taskId] || 0 }
      })
      .filter((d) => d.task)
      .sort((a, b) => (a.priority || 99) - (b.priority || 99))
    return { emp, list }
  }).filter(Boolean)

  const handleApprove = async () => {
    if (!window.confirm(`팀장 검토를 완료하고 부장에게 전달하시겠습니까?\n(${submittedCount}/${employees.length}명 의견 제출 완료)`)) return
    setApproving(true)
    await setWorkflowStatus('director_review')
    setApproving(false)
    setApproved(true)
  }

  // 직원 관리 핸들러
  const handleAddEmp = async () => {
    if (!newEmp.name.trim()) return
    const added = await addEmployee({ name: newEmp.name.trim(), grade: newEmp.grade, type: newEmp.type })
    setEmployees((prev) => [...prev, added])
    setNewEmp({ name: '', grade: '선임', type: '정규직' })
    setShowAddForm(false)
  }

  const handleStartEdit = (emp) => {
    setEditingEmpId(emp.id)
    setEditForm({ name: emp.name, grade: emp.grade, type: emp.type })
  }

  const handleSaveEdit = async () => {
    await updateEmployee(editingEmpId, editForm)
    setEmployees((prev) => prev.map((e) => e.id === editingEmpId ? { ...e, ...editForm } : e))
    setEditingEmpId(null)
  }

  const handleDeleteEmp = async (id) => {
    if (!window.confirm('직원을 삭제하시겠습니까?')) return
    await deleteEmployee(id)
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  const TABS = [
    { key: 'submission', label: `의견 현황 (${submittedCount}/${employees.length})` },
    { key: 'difficulty', label: `난이도 분석 (${taskOpinions.length})` },
    { key: 'desired', label: `희망업무 (${desiredByTask.length})` },
    { key: 'employees', label: '직원 관리' },
  ]

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  return (
    <div className="page">
      <Link to="/" className="back-link">← 메인으로</Link>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>팀장 관리화면</h1>
          <p>업무 난이도 의견 결과를 확인하세요</p>
        </div>
        {approved ? (
          <div className="badge-status success" style={{ padding: '10px 18px', fontSize: 14 }}>✅ 부장에게 전달 완료</div>
        ) : (
          <button className="btn-approve" disabled={approving} onClick={handleApprove}>
            {approving ? '처리 중...' : '✅ 팀장 승인 → 부장에게 전달'}
          </button>
        )}
      </div>

      {submittedCount < employees.length && !approved && (
        <div className="alert-warning">
          ⚠ {employees.length - submittedCount}명이 아직 의견을 제출하지 않았습니다.
        </div>
      )}

      <div className="tabs">
        {TABS.map((tab) => (
          <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 탭1: 의견 현황 */}
      {activeTab === 'submission' && (
        <div className="section-body">
          <div className="progress-section">
            <div className="progress-header">
              <span className="progress-label">{submittedCount}/{employees.length}명 의견 제출 완료</span>
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

      {/* 탭2: 난이도 의견 분석 */}
      {activeTab === 'difficulty' && (
        <div className="section-body">
          {taskOpinions.length === 0 ? (
            <div className="empty-state">아직 제출된 난이도 의견이 없습니다</div>
          ) : (
            <div className="opinion-list">
              {taskOpinions.map(({ task, opinions, avg, diff, isCommon }) => {
                const lv = task.difficulty ? levelInfo(task.difficulty) : null
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

      {/* 탭3: 희망업무 현황 */}
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

              <h3 className="section-sub-title" style={{ marginTop: 28 }}>직원별 희망업무 목록</h3>
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

      {/* 탭4: 직원 관리 */}
      {activeTab === 'employees' && (
        <div className="section-body">
          <div className="mgmt-header">
            <span className="mgmt-count">전체 {employees.length}명</span>
            <button
              className="btn-primary"
              style={{ fontSize: 13, padding: '7px 14px' }}
              onClick={() => { setShowAddForm(!showAddForm); setEditingEmpId(null) }}>
              + 직원 추가
            </button>
          </div>

          {showAddForm && (
            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14 }}>
              <div className="form-row">
                <input
                  className="form-input"
                  placeholder="이름"
                  value={newEmp.name}
                  onChange={(e) => setNewEmp((prev) => ({ ...prev, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmp()}
                />
                <select className="form-select" value={newEmp.grade}
                  onChange={(e) => setNewEmp((prev) => ({ ...prev, grade: e.target.value }))}>
                  {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="form-select" value={newEmp.type}
                  onChange={(e) => setNewEmp((prev) => ({ ...prev, type: e.target.value }))}>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn-sm primary" onClick={handleAddEmp}>추가</button>
                <button className="btn-sm" onClick={() => setShowAddForm(false)}>취소</button>
              </div>
            </div>
          )}

          <div className="emp-status-list">
            {employees.map((emp) => (
              <div key={emp.id} className="emp-status-row">
                {editingEmpId === emp.id ? (
                  <>
                    <div className="emp-status-info" style={{ flex: 1, gap: 8, flexWrap: 'wrap' }}>
                      <input
                        className="inline-input"
                        style={{ width: 80 }}
                        value={editForm.name}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                      <select className="inline-select" value={editForm.grade}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, grade: e.target.value }))}>
                        {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                      <select className="inline-select" value={editForm.type}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value }))}>
                        {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="action-btns">
                      <button className="btn-sm primary" onClick={handleSaveEdit}>저장</button>
                      <button className="btn-sm" onClick={() => setEditingEmpId(null)}>취소</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="emp-status-info">
                      <span className="emp-status-name">{emp.name}</span>
                      <span className="emp-status-meta">{emp.grade} · {emp.type}</span>
                    </div>
                    <div className="action-btns">
                      <button className="btn-sm" onClick={() => handleStartEdit(emp)}>수정</button>
                      <button className="btn-sm danger" onClick={() => handleDeleteEmp(emp.id)}>삭제</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
