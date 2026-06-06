import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { getCurrentUser } from './authIPC.js'
import type { Payment, PaymentStatus } from '../../src/types/index.js'

// Pure function for payment calculations (exported for unit testing)
export function calculatePayment(quantity: number, price: number, paid: number): {
  total: number
  balance: number
  status: PaymentStatus
} {
  const total = Number((quantity * price).toFixed(2))
  const balance = Number((total - paid).toFixed(2))
  
  let status: PaymentStatus = 'unpaid'
  if (paid > 0) {
    if (paid >= total) {
      status = 'paid'
    } else {
      status = 'partial'
    }
  }
  
  return { total, balance, status }
}

function checkAuth() {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized')
  }
}

ipcMain.handle('payments:get', async (_event, { month, year }) => {
  try {
    checkAuth()
    const db = getDb()
    
    if (!month || !year) {
      throw new Error('Month and year are required')
    }
    
    // Fetch payments joined with children names
    const payments = db.prepare(`
      SELECT p.*, c.name as child_name 
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.month = ? AND p.year = ?
      ORDER BY c.name ASC
    `).all(month, year) as Payment[]
    
    // Compute summaries
    let totalInvoiced = 0
    let totalCollected = 0
    let arrears = 0
    
    for (const p of payments) {
      totalInvoiced += p.total
      totalCollected += p.paid
      if (p.balance > 0) {
        arrears += p.balance
      }
    }
    
    return {
      payments,
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        arrears: Number(arrears.toFixed(2))
      }
    }
  } catch (error: any) {
    console.error('Failed to get payments:', error)
    throw new Error(error.message || 'Failed to get payments')
  }
})

ipcMain.handle('payments:generate', async (_event, { month, year }) => {
  try {
    checkAuth()
    const db = getDb()
    
    if (!month || !year) {
      throw new Error('Month and year are required')
    }
    
    // Fetch all active children
    const activeChildren = db.prepare('SELECT * FROM children WHERE is_active = 1').all() as any[]
    
    let createdCount = 0
    const now = new Date().toISOString()
    
    const checkStmt = db.prepare('SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ?')
    const insertStmt = db.prepare(`
      INSERT INTO payments (
        child_id, month, year, service, unit, quantity, price, total, paid, balance, status, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0)
    `)
    
    const transaction = db.transaction(() => {
      for (const child of activeChildren) {
        const existing = checkStmt.get(child.id, month, year)
        if (!existing) {
          const quantity = 1
          const { total, balance, status } = calculatePayment(quantity, child.price, 0)
          
          insertStmt.run(
            child.id,
            month,
            year,
            child.service,
            child.unit,
            quantity,
            child.price,
            total,
            balance,
            status,
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
    console.error('Failed to generate payments:', error)
    throw new Error(error.message || 'Failed to generate payments')
  }
})

ipcMain.handle('payments:update', async (_event, { id, quantity, paid, notes }) => {
  try {
    checkAuth()
    const db = getDb()
    
    if (!id) {
      throw new Error('Payment ID is required')
    }
    
    // Load current payment record
    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as Payment | undefined
    if (!payment) {
      throw new Error('سجل الدفع غير موجود / Payment record not found')
    }
    
    const newQuantity = quantity !== undefined ? Number(quantity) : payment.quantity
    const newPaid = paid !== undefined ? Number(paid) : payment.paid
    const newNotes = notes !== undefined ? notes : payment.notes
    
    const { total, balance, status } = calculatePayment(newQuantity, payment.price, newPaid)
    const now = new Date().toISOString()
    
    db.prepare(`
      UPDATE payments 
      SET quantity = ?, paid = ?, total = ?, balance = ?, status = ?, notes = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(newQuantity, newPaid, total, balance, status, newNotes, now, id)
    
    // Return updated record with joined child name
    const updated = db.prepare(`
      SELECT p.*, c.name as child_name
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.id = ?
    `).get(id) as Payment
    
    return updated
  } catch (error: any) {
    console.error('Failed to update payment:', error)
    throw new Error(error.message || 'Failed to update payment')
  }
})

ipcMain.handle('payments:bulkPay', async (_event, { ids }) => {
  try {
    checkAuth()
    const db = getDb()
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error('Payment IDs array is required')
    }
    
    const now = new Date().toISOString()
    let updatedCount = 0
    
    const loadStmt = db.prepare('SELECT * FROM payments WHERE id = ?')
    const updateStmt = db.prepare(`
      UPDATE payments
      SET paid = total, balance = 0, status = 'paid', updated_at = ?, synced = 0
      WHERE id = ?
    `)
    
    const transaction = db.transaction(() => {
      for (const id of ids) {
        const payment = loadStmt.get(id) as Payment | undefined
        if (payment) {
          updateStmt.run(now, id)
          updatedCount++
        }
      }
    })
    
    transaction()
    return { updated: updatedCount }
  } catch (error: any) {
    console.error('Failed to bulk pay payments:', error)
    throw new Error(error.message || 'Failed to process bulk payments')
  }
})