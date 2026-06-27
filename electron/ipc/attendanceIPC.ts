import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin, checkAuth, getCurrentUser } from './_guard.js'

ipcMain.handle('attendance:getSheet', async (_event, { session_id }) => {
  try {
    checkAuth()
    const db = getDb()
    const user = getCurrentUser()
    if (user?.role !== 'admin') {
      const emp = db.prepare('SELECT id FROM employees WHERE name = ?').get(user?.name ?? '') as any
      if (emp) {
        const isTeacher = db.prepare('SELECT 1 FROM session_teachers WHERE session_id = ? AND employee_id = ?').get(session_id, emp.id)
        if (!isTeacher) throw new Error('غير مصرح لك بالوصول / Not authorized for this session')
      }
    }
    // Get session date to compute weekday
    const session = db.prepare('SELECT session_date FROM scheduled_sessions WHERE id = ?').get(session_id) as any
    let dayOfWeek: number | null = null
    if (session?.session_date) {
      // Parse date as local date to avoid UTC offset shifting the day
      const [y, m, d] = session.session_date.split('-').map(Number)
      dayOfWeek = new Date(y, m - 1, d).getDay()
    }

    const allChildren = db.prepare(`
      SELECT c.id as child_id, c.name as child_name, c.photo_url as child_photo_url, c.lesson_days,
        ar.id as attendance_id, ar.status, ar.excuse_notes, ar.recorded_by, ar.recorded_at, ar.updated_at
      FROM children c
      LEFT JOIN attendance_records ar ON ar.child_id = c.id AND ar.session_id = ?
      WHERE c.is_active = 1
      ORDER BY c.name ASC
    `).all(session_id) as any[]

    // Filter to children scheduled for that weekday, or already recorded, or no lesson_days set
    const children = allChildren.filter(c => {
      // Always include children already recorded for this session
      if (c.attendance_id) return true
      // If no lesson_days configured, include everyone
      if (!c.lesson_days || c.lesson_days === '[]' || c.lesson_days === '') return true
      // If we couldn't compute the weekday, include everyone
      if (dayOfWeek === null) return true
      try {
        const days: number[] = JSON.parse(c.lesson_days)
        return days.length === 0 || days.includes(dayOfWeek)
      } catch { return true }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }).map(({ lesson_days, ...rest }) => rest)

    return children
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get attendance sheet')
  }
})

ipcMain.handle('attendance:record', async (_event, args) => {
  try {
    checkAuth()
    const db = getDb()
    const user = getCurrentUser()
    const now = new Date().toISOString()
    const results: any[] = []

    // Support both { session_id, records } and flat array of records
    const sessionId = args?.session_id
    const records: any[] = Array.isArray(args) ? args : (args?.records ?? [])

    const upsert = db.transaction(() => {
      for (const rec of records) {
        const session_id = sessionId ?? rec.session_id
        const { child_id, status, excuse_notes = null } = rec
        const validStatuses = ['attended', 'absent_excused', 'absent_unexcused']
        if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`)

        db.prepare(`
          INSERT INTO attendance_records (session_id, child_id, status, excuse_notes, recorded_by, recorded_at, updated_at, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, 0)
          ON CONFLICT(session_id, child_id) DO UPDATE SET
            status = excluded.status,
            excuse_notes = excluded.excuse_notes,
            recorded_by = excluded.recorded_by,
            updated_at = excluded.updated_at,
            synced = 0
        `).run(session_id, child_id, status, excuse_notes, user?.id ?? null, now, now)

        results.push(db.prepare('SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ?').get(session_id, child_id))
      }
    })
    upsert()
    return results
  } catch (error: any) {
    throw new Error(error.message || 'Failed to record attendance')
  }
})

ipcMain.handle('attendance:getConflicts', async () => {
  try {
    requireAdmin()
    const db = getDb()
    return db.prepare('SELECT * FROM attendance_conflicts WHERE reviewed = 0 ORDER BY created_at DESC').all()
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get conflicts')
  }
})

ipcMain.handle('attendance:resolveConflict', async (_event, { conflict_id, final_status }) => {
  try {
    requireAdmin()
    const db = getDb()
    const conflict = db.prepare('SELECT * FROM attendance_conflicts WHERE id = ?').get(conflict_id) as any
    if (!conflict) throw new Error('التعارض غير موجود / Conflict not found')
    db.prepare('UPDATE attendance_conflicts SET reviewed = 1 WHERE id = ?').run(conflict_id)
    db.prepare('UPDATE attendance_records SET status = ?, updated_at = ?, synced = 0 WHERE id = ?')
      .run(final_status, new Date().toISOString(), conflict.attendance_record_id)
    return { ok: true }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to resolve conflict')
  }
})

ipcMain.handle('attendance:getSummary', async (_event, { employee_id, month, year }) => {
  try {
    requireAdmin()
    const db = getDb()
    const arabicMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    const monthIdx = arabicMonths.indexOf(String(month))
    const monthNum = monthIdx !== -1 ? String(monthIdx + 1).padStart(2, '0') : String(month).padStart(2, '0')
    const yearStr = String(year)
    const monthStart = `${yearStr}-${monthNum}-01`
    const monthEnd = `${yearStr}-${monthNum}-31`

    const sessions = db.prepare(`
      SELECT ss.id FROM scheduled_sessions ss
      JOIN session_teachers st ON st.session_id = ss.id
      WHERE st.employee_id = ? AND ss.session_date >= ? AND ss.session_date <= ?
    `).all(employee_id, monthStart, monthEnd) as { id: number }[]

    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length === 0) {
      return { total_sessions: 0, payable_sessions: 0, excused_absences: 0, unexcused_absences: 0, breakdown: [] }
    }

    const placeholders = sessionIds.map(() => '?').join(',')
    const records = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM attendance_records WHERE session_id IN (${placeholders}) GROUP BY status
    `).all(...sessionIds) as { status: string; cnt: number }[]

    const attended = records.find((r) => r.status === 'attended')?.cnt ?? 0
    const excused = records.find((r) => r.status === 'absent_excused')?.cnt ?? 0
    const unexcused = records.find((r) => r.status === 'absent_unexcused')?.cnt ?? 0

    return {
      total_sessions: sessionIds.length,
      payable_sessions: attended + unexcused,
      excused_absences: excused,
      unexcused_absences: unexcused,
      breakdown: records
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get attendance summary')
  }
})
