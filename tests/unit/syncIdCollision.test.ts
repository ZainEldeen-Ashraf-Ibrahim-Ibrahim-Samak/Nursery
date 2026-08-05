import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: () => 'mock-user-data' }
}))

import { detectIdCollision } from '../../electron/ipc/syncIPC.js'

/**
 * Every synced table numbers rows with SQLite's per-device AUTOINCREMENT and Mongo keys each
 * document on that integer, so two devices that each add a record between syncs both produce the
 * same id. Sync used to treat those as the same row and let one overwrite the other — permanent,
 * silent data loss. `created_at` distinguishes "the same record, synced" from "two records that
 * collided", and a collision must block the write rather than pick a winner.
 */
describe('detectIdCollision', () => {
  const base = { id: 7, synced: 1 }

  it('flags two records with the same id but clearly different creation times', () => {
    const local = { ...base, created_at: '2026-03-01T09:00:00.000Z' }
    const cloud = { ...base, created_at: '2026-03-04T17:22:10.000Z' }

    const result = detectIdCollision(local, cloud)
    expect(result).toBeTruthy()
    expect(result).toContain('ID COLLISION')
    expect(result).toContain('7')
  })

  it('does not flag the same record synced between devices', () => {
    const ts = '2026-03-01T09:00:00.000Z'
    expect(detectIdCollision({ ...base, created_at: ts }, { ...base, created_at: ts })).toBeNull()
  })

  it('tolerates the two timestamp formats used in the codebase', () => {
    // strftime('%Y-%m-%dT%H:%M:%SZ') truncates milliseconds; toISOString() keeps them. The same
    // record written through both paths must not be mistaken for a collision.
    const local = { ...base, created_at: '2026-03-01T09:00:00Z' }
    const cloud = { ...base, created_at: '2026-03-01T09:00:00.750Z' }
    expect(detectIdCollision(local, cloud)).toBeNull()
  })

  it('returns null when the table has no created_at to compare', () => {
    // e.g. session_teachers / service_teachers carry no created_at — no signal, so no claim.
    expect(detectIdCollision({ ...base }, { ...base })).toBeNull()
    expect(detectIdCollision({ ...base, created_at: '2026-03-01T09:00:00Z' }, { ...base })).toBeNull()
    expect(detectIdCollision({ ...base }, { ...base, created_at: '2026-03-01T09:00:00Z' })).toBeNull()
  })

  it('returns null rather than guessing when a timestamp is unparseable', () => {
    const local = { ...base, created_at: 'not-a-date' }
    const cloud = { ...base, created_at: '2026-03-01T09:00:00Z' }
    expect(detectIdCollision(local, cloud)).toBeNull()
  })

  it('flags the collision regardless of which side is newer', () => {
    const older = { ...base, created_at: '2026-01-01T00:00:00Z' }
    const newer = { ...base, created_at: '2026-05-01T00:00:00Z' }
    expect(detectIdCollision(older, newer)).toBeTruthy()
    expect(detectIdCollision(newer, older)).toBeTruthy()
  })
})
