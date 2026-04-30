import { supabase } from '../supabaseClient'
import { EMPLOYEES, INITIAL_TASKS } from './constants'

const sb = () => supabase !== null

// ── Organizations ──
export const getOrganizations = async () => {
  if (sb()) {
    const { data, error } = await supabase.from('organizations').select('*').order('created_at')
    if (!error && data) return data
  }
  return [{ id: 'local_org_1', name: '진흥원' }]
}

// ── Departments ──
export const getDepartments = async (orgId = null) => {
  if (sb()) {
    let q = supabase.from('departments').select('*').order('created_at')
    if (orgId) q = q.eq('org_id', orgId)
    const { data, error } = await q
    if (!error && data) return data
  }
  return []
}

export const addDepartment = async (dept) => {
  if (sb()) {
    const { data, error } = await supabase.from('departments').insert([dept]).select()
    if (!error && data) return data[0]
  }
  return { ...dept, id: `local_dept_${Date.now()}` }
}

export const updateDepartment = async (id, updates) => {
  if (sb()) {
    await supabase.from('departments').update(updates).eq('id', id)
  }
}

export const deleteDepartment = async (id) => {
  if (sb()) {
    await supabase.from('departments').delete().eq('id', id)
  }
}

// ── Teams ──
export const getTeams = async (deptId = null) => {
  if (sb()) {
    let q = supabase.from('teams').select('*').order('created_at')
    if (deptId) q = q.eq('dept_id', deptId)
    const { data, error } = await q
    if (!error && data) return data
  }
  return []
}

export const addTeam = async (team) => {
  if (sb()) {
    const { data, error } = await supabase.from('teams').insert([team]).select()
    if (!error && data) return data[0]
  }
  return { ...team, id: `local_team_${Date.now()}` }
}

export const updateTeam = async (id, updates) => {
  if (sb()) {
    await supabase.from('teams').update(updates).eq('id', id)
  }
}

export const deleteTeam = async (id) => {
  if (sb()) {
    await supabase.from('teams').delete().eq('id', id)
  }
}

// ── Employees ──
export const getEmployees = async (teamId = null) => {
  if (sb()) {
    let q = supabase.from('employees').select('*').order('created_at')
    if (teamId) q = q.eq('team_id', teamId)
    const { data, error } = await q
    if (!error && data) return data
  }
  return EMPLOYEES.map((e, i) => ({ ...e, id: `local_${i}` }))
}

export const addEmployee = async (employee) => {
  if (sb()) {
    const { data, error } = await supabase.from('employees').insert([employee]).select()
    if (!error && data) return data[0]
  }
  return { ...employee, id: `local_${Date.now()}` }
}

export const updateEmployee = async (id, updates) => {
  if (sb()) {
    await supabase.from('employees').update(updates).eq('id', id)
  }
}

export const deleteEmployee = async (id) => {
  if (sb()) {
    await supabase.from('employees').delete().eq('id', id)
  }
}

// ── Tasks ──
export const getTasks = async (teamId = null) => {
  if (sb()) {
    let q = supabase.from('tasks').select('*').order('project').order('created_at')
    if (teamId) q = q.eq('team_id', teamId)
    const { data, error } = await q
    if (!error && data) return data
  }
  try {
    const stored = localStorage.getItem('wam_tasks')
    return stored ? JSON.parse(stored) : INITIAL_TASKS
  } catch {
    return INITIAL_TASKS
  }
}

export const addTask = async (task) => {
  if (sb()) {
    const { data, error } = await supabase.from('tasks').insert([task]).select()
    if (!error && data) return data[0]
  }
  return task
}

export const updateTask = async (id, updates) => {
  if (sb()) {
    await supabase.from('tasks').update(updates).eq('id', id)
  }
}

export const deleteTask = async (id) => {
  if (sb()) {
    await supabase.from('tasks').delete().eq('id', id)
  }
}

export const saveTasks = async (tasks) => {
  if (!sb()) {
    localStorage.setItem('wam_tasks', JSON.stringify(tasks))
  }
}

// ── Assignments ──
export const getAssignments = async (teamId = null) => {
  if (sb()) {
    let q = supabase.from('assignments').select('*')
    if (teamId) q = q.eq('team_id', teamId)
    const { data, error } = await q
    if (!error && data) return Object.fromEntries(data.map((a) => [a.task_id, a.employee_name]))
  }
  try {
    const stored = localStorage.getItem('wam_assignments')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export const saveAssignments = async (assignments, teamId = null) => {
  if (sb()) {
    let delQ = supabase.from('assignments')
    if (teamId) {
      delQ = delQ.delete().eq('team_id', teamId)
    } else {
      delQ = delQ.delete().neq('task_id', '')
    }
    await delQ
    const rows = Object.entries(assignments).map(([task_id, employee_name]) => ({
      task_id, employee_name, team_id: teamId || null,
    }))
    if (rows.length > 0) await supabase.from('assignments').insert(rows)
    return
  }
  localStorage.setItem('wam_assignments', JSON.stringify(assignments))
}

// ── Secondary Assignments ──
export const getSecondaryAssignments = async (teamId = null) => {
  if (sb()) {
    let q = supabase.from('secondary_assignments').select('*')
    if (teamId) q = q.eq('team_id', teamId)
    const { data, error } = await q
    if (!error && data) return Object.fromEntries(data.map((a) => [a.task_id, a.employee_name]))
  }
  try {
    const stored = localStorage.getItem('wam_secondary_assignments')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export const saveSecondaryAssignments = async (assignments, teamId = null) => {
  if (sb()) {
    let delQ = supabase.from('secondary_assignments')
    if (teamId) {
      delQ = delQ.delete().eq('team_id', teamId)
    } else {
      delQ = delQ.delete().neq('task_id', '')
    }
    await delQ
    const rows = Object.entries(assignments).map(([task_id, employee_name]) => ({
      task_id, employee_name, team_id: teamId || null,
    }))
    if (rows.length > 0) await supabase.from('secondary_assignments').insert(rows)
    return
  }
  localStorage.setItem('wam_secondary_assignments', JSON.stringify(assignments))
}

// ── Evaluations ──
export const getEvaluations = async (teamId = null) => {
  if (sb()) {
    let evQ = supabase.from('evaluations').select('*')
    let deQ = supabase.from('desired_tasks').select('*')
    if (teamId) { evQ = evQ.eq('team_id', teamId); deQ = deQ.eq('team_id', teamId) }
    const [{ data: evals }, { data: desired }] = await Promise.all([evQ, deQ])
    const result = {}
    ;(evals || []).forEach((e) => {
      if (!result[e.employee_name]) {
        result[e.employee_name] = { difficultyRatings: {}, difficultyNotes: {}, desiredTasks: [], desiredTaskPriorities: {}, submittedAt: e.submitted_at }
      }
      result[e.employee_name].difficultyRatings[e.task_id] = e.difficulty_rating
      if (e.notes) result[e.employee_name].difficultyNotes[e.task_id] = e.notes
    })
    ;(desired || []).forEach((d) => {
      if (!result[d.employee_name]) {
        result[d.employee_name] = { difficultyRatings: {}, difficultyNotes: {}, desiredTasks: [], desiredTaskPriorities: {} }
      }
      result[d.employee_name].desiredTasks.push(d.task_id)
      if (d.priority) result[d.employee_name].desiredTaskPriorities[d.task_id] = d.priority
    })
    return result
  }
  try {
    const stored = localStorage.getItem('wam_evaluations')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export const saveEvaluation = async (employeeName, evaluation, teamId = null) => {
  if (sb()) {
    let evDel = supabase.from('evaluations').delete().eq('employee_name', employeeName)
    let deDel = supabase.from('desired_tasks').delete().eq('employee_name', employeeName)
    if (teamId) { evDel = evDel.eq('team_id', teamId); deDel = deDel.eq('team_id', teamId) }
    await Promise.all([evDel, deDel])
    const evalRows = Object.entries(evaluation.difficultyRatings || {}).map(([task_id, difficulty_rating]) => ({
      employee_name: employeeName, task_id, difficulty_rating,
      notes: evaluation.difficultyNotes?.[task_id] || null,
      submitted_at: evaluation.submittedAt, team_id: teamId || null,
    }))
    if (evalRows.length > 0) await supabase.from('evaluations').insert(evalRows)
    const desiredRows = (evaluation.desiredTasks || []).map((taskId) => ({
      employee_name: employeeName, task_id: taskId,
      priority: evaluation.desiredTaskPriorities?.[taskId] || null,
      team_id: teamId || null,
    }))
    if (desiredRows.length > 0) await supabase.from('desired_tasks').insert(desiredRows)
    return
  }
  const all = (() => { try { return JSON.parse(localStorage.getItem('wam_evaluations') || '{}') } catch { return {} } })()
  all[employeeName] = evaluation
  localStorage.setItem('wam_evaluations', JSON.stringify(all))
}

// ── Workflow Status (per team) ──
export const getWorkflowStatus = async (teamId = null) => {
  if (sb()) {
    if (teamId) {
      const { data, error } = await supabase
        .from('team_workflow_status').select('current_stage').eq('team_id', teamId).single()
      if (!error && data) return data.current_stage
      return 'survey'
    }
    const { data } = await supabase.from('team_workflow_status').select('current_stage').limit(1).single()
    if (data) return data.current_stage
  }
  return localStorage.getItem('wam_workflow_status') || 'survey'
}

export const setWorkflowStatus = async (stage, teamId = null) => {
  if (sb()) {
    if (teamId) {
      await supabase.from('team_workflow_status').upsert({
        team_id: teamId, current_stage: stage, updated_at: new Date().toISOString(),
      })
    }
    return
  }
  localStorage.setItem('wam_workflow_status', stage)
}

export const getAllTeamWorkflowStatuses = async () => {
  if (sb()) {
    const { data, error } = await supabase.from('team_workflow_status').select('*')
    if (!error && data) return data
  }
  return []
}
