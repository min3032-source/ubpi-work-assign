import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const GRADE_MAX = { '주임': 15, '선임': 18, '책임': 20, '팀장': 25, '부장': 30, '관리자': 30 }

export default function WorkAssignPage() {
  const { profile } = useAuth()
  const [unassigned, setUnassigned]   = useState([])
  const [employees, setEmployees]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [opinions, setOpinions]       = useState([])
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState(null)
  const [assigning, setAssigning]     = useState(false)

  const canAssign = profile && ['admin', 'manager'].includes(profile.role)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [r0, r1, r2, r3, r4] = await Promise.all([
      supabase.from('work_items').select('*, projects(name)').eq('status', '미배정').order('created_at'),
      supabase.from('employees').select('id, name, grade, role, team_id, teams(name, departments(name))').order('created_at'),
      supabase.from('work_assignments').select('employee_id, work_items(difficulty)').eq('is_primary', true),
      supabase.from('work_assignments')
        .select('work_item_id, difficulty_opinion, employee_id, employees(name)')
        .eq('is_primary', false)
        .not('difficulty_opinion', 'is', null),
      supabase.from('work_preferences').select('work_item_id, employee_id, reason, employees(name)').order('created_at'),
    ])
    setUnassigned(r0.data || [])
    setEmployees(r1.data || [])
    setAssignments(r2.data || [])
    setOpinions(r3.data || [])
    setPreferences(r4.data || [])
    setLoading(false)
  }

  const getScore = (empId) =>
    assignments.filter((a) => a.employee_id === empId)
      .reduce((sum, a) => sum + (a.work_items?.difficulty || 0), 0)

  const getItemOpinions    = (id) => opinions.filter((o) => o.work_item_id === id)
  const getItemPreferences = (id) => preferences.filter((p) => p.work_item_id === id)
  const getAvgOpinion      = (id) => {
    const ops = getItemOpinions(id)
    if (ops.length === 0) return null
    return (ops.reduce((s, o) => s + o.difficulty_opinion, 0) / ops.length).toFixed(1)
  }

  const handleAssign = async (emp) => {
    if (!selected || !canAssign) return
    setAssigning(true)
    const { data } = await supabase.from('work_assignments').insert([{
      work_item_id: selected.id, employee_id: emp.id,
      is_primary: true, status: '진행중', assigned_by: profile?.id,
    }]).select('employee_id, work_items(difficulty)').single()

    await supabase.from('work_items').update({ status: '배정완료' }).eq('id', selected.id)

    if (data) {
      setAssignments((p) => [...p, data])
      setUnassigned((p) => p.filter((it) => it.id !== selected.id))
      setSelected(null)
    }
    setAssigning(false)
  }

  const toggleSelect = (item) =>
    setSelected((prev) => prev?.id === item.id ? null : item)

  if (loading) return <div className="empty-state">불러오는 중...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* 왼쪽: 미배정 업무 목록 */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          미배정 업무 ({unassigned.length}개)
        </h3>
        {unassigned.length === 0 ? (
          <div className="empty-state">미배정 업무가 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unassigned.map((item) => {
              const itemOpns  = getItemOpinions(item.id)
              const itemPrefs = getItemPreferences(item.id)
              const avg       = getAvgOpinion(item.id)
              const isSelected = selected?.id === item.id

              return (
                <div key={item.id} style={{
                  padding: '10px 14px', borderRadius: 8,
                  border: `1.5px solid ${isSelected ? '#3b82f6' : '#e5e7eb'}`,
                  background: isSelected ? '#eff6ff' : '#fff',
                }}>
                  <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {item.projects?.name || '미분류'} · 난이도 {item.difficulty}점
                  </div>

                  {/* 직원 의견 평균 */}
                  {avg && (
                    <div style={{ fontSize: 11, color: '#4f46e5', marginTop: 4 }}>
                      📊 직원 의견 평균 {avg}점 ({itemOpns.length}건):
                      {' '}{itemOpns.map((o) => `${o.employees?.name}(${o.difficulty_opinion}점)`).join(' · ')}
                    </div>
                  )}

                  {/* 희망 신청자 */}
                  {itemPrefs.length > 0 && (
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 3 }}>
                      ✋ 희망 신청: {itemPrefs.map((p) => p.employees?.name).join(', ')}
                    </div>
                  )}

                  {/* 배정 버튼 */}
                  {canAssign && (
                    <button
                      className={`btn-sm ${isSelected ? '' : 'primary'}`}
                      style={{ marginTop: 8, width: '100%' }}
                      onClick={() => toggleSelect(item)}
                    >
                      {isSelected ? '✕ 선택 취소' : '배정'}
                    </button>
                  )}

                  {isSelected && (
                    <div style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600, marginTop: 6, textAlign: 'center' }}>
                      → 오른쪽에서 직원을 선택하세요
                    </div>
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
          {selected && (
            <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 400, marginLeft: 6 }}>
              ← "{selected.title}" 배정
            </span>
          )}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {employees.map((emp) => {
            const score     = getScore(emp.id)
            const max       = GRADE_MAX[emp.grade] || 20
            const pct       = Math.min(Math.round((score / max) * 100), 100)
            const over      = score > max
            const wouldOver = selected && (score + (selected.difficulty || 0)) > max

            return (
              <div key={emp.id} className="card" style={{
                padding: '12px 16px',
                border: `1px solid ${wouldOver ? '#fca5a5' : '#e5e7eb'}`,
                background: wouldOver ? '#fff5f5' : '#fff',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{emp.name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>{emp.grade}</span>
                    {emp.teams && (
                      <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>
                        · {emp.teams.name}
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: over ? '#dc2626' : '#374151' }}>{score}</span>
                    <span style={{ color: '#6b7280', fontSize: 12 }}>/{max}점</span>
                    {over && <div style={{ fontSize: 10, color: '#dc2626' }}>초과!</div>}
                  </div>
                </div>

                <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, marginBottom: selected ? 10 : 0 }}>
                  <div style={{
                    background: over ? '#dc2626' : pct > 80 ? '#f59e0b' : '#4f46e5',
                    width: `${pct}%`, height: '100%', borderRadius: 6, transition: 'width .3s',
                  }} />
                </div>

                {selected && canAssign && (
                  <button
                    className={`btn-sm ${wouldOver ? '' : 'primary'}`}
                    style={{ width: '100%', marginTop: 4 }}
                    disabled={assigning}
                    onClick={() => handleAssign(emp)}
                  >
                    {wouldOver ? '⚠️ 초과 경고 — ' : ''}배정 (+{selected.difficulty}점 → {score + selected.difficulty}/{max})
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
