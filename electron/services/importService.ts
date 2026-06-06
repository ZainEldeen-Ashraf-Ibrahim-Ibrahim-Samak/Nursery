import ExcelJS from 'exceljs'
import { getDb } from '../db/connection.js'

/**
 * Import service for the Nursery Management System.
 *
 * Reads an Excel workbook (in the original workbook format used by the center)
 * and inserts children, payments, employees, salary_payments, and expenses
 * into the database.
 *
 * Strategy:
 * - Each import is idempotent: uses INSERT OR IGNORE to avoid duplicates.
 * - Children are matched by name (Arabic full name).
 * - Payments are matched by (child_id, month, year, service).
 * - Employees are matched by name.
 * - Salary payments are matched by (employee_id, month, year).
 * - Expenses are matched by (item, month, year) using the UNIQUE constraint.
 */

interface ImportSummary {
  children: { imported: number; skipped: number }
  payments: { imported: number; skipped: number }
  employees: { imported: number; skipped: number }
  salaryPayments: { imported: number; skipped: number }
  expenses: { imported: number; skipped: number }
  sheets: string[]
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

/**
 * Safely convert a cell value to a number.
 */
function toNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return isNaN(n) ? 0 : n
}

/**
 * Safely convert a cell value to a string.
 */
function toStr(val: unknown): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

/**
 * Main import function.
 */
export async function importFromWorkbook(filePath: string): Promise<ImportSummary> {
  const db = getDb()
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(filePath)

  const summary: ImportSummary = {
    children: { imported: 0, skipped: 0 },
    payments: { imported: 0, skipped: 0 },
    employees: { imported: 0, skipped: 0 },
    salaryPayments: { imported: 0, skipped: 0 },
    expenses: { imported: 0, skipped: 0 },
    sheets: workbook.worksheets.map((ws) => ws.name)
  }

  const now = new Date().toISOString()

  // ───────────────────────────────────────────────────
  // 1. Import children + payments from monthly sheets
  // ───────────────────────────────────────────────────
  // Look for sheets named after Arabic months (e.g. "يناير 2025")
  for (const ws of workbook.worksheets) {
    const sheetName = ws.name.trim()

    // Detect monthly payment sheets: contain an Arabic month and a year
    const monthMatch = arabicMonths.find((m) => sheetName.includes(m))
    const yearMatch = sheetName.match(/\d{4}/)
    if (!monthMatch || !yearMatch) continue

    const month = monthMatch
    const year = parseInt(yearMatch[0])

    // Read rows: expect column layout similar to:
    // Col1: Name, Col2: Service, Col3: Monthly Fee, Col4: Paid, Col5: Balance, Col6: Notes
    ws.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum < 2) return // Skip header
      const name = toStr(row.getCell(1).value)
      const service = toStr(row.getCell(2).value)
      const totalFee = toNum(row.getCell(3).value)
      const paid = toNum(row.getCell(4).value)

      if (!name) return

      // Upsert child
      let child = db.prepare('SELECT id FROM children WHERE name = ?').get(name) as any
      if (!child) {
        const result = db.prepare(`
          INSERT OR IGNORE INTO children (name, service, monthly_fee, join_date, created_at, synced)
          VALUES (?, ?, ?, ?, ?, 0)
        `).run(name, service || 'حضانة', totalFee, now, now)

        if (result.changes > 0) {
          summary.children.imported++
          child = { id: result.lastInsertRowid }
        } else {
          summary.children.skipped++
          child = db.prepare('SELECT id FROM children WHERE name = ?').get(name) as any
        }
      }

      if (!child) return

      // Upsert payment
      const balance = totalFee - paid
      const status = paid >= totalFee ? 'paid' : paid > 0 ? 'partial' : 'unpaid'

      const existing = db.prepare(
        'SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ? AND service = ?'
      ).get(child.id, month, year, service || 'حضانة')

      if (!existing) {
        db.prepare(`
          INSERT INTO payments (child_id, service, month, year, total, paid, balance, status, created_at, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(child.id, service || 'حضانة', month, year, totalFee, paid, balance, status, now)
        summary.payments.imported++
      } else {
        summary.payments.skipped++
      }
    })
  }

  // ───────────────────────────────────────────────────
  // 2. Import employees + salaries from 'الرواتب' sheet
  // ───────────────────────────────────────────────────
  const salarySheet = workbook.worksheets.find((ws) =>
    ws.name.includes('راتب') || ws.name.includes('موظف') || ws.name.toLowerCase().includes('salary')
  )

  if (salarySheet) {
    let month = arabicMonths[new Date().getMonth()]
    let year = new Date().getFullYear()

    // Try to read month/year from cell A1 or B1
    const headerMonthCell = toStr(salarySheet.getCell('A1').value) || toStr(salarySheet.getCell('B1').value)
    const headerMonthMatch = arabicMonths.find((m) => headerMonthCell.includes(m))
    if (headerMonthMatch) month = headerMonthMatch
    const headerYearMatch = headerMonthCell.match(/\d{4}/)
    if (headerYearMatch) year = parseInt(headerYearMatch[0])

    salarySheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum < 2) return
      const name = toStr(row.getCell(1).value)
      const baseSalary = toNum(row.getCell(2).value)
      const housing = toNum(row.getCell(3).value)
      const transport = toNum(row.getCell(4).value)
      const bonus = toNum(row.getCell(5).value)
      const deduction = toNum(row.getCell(6).value)
      const actualPaid = toNum(row.getCell(7).value)

      if (!name || (!baseSalary && !actualPaid)) return

      // Upsert employee
      let emp = db.prepare('SELECT id FROM employees WHERE name = ?').get(name) as any
      if (!emp) {
        const result = db.prepare(`
          INSERT OR IGNORE INTO employees (name, base_salary, housing_allowance, transport_allowance, is_active, created_at, synced)
          VALUES (?, ?, ?, ?, 1, ?, 0)
        `).run(name, baseSalary, housing, transport, now)

        if (result.changes > 0) {
          summary.employees.imported++
          emp = { id: result.lastInsertRowid }
        } else {
          summary.employees.skipped++
          emp = db.prepare('SELECT id FROM employees WHERE name = ?').get(name) as any
        }
      }

      if (!emp) return

      // Upsert salary payment
      const existing = db.prepare(
        'SELECT id FROM salary_payments WHERE employee_id = ? AND month = ? AND year = ?'
      ).get(emp.id, month, year)

      if (!existing) {
        db.prepare(`
          INSERT INTO salary_payments (employee_id, month, year, bonus, deduction, actual_paid, pay_date, created_at, synced)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
        `).run(emp.id, month, year, bonus, deduction, actualPaid || baseSalary, now.slice(0, 10), now)
        summary.salaryPayments.imported++
      } else {
        summary.salaryPayments.skipped++
      }
    })
  }

  // ───────────────────────────────────────────────────
  // 3. Import expenses from 'المصروفات' sheet
  // ───────────────────────────────────────────────────
  const expensesSheet = workbook.worksheets.find((ws) =>
    ws.name.includes('مصروف') || ws.name.toLowerCase().includes('expense')
  )

  if (expensesSheet) {
    const year = new Date().getFullYear()

    // Expected structure: Row1 = header (item | Jan | Feb | ... | Dec)
    // Col1 = item name, Col2..Col13 = monthly amounts for Jan-Dec
    expensesSheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum < 2) return
      const item = toStr(row.getCell(1).value)
      if (!item) return

      arabicMonths.forEach((month, idx) => {
        const amount = toNum(row.getCell(idx + 2).value)
        if (amount === 0) return

        db.prepare(`
          INSERT INTO expenses (item, month, year, amount, category, notes, created_at, synced)
          VALUES (?, ?, ?, ?, NULL, NULL, ?, 0)
          ON CONFLICT(item, month, year) DO NOTHING
        `).run(item, month, year, amount, now)
        summary.expenses.imported++
      })
    })
  }

  return summary
}
