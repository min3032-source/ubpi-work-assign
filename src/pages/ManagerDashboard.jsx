import { useState, useEffect } from 'react'
import { GRADE_OPTIONS, TYPE_OPTIONS, PROJECTS } from '../lib/constants'
import {
  getTasks, addTask, updateTask, deleteTask,
  getAssignments, getEvaluations,
  getEmployees, addEmployee, updateEmployee, deleteEmployee,
} from '../lib/storage'

const DIFF_LABELS = ['', '쉬움', '보통', '어려움', '매우 어려움', '최고']

export default function ManagerDashboard() {
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [employees, setEmployees] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  // Employee form state
  const [showAddEmp, setShowAddEmp] = useState(false)
  const [empForm, setEmpForm] = useState({ name: '', grade: '선임', type: '정규직' })
  const [editingEmp, setEditingEmp] = useState(null)

  // Task management state
  const [selectedProject, setSelectedProject] = useState(PROJECTS[0])
  const [showAddTaskForm, setShowAddTaskForm] = useState(false)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskDiff, setNewTaskDiff] = useState(2)
  const [editingTask, setEditingTask] = useState(null)

  useEffect(() => {
    async function load() {
      const [t, a, e, emp] = await Promise.all([
        getTasks(), getAssignments(), getEvaluations(), getEmployees(),
      ])
      setTasks(t || [])
      setAssignments(a || {})
      setEvaluations(e || {})
      setEmployees(emp || [])
      setLoading(false)
    }
    load()
  }, [])

  const getEmpTasks = (name) => tasks.filter((t) => assignments[t.id] === name)
  const submittedCount = employees.filter((e) => evaluations[e.name]).length

  const disagreements = []
  employees.forEach((emp) => {
    const ev = evaluations[emp.name]
    if (!ev) return
    getEmpTasks(emp.name).forEach((task) => {
      const empRating = ev.difficultyRatings?.[task.id]
      if (empRating === undefined) return
      const gap = empRating - task.difficulty
      if (Math.abs(gap) >= 2) {
        disagreements.push({ employee: emp.name, task: task.name, managerDiff: task.difficulty, empDiff: empRating, gap })
      }
    })
  })

  const desiredTaskMap = {}
  employees.forEach((emp) => {
    const ev = evaluations[emp.name]
    if (!ev?.desiredTasks) return
    ev.desiredTasks.forEach((taskId) => {
      if (!desiredTaskMap[taskId]) desiredTaskMap[taskId] = []
      desiredTaskMap[taskId].push(emp.name)
    })
  })

  // ── Employee CRUD ──
  const handleAddEmp = async () => {
    if (!empForm.name.trim()) return
    const created = await addEmployee({ name: empForm.name.trim(), grade: empForm.grade, type: empForm.type })
    setEmployees((prev) => [...prev, created])
    setEmpForm({ name: '', grade: '선임', type: '정규직' })
    setShowAddEmp(false)
  }

  const handleUpdateEmp = async () => {
    if (!editingEmp?.name.trim()) return
    await updateEmployee(editingEmp.id, { name: editingEmp.name, grade: editingEmp.grade, type: editingEmp.type })
    setEmployees((prev) => prev.map((e) => (e.id === editingEmp.id ? editingEmp : e)))
    setEditingEmp(null)
  }

  const handleDeleteEmp = async (id) => {
    if (!window.confirm('직원을 삭제하시겠습니까?')) return
    await deleteEmployee(id)
    setEmployees((prev) => prev.filter((e) => e.id !== id))
  }

  // ── Task CRUD ──
  const handleAddTask = async () => {
    if (!newTaskName.trim()) return
    const task = { id: `t${Date.now()}`, name: newTaskName.trim(), difficulty: newTaskDiff, project: selectedProject }
    const created = await addTask(task)
    setTasks((prev) => [...prev, created])
    setNewTaskName('')
    setNewTaskDiff(2)
    setShowAddTaskForm(false)
  }

  const handleUpdateTask = async () => {
    if (!editingTask?.name.trim()) return
    await updateTask(editingTask.id, { name: editingTask.name, difficulty: editingTask.difficulty })
    setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? { ...t, ...editingTask } : t)))
    setEditingTask(null)
  }

  const handleDeleteTask = async (id) => {
    if (!window.confirm('업무를 삭제하시겠습니까?')) return
    await deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const projectTasks = tasks.filter((t) => t.project === selectedProject)

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  const TABS = [
    { key: 'overview', label: '전체 현황' },
    { key: 'disagreements', label: `난이도 이견 (${disagreements.length})` },
    { key: 'desired', label: '희망업무 취합' },
    { key: 'employees', label: `직원 관리 (${employees.length})` },
    { key: 'tasks', label: '업무 관리' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1>팀장 관리화면</h1>
        <p>전체 평가 현황 및 업무 이견을 확인하세요</p>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-num">{submittedCount}/{employees.length}</div>
          <div className="summary-label">평가 제출</div>
        </div>
        <div className="summary-card warning">
          <div className="summary-num">{disagreements.length}</div>
          <div className="summary-label">난이도 이견</div>
        </div>
        <div className="summary-card info">
          <div className="summary-num">{Object.keys(desiredTaskMap).length}</div>
          <div className="summary-label">희망업무 종류</div>
        </div>
        <div className="summary-card">
          <div className="summary-num">{tasks.length}</div>
          <div className="summary-label">전체 업무수</div>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 전체 현황 */}
      {activeTab === 'overview' && (
        <div className="table-wrap">
          <table className="overview-table">
            <thead>
              <tr><th>직원명</th><th>직급 / 유형</th><th>배정 업무</th><th>평가 제출</th><th>평균 이견</th></tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const empTasks = getEmpTasks(emp.name)
                const ev = evaluations[emp.name]
                const avgGap = ev
                  ? (() => {
                      const gaps = empTasks.map((t) => {
                        const r = ev.difficultyRatings?.[t.id]
                        return r !== undefined ? Math.abs(r - t.difficulty) : null
                      }).filter((g) => g !== null)
                      return gaps.length > 0 ? (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1) : '0.0'
                    })()
                  : null
                return (
                  <tr key={emp.id}>
                    <td><strong>{emp.name}</strong></td>
                    <td>
                      <div className="emp-meta-cell">
                        <span>{emp.grade}</span>
                        <span className={`badge ${emp.type === '계약직' ? 'contract' : emp.type === '육아휴직대체' ? 'parental' : 'regular'}`}>{emp.type}</span>
                      </div>
                    </td>
                    <td>
                      <div className="task-pills">
                        {empTasks.length === 0 ? <span className="no-tasks">미배정</span>
                          : empTasks.map((t) => <span key={t.id} className="task-pill">{t.name}</span>)}
                      </div>
                    </td>
                    <td>
                      {ev ? <span className="badge-status success">제출완료</span>
                        : <span className="badge-status pending">미제출</span>}
                    </td>
                    <td>
                      {avgGap !== null
                        ? <span className={Number(avgGap) >= 2 ? 'text-warning' : ''}>{avgGap}점</span>
                        : <span className="text-muted">-</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 난이도 이견 */}
      {activeTab === 'disagreements' && (
        <div className="section-body">
          {disagreements.length === 0 ? (
            <div className="empty-state">난이도 이견이 없습니다 🎉</div>
          ) : (
            <div className="disagreement-list">
              {disagreements.map((d, i) => (
                <div key={i} className="disagreement-card">
                  <div className="disagreement-header">
                    <strong>{d.employee}</strong>
                    <span className="disagreement-task">{d.task}</span>
                  </div>
                  <div className="diff-compare">
                    <div className="diff-item"><div className="diff-label">팀장 설정</div><div className="diff-value manager">{d.managerDiff}점</div></div>
                    <div className="diff-arrow">→</div>
                    <div className="diff-item"><div className="diff-label">직원 평가</div><div className={`diff-value ${d.gap > 0 ? 'higher' : 'lower'}`}>{d.empDiff}점</div></div>
                    <div className="diff-gap-label">{d.gap > 0 ? `직원이 ${d.gap}점 더 높게 평가` : `직원이 ${Math.abs(d.gap)}점 더 낮게 평가`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 희망업무 취합 */}
      {activeTab === 'desired' && (
        <div className="section-body">
          {Object.keys(desiredTaskMap).length === 0 ? (
            <div className="empty-state">희망업무 데이터가 없습니다</div>
          ) : (
            <div className="desired-list">
              {tasks.filter((t) => desiredTaskMap[t.id])
                .sort((a, b) => (desiredTaskMap[b.id]?.length || 0) - (desiredTaskMap[a.id]?.length || 0))
                .map((task) => {
                  const assignee = Object.entries(assignments).find(([tid]) => tid === task.id)?.[1]
                  return (
                    <div key={task.id} className="desired-card">
                      <div className="desired-top">
                        <span className="desired-task-name">{task.name}</span>
                        <span className="desired-count">{desiredTaskMap[task.id].length}명 희망</span>
                      </div>
                      <div className="desired-employees">
                        {desiredTaskMap[task.id].map((name) => <span key={name} className="emp-chip">{name}</span>)}
                      </div>
                      <div className="desired-assignee">현재 담당: <strong>{assignee || '미배정'}</strong></div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* 직원 관리 */}
      {activeTab === 'employees' && (
        <div>
          <div className="mgmt-header">
            <span className="mgmt-count">총 {employees.length}명</span>
            <button className="btn-primary" onClick={() => { setShowAddEmp(true); setEditingEmp(null) }}>
              + 직원 추가
            </button>
          </div>

          {showAddEmp && (
            <div className="card mgmt-form">
              <div className="form-row">
                <input
                  className="form-input"
                  placeholder="이름"
                  value={empForm.name}
                  onChange={(e) => setEmpForm((p) => ({ ...p, name: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddEmp()}
                  autoFocus
                />
                <select className="form-select" value={empForm.grade} onChange={(e) => setEmpForm((p) => ({ ...p, grade: e.target.value }))}>
                  {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                </select>
                <select className="form-select" value={empForm.type} onChange={(e) => setEmpForm((p) => ({ ...p, type: e.target.value }))}>
                  {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <button className="btn-primary" onClick={handleAddEmp}>추가</button>
                <button className="btn-secondary" onClick={() => setShowAddEmp(false)}>취소</button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="overview-table">
              <thead>
                <tr><th>이름</th><th>직급</th><th>고용형태</th><th>관리</th></tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    {editingEmp?.id === emp.id ? (
                      <>
                        <td><input className="inline-input" value={editingEmp.name} onChange={(e) => setEditingEmp((p) => ({ ...p, name: e.target.value }))} /></td>
                        <td>
                          <select className="inline-select" value={editingEmp.grade} onChange={(e) => setEditingEmp((p) => ({ ...p, grade: e.target.value }))}>
                            {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                          </select>
                        </td>
                        <td>
                          <select className="inline-select" value={editingEmp.type} onChange={(e) => setEditingEmp((p) => ({ ...p, type: e.target.value }))}>
                            {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-sm primary" onClick={handleUpdateEmp}>저장</button>
                            <button className="btn-sm" onClick={() => setEditingEmp(null)}>취소</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td><strong>{emp.name}</strong></td>
                        <td>{emp.grade}</td>
                        <td><span className={`badge ${emp.type === '계약직' ? 'contract' : emp.type === '육아휴직대체' ? 'parental' : 'regular'}`}>{emp.type}</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-sm" onClick={() => setEditingEmp({ ...emp })}>수정</button>
                            <button className="btn-sm danger" onClick={() => handleDeleteEmp(emp.id)}>삭제</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 업무 관리 */}
      {activeTab === 'tasks' && (
        <div>
          <div className="project-filter">
            {PROJECTS.map((p) => (
              <button key={p} className={`project-btn ${selectedProject === p ? 'active' : ''}`} onClick={() => { setSelectedProject(p); setShowAddTaskForm(false); setEditingTask(null) }}>
                {p}
                <span className="project-count">{tasks.filter((t) => t.project === p).length}</span>
              </button>
            ))}
          </div>

          <div className="table-wrap">
            <table className="overview-table">
              <thead>
                <tr><th>업무명</th><th>난이도</th><th>관리</th></tr>
              </thead>
              <tbody>
                {projectTasks.map((task) => (
                  <tr key={task.id}>
                    {editingTask?.id === task.id ? (
                      <>
                        <td><input className="inline-input wide" value={editingTask.name} onChange={(e) => setEditingTask((p) => ({ ...p, name: e.target.value }))} /></td>
                        <td>
                          <div className="inline-diff">
                            <input type="range" min="1" max="5" value={editingTask.difficulty} onChange={(e) => setEditingTask((p) => ({ ...p, difficulty: Number(e.target.value) }))} className="tc-slider" />
                            <span>{DIFF_LABELS[editingTask.difficulty]} ({editingTask.difficulty})</span>
                          </div>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-sm primary" onClick={handleUpdateTask}>저장</button>
                            <button className="btn-sm" onClick={() => setEditingTask(null)}>취소</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{task.name}</td>
                        <td><span className="diff-chip">{DIFF_LABELS[task.difficulty]} ({task.difficulty})</span></td>
                        <td>
                          <div className="action-btns">
                            <button className="btn-sm" onClick={() => setEditingTask({ ...task })}>수정</button>
                            <button className="btn-sm danger" onClick={() => handleDeleteTask(task.id)}>삭제</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showAddTaskForm ? (
            <div className="card mgmt-form" style={{ marginTop: 12 }}>
              <div className="form-row">
                <input
                  className="form-input"
                  placeholder="업무명 입력"
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
                  autoFocus
                />
                <div className="inline-diff">
                  <input type="range" min="1" max="5" value={newTaskDiff} onChange={(e) => setNewTaskDiff(Number(e.target.value))} className="tc-slider" />
                  <span>{DIFF_LABELS[newTaskDiff]} ({newTaskDiff})</span>
                </div>
                <button className="btn-primary" onClick={handleAddTask}>추가</button>
                <button className="btn-secondary" onClick={() => setShowAddTaskForm(false)}>취소</button>
              </div>
            </div>
          ) : (
            <button className="btn-sm" style={{ marginTop: 12 }} onClick={() => setShowAddTaskForm(true)}>
              + {selectedProject} 업무 추가
            </button>
          )}
        </div>
      )}
    </div>
  )
}
