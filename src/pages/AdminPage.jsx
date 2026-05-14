import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { supabaseAdmin } from '../supabaseAdmin'
import {
  getDepartments, addDepartment, updateDepartment, deleteDepartment,
  getTeams, addTeam, updateTeam, deleteTeam,
  getEmployees, updateEmployee, deleteEmployee,
  getTasks, addTask, updateTask, deleteTask,
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
    setCreating(true)
    setCreateError('')

    // 관리자 세션에 영향을 주지 않도록 격리된 임시 클라이언트 사용
    const { createClient } = await import('@supabase/supabase-js')
    const tmpClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: authData, error: authErr } = await tmpClient.auth.signUp({
      email: createForm.email,
      password: createForm.password,
    })
    if (authErr) { setCreateError(authErr.message); setCreating(false); return }
    if (!authData.user) { setCreateError('계정 생성에 실패했습니다. 이미 존재하는 이메일일 수 있습니다.'); setCreating(false); return }

    const { data: emp, error: empErr } = await supabase.from('employees').insert([{
      name: createForm.name,
      grade: createForm.grade,
      type: createForm.type,
      role: createForm.role,
      email: createForm.email,
      auth_user_id: authData.user.id,
      team_id: createForm.teamId || null,
    }]).select('*').single()

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
      password: '',
    })
  }

  const handleSaveEdit = async () => {
    if (editForm.password) {
      const emp = employees.find((e) => e.id === editingId)
      if (!supabaseAdmin) {
        alert('비밀번호 변경에는 VITE_SUPABASE_SERVICE_KEY가 필요합니다.')
        return
      }
      if (emp?.auth_user_id) {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(emp.auth_user_id, {
          password: editForm.password,
        })
        if (error) { alert('비밀번호 변경 실패: ' + error.message); return }
      }
    }
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

  // ── 대시보드/업무 통계용 state ──
  const [allTasks, setAllTasks]           = useState([])
  const [allAssignments, setAllAssignments] = useState([])
  const [dashLoading, setDashLoading]     = useState(false)

  // 역할별 현황 서브탭
  const [roleSubTab, setRoleSubTab] = useState('employee')

  // 업무분장 설정 state
  const [wTaskFilter, setWTaskFilter] = useState('')
  const [editingTaskId, setEditingTaskId]   = useState(null)
  const [editTaskForm, setEditTaskForm]     = useState({})
  const [newTaskForm, setNewTaskForm]       = useState({ name: '', project: '', difficulty: 2 })
  const [showNewTask, setShowNewTask]       = useState(false)
  const [tasksLoaded, setTasksLoaded]       = useState(false)

  // 전체 업무 목록 필터
  const [taskFilterRole, setTaskFilterRole] = useState('')
  const [taskFilterTeam, setTaskFilterTeam] = useState('')

  const loadDashboard = async () => {
    if (dashLoading) return
    setDashLoading(true)
    const [{ data: tasks }, { data: asgn }] = await Promise.all([
      supabase.from('tasks').select('*').order('project').order('created_at'),
      supabase.from('assignments').select('*'),
    ])
    setAllTasks(tasks || [])
    setAllAssignments(asgn || [])
    setDashLoading(false)
  }

  const loadAdminTasks = async () => {
    if (tasksLoaded) return
    const tasks = await getTasks()
    setAllTasks(tasks)
    setTasksLoaded(true)
  }

  const handleTabChange = (key) => {
    setActiveTab(key)
    if (['dashboard', 'tasks', 'byRole', 'stats'].includes(key) && !dashLoading && allTasks.length === 0) {
      loadDashboard()
    }
    if (key === 'workConfig') loadAdminTasks()
  }

  // 업무 통계 계산
  const computeStats = () => {
    const total = allAssignments.length
    const byTeam = {}
    employees.forEach((emp) => {
      const teamName = emp.teams ? `${emp.teams.departments?.name} > ${emp.teams.name}` : '미배정'
      if (!byTeam[teamName]) byTeam[teamName] = { total: 0 }
      byTeam[teamName].total += allAssignments.filter((a) => a.employee_name === emp.name).length
    })
    return { total, byTeam }
  }

  // 업무분장 CRUD
  const handleSaveTask = async () => {
    await updateTask(editingTaskId, editTaskForm)
    setAllTasks((p) => p.map((t) => t.id === editingTaskId ? { ...t, ...editTaskForm } : t))
    setEditingTaskId(null)
  }

  const handleDeleteTask = async (id) => {
    if (!window.confirm('이 업무를 삭제하시겠습니까?')) return
    await deleteTask(id)
    setAllTasks((p) => p.filter((t) => t.id !== id))
  }

  const handleAddTask = async () => {
    if (!newTaskForm.name.trim() || !newTaskForm.project.trim()) return
    const t = await addTask({ ...newTaskForm, difficulty: Number(newTaskForm.difficulty) })
    setAllTasks((p) => [...p, t])
    setNewTaskForm({ name: '', project: '', difficulty: 2 })
    setShowNewTask(false)
  }

  const TABS = [
    { key: 'employees', label: `직원 관리 (${employees.length})` },
    { key: 'org',       label: '부서/팀 관리' },
    { key: 'dashboard', label: '전체 현황 대시보드' },
    { key: 'tasks',     label: '전체 업무 목록' },
    { key: 'byRole',    label: '역할별 현황' },
    { key: 'stats',     label: '업무 통계' },
    { key: 'workConfig',label: '업무분장 설정' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1>관리자</h1>
        <p>직원 계정 및 조직 구조를 관리합니다</p>
      </div>

      <div className="tabs" style={{ flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => handleTabChange(t.key)}>
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
                {!['manager', '팀장'].includes(createForm.role) && (
                  <div className="form-group">
                    <label className="form-label">직급</label>
                    <select className="form-select" value={createForm.grade}
                      onChange={(e) => setCreateForm((p) => ({ ...p, grade: e.target.value }))}>
                      {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                )}
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
                        {!['manager', '팀장'].includes(editForm.role) && (
                          <select className="inline-select" value={editForm.grade}
                            onChange={(e) => setEditForm((p) => ({ ...p, grade: e.target.value }))}>
                            {GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}
                          </select>
                        )}
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
                        <input className="inline-input" type="password"
                          value={editForm.password || ''}
                          onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                          placeholder="새 비밀번호 (선택사항)" />
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

      {/* ── 전체 현황 대시보드 탭 ── */}
      {activeTab === 'dashboard' && (
        <div className="section-body">
          {dashLoading ? (
            <div className="empty-state">불러오는 중...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {employees.map((emp) => {
                const empAsgn = allAssignments.filter((a) => a.employee_name === emp.name)
                const total   = allTasks.length
                const done    = empAsgn.length
                const pct     = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <div key={emp.id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <strong>{emp.name}</strong>
                      <span className={`role-badge-sm role-${emp.role}`}>{ROLE_LABELS[emp.role]}</span>
                    </div>
                    <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>
                      {emp.teams ? `${emp.teams.departments?.name} > ${emp.teams.name}` : '팀 미배정'}
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, marginBottom: 6 }}>
                      <div style={{ background: '#4f46e5', width: `${pct}%`, height: '100%', borderRadius: 6, transition: 'width .3s' }} />
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>업무 배정 {done} / {total} ({pct}%)</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 전체 업무 목록 탭 ── */}
      {activeTab === 'tasks' && (
        <div className="section-body">
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <select className="form-select" style={{ width: 140 }} value={taskFilterRole}
              onChange={(e) => setTaskFilterRole(e.target.value)}>
              <option value="">역할 전체</option>
              {['employee', 'manager', 'director', 'admin'].map((r) =>
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              )}
            </select>
            <select className="form-select" style={{ width: 180 }} value={taskFilterTeam}
              onChange={(e) => setTaskFilterTeam(e.target.value)}>
              <option value="">팀 전체</option>
              {allTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {dashLoading ? (
            <div className="empty-state">불러오는 중...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['업무명', '프로젝트', '배정 직원', '직원 역할', '소속 팀'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTasks
                    .filter((task) => {
                      const asgn = allAssignments.find((a) => a.task_id === task.id)
                      if (!asgn) return !taskFilterRole && !taskFilterTeam
                      const emp = employees.find((e) => e.name === asgn.employee_name)
                      if (!emp) return true
                      if (taskFilterRole && emp.role !== taskFilterRole) return false
                      if (taskFilterTeam && emp.team_id !== taskFilterTeam) return false
                      return true
                    })
                    .map((task) => {
                      const asgn = allAssignments.find((a) => a.task_id === task.id)
                      const emp  = asgn ? employees.find((e) => e.name === asgn.employee_name) : null
                      return (
                        <tr key={task.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '8px 12px' }}>{task.name}</td>
                          <td style={{ padding: '8px 12px', color: '#6b7280' }}>{task.project}</td>
                          <td style={{ padding: '8px 12px' }}>{asgn?.employee_name || <span className="text-muted">미배정</span>}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {emp ? <span className={`role-badge-sm role-${emp.role}`}>{ROLE_LABELS[emp.role]}</span> : '-'}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 12 }}>
                            {emp?.teams ? `${emp.teams.departments?.name} > ${emp.teams.name}` : '-'}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── 역할별 현황 탭 ── */}
      {activeTab === 'byRole' && (
        <div className="section-body">
          <div className="tabs" style={{ marginBottom: 16 }}>
            {[['employee', '팀원'], ['manager', '팀장'], ['director', '부장']].map(([key, label]) => (
              <button key={key} className={`tab ${roleSubTab === key ? 'active' : ''}`}
                onClick={() => setRoleSubTab(key)}>{label}</button>
            ))}
          </div>
          {dashLoading ? (
            <div className="empty-state">불러오는 중...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {employees.filter((e) => e.role === roleSubTab).map((emp) => {
                const empAsgn = allAssignments.filter((a) => a.employee_name === emp.name)
                return (
                  <div key={emp.id} className="card" style={{ padding: '16px 20px' }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{emp.name}</div>
                    <div className="text-muted" style={{ fontSize: 12, marginBottom: 8 }}>
                      {emp.grade} · {emp.type}
                      {emp.teams && ` · ${emp.teams.departments?.name} > ${emp.teams.name}`}
                    </div>
                    <div style={{ fontSize: 13 }}>배정 업무 <strong>{empAsgn.length}</strong>개</div>
                    {empAsgn.length > 0 && (
                      <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 12, color: '#374151' }}>
                        {empAsgn.slice(0, 5).map((a) => {
                          const t = allTasks.find((tk) => tk.id === a.task_id)
                          return <li key={a.task_id}>{t ? t.name : a.task_id}</li>
                        })}
                        {empAsgn.length > 5 && <li style={{ color: '#9ca3af' }}>+{empAsgn.length - 5}개 더</li>}
                      </ul>
                    )}
                  </div>
                )
              })}
              {employees.filter((e) => e.role === roleSubTab).length === 0 && (
                <div className="empty-state">해당 역할의 직원이 없습니다.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 업무 통계 탭 ── */}
      {activeTab === 'stats' && (
        <div className="section-body">
          {dashLoading ? (
            <div className="empty-state">불러오는 중...</div>
          ) : (() => {
            const { total, byTeam } = computeStats()
            const totalTasks = allTasks.length
            const completionPct = totalTasks > 0 ? Math.round((total / (totalTasks * Math.max(employees.length, 1))) * 100) : 0
            const maxTeamVal = Math.max(...Object.values(byTeam).map((v) => v.total), 1)
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                  <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#4f46e5' }}>{total}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>전체 배정 수</div>
                  </div>
                  <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#059669' }}>{totalTasks}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>전체 업무 수</div>
                  </div>
                  <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{employees.length}</div>
                    <div className="text-muted" style={{ fontSize: 13 }}>전체 직원 수</div>
                  </div>
                </div>

                <div className="card" style={{ padding: '16px 20px' }}>
                  <h3 style={{ marginBottom: 16 }}>팀별 배정 업무 현황</h3>
                  {Object.entries(byTeam).map(([teamName, { total: cnt }]) => (
                    <div key={teamName} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                        <span>{teamName}</span>
                        <span style={{ color: '#6b7280' }}>{cnt}개</span>
                      </div>
                      <div style={{ background: '#e5e7eb', borderRadius: 6, height: 10 }}>
                        <div style={{
                          background: '#4f46e5',
                          width: `${Math.round((cnt / maxTeamVal) * 100)}%`,
                          height: '100%', borderRadius: 6,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ padding: '16px 20px' }}>
                  <h3 style={{ marginBottom: 16 }}>직원별 배정 업무 수</h3>
                  {[...employees]
                    .map((emp) => ({ emp, cnt: allAssignments.filter((a) => a.employee_name === emp.name).length }))
                    .sort((a, b) => b.cnt - a.cnt)
                    .map(({ emp, cnt }) => {
                      const maxEmp = Math.max(...employees.map((e) => allAssignments.filter((a) => a.employee_name === e.name).length), 1)
                      return (
                        <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{ width: 70, fontSize: 13 }}>{emp.name}</span>
                          <div style={{ flex: 1, background: '#e5e7eb', borderRadius: 6, height: 8 }}>
                            <div style={{ background: '#10b981', width: `${Math.round((cnt / maxEmp) * 100)}%`, height: '100%', borderRadius: 6 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#6b7280', width: 30, textAlign: 'right' }}>{cnt}</span>
                        </div>
                      )
                    })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── 업무분장 설정 탭 ── */}
      {activeTab === 'workConfig' && (
        <div className="section-body">
          <div className="mgmt-header" style={{ marginBottom: 16 }}>
            <input className="form-input" style={{ width: 220 }} placeholder="업무명 검색"
              value={wTaskFilter} onChange={(e) => setWTaskFilter(e.target.value)} />
            <button className="btn-primary" style={{ fontSize: 13, padding: '7px 14px' }}
              onClick={() => setShowNewTask((v) => !v)}>+ 업무 추가</button>
          </div>

          {showNewTask && (
            <div className="admin-form-card" style={{ marginBottom: 16 }}>
              <h3>새 업무 추가</h3>
              <div className="admin-form-grid">
                <div className="form-group">
                  <label className="form-label">업무명 *</label>
                  <input className="form-input" placeholder="업무명"
                    value={newTaskForm.name}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">프로젝트 *</label>
                  <input className="form-input" placeholder="프로젝트명"
                    value={newTaskForm.project}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, project: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">난이도 (1~5)</label>
                  <input className="form-input" type="number" min={1} max={5}
                    value={newTaskForm.difficulty}
                    onChange={(e) => setNewTaskForm((p) => ({ ...p, difficulty: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn-primary" onClick={handleAddTask}>추가</button>
                <button className="btn-secondary" onClick={() => setShowNewTask(false)}>취소</button>
              </div>
            </div>
          )}

          <div className="emp-status-list">
            {allTasks
              .filter((t) => !wTaskFilter || t.name.includes(wTaskFilter) || t.project.includes(wTaskFilter))
              .map((task) => (
                <div key={task.id} className="emp-status-row">
                  {editingTaskId === task.id ? (
                    <>
                      <div className="emp-edit-grid">
                        <input className="inline-input" value={editTaskForm.name || ''}
                          onChange={(e) => setEditTaskForm((p) => ({ ...p, name: e.target.value }))} placeholder="업무명" />
                        <input className="inline-input" value={editTaskForm.project || ''}
                          onChange={(e) => setEditTaskForm((p) => ({ ...p, project: e.target.value }))} placeholder="프로젝트" />
                        <input className="inline-input" type="number" min={1} max={5}
                          value={editTaskForm.difficulty || 2}
                          onChange={(e) => setEditTaskForm((p) => ({ ...p, difficulty: Number(e.target.value) }))} />
                      </div>
                      <div className="action-btns">
                        <button className="btn-sm primary" onClick={handleSaveTask}>저장</button>
                        <button className="btn-sm" onClick={() => setEditingTaskId(null)}>취소</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="emp-status-info">
                        <span className="emp-status-name">{task.name}</span>
                        <span className="emp-status-meta">{task.project} · 난이도 {task.difficulty}</span>
                      </div>
                      <div className="action-btns">
                        <button className="btn-sm" onClick={() => { setEditingTaskId(task.id); setEditTaskForm({ name: task.name, project: task.project, difficulty: task.difficulty }) }}>수정</button>
                        <button className="btn-sm danger" onClick={() => handleDeleteTask(task.id)}>삭제</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
          </div>
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
