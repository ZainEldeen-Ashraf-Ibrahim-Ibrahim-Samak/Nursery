import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { getCurrentUser } from './authIPC.js'
import { computeBaseSalary } from './salariesIPC.js'
import { ARABIC_MONTH_NAMES, getMonthBillableRows, attachExpectedTotals } from '../services/monthlyTotals.js'
import { findMonthlyProrateMismatches } from '../services/prorateReconcile.js'

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

/**
 * Every line that feeds a Dashboard KPI, with the inputs each amount was derived FROM.
 *
 * The KPI cards are sums of sums — `dashboard:get` returns only the totals, so a figure that
 * looks wrong is unarguable from the Dashboard alone. This returns the raw contributing rows
 * plus the derivation inputs (quantity source, unit rate, pro-rating, lesson-day schedule,
 * salary mode and session counts) so every card can open a page that shows where its number
 * came from. Formatting/labelling is left to the renderer, which owns the AR/EN wording.
 */
ipcMain.handle('dashboard:breakdown', async (_event, { month, year }) => {
  try {
    checkAuth()
    const db = getDb()

    if (!month || !year) {
      throw new Error('Month and year are required')
    }

    const monthIndex = arabicMonths.indexOf(month)
    const today = new Date()
    const isCurrentMonth = monthIndex === today.getMonth() && Number(year) === today.getFullYear()
    const daysInMonth = monthIndex !== -1 ? new Date(Number(year), monthIndex + 1, 0).getDate() : 30

    // --- Children billing lines -------------------------------------------------------
    // Same rows and same maths as getMonthBillableRows, but with the identity and schedule
    // columns the drill-down needs to explain each amount.
    const paymentRows = attachExpectedTotals(
      db.prepare(`
        SELECT p.id, p.child_id, p.service, p.unit, p.quantity, p.price, p.total, p.paid,
               p.balance, p.status, p.prorated_calculated, p.notes,
               c.name as child_name, c.guardian, c.reg_date,
               COALESCE(NULLIF(cs.lesson_days, '[]'), c.lesson_days) as service_lesson_days
        FROM payments p
        JOIN children c ON p.child_id = c.id
        LEFT JOIN child_services cs ON cs.id = p.service_id
        WHERE p.month = ? AND p.year = ?
        ORDER BY c.name ASC, p.service ASC
      `).all(month, year) as any[],
      month,
      year
    )

    const children = paymentRows.map((p: any) => {
      let lessonDays: number[] = []
      try {
        lessonDays = JSON.parse(p.service_lesson_days || '[]')
      } catch { /* no schedule configured */ }
      return {
        paymentId: p.id,
        childId: p.child_id,
        childName: p.child_name,
        guardian: p.guardian,
        service: p.service,
        unit: p.unit,
        /** Quantity already billed from recorded attendance. */
        billedQuantity: Number(p.quantity ?? 0),
        /** Full scheduled quantity for the month (billed + still-scheduled days). */
        expectedQuantity: Number(p.expected_quantity ?? 0),
        price: Number(p.price ?? 0),
        /**
         * Set only for mid-month enrollments: the pro-rated month rate that replaces `price`.
         * Derived from `reg_date` when no discount was stored on the row, so the drill-down
         * explains the same rate the KPI was actually built from.
         */
        proratedRate: Number(p.expected_rate ?? 0) === Number(p.price ?? 0) ? null : Number(p.expected_rate ?? 0),
        /** The child's registration date — why a rate or day count may be less than a full month. */
        regDate: p.reg_date ?? null,
        /**
         * First day of the month this line is billable from: 1 when the child was already
         * enrolled, their registration day for a mid-month start, `null` when they had not
         * registered yet. Lets the drill-down state the real counting window instead of
         * claiming the whole month for a child who joined on the 19th.
         */
        billableFromDay: p.expected_from_day ?? null,
        /** How a mid-month monthly split was worked out: by selected lesson days, or calendar days. */
        prorateBasis: p.expected_prorate_basis ?? null,
        /** quantity × price so far. */
        billedTotal: Number(p.total ?? 0),
        /** expectedQuantity × (proratedRate ?? price) — the month-end figure. */
        expectedTotal: Number(p.expected_total ?? 0),
        paid: Number(p.paid ?? 0),
        outstanding: Number(Math.max(0, Number(p.expected_total ?? 0) - Number(p.paid ?? 0)).toFixed(2)),
        status: p.status,
        lessonDays,
        notes: p.notes,
      }
    })

    // --- Collected: the individual receipts ------------------------------------------
    // Per-installment transactions where they exist, with the legacy single-amount payments
    // (paid > 0 but no transaction rows) folded in the same way the KPI counts them.
    const collections = (db.prepare(`
      SELECT * FROM (
        SELECT pt.id as id, c.name as child_name, p.service as service, pt.amount as amount,
               COALESCE(NULLIF(pt.payment_method_name, ''), 'غير محدد') as method,
               pt.paid_date as date, pt.notes as notes, 0 as is_legacy
        FROM payment_transactions pt
        JOIN payments p ON pt.payment_id = p.id
        JOIN children c ON p.child_id = c.id
        WHERE p.month = ? AND p.year = ?
        UNION ALL
        SELECT p.id as id, c.name as child_name, p.service as service, p.paid as amount,
               COALESCE(NULLIF(p.payment_method_name, ''), 'غير محدد') as method,
               p.updated_at as date, p.notes as notes, 1 as is_legacy
        FROM payments p
        JOIN children c ON p.child_id = c.id
        WHERE p.month = ? AND p.year = ? AND p.paid > 0
          AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.payment_id = p.id)
      )
      ORDER BY date DESC
    `).all(month, year, month, year) as any[]).map((r) => ({
      id: r.id,
      childName: r.child_name,
      service: r.service,
      amount: Number((r.amount ?? 0).toFixed(2)),
      method: r.method,
      date: r.date,
      notes: r.notes,
      isLegacy: r.is_legacy === 1,
    }))

    // --- Payroll: one line per employee, with how the base was derived ----------------
    const employeeRows = db.prepare(`
      SELECT e.id as employee_id, e.name, e.net_salary,
             COALESCE(s.bonus, 0) as bonus, s.actual_paid as stored_actual_paid, s.paid_date
      FROM employees e
      LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
      WHERE e.is_active = 1 OR s.id IS NOT NULL
      ORDER BY e.name ASC
    `).all(month, year) as any[]

    const deductionRowsStmt = db.prepare(
      'SELECT reason, amount FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?'
    )

    const salaries = employeeRows.map((row: any) => {
      const { base, payableSessions, totalSessions, salaryTypeName, salaryTypeMode } =
        computeBaseSalary(db, row.employee_id, month, year)
      const deductionItems = (deductionRowsStmt.all(row.employee_id, month, Number(year)) as any[]).map((d) => ({
        reason: d.reason,
        amount: Number(d.amount ?? 0),
      }))
      const deductions = deductionItems.reduce((sum, d) => sum + d.amount, 0)
      const bonus = Number(row.bonus ?? 0)
      const due = Number((base + bonus - deductions).toFixed(2))
      const paid = Number((row.stored_actual_paid ?? 0).toFixed(2))
      return {
        employeeId: row.employee_id,
        name: row.name,
        salaryTypeName,
        salaryTypeMode,
        netSalary: Number(row.net_salary ?? 0),
        base: Number(base.toFixed(2)),
        payableSessions,
        totalSessions,
        bonus,
        deductions: Number(deductions.toFixed(2)),
        deductionItems,
        due,
        paid,
        /** Floored per employee, exactly as the arrears KPI does. */
        remaining: Number(Math.max(0, due - paid).toFixed(2)),
        paidDate: row.paid_date,
        /** No salary_payments row yet — the whole amount is still outstanding. */
        hasPayrollRow: row.stored_actual_paid != null,
      }
    })

    // --- Expenses: the individual line items -----------------------------------------
    const expenses = (db.prepare(
      'SELECT id, item, category, amount, notes, created_at FROM expenses WHERE month = ? AND year = ? ORDER BY amount DESC'
    ).all(month, year) as any[]).map((e) => ({
      id: e.id,
      item: e.item,
      category: e.category,
      amount: Number((e.amount ?? 0).toFixed(2)),
      notes: e.notes,
      createdAt: e.created_at,
    }))

    // --- Revenue by service, with the contributing children attached ------------------
    const serviceMap = new Map<string, { collected: number; expected: number; children: number }>()
    for (const c of children) {
      const key = c.service || 'غير محدد'
      const entry = serviceMap.get(key) ?? { collected: 0, expected: 0, children: 0 }
      entry.collected += c.paid
      entry.expected += c.expectedTotal
      entry.children += 1
      serviceMap.set(key, entry)
    }
    const revenueByService = [...serviceMap.entries()]
      .map(([service, v]) => ({
        service,
        collected: Number(v.collected.toFixed(2)),
        expected: Number(v.expected.toFixed(2)),
        childCount: v.children,
      }))
      .sort((a, b) => b.collected - a.collected)

    const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get() as any
    const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : 0.20

    const salariesTotals = getSalaryTotals(db, month, year)
    const kpi = calculateDashboard(
      getMonthBillableRows(db, month, year) as any,
      expenses,
      salariesTotals,
      targetProfitPct
    )

    return {
      month,
      year: Number(year),
      /** Calendar facts the expected-quantity maths depends on, so the page can spell it out. */
      period: {
        monthIndex,
        daysInMonth,
        isCurrentMonth,
        /** Scheduled days are counted from here to month end (today for the current month). */
        countFromDay: isCurrentMonth ? today.getDate() : 1,
      },
      targetProfitPct,
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
        targetRequired: kpi.targetRequired,
        gap: kpi.gap,
      },
      children,
      collections,
      salaries,
      expenses,
      revenueByService,
    }
  } catch (error: any) {
    console.error('Failed to get dashboard breakdown:', error)
    throw new Error(error.message || 'Failed to retrieve dashboard breakdown')
  }
})

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
    
    // Monthly rows whose stored amount no longer matches the pro-rating rules. The startup
    // reconciliation corrects every such row that has had nothing collected against it, so
    // anything left here has money against it and needs a human decision — surfacing it beats
    // silently moving a balance the nursery has already acted on.
    const prorateMismatches = findMonthlyProrateMismatches(db, { month, year })
    if (prorateMismatches.length > 0) {
      const net = Number(prorateMismatches.reduce((s, m) => s + m.difference, 0).toFixed(2))
      const names = [...new Set(prorateMismatches.map((m) => m.child_name).filter(Boolean))]
      const sample = names.slice(0, 3).join('، ')
      const more = names.length > 3 ? ` +${names.length - 3}` : ''
      // A positive net means those children were under-billed; negative means over-billed.
      alerts.push({
        type: 'warning',
        messageAr:
          `${prorateMismatches.length} اشتراك شهري مدفوع جزئياً أو كلياً لا تتطابق قيمته مع حساب الاشتراك النسبي ` +
          `(فرق ${net} ج.م): ${sample}${more}. لم يتم تعديلها تلقائياً لأنه تم تحصيل مبالغ عليها.`,
        messageEn:
          `${prorateMismatches.length} monthly subscription(s) with money collected no longer match the ` +
          `pro-rate rules (net ${net} EGP): ${sample}${more}. Left unchanged because payments were already taken against them.`,
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
