import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { getCurrentUser } from './authIPC.js'
import { requireAdmin } from './_guard.js'
import type { DailyPayment, PaymentStatus } from '../../src/types/index.js'
import { calculatePayment, calculateChildStatusRollup } from './paymentsIPC.js'

function checkAuth() {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized')
  }
}

ipcMain.handle('daily_payments:get', async (_event, { billing_date }) => {
  try {
    checkAuth()
    const db = getDb()
    
    if (!billing_date) {
      throw new Error('Billing date is required')
    }
    
    // Fetch daily payments joined with children names and status
    const payments = db.prepare(`
      SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone, c.is_active as child_is_active
      FROM daily_payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.billing_date = ?
      ORDER BY c.name ASC
    `).all(billing_date) as DailyPayment[]
    
    // Compute summaries
    let totalInvoiced = 0
    let totalCollected = 0
    let arrears = 0
    
    const childMap = new Map<number, any>()
    
    for (const p of payments) {
      totalInvoiced += p.total
      totalCollected += p.paid
      if (p.balance > 0) {
        arrears += p.balance
      }
      
      if (!childMap.has(p.child_id)) {
        childMap.set(p.child_id, {
          child_id: p.child_id,
          child_name: p.child_name,
          child_guardian: (p as any).child_guardian,
          child_guardian_phone: (p as any).child_guardian_phone,
          child_is_active: (p as any).child_is_active ?? 1,
          services: [],
          totalInvoiced: 0,
          totalCollected: 0,
          balance: 0,
          status: 'unpaid'
        })
      }
      
      const rollUp = childMap.get(p.child_id)
      rollUp.services.push(p)
      rollUp.totalInvoiced += p.total
      rollUp.totalCollected += p.paid
      rollUp.balance += p.balance
    }
    
    for (const rollUp of childMap.values()) {
      rollUp.status = calculateChildStatusRollup(rollUp.services)
      rollUp.totalInvoiced = Number(rollUp.totalInvoiced.toFixed(2))
      rollUp.totalCollected = Number(rollUp.totalCollected.toFixed(2))
      rollUp.balance = Number(rollUp.balance.toFixed(2))
    }
    
    return {
      payments,
      byChild: Array.from(childMap.values()).sort((a, b) => a.child_name.localeCompare(b.child_name)),
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        arrears: Number(arrears.toFixed(2))
      }
    }
  } catch (error: any) {
    console.error('Failed to get daily payments:', error)
    throw new Error(error.message || 'Failed to get daily payments')
  }
})

ipcMain.handle('daily_payments:generate', async (_event, { billing_date }) => {
  try {
    checkAuth()
    const db = getDb()
    
    if (!billing_date) {
      throw new Error('Billing date is required')
    }
    
    // Fetch active enrollments with unit = 'يوم'
    const activeEnrollments = db.prepare(`
      SELECT cs.*
      FROM child_services cs
      JOIN children c ON cs.child_id = c.id
      WHERE c.is_active = 1 AND cs.unit = 'يوم'
    `).all() as any[]

    let createdCount = 0
    const now = new Date().toISOString()
    const dateObj = new Date(billing_date)
    const arabicMonthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    const month = arabicMonthNames[dateObj.getMonth()]
    const year = dateObj.getFullYear()

    const checkStmt = db.prepare('SELECT id FROM daily_payments WHERE child_id = ? AND service_id = ? AND billing_date = ?')
    const insertStmt = db.prepare(`
      INSERT INTO daily_payments (
        child_id, service_id, billing_date, month, year, service, unit, quantity, price, total, paid, balance, status, notes, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0)
    `)

    const transaction = db.transaction(() => {
      for (const enrollment of activeEnrollments) {
        const existing = checkStmt.get(enrollment.child_id, enrollment.id, billing_date)
        if (!existing) {
          const quantity = 1
          const price = enrollment.price
          const total = quantity * price
          const balance = total
          const status: PaymentStatus = 'unpaid'
          
          insertStmt.run(
            enrollment.child_id,
            enrollment.id,
            billing_date,
            month,
            year,
            enrollment.service,
            enrollment.unit,
            quantity,
            price,
            total,
            balance,
            status,
            '',
            now,
            now
          )
          createdCount++
        }
      }
    })

    transaction()
    return { created: createdCount }
  } catch (error: any) {
    console.error('Failed to generate daily payments:', error)
    throw new Error(error.message || 'Failed to generate daily payments')
  }
})

ipcMain.handle('daily_payments:update', async (_event, { id, quantity, paid, notes, payment_method_id }) => {
  try {
    checkAuth()
    const user = getCurrentUser()
    const db = getDb()
    const now = new Date().toISOString()

    const payment = db.prepare('SELECT * FROM daily_payments WHERE id = ?').get(id) as DailyPayment
    if (!payment) {
      throw new Error('Daily Payment not found')
    }

    if (quantity !== undefined && quantity !== payment.quantity) {
      if (user?.role !== 'admin') {
        throw new Error('FORBIDDEN: Only admin can change quantity')
      }
    }

    const finalQuantity = quantity !== undefined ? quantity : payment.quantity
    const finalPaid = paid !== undefined ? paid : payment.paid
    const finalNotes = notes !== undefined ? notes : payment.notes
    let finalMethodId = payment.payment_method_id
    let finalMethodName = payment.payment_method_name
    
    if (payment_method_id !== undefined) {
      finalMethodId = payment_method_id
      if (payment_method_id === null) {
        finalMethodName = null
      } else {
        const method = db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(payment_method_id) as any
        if (method) {
          finalMethodName = method.name
        }
      }
    }

    const { total, balance, status } = calculatePayment(finalQuantity, payment.price, finalPaid)

    db.prepare(`
      UPDATE daily_payments
      SET quantity = ?, total = ?, paid = ?, balance = ?, status = ?, notes = ?, payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(finalQuantity, total, finalPaid, balance, status, finalNotes, finalMethodId, finalMethodName, now, id)

    // Return the updated payment joined with child data
    return db.prepare(`
      SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone, c.is_active as child_is_active
      FROM daily_payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.id = ?
    `).get(id) as DailyPayment
  } catch (error: any) {
    console.error('Failed to update daily payment:', error)
    throw new Error(error.message || 'Failed to update daily payment')
  }
})

ipcMain.handle('daily_payments:bulkPay', async (_event, { ids, payment_method_id }) => {
  try {
    checkAuth()
    if (!ids || !ids.length) {
      throw new Error('No IDs provided for bulk pay')
    }

    const db = getDb()
    const now = new Date().toISOString()
    let updatedCount = 0
    let finalMethodName: string | null = null
    
    if (payment_method_id) {
      const method = db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(payment_method_id) as any
      if (method) {
        finalMethodName = method.name
      }
    }

    const updateStmt = db.prepare(`
      UPDATE daily_payments
      SET paid = total, balance = 0, status = 'paid', payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
      WHERE id = ? AND status != 'paid'
    `)

    const transaction = db.transaction(() => {
      for (const id of ids) {
        const result = updateStmt.run(payment_method_id ?? null, finalMethodName, now, id)
        updatedCount += Number(result.changes)
      }
    })

    transaction()
    return { updated: updatedCount }
  } catch (error: any) {
    console.error('Failed to bulk pay daily payments:', error)
    throw new Error(error.message || 'Failed to bulk pay daily payments')
  }
})

ipcMain.handle('daily_payments:deleteBulk', async (_event, { ids }) => {
  try {
    requireAdmin()
    if (!ids || !ids.length) return { ok: true, deleted: 0 }
    
    const db = getDb()
    const placeholders = ids.map(() => '?').join(',')
    
    const result = db.prepare(`DELETE FROM daily_payments WHERE id IN (${placeholders})`).run(...ids)
    
    return { ok: true, deleted: result.changes }
  } catch (error: any) {
    console.error('Failed to bulk delete daily payments:', error)
    throw new Error(error.message || 'Failed to bulk delete daily payments')
  }
})

ipcMain.handle('daily_payments:deleteAll', async (_event, { billing_date }) => {
  try {
    requireAdmin()
    if (!billing_date) throw new Error('Billing date is required')
    
    const db = getDb()
    const result = db.prepare('DELETE FROM daily_payments WHERE billing_date = ?').run(billing_date)
    
    return { ok: true, deleted: result.changes }
  } catch (error: any) {
    console.error('Failed to delete all daily payments:', error)
    throw new Error(error.message || 'Failed to delete all daily payments')
  }
})

ipcMain.handle('daily_payments:deleteForChild', async (_event, { child_id, billing_date }) => {
  try {
    requireAdmin()
    if (!child_id || !billing_date) throw new Error('Child ID and billing date are required')
    
    const db = getDb()
    db.prepare('DELETE FROM daily_payments WHERE child_id = ? AND billing_date = ?').run(child_id, billing_date)
    
    return { ok: true }
  } catch (error: any) {
    console.error('Failed to delete daily payments for child:', error)
    throw new Error(error.message || 'Failed to delete daily payments for child')
  }
})
