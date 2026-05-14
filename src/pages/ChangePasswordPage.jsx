import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const ROLE_ROUTES = {
  admin: '/admin', director: '/director', manager: '/manager', employee: '/employee',
}

export default function ChangePasswordPage() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [error, setError]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPw.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (newPw !== confirmPw) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setSubmitting(true)

    // DB 먼저 업데이트 → 이후 USER_UPDATED 이벤트 발생 시 is_first_login이 false임을 보장
    if (profile?.id) {
      await supabase.from('employees').update({ is_first_login: false }).eq('id', profile.id)
    }

    const { error: authErr } = await supabase.auth.updateUser({ password: newPw })
    if (authErr) {
      setError('비밀번호 변경에 실패했습니다: ' + authErr.message)
      setSubmitting(false)
      return
    }

    // 로컬 프로필 상태를 낙관적으로 업데이트 (리다이렉트 루프 방지)
    updateProfile({ is_first_login: false })
    navigate(ROLE_ROUTES[profile?.role] || '/', { replace: true })
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-icon">🔒</div>
          <h1>비밀번호 변경</h1>
          <p>첫 로그인입니다. 새 비밀번호를 설정해주세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">새 비밀번호</label>
            <input
              type="password"
              className="form-input"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="8자 이상 입력"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호 확인</label>
            <input
              type="password"
              className="form-input"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="비밀번호를 다시 입력"
              required
            />
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" className="btn-login" disabled={submitting}>
            {submitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
