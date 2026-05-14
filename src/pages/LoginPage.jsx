import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../supabaseClient'

const ROLE_ROUTES = {
  admin: '/admin', director: '/director', manager: '/manager', employee: '/employee',
}

export default function LoginPage() {
  const { signIn, user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [showReset, setShowReset]       = useState(false)
  const [resetEmail, setResetEmail]     = useState('')
  const [resetMsg, setResetMsg]         = useState('')
  const [resetError, setResetError]     = useState('')
  const [resetting, setResetting]       = useState(false)

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(ROLE_ROUTES[profile.role] || '/', { replace: true })
    }
  }, [user, profile, loading])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    if (error) setError('이메일 또는 비밀번호가 올바르지 않습니다.')
    setSubmitting(false)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setResetError('')
    setResetMsg('')
    setResetting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) {
      setResetError('이메일 발송에 실패했습니다. 이메일 주소를 확인해주세요.')
    } else {
      setResetMsg('비밀번호 재설정 이메일을 발송했습니다. 이메일을 확인해주세요.')
    }
    setResetting(false)
  }

  if (loading) return null

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-icon">🏛</div>
          <h1>울산경제일자리진흥원</h1>
          <p>업무분장 관리 시스템</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">이메일</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력하세요"
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" className="btn-login" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={() => { setShowReset((v) => !v); setResetMsg(''); setResetError('') }}
            style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
          >
            비밀번호를 잊으셨나요?
          </button>
        </div>

        {showReset && (
          <form onSubmit={handleReset} style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
            <div className="form-group">
              <label className="form-label">가입 이메일</label>
              <input
                type="email"
                className="form-input"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="이메일을 입력하세요"
                required
              />
            </div>
            {resetError && <div className="alert-error">{resetError}</div>}
            {resetMsg && (
              <div style={{ color: '#059669', fontSize: 13, marginBottom: 8, padding: '8px 12px', background: '#d1fae5', borderRadius: 6 }}>
                {resetMsg}
              </div>
            )}
            <button type="submit" className="btn-login" disabled={resetting}>
              {resetting ? '발송 중...' : '재설정 이메일 발송'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
