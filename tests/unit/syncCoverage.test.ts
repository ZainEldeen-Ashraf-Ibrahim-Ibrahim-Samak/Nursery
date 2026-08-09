import { describe, it, expect, beforeAll, vi } from 'vitest'

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: () => 'mock-user-data' }
}))

import { initDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { SYNC_ENTITIES } from '../../electron/services/mongoSync.js'

/**
 * Push/pull coverage guard.
 *
 * `runPush` writes rows through Mongoose models, and Mongoose schemas are strict: a column that
 * exists in SQLite but is missing from its schema is dropped silently — no error, no log, the
 * value simply never reaches the cloud and a second device pulls an incomplete record. That is
 * exactly how the per-enrollment teacher, lesson_days, extra_lessons and session_price columns
 * went unsynced for several features.
 *
 * These tests walk the real migrated schema and fail the moment a new table or column is added
 * without sync coverage, so the failure lands on the person adding the column rather than on a
 * user whose second device is quietly missing data.
 */

/** Tables that are deliberately device-local and must never be pushed. */
const LOCAL_ONLY_TABLES = new Set([
  // Migration bookkeeping — each device runs its own migrations.
  'migrations',
  // Per-device record of sync attempts; syncing it would be circular.
  'sync_log',
])

/**
 * Columns that legitimately stay device-local, as `table.column`.
 * Keep this list empty unless there is a real reason, and state the reason.
 */
const LOCAL_ONLY_COLUMNS = new Set<string>([])

describe('sync coverage — every table and column reaches the cloud', () => {
  let db: any
  let tables: string[]

  beforeAll(() => {
    db = initDb()
    runMigrations(db)
    tables = (db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as { name: string }[]).map((r) => r.name)
  })

  it('registers every SQLite table as a sync entity', () => {
    const synced = new Set(SYNC_ENTITIES.map((e) => e.table))
    const unregistered = tables.filter((t) => !LOCAL_ONLY_TABLES.has(t) && !synced.has(t))
    expect(
      unregistered,
      `These tables exist in SQLite but are not in SYNC_ENTITIES, so they are never pushed or ` +
      `pulled. Add a Mongoose model + registry entry in electron/services/mongoSync.ts, or add ` +
      `the table to LOCAL_ONLY_TABLES with a reason.`
    ).toEqual([])
  })

  it('does not register sync entities for tables that no longer exist', () => {
    const orphans = SYNC_ENTITIES.filter((e) => !tables.includes(e.table)).map((e) => e.table)
    expect(orphans, 'SYNC_ENTITIES references tables that are not in the schema').toEqual([])
  })

  it('covers every SQLite column in the matching Mongoose schema', () => {
    const gaps: string[] = []

    for (const entity of SYNC_ENTITIES) {
      if (!tables.includes(entity.table)) continue

      const columns = (db.prepare(`PRAGMA table_info(${entity.table})`).all() as { name: string }[])
        .map((c) => c.name)
      const schemaPaths = new Set(Object.keys((entity.model.schema as any).paths))

      for (const column of columns) {
        // `settings` is keyed by `key` in SQLite and stored under `id` in Mongo (see runPush),
        // but the schema carries both, so no special case is needed here.
        if (LOCAL_ONLY_COLUMNS.has(`${entity.table}.${column}`)) continue
        if (!schemaPaths.has(column)) {
          gaps.push(`${entity.table}.${column}`)
        }
      }
    }

    expect(
      gaps,
      `These SQLite columns have no field in their Mongoose schema. Mongoose strict mode drops ` +
      `them on push, so the value never reaches the cloud. Add each one to its schema in ` +
      `electron/services/mongoSync.ts. If a column is intentionally device-local, add it to ` +
      `LOCAL_ONLY_COLUMNS with a reason.`
    ).toEqual([])
  })

  it('has no Mongoose fields without a matching SQLite column', () => {
    const strays: string[] = []

    for (const entity of SYNC_ENTITIES) {
      if (!tables.includes(entity.table)) continue

      const columns = new Set(
        (db.prepare(`PRAGMA table_info(${entity.table})`).all() as { name: string }[]).map((c) => c.name)
      )
      for (const path of Object.keys((entity.model.schema as any).paths)) {
        // `id` is the Mongo document key (the SQLite primary key, or `key` for settings).
        if (path === 'id' || path === '_id') continue
        if (entity.table === 'settings' && path === 'key') continue
        if (!columns.has(path)) strays.push(`${entity.table}.${path}`)
      }
    }

    expect(
      strays,
      'These Mongoose fields have no SQLite column — they are written to the cloud but dropped ' +
      'again on pull by stripUnknownColumns, so they are dead weight. Remove them or add the column.'
    ).toEqual([])
  })

  it('gives every synced table a `synced` flag for push to filter on', () => {
    // runPush selects `WHERE synced = 0`; a table without the column would throw at push time.
    const missing: string[] = []
    for (const entity of SYNC_ENTITIES) {
      if (!tables.includes(entity.table)) continue
      const columns = (db.prepare(`PRAGMA table_info(${entity.table})`).all() as { name: string }[])
        .map((c) => c.name)
      if (!columns.includes('synced')) missing.push(entity.table)
    }
    expect(missing, 'Synced tables must have a `synced` column').toEqual([])
  })
})
