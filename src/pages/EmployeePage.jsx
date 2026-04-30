import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getTasks, getAssignments, getSecondaryAssignments,
  getEvaluations, saveEvaluation,
} from '../lib/storage'

const STEPS       = ['난이도 의견', '희망업무', '제출 완료']
const DIFF_LABELS = ['', '매우 쉬움', '쉬움', '보통', '어려움', '매우 어려움']
const PROJ_ORDER  = ['U-시리즈', '청년아카데미', '로컬창업', '소상공인', '마을기업', '공통업무']

const levelInfo = (d) => {
  if (d <= 2) return { label: '하', cls: 'level-low' }
  if (d === 3) return { label: '중', cls: 'level-mid' }
  return { label: '상', cls: 'level-high' }
}

export default function EmployeePage() {
  const { profile } = useAuth()
  const [step, setStep] = useState(0)
  const [tasks, setTasks]                       = useState([])
  const [assignments, setAssignments]           = useState({})
  const [secondaryAssignments, setSec]          = useState({})
  const [difficultyRatings, setRatings]         = useState({})
  const [difficultyNotes, setNotes]             = useState({})
  const [desiredTasks, setDesiredTasks]         = useState([])
  const [desiredPriorities, setDesiredPriorities] = useState({})
  const [alreadySubmitted, setAlreadySubmitted] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!profile?.team_id) return
    ;(async () => {
      const [t, a, sa, evals] = await Promise.all([
        getTasks(profile.team_id),
        getAssignments(profile.team_id),
        getSecondaryAssignments(profile.team_id),
        getEvaluations(profile.team_id),
      ])
      setTasks(t || [])
      setAssignments(a || {})
      setSec(sa || {})
      const myEval = evals?.[profile.name]
      if (myEval) {
        setAlreadySubmitted(true)
        setRatings(myEval.difficultyRatings || {})
        setNotes(myEval.difficultyNotes || {})
        setDesiredTasks(myEval.desiredTasks || [])
        setDesiredPriorities(myEval.desiredTaskPriorities || {})
      } else {
        const init = {}
        ;(t || []).forEach((tk) => { init[tk.id] = 3 })
        setRatings(init)
      }
      setLoading(false)
    })()
  }, [profile])

  const toggleDesired = (id) => {
    if (desiredTasks.includes(id)) {
      setDesiredTasks((p) => p.filter((x) => x !== id))
      setDesiredPriorities((p) => { const n = { ...p }; delete n[id]; return n })
    } else {
      setDesiredTasks((p) => [...p, id])
    }
  }

  const setPriority = (id, val) => {
    setDesiredPriorities((prev) => {
      const next = { ...prev }
      if (val === 0) { delete next[id]; return next }
      Object.keys(next).forEach((k) => { if (next[k] === val) delete next[k] })
      next[id] = val
      return next
    })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    await saveEvaluation(
      profile.name,
      {
        difficultyRatings, difficultyNotes: difficultyNotes,
        desiredTasks, desiredTaskPriorities: desiredPriorities,
        submittedAt: new Date().toISOString(),
      },
      profile.team_id,
    )
    setSubmitting(false)
    setAlreadySubmitted(true)
    setStep(2)
  }

  const taskGroups = PROJ_ORDER
    .filter((p) => tasks.some((t) => t.project === p))
    .map((p) => ({ project: p, list: tasks.filter((t) => t.project === p) }))

  if (!profile) return null
  if (loading)  return <div className="page"><div className="empty-state">불러오는 중...</div></div>
  if (!profile.team_id) return (
    <div className="page">
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <p>소속 팀이 지정되지 않았습니다. 관리자에게 문의하세요.</p>
      </div>
    </div>
  )

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>업무 난이도 의견 제출</h1>
            <p>
              {profile.teams?.departments?.name} &gt; {profile.teams?.name}
              &nbsp;·&nbsp; {profile.name} {profile.grade}
            </p>
          </div>
          {alreadySubmitted && step < 2 && (
            <div className="badge-status success" style={{ padding: '6px 14px' }}>
              ✓ 이미 제출됨 (재제출 가능)
            </div>
          )}
        </div>
      </div>

      <div className="steps steps-3">
        {STEPS.map((s, i) => (
          <div key={i} className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
            <div className="step-num">{i < step ? '✓' : i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>

      <div className="step-content">

        {/* 1단계: 난이도 의견 */}
        {step === 0 && (
          <div className="card">
            <h2>업무 난이도 의견</h2>
            <p className="step-desc">각 업무의 난이도를 1~5점으로 평가해주세요.</p>
            <div className="rating-list">
              {taskGroups.map(({ project, list }) => (
                <div key={project} className="rating-project-group">
                  <div className={`rating-project-header ${project === '공통업무' ? 'common-header' : ''}`}>
                    {project}
                  </div>
                  {list.map((task) => {
                    const rating   = difficultyRatings[task.id] ?? 3
                    const lv       = levelInfo(task.difficulty)
                    const isMine   = assignments[task.id] === profile.name || secondaryAssignments[task.id] === profile.name
                    return (
                      <div key={task.id} className="rating-item">
                        <div className="rating-task-header">
                          <div className="rating-task-title">
                            <span className="rating-task-name">{task.name}</span>
                            {isMine && <span className="current-badge">현재 담당</span>}
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
                            onChange={(e) => setRatings((p) => ({ ...p, [task.id]: Number(e.target.value) }))}
                            className="rating-slider" />
                          <span className="slider-edge">5</span>
                        </div>
                        <div className="slider-value-row">
                          <span className="slider-value-label">
                            내 의견: {DIFF_LABELS[rating]} ({rating}점)
                          </span>
                        </div>
                        <input type="text" className="memo-input"
                          placeholder="의견 메모 (선택)"
                          value={difficultyNotes[task.id] || ''}
                          onChange={(e) => setNotes((p) => ({ ...p, [task.id]: e.target.value }))}
                          maxLength={100} />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
            <div className="step-actions">
              <button className="btn-primary" onClick={() => setStep(1)}>다음 →</button>
            </div>
          </div>
        )}

        {/* 2단계: 희망업무 */}
        {step === 1 && (
          <div className="card">
            <h2>희망업무 신청</h2>
            <p className="step-desc">담당하고 싶은 업무를 선택하고, 최대 3개까지 우선순위를 지정해주세요.</p>
            {taskGroups.map(({ project, list }) => (
              <div key={project} className="desired-project-group">
                <div className={`desired-project-header ${project === '공통업무' ? 'common-header' : ''}`}>
                  {project}
                </div>
                <div className="desired-tasks-grid">
                  {list.map((task) => {
                    const isMine   = assignments[task.id] === profile.name || secondaryAssignments[task.id] === profile.name
                    const isChecked = desiredTasks.includes(task.id)
                    const priority  = desiredPriorities[task.id]
                    return (
                      <label key={task.id} className={`desired-task-item ${isChecked ? 'checked' : ''}`}>
                        <input type="checkbox" checked={isChecked} onChange={() => toggleDesired(task.id)} />
                        <span className="desired-task-name">{task.name}</span>
                        {isMine && <span className="current-badge">현재</span>}
                        {isChecked && (
                          <select className="priority-select" value={priority || 0}
                            onChange={(e) => setPriority(task.id, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()}>
                            <option value={0}>순위없음</option>
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
              <button className="btn-secondary" onClick={() => setStep(0)}>← 이전</button>
              <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
                {submitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        )}

        {/* 3단계: 완료 */}
        {step === 2 && (
          <div className="card completion-card">
            <div className="completion-icon">✅</div>
            <h2>제출 완료!</h2>
            <p>{profile.name}님의 업무 난이도 의견이 제출되었습니다.</p>
            <button className="btn-primary" onClick={() => setStep(0)}>
              다시 제출하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
