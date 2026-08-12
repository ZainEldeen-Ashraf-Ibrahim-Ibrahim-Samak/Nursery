import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { getCurrentUser } from './authIPC.js'
import { requireAdmin } from './_guard.js'
import { attachExpectedTotals, createExpectedTotalCalculator } from '../services/monthlyTotals.js'
import { recordLocalTombstone } from '../services/tombstones.js'
import { reconcileMonthlyProrates } from '../services/prorateReconcile.js'
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

/**
 * Same as calculatePayment, but never destroys a pro-rated invoice.
 *
 * A child who enrolls mid-month is billed only for the remaining days: `payments:generate`
 * stores that discounted amount in both `total` and `prorated_calculated`, while `quantity`
 * stays 1 and `price` stays the FULL monthly rate. So re-deriving the total as quantity × price
 * — which is exactly what calculatePayment does — silently re-inflates the bill to a whole
 * month the first time anyone edits the payment or records an installment against it.
 *
 * Every path that recomputes an existing payment row must go through here and pass the row, so
 * the discount survives. Only monthly ('شهر') rows carry this shape: the 'جلسة' pro-rate is
 * applied by reducing `quantity` instead, so quantity × price is already correct there.
 */
export function calculatePaymentPreservingProrate(
  row: { unit?: string | null; prorated_calculated?: number | null } | undefined | null,
  quantity: number,
  price: number,
  paid: number
): { total: number; balance: number; status: PaymentStatus } {
  const prorated = row?.prorated_calculated
  if (row?.unit === 'شهر' && prorated != null) {
    // Scale by quantity so the non-pro-rated branch's semantics still hold (quantity is 1 for
    // every generated monthly row, so in practice this is the stored pro-rated amount).
    const total = Number((Number(prorated) * quantity).toFixed(2))
    const balance = Number((total - paid).toFixed(2))
    const status: PaymentStatus = paid <= 0 ? 'unpaid' : paid >= total ? 'paid' : 'partial'
    return { total, balance, status }
  }
  return calculatePayment(quantity, price, paid)
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
    
    // Fetch payments joined with children names and status.
    // Daily-unit (يوم) rows are included: since feature 009 replaced Daily Billing with the
    // read-only Transactions view, day/hour services are billed here from attendance counts.
    const payments = db.prepare(`
      SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone, c.is_active as child_is_active,
        c.reg_date,
        COALESCE(NULLIF(cs.lesson_days, '[]'), c.lesson_days) as service_lesson_days,
        (SELECT COUNT(*) FROM payment_transactions pt WHERE pt.payment_id = p.id) as transaction_count
      FROM payments p
      JOIN children c ON p.child_id = c.id
      LEFT JOIN child_services cs ON cs.id = p.service_id
      WHERE p.month = ? AND p.year = ?
      ORDER BY c.name ASC
    `).all(month, year) as (Payment & { service_lesson_days: string | null })[]

    // Expected quantity/total: the FULL scheduled amount for the month — what the child owes by
    // month end — as opposed to the billed `quantity`, which for attendance-driven units only
    // counts days/hours already attended (or absent-unexcused). Shared with the Dashboard via
    // monthlyTotals so the two screens can never report different figures for the same month.
    attachExpectedTotals(payments as any, month, year)

    // Compute summaries. `totalInvoiced` and `arrears` are stated on the EXPECTED total: an
    // attendance-billed enrollment half-way through the month has only accrued half its charge
    // in `total`, and reporting that as the month's invoiced/outstanding figure understated the
    // whole book by exactly the part of the month that hadn't happened yet.
    let totalInvoiced = 0
    let totalBilled = 0
    let totalCollected = 0
    let arrears = 0

    const childMap = new Map<number, any>()

    for (const p of payments as (Payment & { expected_total: number })[]) {
      totalInvoiced += p.expected_total
      totalBilled += p.total
      totalCollected += p.paid
      const outstanding = p.expected_total - p.paid
      if (outstanding > 0) {
        arrears += outstanding
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
          totalExpectedSessions: 0,
          totalExpectedPayment: 0,
          balance: 0,
          status: 'unpaid'
        })
      }

      const rollUp = childMap.get(p.child_id)
      rollUp.services.push(p)
      rollUp.totalInvoiced += p.total
      rollUp.totalCollected += p.paid
      rollUp.balance += p.balance
      rollUp.totalExpectedSessions += (p as any).expected_quantity ?? p.quantity
      rollUp.totalExpectedPayment += (p as any).expected_total ?? p.total
    }

    // Wallet credit — the child's LIFETIME balance across every month (including this one), same
    // sign convention as the per-child "balance" column: negative = they've paid more than owed
    // (credit sitting in their wallet), positive = arrears still owed. Shown as "Wallet Balance" so
    // it always agrees with the "(Credit)" badge on the child's row — a child who overpaid THIS
    // month must not show "nothing in wallet".
    const lifetimeBalanceStmt = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as lifetime_balance
      FROM payments
      WHERE child_id = ?
    `)
    // Credit carried in from OTHER months only — used (instead of the lifetime figure above) to
    // work out "Left To Pay" against the month's full EXPECTED total, since this month's own
    // collected amount is already subtracted directly and must not be subtracted twice.
    const priorCreditStmt = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as prior_balance
      FROM payments
      WHERE child_id = ? AND NOT (month = ? AND year = ?)
    `)

    for (const rollUp of childMap.values()) {
      rollUp.status = calculateChildStatusRollup(rollUp.services)
      rollUp.totalInvoiced = Number(rollUp.totalInvoiced.toFixed(2))
      rollUp.totalCollected = Number(rollUp.totalCollected.toFixed(2))
      rollUp.totalExpectedPayment = Number(rollUp.totalExpectedPayment.toFixed(2))
      rollUp.balance = Number(rollUp.balance.toFixed(2))

      const totalSessions = rollUp.services.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0)
      const { lifetime_balance } = lifetimeBalanceStmt.get(rollUp.child_id) as { lifetime_balance: number }
      const { prior_balance } = priorCreditStmt.get(rollUp.child_id, month, year) as { prior_balance: number }
      const priorCredit = Math.max(0, -prior_balance)

      rollUp.totalSessions = totalSessions
      rollUp.walletCredit = Number(Math.max(0, -lifetime_balance).toFixed(2))
      // Left to pay = what's still needed to fully cover the month's EXPECTED total, after
      // subtracting what's already been collected this month and any credit carried from before.
      rollUp.remainingAfterWallet = Number(Math.max(0, rollUp.totalExpectedPayment - rollUp.totalCollected - priorCredit).toFixed(2))
    }

    return {
      payments,
      // Sort defensively: a null name would throw here and fail the whole payments:get call,
      // taking the screen down rather than just mis-ordering one row.
      byChild: Array.from(childMap.values()).sort((a, b) =>
        String(a.child_name ?? '').localeCompare(String(b.child_name ?? ''))
      ),
      summary: {
        totalInvoiced: Number(totalInvoiced.toFixed(2)),
        // What has actually accrued so far (SUM of payments.total) — kept alongside the
        // expected figure so the difference between "owed by month end" and "billed to date"
        // stays visible instead of silently changing what totalInvoiced means.
        totalBilled: Number(totalBilled.toFixed(2)),
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
    
    // Fetch active enrollments + child extra session data.
    // Day-unit (يوم) services are included: they are charged from attendance (attended +
    // unexcused absence), since the separate Daily Billing flow was retired in feature 009.
    const activeEnrollments = db.prepare(`
      SELECT cs.*, c.extra_lessons, c.session_price, c.sessions_baseline, c.reg_date
      FROM child_services cs
      JOIN children c ON cs.child_id = c.id
      WHERE c.is_active = 1
    `).all() as any[]

    let createdCount = 0
    let updatedCount = 0
    const now = new Date().toISOString()

    // The 'حصص إضافية' (extra lessons) row is inserted with the SAME service_id as its parent
    // enrollment, so it must be excluded here — otherwise this lookup can return the extras row
    // instead of the enrollment's own row, and the regeneration branch below would overwrite the
    // admin-entered extra-lesson quantity with an attendance/session count.
    const checkStmt = db.prepare(`SELECT id FROM payments WHERE child_id = ? AND service_id = ? AND month = ? AND year = ? AND service != 'حصص إضافية'`)
    const checkExtraStmt = db.prepare(`SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ? AND service = 'حصص إضافية'`)
    const insertStmt = db.prepare(`
      INSERT INTO payments (
        child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0)
    `)

    // Counts billable attendance for a child's service within a date range: sessions where the
    // child was attended OR absent without excuse (absent_unexcused). Excused absences are not
    // charged. Sessions only exist on the child's selected lesson days, so the selection is
    // respected implicitly. DISTINCT session_id guards against per-teacher duplicate rows.
    const billableAttendanceStmt = db.prepare(`
      SELECT COUNT(DISTINCT ar.session_id) as cnt
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN service_definitions sd ON sd.id = ss.service_id
      WHERE ar.child_id = ?
        AND ss.session_date >= ? AND ss.session_date <= ?
        AND ar.status IN ('attended', 'absent_unexcused')
        AND (ss.service_id IS NULL OR sd.name = ?)
    `)

    // Sessions this child is actually enrolled in, for THIS service, in the period — the basis
    // for billing a per-session ('جلسة') enrollment.
    //
    // `scheduled_sessions` carries no roster of its own: a child's link to a session is its
    // `attendance_records` row. Counting scheduled_sessions directly (as this used to) charged
    // a session-billed child for every session held anywhere in the centre that month,
    // including other children's and other services' sessions. Same service-matching rule as
    // billableAttendanceStmt above; attendance STATUS is deliberately not filtered, because a
    // per-session enrollment is billed for the sessions it was scheduled for.
    const scheduledSessionsStmt = db.prepare(`
      SELECT COUNT(DISTINCT ar.session_id) as cnt
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN service_definitions sd ON sd.id = ss.service_id
      WHERE ar.child_id = ?
        AND ss.session_date >= ? AND ss.session_date <= ?
        AND (ss.service_id IS NULL OR sd.name = ?)
    `)

    // Calendar facts for the period, and the shared pro-rate calculator. Hoisted out of the
    // enrollment loop: they depend only on month/year, so rebuilding them per enrollment was
    // pure repetition.
    const { monthIndex, daysInMonth, monthlyRate } = createExpectedTotalCalculator(month, year)
    const payYear = Number(year)
    const monthPad2 = monthIndex !== -1 ? String(monthIndex + 1).padStart(2, '0') : '01'
    const monthStartStr = `${payYear}-${monthPad2}-01`
    const monthEndStr = `${payYear}-${monthPad2}-${String(daysInMonth).padStart(2, '0')}`

    const transaction = db.transaction(() => {
      for (const enrollment of activeEnrollments) {
        // A child registered after this month ended was not enrolled during it. Generating a
        // row anyway invoiced them a full month they never attended — the monthly pro-rate
        // below only fires when reg_date falls INSIDE the month, so a later registration fell
        // through to the undiscounted full price.
        const regParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(enrollment.reg_date ?? '').trim())
        if (regParts && monthIndex !== -1) {
          const regYear = Number(regParts[1])
          const regMonth = Number(regParts[2]) - 1
          if (regYear > payYear || (regYear === payYear && regMonth > monthIndex)) continue
        }

        const countBillableAttendance = () => {
          const row = billableAttendanceStmt.get(enrollment.child_id, monthStartStr, monthEndStr, enrollment.service) as any
          return Number(row?.cnt) || 0
        }

        // Sessions this child is enrolled in for this service, from `from` through month end.
        const countScheduledSessions = (from: string = monthStartStr) => {
          const row = scheduledSessionsStmt.get(enrollment.child_id, from, monthEndStr, enrollment.service) as any
          return Number(row?.cnt) || 0
        }

        const existing = checkStmt.get(enrollment.child_id, enrollment.id, month, year) as any
        if (existing && (enrollment.unit === 'يوم' || enrollment.unit === 'ساعة' || enrollment.unit === 'جلسة')) {
          // Attendance-driven units: refresh the quantity on regeneration so charges track
          // attendance recorded after the row was first created. Paid amounts are preserved;
          // total/balance/status are recomputed from the new quantity.
          // 'جلسة' is included because it is now scoped to the child's own sessions, which are
          // only known once those sessions exist — a row generated early in the month would
          // otherwise stay stuck at whatever count was visible on generation day.
          const current = db.prepare('SELECT * FROM payments WHERE id = ?').get(existing.id) as any
          const newQuantity = enrollment.unit === 'جلسة' ? countScheduledSessions() : countBillableAttendance()
          if (current && current.quantity !== newQuantity) {
            const { total, balance, status } = calculatePaymentPreservingProrate(current, newQuantity, current.price, current.paid)
            db.prepare(`
              UPDATE payments SET quantity = ?, total = ?, balance = ?, status = ?, updated_at = ?, synced = 0
              WHERE id = ?
            `).run(newQuantity, total, balance, status, now, existing.id)
            updatedCount++
          }
        }
        if (!existing) {
          // Determine quantity based on unit type
          let quantity: number
          if (enrollment.unit === 'شهر') {
            quantity = 1
          } else if (enrollment.unit === 'يوم') {
            // charge only days the child actually attended or was absent without excuse
            quantity = countBillableAttendance()
          } else if (enrollment.unit === 'ساعة') {
            // one hour per billable attendance; admin can adjust actual hours manually
            quantity = countBillableAttendance()
          } else if (enrollment.unit === 'جلسة') {
            // count this child's own sessions for this service in the month (0 is a valid
            // answer — an enrollment with no sessions yet owes nothing, same as 'يوم'/'ساعة';
            // the regeneration branch above refreshes it as sessions are added)
            quantity = countScheduledSessions()
          } else {
            quantity = 1
          }

          // Pro-rate: if child registered mid-month, scale quantity to days remaining
          let proratedCalc: number | null = null
          if (enrollment.reg_date && monthIndex !== -1) {
            // Parsed off the string rather than via `new Date(...)`, which reads a date-only
            // value as UTC midnight and then reports LOCAL components — shifting the day (and
            // possibly the month) in any timezone behind UTC.
            const regParts = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(enrollment.reg_date).trim())
            const regYear = regParts ? Number(regParts[1]) : NaN
            const regMonth = regParts ? Number(regParts[2]) - 1 : NaN
            const regDay = regParts ? Number(regParts[3]) : NaN
            if (regYear === payYear && regMonth === monthIndex && regDay > 1) {
              if (enrollment.unit === 'شهر') {
                // Pro-rate the month through the same calculator the Payments/Dashboard read-time
                // maths uses, so the stored and derived amounts always agree. It splits by the
                // enrollment's selected lesson days when it has them, and by calendar days when
                // it does not.
                proratedCalc = monthlyRate(enrollment.price, regDay, {
                  service: enrollment.service,
                  unit: enrollment.unit,
                  quantity: 1,
                  price: enrollment.price,
                  service_lesson_days: enrollment.lesson_days ?? null,
                })
              } else if (enrollment.unit === 'يوم' || enrollment.unit === 'ساعة') {
                // attendance-driven units: quantity already counts only billable attendance,
                // which cannot predate registration — no extra pro-rating needed
              } else if (enrollment.unit === 'جلسة') {
                // count this child's own sessions from reg_date to end of month — the pro-rate
                // for a per-session enrollment is expressed as a reduced quantity, so
                // quantity × price stays the correct total (unlike the monthly case, which
                // needs prorated_calculated to survive later recomputation)
                quantity = countScheduledSessions(enrollment.reg_date)
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

    // Bring existing monthly rows for this period back in line with the current pro-rating
    // rules. The startup migration does this once across the whole book; doing it here too makes
    // the repair ongoing, so a reg_date corrected after the row was generated is picked up the
    // next time the admin regenerates rather than drifting until the next release. Only rows
    // with nothing collected against them are touched — the rest are reported, never rewritten.
    const { fixed: reconciled, skipped: needsReview } = reconcileMonthlyProrates(db, { month, year })

    return {
      created: createdCount,
      updated: updatedCount,
      /** Monthly rows whose stored pro-rate was corrected to match the current rules. */
      reconciled,
      /** Mismatched rows left alone because payments had already been taken against them. */
      needsReview: needsReview.length,
    }
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

    const user = getCurrentUser()
    const isAdmin = user?.role === 'admin'
    if (quantity !== undefined && Number(quantity) !== payment.quantity && !isAdmin) {
      throw new Error('FORBIDDEN: غير مسموح بتعديل الكمية لغير المسؤولين / Forbidden: Only admins can edit quantity')
    }

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

    const { total, balance, status } = calculatePaymentPreservingProrate(payment, newQuantity, payment.price, newPaid)
    const now = new Date().toISOString()

    db.prepare(`
      UPDATE payments
      SET quantity = ?, paid = ?, total = ?, balance = ?, status = ?, notes = ?,
          payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(newQuantity, newPaid, total, balance, status, newNotes, newMethodId, newMethodName, now, id)

    const updated = db.prepare(`
      SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone
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
    let alreadySettled = 0

    const loadStmt = db.prepare('SELECT * FROM payments WHERE id = ?')
    // Settling a payment now writes a real transaction row for the outstanding amount instead
    // of assigning `paid = total` directly. `paid` is derived from SUM(payment_transactions),
    // so the old direct write left the payment's own installment list unable to explain its
    // paid figure — the Collected-by-method drill-down under-reported the money, and any later
    // recompute (adding an installment, the post-pull sync reconciliation) disagreed with it.
    const insertTxStmt = db.prepare(`
      INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `)

    const transaction = db.transaction(() => {
      for (const id of ids) {
        const payment = loadStmt.get(id) as any
        if (!payment) continue

        const outstanding = Number((Number(payment.total || 0) - Number(payment.paid || 0)).toFixed(2))
        if (outstanding <= 0) {
          // Nothing left to collect — recording a zero/negative transaction would corrupt the
          // ledger, so leave it untouched rather than counting it as a payment.
          alreadySettled++
          continue
        }

        seedLegacyPaidAsTransaction(db, payment, now)
        insertTxStmt.run(
          id, outstanding, methodId, methodName, now.slice(0, 10),
          'تحصيل جماعي / Bulk payment', now, now
        )
        recomputePaymentFromTransactions(db, id)
        updatedCount++
      }
    })

    transaction()
    return { updated: updatedCount, alreadySettled }
  } catch (error: any) {
    console.error('Failed to bulk pay payments:', error)
    throw new Error(error.message || 'Failed to process bulk payments')
  }
})

// ── Partial payments / installments ───────────────────────────────────────────

/**
 * Preserves a payment's pre-existing `paid` amount as a seed transaction row.
 *
 * `paid` is derived from SUM(payment_transactions), but rows created before installments
 * existed (or settled by an older bulk-pay) carry a `paid` figure with no transaction behind it.
 * Writing the first real transaction against such a row would otherwise make the sum drop to
 * just that new amount, silently erasing the money already collected. Called before every
 * transaction insert; a no-op once the row has any transactions of its own.
 */
function seedLegacyPaidAsTransaction(db: any, payment: any, now: string): void {
  const existing = (db.prepare(
    'SELECT COUNT(*) as c FROM payment_transactions WHERE payment_id = ?'
  ).get(payment.id) as any).c
  if (existing > 0 || Number(payment.paid) <= 0) return
  db.prepare(`
    INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    payment.id, Number(payment.paid), payment.payment_method_id ?? null, payment.payment_method_name ?? null,
    (payment.updated_at || payment.created_at || now).slice(0, 10), 'رصيد سابق / Previous balance', now, now
  )
}

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
  const { total, balance, status } = calculatePaymentPreservingProrate(payment, payment.quantity, payment.price, paid)
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
      // Preserve any pre-existing paid amount (set before installments existed) as a seed row
      // so paid = SUM(transactions) stays correct.
      seedLegacyPaidAsTransaction(db, payment, now)
      db.prepare(`
        INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(payment_id, amt, payment_method_id, resolveMethodName(payment_method_id), date, notes, now, now)
      recomputePaymentFromTransactions(db, payment_id)
    })()

    const updated = db.prepare('SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone FROM payments p JOIN children c ON p.child_id = c.id WHERE p.id = ?').get(payment_id) as Payment
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
    const updated = db.prepare('SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone FROM payments p JOIN children c ON p.child_id = c.id WHERE p.id = ?').get(tx.payment_id) as Payment
    const transactions = db.prepare('SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC').all(tx.payment_id)
    return { payment: updated, transactions }
  } catch (error: any) {
    console.error('Failed to delete payment transaction:', error)
    throw new Error(error.message || 'Failed to delete payment transaction')
  }
})

// Deletes a specific set of payment records (and their installment transactions), for the
// "delete selected" action in the payments list. Admin-only, matching the other destructive
// payment operations in this file.
ipcMain.handle('payments:deleteBulk', async (_event, { ids }) => {
  try {
    requireAdmin()
    const db = getDb()
    const list: number[] = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n)) : []
    if (list.length === 0) return { ok: true, deleted: 0 }

    let deleted = 0
    db.transaction(() => {
      const placeholders = list.map(() => '?').join(',')
      db.prepare(`DELETE FROM payment_transactions WHERE payment_id IN (${placeholders})`).run(...list)
      const res = db.prepare(`DELETE FROM payments WHERE id IN (${placeholders})`).run(...list)
      deleted = Number(res.changes)
      // Without a tombstone the cloud copy survives and the next pull re-inserts these rows.
      for (const id of list) recordLocalTombstone(db, 'payments', id)
    })()

    return { ok: true, deleted }
  } catch (error: any) {
    console.error('Failed to delete selected payments:', error)
    throw new Error(error.message || 'Failed to delete selected payments')
  }
})

// Deletes every payment record for a given month/year — the "delete all" action, scoped to
// whatever period is currently open in the payments list (never the whole table at once).
ipcMain.handle('payments:deleteAll', async (_event, { month, year }) => {
  try {
    requireAdmin()
    const db = getDb()
    if (!month || !year) {
      throw new Error('Month and year are required')
    }

    let deleted = 0
    db.transaction(() => {
      const rows = db.prepare('SELECT id FROM payments WHERE month = ? AND year = ?').all(month, year) as { id: number }[]
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id)
        const placeholders = ids.map(() => '?').join(',')
        db.prepare(`DELETE FROM payment_transactions WHERE payment_id IN (${placeholders})`).run(...ids)
      }
      const res = db.prepare(`DELETE FROM payments WHERE month = ? AND year = ?`).run(month, year)
      deleted = Number(res.changes)
      for (const row of rows) recordLocalTombstone(db, 'payments', row.id)
    })()

    return { ok: true, deleted }
  } catch (error: any) {
    console.error('Failed to delete all payments for period:', error)
    throw new Error(error.message || 'Failed to delete all payments for period')
  }
})

ipcMain.handle('payments:deleteForChild', async (_event, { child_id, month, year }) => {
  try {
    requireAdmin()
    const db = getDb()
    if (!child_id || !month || !year) {
      throw new Error('Child ID, month, and year are required')
    }

    db.transaction(() => {
      // Find all payments for this child in this period
      const payments = db.prepare('SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ?').all(child_id, month, year) as { id: number }[]
      
      if (payments.length > 0) {
        const ids = payments.map(p => p.id)
        const placeholders = ids.map(() => '?').join(',')
        
        // Delete any transactions/installments linked to these payments
        db.prepare(`DELETE FROM payment_transactions WHERE payment_id IN (${placeholders})`).run(...ids)
        
        // Delete the payments
        db.prepare(`DELETE FROM payments WHERE child_id = ? AND month = ? AND year = ?`).run(child_id, month, year)

        // Tombstone each one, otherwise the next pull restores them from the cloud and the
        // rows the user just deleted reappear in the list.
        for (const id of ids) recordLocalTombstone(db, 'payments', id)
      }
    })()

    return { ok: true }
  } catch (error: any) {
    console.error('Failed to delete child payments:', error)
    throw new Error(error.message || 'Failed to delete child payments')
  }
})