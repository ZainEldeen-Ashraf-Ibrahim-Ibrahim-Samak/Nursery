import { describe, it, vi, expect } from 'vitest'
vi.mock('electron', () => ({ ipcMain: { handle: vi.fn() }, app: { getPath: () => 'mock-user-data' } }))
import { ipcMain } from 'electron'
import { initDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'
import '../../electron/ipc/childrenIPC.js'
import '../../electron/ipc/paymentsIPC.js'

function h(ch: string) {
  const calls = (ipcMain.handle as any).mock.calls as [string, Function][]
  const f = calls.find(([n]) => n === ch)
  if (!f) throw new Error('no handler ' + ch)
  return f[1]
}

describe('repro', () => {
  it('delete child then payments:get', async () => {
    const db: any = initDb()
    runMigrations(db)
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 } as any)
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO users (id, username, password, role, is_active, created_at) VALUES (1,'admin','x','admin',1,?)`).run(now)
    const childId = Number(db.prepare(`
      INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, is_active)
      VALUES ('Sami','G','0100','حضانة','شهر',1000,'2026-01-01',?,?,1)`).run(now, now).lastInsertRowid)
    const csId = Number(db.prepare(`
      INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at)
      VALUES (?, 'حضانة','شهر',1000,?,?)`).run(childId, now, now).lastInsertRowid)
    db.prepare(`
      INSERT INTO payments (child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, created_at, updated_at)
      VALUES (?,?, 'يناير', 2026, 'حضانة','شهر',1,1000,1000,0,1000,'unpaid',?,?)`).run(childId, csId, now, now)

    db.prepare('UPDATE children SET is_active = 0 WHERE id = ?').run(childId)
    await h('children:delete')(null, { id: childId })

    const leftoverPayments = db.prepare('SELECT COUNT(*) c FROM payments').get() as any
    const leftoverCs = db.prepare('SELECT COUNT(*) c FROM child_services').get() as any
    console.error('AFTER DELETE payments=', leftoverPayments.c, 'child_services=', leftoverCs.c)

    const res = await h('payments:get')(null, { month: 'يناير', year: 2026 })
    console.error('payments:get ok, byChild=', JSON.stringify(res.byChild.map((b: any) => b.child_name)))
    expect(true).toBe(true)
  })
})
