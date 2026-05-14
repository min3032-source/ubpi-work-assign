import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const PROJECT_TYPE_OPTIONS = ['창업지원','기업지원','일자리지원','교육사업','마케팅지원','기타']
const STATUS_OPTIONS = ['준비중','진행중','완료','취소']

const AUTO_TASKS = {
  창업지원: [
    { title: '공고 작성', difficulty: 3 },
    { title: '접수 관리', difficulty: 2 },
    { title: '심사 운영', difficulty: 4 },
    { title: '선정기업 관리', difficulty: 3 },
    { title: '교육 운영', difficulty: 3 },
    { title: '정산', difficulty: 4 },
    { title: '결과보고', difficulty: 3 },
  ],
  교육사업: [
    { title: '강사 섭외', difficulty: 3 },
    { title: '커리큘럼 구성', difficulty: 4 },
    { title: '홍보', difficulty: 2 },
    { title: '수강생 모집', difficulty: 2 },
    { title: '교육 운영', difficulty: 3 },
    { title: '만족도 조사', difficulty: 2 },
    { title: '수료 처리', difficulty: 2 },
  ],
  기업지원: [
    { title: '수요조사', difficulty: 2 },
    { title: '공고', difficulty: 2 },
    { title: '접수', difficulty: 2 },
    { title: '평가', difficulty: 4 },
    { title: '지원금 지급', difficulty: 3 },
    { title: '사후관리', difficulty: 3 },
    { title: '성과보고', difficulty: 3 },
  ],
  일자리지원: [
    { title: '기획', difficulty: 3 },
    { title: '기업 모집', difficulty: 3 },
    { title: '구직자 모집', difficulty: 2 },
    { title: '현장 운영', difficulty: 4 },
    { title: '결과보고', difficulty: 3 },
  ],
}

const TYPE_COLOR = {
  창업지원: '#4f46e5', 기업지원: '#059669', 일자리지원: '#f59e0b',
  교육사업: '#0ea5e9', 마케팅지원: '#ec4899', 기타: '#6b7280',
}

const EMPTY_FORM = { name: '', type: '창업지원', description: '', start_date: '', end_date: '', status: '진행중' }

export default function ProjectPage() {
  const { profile } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const canEdit = profile && ['admin', 'director', 'manager'].includes(profile.role)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('projects')
      .select('*, teams(name, departments(name))')
      .order('created_at', { ascending: false })
    setProjects(data || [])
    setLoading(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('사업명을 입력하세요.'); return }
    setSaving(true)
    setError('')

    const { data: proj, error: projErr } = await supabase
      .from('projects')
      .insert([{
        name: form.name, type: form.type,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        created_by: profile?.id || null,
      }])
      .select('*').single()

    if (projErr) { setError(projErr.message); setSaving(false); return }

    const autoItems = AUTO_TASKS[form.type] || []
    if (autoItems.length > 0) {
      await supabase.from('work_items').insert(
        autoItems.map((item) => ({
          project_id: proj.id, title: item.title, difficulty: item.difficulty,
          is_auto_generated: true, status: '미배정', created_by: profile?.id || null,
        }))
      )
    }

    setProjects((p) => [proj, ...p])
    setForm(EMPTY_FORM)
    setShowForm(false)
    setSaving(false)
  }

  const handleStatusChange = async (id, status) => {
    await supabase.from('projects').update({ status }).eq('id', id)
    setProjects((p) => p.map((pr) => pr.id === id ? { ...pr, status } : pr))
  }

  const handleDelete = async (id) => {
    if (!window.confirm('사업을 삭제하면 모든 업무도 함께 삭제됩니다.')) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects((p) => p.filter((pr) => pr.id !== id))
  }

  if (loading) return <div className="empty-state">불러오는 중...</div>

  return (
    <div>
      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button className="btn-primary" onClick={() => { setShowForm((v) => !v); setError('') }}>
            + 사업 추가
          </button>
        </div>
      )}

      {showForm && (
        <div className="admin-form-card" style={{ marginBottom: 20 }}>
          <h3>새 사업 등록</h3>
          <div className="admin-form-grid">
            <div className="form-group">
              <label className="form-label">사업명 *</label>
              <input className="form-input" placeholder="사업명" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">사업 유형</label>
              <select className="form-select" value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                {PROJECT_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">상태</label>
              <select className="form-select" value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">시작일</label>
              <input className="form-input" type="date" value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">종료일</label>
              <input className="form-input" type="date" value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">설명</label>
              <textarea className="form-input" rows={2} placeholder="사업 설명 (선택)"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                style={{ resize: 'vertical' }} />
            </div>
          </div>
          {AUTO_TASKS[form.type] && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, padding: '8px 12px', background: '#f3f4f6', borderRadius: 6 }}>
              자동 생성 업무 ({AUTO_TASKS[form.type].length}개): {AUTO_TASKS[form.type].map((t) => `${t.title}(난이도${t.difficulty})`).join(' · ')}
            </div>
          )}
          {error && <div className="alert-error">{error}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn-primary" disabled={saving} onClick={handleCreate}>
              {saving ? '저장 중...' : '등록'}
            </button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>취소</button>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="empty-state">등록된 사업이 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {projects.map((proj) => (
            <div key={proj.id} className="card" style={{
              padding: '16px 20px',
              borderTop: `3px solid ${TYPE_COLOR[proj.type] || '#6b7280'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{proj.name}</div>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 12,
                    background: (TYPE_COLOR[proj.type] || '#6b7280') + '20',
                    color: TYPE_COLOR[proj.type] || '#6b7280', fontWeight: 500,
                  }}>{proj.type}</span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  color: proj.status === '완료' ? '#059669' : proj.status === '취소' ? '#dc2626' : '#f59e0b',
                }}>{proj.status}</span>
              </div>
              {proj.description && (
                <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>{proj.description}</div>
              )}
              {(proj.start_date || proj.end_date) && (
                <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                  {proj.start_date || '?'} ~ {proj.end_date || '?'}
                </div>
              )}
              {canEdit && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <select className="inline-select" style={{ flex: 1, fontSize: 12 }} value={proj.status}
                    onChange={(e) => handleStatusChange(proj.id, e.target.value)}>
                    {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button className="btn-sm danger" onClick={() => handleDelete(proj.id)}>삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
