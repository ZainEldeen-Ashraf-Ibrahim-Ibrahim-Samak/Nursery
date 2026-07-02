import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: () => 'mock-user-data' }
}))

import { ipcMain } from 'electron'
import { initDb, getDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'
import '../../electron/ipc/attendanceIPC.js'

function getHandler(channel: string) {
  const calls = (ipcMain.handle as any).mock.calls as [string, Function][]
  const found = calls.find(([name]) => name === channel)
  if (!found) throw new Error(`Handler not registered: ${channel}`)
  return found[1]
}

describe('Attendance-based teacher payments — duplicate protection & void/requalify (US5/US6)', () => {
  let db: any
  let teacherId: number
  let childId: number
  let sessionId: number

  beforeAll(() => {
    db = initDb()
    runMigrations(db)
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 })

    const now = new Date().toISOString()
    db.prepare(`INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (1, 'admin', 'x', 'admin', 1, ?)`).run(now)

    teacherId = Number(db.prepare(`
      INSERT INTO employees (name, role, base_salary, net_salary, is_active, created_at, teacher_session_rate)
      VALUES ('Ahmed', 'Teacher', 0, 0, 1, ?, 150)
    `).run(now).lastInsertRowid)

    childId = Number(db.prepare(`
      INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, teacher_id)
      VALUES ('Sami', 'Guardian', '0100', 'جلسة', 'جلسة', 100, '2026-01-01', ?, ?, ?)
    `).run(now, now, teacherId).lastInsertRowid)

    sessionId = Number(db.prepare(`
      INSERT INTO scheduled_sessions (session_date, created_at, updated_at)
      VALUES ('2026-07-04', ?, ?)
    `).run(now, now).lastInsertRowid)
  })

  const record = getHandler('attendance:record')

  it('generates exactly one pending payment when teacher present + child attended', async () => {
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'attended', teacher_status: 'present' }] })
    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').all(teacherId, childId)
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('pending')
    expect(rows[0].session_cost).toBe(150)
  })

  it('does not create a duplicate when the same attendance is saved again unchanged', async () => {
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'attended', teacher_status: 'present' }] })
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'attended', teacher_status: 'present' }] })
    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').all(teacherId, childId)
    expect(rows.length).toBe(1)
  })

  it('voids the payment (does not delete it) when the edit disqualifies it', async () => {
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'absent_excused', teacher_status: 'present' }] })
    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').all(teacherId, childId)
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('void')
  })

  it('requalifies a void payment back to pending with a fresh snapshot, still exactly one row', async () => {
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'attended', teacher_status: 'present' }] })
    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').all(teacherId, childId)
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('pending')
  })

  it('never auto-mutates a paid payment', async () => {
    db.prepare(`UPDATE teacher_payments SET status = 'paid' WHERE teacher_id = ? AND child_id = ?`).run(teacherId, childId)
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'absent_excused', teacher_status: 'present' }] })
    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').all(teacherId, childId)
    expect(rows.length).toBe(1)
    expect(rows[0].status).toBe('paid')
  })

  it('does not generate a payment when the teacher is absent, even if the child attended', async () => {
    const otherSession = Number(db.prepare(`
      INSERT INTO scheduled_sessions (session_date, created_at, updated_at) VALUES ('2026-07-06', ?, ?)
    `).run(new Date().toISOString(), new Date().toISOString()).lastInsertRowid)
    await record(null, { session_id: otherSession, records: [{ child_id: childId, status: 'attended', teacher_status: 'absent' }] })
    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ? AND attendance_date = ?').all(teacherId, childId, '2026-07-06')
    expect(rows.length).toBe(0)
  })

  it('never generates a payment for a teacher who has no per-session rate configured by the admin and no org-wide default set', async () => {
    const now = new Date().toISOString()
    const noRateTeacherId = Number(db.prepare(`
      INSERT INTO employees (name, role, base_salary, net_salary, is_active, created_at)
      VALUES ('Unrated Teacher', 'Teacher', 0, 0, 1, ?)
    `).run(now).lastInsertRowid)
    const noRateChildId = Number(db.prepare(`
      INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, teacher_id)
      VALUES ('Layla', 'Guardian', '0101', 'جلسة', 'جلسة', 100, '2026-01-01', ?, ?, ?)
    `).run(now, now, noRateTeacherId).lastInsertRowid)
    const noRateSession = Number(db.prepare(`
      INSERT INTO scheduled_sessions (session_date, created_at, updated_at) VALUES ('2026-07-08', ?, ?)
    `).run(now, now).lastInsertRowid)

    await record(null, { session_id: noRateSession, records: [{ child_id: noRateChildId, status: 'attended', teacher_status: 'present' }] })

    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ?').all(noRateTeacherId)
    expect(rows.length).toBe(0)
  })

  it('re-snapshots session_cost on a still-pending payment when the teacher rate is corrected afterward', async () => {
    const now = new Date().toISOString()
    db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at, synced) VALUES ('default_teacher_session_rate', '40', ?, 0)`).run(now)

    const teacher = Number(db.prepare(`
      INSERT INTO employees (name, role, base_salary, net_salary, is_active, created_at)
      VALUES ('Corrected Rate Teacher', 'Teacher', 0, 0, 1, ?)
    `).run(now).lastInsertRowid)
    const child = Number(db.prepare(`
      INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, teacher_id)
      VALUES ('Omar', 'Guardian', '0103', 'جلسة', 'جلسة', 100, '2026-01-01', ?, ?, ?)
    `).run(now, now, teacher).lastInsertRowid)
    const session = Number(db.prepare(`
      INSERT INTO scheduled_sessions (session_date, created_at, updated_at) VALUES ('2026-07-10', ?, ?)
    `).run(now, now).lastInsertRowid)

    // First save: teacher has no rate of their own yet, so the org-wide default (40) applies.
    await record(null, { session_id: session, records: [{ child_id: child, status: 'attended', teacher_status: 'present' }] })
    let rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ?').all(teacher)
    expect(rows[0].session_cost).toBe(40)

    // Admin now sets the teacher's own rate to 30. Re-saving the same (still-pending) attendance
    // must pick up 30, not keep the stale 40 snapshot.
    db.prepare(`UPDATE employees SET teacher_session_rate = 30 WHERE id = ?`).run(teacher)
    await record(null, { session_id: session, records: [{ child_id: child, status: 'attended', teacher_status: 'present' }] })
    rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ?').all(teacher)
    expect(rows.length).toBe(1)
    expect(rows[0].session_cost).toBe(30)

    db.prepare(`DELETE FROM settings WHERE key = 'default_teacher_session_rate'`).run()
  })

  it('does NOT re-snapshot a payment that has already been marked paid, even if the rate changes', async () => {
    db.prepare(`UPDATE teacher_payments SET status = 'paid' WHERE teacher_id = ? AND child_id = ?`).run(teacherId, childId)
    const before = db.prepare('SELECT session_cost FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').get(teacherId, childId) as any
    db.prepare(`UPDATE employees SET teacher_session_rate = 999 WHERE id = ?`).run(teacherId)
    await record(null, { session_id: sessionId, records: [{ child_id: childId, status: 'attended', teacher_status: 'present' }] })
    const after = db.prepare('SELECT session_cost, status FROM teacher_payments WHERE teacher_id = ? AND child_id = ?').get(teacherId, childId) as any
    expect(after.status).toBe('paid')
    expect(after.session_cost).toBe(before.session_cost)
  })

  it('falls back to the org-wide default_teacher_session_rate setting when the teacher has no rate of their own', async () => {
    const now = new Date().toISOString()
    db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at, synced) VALUES ('default_teacher_session_rate', '120', ?, 0)`).run(now)

    const noRateTeacherId = Number(db.prepare(`
      INSERT INTO employees (name, role, base_salary, net_salary, is_active, created_at)
      VALUES ('Fallback Teacher', 'Teacher', 0, 0, 1, ?)
    `).run(now).lastInsertRowid)
    const noRateChildId = Number(db.prepare(`
      INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, teacher_id)
      VALUES ('Nour', 'Guardian', '0102', 'جلسة', 'جلسة', 100, '2026-01-01', ?, ?, ?)
    `).run(now, now, noRateTeacherId).lastInsertRowid)
    const session = Number(db.prepare(`
      INSERT INTO scheduled_sessions (session_date, created_at, updated_at) VALUES ('2026-07-09', ?, ?)
    `).run(now, now).lastInsertRowid)

    await record(null, { session_id: session, records: [{ child_id: noRateChildId, status: 'attended', teacher_status: 'present' }] })

    const rows = db.prepare('SELECT * FROM teacher_payments WHERE teacher_id = ?').all(noRateTeacherId)
    expect(rows.length).toBe(1)
    expect(rows[0].session_cost).toBe(120)

    db.prepare(`DELETE FROM settings WHERE key = 'default_teacher_session_rate'`).run()
  })
})
