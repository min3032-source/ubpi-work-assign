import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { INITIAL_TASKS, PROJECTS } from '../lib/constants'
import { useAuth } from '../contexts/AuthContext'
import {
  getTasks, saveTasks, getAssignments, saveAssignments,
  getSecondaryAssignments, saveSecondaryAssignments, getEmployees,
} from '../lib/storage'

const DIFF_LABELS = ['', '쉬움', '보통', '어려움', '매우 어려움', '최고']

export default function WorkAssignment() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const teamId = searchParams.get('teamId') || profile?.team_id || null

  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [secondaryAssignments, setSecondaryAssignments] = useState({})
  const [employees, setEmployees] = useState([])
  const [dragging, setDragging] = useState(null)
  const [pendingDrop, setPendingDrop] = useState(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [newTaskProject, setNewTaskProject] = useState(PROJECTS[0])
  const [showAddTask, setShowAddTask] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, a, sa, emp] = await Promise.all([
        getTasks(teamId), getAssignments(teamId),
        getSecondaryAssignments(teamId), getEmployees(teamId),
      ])
      setTasks(t || INITIAL_TASKS)
      setAssignments(a || {})
      setSecondaryAssignments(sa || {})
      setEmployees(emp || [])
      setLoading(false)
    }
    if (teamId) load()
  }, [teamId])

  const updateAssignments = (next) => { setAssignments(next); saveAssignments(next, teamId) }
  const updateSecondaryAssignments = (next) => { setSecondaryAssignments(next); saveSecondaryAssignments(next, teamId) }

  const handleDrop = (e, employeeName) => {
    e.preventDefault()
    if (!dragging) return
    setPendingDrop({ taskId: dragging, employeeName })
    setDragging(null)
  }

  const handleConfirmRole = (role) => {
    if (!pendingDrop) return
    const { taskId, employeeName } = pendingDrop
    const nextPrimary = { ...assignments }
    const nextSec = { ...secondaryAssignments }
    if (role === '정담당') {
      if (nextSec[taskId] === employeeName) delete nextSec[taskId]
      nextPrimary[taskId] = employeeName
    } else {
      if (nextPrimary[taskId] === employeeName) delete nextPrimary[taskId]
      nextSec[taskId] = employeeName
    }
    updateAssignments(nextPrimary)
    updateSecondaryAssignments(nextSec)
    setPendingDrop(null)
  }

  const handleDropPool = (e) => {
    e.preventDefault()
    if (!dragging) return
    const nextPrimary = { ...assignments }
    const nextSec = { ...secondaryAssignments }
    delete nextPrimary[dragging]
    delete nextSec[dragging]
    updateAssignments(nextPrimary)
    updateSecondaryAssignments(nextSec)
    setDragging(null)
  }

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  const unassigned = tasks.filter((t) => !assignments[t.id] && !secondaryAssignments[t.id])

  const getEmpTasks = (name) =>
    tasks
      .filter((t) => assignments[t.id] === name || secondaryAssignments[t.id] === name)
      .map((t) => ({ ...t, role: assignments[t.id] === name ? '정담당' : '부담당' }))

  const addTask = () => {
    if (!newTaskName.trim()) return
    const newTask = { id: `t${Date.now()}`, name: newTaskName.trim(), difficulty: 2, project: newTaskProject }
    const next = [...tasks, newTask]
    setTasks(next)
    saveTasks(next)
    setNewTaskName('')
    setShowAddTask(false)
  }

  const removeTask = (taskId) => {
    const nextPrimary = { ...assignments }
    const nextSec = { ...secondaryAssignments }
    delete nextPrimary[taskId]
    delete nextSec[taskId]
    updateAssignments(nextPrimary)
    updateSecondaryAssignments(nextSec)
    const next = tasks.filter((t) => t.id !== taskId)
    setTasks(next)
    saveTasks(next)
  }

  const updateDifficulty = (taskId, val) => {
    const next = tasks.map((t) => (t.id === taskId ? { ...t, difficulty: Number(val) } : t))
    setTasks(next)
    saveTasks(next)
  }

  const maxDiff = Math.max(
    ...employees.map((e) => getEmpTasks(e.name).reduce((s, t) => s + (t.difficulty || 2), 0)),
    1
  )

  const pendingTask = pendingDrop ? tasks.find((t) => t.id === pendingDrop.taskId) : null

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>업무분장 관리</h1>
        <p>업무를 드래그하여 직원에게 배정하세요 — 정담당/부담당을 선택할 수 있습니다</p>
      </div>

      <div className="assign-layout">
        <div className="pool-section">
          <div className="pool-header">
            <h2>미배정 업무 ({unassigned.length})</h2>
            <button className="btn-sm" onClick={() => setShowAddTask((v) => !v)}>+ 업무 추가</button>
          </div>

          {showAddTask && (
            <div className="add-task-form">
              <input
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="업무명 입력"
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                autoFocus
              />
              <select value={newTaskProject} onChange={(e) => setNewTaskProject(e.target.value)} className="form-select-sm">
                {PROJECTS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <button className="btn-sm primary" onClick={addTask}>추가</button>
              <button className="btn-sm" onClick={() => setShowAddTask(false)}>취소</button>
            </div>
          )}

          <div className="task-pool" onDrop={handleDropPool} onDragOver={handleDragOver}>
            {unassigned.length === 0 ? (
              <div className="pool-empty">모든 업무가 배정되었습니다</div>
            ) : (
              PROJECTS.filter((p) => unassigned.some((t) => t.project === p)).map((project) => (
                <div key={project} className="project-task-group">
                  <div className="project-task-group-header">{project}</div>
                  {unassigned.filter((t) => t.project === project).map((task) => (
                    <TaskCard key={task.id} task={task} isDragging={dragging === task.id}
                      onDragStart={() => setDragging(task.id)} onRemove={removeTask} onDiffChange={updateDifficulty} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="employees-area">
          {employees.map((emp) => (
            <EmployeeColumn key={emp.id} employee={emp} tasks={getEmpTasks(emp.name)}
              draggingId={dragging} onDragStart={setDragging} onDrop={handleDrop}
              onDragOver={handleDragOver} onRemove={removeTask} onDiffChange={updateDifficulty} />
          ))}
        </div>
      </div>

      <div className="balance-section">
        <h2>업무량 균형 분석</h2>
        <div className="balance-chart">
          {employees.map((emp) => {
            const empTasks = getEmpTasks(emp.name)
            const totalDiff = empTasks.reduce((s, t) => s + (t.difficulty || 2), 0)
            const pct = maxDiff > 0 ? (totalDiff / maxDiff) * 100 : 0
            const level = pct > 75 ? 'high' : pct > 0 ? 'normal' : 'empty'
            return (
              <div key={emp.id} className="balance-row">
                <div className="balance-name">
                  <span className="b-name">{emp.name}</span>
                  <span className="b-type">{emp.type}</span>
                </div>
                <div className="balance-bar-wrap">
                  <div className={`balance-bar bar-${level}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="balance-stats">
                  <span>{empTasks.length}개</span>
                  <span className="b-score">난이도합 {totalDiff}</span>
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

      {pendingDrop && (
        <div className="role-modal-overlay" onClick={() => setPendingDrop(null)}>
          <div className="role-modal" onClick={(e) => e.stopPropagation()}>
            <h3>담당 역할 선택</h3>
            <p>
              <strong>{pendingTask?.name}</strong>을(를)<br />
              <strong>{pendingDrop.employeeName}</strong>님에게 배정합니다
            </p>
            <div className="role-modal-btns">
              <button className="role-btn primary-role" onClick={() => handleConfirmRole('정담당')}>
                정담당
                <span>주 담당자</span>
              </button>
              <button className="role-btn secondary-role" onClick={() => handleConfirmRole('부담당')}>
                부담당
                <span>보조 담당자</span>
              </button>
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setPendingDrop(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskCard({ task, role, isDragging, onDragStart, onRemove, onDiffChange }) {
  return (
    <div className={`task-card ${isDragging ? 'is-dragging' : ''}`} draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id) }}>
      <div className="tc-header">
        <span className="tc-name">{task.name}</span>
        {role && (
          <span className={`role-badge ${role === '정담당' ? 'primary-role' : 'secondary-role'}`}>
            {role}
          </span>
        )}
        <button className="tc-remove" onClick={(e) => { e.stopPropagation(); onRemove(task.id) }}>×</button>
      </div>
      <div className="tc-diff">
        <span className="tc-diff-label">난이도 {DIFF_LABELS[task.difficulty]} ({task.difficulty})</span>
        <input type="range" min="1" max="5" value={task.difficulty}
          onChange={(e) => onDiffChange(task.id, e.target.value)}
          onClick={(e) => e.stopPropagation()} className="tc-slider" />
      </div>
    </div>
  )
}

function EmployeeColumn({ employee, tasks, draggingId, onDragStart, onDrop, onDragOver, onRemove, onDiffChange }) {
  const [isOver, setIsOver] = useState(false)
  return (
    <div className={`emp-col ${isOver ? 'drop-over' : ''}`}
      onDrop={(e) => { setIsOver(false); onDrop(e, employee.name) }}
      onDragOver={(e) => { onDragOver(e); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}>
      <div className="emp-col-head">
        <div className="emp-col-name">{employee.name}</div>
        <div className="emp-col-meta">
          <span>{employee.grade}</span>
          <span className={`type-badge ${employee.type === '계약직' ? 'contract' : employee.type === '육아휴직대체' ? 'parental' : 'regular'}`}>
            {employee.type}
          </span>
        </div>
        <div className="emp-col-count">{tasks.length}개 배정</div>
      </div>
      <div className="emp-col-body">
        {tasks.length === 0 ? <div className="col-empty">여기에 드롭</div>
          : tasks.map((task) => (
            <TaskCard key={task.id} task={task} role={task.role} isDragging={draggingId === task.id}
              onDragStart={onDragStart} onRemove={onRemove} onDiffChange={onDiffChange} />
          ))}
      </div>
    </div>
  )
}
