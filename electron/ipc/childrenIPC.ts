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
      query += ' AND service = ?'
      params.push(service)
    }
    
    // Default to activeOnly = true if not explicitly set to false
    if (activeOnly !== false) {
      query += ' AND is_active = 1'
    }
    
    query += ' ORDER BY name ASC'
    
    const rows = db.prepare(query).all(...params) as Child[]
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
    
    const { name, guardian, guardian_phone, child_phone, national_id, service, unit, price, reg_date, notes } = childInput
    
    if (!name || !guardian || !guardian_phone || !service || !unit || price === undefined || !reg_date) {
      throw new Error('جميع الحقول الإلزامية مطلوبة / Missing required fields')
    }
    
    const now = new Date().toISOString()
    
    const result = db.prepare(`
      INSERT INTO children (
        name, guardian, guardian_phone, child_phone, national_id, 
        service, unit, price, reg_date, notes, 
        is_active, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
    `).run(
      name, guardian, guardian_phone, child_phone || null, national_id || null,
      service, unit, price, reg_date, notes || null,
      now, now
    )
    
    const createdId = Number(result.lastInsertRowid)
    const createdChild = db.prepare('SELECT * FROM children WHERE id = ?').get(createdId) as Child
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
    
    // If nothing to update, return the child
    if (params.length === 0) {
      return db.prepare('SELECT * FROM children WHERE id = ?').get(id) as Child
    }
    
    // Always update updated_at and reset synced to 0 on local edit
    query += 'updated_at = ?, synced = 0'
    params.push(new Date().toISOString())
    
    query += ' WHERE id = ?'
    params.push(id)
    
    db.prepare(query).run(...params)
    
    const updatedChild = db.prepare('SELECT * FROM children WHERE id = ?').get(id) as Child
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