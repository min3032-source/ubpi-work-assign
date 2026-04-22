import { useState, useEffect } from 'react'
import { EMPLOYEES, INITIAL_TASKS } from '../lib/constants'
import { getTasks, saveTasks, getAssignments, saveAssignments } from '../lib/storage'

const DIFF_LABELS = ['', '쉬움', '보통', '어려움', '매우 어려움', '최고']

export default function WorkAssignment() {
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [dragging, setDragging] = useState(null)
  const [newTaskName, setNewTaskName] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [t, a] = await Promise.all([getTasks(), getAssignments()])
      setTasks(t || INITIAL_TASKS)
      setAssignments(a || {})
      setLoading(false)
    }
    load()
  }, [])

  const updateAssignments = (next) => {
    setAssignments(next)
    saveAssignments(next)
  }

  const updateTasks = (next) => {
    setTasks(next)
    saveTasks(next)
  }

  const handleDrop = (e, employeeName) => {
    e.preventDefault()
    if (!dragging) return
    updateAssignments({ ...assignments, [dragging]: employeeName })
    setDragging(null)
  }

  const handleDropPool = (e) => {
    e.preventDefault()
    if (!dragging) return
    const next = { ...assignments }
    delete next[dragging]
    updateAssignments(next)
    setDragging(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const unassigned = tasks.filter((t) => !assignments[t.id])
  const getEmpTasks = (name) => tasks.filter((t) => assignments[t.id] === name)

  const addTask = () => {
    if (!newTaskName.trim()) return
    const newTask = { id: `t${Date.now()}`, name: newTaskName.trim(), difficulty: 2 }
    updateTasks([...tasks, newTask])
    setNewTaskName('')
    setShowAddTask(false)
  }

  const removeTask = (taskId) => {
    const next = { ...assignments }
    delete next[taskId]
    updateAssignments(next)
    updateTasks(tasks.filter((t) => t.id !== taskId))
  }

  const updateDifficulty = (taskId, val) => {
    updateTasks(tasks.map((t) => (t.id === taskId ? { ...t, difficulty: Number(val) } : t)))
  }

  const maxDiff = Math.max(
    ...EMPLOYEES.map((e) =>
      getEmpTasks(e.name).reduce((s, t) => s + (t.difficulty || 2), 0)
    ),
    1
  )

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>업무분장 관리</h1>
        <p>업무를 드래그하여 직원에게 배정하세요</p>
      </div>

      <div className="assign-layout">
        <div className="pool-section">
          <div className="pool-header">
            <h2>미배정 업무 ({unassigned.length})</h2>
            <button className="btn-sm" onClick={() => setShowAddTask((v) => !v)}>
              + 업무 추가
            </button>
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
              <button className="btn-sm primary" onClick={addTask}>추가</button>
              <button className="btn-sm" onClick={() => setShowAddTask(false)}>취소</button>
            </div>
          )}

          <div className="task-pool" onDrop={handleDropPool} onDragOver={handleDragOver}>
            {unassigned.length === 0 ? (
              <div className="pool-empty">모든 업무가 배정되었습니다</div>
            ) : (
              unassigned.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isDragging={dragging === task.id}
                  onDragStart={() => setDragging(task.id)}
                  onRemove={removeTask}
                  onDiffChange={updateDifficulty}
                />
              ))
            )}
          </div>
        </div>

        <div className="employees-area">
          {EMPLOYEES.map((emp) => (
            <EmployeeColumn
              key={emp.name}
              employee={emp}
              tasks={getEmpTasks(emp.name)}
              draggingId={dragging}
              onDragStart={setDragging}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onRemove={removeTask}
              onDiffChange={updateDifficulty}
            />
          ))}
        </div>
      </div>

      <div className="balance-section">
        <h2>업무량 균형 분석</h2>
        <div className="balance-chart">
          {EMPLOYEES.map((emp) => {
            const empTasks = getEmpTasks(emp.name)
            const totalDiff = empTasks.reduce((s, t) => s + (t.difficulty || 2), 0)
            const pct = maxDiff > 0 ? (totalDiff / maxDiff) * 100 : 0
            const level = pct > 75 ? 'high' : pct > 0 ? 'normal' : 'empty'

            return (
              <div key={emp.name} className="balance-row">
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
    </div>
  )
}

function TaskCard({ task, isDragging, onDragStart, onRemove, onDiffChange }) {
  return (
    <div
      className={`task-card ${isDragging ? 'is-dragging' : ''}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(task.id)
      }}
    >
      <div className="tc-header">
        <span className="tc-name">{task.name}</span>
        <button className="tc-remove" onClick={(e) => { e.stopPropagation(); onRemove(task.id) }}>×</button>
      </div>
      <div className="tc-diff">
        <span className="tc-diff-label">
          난이도 {DIFF_LABELS[task.difficulty]} ({task.difficulty})
        </span>
        <input
          type="range" min="1" max="5"
          value={task.difficulty}
          onChange={(e) => onDiffChange(task.id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="tc-slider"
        />
      </div>
    </div>
  )
}

function EmployeeColumn({ employee, tasks, draggingId, onDragStart, onDrop, onDragOver, onRemove, onDiffChange }) {
  const [isOver, setIsOver] = useState(false)

  return (
    <div
      className={`emp-col ${isOver ? 'drop-over' : ''}`}
      onDrop={(e) => { setIsOver(false); onDrop(e, employee.name) }}
      onDragOver={(e) => { onDragOver(e); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}
    >
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
        {tasks.length === 0 ? (
          <div className="col-empty">여기에 드롭</div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragging={draggingId === task.id}
              onDragStart={onDragStart}
              onRemove={onRemove}
              onDiffChange={onDiffChange}
            />
          ))
        )}
      </div>
    </div>
  )
}
