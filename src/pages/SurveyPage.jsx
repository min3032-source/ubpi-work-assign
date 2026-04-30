import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  getDepartments, getTeams, getEmployees, getTasks,
  getAssignments, getSecondaryAssignments, getEvaluations, saveEvaluation,
} from '../lib/storage'

const STEPS = ['부서 선택', '팀 선택', '이름 선택', '난이도 의견', '희망업무', '제출 완료']
const DIFF_LABELS = ['', '매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움']
const PROJECT_ORDER = ['U-시리즈', '청년아카데미', '로컬창업', '소상공인', '마을기업', '공통업무']

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

export default function SurveyPage() {
  const [step, setStep] = useState(0)

  // org structure
  const [departments, setDepartments] = useState([])
  const [teams, setTeams] = useState([])
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [secondaryAssignments, setSecondaryAssignments] = useState({})

  // selections
  const [selectedDept, setSelectedDept] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [selectedEmployee, setSelectedEmployee] = useState('')

  // evaluation data
  const [difficultyRatings, setDifficultyRatings] = useState({})
  const [difficultyNotes, setDifficultyNotes] = useState({})
  const [desiredTasks, setDesiredTasks] = useState([])
  const [desiredPriorities, setDesiredPriorities] = useState({})
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)

  const [loadingDepts, setLoadingDepts] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getDepartments().then((d) => { setDepartments(d); setLoadingDepts(false) })
  }, [])

  const handleDeptSelect = async (dept) => {
    setSelectedDept(dept)
    setSelectedTeam(null)
    setTeams([])
    setLoadingTeams(true)
    const t = await getTeams(dept.id)
    setTeams(t)
    setLoadingTeams(false)
    setStep(1)
  }

  const handleTeamSelect = async (team) => {
    setSelectedTeam(team)
    setLoadingData(true)
    const [emp, t, a, sa] = await Promise.all([
      getEmployees(team.id),
      getTasks(team.id),
      getAssignments(team.id),
      getSecondaryAssignments(team.id),
    ])
    setEmployees(emp || [])
    setTasks(t || [])
    setAssignments(a || {})
    setSecondaryAssignments(sa || {})
    setLoadingData(false)
    setStep(2)
  }

  const handleEmployeeSelect = async (name) => {
    setSelectedEmployee(name)
    const evals = await getEvaluations(selectedTeam.id)
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
      setDifficultyRatings(init)
      setDifficultyNotes({})
      setDesiredTasks([])
      setDesiredPriorities({})
    }
  }

  const toggleDesired = (taskId) => {
    if (desiredTasks.includes(taskId)) {
      setDesiredTasks((p) => p.filter((id) => id !== taskId))
      setDesiredPriorities((p) => { const n = { ...p }; delete n[taskId]; return n })
    } else {
      setDesiredTasks((p) => [...p, taskId])
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
      difficultyRatings, difficultyNotes, desiredTasks,
      desiredTaskPriorities: desiredPriorities,
      submittedAt: new Date().toISOString(),
    }, selectedTeam.id)
    setSubmitting(false)
    setStep(5)
  }

  const reset = () => {
    setStep(0)
    setSelectedDept(null)
    setSelectedTeam(null)
    setSelectedEmployee('')
    setAlreadySubmitted(false)
    setDifficultyRatings({})
    setDifficultyNotes({})
    setDesiredTasks([])
    setDesiredPriorities({})
    setDepartments([])
    setTeams([])
    setEmployees([])
    setTasks([])
    setLoadingDepts(true)
    getDepartments().then((d) => { setDepartments(d); setLoadingDepts(false) })
  }

  // tasks grouped by project (ordered)
  const taskGroups = PROJECT_ORDER
    .filter((p) => tasks.some((t) => t.project === p))
    .map((p) => ({ project: p, taskList: tasks.filter((t) => t.project === p) }))

  return (
    <div className="page">
      <Link to="/" className="back-link">← 메인으로</Link>

      <div className="page-header">
        <h1>업무 난이도 의견 제출</h1>
        <p>부서·팀을 선택한 후 의견을 입력해주세요</p>
      </div>

      <div className="steps steps-6">
        {STEPS.map((s, i) => (
          <div key={i} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="step-num">{i < step ? '✓' : i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      <div className="step-content">

        {/* 1단계: 부서 선택 */}
        {step === 0 && (
          <div className="card">
            <h2>부서를 선택해주세요</h2>
            {loadingDepts ? (
              <div className="empty-state">불러오는 중...</div>
            ) : departments.length === 0 ? (
              <div className="empty-state">등록된 부서가 없습니다. 관리자에게 문의하세요.</div>
            ) : (
              <div className="org-select-grid">
                {departments.map((dept) => (
                  <button key={dept.id} className="org-select-btn" onClick={() => handleDeptSelect(dept)}>
                    <div className="org-select-icon">🏢</div>
                    <div className="org-select-name">{dept.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2단계: 팀 선택 */}
        {step === 1 && (
          <div className="card">
            <h2><span className="breadcrumb-tag">{selectedDept?.name}</span> 팀을 선택해주세요</h2>
            {loadingTeams ? (
              <div className="empty-state">불러오는 중...</div>
            ) : teams.length === 0 ? (
              <div className="empty-state">등록된 팀이 없습니다.</div>
            ) : (
              <div className="org-select-grid">
                {teams.map((team) => (
                  <button key={team.id} className="org-select-btn" onClick={() => handleTeamSelect(team)}>
                    <div className="org-select-icon">👥</div>
                    <div className="org-select-name">{team.name}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(0)}>← 이전</button>
            </div>
          </div>
        )}

        {/* 3단계: 이름 선택 */}
        {step === 2 && (
          <div className="card">
            <h2>
              <span className="breadcrumb-tag">{selectedDept?.name}</span>
              <span className="breadcrumb-tag">{selectedTeam?.name}</span>
              본인 이름을 선택해주세요
            </h2>
            {loadingData ? (
              <div className="empty-state">불러오는 중...</div>
            ) : (
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
            )}
            {alreadySubmitted && (
              <div className="alert-info">이미 제출하셨습니다. 다시 제출하면 덮어씌워집니다.</div>
            )}
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(1)}>← 이전</button>
              <button className="btn-primary" disabled={!selectedEmployee} onClick={() => setStep(3)}>
                다음 →
              </button>
            </div>
          </div>
        )}

        {/* 4단계: 난이도 의견 */}
        {step === 3 && (
          <div className="card">
            <h2>{selectedEmployee}님 — 업무 난이도 의견</h2>
            <p className="step-desc">각 업무의 난이도에 대한 의견을 1~5점으로 입력해주세요.</p>
            <div className="rating-list">
              {taskGroups.map(({ project, taskList }) => (
                <div key={project} className="rating-project-group">
                  <div className={`rating-project-header ${project === '공통업무' ? 'common-header' : ''}`}>
                    {project}
                  </div>
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
                          {project !== '공통업무' && (
                            <div className="rating-manager-info">
                              <span className={`diff-level-badge ${lv.cls}`}>{lv.label}</span>
                              <span className="rating-manager-diff">팀장 설정: {task.difficulty}점</span>
                            </div>
                          )}
                        </div>
                        <div className="slider-row">
                          <span className="slider-edge">1</span>
                          <input type="range" min="1" max="5" value={rating}
                            onChange={(e) => setDifficultyRatings((p) => ({ ...p, [task.id]: Number(e.target.value) }))}
                            className="rating-slider" />
                          <span className="slider-edge">5</span>
                        </div>
                        <div className="slider-value-row">
                          <span className="slider-value-label">내 의견: {DIFF_LABELS[rating]} ({rating}점)</span>
                        </div>
                        <input type="text" className="memo-input"
                          placeholder="의견 메모 (선택 입력)"
                          value={difficultyNotes[task.id] || ''}
                          onChange={(e) => setDifficultyNotes((p) => ({ ...p, [task.id]: e.target.value }))}
                          maxLength={100} />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(2)}>← 이전</button>
              <button className="btn-primary" onClick={() => setStep(4)}>다음 →</button>
            </div>
          </div>
        )}

        {/* 5단계: 희망업무 */}
        {step === 4 && (
          <div className="card">
            <h2>희망업무 신청</h2>
            <p className="step-desc">담당하고 싶은 업무를 선택하고, 최대 3개까지 우선순위를 지정해주세요.</p>
            {taskGroups.map(({ project, taskList }) => (
              <div key={project} className="desired-project-group">
                <div className={`desired-project-header ${project === '공통업무' ? 'common-header' : ''}`}>
                  {project}
                </div>
                <div className="desired-tasks-grid">
                  {taskList.map((task) => {
                    const isCurrent = assignments[task.id] === selectedEmployee || secondaryAssignments[task.id] === selectedEmployee
                    const isChecked = desiredTasks.includes(task.id)
                    const priority = desiredPriorities[task.id]
                    return (
                      <label key={task.id} className={`desired-task-item ${isChecked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleDesired(task.id)} />
                        <span className="desired-task-name">{task.name}</span>
                        {isCurrent && <span className="current-badge">현재 담당</span>}
                        {isChecked && (
                          <select className="priority-select" value={priority || 0}
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
            <div className="step-actions">
              <button className="btn-secondary" onClick={() => setStep(3)}>← 이전</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        )}

        {/* 6단계: 완료 */}
        {step === 5 && (
          <div className="card completion-card">
            <div className="completion-icon">✅</div>
            <h2>의견 제출 완료!</h2>
            <p>
              <strong>{selectedDept?.name} &gt; {selectedTeam?.name}</strong><br />
              {selectedEmployee}님의 업무 난이도 의견이 성공적으로 제출되었습니다.
            </p>
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
