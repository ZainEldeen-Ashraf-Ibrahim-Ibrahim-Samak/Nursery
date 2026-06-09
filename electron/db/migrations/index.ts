import type { Db } from '../connection.js'

interface Migration {
  name: string
  up: (db: Db) => void
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
  },
  {
    name: '003_add_updated_at_columns',
    up: (db) => {
      // Add updated_at column to employees
      try {
        db.exec('ALTER TABLE employees ADD COLUMN updated_at TEXT;')
      } catch {
        // Ignore if already exists
      }
      db.exec("UPDATE employees SET updated_at = created_at WHERE updated_at IS NULL;")

      // Add updated_at column to salary_payments
      try {
        db.exec('ALTER TABLE salary_payments ADD COLUMN updated_at TEXT;')
      } catch {
        // Ignore if already exists
      }
      db.exec("UPDATE salary_payments SET updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) WHERE updated_at IS NULL;")

      // Add updated_at column to expenses
      try {
        db.exec('ALTER TABLE expenses ADD COLUMN updated_at TEXT;')
      } catch {
        // Ignore if already exists
      }
      db.exec("UPDATE expenses SET updated_at = created_at WHERE updated_at IS NULL;")
    }
  },
  {
    name: '004_child_services',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS child_services (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          service TEXT NOT NULL,
          unit TEXT NOT NULL,
          price REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE,
          UNIQUE (child_id, service)
        );

        INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at, synced)
        SELECT id, service, unit, price, created_at, updated_at, 0 FROM children;
      `)
    }
  },
  {
    name: '005_payments_service_id',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS payments_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          service_id INTEGER,
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
          FOREIGN KEY (service_id) REFERENCES child_services (id),
          UNIQUE (child_id, service_id, month, year)
        );

        INSERT INTO payments_new (
          id, child_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, created_at, updated_at, synced
        )
        SELECT id, child_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, created_at, updated_at, synced
        FROM payments;

        UPDATE payments_new
        SET service_id = (
          SELECT id FROM child_services 
          WHERE child_services.child_id = payments_new.child_id 
          AND child_services.service = payments_new.service
        );

        DROP TABLE payments;
        ALTER TABLE payments_new RENAME TO payments;
      `)
    }
  },
  {
    name: '006_tombstones',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS tombstones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity TEXT NOT NULL,
          record_id INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE(entity, record_id)
        );
      `)
    }
  },
  {
    name: '007_settings_sync_columns',
    up: (db) => {
      try {
        db.exec('ALTER TABLE settings ADD COLUMN updated_at TEXT;')
      } catch {
        // Ignore if already exists
      }
      try {
        db.exec('ALTER TABLE settings ADD COLUMN synced INTEGER DEFAULT 0;')
      } catch {
        // Ignore if already exists
      }
      db.exec("UPDATE settings SET updated_at = (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')) WHERE updated_at IS NULL;")
    }
  },
  {
    name: '008_users_sync_columns',
    up: (db) => {
      try {
        db.exec('ALTER TABLE users ADD COLUMN updated_at TEXT;')
      } catch {
        // Ignore if already exists
      }
      try {
        db.exec('ALTER TABLE users ADD COLUMN synced INTEGER DEFAULT 0;')
      } catch {
        // Ignore if already exists
      }
      db.exec("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;")
    }
  },
  {
    name: '009_backfill_missing_child_services',
    up: (db) => {
      // Repair children inserted after migration 004 (e.g. via Excel import / seed),
      // which created `children` rows but no matching `child_services` enrollment.
      // Create one enrollment per orphaned child from its legacy service/unit/price,
      // then link any payments still missing a service_id.
      db.exec(`
        INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at, synced)
        SELECT id, service, unit, price, created_at, updated_at, 0
        FROM children
        WHERE id NOT IN (SELECT child_id FROM child_services);

        UPDATE payments
        SET service_id = (
          SELECT cs.id FROM child_services cs
          WHERE cs.child_id = payments.child_id
          AND cs.service = payments.service
        )
        WHERE service_id IS NULL;
      `)
    }
  },
  {
    name: '010_imported_snapshots',
    up: (db) => {
      // Generic snapshot store for non-relational workbook sheets imported verbatim
      // (📊 داشبورد، 📄 كشف حساب). These are snapshots only — the live dashboard and
      // statement views keep recomputing from source data and are not driven by this table.
      db.exec(`
        CREATE TABLE IF NOT EXISTS imported_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sheet TEXT NOT NULL,
          row_index INTEGER NOT NULL,
          data_json TEXT NOT NULL,
          imported_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE(sheet, row_index)
        );
      `)
    }
  },
  {
    name: '011_child_photo_teacher_lessons',
    up: (db) => {
      // Additive columns on `children` for the enrollment enhancements feature
      // (004): Cloudinary photo reference, assigned teacher (employees.id),
      // lesson schedule, and the computed monthly session fee. Each ALTER is
      // guarded so re-runs / partially-applied DBs are safe (pattern from 003/007/008).
      const addColumn = (ddl: string) => {
        try {
          db.exec(ddl)
        } catch {
          // Column already exists — ignore.
        }
      }
      addColumn('ALTER TABLE children ADD COLUMN photo_url TEXT;')
      addColumn('ALTER TABLE children ADD COLUMN photo_public_id TEXT;')
      addColumn('ALTER TABLE children ADD COLUMN teacher_id INTEGER;')
      addColumn('ALTER TABLE children ADD COLUMN lesson_days TEXT;')
      addColumn('ALTER TABLE children ADD COLUMN sessions_baseline INTEGER DEFAULT 8;')
      addColumn('ALTER TABLE children ADD COLUMN extra_lessons INTEGER DEFAULT 0;')
      addColumn('ALTER TABLE children ADD COLUMN session_price REAL;')
      addColumn('ALTER TABLE children ADD COLUMN monthly_fee REAL;')
    }
  }
]

export function runMigrations(db: Db): void {
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
