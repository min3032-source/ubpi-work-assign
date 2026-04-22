import { useState, useEffect } from 'react'
import { EMPLOYEES } from '../lib/constants'
import { getTasks, getAssignments, getEvaluations } from '../lib/storage'

export default function ManagerDashboard() {
  const [tasks, setTasks] = useState([])
  const [assignments, setAssignments] = useState({})
  const [evaluations, setEvaluations] = useState({})
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [t, a, e] = await Promise.all([getTasks(), getAssignments(), getEvaluations()])
      setTasks(t || [])
      setAssignments(a || {})
      setEvaluations(e || {})
      setLoading(false)
    }
    load()
  }, [])

  const getEmpTasks = (name) => tasks.filter((t) => assignments[t.id] === name)
  const submittedCount = EMPLOYEES.filter((e) => evaluations[e.name]).length

  const disagreements = []
  EMPLOYEES.forEach((emp) => {
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
  EMPLOYEES.forEach((emp) => {
    const ev = evaluations[emp.name]
    if (!ev?.desiredTasks) return
    ev.desiredTasks.forEach((taskId) => {
      if (!desiredTaskMap[taskId]) desiredTaskMap[taskId] = []
      desiredTaskMap[taskId].push(emp.name)
    })
  })

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>팀장 관리화면</h1>
        <p>전체 평가 현황 및 업무 이견을 확인하세요</p>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-num">{submittedCount}/{EMPLOYEES.length}</div>
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
        {[
          { key: 'overview', label: '전체 현황' },
          { key: 'disagreements', label: `난이도 이견 (${disagreements.length})` },
          { key: 'desired', label: '희망업무 취합' },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="table-wrap">
          <table className="overview-table">
            <thead>
              <tr>
                <th>직원명</th>
                <th>직급 / 유형</th>
                <th>배정 업무</th>
                <th>평가 제출</th>
                <th>평균 이견</th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map((emp) => {
                const empTasks = getEmpTasks(emp.name)
                const ev = evaluations[emp.name]
                const avgGap = ev
                  ? (() => {
                      const gaps = empTasks
                        .map((t) => {
                          const r = ev.difficultyRatings?.[t.id]
                          return r !== undefined ? Math.abs(r - t.difficulty) : null
                        })
                        .filter((g) => g !== null)
                      return gaps.length > 0
                        ? (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1)
                        : '0.0'
                    })()
                  : null

                return (
                  <tr key={emp.name}>
                    <td><strong>{emp.name}</strong></td>
                    <td>
                      <div className="emp-meta-cell">
                        <span>{emp.grade}</span>
                        <span className={`badge ${emp.type === '계약직' ? 'contract' : emp.type === '육아휴직대체' ? 'parental' : 'regular'}`}>
                          {emp.type}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="task-pills">
                        {empTasks.length === 0 ? (
                          <span className="no-tasks">미배정</span>
                        ) : (
                          empTasks.map((t) => <span key={t.id} className="task-pill">{t.name}</span>)
                        )}
                      </div>
                    </td>
                    <td>
                      {ev ? (
                        <span className="badge-status success">제출완료</span>
                      ) : (
                        <span className="badge-status pending">미제출</span>
                      )}
                    </td>
                    <td>
                      {avgGap !== null ? (
                        <span className={Number(avgGap) >= 2 ? 'text-warning' : ''}>{avgGap}점</span>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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
                    <div className="diff-item">
                      <div className="diff-label">팀장 설정</div>
                      <div className="diff-value manager">{d.managerDiff}점</div>
                    </div>
                    <div className="diff-arrow">→</div>
                    <div className="diff-item">
                      <div className="diff-label">직원 평가</div>
                      <div className={`diff-value ${d.gap > 0 ? 'higher' : 'lower'}`}>{d.empDiff}점</div>
                    </div>
                    <div className="diff-gap-label">
                      {d.gap > 0 ? `직원이 ${d.gap}점 더 높게 평가` : `직원이 ${Math.abs(d.gap)}점 더 낮게 평가`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'desired' && (
        <div className="section-body">
          {Object.keys(desiredTaskMap).length === 0 ? (
            <div className="empty-state">희망업무 데이터가 없습니다</div>
          ) : (
            <div className="desired-list">
              {tasks
                .filter((t) => desiredTaskMap[t.id])
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
                        {desiredTaskMap[task.id].map((name) => (
                          <span key={name} className="emp-chip">{name}</span>
                        ))}
                      </div>
                      <div className="desired-assignee">
                        현재 담당: <strong>{assignee || '미배정'}</strong>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
