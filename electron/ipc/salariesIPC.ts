import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'
import type { Employee, SalaryPayment } from '../../src/types/index.js'

// 1. employees:get (Admin only)
ipcMain.handle('employees:get', async () => {
  try {
    requireAdmin()
    const db = getDb()
    const rows = db.prepare('SELECT * FROM employees ORDER BY name ASC').all() as Employee[]
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
    const { name, role, base_salary, housing = 0, transport = 0 } = employeeInput

    if (!name || !role || base_salary === undefined) {
      throw new Error('جميع الحقول الإلزامية مطلوبة / Missing required fields')
    }

    const netSalary = Number(base_salary) + Number(housing) + Number(transport)
    const now = new Date().toISOString()

    const result = db.prepare(`
      INSERT INTO employees (name, role, base_salary, housing, transport, net_salary, is_active, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
    `).run(name, role, Number(base_salary), Number(housing), Number(transport), netSalary, now, now)

    const createdId = Number(result.lastInsertRowid)
    const createdEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(createdId) as Employee
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

    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined
    if (!emp) {
      throw new Error('الموظف غير موجود / Employee not found')
    }

    const name = patch.name !== undefined ? patch.name : emp.name
    const role = patch.role !== undefined ? patch.role : emp.role
    const base_salary = patch.base_salary !== undefined ? Number(patch.base_salary) : emp.base_salary
    const housing = patch.housing !== undefined ? Number(patch.housing) : emp.housing
    const transport = patch.transport !== undefined ? Number(patch.transport) : emp.transport

    const netSalary = base_salary + housing + transport

    db.prepare(`
      UPDATE employees
      SET name = ?, role = ?, base_salary = ?, housing = ?, transport = ?, net_salary = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(name, role, base_salary, housing, transport, netSalary, new Date().toISOString(), id)

    const updatedEmployee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee
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

    // Return joined details for all active employees plus any paid inactive ones
    const rows = db.prepare(`
      SELECT 
        COALESCE(s.id, -e.id) as id,
        e.id as employee_id,
        e.name as employee_name,
        e.role as employee_role,
        e.net_salary as net_salary,
        COALESCE(s.month, ?) as month,
        COALESCE(s.year, ?) as year,
        COALESCE(s.bonus, 0) as bonus,
        COALESCE(s.deductions, 0) as deductions,
        COALESCE(s.actual_paid, e.net_salary) as actual_paid,
        s.paid_date,
        s.paid_date as pay_date,
        s.notes
      FROM employees e
      LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
      WHERE e.is_active = 1 OR s.id IS NOT NULL
      ORDER BY e.name ASC
    `).all(month, year, month, year) as SalaryPayment[]

    return rows
  } catch (error: any) {
    console.error('Failed to get salary payments:', error)
    throw new Error(error.message || 'Failed to get salary payments')
  }
})

// 6. salary:update (Admin only)
ipcMain.handle('salary:update', async (_event, { employee_id, month, year, bonus = 0, deductions = 0, paid_date = null, notes = null }) => {
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

    const actualPaid = Number(emp.net_salary) + Number(bonus) - Number(deductions)

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
    `).run(employee_id, month, Number(year), Number(bonus), Number(deductions), actualPaid, paid_date, notes, now)

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