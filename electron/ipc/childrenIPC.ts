import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'
import { getCurrentUser } from './authIPC.js'
import { getChildStatement } from '../services/statementService.js'
import type { Child } from '../../src/types/index.js'

function checkAuth() {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized')
  }
}

ipcMain.handle('children:get', async (_event, { search, service, activeOnly }) => {
  try {
    checkAuth()
    const db = getDb()
    
    let query = 'SELECT * FROM children WHERE 1=1'
    const params: any[] = []
    
    if (search && search.trim() !== '') {
      const searchPattern = `%${search.trim()}%`
      query += ' AND (name LIKE ? OR guardian LIKE ? OR guardian_phone LIKE ? OR child_phone LIKE ? OR national_id LIKE ?)'
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
    }
    
    if (service) {
      query += ' AND id IN (SELECT child_id FROM child_services WHERE service = ?)'
      params.push(service)
    }
    
    // Default to activeOnly = true if not explicitly set to false
    if (activeOnly !== false) {
      query += ' AND is_active = 1'
    }
    
    query += ' ORDER BY name ASC'
    
    const rows = db.prepare(query).all(...params) as Child[]
    for (const row of rows) {
      row.services = db.prepare('SELECT * FROM child_services WHERE child_id = ?').all(row.id) as any[]
    }
    return rows
  } catch (error: any) {
    console.error('Failed to get children:', error)
    throw new Error(error.message || 'Failed to get children')
  }
})

ipcMain.handle('children:add', async (_event, childInput) => {
  try {
    requireAdmin()
    const db = getDb()
    
    const { name, guardian, guardian_phone, child_phone, national_id, reg_date, notes, services } = childInput
    const enrollments = services || (childInput.service ? [{ service: childInput.service, unit: childInput.unit, price: childInput.price }] : [])
    
    if (!name || !guardian || !guardian_phone || enrollments.length === 0 || !reg_date) {
      throw new Error('جميع الحقول الإلزامية مطلوبة / Missing required fields')
    }
    
    const serviceNames = new Set(enrollments.map((s: any) => s.service))
    if (serviceNames.size < enrollments.length) throw new Error('لا يمكن إضافة نفس الخدمة أكثر من مرة / Cannot add duplicate services')
    
    const now = new Date().toISOString()
    
    const tx = db.transaction(() => {
      const first = enrollments[0]
      const result = db.prepare(`
        INSERT INTO children (
          name, guardian, guardian_phone, child_phone, national_id, 
          service, unit, price, reg_date, notes, 
          is_active, created_at, updated_at, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
      `).run(
        name, guardian, guardian_phone, child_phone || null, national_id || null,
        first.service, first.unit, first.price, reg_date, notes || null,
        now, now
      )
      
      const childId = Number(result.lastInsertRowid)
      const insertSvc = db.prepare(`INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0)`)
      
      for (const s of enrollments) {
        insertSvc.run(childId, s.service, s.unit, s.price, now, now)
      }
      return childId
    })
    
    const createdId = tx()
    const createdChild = db.prepare('SELECT * FROM children WHERE id = ?').get(createdId) as Child
    createdChild.services = db.prepare('SELECT * FROM child_services WHERE child_id = ?').all(createdId) as any[]
    return createdChild
  } catch (error: any) {
    console.error('Failed to add child:', error)
    throw new Error(error.message || 'Failed to add child')
  }
})

ipcMain.handle('children:update', async (_event, { id, patch }) => {
  try {
    requireAdmin()
    const db = getDb()
    
    if (!id || !patch) {
      throw new Error('Child ID and patch data are required')
    }
    
    // Check if child exists
    const child = db.prepare('SELECT id FROM children WHERE id = ?').get(id)
    if (!child) {
      throw new Error('الطفل غير موجود / Child not found')
    }
    
    const tx = db.transaction(() => {
      const enrollments = patch.services
      if (enrollments) {
        if (enrollments.length === 0) throw new Error('يجب اختيار خدمة واحدة على الأقل / At least one service is required')
        const serviceNames = new Set(enrollments.map((s: any) => s.service))
        if (serviceNames.size < enrollments.length) throw new Error('لا يمكن إضافة نفس الخدمة أكثر من مرة / Cannot add duplicate services')
        
        patch.service = enrollments[0].service
        patch.unit = enrollments[0].unit
        patch.price = enrollments[0].price
      }

      let query = 'UPDATE children SET '
      const params: any[] = []
      
      const allowedKeys = [
        'name', 'guardian', 'guardian_phone', 'child_phone', 'national_id',
        'service', 'unit', 'price', 'reg_date', 'notes', 'is_active'
      ]
      
      for (const key of allowedKeys) {
        if (patch[key] !== undefined) {
          query += `${key} = ?, `
          params.push(patch[key])
        }
      }
      
      const now = new Date().toISOString()
      
      if (params.length > 0) {
        query += 'updated_at = ?, synced = 0 WHERE id = ?'
        params.push(now, id)
        db.prepare(query).run(...params)
      }

      if (enrollments) {
        db.prepare('DELETE FROM child_services WHERE child_id = ?').run(id)
        const insertSvc = db.prepare(`INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0)`)
        for (const s of enrollments) {
          insertSvc.run(id, s.service, s.unit, s.price, now, now)
        }
      }
    })
    
    tx()
    
    const updatedChild = db.prepare('SELECT * FROM children WHERE id = ?').get(id) as Child
    updatedChild.services = db.prepare('SELECT * FROM child_services WHERE child_id = ?').all(id) as any[]
    return updatedChild
  } catch (error: any) {
    console.error('Failed to update child:', error)
    throw new Error(error.message || 'Failed to update child')
  }
})

ipcMain.handle('children:deactivate', async (_event, { id }) => {
  try {
    requireAdmin()
    const db = getDb()
    
    const child = db.prepare('SELECT id FROM children WHERE id = ?').get(id)
    if (!child) {
      throw new Error('الطفل غير موجود / Child not found')
    }
    
    db.prepare('UPDATE children SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?').run(
      new Date().toISOString(),
      id
    )
    
    return { ok: true }
  } catch (error: any) {
    console.error('Failed to deactivate child:', error)
    throw new Error(error.message || 'Failed to deactivate child')
  }
})


ipcMain.handle('children:statement', async (_event, { childId }) => {
  try {
    checkAuth()
    if (!childId) {
      throw new Error('Child ID is required')
    }
    const db = getDb()
    
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(childId) as any
    if (!child) {
      throw new Error('الطفل غير موجود / Child not found')
    }
    
    const payments = db.prepare('SELECT * FROM payments WHERE child_id = ?').all(childId) as any[]
    
    return getChildStatement(child, payments, new Date())
  } catch (error: any) {
    console.error('Failed to get child statement:', error)
    throw new Error(error.message || 'Failed to get child statement')
  }
})