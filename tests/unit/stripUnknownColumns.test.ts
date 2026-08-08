import { describe, it, expect } from 'vitest'
import { stripUnknownColumns } from '../../electron/ipc/syncIPC.js'

const paymentsColumns = new Set(['id', 'child_id', 'month', 'year', 'total', 'updated_at', 'synced'])

describe('stripUnknownColumns', () => {
  it('drops a legacy cloud field the local table no longer has', () => {
    const { record, dropped } = stripUnknownColumns(
      { id: 95, child_id: 3, student_id: 3, total: 500, synced: 1 } as any,
      paymentsColumns
    )
    expect(dropped).toEqual(['student_id'])
    expect(record).toEqual({ id: 95, child_id: 3, total: 500, synced: 1 })
  })

  it('drops mongo bookkeeping fields without reporting them as unknown', () => {
    const { record, dropped } = stripUnknownColumns(
      { _id: 'abc', __v: 0, id: 1, child_id: 2, synced: 0 } as any,
      paymentsColumns
    )
    expect(dropped).toEqual([])
    expect(record).toEqual({ id: 1, child_id: 2, synced: 0 })
  })

  it('keeps id even when the table keys on something else (settings)', () => {
    const settingsColumns = new Set(['key', 'value', 'updated_at', 'synced'])
    const { record } = stripUnknownColumns(
      { id: 'sync_mongo_uri', value: 'mongodb://x', synced: 1 } as any,
      settingsColumns
    )
    expect(record.id).toBe('sync_mongo_uri')
    expect(record.value).toBe('mongodb://x')
  })

  it('passes a clean record through unchanged', () => {
    const clean = { id: 7, child_id: 1, month: 'يناير', year: 2026, total: 100, synced: 1 }
    const { record, dropped } = stripUnknownColumns(clean as any, paymentsColumns)
    expect(dropped).toEqual([])
    expect(record).toEqual(clean)
  })

  it('preserves falsy values rather than dropping them', () => {
    const { record } = stripUnknownColumns(
      { id: 7, child_id: 0, total: 0, synced: 0, updated_at: null } as any,
      paymentsColumns
    )
    expect(record.child_id).toBe(0)
    expect(record.total).toBe(0)
    expect(record.updated_at).toBe(null)
  })
})
