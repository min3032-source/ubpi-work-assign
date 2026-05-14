import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const GRADE_MAX = { '주임': 15, '선임': 18, '책임': 20, '팀장': 25, '부장': 30, '관리자': 30 }
const ASSIGN_STATUS = ['진행중', '완료', '보류']

export default function WorkStatusPage() {
  const { profile } = useAuth()
  const [myAsgns, setMyAsgns]         = useState([])
  const [teamAsgns, setTeamAsgns]     = useState([])
  const [employees, setEmployees]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [viewTab, setViewTab]         = useState('my')

  useEffect(() => { if (profile?.id) load() }, [profile])

  const load = async () => {
    setLoading(true)
    const [{ data: mine }, { data: emps }, { data: all }] = await Promise.all([
      supabase.from('work_assignments')
        .select('*, work_items(id, title, difficulty, status, projects(name))')
        .eq('employee_id', profile.id).eq('is_primary', true)
        .order('assigned_at', { ascending: false }),
      supabase.from('employees').select('id, name, grade').order('created_at'),
      supabase.from('work_assignments')
        .select('employee_id, status, work_items(title, difficulty), employees(name, grade)')
        .eq('is_primary', true),
    ])
    setMyAsgns(mine || [])
    setEmployees(emps || [])
    setTeamAsgns(all || [])
    setLoading(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('work_assignments').update({ status }).eq('id', id)
    setMyAsgns((p) => p.map((a) => a.id === id ? { ...a, status } : a))
  }

  const handleDiffOpinion = async (id, val) => {
    await supabase.from('work_assignments').update({ difficulty_opinion: Number(val) }).eq('id', id)
    setMyAsgns((p) => p.map((a) => a.id === id ? { ...a, difficulty_opinion: Number(val) } : a))
  }

  const myScore = myAsgns.reduce((s, a) => s + (a.work_items?.difficulty || 0), 0)
  const myMax   = GRADE_MAX[profile?.grade] || 20
  const myPct   = Math.min(Math.round((myScore / myMax) * 100), 100)

  if (loading) return <div className="empty-state">불러오는 중...</div>

  return (
    <div className="page">
      <div className="page-header">
        <h1>내 업무 현황</h1>
        <p>배정된 업무를 확인하고 진행 상태를 관리합니다</p>
      </div>

      <div className="tabs" style={{ marginBottom: 20 }}>
        {[['my', '내 업무'], ['team', '팀 전체 현황']].map(([key, label]) => (
          <button key={key} className={`tab ${viewTab === key ? 'active' : ''}`}
            onClick={() => setViewTab(key)}>{label}</button>
        ))}
      </div>

      {viewTab === 'my' && (
        <div>
          {/* 내 점수 요약 */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{profile?.name}</span>
                <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 13 }}>{profile?.grade}</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 16, color: myScore > myMax ? '#dc2626' : '#374151' }}>
                {myScore} / {myMax}점
              </span>
            </div>
            <div style={{ background: '#e5e7eb', borderRadius: 6, height: 10 }}>
              <div style={{
                background: myScore > myMax ? '#dc2626' : myPct > 80 ? '#f59e0b' : '#4f46e5',
                width: `${myPct}%`, height: '100%', borderRadius: 6, transition: 'width .3s',
              }} />
            </div>
            {myScore > myMax && (
              <div style={{ fontSize: 12, color: '#dc2626', marginTop: 6 }}>⚠️ 최대 점수를 초과했습니다. 팀장에게 조정을 요청하세요.</div>
            )}
          </div>

          {myAsgns.length === 0 ? (
            <div className="empty-state">배정된 업무가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myAsgns.map((asgn) => (
                <div key={asgn.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 500 }}>{asgn.work_items?.title}</div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {asgn.work_items?.projects?.name} · 난이도 {asgn.work_items?.difficulty}점
                      </div>
                    </div>
                    <select className="inline-select" value={asgn.status}
                      onChange={(e) => handleStatusChange(asgn.id, e.target.value)}>
                      {ASSIGN_STATUS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>내 난이도 의견:</span>
                    <select className="inline-select" value={asgn.difficulty_opinion || ''}
                      onChange={(e) => handleDiffOpinion(asgn.id, e.target.value)}>
                      <option value="">미입력</option>
                      {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}점</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {employees.map((emp) => {
            const empAsgn = teamAsgns.filter((a) => a.employee_id === emp.id)
            const score   = empAsgn.reduce((s, a) => s + (a.work_items?.difficulty || 0), 0)
            const max     = GRADE_MAX[emp.grade] || 20
            const pct     = Math.min(Math.round((score / max) * 100), 100)
            return (
              <div key={emp.id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 500 }}>
                    {emp.name} <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280' }}>{emp.grade}</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: score > max ? '#dc2626' : '#374151' }}>
                    {score}/{max}점
                  </span>
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, marginBottom: 6 }}>
                  <div style={{
                    background: score > max ? '#dc2626' : '#10b981',
                    width: `${pct}%`, height: '100%', borderRadius: 6,
                  }} />
                </div>
                {empAsgn.length > 0 && (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {empAsgn.map((a) => a.work_items?.title).join(' · ')}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
