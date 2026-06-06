import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

let db: Database.Database | null = null

export function getDbPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return ':memory:'
  }
  // Safe check if app is not initialized or in some scripts
  try {
    return path.join(app.getPath('userData'), 'nursery.db')
  } catch {
    return path.join(process.cwd(), 'nursery.db')
  }
}

export function initDb(dbPath = getDbPath()): Database.Database {
  if (db) return db

  db = new Database(dbPath)
  
  // Apply performance and integrity pragmas
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  
  return db
}

export function getDb(): Database.Database {
  if (!db) {
    return initDb()
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
