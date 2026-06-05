import { useState, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const CATEGORY_COLOR = {
  기획: '#4f46e5', 홍보: '#ec4899', 운영: '#0ea5e9',
  행정: '#6b7280', 정산: '#f59e0b', 보고: '#059669',
}

function StarRating({ value }) {
  return (
    <span style={{ color: '#f59e0b', fontSize: 14 }}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  )
}

export default function AIWorkSuggestion({ project, onClose, onAdded }) {
  const { profile } = useAuth()
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [tasks, setTasks] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef()

  const handleFile = (f) => {
    if (!f || f.type !== 'application/pdf') { setError('PDF 파일만 업로드할 수 있습니다.'); return }
    setFile(f)
    setError('')
    setTasks([])
    setSelected(new Set())
  }

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = () => setDragOver(false)

  const toBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(f)
  })

  const analyze = async () => {
    if (!file) { setError('PDF 파일을 선택하세요.'); return }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('VITE_ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.'); return }

    setAnalyzing(true)
    setError('')
    setTasks([])

    try {
      const base64Data = await toBase64(file)

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64Data },
              },
              {
                type: 'text',
                text: `이 사업계획서를 분석해서 실무 담당자가 수행해야 할 업무 목록을 추출해줘.
반드시 아래 JSON 형식으로만 응답해. 다른 텍스트 없이 JSON만:
{
  "tasks": [
    {
      "title": "업무명",
      "description": "업무 상세 설명 (2-3문장)",
      "category": "업무 카테고리 (기획/홍보/운영/행정/정산/보고 중 하나)",
      "difficulty": 난이도 숫자 (1-5),
      "difficulty_reason": "이 난이도로 설정한 이유"
    }
  ]
}
난이도 기준:
1점: 단순 반복 행정 (서류 수령, 명단 정리 등)
2점: 기본 실무 (공문 작성, 일정 조율 등)
3점: 전문 실무 (공고문 작성, 업체 섭외, 교육 운영 등)
4점: 고난도 실무 (심사 운영, 예산 정산, 평가 관리 등)
5점: 최고난도 (사업 기획, 성과 분석, 정책 보고 등)
업무는 최소 8개 최대 20개 추출해줘. 단순하고 뻔한 업무보다 실제 사업 내용에 맞는 구체적인 업무를 추출해줘.`,
              },
            ],
          }],
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err?.error?.message || `API 오류 (${response.status})`)
      }

      const data = await response.json()
      const text = data.content?.[0]?.text || ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('AI 응답을 파싱할 수 없습니다.')

      const parsed = JSON.parse(jsonMatch[0])
      const taskList = parsed.tasks || []
      setTasks(taskList)
      setSelected(new Set(taskList.map((_, i) => i)))
    } catch (e) {
      setError(e.message || 'AI 분석 중 오류가 발생했습니다.')
    } finally {
      setAnalyzing(false)
    }
  }

  const toggleAll = () => {
    if (selected.size === tasks.length) setSelected(new Set())
    else setSelected(new Set(tasks.map((_, i) => i)))
  }

  const toggle = (i) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const handleAdd = async () => {
    if (selected.size === 0) { setError('추가할 업무를 선택하세요.'); return }
    setSaving(true)
    setError('')

    const items = [...selected].map((i) => ({
      project_id: project.id,
      title: tasks[i].title,
      description: tasks[i].description || null,
      difficulty: tasks[i].difficulty,
      difficulty_reason: tasks[i].difficulty_reason || null,
      status: '미배정',
      is_auto_generated: true,
      created_by: profile?.id || null,
    }))

    const { error: dbErr } = await supabase.from('work_items').insert(items)
    if (dbErr) { setError(dbErr.message); setSaving(false); return }

    setSaving(false)
    onAdded?.(selected.size)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* 헤더 */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>📄 AI 업무 자동 제안</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{project.name}</div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280', padding: 4,
            }}>✕</button>
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* 업로드 영역 */}
          {tasks.length === 0 && (
            <div
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              onClick={() => !file && inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#4f46e5' : '#d1d5db'}`,
                borderRadius: 10, padding: '36px 24px', textAlign: 'center',
                background: dragOver ? '#eef2ff' : '#f9fafb',
                cursor: file ? 'default' : 'pointer',
                transition: 'all 0.2s',
                marginBottom: 16,
              }}
            >
              <input ref={inputRef} type="file" accept=".pdf" style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])} />
              {file ? (
                <div>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    {(file.size / 1024).toFixed(0)} KB
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    style={{ marginTop: 8, fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    파일 변경
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }}>☁️</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>PDF 파일을 드래그하거나 클릭해서 업로드</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>사업계획서 PDF 파일 (최대 30MB)</div>
                </div>
              )}
            </div>
          )}

          {/* 분석 중 */}
          {analyzing && (
            <div style={{
              textAlign: 'center', padding: '40px 0',
              color: '#4f46e5', fontWeight: 600, fontSize: 15,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12,
                animation: 'spin 1.5s linear infinite',
                display: 'inline-block',
              }}>⚙️</div>
              <div>📄 사업계획서 분석 중...</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
                AI가 업무를 추출하고 있습니다. 잠시만 기다려주세요.
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* 업무 목록 */}
          {tasks.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  총 {tasks.length}개 업무 추출됨 &nbsp;
                  <span style={{ color: '#4f46e5' }}>{selected.size}개 선택</span>
                </div>
                <button onClick={toggleAll} style={{
                  fontSize: 12, padding: '4px 10px', borderRadius: 6,
                  border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer',
                }}>
                  {selected.size === tasks.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tasks.map((task, i) => (
                  <div key={i} onClick={() => toggle(i)} style={{
                    border: `1.5px solid ${selected.has(i) ? '#4f46e5' : '#e5e7eb'}`,
                    borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                    background: selected.has(i) ? '#f5f3ff' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => {}}
                        style={{ marginTop: 2, accentColor: '#4f46e5', cursor: 'pointer' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{task.title}</span>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 10,
                            background: (CATEGORY_COLOR[task.category] || '#6b7280') + '20',
                            color: CATEGORY_COLOR[task.category] || '#6b7280', fontWeight: 600,
                          }}>{task.category}</span>
                          <StarRating value={task.difficulty} />
                          <span style={{ fontSize: 11, color: '#6b7280' }}>난이도 {task.difficulty}</span>
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 12, color: '#374151', marginBottom: 4, lineHeight: 1.5 }}>
                            {task.description}
                          </div>
                        )}
                        {task.difficulty_reason && (
                          <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                            💡 {task.difficulty_reason}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{
              marginTop: 12, padding: '10px 14px', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13,
            }}>{error}</div>
          )}
        </div>

        {/* 푸터 */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
        }}>
          {tasks.length === 0 ? (
            <>
              <button className="btn-secondary" onClick={onClose}>취소</button>
              <button className="btn-primary" onClick={analyze} disabled={!file || analyzing}>
                🤖 AI 분석 시작
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => { setTasks([]); setSelected(new Set()); setFile(null) }}>
                다시 업로드
              </button>
              <button className="btn-secondary" onClick={onClose}>취소</button>
              <button className="btn-primary" onClick={handleAdd} disabled={saving || selected.size === 0}>
                {saving ? '추가 중...' : `선택한 업무 추가 (${selected.size}개)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
