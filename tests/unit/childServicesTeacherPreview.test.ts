import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: () => 'mock-user-data' }
}))

import { ipcMain } from 'electron'
import { initDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'
import '../../electron/ipc/childServicesIPC.js'
import '../../electron/ipc/salariesIPC.js'

function getHandler(channel: string) {
  const calls = (ipcMain.handle as any).mock.calls as [string, Function][]
  const found = calls.find(([name]) => name === channel)
  if (!found) throw new Error(`Handler not registered: ${channel}`)
  return found[1]
}

describe('childServices:previewTeacherCost — remaining-sessions/cost preview (US2, FR-002/FR-003)', () => {
  let db: any
  let teacherId: number

  beforeAll(() => {
    db = initDb()
    runMigrations(db)
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 })
  })

  const add = getHandler('employees:add')
  const preview = getHandler('childServices:previewTeacherCost')

  it('computes remaining sessions and expected cost from lesson_days and the teacher rate', async () => {
    const emp = await add(null, { name: 'Ahmed', base_salary: 0, teacher_session_rate: 200 })
    teacherId = emp.id

    // Every weekday (0-6) — so every remaining day of the month counts.
    const result = await preview(null, { teacher_id: teacherId, lesson_days: [0, 1, 2, 3, 4, 5, 6] })

    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const expectedRemaining = daysInMonth - today.getDate() + 1

    expect(result.remaining_sessions).toBe(expectedRemaining)
    expect(result.expected_cost).toBe(expectedRemaining * 200)
  })

  it('returns zero remaining sessions when lesson_days is empty', async () => {
    const result = await preview(null, { teacher_id: teacherId, lesson_days: [] })
    expect(result.remaining_sessions).toBe(0)
    expect(result.expected_cost).toBe(0)
  })

  it('treats a teacher with no configured rate and no org-wide default as a zero-cost preview (not an error)', async () => {
    const emp = await add(null, { name: 'NoRate', base_salary: 0 })
    const result = await preview(null, { teacher_id: emp.id, lesson_days: [0, 1, 2, 3, 4, 5, 6] })
    expect(result.teacher_session_rate).toBe(0)
    expect(result.expected_cost).toBe(0)
  })

  it('previews using the org-wide default_teacher_session_rate when the teacher has none of their own', async () => {
    const now = new Date().toISOString()
    db.prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at, synced) VALUES ('default_teacher_session_rate', '80', ?, 0)`).run(now)
    const emp = await add(null, { name: 'NoRateWithDefault', base_salary: 0 })
    const result = await preview(null, { teacher_id: emp.id, lesson_days: [1] })
    expect(result.teacher_session_rate).toBe(80)
    db.prepare(`DELETE FROM settings WHERE key = 'default_teacher_session_rate'`).run()
  })

  it('never writes anything — pure computation', async () => {
    await preview(null, { teacher_id: teacherId, lesson_days: [1] })
    const paymentCount = (db.prepare('SELECT COUNT(*) as cnt FROM teacher_payments').get() as any).cnt
    expect(paymentCount).toBe(0)
  })
})
