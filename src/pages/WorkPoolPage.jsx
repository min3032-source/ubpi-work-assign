import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function WorkPoolPage() {
  const { profile } = useAuth()
  const [projects, setProjects]     = useState([])
  const [workItems, setWorkItems]   = useState([])
  const [assignments, setAssignments] = useState([])
  const [comments, setComments]     = useState([])
  const [loading, setLoading]       = useState(true)

  const [commentingId, setCommentingId]   = useState(null)
  const [commentText, setCommentText]     = useState('')
  const [diffOpinionId, setDiffOpinionId] = useState(null)
  const [diffOpinionVal, setDiffOpinionVal] = useState(3)

  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestForm, setSuggestForm] = useState({ title: '', project_id: '', difficulty: 2, description: '' })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: projs }, { data: items }, { data: asgn }, { data: cmts }] = await Promise.all([
      supabase.from('projects').select('id, name, type, status').order('created_at', { ascending: false }),
      supabase.from('work_items').select('*').order('created_at'),
      supabase.from('work_assignments').select('*, employees(name, grade)').eq('is_primary', true),
      supabase.from('work_comments').select('*, employees(name)').order('created_at'),
    ])
    setProjects(projs || [])
    setWorkItems(items || [])
    setAssignments(asgn || [])
    setComments(cmts || [])
    setLoading(false)
  }

  const submitComment = async (workItemId) => {
    if (!commentText.trim()) return
    const { data } = await supabase.from('work_comments').insert([{
      work_item_id: workItemId, employee_id: profile?.id, comment: commentText,
    }]).select('*, employees(name)').single()
    if (data) {
      setComments((p) => [...p, data])
      setCommentText('')
      setCommentingId(null)
    }
  }

  const submitDiffOpinion = async (workItemId) => {
    const existing = assignments.find(
      (a) => a.work_item_id === workItemId && a.employee_id === profile?.id && !a.is_primary
    )
    if (existing) {
      await supabase.from('work_assignments').update({ difficulty_opinion: diffOpinionVal }).eq('id', existing.id)
      setAssignments((p) => p.map((a) => a.id === existing.id ? { ...a, difficulty_opinion: diffOpinionVal } : a))
    } else {
      const { data } = await supabase.from('work_assignments').insert([{
        work_item_id: workItemId, employee_id: profile?.id,
        difficulty_opinion: diffOpinionVal, is_primary: false, assigned_by: profile?.id,
      }]).select('*, employees(name, grade)').single()
      if (data) setAssignments((p) => [...p, data])
    }
    setDiffOpinionId(null)
  }

  const submitSuggest = async () => {
    if (!suggestForm.title.trim()) return
    const { data } = await supabase.from('work_items').insert([{
      project_id: suggestForm.project_id || null,
      title: suggestForm.title,
      difficulty: Number(suggestForm.difficulty),
      description: suggestForm.description || null,
      status: '미배정', is_auto_generated: false, created_by: profile?.id,
    }]).select('*').single()
    if (data) {
      setWorkItems((p) => [...p, data])
      setSuggestForm({ title: '', project_id: '', difficulty: 2, description: '' })
      setShowSuggest(false)
    }
  }

  const getPrimaryAssignment = (itemId) => assignments.find((a) => a.work_item_id === itemId && a.is_primary)
  const getItemComments = (itemId) => comments.filter((c) => c.work_item_id === itemId)

  if (loading) return <div className="empty-state">불러오는 중...</div>

  // 사업별 그룹핑
  const grouped = {}
  workItems.forEach((item) => {
    const key = item.project_id || '__none__'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn-primary" onClick={() => setShowSuggest((v) => !v)}>
          + 업무 추가 제안
        </button>
      </div>

      {showSuggest && (
        <div className="admin-form-card" style={{ marginBottom: 20 }}>
          <h3>업무 추가 제안</h3>
          <div className="admin-form-grid">
            <div className="form-group">
              <label className="form-label">업무명 *</label>
              <input className="form-input" placeholder="업무명" value={suggestForm.title}
                onChange={(e) => setSuggestForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">사업 (선택)</label>
              <select className="form-select" value={suggestForm.project_id}
                onChange={(e) => setSuggestForm((p) => ({ ...p, project_id: e.target.value }))}>
                <option value="">사업 선택</option>
                {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">예상 난이도</label>
              <select className="form-select" value={suggestForm.difficulty}
                onChange={(e) => setSuggestForm((p) => ({ ...p, difficulty: e.target.value }))}>
                {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}점</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">설명 (선택)</label>
              <input className="form-input" placeholder="업무 설명" value={suggestForm.description}
                onChange={(e) => setSuggestForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-primary" onClick={submitSuggest}>제안하기</button>
            <button className="btn-secondary" onClick={() => setShowSuggest(false)}>취소</button>
          </div>
        </div>
      )}

      {Object.entries(grouped).map(([projId, items]) => {
        const proj = projects.find((p) => p.id === projId)
        return (
          <div key={projId} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
              {proj ? proj.name : '미분류 업무'} <span style={{ fontWeight: 400, fontSize: 13, color: '#9ca3af' }}>({items.length}개)</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {items.map((item) => {
                const asgn   = getPrimaryAssignment(item.id)
                const cmts   = getItemComments(item.id)
                const isAsgn = !!asgn

                return (
                  <div key={item.id} className="card" style={{
                    padding: '14px 16px',
                    borderLeft: `4px solid ${isAsgn ? '#059669' : '#3b82f6'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 500 }}>{item.title}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: isAsgn ? '#059669' : '#3b82f6' }}>
                        {isAsgn ? '배정완료' : '미배정'}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 4 }}>
                      {STARS(item.difficulty || 0)}
                      <span style={{ color: '#6b7280', marginLeft: 6, fontSize: 12 }}>난이도 {item.difficulty}</span>
                    </div>
                    {asgn && (
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                        담당: {asgn.employees?.name} ({asgn.employees?.grade})
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <button className="btn-sm" onClick={() => {
                        setCommentingId(commentingId === item.id ? null : item.id)
                        setCommentText('')
                      }}>
                        의견 달기{cmts.length > 0 && ` (${cmts.length})`}
                      </button>
                      <button className="btn-sm" onClick={() => {
                        setDiffOpinionId(diffOpinionId === item.id ? null : item.id)
                        setDiffOpinionVal(item.difficulty || 3)
                      }}>
                        난이도 의견
                      </button>
                    </div>

                    {commentingId === item.id && (
                      <div style={{ marginTop: 10 }}>
                        {cmts.map((c) => (
                          <div key={c.id} style={{ fontSize: 12, color: '#374151', padding: '3px 0', borderBottom: '1px solid #f3f4f6' }}>
                            <strong>{c.employees?.name}</strong>: {c.comment}
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                          <input className="inline-input" style={{ flex: 1 }} placeholder="의견 입력"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitComment(item.id)} />
                          <button className="btn-sm primary" onClick={() => submitComment(item.id)}>등록</button>
                        </div>
                      </div>
                    )}

                    {diffOpinionId === item.id && (
                      <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#6b7280' }}>내 의견:</span>
                        <select className="inline-select" value={diffOpinionVal}
                          onChange={(e) => setDiffOpinionVal(Number(e.target.value))}>
                          {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}점</option>)}
                        </select>
                        <button className="btn-sm primary" onClick={() => submitDiffOpinion(item.id)}>제출</button>
                        <button className="btn-sm" onClick={() => setDiffOpinionId(null)}>취소</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {Object.keys(grouped).length === 0 && (
        <div className="empty-state">등록된 업무가 없습니다.</div>
      )}
    </div>
  )
}
