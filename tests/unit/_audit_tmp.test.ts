import { describe, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { SYNC_ENTITIES } from '../../electron/services/mongoSync.js'

describe('audit', () => {
  it('dumps', () => {
    const db = new DatabaseSync(':memory:')
    runMigrations(db as any)
    const tables = (db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all() as any[]).map((r: any) => r.name)

    const synced = new Set(SYNC_ENTITIES.map((e) => e.table))
    console.log('\n=== TABLES NOT IN SYNC ===')
    for (const t of tables) if (!synced.has(t)) console.log('  ' + t)

    console.log('\n=== COLUMN GAPS ===')
    for (const e of SYNC_ENTITIES) {
      if (!tables.includes(e.table)) { console.log(`  !! ${e.table} MISSING FROM DB`); continue }
      const cols = (db.prepare(`PRAGMA table_info(${e.table})`).all() as any[]).map((c: any) => c.name)
      const paths = new Set(Object.keys((e.model.schema as any).paths))
      const missing = cols.filter((c: string) => !paths.has(c))
      const extra = [...paths].filter((p) => !cols.includes(p) && p !== 'id' && p !== '_id')
      if (missing.length || extra.length) {
        console.log(`  ${e.table}: missingInMongo=[${missing.join(', ')}] notInSqlite=[${extra.join(', ')}]`)
      }
    }
  })
})
