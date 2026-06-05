import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

export default function WorkPoolPage() {
  const { profile } = useAuth()
  const [projects, setProjects]       = useState([])
  const [workItems, setWorkItems]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [opinions, setOpinions]       = useState([])
  const [comments, setComments]       = useState([])
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading]         = useState(true)

  const [commentingId, setCommentingId]         = useState(null)
  const [commentText, setCommentText]           = useState('')
  const [diffOpinionId, setDiffOpinionId]       = useState(null)
  const [diffOpinionVal, setDiffOpinionVal]     = useState(3)
  const [preferenceId, setPreferenceId]         = useState(null)
  const [preferenceReason, setPreferenceReason] = useState('')

  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestForm, setSuggestForm] = useState({ title: '', project_id: '', difficulty: 2, description: '' })
  const [summaryOpen, setSummaryOpen] = useState(false)

  const isAdmin = profile && ['admin', 'director', 'manager'].includes(profile.role)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [r0, r1, r2, r3, r4, r5] = await Promise.all([
      supabase.from('projects').select('id, name, type, status').order('created_at', { ascending: false }),
      supabase.from('work_items').select('*').order('created_at'),
      supabase.from('work_assignments').select('*, employees(name, grade)').eq('is_primary', true),
      supabase.from('work_comments').select('*, employees(name)').order('created_at'),
      supabase.from('work_assignments')
        .select('id, work_item_id, difficulty_opinion, employee_id, employees(name)')
        .eq('is_primary', false)
        .not('difficulty_opinion', 'is', null),
      supabase.from('work_preferences').select('*, employees(name)').order('created_at'),
    ])
    setProjects(r0.data || [])
    setWorkItems(r1.data || [])
    setAssignments(r2.data || [])
    setComments(r3.data || [])
    setOpinions(r4.data || [])
    setPreferences(r5.data || [])
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
    const existing = opinions.find(
      (o) => o.work_item_id === workItemId && o.employee_id === profile?.id
    )
    if (existing) {
      await supabase.from('work_assignments').update({ difficulty_opinion: diffOpinionVal }).eq('id', existing.id)
      setOpinions((p) => p.map((o) => o.id === existing.id ? { ...o, difficulty_opinion: diffOpinionVal } : o))
    } else {
      const { data } = await supabase.from('work_assignments').insert([{
        work_item_id: workItemId, employee_id: profile?.id,
        difficulty_opinion: diffOpinionVal, is_primary: false, assigned_by: profile?.id,
      }]).select('id, work_item_id, difficulty_opinion, employee_id, employees(name)').single()
      if (data) setOpinions((p) => [...p, data])
    }
    setDiffOpinionId(null)
  }

  const submitPreference = async (workItemId) => {
    const { data } = await supabase.from('work_preferences').insert([{
      work_item_id: workItemId, employee_id: profile?.id,
      reason: preferenceReason || null,
    }]).select('*, employees(name)').single()
    if (data) {
      setPreferences((p) => [...p, data])
      setPreferenceReason('')
      setPreferenceId(null)
    }
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

  const getPrimaryAssignment = (id) => assignments.find((a) => a.work_item_id === id && a.is_primary)
  const getItemComments      = (id) => comments.filter((c) => c.work_item_id === id)
  const getItemOpinions      = (id) => opinions.filter((o) => o.work_item_id === id)
  const getItemPreferences   = (id) => preferences.filter((p) => p.work_item_id === id)
  const getAvgOpinion        = (id) => {
    const ops = getItemOpinions(id)
    if (ops.length === 0) return null
    return (ops.reduce((s, o) => s + o.difficulty_opinion, 0) / ops.length).toFixed(1)
  }
  const hasMyPreference = (id) =>
    preferences.some((p) => p.work_item_id === id && p.employee_id === profile?.id)

  if (loading) return <div className="empty-state">불러오는 중...</div>

  const grouped = {}
  workItems.forEach((item) => {
    const key = item.project_id || '__none__'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)
  })

  return (
    <div>
      {/* 관리자용 의견 현황 요약 패널 */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20, padding: '14px 18px' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setSummaryOpen((v) => !v)}
          >
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13 }}>📊 난이도 의견 <strong>{opinions.length}건</strong></span>
              <span style={{ fontSize: 13 }}>💬 댓글 <strong>{comments.length}건</strong></span>
              <span style={{ fontSize: 13 }}>✋ 희망 신청 <strong>{preferences.length}건</strong></span>
            </div>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{summaryOpen ? '▲ 접기' : '▼ 자세히'}</span>
          </div>

          {summaryOpen && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#4f46e5' }}>📊 난이도 의견</div>
                {opinions.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>없음</div>
                ) : opinions.slice(0, 10).map((o, i) => {
                  const item = workItems.find((w) => w.id === o.work_item_id)
                  return (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280' }}>{item?.title || '-'}</span>
                      {' · '}{o.employees?.name} → <strong>{o.difficulty_opinion}점</strong>
                    </div>
                  )
                })}
                {opinions.length > 10 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>+{opinions.length - 10}건 더</div>}
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#0ea5e9' }}>💬 최근 댓글</div>
                {comments.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>없음</div>
                ) : comments.slice(0, 10).map((c) => {
                  const item = workItems.find((w) => w.id === c.work_item_id)
                  return (
                    <div key={c.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280' }}>{item?.title || '-'}</span>
                      {' · '}<strong>{c.employees?.name}</strong>: {c.comment.length > 20 ? c.comment.slice(0, 20) + '…' : c.comment}
                    </div>
                  )
                })}
                {comments.length > 10 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>+{comments.length - 10}건 더</div>}
              </div>

              <div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#059669' }}>✋ 희망 신청</div>
                {preferences.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>없음</div>
                ) : preferences.slice(0, 10).map((p) => {
                  const item = workItems.find((w) => w.id === p.work_item_id)
                  return (
                    <div key={p.id} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ color: '#6b7280' }}>{item?.title || '-'}</span>
                      {' · '}<strong>{p.employees?.name}</strong>
                      {p.reason && <span style={{ color: '#9ca3af' }}>: {p.reason.length > 18 ? p.reason.slice(0, 18) + '…' : p.reason}</span>}
                    </div>
                  )
                })}
                {preferences.length > 10 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>+{preferences.length - 10}건 더</div>}
              </div>
            </div>
          )}
        </div>
      )}

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
              {proj ? proj.name : '미분류 업무'}
              <span style={{ fontWeight: 400, fontSize: 13, color: '#9ca3af' }}> ({items.length}개)</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {items.map((item) => {
                const asgn   = getPrimaryAssignment(item.id)
                const cmts   = getItemComments(item.id)
                const opns   = getItemOpinions(item.id)
                const prefs  = getItemPreferences(item.id)
                const avg    = getAvgOpinion(item.id)
                const isAsgn = !!asgn
                const myPref = hasMyPreference(item.id)

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
                      <div style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                        담당: {asgn.employees?.name} ({asgn.employees?.grade})
                      </div>
                    )}

                    {/* 카운트 뱃지 */}
                    {(cmts.length > 0 || opns.length > 0 || prefs.length > 0) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {cmts.length > 0 && (
                          <span style={{ fontSize: 11, color: '#0ea5e9', background: '#e0f2fe', padding: '2px 7px', borderRadius: 10 }}>
                            💬 댓글 {cmts.length}개
                          </span>
                        )}
                        {opns.length > 0 && (
                          <span style={{ fontSize: 11, color: '#4f46e5', background: '#eef2ff', padding: '2px 7px', borderRadius: 10 }}>
                            📊 난이도 의견 {opns.length}개 (평균 {avg})
                          </span>
                        )}
                        {prefs.length > 0 && (
                          <span style={{ fontSize: 11, color: '#059669', background: '#d1fae5', padding: '2px 7px', borderRadius: 10 }}>
                            ✋ 희망 {prefs.length}명
                          </span>
                        )}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="btn-sm" onClick={() => {
                        setCommentingId(commentingId === item.id ? null : item.id)
                        setCommentText('')
                      }}>
                        💬 의견 달기
                      </button>
                      <button className="btn-sm" onClick={() => {
                        setDiffOpinionId(diffOpinionId === item.id ? null : item.id)
                        setDiffOpinionVal(item.difficulty || 3)
                      }}>
                        📊 난이도 의견
                      </button>
                      {myPref ? (
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 6,
                          background: '#d1fae5', color: '#059669', fontWeight: 600,
                        }}>
                          ✅ 신청완료
                        </span>
                      ) : (
                        <button className="btn-sm" onClick={() => {
                          setPreferenceId(preferenceId === item.id ? null : item.id)
                          setPreferenceReason('')
                        }}>
                          ✋ 희망 신청
                        </button>
                      )}
                    </div>

                    {/* 의견 달기 패널 */}
                    {commentingId === item.id && (
                      <div style={{ marginTop: 10 }}>
                        {cmts.length > 0 && (
                          <div style={{ marginBottom: 6 }}>
                            {cmts.map((c) => (
                              <div key={c.id} style={{ fontSize: 12, color: '#374151', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                                <strong>{c.employees?.name}</strong>: {c.comment}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input className="inline-input" style={{ flex: 1 }} placeholder="의견 입력"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitComment(item.id)} />
                          <button className="btn-sm primary" onClick={() => submitComment(item.id)}>등록</button>
                        </div>
                      </div>
                    )}

                    {/* 난이도 의견 패널 */}
                    {diffOpinionId === item.id && (
                      <div style={{ marginTop: 10 }}>
                        {opns.length > 0 && (
                          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, lineHeight: 1.6 }}>
                            {opns.map((o) => `${o.employees?.name}(${o.difficulty_opinion}점)`).join(' · ')}
                            <span style={{ color: '#4f46e5', fontWeight: 600, marginLeft: 6 }}>→ 평균 {avg}점</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#6b7280' }}>내 의견:</span>
                          <select className="inline-select" value={diffOpinionVal}
                            onChange={(e) => setDiffOpinionVal(Number(e.target.value))}>
                            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}점</option>)}
                          </select>
                          <button className="btn-sm primary" onClick={() => submitDiffOpinion(item.id)}>제출</button>
                          <button className="btn-sm" onClick={() => setDiffOpinionId(null)}>취소</button>
                        </div>
                      </div>
                    )}

                    {/* 희망 신청 패널 */}
                    {preferenceId === item.id && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          className="inline-input"
                          style={{ width: '100%', marginBottom: 6 }}
                          placeholder="신청 이유 (선택사항)"
                          value={preferenceReason}
                          onChange={(e) => setPreferenceReason(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submitPreference(item.id)}
                        />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-sm primary" onClick={() => submitPreference(item.id)}>신청</button>
                          <button className="btn-sm" onClick={() => setPreferenceId(null)}>취소</button>
                        </div>
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
