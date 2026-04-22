import { useState, useEffect } from 'react'
import { getTasks, getAssignments, getEvaluations, saveEvaluation, getEmployees } from '../lib/storage'

const STEPS = ['직원 선택', '난이도 평가', '희망업무', '제출 완료']
const DIFF_LABELS = ['', '매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움']

export default function EmployeeEvaluation() {
  const [step, setStep] = useState(0)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [difficultyRatings, setDifficultyRatings] = useState({})
  const [desiredTasks, setDesiredTasks] = useState([])
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function load() {
      const [t, a, emp] = await Promise.all([getTasks(), getAssignments(), getEmployees()])
      setTasks(t || [])
      setAssignments(a || {})
      setEmployees(emp || [])
      setLoading(false)
    }
    load()
  }, [])

  const myTasks = tasks.filter((t) => assignments[t.id] === selectedEmployee)

  const handleEmployeeSelect = async (name) => {
    setSelectedEmployee(name)
    const evals = await getEvaluations()
    if (evals[name]) {
      setAlreadySubmitted(true)
      setDifficultyRatings(evals[name].difficultyRatings || {})
      setDesiredTasks(evals[name].desiredTasks || [])
    } else {
      setAlreadySubmitted(false)
      const myT = tasks.filter((t) => assignments[t.id] === name)
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
        {step === 0 && (
          <div className="card">
            <h2>직원을 선택해주세요</h2>
            <div className="employee-select-grid">
              {employees.map((emp) => (
                <button
                  key={emp.id}
                  className={`emp-select-btn ${selectedEmployee === emp.name ? 'selected' : ''}`}
                  onClick={() => handleEmployeeSelect(emp.name)}
                >
                  <div className="emp-select-name">{emp.name}</div>
                  <div className="emp-select-meta">{emp.grade} · {emp.type}</div>
                </button>
              ))}
            </div>
            {alreadySubmitted && (
              <div className="alert-info">이미 평가를 제출하셨습니다. 다시 제출하면 기존 내용이 덮어씌워집니다.</div>
            )}
            <div className="step-actions">
              <button className="btn-primary" disabled={!selectedEmployee} onClick={() => setStep(1)}>다음</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="card">
            <h2>{selectedEmployee}님 — 배정 업무 난이도 평가</h2>
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
                        <span className="rating-task-name">{task.name}</span>
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
              <button className="btn-secondary" onClick={() => setStep(0)}>이전</button>
              <button className="btn-primary" onClick={() => setStep(2)}>다음</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card">
            <h2>희망업무 선택</h2>
            <p className="step-desc">맡고 싶은 업무를 모두 선택해주세요 (현재 배정 여부와 무관)</p>
            {tasks.length === 0 ? (
              <div className="empty-state">등록된 업무가 없습니다.</div>
            ) : (
              <div className="desired-tasks-grid">
                {tasks.map((task) => {
                  const isCurrent = assignments[task.id] === selectedEmployee
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
            )}
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>이전</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        )}

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
