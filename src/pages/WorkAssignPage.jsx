import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const GRADE_MAX = { '주임': 15, '선임': 18, '책임': 20, '팀장': 25, '부장': 30, '관리자': 30 }

const TYPE_COLOR = { 사업업무: '#3b82f6', 정기업무: '#059669', 행정업무: '#f59e0b', 돌발업무: '#dc2626' }
const TYPE_BG    = { 사업업무: '#eff6ff', 정기업무: '#d1fae5', 행정업무: '#fffbeb', 돌발업무: '#fef2f2' }

export default function WorkAssignPage() {
  const { profile } = useAuth()
  const [unassigned, setUnassigned]         = useState([])
  const [employees, setEmployees]           = useState([])
  const [allAssignments, setAllAssignments] = useState([])
  const [opinions, setOpinions]             = useState([])
  const [preferences, setPreferences]       = useState([])
  const [loading, setLoading]               = useState(true)

  const [assigningItemId, setAssigningItemId] = useState(null)
  const [assignEmpId, setAssignEmpId]         = useState('')
  const [assigning, setAssigning]             = useState(false)
  const [expandedEmpId, setExpandedEmpId]     = useState(null)

  const canAssign = profile && ['admin', 'manager'].includes(profile.role)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [r0, r1, r2, r3, r4] = await Promise.all([
      supabase.from('work_items').select('*, projects(name)').eq('status', '미배정').order('created_at'),
      supabase.from('employees')
        .select('id, name, grade, role, team_id, teams(name, departments(name))').order('created_at'),
      supabase.from('work_assignments')
        .select('employee_id, work_item_id, work_items(id, title, difficulty, work_type, status)')
        .eq('is_primary', true),
      supabase.from('work_assignments')
        .select('work_item_id, difficulty_opinion, employee_id, employees(name)')
        .eq('is_primary', false)
        .not('difficulty_opinion', 'is', null),
      supabase.from('work_preferences')
        .select('work_item_id, employee_id, reason, employees(name)').order('created_at'),
    ])
    setUnassigned(r0.data || [])
    setEmployees(r1.data || [])
    setAllAssignments(r2.data || [])
    setOpinions(r3.data || [])
    setPreferences(r4.data || [])
    setLoading(false)
  }

  const getScore       = (empId) => allAssignments.filter((a) => a.employee_id === empId)
    .reduce((sum, a) => sum + (a.work_items?.difficulty || 0), 0)
  const getEmpWorks    = (empId) => allAssignments.filter((a) => a.employee_id === empId)
    .map((a) => a.work_items).filter(Boolean)
  const getItemOpns    = (id) => opinions.filter((o) => o.work_item_id === id)
  const getItemPrefs   = (id) => preferences.filter((p) => p.work_item_id === id)
  const getAvgOpinion  = (id) => {
    const ops = getItemOpns(id)
    if (ops.length === 0) return null
    return (ops.reduce((s, o) => s + o.difficulty_opinion, 0) / ops.length).toFixed(1)
  }

  const handleAssign = async () => {
    if (!assigningItemId || !assignEmpId || !canAssign) return
    const item = unassigned.find((i) => i.id === assigningItemId)
    if (!item) return
    setAssigning(true)

    const { data } = await supabase.from('work_assignments').insert([{
      work_item_id: assigningItemId, employee_id: assignEmpId,
      is_primary: true, status: '진행중', assigned_by: profile?.id,
    }]).select('employee_id, work_item_id, work_items(id, title, difficulty, work_type, status)').single()

    await supabase.from('work_items').update({ status: '배정완료' }).eq('id', assigningItemId)

    if (data) {
      setAllAssignments((p) => [...p, data])
      setUnassigned((p) => p.filter((it) => it.id !== assigningItemId))
      setAssigningItemId(null)
      setAssignEmpId('')
    }
    setAssigning(false)
  }

  if (loading) return <div className="empty-state">불러오는 중...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* 왼쪽: 미배정 업무 */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          미배정 업무 ({unassigned.length}개)
        </h3>
        {unassigned.length === 0 ? (
          <div className="empty-state">미배정 업무가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unassigned.map((item) => {
              const itemOpns   = getItemOpns(item.id)
              const itemPrefs  = getItemPrefs(item.id)
              const avg        = getAvgOpinion(item.id)
              const wtype      = item.work_type || '사업업무'
              const isAssigning = assigningItemId === item.id

              return (
                <div key={item.id} style={{
                  padding: '10px 14px', borderRadius: 8,
                  border: `1.5px solid ${isAssigning ? (TYPE_COLOR[wtype] || '#3b82f6') : '#e5e7eb'}`,
                  background: isAssigning ? '#f8faff' : '#fff',
                }}>
                  {/* 업무명 + 유형 뱃지 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{item.title}</span>
                    <span style={{
                      fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                      background: TYPE_BG[wtype] || '#f3f4f6',
                      color: TYPE_COLOR[wtype] || '#6b7280',
                    }}>{wtype}</span>
                  </div>

                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                    {item.projects?.name || '미분류'} · 난이도 {item.difficulty}점
                  </div>

                  {/* 직원 의견 평균 */}
                  {avg && (
                    <div style={{ fontSize: 11, color: '#4f46e5', marginBottom: 3 }}>
                      📊 의견 평균 {avg}점 ({itemOpns.length}건):
                      {' '}{itemOpns.map((o) => `${o.employees?.name}(${o.difficulty_opinion}점)`).join(' · ')}
                    </div>
                  )}

                  {/* 희망 신청자 */}
                  {itemPrefs.length > 0 && (
                    <div style={{ fontSize: 11, color: '#059669', marginBottom: 6 }}>
                      ✋ {itemPrefs.length}명 희망: {itemPrefs.map((p) => p.employees?.name).join(', ')}
                    </div>
                  )}

                  {/* 배정 버튼 / 드롭다운 */}
                  {canAssign && (
                    !isAssigning ? (
                      <button
                        className="btn-sm primary"
                        style={{ width: '100%', marginTop: 6 }}
                        onClick={() => { setAssigningItemId(item.id); setAssignEmpId('') }}
                      >
                        배정
                      </button>
                    ) : (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          className="inline-select"
                          style={{ flex: 1, fontSize: 12 }}
                          value={assignEmpId}
                          onChange={(e) => setAssignEmpId(e.target.value)}
                        >
                          <option value="">직원 선택</option>
                          {employees.map((emp) => {
                            const score = getScore(emp.id)
                            const max   = GRADE_MAX[emp.grade] || 20
                            const after = score + (item.difficulty || 0)
                            const over  = after > max
                            return (
                              <option key={emp.id} value={emp.id}>
                                {emp.name}({emp.grade}) {score}/{max}점 → {after}점{over ? ' ⚠️' : ''}
                              </option>
                            )
                          })}
                        </select>
                        <button
                          className="btn-sm primary"
                          disabled={!assignEmpId || assigning}
                          onClick={handleAssign}
                        >
                          확인
                        </button>
                        <button className="btn-sm" onClick={() => { setAssigningItemId(null); setAssignEmpId('') }}>
                          취소
                        </button>
                      </div>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 오른쪽: 직원별 현황 */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          직원별 배정 현황
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {employees.map((emp) => {
            const score      = getScore(emp.id)
            const max        = GRADE_MAX[emp.grade] || 20
            const pct        = Math.min(Math.round((score / max) * 100), 100)
            const over       = score > max
            const empWorks   = getEmpWorks(emp.id)
            const isExpanded = expandedEmpId === emp.id

            return (
              <div key={emp.id} className="card" style={{
                padding: '12px 16px',
                border: `1px solid ${over ? '#fca5a5' : '#e5e7eb'}`,
                background: over ? '#fff5f5' : '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{emp.name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>{emp.grade}</span>
                    {emp.teams && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>· {emp.teams.name}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, color: over ? '#dc2626' : '#374151' }}>{score}</span>
                      <span style={{ color: '#6b7280', fontSize: 12 }}>/{max}점</span>
                      {over && <div style={{ fontSize: 10, color: '#dc2626' }}>초과!</div>}
                    </div>
                    {empWorks.length > 0 && (
                      <button
                        onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                        style={{
                          background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
                          cursor: 'pointer', fontSize: 11, color: '#6b7280', padding: '3px 8px',
                        }}
                      >
                        {isExpanded ? '▲' : '▼'} {empWorks.length}개
                      </button>
                    )}
                  </div>
                </div>

                {/* 프로그레스 바 */}
                <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                  <div style={{
                    background: over ? '#dc2626' : pct > 80 ? '#f59e0b' : '#4f46e5',
                    width: `${pct}%`, height: '100%', borderRadius: 6, transition: 'width .3s',
                  }} />
                </div>

                {/* 배정된 업무 목록 */}
                {isExpanded && empWorks.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 8 }}>
                    {empWorks.map((w, i) => {
                      const wt = w?.work_type || '사업업무'
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                          <span style={{
                            fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
                            background: TYPE_BG[wt] || '#f3f4f6',
                            color: TYPE_COLOR[wt] || '#6b7280',
                          }}>{wt}</span>
                          <span style={{ flex: 1, color: '#374151' }}>{w?.title}</span>
                          <span style={{ color: '#f59e0b', fontSize: 11 }}>{'★'.repeat(w?.difficulty || 0)}</span>
                          <span style={{ color: '#6b7280', fontSize: 11, minWidth: 24, textAlign: 'right' }}>{w?.difficulty}점</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
