import { supabase } from '../supabaseClient'
import { INITIAL_TASKS } from './constants'

const sb = () => supabase !== null

// ── Tasks ──
export const getTasks = async () => {
  if (sb()) {
    const { data, error } = await supabase.from('tasks').select('*').order('created_at')
    if (!error && data) return data
  }
  try {
    const stored = localStorage.getItem('wam_tasks')
    return stored ? JSON.parse(stored) : INITIAL_TASKS
  } catch {
    return INITIAL_TASKS
  }
}

export const saveTasks = async (tasks) => {
  if (sb()) {
    const { data: existing } = await supabase.from('tasks').select('id')
    const existingIds = (existing || []).map((t) => t.id)
    const newIds = tasks.map((t) => t.id)
    const toDelete = existingIds.filter((id) => !newIds.includes(id))

    if (toDelete.length > 0) {
      await supabase.from('tasks').delete().in('id', toDelete)
    }
    if (tasks.length > 0) {
      await supabase
        .from('tasks')
        .upsert(tasks.map(({ id, name, difficulty }) => ({ id, name, difficulty })))
    }
    return
  }
  localStorage.setItem('wam_tasks', JSON.stringify(tasks))
}

// ── Assignments ──
export const getAssignments = async () => {
  if (sb()) {
    const { data, error } = await supabase.from('assignments').select('*')
    if (!error && data) {
      return Object.fromEntries(data.map((a) => [a.task_id, a.employee_name]))
    }
  }
  try {
    const stored = localStorage.getItem('wam_assignments')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export const saveAssignments = async (assignments) => {
  if (sb()) {
    await supabase.from('assignments').delete().neq('task_id', '')
    const rows = Object.entries(assignments).map(([task_id, employee_name]) => ({
      task_id,
      employee_name,
    }))
    if (rows.length > 0) {
      await supabase.from('assignments').insert(rows)
    }
    return
  }
  localStorage.setItem('wam_assignments', JSON.stringify(assignments))
}

// ── Evaluations ──
export const getEvaluations = async () => {
  if (sb()) {
    const [{ data: evals }, { data: desired }] = await Promise.all([
      supabase.from('evaluations').select('*'),
      supabase.from('desired_tasks').select('*'),
    ])

    const result = {}

    ;(evals || []).forEach((e) => {
      if (!result[e.employee_name]) {
        result[e.employee_name] = { difficultyRatings: {}, desiredTasks: [], submittedAt: e.submitted_at }
      }
      result[e.employee_name].difficultyRatings[e.task_id] = e.difficulty_rating
    })

    ;(desired || []).forEach((d) => {
      if (!result[d.employee_name]) {
        result[d.employee_name] = { difficultyRatings: {}, desiredTasks: [] }
      }
      result[d.employee_name].desiredTasks.push(d.task_id)
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

export const saveEvaluation = async (employeeName, evaluation) => {
  if (sb()) {
    await Promise.all([
      supabase.from('evaluations').delete().eq('employee_name', employeeName),
      supabase.from('desired_tasks').delete().eq('employee_name', employeeName),
    ])

    const evalRows = Object.entries(evaluation.difficultyRatings || {}).map(
      ([task_id, difficulty_rating]) => ({
        employee_name: employeeName,
        task_id,
        difficulty_rating,
        submitted_at: evaluation.submittedAt,
      })
    )
    if (evalRows.length > 0) {
      await supabase.from('evaluations').insert(evalRows)
    }

    const desiredRows = (evaluation.desiredTasks || []).map((task_id) => ({
      employee_name: employeeName,
      task_id,
    }))
    if (desiredRows.length > 0) {
      await supabase.from('desired_tasks').insert(desiredRows)
    }
    return
  }

  const all = (() => {
    try {
      const stored = localStorage.getItem('wam_evaluations')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  })()
  all[employeeName] = evaluation
  localStorage.setItem('wam_evaluations', JSON.stringify(all))
}
