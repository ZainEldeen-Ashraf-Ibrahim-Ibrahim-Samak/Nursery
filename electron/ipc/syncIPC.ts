import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'
import {
  connectMongo,
  disconnectMongo,
  getConnectionStatus,
  SYNC_ENTITIES
} from '../services/mongoSync.js'

// ── Conflict resolution helpers ───────────────────────────────────────────────

interface SyncRecord {
  id: number
  updated_at?: string
  synced: number
  [key: string]: any
}

function resolveConflict(local: SyncRecord, cloud: SyncRecord): 'local' | 'cloud' {
  const localTs = local.updated_at ? new Date(local.updated_at).getTime() : 0
  const cloudTs = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0

  if (cloudTs > localTs) return 'cloud'
  if (localTs > cloudTs) return 'local'
  // Tie-break: higher id wins
  return local.id >= cloud.id ? 'local' : 'cloud'
}

// ── Helper: log sync action ───────────────────────────────────────────────────

function logSync(action: string, entityType: string, recordId: string | number, status: string, error: string | null = null) {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO sync_log (action, entity_type, record_id, status, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(action, entityType, String(recordId), status, error, new Date().toISOString())
  } catch {
    // Non-critical logging failure
  }
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * sync:connect — Connect to MongoDB with given URI.
 * Saves URI to settings. Admin only.
 */
ipcMain.handle('sync:connect', async (_event, { uri }) => {
  try {
    requireAdmin()

    if (!uri || !uri.startsWith('mongodb')) {
      throw new Error('Invalid MongoDB URI. Must start with mongodb:// or mongodb+srv://')
    }

    const db = getDb()
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('sync_mongo_uri', uri)

    await connectMongo(uri)
    logSync('connect', 'connection', 'mongodb', 'success')

    return { connected: true }
  } catch (error: any) {
    logSync('connect', 'connection', 'mongodb', 'error', error.message)
    console.error('sync:connect error:', error)
    throw new Error(error.message || 'Failed to connect to MongoDB')
  }
})

/**
 * sync:disconnect — Disconnect from MongoDB.
 * Admin only.
 */
ipcMain.handle('sync:disconnect', async () => {
  try {
    requireAdmin()
    await disconnectMongo()
    return { connected: false }
  } catch (error: any) {
    console.error('sync:disconnect error:', error)
    throw new Error(error.message || 'Failed to disconnect')
  }
})

/**
 * sync:status — Returns sync status: connection, pending counts per entity.
 * Admin only.
 */
ipcMain.handle('sync:status', async () => {
  try {
    requireAdmin()
    const db = getDb()
    const { connected, error } = getConnectionStatus()

    const pending: Record<string, number> = {}
    for (const entity of SYNC_ENTITIES) {
      const row = db.prepare(`SELECT COUNT(*) as c FROM ${entity.table} WHERE synced = 0`).get() as any
      pending[entity.name] = row?.c ?? 0
    }

    const uriRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get() as any
    const lastLogRow = db.prepare('SELECT created_at, status, action FROM sync_log ORDER BY id DESC LIMIT 1').get() as any

    return {
      connected,
      error,
      uri: uriRow?.value ? '***configured***' : null,
      pending,
      lastSync: lastLogRow || null
    }
  } catch (error: any) {
    console.error('sync:status error:', error)
    throw new Error(error.message || 'Failed to get sync status')
  }
})

/**
 * sync:push — Push all unsynced records to MongoDB.
 * Admin only. Graceful: reports pushed/failed counts per entity.
 */
ipcMain.handle('sync:push', async () => {
  try {
    requireAdmin()
    const db = getDb()
    const { connected } = getConnectionStatus()

    if (!connected) {
      // Try to auto-reconnect
      const uriRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get() as any
      if (!uriRow?.value) throw new Error('No MongoDB URI configured. Please connect first.')
      await connectMongo(uriRow.value)
    }

    const results: Record<string, { pushed: number; failed: number }> = {}
    const now = new Date().toISOString()

    for (const entity of SYNC_ENTITIES) {
      const unsynced = db.prepare(`SELECT * FROM ${entity.table} WHERE synced = 0`).all() as SyncRecord[]
      let pushed = 0
      let failed = 0

      for (const record of unsynced) {
        try {
          await entity.model.findOneAndUpdate(
            { id: record.id },
            { ...record, updated_at: record.updated_at || now },
            { upsert: true, new: true }
          )

          db.prepare(`UPDATE ${entity.table} SET synced = 1 WHERE id = ?`).run(record.id)
          logSync('push', entity.name, record.id, 'success')
          pushed++
        } catch (err: any) {
          logSync('push', entity.name, record.id, 'error', err.message)
          failed++
        }
      }

      results[entity.name] = { pushed, failed }
    }

    return { results }
  } catch (error: any) {
    logSync('push', 'all', 'batch', 'error', error.message)
    console.error('sync:push error:', error)
    throw new Error(error.message || 'Push failed')
  }
})

/**
 * sync:pull — Pull records from MongoDB that are newer than local.
 * Applies conflict resolution (most-recent updated_at wins, id tie-break).
 * Admin only.
 */
ipcMain.handle('sync:pull', async () => {
  try {
    requireAdmin()
    const db = getDb()
    const { connected } = getConnectionStatus()

    if (!connected) {
      const uriRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get() as any
      if (!uriRow?.value) throw new Error('No MongoDB URI configured.')
      await connectMongo(uriRow.value)
    }

    const results: Record<string, { pulled: number; skipped: number; failed: number }> = {}

    for (const entity of SYNC_ENTITIES) {
      let pulled = 0
      let skipped = 0
      let failed = 0

      try {
        const cloudRecords = await entity.model.find({}).lean()

        for (const cloud of cloudRecords) {
          const cloudRecord = cloud as SyncRecord
          try {
            const local = db.prepare(`SELECT * FROM ${entity.table} WHERE id = ?`).get(cloudRecord.id) as SyncRecord | undefined

            if (!local) {
              // New record from cloud — insert it
              const columns = Object.keys(cloudRecord).filter((k) => k !== '_id')
              const placeholders = columns.map(() => '?').join(', ')
              const values = columns.map((c) => cloudRecord[c])

              db.prepare(`INSERT OR IGNORE INTO ${entity.table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values)
              logSync('pull-insert', entity.name, cloudRecord.id, 'success')
              pulled++
            } else {
              // Conflict check
              const winner = resolveConflict(local, cloudRecord)
              if (winner === 'cloud') {
                // Update local with cloud data
                const columns = Object.keys(cloudRecord).filter((k) => k !== '_id' && k !== 'id')
                const setClause = columns.map((c) => `${c} = ?`).join(', ')
                const values = columns.map((c) => cloudRecord[c])
                values.push(cloudRecord.id)

                db.prepare(`UPDATE ${entity.table} SET ${setClause}, synced = 1 WHERE id = ?`).run(...values)
                logSync('pull-update', entity.name, cloudRecord.id, 'success')
                pulled++
              } else {
                logSync('pull-skip', entity.name, cloudRecord.id, 'skipped')
                skipped++
              }
            }
          } catch (err: any) {
            logSync('pull', entity.name, cloudRecord.id, 'error', err.message)
            failed++
          }
        }
      } catch (err: any) {
        logSync('pull', entity.name, 'batch', 'error', err.message)
      }

      results[entity.name] = { pulled, skipped, failed }
    }

    return { results }
  } catch (error: any) {
    logSync('pull', 'all', 'batch', 'error', error.message)
    console.error('sync:pull error:', error)
    throw new Error(error.message || 'Pull failed')
  }
})

// ── Auto-sync interval (T090) ─────────────────────────────────────────────────

let autoSyncTimer: ReturnType<typeof setInterval> | null = null

export function startAutoSync(intervalMs: number): void {
  if (autoSyncTimer) clearInterval(autoSyncTimer)

  autoSyncTimer = setInterval(async () => {
    const { connected } = getConnectionStatus()
    if (!connected) return

    try {
      const db = getDb()
      const unsynced = db.prepare("SELECT COUNT(*) as c FROM children WHERE synced = 0").get() as any
      if ((unsynced?.c ?? 0) > 0) {
        // Trigger push via ipcMain internally
        const handler = ipcMain.listeners?.('sync:push')?.[0]
        if (typeof handler === 'function') {
          await (handler as any)({} as any)
        }
      }
    } catch (err) {
      console.error('Auto-sync error:', err)
    }
  }, intervalMs)
}

export function stopAutoSync(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer)
    autoSyncTimer = null
  }
}

/**
 * sync:auto-sync — Enable/disable auto-sync and set the interval.
 * Admin only.
 */
ipcMain.handle('sync:auto-sync', async (_event, { enabled, intervalMinutes = 30 }) => {
  try {
    requireAdmin()
    const db = getDb()

    if (enabled) {
      const intervalMs = intervalMinutes * 60 * 1000
      startAutoSync(intervalMs)
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('sync_auto_interval', String(intervalMinutes))
      return { autoSync: true, intervalMinutes }
    } else {
      stopAutoSync()
      db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('sync_auto_interval', '0')
      return { autoSync: false }
    }
  } catch (error: any) {
    console.error('sync:auto-sync error:', error)
    throw new Error(error.message || 'Failed to configure auto-sync')
  }
})