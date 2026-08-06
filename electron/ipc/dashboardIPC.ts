import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { getCurrentUser } from './authIPC.js'
import { computeBaseSalary } from './salariesIPC.js'
import { ARABIC_MONTH_NAMES, getMonthBillableRows } from '../services/monthlyTotals.js'

const arabicMonths = ARABIC_MONTH_NAMES

/** What the month's payroll costs, and how much of it is still owed to staff. */
export interface SalaryTotals {
  /** Everything the month's payroll is worth (net + bonus − deductions, per active employee). */
  due: number
  /** Actually paid out — the recorded `salary_payments.actual_paid` rows. */
  paid: number
  /** Still owed to staff, floored at zero per employee so overpaying one can't mask another. */
  remaining: number
}

// Pure calculation helper.
//
// `expected_total` (not `total`) is the revenue basis: `payments.total` for attendance-billed
// units only covers days already attended, so mid-month it reports a fraction of the real book.
// A payment row's outstanding amount is therefore expected_total − paid, not the stored
// `balance` column (which is total − paid).
export function calculateDashboard(
  payments: { expected_total: number; total: number; paid: number; balance: number; service: string }[],
  expenses: { amount: number }[],
  salaries: SalaryTotals,
  targetProfitPct: number
) {
  let invoiced = 0
  let billed = 0
  let collected = 0
  let childrenArrears = 0

  for (const p of payments) {
    invoiced += p.expected_total
    billed += p.total
    collected += p.paid
    const outstanding = p.expected_total - p.paid
    if (outstanding > 0) {
      childrenArrears += outstanding
    }
  }

  const collectionRate = invoiced > 0 ? Number((collected / invoiced).toFixed(2)) : 0

  let expensesTotal = 0
  for (const e of expenses) {
    expensesTotal += e.amount
  }

  const salariesTotal = salaries.paid

  // Arrears = every obligation the month still carries, in three parts: what families have yet
  // to pay in, plus what the nursery has yet to pay out (unpaid staff salaries and the month's
  // running expenses). Reported with the breakdown attached so the card is auditable rather
  // than one opaque number.
  const arrearsChildren = Number(childrenArrears.toFixed(2))
  const arrearsSalaries = Number(salaries.remaining.toFixed(2))
  const arrearsExpenses = Number(expensesTotal.toFixed(2))
  const arrears = Number((arrearsChildren + arrearsSalaries + arrearsExpenses).toFixed(2))

  const netProfit = Number((collected - (expensesTotal + salariesTotal)).toFixed(2))

  // Target calculations
  const totalExpenses = expensesTotal + salariesTotal
  const targetRequired = targetProfitPct < 1
    ? Number((totalExpenses / (1 - targetProfitPct)).toFixed(2))
    : 0

  const gap = Number(Math.max(0, targetRequired - collected).toFixed(2))

  return {
    invoiced: Number(invoiced.toFixed(2)),
    billed: Number(billed.toFixed(2)),
    collected: Number(collected.toFixed(2)),
    arrears,
    arrearsBreakdown: {
      children: arrearsChildren,
      salaries: arrearsSalaries,
      expenses: arrearsExpenses,
    },
    collectionRate,
    expensesTotal: Number(expensesTotal.toFixed(2)),
    salariesTotal: Number(salariesTotal.toFixed(2)),
    salariesDue: Number(salaries.due.toFixed(2)),
    netProfit,
    targetRequired,
    gap,
  }
}

/**
 * Payroll cost and outstanding payroll for a month.
 *
 * A `salary_payments` row only exists once payroll has been recorded, so "unpaid salaries"
 * cannot be read from a column — it is derived the same way the Salaries screen derives it
 * (`computeBaseSalary` + bonus − itemised deductions), less whatever was actually paid.
 * Active employees with no payroll row yet therefore count as fully outstanding.
 */
export function getSalaryTotals(db: any, month: string, year: number | string): SalaryTotals {
  const rows = db.prepare(`
    SELECT e.id as employee_id, COALESCE(s.bonus, 0) as bonus, s.actual_paid as stored_actual_paid
    FROM employees e
    LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
    WHERE e.is_active = 1 OR s.id IS NOT NULL
  `).all(month, year) as { employee_id: number; bonus: number; stored_actual_paid: number | null }[]

  const deductionStmt = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?'
  )

  let due = 0
  let paid = 0
  let remaining = 0

  for (const row of rows) {
    const { base } = computeBaseSalary(db, row.employee_id, month, year)
    const deductions = (deductionStmt.get(row.employee_id, month, Number(year)) as any)?.total ?? 0
    const employeeDue = base + (row.bonus ?? 0) - deductions
    const employeePaid = row.stored_actual_paid ?? 0

    due += employeeDue
    paid += employeePaid
    // Floored per employee: an overpaid employee must not cancel out a colleague who is owed.
    remaining += Math.max(0, employeeDue - employeePaid)
  }

  return {
    due: Number(due.toFixed(2)),
    paid: Number(paid.toFixed(2)),
    remaining: Number(remaining.toFixed(2)),
  }
}

function checkAuth() {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized')
  }
}

ipcMain.handle('dashboard:get', async (_event, { month, year }) => {
  try {
    checkAuth()
    const db = getDb()

    if (!month || !year) {
      throw new Error('Month and year are required')
    }

    // 1. Fetch Target Profit Pct from settings
    const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get() as any
    const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : 0.20

    // 2. Fetch payments, expenses, salaries for selected month/year.
    // Payments come through getMonthBillableRows (not a raw SELECT) so the Dashboard's revenue
    // basis is byte-for-byte the same expected-total maths the Payments screen shows.
    const payments = getMonthBillableRows(db, month, year)
    const expenses = db.prepare('SELECT amount FROM expenses WHERE month = ? AND year = ?').all(month, year) as any[]
    const salaries = getSalaryTotals(db, month, year)

    const kpi = calculateDashboard(payments as any, expenses, salaries, targetProfitPct)

    // 3. Revenue broken down by service.
    // Derived from the month's actual payment rows rather than a hardcoded service list:
    // services are user-definable (service_definitions.is_custom) and payments:generate also
    // creates 'حصص إضافية' (extra lessons) rows, so a fixed list of three silently dropped
    // every custom service and all extra-lesson revenue — the breakdown never added up to the
    // Collected KPI. Zero-revenue services are kept out; the donut/legend render whatever
    // services actually collected money, and label unknown ones by their own name.
    const revenueByServiceMap = new Map<string, number>()
    for (const p of payments) {
      const service = p.service || 'غير محدد'
      revenueByServiceMap.set(service, (revenueByServiceMap.get(service) ?? 0) + p.paid)
    }
    const revenueByService = [...revenueByServiceMap.entries()]
      .map(([service, collected]) => ({ service, collected: Number(collected.toFixed(2)) }))
      .filter((s) => s.collected !== 0)
      .sort((a, b) => b.collected - a.collected)

    // 3b. Collected broken down by payment method (for the Collected card drill-down).
    // Prefer per-installment transactions; fall back to the payment's own method for
    // legacy payments that have a paid amount but no transactions recorded.
    const collectedByMethod = (db.prepare(`
      SELECT method, SUM(amount) as total FROM (
        SELECT COALESCE(NULLIF(pt.payment_method_name, ''), 'غير محدد') as method, pt.amount as amount
        FROM payment_transactions pt
        JOIN payments p ON pt.payment_id = p.id
        WHERE p.month = ? AND p.year = ?
        UNION ALL
        SELECT COALESCE(NULLIF(p.payment_method_name, ''), 'غير محدد') as method, p.paid as amount
        FROM payments p
        WHERE p.month = ? AND p.year = ? AND p.paid > 0
          AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.payment_id = p.id)
      )
      GROUP BY method
      ORDER BY total DESC
    `).all(month, year, month, year) as { method: string; total: number }[]).map((r) => ({
      method: r.method,
      total: Number((r.total ?? 0).toFixed(2)),
    }))

    // 4. 12-Month Summary for the selected year
    const summary12Month = []
    for (const m of arabicMonths) {
      const mPayments = getMonthBillableRows(db, m, year)
      const mExpenses = db.prepare('SELECT amount FROM expenses WHERE month = ? AND year = ?').all(m, year) as any[]
      // This panel plots collected / cost / net profit only — no arrears — so it uses the cheap
      // cash-out figure instead of running the full per-employee payroll derivation twelve times.
      const mPaidOut = (db.prepare(
        'SELECT COALESCE(SUM(actual_paid), 0) as total FROM salary_payments WHERE month = ? AND year = ?'
      ).get(m, year) as any)?.total ?? 0
      const mSalaries = { due: mPaidOut, paid: mPaidOut, remaining: 0 }

      const mKpi = calculateDashboard(mPayments as any, mExpenses, mSalaries, targetProfitPct)
      const totalExp = mKpi.expensesTotal + mKpi.salariesTotal

      summary12Month.push({
        month: m,
        collected: mKpi.collected,
        expenses: totalExp,
        netProfit: mKpi.netProfit,
        // A month with no data at all has collected = 0 AND targetRequired = 0, and 0 >= 0 is
        // true — which used to paint every empty and future month green. Require a real target
        // before a month can count as met, matching the guard on the main target KPI below.
        status: mKpi.targetRequired > 0 && mKpi.collected >= mKpi.targetRequired ? 'target_met' : 'target_missed',
      })
    }

    // 5. Smart Alerts
    const alerts = []
    
    if (kpi.gap > 0 && kpi.collected > 0) {
      alerts.push({
        type: 'warning',
        messageAr: `عجز في تحقيق الأهداف الماليّة بمقدار ${kpi.gap} ج.م لهذا الشهر`,
        messageEn: `Financial target shortfall of ${kpi.gap} EGP this month`,
      })
    }
    
    if (kpi.arrears > 0) {
      const b = kpi.arrearsBreakdown
      alerts.push({
        type: 'danger',
        messageAr: `التزامات مستحقة بقيمة ${kpi.arrears} ج.م هذا الشهر (متأخرات الأطفال ${b.children} + رواتب غير مدفوعة ${b.salaries} + مصروفات ${b.expenses})`,
        messageEn: `Outstanding obligations of ${kpi.arrears} EGP this month (children ${b.children} + unpaid salaries ${b.salaries} + expenses ${b.expenses})`,
      })
    }
    
    if (kpi.collectionRate < 0.80 && kpi.invoiced > 0) {
      const pct = Math.round(kpi.collectionRate * 100)
      alerts.push({
        type: 'info',
        messageAr: `نسبة تحصيل الاشتراكات منخفضة (${pct}%)`,
        messageEn: `Low collection rate of (${pct}%)`,
      })
    }

    return {
      kpis: {
        invoiced: kpi.invoiced,
        billed: kpi.billed,
        collected: kpi.collected,
        arrears: kpi.arrears,
        arrearsBreakdown: kpi.arrearsBreakdown,
        collectionRate: kpi.collectionRate,
        expensesTotal: kpi.expensesTotal,
        salariesTotal: kpi.salariesTotal,
        salariesDue: kpi.salariesDue,
        netProfit: kpi.netProfit,
      },
      target: {
        required: kpi.targetRequired,
        collected: kpi.collected,
        gap: kpi.gap,
        status: kpi.gap === 0 && kpi.targetRequired > 0 ? 'met' : 'missed',
      },
      summary12Month,
      revenueByService,
      collectedByMethod,
      alerts,
    }
  } catch (error: any) {
    console.error('Failed to get dashboard data:', error)
    throw new Error(error.message || 'Failed to retrieve dashboard data')
  }
})
