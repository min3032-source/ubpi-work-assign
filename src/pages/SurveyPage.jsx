import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PROJECTS, COMMON_TASKS } from '../lib/constants'
import {
  getTasks, getAssignments, getSecondaryAssignments,
  getEvaluations, saveEvaluation, getEmployees,
} from '../lib/storage'

const STEPS = ['이름 선택', '난이도 의견', '희망업무', '제출 완료']
const DIFF_LABELS = ['', '매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움']

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

export default function SurveyPage() {
  const [step, setStep] = useState(0)
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [secondaryAssignments, setSecondaryAssignments] = useState({})
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [difficultyRatings, setDifficultyRatings] = useState({})
  const [difficultyNotes, setDifficultyNotes] = useState({})
  const [desiredTasks, setDesiredTasks] = useState([])
  const [desiredPriorities, setDesiredPriorities] = useState({})
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const [t, a, sa, emp] = await Promise.all([
        getTasks(), getAssignments(), getSecondaryAssignments(), getEmployees(),
      ])
      setTasks(t || [])
      setAssignments(a || {})
      setSecondaryAssignments(sa || {})
      setEmployees(emp || [])
      setLoading(false)
    }
    load()
  }, [])

  const handleEmployeeSelect = async (name) => {
    setSelectedEmployee(name)
    const evals = await getEvaluations()
    if (evals[name]) {
      setAlreadySubmitted(true)
      setDifficultyRatings(evals[name].difficultyRatings || {})
      setDifficultyNotes(evals[name].difficultyNotes || {})
      setDesiredTasks(evals[name].desiredTasks || [])
      setDesiredPriorities(evals[name].desiredTaskPriorities || {})
    } else {
      setAlreadySubmitted(false)
      const init = {}
      tasks.forEach((t) => { init[t.id] = 3 })
      COMMON_TASKS.forEach((ct) => { init[ct.id] = 3 })
      setDifficultyRatings(init)
      setDifficultyNotes({})
      setDesiredTasks([])
      setDesiredPriorities({})
    }
  }

  const toggleDesired = (taskId) => {
    if (desiredTasks.includes(taskId)) {
      setDesiredTasks((prev) => prev.filter((id) => id !== taskId))
      setDesiredPriorities((prev) => { const n = { ...prev }; delete n[taskId]; return n })
    } else {
      setDesiredTasks((prev) => [...prev, taskId])
    }
  }

  const setPriority = (taskId, priority) => {
    setDesiredPriorities((prev) => {
      const next = { ...prev }
      if (priority === 0) { delete next[taskId]; return next }
      Object.keys(next).forEach((id) => { if (next[id] === priority) delete next[id] })
      next[taskId] = priority
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    await saveEvaluation(selectedEmployee, {
      difficultyRatings,
      difficultyNotes,
      desiredTasks,
      desiredTaskPriorities: desiredPriorities,
      submittedAt: new Date().toISOString(),
    })
    setSubmitting(false)
    setStep(3)
  }

  const reset = () => {
    setStep(0)
    setSelectedEmployee('')
    setAlreadySubmitted(false)
    setDifficultyRatings({})
    setDifficultyNotes({})
    setDesiredTasks([])
    setDesiredPriorities({})
  }

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  const taskGroups = PROJECTS
    .filter((p) => tasks.some((t) => t.project === p))
    .map((p) => ({ project: p, taskList: tasks.filter((t) => t.project === p) }))

  return (
    <div className="page">
      <Link to="/" className="back-link">← 메인으로</Link>

      <div className="page-header">
        <h1>업무 난이도 의견 제출</h1>
        <p>업무별 난이도에 대한 의견을 입력해주세요. 결과는 팀장·부장님이 업무분장 결정에 참고합니다.</p>
      </div>

      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={i} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="step-num">{i < step ? '✓' : i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      <div className="step-content">
        {/* 1단계: 이름 선택 */}
        {step === 0 && (
          <div className="card">
            <h2>본인 이름을 선택해주세요</h2>
            <div className="employee-select-grid">
              {employees.map((emp) => (
                <button key={emp.id}
                  className={`emp-select-btn ${selectedEmployee === emp.name ? 'selected' : ''}`}
                  onClick={() => handleEmployeeSelect(emp.name)}>
                  <div className="emp-select-name">{emp.name}</div>
                  <div className="emp-select-meta">{emp.grade} · {emp.type}</div>
                </button>
              ))}
            </div>
            {alreadySubmitted && (
              <div className="alert-info">이미 제출하셨습니다. 다시 제출하면 덮어씌워집니다.</div>
            )}
            <div className="step-actions">
              <button className="btn-primary" disabled={!selectedEmployee} onClick={() => setStep(1)}>
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* 2단계: 전체 업무 난이도 의견 */}
        {step === 1 && (
          <div className="card">
            <h2>{selectedEmployee}님 — 업무 난이도 의견</h2>
            <p className="step-desc">각 업무의 난이도에 대한 의견을 1~5점으로 입력해주세요. 의견 메모도 남길 수 있습니다.</p>
            <div className="rating-list">
              {taskGroups.map(({ project, taskList }) => (
                <div key={project} className="rating-project-group">
                  <div className="rating-project-header">{project}</div>
                  {taskList.map((task) => {
                    const rating = difficultyRatings[task.id] ?? 3
                    const lv = levelInfo(task.difficulty)
                    const isCurrent = assignments[task.id] === selectedEmployee || secondaryAssignments[task.id] === selectedEmployee
                    return (
                      <div key={task.id} className="rating-item">
                        <div className="rating-task-header">
                          <div className="rating-task-title">
                            <span className="rating-task-name">{task.name}</span>
                            {isCurrent && <span className="current-badge">현재 담당</span>}
                          </div>
                          <div className="rating-manager-info">
                            <span className={`diff-level-badge ${lv.cls}`}>{lv.label}</span>
                            <span className="rating-manager-diff">팀장 설정: {task.difficulty}점</span>
                          </div>
                        </div>
                        <div className="slider-row">
                          <span className="slider-edge">1</span>
                          <input type="range" min="1" max="5" value={rating}
                            onChange={(e) => setDifficultyRatings((prev) => ({ ...prev, [task.id]: Number(e.target.value) }))}
                            className="rating-slider" />
                          <span className="slider-edge">5</span>
                        </div>
                        <div className="slider-value-row">
                          <span className="slider-value-label">내 의견: {DIFF_LABELS[rating]} ({rating}점)</span>
                        </div>
                        <input
                          type="text"
                          className="memo-input"
                          placeholder="의견 메모 (선택 입력)"
                          value={difficultyNotes[task.id] || ''}
                          onChange={(e) => setDifficultyNotes((prev) => ({ ...prev, [task.id]: e.target.value }))}
                          maxLength={100}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
              {/* 공통업무 */}
              <div className="rating-project-group">
                <div className="rating-project-header common-header">공통업무</div>
                {COMMON_TASKS.map((ct) => {
                  const rating = difficultyRatings[ct.id] ?? 3
                  return (
                    <div key={ct.id} className="rating-item">
                      <div className="rating-task-header">
                        <div className="rating-task-title">
                          <span className="rating-task-name">{ct.name}</span>
                        </div>
                      </div>
                      <div className="slider-row">
                        <span className="slider-edge">1</span>
                        <input type="range" min="1" max="5" value={rating}
                          onChange={(e) => setDifficultyRatings((prev) => ({ ...prev, [ct.id]: Number(e.target.value) }))}
                          className="rating-slider" />
                        <span className="slider-edge">5</span>
                      </div>
                      <div className="slider-value-row">
                        <span className="slider-value-label">내 의견: {DIFF_LABELS[rating]} ({rating}점)</span>
                      </div>
                      <input
                        type="text"
                        className="memo-input"
                        placeholder="의견 메모 (선택 입력)"
                        value={difficultyNotes[ct.id] || ''}
                        onChange={(e) => setDifficultyNotes((prev) => ({ ...prev, [ct.id]: e.target.value }))}
                        maxLength={100}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(0)}>← 이전</button>
              <button className="btn-primary" onClick={() => setStep(2)}>다음 →</button>
            </div>
          </div>
        )}

        {/* 3단계: 희망업무 */}
        {step === 2 && (
          <div className="card">
            <h2>희망업무 신청</h2>
            <p className="step-desc">담당하고 싶은 업무를 선택하고, 최대 3개까지 우선순위(1~3순위)를 지정해주세요.</p>
            <div>
              {PROJECTS.filter((p) => tasks.some((t) => t.project === p)).map((project) => (
                <div key={project} className="desired-project-group">
                  <div className="desired-project-header">{project}</div>
                  <div className="desired-tasks-grid">
                    {tasks.filter((t) => t.project === project).map((task) => {
                      const isCurrent = assignments[task.id] === selectedEmployee || secondaryAssignments[task.id] === selectedEmployee
                      const isChecked = desiredTasks.includes(task.id)
                      const priority = desiredPriorities[task.id]
                      return (
                        <label key={task.id} className={`desired-task-item ${isChecked ? 'checked' : ''}`}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleDesired(task.id)} />
                          <span className="desired-task-name">{task.name}</span>
                          {isCurrent && <span className="current-badge">현재 담당</span>}
                          {isChecked && (
                            <select className="priority-select"
                              value={priority || 0}
                              onChange={(e) => setPriority(task.id, Number(e.target.value))}
                              onClick={(e) => e.stopPropagation()}>
                              <option value={0}>순위 없음</option>
                              <option value={1}>1순위</option>
                              <option value={2}>2순위</option>
                              <option value={3}>3순위</option>
                            </select>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
              {/* 공통업무 희망 신청 */}
              <div className="desired-project-group">
                <div className="desired-project-header common-header">공통업무</div>
                <div className="desired-tasks-grid">
                  {COMMON_TASKS.map((ct) => {
                    const isChecked = desiredTasks.includes(ct.id)
                    const priority = desiredPriorities[ct.id]
                    return (
                      <label key={ct.id} className={`desired-task-item ${isChecked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleDesired(ct.id)} />
                        <span className="desired-task-name">{ct.name}</span>
                        {isChecked && (
                          <select className="priority-select"
                            value={priority || 0}
                            onChange={(e) => setPriority(ct.id, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}>
                            <option value={0}>순위 없음</option>
                            <option value={1}>1순위</option>
                            <option value={2}>2순위</option>
                            <option value={3}>3순위</option>
                          </select>
                        )}
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>← 이전</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        )}

        {/* 4단계: 완료 */}
        {step === 3 && (
          <div className="card completion-card">
            <div className="completion-icon">✅</div>
            <h2>의견 제출 완료!</h2>
            <p>{selectedEmployee}님의 업무 난이도 의견이 성공적으로 제출되었습니다.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn-primary" onClick={reset}>다른 직원 의견 제출하기</button>
              <Link to="/" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                메인으로
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
