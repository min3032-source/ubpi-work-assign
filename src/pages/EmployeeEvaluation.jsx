import { useState, useEffect } from 'react'
import { PROJECTS } from '../lib/constants'
import { getTasks, getAssignments, getSecondaryAssignments, getEvaluations, saveEvaluation, getEmployees } from '../lib/storage'

const STEPS = ['직원 선택', '난이도 평가', '희망업무', '제출 완료']
const DIFF_LABELS = ['', '매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움']

export default function EmployeeEvaluation() {
  const [step, setStep] = useState(0)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [secondaryAssignments, setSecondaryAssignments] = useState({})
  const [difficultyRatings, setDifficultyRatings] = useState({})
  const [desiredTasks, setDesiredTasks] = useState([])
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

  const getMyTasks = (name) =>
    tasks
      .filter((t) => assignments[t.id] === name || secondaryAssignments[t.id] === name)
      .map((t) => ({ ...t, role: assignments[t.id] === name ? '정담당' : '부담당' }))

  const myTasks = getMyTasks(selectedEmployee)

  const handleEmployeeSelect = async (name) => {
    setSelectedEmployee(name)
    const evals = await getEvaluations()
    const myT = tasks.filter((t) => assignments[t.id] === name || secondaryAssignments[t.id] === name)
    if (evals[name]) {
      setAlreadySubmitted(true)
      setDifficultyRatings(evals[name].difficultyRatings || {})
      setDesiredTasks(evals[name].desiredTasks || [])
    } else {
      setAlreadySubmitted(false)
      const initRatings = {}
      myT.forEach((t) => { initRatings[t.id] = 3 })
      setDifficultyRatings(initRatings)
      setDesiredTasks([])
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    await saveEvaluation(selectedEmployee, {
      difficultyRatings,
      desiredTasks,
      submittedAt: new Date().toISOString(),
    })
    setSubmitting(false)
    setStep(3)
  }

  const toggleDesired = (taskId) => {
    setDesiredTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    )
  }

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>자기평가 제출</h1>
        <p>업무 난이도와 희망업무를 입력해주세요</p>
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
        {/* 1단계: 직원 선택 */}
        {step === 0 && (
          <div className="card">
            <h2>직원을 선택해주세요</h2>
            <div className="employee-select-grid">
              {employees.map((emp) => {
                const submitted = false
                return (
                  <button
                    key={emp.id}
                    className={`emp-select-btn ${selectedEmployee === emp.name ? 'selected' : ''}`}
                    onClick={() => handleEmployeeSelect(emp.name)}
                  >
                    <div className="emp-select-name">{emp.name}</div>
                    <div className="emp-select-meta">{emp.grade} · {emp.type}</div>
                  </button>
                )
              })}
            </div>
            {alreadySubmitted && (
              <div className="alert-info">이미 평가를 제출하셨습니다. 다시 제출하면 기존 내용이 덮어씌워집니다.</div>
            )}
            <div className="step-actions">
              <button className="btn-primary" disabled={!selectedEmployee} onClick={() => setStep(1)}>
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* 2단계: 배정 업무 확인 & 난이도 평가 */}
        {step === 1 && (
          <div className="card">
            <h2>{selectedEmployee}님 — 배정 업무 난이도 평가</h2>
            <p className="step-desc">배정된 업무의 체감 난이도를 슬라이더로 입력해주세요</p>
            {myTasks.length === 0 ? (
              <div className="empty-state">배정된 업무가 없습니다. 팀장에게 문의하세요.</div>
            ) : (
              <div className="rating-list">
                {myTasks.map((task) => {
                  const rating = difficultyRatings[task.id] ?? 3
                  const gap = Math.abs(rating - task.difficulty)
                  return (
                    <div key={task.id} className="rating-item">
                      <div className="rating-task-header">
                        <div className="rating-task-title">
                          <span className="rating-task-name">{task.name}</span>
                          <span className={`role-badge ${task.role === '정담당' ? 'primary-role' : 'secondary-role'}`}>
                            {task.role}
                          </span>
                        </div>
                        <span className="rating-manager-diff">팀장 설정: {task.difficulty}점</span>
                      </div>
                      <div className="slider-row">
                        <span className="slider-edge">1</span>
                        <input type="range" min="1" max="5" value={rating}
                          onChange={(e) => setDifficultyRatings((prev) => ({ ...prev, [task.id]: Number(e.target.value) }))}
                          className="rating-slider"
                        />
                        <span className="slider-edge">5</span>
                      </div>
                      <div className="slider-value-row">
                        <span className="slider-value-label">{DIFF_LABELS[rating]} ({rating}점)</span>
                        {gap >= 2 && <span className="diff-warning">⚠ 팀장과 {gap}점 차이</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(0)}>← 이전</button>
              <button className="btn-primary" onClick={() => setStep(2)}>다음 →</button>
            </div>
          </div>
        )}

        {/* 3단계: 희망업무 선택 */}
        {step === 2 && (
          <div className="card">
            <h2>희망업무 선택</h2>
            <p className="step-desc">맡고 싶은 업무를 모두 선택해주세요 (현재 배정 여부와 무관)</p>
            {tasks.length === 0 ? (
              <div className="empty-state">등록된 업무가 없습니다.</div>
            ) : (
              <div>
                {PROJECTS.filter((p) => tasks.some((t) => t.project === p)).map((project) => {
                  const projectTasks = tasks.filter((t) => t.project === project)
                  return (
                    <div key={project} className="desired-project-group">
                      <div className="desired-project-header">{project}</div>
                      <div className="desired-tasks-grid">
                        {projectTasks.map((task) => {
                          const isCurrent = assignments[task.id] === selectedEmployee || secondaryAssignments[task.id] === selectedEmployee
                          const isChecked = desiredTasks.includes(task.id)
                          return (
                            <label key={task.id} className={`desired-task-item ${isChecked ? 'checked' : ''}`}>
                              <input type="checkbox" checked={isChecked} onChange={() => toggleDesired(task.id)} />
                              <span className="desired-task-name">{task.name}</span>
                              {isCurrent && <span className="current-badge">현재 담당</span>}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
            <h2>제출 완료!</h2>
            <p>{selectedEmployee}님의 자기평가가 성공적으로 제출되었습니다.</p>
            <button className="btn-primary" onClick={() => { setStep(0); setSelectedEmployee(''); setAlreadySubmitted(false) }}>
              다른 직원 평가하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
