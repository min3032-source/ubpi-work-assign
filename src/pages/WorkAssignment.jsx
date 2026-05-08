import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'

const INTENSITY_SCORE = { '상': 3, '중': 2, '하': 1 }
const INTENSITY_OPTIONS = ['하', '중', '상']
const TYPE_OPTIONS = ['주요', '반복', '협력']

export default function WorkAssignment() {
  const { profile } = useAuth()
  const [searchParams] = useSearchParams()
  const teamId = searchParams.get('teamId') || profile?.team_id || null

  const [workItems, setWorkItems]   = useState([])
  const [assignments, setAssignments] = useState({}) // { work_item_id: { primary: emp_id, secondary: emp_id } }
  const [employees, setEmployees]   = useState([])
  const [dragging, setDragging]     = useState(null)
  const [pendingDrop, setPendingDrop] = useState(null) // { workItemId, employeeId }
  const [newTitle, setNewTitle]     = useState('')
  const [newType, setNewType]       = useState('주요')
  const [newIntensity, setNewIntensity] = useState('중')
  const [showAddItem, setShowAddItem] = useState(false)
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    if (teamId) load()
  }, [teamId])

  const load = async () => {
    setLoading(true)
    const [itemsRes, empsRes] = await Promise.all([
      supabase.from('work_items').select('*').eq('team_id', teamId).order('created_at'),
      supabase.from('employees').select('*').eq('team_id', teamId).order('created_at'),
    ])
    const items = itemsRes.data || []
    const emps  = empsRes.data || []
    setWorkItems(items)
    setEmployees(emps)

    if (items.length > 0) {
      const { data: assigns } = await supabase
        .from('work_assignments')
        .select('*')
        .in('work_item_id', items.map(i => i.id))

      const map = {}
      for (const a of assigns || []) {
        if (!map[a.work_item_id]) map[a.work_item_id] = {}
        if (a.role === '정담당') map[a.work_item_id].primary = a.employee_id
        else                     map[a.work_item_id].secondary = a.employee_id
      }
      setAssignments(map)
    }
    setLoading(false)
  }

  const handleDrop = (e, employeeId) => {
    e.preventDefault()
    if (!dragging) return
    setPendingDrop({ workItemId: dragging, employeeId })
    setDragging(null)
  }

  const handleConfirmRole = async (role) => {
    if (!pendingDrop) return
    const { workItemId, employeeId } = pendingDrop

    // 같은 role로 배정된 기존 담당자 제거
    await supabase.from('work_assignments')
      .delete()
      .eq('work_item_id', workItemId)
      .eq('role', role)

    // 해당 직원의 이 업무에 대한 기존 역할 제거 후 새 역할로 upsert
    await supabase.from('work_assignments').upsert({
      work_item_id: workItemId,
      employee_id: employeeId,
      role,
      status: '초안',
      assigned_by: profile?.id || null,
    }, { onConflict: 'employee_id,work_item_id' })

    await load()
    setPendingDrop(null)
  }

  const handleDropPool = async (e) => {
    e.preventDefault()
    if (!dragging) return
    await supabase.from('work_assignments').delete().eq('work_item_id', dragging)
    const next = { ...assignments }
    delete next[dragging]
    setAssignments(next)
    setDragging(null)
  }

  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  const addWorkItem = async () => {
    if (!newTitle.trim()) return
    const { data, error } = await supabase.from('work_items').insert([{
      title: newTitle.trim(),
      type: newType,
      intensity: newIntensity,
      team_id: teamId,
    }]).select().single()
    if (!error && data) {
      setWorkItems(p => [...p, data])
      setNewTitle('')
      setShowAddItem(false)
    }
  }

  const removeWorkItem = async (itemId) => {
    await supabase.from('work_items').delete().eq('id', itemId)
    setWorkItems(p => p.filter(i => i.id !== itemId))
    const next = { ...assignments }
    delete next[itemId]
    setAssignments(next)
  }

  const updateIntensity = async (itemId, intensity) => {
    await supabase.from('work_items').update({ intensity }).eq('id', itemId)
    setWorkItems(p => p.map(i => i.id === itemId ? { ...i, intensity } : i))
  }

  const unassigned = workItems.filter(i => !assignments[i.id]?.primary && !assignments[i.id]?.secondary)

  const getEmpItems = (empId) =>
    workItems
      .filter(i => assignments[i.id]?.primary === empId || assignments[i.id]?.secondary === empId)
      .map(i => ({ ...i, role: assignments[i.id]?.primary === empId ? '정담당' : '부담당' }))

  const score = (intensity) => INTENSITY_SCORE[intensity] || 2
  const maxScore = Math.max(
    ...employees.map(e => getEmpItems(e.id).reduce((s, i) => s + score(i.intensity), 0)),
    1
  )

  const pendingItem = pendingDrop ? workItems.find(i => i.id === pendingDrop.workItemId) : null
  const pendingEmp  = pendingDrop ? employees.find(e => e.id === pendingDrop.employeeId) : null

  if (loading) return <div className="page"><div className="empty-state">불러오는 중...</div></div>
  if (!teamId)  return <div className="page"><div className="empty-state">팀이 지정되지 않았습니다.</div></div>

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
            <button className="btn-sm" onClick={() => setShowAddItem(v => !v)}>+ 업무 추가</button>
          </div>

          {showAddItem && (
            <div className="add-task-form">
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="업무명 입력"
                onKeyDown={e => e.key === 'Enter' && addWorkItem()}
                autoFocus
              />
              <select value={newType} onChange={e => setNewType(e.target.value)} className="form-select-sm">
                {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={newIntensity} onChange={e => setNewIntensity(e.target.value)} className="form-select-sm">
                {INTENSITY_OPTIONS.map(v => <option key={v}>{v}</option>)}
              </select>
              <button className="btn-sm primary" onClick={addWorkItem}>추가</button>
              <button className="btn-sm" onClick={() => setShowAddItem(false)}>취소</button>
            </div>
          )}

          <div className="task-pool" onDrop={handleDropPool} onDragOver={handleDragOver}>
            {unassigned.length === 0 ? (
              <div className="pool-empty">모든 업무가 배정되었습니다</div>
            ) : (
              TYPE_OPTIONS.filter(t => unassigned.some(i => i.type === t)).map(type => (
                <div key={type} className="project-task-group">
                  <div className="project-task-group-header">{type}</div>
                  {unassigned.filter(i => i.type === type).map(item => (
                    <WorkItemCard key={item.id} item={item} isDragging={dragging === item.id}
                      onDragStart={() => setDragging(item.id)}
                      onRemove={removeWorkItem}
                      onIntensityChange={updateIntensity} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="employees-area">
          {employees.map(emp => (
            <EmployeeColumn key={emp.id} employee={emp} items={getEmpItems(emp.id)}
              draggingId={dragging} onDragStart={setDragging} onDrop={handleDrop}
              onDragOver={handleDragOver} onRemove={removeWorkItem} onIntensityChange={updateIntensity} />
          ))}
        </div>
      </div>

      <div className="balance-section">
        <h2>업무량 균형 분석</h2>
        <div className="balance-chart">
          {employees.map(emp => {
            const empItems  = getEmpItems(emp.id)
            const totalScore = empItems.reduce((s, i) => s + score(i.intensity), 0)
            const pct  = maxScore > 0 ? (totalScore / maxScore) * 100 : 0
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
                  <span>{empItems.length}개</span>
                  <span className="b-score">강도합 {totalScore}</span>
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
          <div className="role-modal" onClick={e => e.stopPropagation()}>
            <h3>담당 역할 선택</h3>
            <p>
              <strong>{pendingItem?.title}</strong>을(를)<br />
              <strong>{pendingEmp?.name}</strong>님에게 배정합니다
            </p>
            <div className="role-modal-btns">
              <button className="role-btn primary-role" onClick={() => handleConfirmRole('정담당')}>
                정담당<span>주 담당자</span>
              </button>
              <button className="role-btn secondary-role" onClick={() => handleConfirmRole('부담당')}>
                부담당<span>보조 담당자</span>
              </button>
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setPendingDrop(null)}>취소</button>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkItemCard({ item, role, isDragging, onDragStart, onRemove, onIntensityChange }) {
  return (
    <div className={`task-card ${isDragging ? 'is-dragging' : ''}`} draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(item.id) }}>
      <div className="tc-header">
        <span className="tc-name">{item.title}</span>
        {role && (
          <span className={`role-badge ${role === '정담당' ? 'primary-role' : 'secondary-role'}`}>
            {role}
          </span>
        )}
        <button className="tc-remove" onClick={e => { e.stopPropagation(); onRemove(item.id) }}>×</button>
      </div>
      <div className="tc-diff">
        <span className="tc-diff-label">강도</span>
        <select className="form-select-sm" value={item.intensity}
          onChange={e => onIntensityChange(item.id, e.target.value)}
          onClick={e => e.stopPropagation()}>
          {['하', '중', '상'].map(v => <option key={v}>{v}</option>)}
        </select>
        <span className={`intensity-badge intensity-${item.intensity}`}>{item.intensity}</span>
      </div>
      <div className="tc-type">
        <span className="tc-type-badge">{item.type}</span>
      </div>
    </div>
  )
}

function EmployeeColumn({ employee, items, draggingId, onDragStart, onDrop, onDragOver, onRemove, onIntensityChange }) {
  const [isOver, setIsOver] = useState(false)
  return (
    <div className={`emp-col ${isOver ? 'drop-over' : ''}`}
      onDrop={e => { setIsOver(false); onDrop(e, employee.id) }}
      onDragOver={e => { onDragOver(e); setIsOver(true) }}
      onDragLeave={() => setIsOver(false)}>
      <div className="emp-col-head">
        <div className="emp-col-name">{employee.name}</div>
        <div className="emp-col-meta">
          <span>{employee.grade}</span>
          <span className={`type-badge ${employee.type === '계약직' ? 'contract' : employee.type === '육아휴직대체' ? 'parental' : 'regular'}`}>
            {employee.type}
          </span>
        </div>
        <div className="emp-col-count">{items.length}개 배정</div>
      </div>
      <div className="emp-col-body">
        {items.length === 0
          ? <div className="col-empty">여기에 드롭</div>
          : items.map(item => (
            <WorkItemCard key={item.id} item={item} role={item.role} isDragging={draggingId === item.id}
              onDragStart={onDragStart} onRemove={onRemove} onIntensityChange={onIntensityChange} />
          ))}
      </div>
    </div>
  )
}
