import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { supabaseAdmin } from '../supabaseAdmin'
import {
  getDepartments, addDepartment, updateDepartment, deleteDepartment,
  getTeams, addTeam, updateTeam, deleteTeam,
  getEmployees, updateEmployee, deleteEmployee,
} from '../lib/storage'
import { GRADE_OPTIONS, TYPE_OPTIONS } from '../lib/constants'

const ROLE_LABELS = { admin: '관리자', director: '부장', manager: '팀장', employee: '팀원' }
const ROLE_OPTIONS = ['employee', 'manager', 'director', 'admin']

const EMPTY_FORM = { name: '', grade: '선임', type: '정규직', role: 'employee', email: '', password: '', teamId: '' }

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('employees')

  // ── 직원 ──
  const [employees, setEmployees]   = useState([])
  const [depts, setDepts]           = useState([])
  const [allTeams, setAllTeams]     = useState([])
  const [loadingEmp, setLoadingEmp] = useState(true)

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm]         = useState(EMPTY_FORM)
  const [createError, setCreateError]       = useState('')
  const [creating, setCreating]             = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState({})

  // ── 부서/팀 ──
  const [newDeptName, setNewDeptName]   = useState('')
  const [editingDeptId, setEditingDeptId] = useState(null)
  const [editDeptName, setEditDeptName] = useState('')

  const [newTeamName, setNewTeamName]     = useState('')
  const [newTeamDeptId, setNewTeamDeptId] = useState('')
  const [editingTeamId, setEditingTeamId] = useState(null)
  const [editTeamName, setEditTeamName]   = useState('')

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoadingEmp(true)
    const [emp, d] = await Promise.all([
      supabase.from('employees').select('*, teams(id, name, departments(id, name))').order('created_at'),
      getDepartments(),
    ])
    setEmployees(emp.data || [])
    setDepts(d)
    const teams = await Promise.all(d.map((dept) => getTeams(dept.id)))
    setAllTeams(teams.flat())
    setLoadingEmp(false)
  }

  // ────── 직원 계정 생성 ──────
  const handleCreate = async () => {
    if (!createForm.name || !createForm.email || !createForm.password) {
      setCreateError('이름, 이메일, 비밀번호는 필수입니다.')
      return
    }
    if (!supabaseAdmin) {
      setCreateError('VITE_SUPABASE_SERVICE_KEY가 설정되지 않았습니다. .env.local을 확인하세요.')
      return
    }
    setCreating(true)
    setCreateError('')

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: createForm.email,
      password: createForm.password,
      email_confirm: true,
    })
    if (authErr) { setCreateError(authErr.message); setCreating(false); return }

    const { data: emp, error: empErr } = await supabase.from('employees').insert([{
      name: createForm.name,
      grade: createForm.grade,
      type: createForm.type,
      role: createForm.role,
      email: createForm.email,
      auth_user_id: authData.user.id,
      team_id: createForm.teamId || null,
    }]).select('*, teams(id, name, departments(id, name))').single()

    if (empErr) { setCreateError(empErr.message); setCreating(false); return }

    setEmployees((p) => [...p, emp])
    setCreateForm(EMPTY_FORM)
    setShowCreateForm(false)
    setCreating(false)
  }

  // ────── 직원 수정 ──────
  const startEdit = (emp) => {
    setEditingId(emp.id)
    setEditForm({
      name: emp.name, grade: emp.grade, type: emp.type,
      role: emp.role, email: emp.email || '',
      team_id: emp.team_id || '',
    })
  }

  const handleSaveEdit = async () => {
    await updateEmployee(editingId, {
      name: editForm.name, grade: editForm.grade, type: editForm.type,
      role: editForm.role, email: editForm.email || null,
      team_id: editForm.team_id || null,
    })
    await loadAll()
    setEditingId(null)
  }

  // ────── 직원 삭제 ──────
  const handleDelete = async (emp) => {
    if (!window.confirm(`${emp.name}님의 계정을 삭제하시겠습니까?`)) return
    if (emp.auth_user_id && supabaseAdmin) {
      await supabaseAdmin.auth.admin.deleteUser(emp.auth_user_id)
    }
    await deleteEmployee(emp.id)
    setEmployees((p) => p.filter((e) => e.id !== emp.id))
  }

  // ────── 부서 CRUD ──────
  const handleAddDept = async () => {
    if (!newDeptName.trim()) return
    const d = await addDepartment({ name: newDeptName.trim() })
    setDepts((p) => [...p, d])
    setNewDeptName('')
  }

  const handleSaveDept = async (id) => {
    await updateDepartment(id, { name: editDeptName })
    setDepts((p) => p.map((d) => d.id === id ? { ...d, name: editDeptName } : d))
    setEditingDeptId(null)
  }

  const handleDeleteDept = async (id) => {
    if (!window.confirm('부서를 삭제하면 소속 팀도 모두 삭제됩니다.')) return
    await deleteDepartment(id)
    setDepts((p) => p.filter((d) => d.id !== id))
    setAllTeams((p) => p.filter((t) => t.dept_id !== id))
  }

  // ────── 팀 CRUD ──────
  const handleAddTeam = async () => {
    if (!newTeamName.trim() || !newTeamDeptId) return
    const t = await addTeam({ name: newTeamName.trim(), dept_id: newTeamDeptId })
    setAllTeams((p) => [...p, t])
    setNewTeamName('')
  }

  const handleSaveTeam = async (id) => {
    await updateTeam(id, { name: editTeamName })
    setAllTeams((p) => p.map((t) => t.id === id ? { ...t, name: editTeamName } : t))
    setEditingTeamId(null)
  }

  const handleDeleteTeam = async (id) => {
    if (!window.confirm('팀을 삭제하면 소속 직원의 팀 정보가 초기화됩니다.')) return
    await deleteTeam(id)
    setAllTeams((p) => p.filter((t) => t.id !== id))
  }

  const TABS = [
    { key: 'employees', label: `직원 관리 (${employees.length})` },
    { key: 'org',       label: '부서/팀 관리' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1>관리자</h1>
        <p>직원 계정 및 조직 구조를 관리합니다</p>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 직원 관리 탭 ── */}
      {activeTab === 'employees' && (
        <div className="section-body">
          <div className="mgmt-header">
            <span className="mgmt-count">전체 {employees.length}명</span>
            <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}
              onClick={() => { setShowCreateForm((v) => !v); setCreateError('') }}>
              + 계정 생성
            </button>
          </div>

          {!supabaseAdmin && (
            <div className="alert-warning" style={{ marginBottom: 14 }}>
              ⚠ VITE_SUPABASE_SERVICE_KEY가 없습니다. 계정 생성 기능을 사용하려면 .env.local에 추가하세요.
            </div>
          )}

          {showCreateForm && (
            <div className="admin-form-card">
              <h3>새 직원 계정 생성</h3>
              <div className="admin-form-grid">
                <div className="form-group">
                  <label className="form-label">이름 *</label>
                  <input className="form-input" placeholder="이름"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">이메일 *</label>
                  <input className="form-input" type="email" placeholder="이메일"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">임시 비밀번호 *</label>
                  <input className="form-input" type="password" placeholder="6자 이상"
                    value={createForm.password}
                    onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">역할</label>
                  <select className="form-select" value={createForm.role}
                    onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value }))}>
                    {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">직급</label>
                  <select className="form-select" value={createForm.grade}
                    onChange={(e) => setCreateForm((p) => ({ ...p, grade: e.target.value }))}>
                    {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">근무형태</label>
                  <select className="form-select" value={createForm.type}
                    onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}>
                    {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">소속 팀</label>
                  <select className="form-select" value={createForm.teamId}
                    onChange={(e) => setCreateForm((p) => ({ ...p, teamId: e.target.value }))}>
                    <option value="">팀 미지정</option>
                    {depts.map((dept) => (
                      <optgroup key={dept.id} label={dept.name}>
                        {allTeams.filter((t) => t.dept_id === dept.id).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              {createError && <div className="alert-error">{createError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button className="btn-primary" disabled={creating} onClick={handleCreate}>
                  {creating ? '생성 중...' : '계정 생성'}
                </button>
                <button className="btn-secondary" onClick={() => setShowCreateForm(false)}>취소</button>
              </div>
            </div>
          )}

          {loadingEmp ? (
            <div className="empty-state">불러오는 중...</div>
          ) : (
            <div className="emp-status-list">
              {employees.map((emp) => (
                <div key={emp.id} className="emp-status-row">
                  {editingId === emp.id ? (
                    <>
                      <div className="emp-edit-grid">
                        <input className="inline-input" value={editForm.name}
                          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="이름" />
                        <input className="inline-input" value={editForm.email}
                          onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} placeholder="이메일" />
                        <select className="inline-select" value={editForm.role}
                          onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}>
                          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                        <select className="inline-select" value={editForm.grade}
                          onChange={(e) => setEditForm((p) => ({ ...p, grade: e.target.value }))}>
                          {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                        </select>
                        <select className="inline-select" value={editForm.type}
                          onChange={(e) => setEditForm((p) => ({ ...p, type: e.target.value }))}>
                          {TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                        </select>
                        <select className="inline-select" value={editForm.team_id || ''}
                          onChange={(e) => setEditForm((p) => ({ ...p, team_id: e.target.value }))}>
                          <option value="">팀 미지정</option>
                          {depts.map((dept) => (
                            <optgroup key={dept.id} label={dept.name}>
                              {allTeams.filter((t) => t.dept_id === dept.id).map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <div className="action-btns">
                        <button className="btn-sm primary" onClick={handleSaveEdit}>저장</button>
                        <button className="btn-sm" onClick={() => setEditingId(null)}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="emp-status-info" style={{ flexWrap: 'wrap', gap: 6 }}>
                        <span className="emp-status-name">{emp.name}</span>
                        <span className={`role-badge-sm role-${emp.role}`}>{ROLE_LABELS[emp.role]}</span>
                        <span className="emp-status-meta">
                          {emp.grade} · {emp.type}
                          {emp.teams && ` · ${emp.teams.departments?.name} > ${emp.teams.name}`}
                        </span>
                        {emp.email && <span className="text-muted" style={{ fontSize: 12 }}>{emp.email}</span>}
                      </div>
                      <div className="action-btns">
                        <button className="btn-sm" onClick={() => startEdit(emp)}>수정</button>
                        <button className="btn-sm danger" onClick={() => handleDelete(emp)}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 부서/팀 관리 탭 ── */}
      {activeTab === 'org' && (
        <div className="section-body">
          {/* 부서 */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h2>부서 관리</h2>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <input className="form-input" placeholder="새 부서 이름"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDept()} />
              <button className="btn-primary" onClick={handleAddDept}>추가</button>
            </div>
            <div className="org-list">
              {depts.map((dept) => (
                <div key={dept.id} className="org-list-row">
                  {editingDeptId === dept.id ? (
                    <>
                      <input className="inline-input" value={editDeptName}
                        onChange={(e) => setEditDeptName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveDept(dept.id)} />
                      <button className="btn-sm primary" onClick={() => handleSaveDept(dept.id)}>저장</button>
                      <button className="btn-sm" onClick={() => setEditingDeptId(null)}>취소</button>
                    </>
                  ) : (
                    <>
                      <span className="org-list-name">🏢 {dept.name}</span>
                      <span className="text-muted" style={{ fontSize: 12 }}>
                        팀 {allTeams.filter((t) => t.dept_id === dept.id).length}개
                      </span>
                      <div className="action-btns">
                        <button className="btn-sm" onClick={() => { setEditingDeptId(dept.id); setEditDeptName(dept.name) }}>수정</button>
                        <button className="btn-sm danger" onClick={() => handleDeleteDept(dept.id)}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 팀 */}
          <div className="card">
            <h2>팀 관리</h2>
            <div className="form-row" style={{ marginBottom: 16 }}>
              <select className="form-select" value={newTeamDeptId}
                onChange={(e) => setNewTeamDeptId(e.target.value)}>
                <option value="">부서 선택</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <input className="form-input" placeholder="새 팀 이름"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTeam()} />
              <button className="btn-primary" onClick={handleAddTeam}>추가</button>
            </div>
            {depts.map((dept) => {
              const teams = allTeams.filter((t) => t.dept_id === dept.id)
              if (teams.length === 0) return null
              return (
                <div key={dept.id} style={{ marginBottom: 16 }}>
                  <div className="org-dept-label">{dept.name}</div>
                  <div className="org-list">
                    {teams.map((team) => (
                      <div key={team.id} className="org-list-row">
                        {editingTeamId === team.id ? (
                          <>
                            <input className="inline-input" value={editTeamName}
                              onChange={(e) => setEditTeamName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveTeam(team.id)} />
                            <button className="btn-sm primary" onClick={() => handleSaveTeam(team.id)}>저장</button>
                            <button className="btn-sm" onClick={() => setEditingTeamId(null)}>취소</button>
                          </>
                        ) : (
                          <>
                            <span className="org-list-name">👥 {team.name}</span>
                            <span className="text-muted" style={{ fontSize: 12 }}>
                              직원 {employees.filter((e) => e.team_id === team.id).length}명
                            </span>
                            <div className="action-btns">
                              <button className="btn-sm" onClick={() => { setEditingTeamId(team.id); setEditTeamName(team.name) }}>수정</button>
                              <button className="btn-sm danger" onClick={() => handleDeleteTeam(team.id)}>삭제</button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
