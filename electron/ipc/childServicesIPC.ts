import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'
import { getCurrentUser } from './authIPC.js'
import type { ServiceEnrollment } from '../../src/types/index.js'
import { recordLocalTombstone } from '../services/tombstones.js'

function checkAuth() {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized')
  }
}

ipcMain.handle('childServices:list', async (_event, { childId }) => {
  try {
    checkAuth()
    const db = getDb()
    if (!childId) throw new Error('childId is required')
    return db.prepare('SELECT * FROM child_services WHERE child_id = ?').all(childId) as ServiceEnrollment[]
  } catch (error: any) {
    console.error('Failed to get child services:', error)
    throw new Error(error.message || 'Failed to get child services')
  }
})

ipcMain.handle('childServices:add', async (_event, { childId, service, unit, price }) => {
  try {
    requireAdmin()
    const db = getDb()
    if (!childId || !service || !unit || price === undefined) {
      throw new Error('جميع الحقول الإلزامية مطلوبة / Missing required fields')
    }

    // Check duplicate
    const existing = db.prepare('SELECT id FROM child_services WHERE child_id = ? AND service = ?').get(childId, service)
    if (existing) {
      throw new Error('هذه الخدمة مضافة بالفعل للطفل / Service already enrolled')
    }

    const now = new Date().toISOString()
    const result = db.prepare(`
      INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(childId, service, unit, price, now, now)

    return db.prepare('SELECT * FROM child_services WHERE id = ?').get(result.lastInsertRowid) as ServiceEnrollment
  } catch (error: any) {
    console.error('Failed to add child service:', error)
    throw new Error(error.message || 'Failed to add child service')
  }
})

ipcMain.handle('childServices:update', async (_event, { id, patch }) => {
  try {
    requireAdmin()
    const db = getDb()
    if (!id || !patch) throw new Error('ID and patch are required')

    let query = 'UPDATE child_services SET '
    const params: any[] = []
    
    const allowed = ['unit', 'price']
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        query += `${key} = ?, `
        params.push(patch[key])
      }
    }

    if (params.length === 0) return db.prepare('SELECT * FROM child_services WHERE id = ?').get(id)

    query += 'updated_at = ?, synced = 0 WHERE id = ?'
    params.push(new Date().toISOString(), id)

    db.prepare(query).run(...params)
    return db.prepare('SELECT * FROM child_services WHERE id = ?').get(id) as ServiceEnrollment
  } catch (error: any) {
    console.error('Failed to update child service:', error)
    throw new Error(error.message || 'Failed to update child service')
  }
})

// Read-only preview (FR-002/FR-003): counts scheduled weekday occurrences for `lesson_days`
// (0=Sun…6=Sat) from today through the end of the current calendar month, and multiplies by
// the teacher's per-session rate. Never writes anything — pure computation for the enrollment UI.
ipcMain.handle('childServices:previewTeacherCost', async (_event, { teacher_id, lesson_days }) => {
  try {
    checkAuth()
    const db = getDb()
    const teacher = db.prepare('SELECT teacher_session_rate FROM employees WHERE id = ?').get(teacher_id) as any
    let rate = teacher?.teacher_session_rate ?? null
    if (rate == null) {
      // Mirror the payment engine's fallback (attendanceIPC.ts): if this teacher has no rate
      // of their own, the org-wide default from Settings is what will actually be charged.
      const defaultSetting = db.prepare("SELECT value FROM settings WHERE key = 'default_teacher_session_rate'").get() as any
      const defaultRate = defaultSetting?.value != null ? Number(defaultSetting.value) : NaN
      rate = !isNaN(defaultRate) && defaultRate > 0 ? defaultRate : 0
    }

    const days: number[] = Array.isArray(lesson_days) ? lesson_days.map(Number) : []

    const today = new Date()
    const year = today.getFullYear()
    const month = today.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    let remaining = 0
    if (days.length > 0) {
      for (let d = today.getDate(); d <= daysInMonth; d++) {
        const date = new Date(year, month, d)
        if (days.includes(date.getDay())) remaining++
      }
    }

    return {
      remaining_sessions: remaining,
      expected_cost: Number((remaining * rate).toFixed(2)),
      teacher_session_rate: rate
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to preview teacher cost')
  }
})

ipcMain.handle('childServices:remove', async (_event, { id }) => {
  try {
    requireAdmin()
    const db = getDb()
    if (!id) throw new Error('ID is required')

    db.prepare('DELETE FROM child_services WHERE id = ?').run(id)
    recordLocalTombstone(db, 'child_services', id)
    return { ok: true }
  } catch (error: any) {
    console.error('Failed to remove child service:', error)
    throw new Error(error.message || 'Failed to remove child service')
  }
})
