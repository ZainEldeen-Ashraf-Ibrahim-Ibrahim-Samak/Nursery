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

export function calculateChildStatusRollup(payments: { status: PaymentStatus }[]): PaymentStatus {
  if (payments.length === 0) return 'unpaid'
  const allPaid = payments.every(p => p.status === 'paid')
  const allUnpaid = payments.every(p => p.status === 'unpaid')
  if (allPaid) return 'paid'
  if (allUnpaid) return 'unpaid'
  return 'partial'
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
      SELECT p.*, c.name as child_name,
        (SELECT COUNT(*) FROM payment_transactions pt WHERE pt.payment_id = p.id) as transaction_count
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.month = ? AND p.year = ?
      ORDER BY c.name ASC
    `).all(month, year) as Payment[]
    
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
    
    // Fetch active enrollments + child extra session data
    const activeEnrollments = db.prepare(`
      SELECT cs.*, c.extra_lessons, c.session_price, c.sessions_baseline, c.reg_date
      FROM child_services cs
      JOIN children c ON cs.child_id = c.id
      WHERE c.is_active = 1
    `).all() as any[]

    let createdCount = 0
    const now = new Date().toISOString()

    const checkStmt = db.prepare('SELECT id FROM payments WHERE child_id = ? AND service_id = ? AND month = ? AND year = ?')
    const checkExtraStmt = db.prepare(`SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ? AND service = 'حصص إضافية'`)
    const insertStmt = db.prepare(`
      INSERT INTO payments (
        child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0)
    `)

    const transaction = db.transaction(() => {
      for (const enrollment of activeEnrollments) {
        const existing = checkStmt.get(enrollment.child_id, enrollment.id, month, year)
        if (!existing) {
          const arabicMonthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
          const monthIndex = arabicMonthNames.indexOf(month)
          const payYear = Number(year)
          const daysInMonth = monthIndex !== -1 ? new Date(payYear, monthIndex + 1, 0).getDate() : 30

          // Determine quantity based on unit type
          let quantity: number
          if (enrollment.unit === 'شهر') {
            quantity = 1
          } else if (enrollment.unit === 'يوم') {
            quantity = daysInMonth
          } else if (enrollment.unit === 'ساعة') {
            quantity = 1  // hourly rate — user sets actual hours manually
          } else if (enrollment.unit === 'جلسة') {
            // count scheduled sessions in this month
            const monthPad = monthIndex !== -1 ? String(monthIndex + 1).padStart(2, '0') : '01'
            const monthStart = `${payYear}-${monthPad}-01`
            const monthEnd = `${payYear}-${monthPad}-${String(daysInMonth).padStart(2, '0')}`
            const sessRow = db.prepare(`SELECT COUNT(*) as cnt FROM scheduled_sessions WHERE session_date >= ? AND session_date <= ?`).get(monthStart, monthEnd) as any
            quantity = sessRow?.cnt || 1
          } else {
            quantity = 1
          }

          // Pro-rate: if child registered mid-month, scale quantity to days remaining
          let proratedCalc: number | null = null
          if (enrollment.reg_date && monthIndex !== -1) {
            const regDate = new Date(enrollment.reg_date)
            const regYear = regDate.getFullYear()
            const regMonth = regDate.getMonth()
            if (regYear === payYear && regMonth === monthIndex && regDate.getDate() > 1) {
              const daysRemaining = daysInMonth - regDate.getDate() + 1
              if (enrollment.unit === 'شهر') {
                // pro-rate price for monthly service
                proratedCalc = Math.round((enrollment.price * daysRemaining) / daysInMonth)
              } else if (enrollment.unit === 'يوم') {
                // reduce quantity to remaining days
                quantity = daysRemaining
                proratedCalc = Math.round(enrollment.price * daysRemaining)
              } else if (enrollment.unit === 'ساعة') {
                // hourly — user sets hours manually, no auto pro-rate
                quantity = 1
              } else if (enrollment.unit === 'جلسة') {
                // count sessions from reg_date to end of month
                const regDateStr = enrollment.reg_date
                const monthPad = String(monthIndex + 1).padStart(2, '0')
                const monthEnd = `${payYear}-${monthPad}-${String(daysInMonth).padStart(2, '0')}`
                const sessRow = db.prepare(`SELECT COUNT(*) as cnt FROM scheduled_sessions WHERE session_date >= ? AND session_date <= ?`).get(regDateStr, monthEnd) as any
                quantity = sessRow?.cnt || quantity
                proratedCalc = Math.round(enrollment.price * quantity)
              }
            }
          }

          // For monthly services with pro-rate, use the pro-rated amount as total
          const effectiveTotal = (enrollment.unit === 'شهر' && proratedCalc != null)
            ? proratedCalc
            : undefined
          const { total, balance, status } = effectiveTotal != null
            ? { total: effectiveTotal, balance: effectiveTotal, status: 'unpaid' as const }
            : calculatePayment(quantity, enrollment.price, 0)

          db.prepare(`
            INSERT INTO payments (
              child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, prorated_calculated, created_at, updated_at, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0)
          `).run(
            enrollment.child_id,
            enrollment.id,
            month,
            year,
            enrollment.service,
            enrollment.unit,
            quantity,
            enrollment.price,
            total,
            balance,
            status,
            null,
            proratedCalc,
            now,
            now
          )
          createdCount++
        }

        // Create a separate row for additional sessions if any
        const extraLessons = Number(enrollment.extra_lessons) || 0
        const sessionPrice = Number(enrollment.session_price) || 0
        if (extraLessons > 0 && sessionPrice > 0) {
          const existingExtra = checkExtraStmt.get(enrollment.child_id, month, year)
          if (!existingExtra) {
            const extraTotal = extraLessons * sessionPrice
            insertStmt.run(
              enrollment.child_id,
              enrollment.id, // use same service_id as parent
              month,
              year,
              'حصص إضافية',
              'جلسة',
              extraLessons,
              sessionPrice,
              extraTotal,
              extraTotal, // balance = total (unpaid start)
              'unpaid',
              `${extraLessons} × ${sessionPrice}`,
              now,
              now
            )
            createdCount++
          }
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

ipcMain.handle('payments:update', async (_event, { id, quantity, paid, notes, payment_method_id }) => {
  try {
    checkAuth()
    const db = getDb()

    if (!id) throw new Error('Payment ID is required')

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any
    if (!payment) throw new Error('سجل الدفع غير موجود / Payment record not found')

    const newQuantity = quantity !== undefined ? Number(quantity) : payment.quantity
    const newPaid = paid !== undefined ? Number(paid) : payment.paid
    const newNotes = notes !== undefined ? notes : payment.notes
    const newMethodId = payment_method_id !== undefined ? payment_method_id : payment.payment_method_id ?? null

    let newMethodName: string | null = payment.payment_method_name ?? null
    if (payment_method_id !== undefined) {
      newMethodName = null
      if (payment_method_id !== null) {
        const m = db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(payment_method_id) as any
        newMethodName = m?.name ?? null
      }
    }

    const { total, balance, status } = calculatePayment(newQuantity, payment.price, newPaid)
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE payments
      SET quantity = ?, paid = ?, total = ?, balance = ?, status = ?, notes = ?,
          payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(newQuantity, newPaid, total, balance, status, newNotes, newMethodId, newMethodName, now, id)

    const updated = db.prepare(`
      SELECT p.*, c.name as child_name
      FROM payments p JOIN children c ON p.child_id = c.id
      WHERE p.id = ?
    `).get(id) as Payment

    return updated
  } catch (error: any) {
    console.error('Failed to update payment:', error)
    throw new Error(error.message || 'Failed to update payment')
  }
})

ipcMain.handle('payments:bulkPay', async (_event, { ids, payment_method_id }) => {
  try {
    checkAuth()
    const db = getDb()

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new Error('Payment IDs array is required')
    }

    // Resolve method name once
    let methodName: string | null = null
    const methodId: number | null = payment_method_id ?? null
    if (methodId !== null) {
      const m = db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(methodId) as any
      methodName = m?.name ?? null
    }

    const now = new Date().toISOString()
    let updatedCount = 0

    const loadStmt = db.prepare('SELECT * FROM payments WHERE id = ?')
    const updateStmt = db.prepare(`
      UPDATE payments
      SET paid = total, balance = 0, status = 'paid',
          payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `)

    const transaction = db.transaction(() => {
      for (const id of ids) {
        const payment = loadStmt.get(id) as Payment | undefined
        if (payment) {
          updateStmt.run(methodId, methodName, now, id)
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

// ── Partial payments / installments ───────────────────────────────────────────

// Recomputes a payment's paid/balance/status from the sum of its transactions and
// mirrors the most recent transaction's method onto the payment row (legacy single field).
function recomputePaymentFromTransactions(db: any, paymentId: number) {
  const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId) as any
  if (!payment) return null
  const paid = Number(((db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as s FROM payment_transactions WHERE payment_id = ?'
  ).get(paymentId) as any).s ?? 0).toFixed(2))
  const last = db.prepare(
    'SELECT payment_method_id, payment_method_name FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date DESC, id DESC LIMIT 1'
  ).get(paymentId) as any
  const { total, balance, status } = calculatePayment(payment.quantity, payment.price, paid)
  db.prepare(`
    UPDATE payments SET paid = ?, total = ?, balance = ?, status = ?,
      payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
    WHERE id = ?
  `).run(paid, total, balance, status, last?.payment_method_id ?? null, last?.payment_method_name ?? null, new Date().toISOString(), paymentId)
}

ipcMain.handle('payments:listTransactions', async (_event, { payment_id }) => {
  try {
    checkAuth()
    const db = getDb()
    if (!payment_id) throw new Error('Payment ID is required')
    return db.prepare(
      'SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC'
    ).all(payment_id)
  } catch (error: any) {
    console.error('Failed to list payment transactions:', error)
    throw new Error(error.message || 'Failed to list payment transactions')
  }
})

ipcMain.handle('payments:addTransaction', async (_event, { payment_id, amount, payment_method_id = null, paid_date = null, notes = null }) => {
  try {
    checkAuth()
    const db = getDb()
    if (!payment_id) throw new Error('Payment ID is required')
    const amt = Number(amount)
    if (!amt || amt <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر / Amount must be greater than zero')

    const payment = db.prepare('SELECT * FROM payments WHERE id = ?').get(payment_id) as any
    if (!payment) throw new Error('سجل الدفع غير موجود / Payment record not found')

    const resolveMethodName = (id: number | null): string | null => {
      if (id == null) return null
      const m = db.prepare('SELECT name FROM payment_methods WHERE id = ?').get(id) as any
      return m?.name ?? null
    }
    const now = new Date().toISOString()
    const date = paid_date || now.slice(0, 10)

    db.transaction(() => {
      const existing = (db.prepare(
        'SELECT COUNT(*) as c FROM payment_transactions WHERE payment_id = ?'
      ).get(payment_id) as any).c
      // Preserve any pre-existing paid amount (set before installments existed) as a seed row
      // so paid = SUM(transactions) stays correct.
      if (existing === 0 && Number(payment.paid) > 0) {
        db.prepare(`
          INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(payment_id, Number(payment.paid), payment.payment_method_id ?? null, payment.payment_method_name ?? null,
          (payment.updated_at || payment.created_at || now).slice(0, 10), 'رصيد سابق / Previous balance', now, now)
      }
      db.prepare(`
        INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(payment_id, amt, payment_method_id, resolveMethodName(payment_method_id), date, notes, now, now)
      recomputePaymentFromTransactions(db, payment_id)
    })()

    const updated = db.prepare('SELECT p.*, c.name as child_name FROM payments p JOIN children c ON p.child_id = c.id WHERE p.id = ?').get(payment_id) as Payment
    const transactions = db.prepare('SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC').all(payment_id)
    return { payment: updated, transactions }
  } catch (error: any) {
    console.error('Failed to add payment transaction:', error)
    throw new Error(error.message || 'Failed to add payment transaction')
  }
})

ipcMain.handle('payments:deleteTransaction', async (_event, { id }) => {
  try {
    checkAuth()
    const db = getDb()
    if (!id) throw new Error('Transaction ID is required')
    const tx = db.prepare('SELECT payment_id FROM payment_transactions WHERE id = ?').get(id) as any
    if (!tx) throw new Error('العملية غير موجودة / Transaction not found')
    db.transaction(() => {
      db.prepare('DELETE FROM payment_transactions WHERE id = ?').run(id)
      recomputePaymentFromTransactions(db, tx.payment_id)
    })()
    const updated = db.prepare('SELECT p.*, c.name as child_name FROM payments p JOIN children c ON p.child_id = c.id WHERE p.id = ?').get(tx.payment_id) as Payment
    const transactions = db.prepare('SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC').all(tx.payment_id)
    return { payment: updated, transactions }
  } catch (error: any) {
    console.error('Failed to delete payment transaction:', error)
    throw new Error(error.message || 'Failed to delete payment transaction')
  }
})