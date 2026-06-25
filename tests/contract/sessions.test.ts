import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { initDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'

vi.mock('electron', () => {
  const handlers: Record<string, Function> = {};
  (globalThis as any).__sessHandlers = handlers
  return {
    ipcMain: { handle: (ch: string, fn: Function) => { handlers[ch] = fn } },
    app: { getPath: () => 'mock-user-data' }
  }
})

import '../../electron/ipc/sessionsIPC.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'

describe('sessions IPC contract', () => {
  const h = () => (globalThis as any).__sessHandlers

  beforeAll(async () => {
    const db = initDb()
    runMigrations(db)
  })

  beforeEach(() => {
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 })
  })

  it('sessions:list returns array', async () => {
    const rows = await h()['sessions:list']({})
    expect(Array.isArray(rows)).toBe(true)
  })

  it('sessions:add creates a session', async () => {
    const sess = await h()['sessions:add']({}, { session_date: '2026-06-15', group_name: 'Group A' })
    expect(sess.session_date).toBe('2026-06-15')
    expect(sess.id).toBeTruthy()
  })

  it('sessions:list filters by date range', async () => {
    await h()['sessions:add']({}, { session_date: '2026-07-10' })
    const rows = await h()['sessions:list']({}, { from: '2026-06-01', to: '2026-06-30' })
    expect(rows.every((r: any) => r.session_date <= '2026-06-30')).toBe(true)
  })

  it('sessions:update changes group_name', async () => {
    const sess = await h()['sessions:add']({}, { session_date: '2026-06-20' })
    const updated = await h()['sessions:update']({}, { id: sess.id, patch: { group_name: 'Updated Group' } })
    expect(updated.group_name).toBe('Updated Group')
  })

  it('sessions:delete removes session without attendance', async () => {
    const sess = await h()['sessions:add']({}, { session_date: '2026-06-25' })
    const result = await h()['sessions:delete']({}, { id: sess.id })
    expect(result.ok).toBe(true)
  })

  it('sessions:proRateCalc with mid-month reg_date', async () => {
    const result = await h()['sessions:proRateCalc']({}, { reg_date: '2026-06-20', price_per_session: 100 })
    expect(result).toHaveProperty('prorated_amount')
    expect(result).toHaveProperty('days_remaining')
    expect(result.prorated_amount).toBeGreaterThan(0)
  })

  it('sessions:proRateCalc on day 1 returns full price', async () => {
    const result = await h()['sessions:proRateCalc']({}, { reg_date: '2026-06-01', price_per_session: 300 })
    expect(result.prorated_amount).toBe(300)
  })

  it('sessions:list blocked for anonymous', async () => {
    setCurrentUser(null)
    await expect(h()['sessions:list']({})).rejects.toThrow('UNAUTHORIZED')
  })
})
