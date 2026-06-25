import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'
import type { Employee, SalaryPayment } from '../../src/types/index.js'

// 1. employees:get (Admin only)
ipcMain.handle('employees:get', async () => {
  try {
    requireAdmin()
    const db = getDb()
    const rows = db.prepare(`
      SELECT e.*, er.name as role_name, er.salary_type_id as role_salary_type_id
      FROM employees e
      LEFT JOIN employee_roles er ON e.role_id = er.id
      ORDER BY e.name ASC
    `).all() as Employee[]
    return rows
  } catch (error: any) {
    console.error('Failed to get employees:', error)
    throw new Error(error.message || 'Failed to get employees')
  }
})

// 2. employees:add (Admin only)
ipcMain.handle('employees:add', async (_event, employeeInput) => {
  try {
    requireAdmin()
    const db = getDb()
    const { name, role_id, base_salary, housing = 0, transport = 0, salary_type_override_id = null } = employeeInput

    if (!name || base_salary === undefined) {
      throw new Error('جميع الحقول الإلزامية مطلوبة / Missing required fields')
    }

    // resolve role text from role_id if provided
    let roleText = employeeInput.role ?? ''
    if (role_id) {
      const roleRow = db.prepare('SELECT name FROM employee_roles WHERE id = ?').get(role_id) as any
      if (!roleRow) throw new Error('الدور غير موجود / Role not found')
      roleText = roleRow.name
    }

    const netSalary = Number(base_salary) + Number(housing) + Number(transport)
    const now = new Date().toISOString()

    const result = db.prepare(`
      INSERT INTO employees (name, role, role_id, salary_type_override_id, base_salary, housing, transport, net_salary, is_active, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
    `).run(name, roleText, role_id ?? null, salary_type_override_id, Number(base_salary), Number(housing), Number(transport), netSalary, now, now)

    const createdId = Number(result.lastInsertRowid)
    const createdEmployee = db.prepare(`
      SELECT e.*, er.name as role_name FROM employees e LEFT JOIN employee_roles er ON e.role_id = er.id WHERE e.id = ?
    `).get(createdId) as Employee
    return createdEmployee
  } catch (error: any) {
    console.error('Failed to add employee:', error)
    throw new Error(error.message || 'Failed to add employee')
  }
})

// 3. employees:update (Admin only)
ipcMain.handle('employees:update', async (_event, { id, patch }) => {
  try {
    requireAdmin()
    const db = getDb()

    if (!id || !patch) {
      throw new Error('Employee ID and patch are required')
    }

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as any
    if (!emp) {
      throw new Error('الموظف غير موجود / Employee not found')
    }

    const name = patch.name !== undefined ? patch.name : emp.name
    let role = patch.role !== undefined ? patch.role : emp.role
    let role_id = patch.role_id !== undefined ? patch.role_id : emp.role_id
    const salary_type_override_id = patch.salary_type_override_id !== undefined ? patch.salary_type_override_id : emp.salary_type_override_id
    const base_salary = patch.base_salary !== undefined ? Number(patch.base_salary) : emp.base_salary
    const housing = patch.housing !== undefined ? Number(patch.housing) : emp.housing
    const transport = patch.transport !== undefined ? Number(patch.transport) : emp.transport

    // Sync role text from role_id
    if (patch.role_id !== undefined && patch.role_id !== null) {
      const roleRow = db.prepare('SELECT name FROM employee_roles WHERE id = ?').get(patch.role_id) as any
      if (!roleRow) throw new Error('الدور غير موجود / Role not found')
      role = roleRow.name
      role_id = patch.role_id
    }

    const netSalary = base_salary + housing + transport

    db.prepare(`
      UPDATE employees
      SET name = ?, role = ?, role_id = ?, salary_type_override_id = ?, base_salary = ?, housing = ?, transport = ?, net_salary = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(name, role, role_id, salary_type_override_id, base_salary, housing, transport, netSalary, new Date().toISOString(), id)

    const updatedEmployee = db.prepare(`
      SELECT e.*, er.name as role_name FROM employees e LEFT JOIN employee_roles er ON e.role_id = er.id WHERE e.id = ?
    `).get(id) as Employee
    return updatedEmployee
  } catch (error: any) {
    console.error('Failed to update employee:', error)
    throw new Error(error.message || 'Failed to update employee')
  }
})

// 4. employees:deactivate (Admin only)
ipcMain.handle('employees:deactivate', async (_event, { id }) => {
  try {
    requireAdmin()
    const db = getDb()

    const emp = db.prepare('SELECT id FROM employees WHERE id = ?').get(id)
    if (!emp) {
      throw new Error('الموظف غير موجود / Employee not found')
    }

    db.prepare('UPDATE employees SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?').run(new Date().toISOString(), id)
    return { ok: true }
  } catch (error: any) {
    console.error('Failed to deactivate employee:', error)
    throw new Error(error.message || 'Failed to deactivate employee')
  }
})

// 5. salary:get (Admin only)
ipcMain.handle('salary:get', async (_event, { month, year }) => {
  try {
    requireAdmin()
    const db = getDb()

    if (!month || !year) {
      throw new Error('Month and year are required')
    }

    const rows = db.prepare(`
      SELECT
        COALESCE(s.id, -e.id) as id,
        e.id as employee_id,
        e.name as employee_name,
        e.role as employee_role,
        e.role_id,
        e.salary_type_override_id,
        e.net_salary as net_salary,
        COALESCE(s.month, ?) as month,
        COALESCE(s.year, ?) as year,
        COALESCE(s.bonus, 0) as bonus,
        COALESCE(s.deductions, 0) as deductions,
        s.actual_paid as stored_actual_paid,
        s.paid_date,
        s.paid_date as pay_date,
        s.notes,
        er.salary_type_id as role_salary_type_id,
        COALESCE(e.salary_type_override_id, er.salary_type_id) as effective_salary_type_id
      FROM employees e
      LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
      LEFT JOIN employee_roles er ON e.role_id = er.id
      WHERE e.is_active = 1 OR s.id IS NOT NULL
      ORDER BY e.name ASC
    `).all(month, year, month, year) as any[]

    // Enrich with salary type info and compute actual_paid by formula
    const monthNum = String(month === 'يناير' ? 1 : month === 'فبراير' ? 2 : month === 'مارس' ? 3 : month === 'أبريل' ? 4 : month === 'مايو' ? 5 : month === 'يونيو' ? 6 : month === 'يوليو' ? 7 : month === 'أغسطس' ? 8 : month === 'سبتمبر' ? 9 : month === 'أكتوبر' ? 10 : month === 'نوفمبر' ? 11 : 12).padStart(2, '0')
    const yearStr = String(year)
    const monthStart = `${yearStr}-${monthNum}-01`
    const monthEnd = `${yearStr}-${monthNum}-31`

    return rows.map((row) => {
      let salaryTypeName: string | null = null
      let salaryTypeMode: string | null = null
      let computedActualPaid = row.net_salary

      if (row.effective_salary_type_id) {
        const st = db.prepare('SELECT * FROM salary_types WHERE id = ?').get(row.effective_salary_type_id) as any
        if (st) {
          salaryTypeName = st.name
          salaryTypeMode = st.mode

          // Get payable sessions for this employee this month
          let payableSessions = 0
          const sessionIds = (db.prepare(`
            SELECT ss.id FROM scheduled_sessions ss
            JOIN session_teachers stc ON stc.session_id = ss.id
            WHERE stc.employee_id = ? AND ss.session_date >= ? AND ss.session_date <= ?
          `).all(row.employee_id, monthStart, monthEnd) as { id: number }[]).map((s) => s.id)

          if (sessionIds.length > 0) {
            const placeholders = sessionIds.map(() => '?').join(',')
            const attendedRows = db.prepare(`
              SELECT COUNT(*) as cnt FROM attendance_records WHERE session_id IN (${placeholders}) AND status != 'absent_excused'
            `).get(...sessionIds) as { cnt: number }
            payableSessions = attendedRows.cnt
          }

          if (st.mode === 'fixed_monthly') {
            computedActualPaid = st.monthly_rate ?? row.net_salary
          } else if (st.mode === 'per_session_fixed') {
            computedActualPaid = payableSessions * (st.session_rate ?? 0)
          } else if (st.mode === 'per_session_pct') {
            // session revenue: sum of child service prices for sessions attended this month
            computedActualPaid = payableSessions * (st.session_pct ?? 0) * 100 // placeholder; session_revenue TBD
          } else if (st.mode === 'hybrid') {
            computedActualPaid = (st.monthly_rate ?? 0) + payableSessions * (st.session_rate ?? 0)
          }

          row.payable_sessions = payableSessions
          row.total_sessions = sessionIds.length
        }
      }

      const bonus = row.bonus ?? 0
      // Sum itemised deductions from employee_deductions table
      const deductionSum = (db.prepare(
        'SELECT COALESCE(SUM(amount), 0) as total FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?'
      ).get(row.employee_id, month, Number(year)) as any)?.total ?? 0

      return {
        ...row,
        salary_type_name: salaryTypeName,
        salary_type_mode: salaryTypeMode,
        deductions: deductionSum,
        actual_paid: row.stored_actual_paid ?? (computedActualPaid + bonus - deductionSum),
      } as SalaryPayment
    })
  } catch (error: any) {
    console.error('Failed to get salary payments:', error)
    throw new Error(error.message || 'Failed to get salary payments')
  }
})

// 6. salary:update (Admin only)
ipcMain.handle('salary:update', async (_event, { employee_id, month, year, bonus = 0, deductions = 0, paid_date = null, notes = null, override_amount = null }) => {
  try {
    requireAdmin()
    const db = getDb()

    if (!employee_id || !month || !year) {
      throw new Error('Employee ID, month, and year are required')
    }

    const emp = db.prepare('SELECT net_salary FROM employees WHERE id = ?').get(employee_id) as any
    if (!emp) {
      throw new Error('الموظف غير موجود / Employee not found')
    }

    // Use itemised deductions sum; fall back to the passed-in deductions param if no table entries
    const tableDeductionRow = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?'
    ).get(employee_id, month, Number(year)) as any
    const deductionSum = tableDeductionRow?.cnt > 0 ? (tableDeductionRow?.total ?? 0) : Number(deductions)

    const actualPaid = override_amount !== null ? Number(override_amount) : (Number(emp.net_salary) + Number(bonus) - deductionSum)

    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO salary_payments (employee_id, month, year, bonus, deductions, actual_paid, paid_date, notes, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(employee_id, month, year) DO UPDATE SET
        bonus = excluded.bonus,
        deductions = excluded.deductions,
        actual_paid = excluded.actual_paid,
        paid_date = excluded.paid_date,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        synced = 0
    `).run(employee_id, month, Number(year), Number(bonus), deductionSum, actualPaid, paid_date, notes, now)

    const updatedPayment = db.prepare(`
      SELECT s.*, s.paid_date as pay_date, e.name as employee_name, e.role as employee_role
      FROM salary_payments s
      JOIN employees e ON s.employee_id = e.id
      WHERE s.employee_id = ? AND s.month = ? AND s.year = ?
    `).get(employee_id, month, year) as SalaryPayment

    return updatedPayment
  } catch (error: any) {
    console.error('Failed to update salary payment:', error)
    throw new Error(error.message || 'Failed to update salary payment')
  }
})