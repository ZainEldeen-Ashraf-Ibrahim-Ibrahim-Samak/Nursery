import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: () => 'mock-user-data' }
}))

import { ipcMain } from 'electron'
import { initDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'
import '../../electron/ipc/childrenIPC.js'
import '../../electron/ipc/paymentsIPC.js'

function getHandler(channel: string) {
  const calls = (ipcMain.handle as any).mock.calls as [string, Function][]
  const found = calls.find(([name]) => name === channel)
  if (!found) throw new Error(`Handler not registered: ${channel}`)
  return found[1]
}

/**
 * Deleting locally is only half a delete.
 *
 * Push/pull cannot distinguish "this row was deleted here" from "this row hasn't reached this
 * device yet" — a row that is simply gone locally is indistinguishable from one that never
 * arrived, so the next pull happily re-inserts it from the cloud. `tombstones` is the record
 * that makes a delete propagate. Without one, deleting a child or their payments looked like it
 * worked until auto-sync ran and brought everything back.
 */
describe('deletes record tombstones so they propagate through sync', () => {
  let db: any
  let childId: number
  let paymentIds: number[]

  const tombstonesFor = (entity: string): number[] =>
    (db.prepare('SELECT record_id FROM tombstones WHERE entity = ? ORDER BY record_id').all(entity) as
      { record_id: number }[]).map((r) => r.record_id)

  beforeEach(() => {
    db = initDb()
    runMigrations(db)
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 } as any)

    db.prepare('DELETE FROM tombstones').run()
    db.prepare('DELETE FROM payments').run()
    db.prepare('DELETE FROM child_services').run()
    db.prepare('DELETE FROM children').run()

    const now = new Date().toISOString()
    db.prepare(
      `INSERT OR IGNORE INTO users (id, username, password, role, is_active, created_at)
       VALUES (1, 'admin', 'x', 'admin', 1, ?)`
    ).run(now)

    childId = Number(db.prepare(
      `INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, is_active)
       VALUES ('Sami', 'Guardian', '0100', 'حضانة', 'شهر', 1000, '2026-01-01', ?, ?, 1)`
    ).run(now, now).lastInsertRowid)

    const serviceId = Number(db.prepare(
      `INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at)
       VALUES (?, 'حضانة', 'شهر', 1000, ?, ?)`
    ).run(childId, now, now).lastInsertRowid)

    paymentIds = ['يناير', 'فبراير'].map((month) => Number(db.prepare(
      `INSERT INTO payments (child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, created_at, updated_at)
       VALUES (?, ?, ?, 2026, 'حضانة', 'شهر', 1, 1000, 1000, 0, 1000, 'unpaid', ?, ?)`
    ).run(childId, serviceId, month, now, now).lastInsertRowid))
  })

  it('tombstones the child, their enrollments and their cascaded payments on hard delete', async () => {
    db.prepare('UPDATE children SET is_active = 0 WHERE id = ?').run(childId)
    await getHandler('children:delete')(null, { id: childId })

    expect(db.prepare('SELECT COUNT(*) c FROM children').get().c).toBe(0)

    expect(tombstonesFor('children')).toEqual([childId])
    // The payments vanish via ON DELETE CASCADE, which leaves no trace for sync to carry —
    // they need their own tombstones or the pull re-creates them as orphans.
    expect(tombstonesFor('payments')).toEqual([...paymentIds].sort((a, b) => a - b))
    expect(tombstonesFor('child_services')).toHaveLength(1)
  })

  it('tombstones payments deleted for one child and month', async () => {
    await getHandler('payments:deleteForChild')(null, { child_id: childId, month: 'يناير', year: 2026 })

    expect(tombstonesFor('payments')).toEqual([paymentIds[0]])
    expect(db.prepare('SELECT COUNT(*) c FROM payments').get().c).toBe(1)
  })

  it('tombstones a bulk selection of payments', async () => {
    await getHandler('payments:deleteBulk')(null, { ids: paymentIds })

    expect(tombstonesFor('payments')).toEqual([...paymentIds].sort((a, b) => a - b))
    expect(db.prepare('SELECT COUNT(*) c FROM payments').get().c).toBe(0)
  })

  it('tombstones every payment removed by delete-all for a period', async () => {
    await getHandler('payments:deleteAll')(null, { month: 'فبراير', year: 2026 })

    expect(tombstonesFor('payments')).toEqual([paymentIds[1]])
    expect(db.prepare('SELECT COUNT(*) c FROM payments').get().c).toBe(1)
  })

  it('leaves tombstones unsynced so the next push carries them to the cloud', async () => {
    await getHandler('payments:deleteBulk')(null, { ids: paymentIds })

    const unsynced = db.prepare('SELECT COUNT(*) c FROM tombstones WHERE synced = 0').get() as { c: number }
    expect(unsynced.c).toBe(paymentIds.length)
  })
})
