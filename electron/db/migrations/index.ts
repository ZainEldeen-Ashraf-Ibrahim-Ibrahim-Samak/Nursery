import Database from 'better-sqlite3'

interface Migration {
  name: string
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    name: '001_initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          name TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS children (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          guardian TEXT NOT NULL,
          guardian_phone TEXT NOT NULL,
          child_phone TEXT,
          national_id TEXT,
          service TEXT NOT NULL,
          unit TEXT NOT NULL,
          price REAL NOT NULL,
          reg_date TEXT NOT NULL,
          notes TEXT,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          service TEXT NOT NULL,
          unit TEXT NOT NULL,
          quantity REAL DEFAULT 1,
          price REAL NOT NULL,
          total REAL NOT NULL,
          paid REAL DEFAULT 0,
          balance REAL NOT NULL,
          status TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE,
          UNIQUE (child_id, month, year)
        );

        CREATE TABLE IF NOT EXISTS employees (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          base_salary REAL NOT NULL,
          housing REAL DEFAULT 0,
          transport REAL DEFAULT 0,
          net_salary REAL NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS salary_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          bonus REAL DEFAULT 0,
          deductions REAL DEFAULT 0,
          actual_paid REAL NOT NULL,
          paid_date TEXT,
          notes TEXT,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
          UNIQUE (employee_id, month, year)
        );

        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item TEXT NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          amount REAL NOT NULL,
          category TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          table_name TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          status TEXT NOT NULL,
          error TEXT,
          synced_at TEXT NOT NULL
        );
      `)
    }
  },
  {
    name: '002_expenses_unique_constraint',
    up: (db) => {
      // Recreate expenses table with UNIQUE(item, month, year) for upsert support
      db.exec(`
        CREATE TABLE IF NOT EXISTS expenses_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item TEXT NOT NULL,
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          amount REAL NOT NULL,
          category TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE (item, month, year)
        );

        INSERT OR IGNORE INTO expenses_new (id, item, month, year, amount, category, notes, created_at, synced)
        SELECT id, item, month, year, amount, category, notes, created_at, synced FROM expenses;

        DROP TABLE expenses;

        ALTER TABLE expenses_new RENAME TO expenses;
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      run_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const runMigrationList = db.prepare('SELECT name FROM migrations').all() as { name: string }[]
  const runMigrationNames = new Set(runMigrationList.map((m) => m.name))

  const insertMigration = db.prepare('INSERT INTO migrations (name) VALUES (?)')

  for (const migration of migrations) {
    if (!runMigrationNames.has(migration.name)) {
      console.log(`Running migration: ${migration.name}`)
      
      // Run each migration in a local transaction
      const transaction = db.transaction(() => {
        migration.up(db)
        insertMigration.run(migration.name)
      })
      
      transaction()
    }
  }
}
