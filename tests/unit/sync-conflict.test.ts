import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn()
  },
  app: {
    getPath: vi.fn()
  }
}))

import { resolveConflict } from '../../electron/ipc/syncIPC.js'

describe('resolveConflict', () => {
  it('should prefer cloud when cloud.updated_at is newer', () => {
    const local = { id: 1, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    const cloud = { id: 1, synced: 1, updated_at: '2026-06-01T11:00:00Z' }
    expect(resolveConflict(local, cloud)).toBe('cloud')
  })

  it('should prefer local when local.updated_at is newer', () => {
    const local = { id: 1, synced: 1, updated_at: '2026-06-01T11:00:00Z' }
    const cloud = { id: 1, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    expect(resolveConflict(local, cloud)).toBe('local')
  })

  it('should prefer local when timestamps are tied and local id is greater or equal', () => {
    const local = { id: 2, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    const cloud = { id: 1, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    expect(resolveConflict(local, cloud)).toBe('local')

    const localEqual = { id: 1, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    expect(resolveConflict(localEqual, cloud)).toBe('local')
  })

  it('should prefer cloud when timestamps are tied and cloud id is strictly greater', () => {
    const local = { id: 1, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    const cloud = { id: 2, synced: 1, updated_at: '2026-06-01T10:00:00Z' }
    expect(resolveConflict(local, cloud)).toBe('cloud')
  })
})
