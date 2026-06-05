import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const STARS = (n) => '★'.repeat(n) + '☆'.repeat(5 - n)

const TYPE_META = {
  사업업무: { color: '#3b82f6', bg: '#eff6ff' },
  정기업무: { color: '#059669', bg: '#d1fae5' },
  행정업무: { color: '#f59e0b', bg: '#fffbeb' },
  돌발업무: { color: '#dc2626', bg: '#fef2f2' },
}
const TYPE_TABS = ['전체', '사업업무', '정기업무', '행정업무', '돌발업무']

const EMPTY_ADMIN_FORM = {
  title: '', work_type: '사업업무', project_id: '',
  difficulty: 3, description: '', is_recurring: false, recurring_cycle: '매월',
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function WorkPoolPage() {
  const { profile } = useAuth()
  const [projects, setProjects]       = useState([])
  const [workItems, setWorkItems]     = useState([])
  const [assignments, setAssignments] = useState([])
  const [opinions, setOpinions]       = useState([])
  const [comments, setComments]       = useState([])
  const [preferences, setPreferences] = useState([])
  const [loading, setLoading]         = useState(true)

  const [typeFilter, setTypeFilter] = useState('전체')

  const [commentingId, setCommentingId]         = useState(null)
  const [commentText, setCommentText]           = useState('')
  const [diffOpinionId, setDiffOpinionId]       = useState(null)
  const [diffOpinionVal, setDiffOpinionVal]     = useState(3)
  const [preferenceId, setPreferenceId]         = useState(null)
  const [preferenceReason, setPreferenceReason] = useState('')

  const [showAdminCreate, setShowAdminCreate] = useState(false)
  const [adminForm, setAdminForm]             = useState(EMPTY_ADMIN_FORM)
  const [adminSaving, setAdminSaving]         = useState(false)

  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestForm, setSuggestForm] = useState({ title: '', project_id: '', difficulty: 2, description: '' })

  const [summaryModal, setSummaryModal] = useState(null)

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
    }
  }

  const submitDiffOpinion = async (workItemId) => {
    const existing = opinions.find((o) => o.work_item_id === workItemId && o.employee_id === profile?.id)
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
      work_item_id: workItemId, employee_id: profile?.id, reason: preferenceReason || null,
    }]).select('*, employees(name)').single()
    if (data) {
      setPreferences((p) => [...p, data])
      setPreferenceReason('')
      setPreferenceId(null)
    }
  }

  const submitAdminCreate = async () => {
    if (!adminForm.title.trim()) return
    setAdminSaving(true)
    const { data } = await supabase.from('work_items').insert([{
      title: adminForm.title,
      work_type: adminForm.work_type,
      project_id: adminForm.work_type === '사업업무' && adminForm.project_id ? adminForm.project_id : null,
      difficulty: Number(adminForm.difficulty),
      description: adminForm.description || null,
      is_recurring: adminForm.is_recurring,
      recurring_cycle: adminForm.is_recurring ? adminForm.recurring_cycle : null,
      status: '미배정', is_auto_generated: false, created_by: profile?.id,
    }]).select('*').single()
    if (data) {
      setWorkItems((p) => [...p, data])
      setAdminForm(EMPTY_ADMIN_FORM)
      setShowAdminCreate(false)
    }
    setAdminSaving(false)
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
  const hasMyPreference = (id) => preferences.some((p) => p.work_item_id === id && p.employee_id === profile?.id)

  if (loading) return <div className="empty-state">불러오는 중...</div>

  const filteredItems = typeFilter === '전체'
    ? workItems
    : workItems.filter((i) => (i.work_type || '사업업무') === typeFilter)

  const useGrouped = typeFilter === '전체' || typeFilter === '사업업무'
  const grouped = {}
  if (useGrouped) {
    filteredItems.forEach((item) => {
      const key = item.project_id || '__none__'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(item)
    })
  }

  const renderCard = (item) => {
    const asgn   = getPrimaryAssignment(item.id)
    const cmts   = getItemComments(item.id)
    const opns   = getItemOpinions(item.id)
    const prefs  = getItemPreferences(item.id)
    const avg    = getAvgOpinion(item.id)
    const isAsgn = !!asgn
    const myPref = hasMyPreference(item.id)
    const wtype  = item.work_type || '사업업무'
    const tm     = TYPE_META[wtype] || TYPE_META['사업업무']

    return (
      <div key={item.id} className="card" style={{ padding: '14px 16px', borderLeft: `4px solid ${tm.color}` }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, marginRight: 8 }}>{item.title}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: isAsgn ? '#059669' : '#6b7280', whiteSpace: 'nowrap' }}>
            {isAsgn ? '배정완료' : '미배정'}
          </span>
        </div>

        {/* 뱃지 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: tm.bg, color: tm.color }}>
            {wtype}
          </span>
          {item.is_recurring && (
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 500 }}>
              🔄 {item.recurring_cycle || '반복'}
            </span>
          )}
        </div>

        {/* 난이도 */}
        <div style={{ fontSize: 13, color: '#f59e0b', marginBottom: 4 }}>
          {STARS(item.difficulty || 0)}
          <span style={{ color: '#6b7280', marginLeft: 6, fontSize: 12 }}>난이도 {item.difficulty}</span>
        </div>

        {/* 담당자 */}
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
                📊 의견 {opns.length}개 (평균 {avg})
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
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, background: '#d1fae5', color: '#059669', fontWeight: 600 }}>
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
          <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
            {cmts.map((c) => (
              <div key={c.id} style={{ fontSize: 12, marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{c.employees?.name}</span>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>{formatTime(c.created_at)}</span>
                <div style={{ color: '#374151', marginTop: 1 }}>{c.comment}</div>
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

        {/* 난이도 의견 패널 */}
        {diffOpinionId === item.id && (
          <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
              현재 설정 난이도: <strong style={{ color: '#374151' }}>{item.difficulty}점</strong>
            </div>
            {opns.length > 0 && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8, lineHeight: 1.7 }}>
                {opns.map((o) => (
                  <span key={o.id} style={{ marginRight: 8 }}>
                    {o.employees?.name}<span style={{ color: '#4f46e5' }}>({o.difficulty_opinion}점)</span>
                  </span>
                ))}
                <span style={{ color: '#4f46e5', fontWeight: 600 }}>→ 평균 {avg}점</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>내 의견:</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {[1,2,3,4,5].map((n) => (
                  <span key={n}
                    style={{ fontSize: 22, cursor: 'pointer', color: n <= diffOpinionVal ? '#f59e0b' : '#d1d5db' }}
                    onClick={() => setDiffOpinionVal(n)}>★</span>
                ))}
              </div>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{diffOpinionVal}점</span>
              <button className="btn-sm primary" onClick={() => submitDiffOpinion(item.id)}>제출</button>
              <button className="btn-sm" onClick={() => setDiffOpinionId(null)}>취소</button>
            </div>
          </div>
        )}

        {/* 희망 신청 패널 */}
        {preferenceId === item.id && (
          <div style={{ marginTop: 10, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
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
  }

  return (
    <div>
      {/* 관리자 의견 현황 요약 카드 */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { key: 'opinions',    icon: '📊', label: '난이도 의견', count: opinions.length,     color: '#4f46e5' },
            { key: 'comments',   icon: '💬', label: '댓글',        count: comments.length,     color: '#0ea5e9' },
            { key: 'preferences', icon: '✋', label: '희망 신청',  count: preferences.length,  color: '#059669' },
          ].map(({ key, icon, label, count, color }) => (
            <div
              key={key}
              className="card"
              style={{ padding: '12px 16px', cursor: 'pointer', borderTop: `3px solid ${color}`, transition: 'box-shadow .15s' }}
              onClick={() => setSummaryModal(key)}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = ''}
            >
              <div style={{ fontSize: 24, fontWeight: 700, color }}>{count}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{icon} {label} 총 {count}건</div>
            </div>
          ))}
        </div>
      )}

      {/* 의견 상세 모달 */}
      {summaryModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 540,
            maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 15 }}>
                {summaryModal === 'opinions'    && '📊 난이도 의견 상세'}
                {summaryModal === 'comments'    && '💬 댓글 상세'}
                {summaryModal === 'preferences' && '✋ 희망 신청 상세'}
              </strong>
              <button onClick={() => setSummaryModal(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '12px 20px', overflowY: 'auto', flex: 1 }}>
              {summaryModal === 'opinions' && (
                opinions.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>없음</div> :
                opinions.map((o, i) => {
                  const item = workItems.find((w) => w.id === o.work_item_id)
                  return (
                    <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span style={{ fontWeight: 600 }}>{item?.title || '-'}</span>
                      <span style={{ color: '#6b7280' }}> · {o.employees?.name}</span>
                      <span style={{ color: '#4f46e5', marginLeft: 6, fontWeight: 600 }}>→ {o.difficulty_opinion}점</span>
                    </div>
                  )
                })
              )}
              {summaryModal === 'comments' && (
                comments.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>없음</div> :
                comments.map((c) => {
                  const item = workItems.find((w) => w.id === c.work_item_id)
                  return (
                    <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item?.title || '-'}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{formatTime(c.created_at)}</span>
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <span style={{ color: '#374151', fontWeight: 500 }}>{c.employees?.name}</span>
                        <span style={{ color: '#6b7280' }}>: {c.comment}</span>
                      </div>
                    </div>
                  )
                })
              )}
              {summaryModal === 'preferences' && (
                preferences.length === 0 ? <div className="text-muted" style={{ fontSize: 13 }}>없음</div> :
                preferences.map((p) => {
                  const item = workItems.find((w) => w.id === p.work_item_id)
                  return (
                    <div key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{item?.title || '-'}</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{formatTime(p.created_at)}</span>
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <span style={{ color: '#374151', fontWeight: 500 }}>{p.employees?.name}</span>
                        {p.reason && <span style={{ color: '#6b7280' }}>: {p.reason}</span>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 관리자 업무 직접 추가 모달 */}
      {showAdminCreate && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520,
            maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 16 }}>+ 업무 직접 추가</strong>
              <button onClick={() => setShowAdminCreate(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">업무명 *</label>
                <input className="form-input" placeholder="업무명" value={adminForm.title}
                  onChange={(e) => setAdminForm((p) => ({ ...p, title: e.target.value }))} />
              </div>

              <div className="form-group">
                <label className="form-label">업무 유형</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {['사업업무', '정기업무', '행정업무', '돌발업무'].map((t) => (
                    <button key={t} onClick={() => setAdminForm((p) => ({ ...p, work_type: t }))}
                      style={{
                        padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                        fontSize: 13, fontWeight: 600,
                        background: adminForm.work_type === t ? TYPE_META[t].color : '#f3f4f6',
                        color: adminForm.work_type === t ? '#fff' : '#374151',
                        transition: 'all .15s',
                      }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {adminForm.work_type === '사업업무' && (
                <div className="form-group">
                  <label className="form-label">사업 연결</label>
                  <select className="form-select" value={adminForm.project_id}
                    onChange={(e) => setAdminForm((p) => ({ ...p, project_id: e.target.value }))}>
                    <option value="">사업 선택 (선택사항)</option>
                    {projects.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">난이도</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  {[1,2,3,4,5].map((n) => (
                    <span key={n}
                      style={{ fontSize: 28, cursor: 'pointer', color: n <= adminForm.difficulty ? '#f59e0b' : '#d1d5db' }}
                      onClick={() => setAdminForm((p) => ({ ...p, difficulty: n }))}>★</span>
                  ))}
                  <span style={{ fontSize: 13, color: '#6b7280', marginLeft: 8 }}>{adminForm.difficulty}점</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">상세 설명</label>
                <textarea className="form-input" rows={2} placeholder="업무 설명 (선택사항)"
                  value={adminForm.description}
                  onChange={(e) => setAdminForm((p) => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  <input type="checkbox" checked={adminForm.is_recurring}
                    onChange={(e) => setAdminForm((p) => ({ ...p, is_recurring: e.target.checked }))}
                    style={{ accentColor: '#4f46e5' }} />
                  반복 업무
                </label>
                {adminForm.is_recurring && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    {['매주', '매월', '매년'].map((c) => (
                      <button key={c} onClick={() => setAdminForm((p) => ({ ...p, recurring_cycle: c }))}
                        style={{
                          padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
                          fontSize: 13, fontWeight: 500,
                          background: adminForm.recurring_cycle === c ? '#4f46e5' : '#f3f4f6',
                          color: adminForm.recurring_cycle === c ? '#fff' : '#374151',
                        }}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowAdminCreate(false)}>취소</button>
              <button className="btn-primary" disabled={adminSaving || !adminForm.title.trim()} onClick={submitAdminCreate}>
                {adminSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상단 버튼 바 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
        {!isAdmin && (
          <button className="btn-secondary" onClick={() => setShowSuggest((v) => !v)}>
            + 업무 추가 제안
          </button>
        )}
        {isAdmin && (
          <button className="btn-primary" onClick={() => setShowAdminCreate(true)}>
            + 업무 직접 추가
          </button>
        )}
      </div>

      {/* 일반 직원 업무 제안 폼 */}
      {showSuggest && !isAdmin && (
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

      {/* 유형 필터 탭 */}
      <div className="tabs" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {TYPE_TABS.map((t) => (
          <button key={t} className={`tab ${typeFilter === t ? 'active' : ''}`}
            onClick={() => setTypeFilter(t)}>
            {t}
            <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.75 }}>
              ({t === '전체' ? workItems.length : workItems.filter((i) => (i.work_type || '사업업무') === t).length})
            </span>
          </button>
        ))}
      </div>

      {/* 업무 목록 */}
      {filteredItems.length === 0 ? (
        <div className="empty-state">해당 유형의 업무가 없습니다.</div>
      ) : useGrouped ? (
        Object.entries(grouped).map(([projId, items]) => {
          const proj = projects.find((p) => p.id === projId)
          return (
            <div key={projId} style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
                {proj ? proj.name : '기타 업무'}
                <span style={{ fontWeight: 400, fontSize: 13, color: '#9ca3af' }}> ({items.length}개)</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                {items.map(renderCard)}
              </div>
            </div>
          )
        })
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filteredItems.map(renderCard)}
        </div>
      )}
    </div>
  )
}
