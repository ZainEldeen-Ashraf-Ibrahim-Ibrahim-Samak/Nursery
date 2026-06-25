import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { initDb, getDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'

vi.mock('electron', () => {
  const handlers: Record<string, Function> = {};
  (globalThis as any).__attnHandlers = handlers
  return {
    ipcMain: { handle: (ch: string, fn: Function) => { handlers[ch] = fn } },
    app: { getPath: () => 'mock-user-data' }
  }
})

import '../../electron/ipc/attendanceIPC.js'
import '../../electron/ipc/sessionsIPC.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'

describe('attendance IPC contract', () => {
  const h = () => (globalThis as any).__attnHandlers
  const sessH = () => (globalThis as any).__attnHandlers
  let sessionId: number
  let childId: number

  beforeAll(async () => {
    const db = initDb()
    runMigrations(db)

    // Seed admin user so recorded_by FK resolves
    const db2 = getDb()
    const now = new Date().toISOString()
    db.prepare(`INSERT OR IGNORE INTO users (id, username, password, role, is_active, created_at) VALUES (1,'admin','hash','admin',1,?)`).run(now)

    const res = db.prepare(`INSERT INTO children (name, guardian, guardian_phone, service, unit, price, reg_date, is_active, created_at, updated_at, synced) VALUES (?,?,?,?,?,?,?,1,?,?,0)`)
      .run('Test Child', 'Guardian', '01012345678', 'حضانة', 'شهر', 1000, '2026-06-01', now, now)
    childId = Number(res.lastInsertRowid)

    // Seed a session (direct DB since sessionsIPC has separate handler namespace)
    const sres = db.prepare(`INSERT INTO scheduled_sessions (session_date, group_name, created_at, updated_at, synced) VALUES (?,?,?,?,0)`)
      .run('2026-06-15', 'Test Group', now, now)
    sessionId = Number(sres.lastInsertRowid)
  })

  beforeEach(() => {
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 })
  })

  it('attendance:getSheet returns enrolled children', async () => {
    const sheet = await h()['attendance:getSheet']({}, { session_id: sessionId })
    expect(Array.isArray(sheet)).toBe(true)
    const child = sheet.find((r: any) => r.child_id === childId)
    expect(child).toBeTruthy()
  })

  it('attendance:record bulk upserts attendance', async () => {
    const results = await h()['attendance:record']({}, {
      session_id: sessionId,
      records: [{ child_id: childId, status: 'attended' }]
    })
    expect(Array.isArray(results)).toBe(true)
    expect(results[0].status).toBe('attended')
  })

  it('attendance:record overwrites with absent_excused', async () => {
    await h()['attendance:record']({}, {
      session_id: sessionId,
      records: [{ child_id: childId, status: 'absent_excused', excuse_notes: 'Sick' }]
    })
    const sheet = await h()['attendance:getSheet']({}, { session_id: sessionId })
    const rec = sheet.find((r: any) => r.child_id === childId)
    expect(rec.status).toBe('absent_excused')
    expect(rec.excuse_notes).toBe('Sick')
  })

  it('attendance:record rejects invalid status', async () => {
    await expect(h()['attendance:record']({}, {
      session_id: sessionId,
      records: [{ child_id: childId, status: 'invalid_status' }]
    })).rejects.toThrow()
  })

  it('attendance:getConflicts returns array', async () => {
    const conflicts = await h()['attendance:getConflicts']({})
    expect(Array.isArray(conflicts)).toBe(true)
  })

  it('attendance:getSheet blocked for anonymous', async () => {
    setCurrentUser(null)
    await expect(h()['attendance:getSheet']({}, { session_id: sessionId })).rejects.toThrow('UNAUTHORIZED')
  })
})
