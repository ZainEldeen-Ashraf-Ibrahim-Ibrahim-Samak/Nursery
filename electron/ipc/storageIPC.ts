import { ipcMain, dialog, app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { getDb, closeDb, initDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'
import { progressReporter } from './progress.js'

/**
 * storage:stats
 * Returns counts for all major tables and database file size.
 * Admin only.
 */
ipcMain.handle('storage:stats', async () => {
  try {
    requireAdmin()
    const db = getDb()

    const counts = {
      users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
      children: (db.prepare('SELECT COUNT(*) as c FROM children').get() as any).c,
      payments: (db.prepare('SELECT COUNT(*) as c FROM payments').get() as any).c,
      employees: (db.prepare('SELECT COUNT(*) as c FROM employees').get() as any).c,
      salary_payments: (db.prepare('SELECT COUNT(*) as c FROM salary_payments').get() as any).c,
      expenses: (db.prepare('SELECT COUNT(*) as c FROM expenses').get() as any).c,
    }

    // Get db file size
    let sizeBytes = 0
    try {
      const dbPath = path.join(app.getPath('userData'), 'nursery.db')
      if (fs.existsSync(dbPath)) {
        sizeBytes = fs.statSync(dbPath).size
      }
    } catch {
      // In test environment, db path may differ
    }

    return { counts, sizeBytes }
  } catch (error: any) {
    console.error('storage:stats error:', error)
    throw new Error(error.message || 'Failed to retrieve storage stats')
  }
})

/**
 * storage:backup
 * Opens a save dialog and copies the current DB file to the chosen path.
 * Admin only.
 */
ipcMain.handle('storage:backup', async (event) => {
  try {
    requireAdmin()

    const report = progressReporter(event, 'backup')
    const dbPath = path.join(app.getPath('userData'), 'nursery.db')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    const result = await dialog.showSaveDialog({
      defaultPath: `nursery-backup-${timestamp}.db`,
      filters: [{ name: 'SQLite Database', extensions: ['db'] }]
    })

    if (result.canceled || !result.filePath) {
      throw new Error('Backup cancelled')
    }

    // Fold committed WAL pages into the .db file so the copy is complete
    // (the DB runs in WAL mode; recent commits may live in nursery.db-wal).
    report(1, 3, 'checkpoint')
    getDb().checkpoint()

    report(2, 3, 'copying')
    fs.copyFileSync(dbPath, result.filePath)
    report(3, 3, 'done')
    return { path: result.filePath }
  } catch (error: any) {
    console.error('storage:backup error:', error)
    throw new Error(error.message || 'Failed to backup database')
  }
})

/**
 * storage:restore
 * Opens a file picker and replaces the current DB with the selected backup.
 * Admin only.
 */
ipcMain.handle('storage:restore', async (event, { path: restorePath }) => {
  try {
    requireAdmin()

    const report = progressReporter(event, 'restore')
    let sourcePath = restorePath

    if (!sourcePath) {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'SQLite Database', extensions: ['db'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error('Restore cancelled')
      }

      sourcePath = result.filePaths[0]
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error('Backup file not found')
    }

    const dbPath = path.join(app.getPath('userData'), 'nursery.db')

    // Create a current backup before restoring
    report(1, 3, 'safety backup')
    const backupPath = `${dbPath}.pre-restore-${Date.now()}.bak`
    fs.copyFileSync(dbPath, backupPath)

    // Close current DB, copy backup over, reopen
    report(2, 3, 'restoring')
    closeDb()
    fs.copyFileSync(sourcePath, dbPath)
    initDb()
    report(3, 3, 'done')

    return { ok: true, restoredFrom: sourcePath }
  } catch (error: any) {
    console.error('storage:restore error:', error)
    throw new Error(error.message || 'Failed to restore database')
  }
})

/**
 * storage:import
 * Opens an Excel workbook file picker and imports data from the original workbook format.
 * Admin only.
 */
ipcMain.handle('storage:import', async (event, args) => {
  try {
    requireAdmin()

    let filePath = args?.path

    if (!filePath) {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx', 'xls'] }]
      })

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error('Import cancelled')
      }

      filePath = result.filePaths[0]
    }

    // Dynamic import to avoid circular dependencies
    const { importFromWorkbook } = await import('../services/importService.js')
    const summary = await importFromWorkbook(filePath, progressReporter(event, 'import'))

    return { imported: summary }
  } catch (error: any) {
    console.error('storage:import error:', error)
    throw new Error(error.message || 'Failed to import workbook')
  }
})

/**
 * storage:clear
 * Truncates all data tables. Requires explicit confirm:true.
 * Admin only.
 */
ipcMain.handle('storage:clear', async (_event, { confirm }) => {
  try {
    requireAdmin()

    if (!confirm) {
      throw new Error('Explicit confirmation required to clear data')
    }

    const db = getDb()

    const clearAll = db.transaction(() => {
      db.prepare('DELETE FROM payments').run()
      db.prepare('DELETE FROM salary_payments').run()
      db.prepare('DELETE FROM expenses').run()
      db.prepare('DELETE FROM sync_log').run()
      db.prepare('DELETE FROM children').run()
      db.prepare('DELETE FROM employees').run()
    })

    clearAll()
    return { ok: true }
  } catch (error: any) {
    console.error('storage:clear error:', error)
    throw new Error(error.message || 'Failed to clear data')
  }
})

/**
 * storage:audit
 * Returns last 50 sync log entries (audit log).
 * Admin only.
 */
ipcMain.handle('storage:audit', async () => {
  try {
    requireAdmin()
    const db = getDb()

    const rows = db.prepare(
      'SELECT id, action, table_name AS entity_type, record_id, status, error, synced_at AS created_at FROM sync_log ORDER BY id DESC LIMIT 50'
    ).all()

    return rows
  } catch (error: any) {
    console.error('storage:audit error:', error)
    throw new Error(error.message || 'Failed to retrieve audit log')
  }
})