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
