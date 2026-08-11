import { n as getDb, r as initDb, t as closeDb } from "./connection-DNiMlhbf.js";
import path from "node:path";
import dotenv from "dotenv";
import { BrowserWindow, Menu, app, dialog, ipcMain, net, protocol, shell } from "electron";
import electronUpdater from "electron-updater";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import PdfPrinter from "pdfmake";
import ArabicReshaper from "arabic-persian-reshaper";
import crypto from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { promises } from "node:dns";
//#region electron/env.ts
/**
* Centralised environment configuration loader.
*
* This module MUST be imported before any other module that reads `process.env`
* (notably the IPC handlers), because ES module imports are evaluated in source
* order — see specs/002-excel-import-env-config/research.md R7.
*
* Sensitive/deployment values come from the environment (`.env`); non-sensitive
* seed defaults stay in code but are overridable here. In a packaged
* (production) build the app refuses to start without a JWT secret (FR-012).
*/
dotenv.config();
try {
	if (app?.isPackaged) {
		const exeDir = path.dirname(app.getPath("exe"));
		const envPath = path.join(exeDir, ".env");
		const envExamplePath = path.join(exeDir, ".env.example");
		dotenv.config({ path: envPath });
		dotenv.config({ path: envExamplePath });
	}
} catch {}
var DEV_SECRET = "dev_insecure_jwt_secret_do_not_use_in_production";
function isProduction() {
	try {
		return !!app?.isPackaged;
	} catch {
		return false;
	}
}
var devSecretWarned = false;
/**
* The JWT signing secret. In production it must come from the environment;
* in development a fixed insecure secret is used with a one-time warning.
*/
function getJwtSecret() {
	const fromEnv = process.env.JWT_SECRET?.trim();
	if (fromEnv) return fromEnv;
	if (isProduction()) throw new Error("JWT_SECRET is not configured.");
	if (!devSecretWarned) {
		console.warn("[env] JWT_SECRET not set — using an insecure development secret. Set JWT_SECRET in .env before shipping a production build.");
		devSecretWarned = true;
	}
	return DEV_SECRET;
}
/**
* Validate that required configuration is present for the current build.
* Production build with no JWT secret → not ok (caller must halt startup).
*/
function checkRequiredConfig() {
	const secret = process.env.JWT_SECRET?.trim();
	if (isProduction() && !secret) return {
		ok: false,
		error: "JWT_SECRET is not configured. The application cannot start securely.\nCreate a .env file (see .env.example) next to the application and set JWT_SECRET to a long random value, then restart."
	};
	return { ok: true };
}
/** Initial admin credentials used only when seeding a fresh database. */
function getSeedAdmin() {
	return {
		username: process.env.SEED_ADMIN_USERNAME?.trim() || "admin",
		password: process.env.SEED_ADMIN_PASSWORD?.trim() || null
	};
}
/**
* Resolve a non-sensitive seed setting: optional `envKey` override, else the
* provided code default. Applied by the seeder only on first run (empty table).
*/
function seedSetting(envKey, fallback) {
	const v = process.env[envKey]?.trim();
	return v && v.length > 0 ? v : fallback;
}
/**
* Resolve Cloudinary credentials for child-photo upload (feature 004).
* Accepts either the three discrete env vars or a single `CLOUDINARY_URL`
* of the form `cloudinary://<api_key>:<api_secret>@<cloud_name>`.
* Returns null when not configured — callers must handle this gracefully
* (photo upload is optional; the child still saves). Credentials live only in
* the main process and are never sent to the renderer.
*/
function getCloudinaryConfig() {
	const url = process.env.CLOUDINARY_URL?.trim();
	if (url) {
		const m = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
		if (m) return {
			apiKey: m[1],
			apiSecret: m[2],
			cloudName: m[3]
		};
	}
	const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
	const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
	const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
	if (cloudName && apiKey && apiSecret) return {
		cloudName,
		apiKey,
		apiSecret
	};
	return null;
}
//#endregion
//#region electron/db/migrations/index.ts
var migrations = [
	{
		name: "001_initial_schema",
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
      `);
		}
	},
	{
		name: "002_expenses_unique_constraint",
		up: (db) => {
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
      `);
		}
	},
	{
		name: "003_add_updated_at_columns",
		up: (db) => {
			try {
				db.exec("ALTER TABLE employees ADD COLUMN updated_at TEXT;");
			} catch {}
			db.exec("UPDATE employees SET updated_at = created_at WHERE updated_at IS NULL;");
			try {
				db.exec("ALTER TABLE salary_payments ADD COLUMN updated_at TEXT;");
			} catch {}
			db.exec("UPDATE salary_payments SET updated_at = COALESCE(paid_date, '2000-01-01T00:00:00Z') WHERE updated_at IS NULL;");
			try {
				db.exec("ALTER TABLE expenses ADD COLUMN updated_at TEXT;");
			} catch {}
			db.exec("UPDATE expenses SET updated_at = created_at WHERE updated_at IS NULL;");
		}
	},
	{
		name: "004_child_services",
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
      `);
		}
	},
	{
		name: "005_payments_service_id",
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
      `);
		}
	},
	{
		name: "006_tombstones",
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
      `);
		}
	},
	{
		name: "007_settings_sync_columns",
		up: (db) => {
			try {
				db.exec("ALTER TABLE settings ADD COLUMN updated_at TEXT;");
			} catch {}
			try {
				db.exec("ALTER TABLE settings ADD COLUMN synced INTEGER DEFAULT 0;");
			} catch {}
			db.exec("UPDATE settings SET updated_at = '2000-01-01T00:00:00Z' WHERE updated_at IS NULL;");
		}
	},
	{
		name: "008_users_sync_columns",
		up: (db) => {
			try {
				db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT;");
			} catch {}
			try {
				db.exec("ALTER TABLE users ADD COLUMN synced INTEGER DEFAULT 0;");
			} catch {}
			db.exec("UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;");
		}
	},
	{
		name: "009_backfill_missing_child_services",
		up: (db) => {
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
      `);
		}
	},
	{
		name: "010_imported_snapshots",
		up: (db) => {
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
      `);
		}
	},
	{
		name: "011_child_photo_teacher_lessons",
		up: (db) => {
			const addColumn = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			addColumn("ALTER TABLE children ADD COLUMN photo_url TEXT;");
			addColumn("ALTER TABLE children ADD COLUMN photo_public_id TEXT;");
			addColumn("ALTER TABLE children ADD COLUMN teacher_id INTEGER;");
			addColumn("ALTER TABLE children ADD COLUMN lesson_days TEXT;");
			addColumn("ALTER TABLE children ADD COLUMN sessions_baseline INTEGER DEFAULT 8;");
			addColumn("ALTER TABLE children ADD COLUMN extra_lessons INTEGER DEFAULT 0;");
			addColumn("ALTER TABLE children ADD COLUMN session_price REAL;");
			addColumn("ALTER TABLE children ADD COLUMN monthly_fee REAL;");
		}
	},
	{
		name: "014_employee_roles_salary_types",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS salary_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          mode TEXT NOT NULL CHECK(mode IN ('fixed_monthly','per_session_fixed','per_session_pct','hybrid')),
          monthly_rate REAL,
          session_rate REAL,
          session_pct REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS employee_roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          salary_type_id INTEGER REFERENCES salary_types(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			addCol("ALTER TABLE employees ADD COLUMN role_id INTEGER REFERENCES employee_roles(id);");
			addCol("ALTER TABLE employees ADD COLUMN salary_type_override_id INTEGER REFERENCES salary_types(id);");
			addCol("ALTER TABLE salary_types ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE employee_roles ADD COLUMN synced INTEGER DEFAULT 0;");
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const roles = db.prepare("SELECT DISTINCT role FROM employees WHERE role IS NOT NULL AND role != ''").all();
			for (const { role } of roles) db.prepare(`
          INSERT OR IGNORE INTO employee_roles (name, created_at, updated_at, synced) VALUES (?, ?, ?, 0)
        `).run(role, now, now);
			db.exec(`
        UPDATE employees SET role_id = (
          SELECT id FROM employee_roles WHERE employee_roles.name = employees.role
        ) WHERE role_id IS NULL;
      `);
		}
	},
	{
		name: "015_service_definitions",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS service_definitions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_custom INTEGER DEFAULT 1,
          price_monthly REAL,
          price_daily REAL,
          price_hourly REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			addCol("ALTER TABLE service_definitions ADD COLUMN synced INTEGER DEFAULT 0;");
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const get = (key) => {
				const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
				return row?.value ? Number(row.value) : null;
			};
			const seeds = [
				{
					name: "حضانة",
					monthly: get("nursery_monthly"),
					daily: get("nursery_daily"),
					hourly: get("nursery_hourly")
				},
				{
					name: "استضافة",
					monthly: get("hosting_monthly"),
					daily: get("hosting_daily"),
					hourly: get("hosting_hourly")
				},
				{
					name: "جلسة",
					monthly: get("session_monthly"),
					daily: get("session_daily"),
					hourly: get("session_hourly")
				}
			];
			for (const s of seeds) db.prepare(`
          INSERT OR IGNORE INTO service_definitions (name, is_custom, price_monthly, price_daily, price_hourly, created_at, updated_at, synced)
          VALUES (?, 0, ?, ?, ?, ?, ?, 0)
        `).run(s.name, s.monthly, s.daily, s.hourly, now, now);
		}
	},
	{
		name: "016_scheduled_sessions",
		up: (db) => {
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_date TEXT NOT NULL,
          service_id INTEGER REFERENCES service_definitions(id),
          group_name TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS session_teachers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          synced INTEGER DEFAULT 0,
          UNIQUE(session_id, employee_id)
        );
      `);
			addCol("ALTER TABLE scheduled_sessions ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE session_teachers ADD COLUMN synced INTEGER DEFAULT 0;");
		}
	},
	{
		name: "017_attendance",
		up: (db) => {
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK(status IN ('attended','absent_excused','absent_unexcused')),
          excuse_notes TEXT,
          recorded_by INTEGER REFERENCES users(id),
          recorded_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE(session_id, child_id)
        );

        CREATE TABLE IF NOT EXISTS attendance_conflicts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attendance_record_id INTEGER NOT NULL REFERENCES attendance_records(id),
          overwritten_status TEXT NOT NULL,
          overwritten_by TEXT,
          overwritten_at TEXT NOT NULL,
          winning_status TEXT NOT NULL,
          winning_by TEXT,
          winning_at TEXT NOT NULL,
          reviewed INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
			addCol("ALTER TABLE attendance_records ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE attendance_conflicts ADD COLUMN synced INTEGER DEFAULT 0;");
		}
	},
	{
		name: "018_payment_prorated_column",
		up: (db) => {
			try {
				db.exec("ALTER TABLE payments ADD COLUMN prorated_calculated REAL;");
			} catch {}
		}
	},
	{
		name: "019_backfill_synced_columns",
		up: (db) => {
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			addCol("ALTER TABLE salary_types ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE employee_roles ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE service_definitions ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE scheduled_sessions ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE session_teachers ADD COLUMN synced INTEGER DEFAULT 0;");
			addCol("ALTER TABLE attendance_records ADD COLUMN synced INTEGER DEFAULT 0;");
		}
	},
	{
		name: "020_attendance_conflicts_synced",
		up: (db) => {
			try {
				db.exec("ALTER TABLE attendance_conflicts ADD COLUMN synced INTEGER DEFAULT 0;");
			} catch {}
		}
	},
	{
		name: "021_payment_methods",
		up: (db) => {
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			db.exec(`
        CREATE TABLE IF NOT EXISTS payment_methods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          is_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
			const now = (/* @__PURE__ */ new Date()).toISOString();
			for (const name of [
				"كاش",
				"تحويل بنكي",
				"فيزا / ماستركارد",
				"فودافون كاش"
			]) db.prepare(`INSERT OR IGNORE INTO payment_methods (name, is_active, created_at, updated_at, synced) VALUES (?, 1, ?, ?, 0)`).run(name, now, now);
			addCol("ALTER TABLE payments ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id);");
			addCol("ALTER TABLE payments ADD COLUMN payment_method_name TEXT;");
		}
	},
	{
		name: "013_session_monthly_setting",
		up: (db) => {
			db.exec(`
        INSERT OR IGNORE INTO settings (key, value, updated_at, synced)
        VALUES ('session_monthly', '1200', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0);
      `);
		}
	},
	{
		name: "012_repush_payments_with_service_id",
		up: (db) => {
			db.exec(`
        UPDATE payments
        SET service_id = (
          SELECT cs.id FROM child_services cs
          WHERE cs.child_id = payments.child_id
          AND cs.service = payments.service
        )
        WHERE service_id IS NULL;

        UPDATE payments SET synced = 0;
      `);
		}
	},
	{
		name: "022_employee_deductions",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS employee_deductions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          month TEXT NOT NULL,
          year INTEGER NOT NULL,
          reason TEXT NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
		}
	},
	{
		name: "023_payment_transactions",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS payment_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payment_id INTEGER NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
          amount REAL NOT NULL,
          payment_method_id INTEGER REFERENCES payment_methods(id),
          payment_method_name TEXT,
          paid_date TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment ON payment_transactions(payment_id);
      `);
		}
	},
	{
		name: "024_child_services_teacher_days",
		up: (db) => {
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			addCol("ALTER TABLE child_services ADD COLUMN teacher_id INTEGER;");
			addCol("ALTER TABLE child_services ADD COLUMN lesson_days TEXT;");
			addCol("ALTER TABLE child_services ADD COLUMN extra_lessons INTEGER DEFAULT 0;");
			addCol("ALTER TABLE child_services ADD COLUMN session_price REAL;");
		}
	},
	{
		name: "025_child_services_drop_unique",
		noTransaction: true,
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS child_services_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          service TEXT NOT NULL,
          unit TEXT NOT NULL,
          price REAL NOT NULL,
          teacher_id INTEGER,
          lesson_days TEXT,
          extra_lessons INTEGER DEFAULT 0,
          session_price REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (child_id) REFERENCES children (id) ON DELETE CASCADE
        );

        INSERT INTO child_services_new
          (id, child_id, service, unit, price, teacher_id, lesson_days,
           extra_lessons, session_price, created_at, updated_at, synced)
        SELECT
          id, child_id, service, unit, price, teacher_id, lesson_days,
          COALESCE(extra_lessons, 0), session_price, created_at, updated_at, synced
        FROM child_services;

        DROP TABLE child_services;
        ALTER TABLE child_services_new RENAME TO child_services;
      `);
			try {
				db.exec(`CREATE INDEX IF NOT EXISTS idx_child_services_child ON child_services(child_id);`);
			} catch {}
		}
	},
	{
		name: "026_service_teachers",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS service_teachers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          service_id INTEGER NOT NULL REFERENCES service_definitions(id) ON DELETE CASCADE,
          employee_id INTEGER NOT NULL REFERENCES employees(id),
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE(service_id, employee_id)
        );
      `);
		}
	},
	{
		name: "027_teacher_session_rate",
		up: (db) => {
			try {
				db.exec("ALTER TABLE employees ADD COLUMN teacher_session_rate REAL;");
			} catch {}
		}
	},
	{
		name: "028_attendance_teacher_status",
		up: (db) => {
			const addCol = (ddl) => {
				try {
					db.exec(ddl);
				} catch {}
			};
			addCol("ALTER TABLE attendance_records ADD COLUMN attended_teacher_id INTEGER REFERENCES employees(id);");
			addCol("ALTER TABLE attendance_records ADD COLUMN teacher_status TEXT CHECK(teacher_status IN ('present','absent'));");
			db.exec(`
        UPDATE attendance_records
        SET teacher_status = 'present'
        WHERE teacher_status IS NULL;
      `);
			db.exec(`
        UPDATE attendance_records
        SET attended_teacher_id = (
          SELECT teacher_id FROM children WHERE children.id = attendance_records.child_id
        )
        WHERE attended_teacher_id IS NULL;
      `);
		}
	},
	{
		name: "029_teacher_payments",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS teacher_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          teacher_id INTEGER NOT NULL REFERENCES employees(id),
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          attendance_record_id INTEGER NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
          attendance_date TEXT NOT NULL,
          session_cost REAL NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending','paid','void')) DEFAULT 'pending',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          UNIQUE(teacher_id, child_id, attendance_date)
        );
        CREATE INDEX IF NOT EXISTS idx_teacher_payments_teacher ON teacher_payments(teacher_id);
        CREATE INDEX IF NOT EXISTS idx_teacher_payments_month ON teacher_payments(attendance_date);
      `);
		}
	},
	{
		name: "030_attendance_records_per_teacher",
		noTransaction: true,
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_records_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES scheduled_sessions(id) ON DELETE CASCADE,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK(status IN ('attended','absent_excused','absent_unexcused')),
          excuse_notes TEXT,
          recorded_by INTEGER REFERENCES users(id),
          recorded_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          attended_teacher_id INTEGER REFERENCES employees(id),
          teacher_status TEXT CHECK(teacher_status IN ('present','absent')),
          UNIQUE(session_id, child_id, attended_teacher_id)
        );

        INSERT INTO attendance_records_new
          (id, session_id, child_id, status, excuse_notes, recorded_by, recorded_at, updated_at,
           synced, attended_teacher_id, teacher_status)
        SELECT
          id, session_id, child_id, status, excuse_notes, recorded_by, recorded_at, updated_at,
          synced, attended_teacher_id, teacher_status
        FROM attendance_records;

        DROP TABLE attendance_records;
        ALTER TABLE attendance_records_new RENAME TO attendance_records;
      `);
			try {
				db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_records_session ON attendance_records(session_id);`);
				db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_records_child ON attendance_records(child_id);`);
			} catch {}
		}
	},
	{
		name: "031_attendance_edit_requests",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_edit_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attendance_record_id INTEGER NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          teacher_id INTEGER REFERENCES employees(id),
          attendance_date TEXT NOT NULL,
          original_status TEXT NOT NULL,
          original_excuse_notes TEXT,
          original_teacher_status TEXT,
          requested_status TEXT NOT NULL CHECK(requested_status IN ('attended','absent_excused','absent_unexcused')),
          requested_excuse_notes TEXT,
          requested_teacher_status TEXT CHECK(requested_teacher_status IN ('present','absent')),
          reason TEXT NOT NULL,
          requested_by INTEGER NOT NULL REFERENCES users(id),
          requested_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          decided_by INTEGER REFERENCES users(id),
          decided_at TEXT,
          decision_notes TEXT,
          synced INTEGER DEFAULT 0
        );
      `);
			try {
				db.exec(`CREATE INDEX IF NOT EXISTS idx_edit_requests_record ON attendance_edit_requests(attendance_record_id);`);
				db.exec(`CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON attendance_edit_requests(status);`);
				db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_edit_requests_one_pending ON attendance_edit_requests(attendance_record_id) WHERE status = 'pending';`);
			} catch {}
		}
	},
	{
		name: "032_attendance_audit_log",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attendance_record_id INTEGER NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
          edit_request_id INTEGER REFERENCES attendance_edit_requests(id),
          old_status TEXT,
          old_excuse_notes TEXT,
          old_teacher_status TEXT,
          new_status TEXT NOT NULL,
          new_excuse_notes TEXT,
          new_teacher_status TEXT,
          changed_by INTEGER NOT NULL REFERENCES users(id),
          approved_by INTEGER REFERENCES users(id),
          reason TEXT,
          changed_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
			try {
				db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_record ON attendance_audit_log(attendance_record_id);`);
			} catch {}
		}
	},
	{
		name: "033_notifications",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL CHECK(type IN ('edit_request_submitted','edit_request_approved','edit_request_rejected')),
          related_id INTEGER,
          message_ar TEXT NOT NULL,
          message_en TEXT NOT NULL,
          read_at TEXT,
          created_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
      `);
			try {
				db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);`);
			} catch {}
		}
	},
	{
		name: "034_daily_payments",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS daily_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          service_id INTEGER,
          billing_date TEXT NOT NULL,
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
          payment_method_id INTEGER,
          payment_method_name TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0,
          FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
          UNIQUE (child_id, service_id, billing_date)
        );
      `);
			try {
				db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_payments_date ON daily_payments(billing_date);`);
				db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_payments_child ON daily_payments(child_id, billing_date);`);
				db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_payments_synced ON daily_payments(synced);`);
			} catch {}
		}
	},
	{
		name: "035_daily_payment_transactions",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS daily_payment_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          daily_payment_id INTEGER NOT NULL REFERENCES daily_payments(id) ON DELETE CASCADE,
          amount REAL NOT NULL,
          payment_method_id INTEGER REFERENCES payment_methods(id),
          payment_method_name TEXT,
          paid_date TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_daily_payment_tx_payment ON daily_payment_transactions(daily_payment_id);
      `);
		}
	},
	{
		name: "036_child_illness_cases",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS child_illness_cases (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK(status IN ('open','resolved')),
          description TEXT,
          opened_at TEXT NOT NULL,
          resolved_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_illness_cases_child_status ON child_illness_cases(child_id, status);
      `);
		}
	},
	{
		name: "037_child_activities",
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS child_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          activity_date TEXT NOT NULL,
          note TEXT,
          media_url TEXT,
          media_type TEXT CHECK(media_type IN ('photo','video')),
          media_status TEXT CHECK(media_status IN ('uploaded','failed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_child_activities_child_date ON child_activities(child_id, activity_date);
      `);
		}
	},
	{
		name: "038_drop_daily_payments",
		up: (db) => {
			db.exec(`
        DROP TABLE IF EXISTS daily_payment_transactions;
        DROP TABLE IF EXISTS daily_payments;
      `);
		}
	},
	{
		name: "039_child_services_teacher_rate",
		up: (db) => {
			try {
				db.exec("ALTER TABLE child_services ADD COLUMN teacher_session_rate REAL;");
			} catch {}
		}
	},
	{
		name: "040_salary_types_per_child_mode",
		noTransaction: true,
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS salary_types_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          mode TEXT NOT NULL CHECK(mode IN ('fixed_monthly','per_session_fixed','per_session_pct','hybrid','per_child_session')),
          monthly_rate REAL,
          session_rate REAL,
          session_pct REAL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        INSERT INTO salary_types_new
          (id, name, mode, monthly_rate, session_rate, session_pct, created_at, updated_at, synced)
        SELECT id, name, mode, monthly_rate, session_rate, session_pct, created_at, updated_at, synced
        FROM salary_types;

        DROP TABLE salary_types;
        ALTER TABLE salary_types_new RENAME TO salary_types;
      `);
		}
	},
	{
		name: "041_child_activities_any_media_type",
		noTransaction: true,
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS child_activities_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          activity_date TEXT NOT NULL,
          note TEXT,
          media_url TEXT,
          media_type TEXT CHECK(media_type IN ('photo','video','file')),
          media_status TEXT CHECK(media_status IN ('uploaded','failed')),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          synced INTEGER DEFAULT 0
        );

        INSERT INTO child_activities_new
          (id, child_id, activity_date, note, media_url, media_type, media_status, created_at, updated_at, synced)
        SELECT id, child_id, activity_date, note, media_url, media_type, media_status, created_at, updated_at, synced
        FROM child_activities;

        DROP TABLE child_activities;
        ALTER TABLE child_activities_new RENAME TO child_activities;
        CREATE INDEX IF NOT EXISTS idx_child_activities_child_date ON child_activities(child_id, activity_date);
      `);
		}
	},
	{
		name: "042_attendance_delete_requests",
		noTransaction: true,
		up: (db) => {
			db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_edit_requests_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          attendance_record_id INTEGER REFERENCES attendance_records(id) ON DELETE SET NULL,
          child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
          teacher_id INTEGER REFERENCES employees(id),
          attendance_date TEXT NOT NULL,
          original_status TEXT NOT NULL,
          original_excuse_notes TEXT,
          original_teacher_status TEXT,
          requested_status TEXT NOT NULL CHECK(requested_status IN ('attended','absent_excused','absent_unexcused','deleted')),
          requested_excuse_notes TEXT,
          requested_teacher_status TEXT CHECK(requested_teacher_status IN ('present','absent')),
          reason TEXT NOT NULL,
          requested_by INTEGER NOT NULL REFERENCES users(id),
          requested_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
          decided_by INTEGER REFERENCES users(id),
          decided_at TEXT,
          decision_notes TEXT,
          synced INTEGER DEFAULT 0
        );

        INSERT INTO attendance_edit_requests_new
          (id, attendance_record_id, child_id, teacher_id, attendance_date,
           original_status, original_excuse_notes, original_teacher_status,
           requested_status, requested_excuse_notes, requested_teacher_status,
           reason, requested_by, requested_at, status, decided_by, decided_at, decision_notes, synced)
        SELECT id, attendance_record_id, child_id, teacher_id, attendance_date,
           original_status, original_excuse_notes, original_teacher_status,
           requested_status, requested_excuse_notes, requested_teacher_status,
           reason, requested_by, requested_at, status, decided_by, decided_at, decision_notes, synced
        FROM attendance_edit_requests;

        DROP TABLE attendance_edit_requests;
        ALTER TABLE attendance_edit_requests_new RENAME TO attendance_edit_requests;
        CREATE INDEX IF NOT EXISTS idx_edit_requests_record ON attendance_edit_requests(attendance_record_id);
        CREATE INDEX IF NOT EXISTS idx_edit_requests_status ON attendance_edit_requests(status);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_edit_requests_one_pending ON attendance_edit_requests(attendance_record_id) WHERE status = 'pending';
      `);
		}
	},
	{
		name: "043_resync_child_services_and_salary_notes",
		up: (db) => {
			for (const table of ["child_services", "salary_payments"]) try {
				db.exec(`UPDATE ${table} SET synced = 0;`);
			} catch {}
		}
	}
];
function runMigrations(db) {
	db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      run_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
	const runMigrationList = db.prepare("SELECT name FROM migrations").all();
	const runMigrationNames = new Set(runMigrationList.map((m) => m.name));
	const insertMigration = db.prepare("INSERT INTO migrations (name) VALUES (?)");
	for (const migration of migrations) if (!runMigrationNames.has(migration.name)) {
		console.log(`Running migration: ${migration.name}`);
		if (migration.noTransaction) {
			db.pragma("foreign_keys = OFF");
			try {
				migration.up(db);
				insertMigration.run(migration.name);
			} finally {
				db.pragma("foreign_keys = ON");
			}
		} else db.transaction(() => {
			migration.up(db);
			insertMigration.run(migration.name);
		})();
	}
}
//#endregion
//#region electron/db/seed.ts
async function seedDatabase(db) {
	if (db.prepare("SELECT COUNT(*) as count FROM users").get().count === 0) {
		const { username, password } = getSeedAdmin();
		const adminPassword = password || "admin123";
		if (!password) console.warn("[seed] SEED_ADMIN_PASSWORD not set — seeding default admin password \"admin123\". Set SEED_ADMIN_PASSWORD in .env and change it after first login.");
		console.log(`No users found. Seeding admin user "${username}"...`);
		const hashedPassword = await bcrypt.hash(adminPassword, 10);
		db.prepare(`
      INSERT INTO users (username, password, role, name, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, hashedPassword, "admin", "Administrator", 1);
	}
	{
		const defaultSettings = [
			{
				key: "target_profit_pct",
				value: seedSetting("SEED_TARGET_PROFIT_PCT", "0.20")
			},
			{
				key: "max_capacity",
				value: seedSetting("SEED_MAX_CAPACITY", "50")
			},
			{
				key: "work_days",
				value: seedSetting("SEED_WORK_DAYS", "22")
			},
			{
				key: "work_hours",
				value: seedSetting("SEED_WORK_HOURS", "8")
			},
			{
				key: "brand_app_name",
				value: seedSetting("SEED_BRAND_APP_NAME", "أكاديمية مهند الليثي")
			},
			{
				key: "brand_org_name",
				value: seedSetting("SEED_BRAND_ORG_NAME", "مركز مهند الليثي للتوحد ونمو الطفل")
			},
			{
				key: "brand_tagline",
				value: "رعاية متميزة وتنمية مهارات طفلك"
			},
			{
				key: "brand_primary_color",
				value: seedSetting("SEED_BRAND_PRIMARY_COLOR", "#0f766e")
			},
			{
				key: "brand_accent_color",
				value: seedSetting("SEED_BRAND_ACCENT_COLOR", "#f59e0b")
			},
			{
				key: "brand_phone",
				value: seedSetting("SEED_BRAND_PHONE", "+20 123 456 7890")
			},
			{
				key: "brand_address",
				value: "القاهرة، مصر"
			},
			{
				key: "brand_email",
				value: seedSetting("SEED_BRAND_EMAIL", "info@zaineldeen.com")
			},
			{
				key: "brand_show_logo_sidebar",
				value: "1"
			},
			{
				key: "brand_show_logo_login",
				value: "1"
			},
			{
				key: "brand_show_logo_export",
				value: "1"
			},
			{
				key: "brand_logo_path",
				value: ""
			},
			{
				key: "brand_icon_path",
				value: ""
			}
		];
		const insertSetting = db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, updated_at, synced)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `);
		db.transaction(() => {
			for (const setting of defaultSettings) insertSetting.run(setting.key, setting.value);
		})();
	}
	{
		const defaultServices = [
			{
				name: "حضانة",
				monthly: seedSetting("SEED_NURSERY_MONTHLY", "2500"),
				daily: seedSetting("SEED_NURSERY_DAILY", "150"),
				hourly: seedSetting("SEED_NURSERY_HOURLY", "30")
			},
			{
				name: "استضافة",
				monthly: seedSetting("SEED_HOSTING_MONTHLY", "3000"),
				daily: seedSetting("SEED_HOSTING_DAILY", "200"),
				hourly: seedSetting("SEED_HOSTING_HOURLY", "40")
			},
			{
				name: "جلسة",
				monthly: seedSetting("SEED_SESSION_MONTHLY", "1200"),
				daily: seedSetting("SEED_SESSION_DAILY", "400"),
				hourly: seedSetting("SEED_SESSION_HOURLY", "100")
			}
		];
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const insertService = db.prepare(`
      INSERT OR IGNORE INTO service_definitions (name, is_custom, price_monthly, price_daily, price_hourly, created_at, updated_at, synced)
      VALUES (?, 0, ?, ?, ?, ?, ?, 0)
    `);
		db.transaction(() => {
			for (const s of defaultServices) insertService.run(s.name, Number(s.monthly), Number(s.daily), Number(s.hourly), now, now);
		})();
	}
}
//#endregion
//#region electron/ipc/_guard.ts
function requireAdmin() {
	const user = getCurrentUser();
	if (!user) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
	if (user.role !== "admin") throw new Error("FORBIDDEN: غير مسموح بالوصول لغير المسؤولين / Forbidden");
}
function checkAuth$10() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
//#endregion
//#region electron/ipc/authIPC.ts
var currentUserSession = null;
function getCurrentUser() {
	return currentUserSession;
}
ipcMain.handle("auth:login", async (_event, { username, password }) => {
	try {
		const user = getDb().prepare("SELECT * FROM users WHERE username = ?").get(username);
		if (!user) throw new Error("USER_NOT_FOUND");
		if (user.is_active === 0) throw new Error("USER_DEACTIVATED");
		if (!await bcrypt.compare(password, user.password)) throw new Error("INVALID_PASSWORD");
		const userData = {
			id: user.id,
			username: user.username,
			role: user.role,
			name: user.name,
			is_active: user.is_active,
			created_at: user.created_at
		};
		const token = jwt.sign({
			id: user.id,
			username: user.username,
			role: user.role
		}, getJwtSecret(), { expiresIn: "30d" });
		currentUserSession = userData;
		return {
			user: userData,
			token
		};
	} catch (error) {
		console.error("Login error:", error);
		if (error.message === "USER_NOT_FOUND" || error.message === "INVALID_PASSWORD") throw new Error("INVALID_PASSWORD");
		else if (error.message === "USER_DEACTIVATED") throw new Error("USER_DEACTIVATED");
		throw new Error(error.message || "AUTH_FAILED");
	}
});
ipcMain.handle("auth:logout", () => {
	currentUserSession = null;
	return { ok: true };
});
ipcMain.handle("auth:current", () => {
	return currentUserSession ? { user: currentUserSession } : null;
});
/**
* auth:restore — Restore a session from a previously issued JWT (persisted in the
* renderer). Verifies the token, reloads the user from the DB, and re-establishes
* the main-process session so it survives app restarts.
*/
ipcMain.handle("auth:restore", async (_event, { token }) => {
	try {
		if (!token) return null;
		const payload = jwt.verify(token, getJwtSecret());
		const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(payload.id);
		if (!user || user.is_active === 0) {
			currentUserSession = null;
			return null;
		}
		const userData = {
			id: user.id,
			username: user.username,
			role: user.role,
			name: user.name,
			is_active: user.is_active,
			created_at: user.created_at
		};
		currentUserSession = userData;
		return { user: userData };
	} catch {
		currentUserSession = null;
		return null;
	}
});
ipcMain.handle("users:list", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT id, username, role, name, is_active, created_at FROM users").all();
	} catch (error) {
		console.error("Failed to list users:", error);
		throw new Error(error.message || "Failed to list users");
	}
});
ipcMain.handle("users:create", async (_event, { username, password, role, name }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!username || !password || !role) throw new Error("اسم المستخدم وكلمة المرور والصلاحية مطلوبة / Username, password, and role are required");
		if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) throw new Error("اسم المستخدم موجود بالفعل / Username already exists");
		const hashedPassword = await bcrypt.hash(password, 10);
		const result = db.prepare(`
      INSERT INTO users (username, password, role, name, is_active, updated_at, synced)
      VALUES (?, ?, ?, ?, 1, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `).run(username, hashedPassword, role, name || null);
		return {
			id: Number(result.lastInsertRowid),
			username,
			role,
			name,
			is_active: 1
		};
	} catch (error) {
		console.error("Failed to create user:", error);
		throw new Error(error.message || "Failed to create user");
	}
});
ipcMain.handle("users:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("User ID and patch data are required");
		if (!db.prepare("SELECT * FROM users WHERE id = ?").get(id)) throw new Error("المستخدم غير موجود / User not found");
		let query = "UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), synced = 0, ";
		const params = [];
		if (patch.username !== void 0) {
			if (db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(patch.username, id)) throw new Error("اسم المستخدم موجود بالفعل / Username already exists");
			query += "username = ?, ";
			params.push(patch.username);
		}
		if (patch.password !== void 0 && patch.password.trim() !== "") {
			const hashedPassword = await bcrypt.hash(patch.password, 10);
			query += "password = ?, ";
			params.push(hashedPassword);
		}
		if (patch.role !== void 0) {
			query += "role = ?, ";
			params.push(patch.role);
		}
		if (patch.name !== void 0) {
			query += "name = ?, ";
			params.push(patch.name);
		}
		if (patch.is_active !== void 0) {
			const currentUser = getCurrentUser();
			if (currentUser && currentUser.id === id && patch.is_active === 0) throw new Error("لا يمكن إلغاء تنشيط حسابك الحالي / Cannot deactivate your own active session");
			query += "is_active = ?, ";
			params.push(patch.is_active);
		}
		if (params.length === 0) return db.prepare("SELECT id, username, role, name, is_active, created_at FROM users WHERE id = ?").get(id);
		query = query.slice(0, -2);
		query += " WHERE id = ?";
		params.push(id);
		db.prepare(query).run(...params);
		return db.prepare("SELECT id, username, role, name, is_active, created_at FROM users WHERE id = ?").get(id);
	} catch (error) {
		console.error("Failed to update user:", error);
		throw new Error(error.message || "Failed to update user");
	}
});
ipcMain.handle("users:deactivate", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const currentUser = getCurrentUser();
		if (currentUser && currentUser.id === id) throw new Error("لا يمكن إلغاء تنشيط حسابك الحالي / Cannot deactivate your own active session");
		db.prepare("UPDATE users SET is_active = 0, synced = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?").run(id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to deactivate user:", error);
		throw new Error(error.message || "Failed to deactivate user");
	}
});
ipcMain.handle("users:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const currentUser = getCurrentUser();
		if (currentUser && currentUser.id === id) throw new Error("لا يمكن حذف حسابك الحالي / Cannot delete your own active session");
		db.prepare(`
      INSERT OR IGNORE INTO tombstones (entity, record_id, created_at, synced)
      VALUES ('users', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `).run(id);
		db.prepare("DELETE FROM users WHERE id = ?").run(id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to delete user:", error);
		throw new Error(error.message || "Failed to delete user");
	}
});
//#endregion
//#region electron/services/statementService.ts
function getChildStatement(child, existingPayments, currentDate) {
	const arabicMonths = [
		"يناير",
		"فبراير",
		"مارس",
		"أبريل",
		"مايو",
		"يونيو",
		"يوليو",
		"أغسطس",
		"سبتمبر",
		"أكتوبر",
		"نوفمبر",
		"ديسمبر"
	];
	const regDate = new Date(child.reg_date);
	let startYear = regDate.getFullYear();
	let startMonth = regDate.getMonth();
	if (isNaN(startYear) || isNaN(startMonth)) {
		const fallbackDate = currentDate || /* @__PURE__ */ new Date();
		startYear = fallbackDate.getFullYear();
		startMonth = fallbackDate.getMonth();
	}
	const endYear = currentDate.getFullYear();
	const endMonth = currentDate.getMonth();
	const statementMonths = [];
	let currY = startYear;
	let currM = startMonth;
	if (startYear > endYear || startYear === endYear && startMonth > endMonth) statementMonths.push({
		month: arabicMonths[startMonth],
		year: startYear
	});
	else while (currY < endYear || currY === endYear && currM <= endMonth) {
		statementMonths.push({
			month: arabicMonths[currM],
			year: currY
		});
		currM++;
		if (currM > 11) {
			currM = 0;
			currY++;
		}
	}
	const paymentMap = /* @__PURE__ */ new Map();
	for (const p of existingPayments) {
		const key = `${p.year}-${p.month}`;
		if (!paymentMap.has(key)) paymentMap.set(key, []);
		paymentMap.get(key).push(p);
	}
	const rows = [];
	for (const { month, year } of statementMonths) {
		const key = `${year}-${month}`;
		const existingList = paymentMap.get(key);
		if (existingList && existingList.length > 0) for (const existing of existingList) rows.push({
			month,
			year,
			service: existing.service,
			unit: existing.unit,
			quantity: existing.quantity,
			price: existing.price,
			total: existing.total,
			paid: existing.paid,
			balance: existing.balance,
			status: existing.status,
			notes: existing.notes || ""
		});
		else rows.push({
			month,
			year,
			service: child.service,
			unit: child.unit,
			quantity: 0,
			price: child.price,
			total: 0,
			paid: 0,
			balance: 0,
			status: "unpaid",
			notes: ""
		});
	}
	rows.sort((a, b) => {
		if (a.year !== b.year) return b.year - a.year;
		const idxA = arabicMonths.indexOf(a.month);
		return arabicMonths.indexOf(b.month) - idxA;
	});
	let totalInvoiced = 0;
	let totalCollected = 0;
	let totalBalance = 0;
	for (const row of rows) {
		totalInvoiced += row.total;
		totalCollected += row.paid;
		totalBalance += row.balance;
	}
	return {
		child: {
			id: child.id,
			name: child.name,
			guardian: child.guardian,
			guardian_phone: child.guardian_phone,
			service: child.service,
			unit: child.unit,
			price: child.price,
			reg_date: child.reg_date,
			is_active: child.is_active,
			photo_url: child.photo_url ?? null,
			teacher_name: child.teacher_name ?? null,
			monthly_fee: child.monthly_fee ?? null
		},
		rows,
		summary: {
			activeMonths: statementMonths.length,
			totalInvoiced: Number(totalInvoiced.toFixed(2)),
			totalCollected: Number(totalCollected.toFixed(2)),
			totalBalance: Number(totalBalance.toFixed(2)),
			remainingDue: Number(totalBalance.toFixed(2))
		}
	};
}
//#endregion
//#region electron/services/tombstones.ts
function recordLocalTombstone(db, entity, recordId) {
	db.prepare(`
    INSERT OR IGNORE INTO tombstones (entity, record_id, created_at, synced)
    VALUES (?, ?, ?, 0)
  `).run(entity, recordId, (/* @__PURE__ */ new Date()).toISOString());
}
function applyCloudTombstones(db, cloudTombstones) {
	const insertTombstone = db.prepare(`
    INSERT OR IGNORE INTO tombstones (entity, record_id, created_at, synced)
    VALUES (?, ?, ?, 1)
  `);
	for (const tombstone of cloudTombstones) {
		if ([
			"children",
			"child_services",
			"payments",
			"expenses",
			"employees",
			"salary_payments"
		].includes(tombstone.entity)) db.prepare(`DELETE FROM ${tombstone.entity} WHERE id = ?`).run(tombstone.record_id);
		insertTombstone.run(tombstone.entity, tombstone.record_id, (/* @__PURE__ */ new Date()).toISOString());
	}
}
//#endregion
//#region electron/ipc/childrenIPC.ts
function checkAuth$9() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
var GUARDIAN_PHONE_RE = /^(?:\+?2)?01[0-9]{9}$/;
function validateGuardianPhone(phone) {
	if (!GUARDIAN_PHONE_RE.test((phone ?? "").toString().trim())) throw new Error("رقم هاتف ولي الأمر يجب أن يكون بالتنسيق الصحيح (مثال: 01012345678 أو 201012345678 أو +201012345678) / Guardian phone must be a valid format (e.g., 01012345678, 201012345678, or +201012345678)");
}
function validateChildPhone(phone) {
	if (phone && phone.toString().trim() !== "") {
		if (!GUARDIAN_PHONE_RE.test(phone.toString().trim())) throw new Error("رقم هاتف الطفل يجب أن يكون بالتنسيق الصحيح (مثال: 01012345678 أو +201012345678) / Child phone must be a valid format (e.g., 01012345678, 201012345678, or +201012345678)");
	}
}
function buildLessonFields(src) {
	const sessions_baseline = src.sessions_baseline === void 0 || src.sessions_baseline === null ? 8 : Math.max(0, Math.trunc(Number(src.sessions_baseline)));
	const extra_lessons = src.extra_lessons === void 0 || src.extra_lessons === null ? 0 : Math.max(0, Math.trunc(Number(src.extra_lessons)));
	const session_price = src.session_price === void 0 || src.session_price === null || src.session_price === "" ? null : Number(src.session_price);
	if (session_price !== null && session_price < 0) throw new Error("سعر الجلسة لا يمكن أن يكون سالباً / Session price cannot be negative");
	const lesson_days = src.lesson_days === void 0 || src.lesson_days === null ? null : Array.isArray(src.lesson_days) ? JSON.stringify(src.lesson_days) : String(src.lesson_days);
	const monthly_fee = session_price === null ? null : Number(((sessions_baseline + extra_lessons) * session_price).toFixed(2));
	return {
		teacher_id: src.teacher_id === void 0 || src.teacher_id === null || src.teacher_id === "" ? null : Number(src.teacher_id),
		lesson_days,
		sessions_baseline,
		extra_lessons,
		session_price,
		monthly_fee
	};
}
ipcMain.handle("children:get", async (_event, { search, service, activeOnly }) => {
	try {
		checkAuth$9();
		const db = getDb();
		let query = "SELECT * FROM children WHERE 1=1";
		const params = [];
		if (search && search.trim() !== "") {
			const searchPattern = `%${search.trim()}%`;
			query += " AND (name LIKE ? OR guardian LIKE ? OR guardian_phone LIKE ? OR child_phone LIKE ? OR national_id LIKE ?)";
			params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
		}
		if (service) {
			query += " AND id IN (SELECT child_id FROM child_services WHERE service = ?)";
			params.push(service);
		}
		if (activeOnly !== false) query += " AND is_active = 1";
		query += " ORDER BY name ASC";
		const rows = db.prepare(query).all(...params);
		for (const row of rows) row.services = db.prepare("SELECT * FROM child_services WHERE child_id = ?").all(row.id);
		return rows;
	} catch (error) {
		console.error("Failed to get children:", error);
		throw new Error(error.message || "Failed to get children");
	}
});
ipcMain.handle("children:add", async (_event, childInput) => {
	try {
		checkAuth$9();
		const db = getDb();
		const { name, guardian, guardian_phone, child_phone, national_id, reg_date, notes, services } = childInput;
		const enrollments = services || (childInput.service ? [{
			service: childInput.service,
			unit: childInput.unit,
			price: childInput.price
		}] : []);
		if (!name || !guardian || !guardian_phone || enrollments.length === 0 || !reg_date) throw new Error("جميع الحقول الإلزامية مطلوبة / Missing required fields");
		validateGuardianPhone(guardian_phone);
		if (child_phone) validateChildPhone(child_phone);
		const lesson = buildLessonFields(childInput);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const createdId = db.transaction(() => {
			const first = enrollments[0];
			const result = db.prepare(`
        INSERT INTO children (
          name, guardian, guardian_phone, child_phone, national_id,
          service, unit, price, reg_date, notes,
          photo_url, photo_public_id, teacher_id, lesson_days,
          sessions_baseline, extra_lessons, session_price, monthly_fee,
          is_active, created_at, updated_at, synced
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0)
      `).run(name, guardian, guardian_phone, child_phone || null, national_id || null, first.service, first.unit, first.price, reg_date, notes || null, childInput.photo_url || null, childInput.photo_public_id || null, lesson.teacher_id, lesson.lesson_days, lesson.sessions_baseline, lesson.extra_lessons, lesson.session_price, lesson.monthly_fee, now, now);
			const childId = Number(result.lastInsertRowid);
			const insertSvc = db.prepare(`INSERT INTO child_services (child_id, service, unit, price, teacher_id, lesson_days, extra_lessons, session_price, teacher_session_rate, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);
			for (const s of enrollments) {
				const sTeacherId = s.teacher_id != null && s.teacher_id !== "" ? Number(s.teacher_id) : null;
				const sLessonDays = Array.isArray(s.lesson_days) ? JSON.stringify(s.lesson_days) : s.lesson_days || null;
				const sExtraLessons = s.extra_lessons != null ? Number(s.extra_lessons) : 0;
				const sSessionPrice = s.session_price != null && s.session_price !== "" ? Number(s.session_price) : null;
				const sTeacherSessionRate = s.teacher_session_rate != null && s.teacher_session_rate !== "" ? Number(s.teacher_session_rate) : null;
				insertSvc.run(childId, s.service, s.unit, s.price, sTeacherId, sLessonDays, sExtraLessons, sSessionPrice, sTeacherSessionRate, now, now);
			}
			return childId;
		})();
		const createdChild = db.prepare("SELECT * FROM children WHERE id = ?").get(createdId);
		createdChild.services = db.prepare("SELECT * FROM child_services WHERE child_id = ?").all(createdId);
		return createdChild;
	} catch (error) {
		console.error("Failed to add child:", error);
		throw new Error(error.message || "Failed to add child");
	}
});
ipcMain.handle("children:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("Child ID and patch data are required");
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(id);
		if (!child) throw new Error("الطفل غير موجود / Child not found");
		if (patch.guardian_phone !== void 0) validateGuardianPhone(patch.guardian_phone);
		if (patch.child_phone !== void 0) validateChildPhone(patch.child_phone);
		db.transaction(() => {
			const enrollments = patch.services;
			if (enrollments) {
				if (enrollments.length === 0) throw new Error("يجب اختيار خدمة واحدة على الأقل / At least one service is required");
				patch.service = enrollments[0].service;
				patch.unit = enrollments[0].unit;
				patch.price = enrollments[0].price;
			}
			let query = "UPDATE children SET ";
			const params = [];
			for (const key of [
				"name",
				"guardian",
				"guardian_phone",
				"child_phone",
				"national_id",
				"service",
				"unit",
				"price",
				"reg_date",
				"notes",
				"is_active",
				"photo_url",
				"photo_public_id"
			]) if (patch[key] !== void 0) {
				query += `${key} = ?, `;
				params.push(patch[key]);
			}
			if ([
				"teacher_id",
				"lesson_days",
				"sessions_baseline",
				"extra_lessons",
				"session_price"
			].some((k) => patch[k] !== void 0)) {
				const merged = buildLessonFields({
					teacher_id: patch.teacher_id !== void 0 ? patch.teacher_id : child.teacher_id,
					lesson_days: patch.lesson_days !== void 0 ? patch.lesson_days : child.lesson_days,
					sessions_baseline: patch.sessions_baseline !== void 0 ? patch.sessions_baseline : child.sessions_baseline,
					extra_lessons: patch.extra_lessons !== void 0 ? patch.extra_lessons : child.extra_lessons,
					session_price: patch.session_price !== void 0 ? patch.session_price : child.session_price
				});
				for (const [k, v] of Object.entries(merged)) {
					query += `${k} = ?, `;
					params.push(v);
				}
			}
			const now = (/* @__PURE__ */ new Date()).toISOString();
			if (params.length > 0) {
				query += "updated_at = ?, synced = 0 WHERE id = ?";
				params.push(now, id);
				db.prepare(query).run(...params);
			}
			if (enrollments) {
				const existingServices = db.prepare("SELECT id FROM child_services WHERE child_id = ?").all(id);
				const existingIds = new Set(existingServices.map((e) => e.id));
				const incomingIds = new Set(enrollments.filter((s) => s.id != null).map((s) => Number(s.id)));
				const removedIds = [...existingIds].filter((eid) => !incomingIds.has(eid));
				if (removedIds.length > 0) {
					const placeholders = removedIds.map(() => "?").join(",");
					db.prepare(`UPDATE payments SET service_id = NULL WHERE child_id = ? AND service_id IN (${placeholders})`).run(id, ...removedIds);
					db.prepare(`DELETE FROM child_services WHERE id IN (${placeholders})`).run(...removedIds);
				}
				const updateSvc = db.prepare(`
          UPDATE child_services
          SET service = ?, unit = ?, price = ?, teacher_id = ?, lesson_days = ?, extra_lessons = ?, session_price = ?, teacher_session_rate = ?, updated_at = ?, synced = 0
          WHERE id = ? AND child_id = ?
        `);
				const insertSvc = db.prepare(`INSERT INTO child_services (child_id, service, unit, price, teacher_id, lesson_days, extra_lessons, session_price, teacher_session_rate, created_at, updated_at, synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`);
				for (const s of enrollments) {
					const sTeacherId = s.teacher_id != null && s.teacher_id !== "" ? Number(s.teacher_id) : null;
					const sLessonDays = Array.isArray(s.lesson_days) ? JSON.stringify(s.lesson_days) : s.lesson_days || null;
					const sExtraLessons = s.extra_lessons != null ? Number(s.extra_lessons) : 0;
					const sSessionPrice = s.session_price != null && s.session_price !== "" ? Number(s.session_price) : null;
					const sTeacherSessionRate = s.teacher_session_rate != null && s.teacher_session_rate !== "" ? Number(s.teacher_session_rate) : null;
					const existingId = s.id != null ? Number(s.id) : null;
					if (existingId != null && existingIds.has(existingId)) updateSvc.run(s.service, s.unit, s.price, sTeacherId, sLessonDays, sExtraLessons, sSessionPrice, sTeacherSessionRate, now, existingId, id);
					else insertSvc.run(id, s.service, s.unit, s.price, sTeacherId, sLessonDays, sExtraLessons, sSessionPrice, sTeacherSessionRate, now, now);
				}
				db.prepare(`
          UPDATE payments
          SET service_id = (
            SELECT cs.id FROM child_services cs
            WHERE cs.child_id = payments.child_id AND cs.service = payments.service
              AND NOT EXISTS (SELECT 1 FROM payments p2 WHERE p2.service_id = cs.id)
            LIMIT 1
          )
          WHERE child_id = ? AND service_id IS NULL
        `).run(id);
			}
		})();
		const updatedChild = db.prepare("SELECT * FROM children WHERE id = ?").get(id);
		updatedChild.services = db.prepare("SELECT * FROM child_services WHERE child_id = ?").all(id);
		return updatedChild;
	} catch (error) {
		console.error("Failed to update child:", error);
		throw new Error(error.message || "Failed to update child");
	}
});
ipcMain.handle("children:deactivate", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!db.prepare("SELECT id FROM children WHERE id = ?").get(id)) throw new Error("الطفل غير موجود / Child not found");
		db.prepare("UPDATE children SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to deactivate child:", error);
		throw new Error(error.message || "Failed to deactivate child");
	}
});
ipcMain.handle("children:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const child = db.prepare("SELECT id, is_active FROM children WHERE id = ?").get(id);
		if (!child) throw new Error("الطفل غير موجود / Child not found");
		if (child.is_active !== 0) throw new Error("لا يمكن حذف طفل نشط — يجب إلغاء تفعيله أولاً / Cannot delete an active child — deactivate first");
		const paymentIds = db.prepare("SELECT id FROM payments WHERE child_id = ?").all(id).map((p) => p.id);
		const serviceIds = db.prepare("SELECT id FROM child_services WHERE child_id = ?").all(id).map((s) => s.id);
		db.transaction(() => {
			db.prepare("DELETE FROM children WHERE id = ?").run(id);
			recordLocalTombstone(db, "children", id);
			for (const paymentId of paymentIds) recordLocalTombstone(db, "payments", paymentId);
			for (const serviceId of serviceIds) recordLocalTombstone(db, "child_services", serviceId);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to delete child:", error);
		throw new Error(error.message || "Failed to delete child");
	}
});
ipcMain.handle("children:statement", async (_event, { childId }) => {
	try {
		checkAuth$9();
		if (!childId) throw new Error("Child ID is required");
		const db = getDb();
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
		if (!child) throw new Error("الطفل غير موجود / Child not found");
		if (child.teacher_id) child.teacher_name = db.prepare("SELECT name FROM employees WHERE id = ?").get(child.teacher_id)?.name ?? null;
		return getChildStatement(child, db.prepare("SELECT * FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
	} catch (error) {
		console.error("Failed to get child statement:", error);
		throw new Error(error.message || "Failed to get child statement");
	}
});
//#endregion
//#region electron/ipc/childServicesIPC.ts
function checkAuth$8() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("childServices:list", async (_event, { childId }) => {
	try {
		checkAuth$8();
		const db = getDb();
		if (!childId) throw new Error("childId is required");
		return db.prepare("SELECT * FROM child_services WHERE child_id = ?").all(childId);
	} catch (error) {
		console.error("Failed to get child services:", error);
		throw new Error(error.message || "Failed to get child services");
	}
});
ipcMain.handle("childServices:add", async (_event, { childId, service, unit, price, teacher_session_rate = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!childId || !service || !unit || price === void 0) throw new Error("جميع الحقول الإلزامية مطلوبة / Missing required fields");
		if (db.prepare("SELECT id FROM child_services WHERE child_id = ? AND service = ?").get(childId, service)) throw new Error("هذه الخدمة مضافة بالفعل للطفل / Service already enrolled");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO child_services (child_id, service, unit, price, teacher_session_rate, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(childId, service, unit, price, teacher_session_rate !== null ? Number(teacher_session_rate) : null, now, now);
		return db.prepare("SELECT * FROM child_services WHERE id = ?").get(result.lastInsertRowid);
	} catch (error) {
		console.error("Failed to add child service:", error);
		throw new Error(error.message || "Failed to add child service");
	}
});
ipcMain.handle("childServices:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("ID and patch are required");
		let query = "UPDATE child_services SET ";
		const params = [];
		for (const key of [
			"unit",
			"price",
			"teacher_session_rate"
		]) if (patch[key] !== void 0) {
			query += `${key} = ?, `;
			params.push(patch[key]);
		}
		if (params.length === 0) return db.prepare("SELECT * FROM child_services WHERE id = ?").get(id);
		query += "updated_at = ?, synced = 0 WHERE id = ?";
		params.push((/* @__PURE__ */ new Date()).toISOString(), id);
		db.prepare(query).run(...params);
		return db.prepare("SELECT * FROM child_services WHERE id = ?").get(id);
	} catch (error) {
		console.error("Failed to update child service:", error);
		throw new Error(error.message || "Failed to update child service");
	}
});
ipcMain.handle("childServices:previewTeacherCost", async (_event, { teacher_id, lesson_days, teacher_session_rate = null }) => {
	try {
		checkAuth$8();
		const db = getDb();
		const teacher = db.prepare("SELECT teacher_session_rate FROM employees WHERE id = ?").get(teacher_id);
		let rate = teacher_session_rate !== null && teacher_session_rate !== "" ? Number(teacher_session_rate) : teacher?.teacher_session_rate ?? null;
		if (rate == null) rate = db.prepare(`
        SELECT st.session_rate as session_rate
        FROM employees e
        LEFT JOIN employee_roles er ON e.role_id = er.id
        LEFT JOIN salary_types st ON st.id = COALESCE(e.salary_type_override_id, er.salary_type_id)
        WHERE e.id = ?
      `).get(teacher_id)?.session_rate ?? 0;
		const days = Array.isArray(lesson_days) ? lesson_days.map(Number) : [];
		const today = /* @__PURE__ */ new Date();
		const year = today.getFullYear();
		const month = today.getMonth();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		let total = 0;
		if (days.length > 0) for (let d = today.getDate(); d <= daysInMonth; d++) {
			const date = new Date(year, month, d);
			if (days.includes(date.getDay())) total++;
		}
		return {
			remaining_sessions: total,
			expected_cost: Number((total * rate).toFixed(2)),
			teacher_session_rate: rate
		};
	} catch (error) {
		throw new Error(error.message || "Failed to preview teacher cost");
	}
});
ipcMain.handle("childServices:getTimetable", async (_event, { child_id }) => {
	try {
		checkAuth$8();
		if (!child_id) throw new Error("child_id is required");
		const enrollments = getDb().prepare(`
      SELECT cs.id as service_row_id, cs.service, cs.teacher_id, cs.lesson_days, e.name as teacher_name
      FROM child_services cs
      LEFT JOIN employees e ON e.id = cs.teacher_id
      WHERE cs.child_id = ?
    `).all(child_id);
		const slots = [];
		for (const en of enrollments) {
			let days = [];
			if (en.lesson_days) try {
				days = JSON.parse(en.lesson_days);
			} catch {
				days = [];
			}
			for (const day of days) slots.push({
				service_row_id: en.service_row_id,
				service: en.service,
				day,
				teacher_id: en.teacher_id ?? null,
				teacher_name: en.teacher_name ?? null
			});
		}
		return slots;
	} catch (error) {
		console.error("Failed to get child timetable:", error);
		throw new Error(error.message || "Failed to get child timetable");
	}
});
ipcMain.handle("childServices:remove", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id) throw new Error("ID is required");
		db.prepare("DELETE FROM child_services WHERE id = ?").run(id);
		recordLocalTombstone(db, "child_services", id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to remove child service:", error);
		throw new Error(error.message || "Failed to remove child service");
	}
});
//#endregion
//#region electron/ipc/teachersIPC.ts
/**
* teachers:list { role? }
*
* Auth-level (any signed-in user) read projection over the `employees` table,
* used by the child form to assign a teacher (feature 004). Returns only
* id/name/role — salary fields are intentionally excluded so employee users
* can pick a teacher without gaining payroll visibility (the admin-only
* `employees:get` is unchanged). When `role` is provided, results are filtered
* to employees whose role matches (case-insensitive, includes the common
* Arabic teacher titles).
*/
ipcMain.handle("teachers:list", async (_event, args) => {
	try {
		if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
		const rows = getDb().prepare("SELECT id, name, role FROM employees WHERE is_active = 1 ORDER BY name ASC").all();
		const roleFilter = (args?.role ?? "").toString().trim().toLowerCase();
		if (!roleFilter) return rows;
		return rows.filter((r) => (r.role ?? "").toLowerCase().includes(roleFilter));
	} catch (error) {
		console.error("Failed to list teachers:", error);
		throw new Error(error.message || "Failed to list teachers");
	}
});
//#endregion
//#region electron/services/monthlyTotals.ts
/**
* Shared "what should this month actually bring in" maths.
*
* `payments.total` is the amount BILLED SO FAR: for attendance-driven units ('يوم' / 'ساعة' /
* 'جلسة') `payments:generate` sets `quantity` from attendance already recorded, so half-way
* through a month it is roughly half the month's real figure. The Payments screen has always
* shown the full scheduled figure ("expected") alongside it, but the Dashboard summed `total`
* — which is why an enrollment book worth ~70k EGP could read ~27k on the Dashboard.
*
* Both screens now derive their totals from here, so the two can never drift apart again.
*/
var ARABIC_MONTH_NAMES = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
/**
* Builds the expected-quantity / expected-total calculators for one month.
*
* For the month currently in progress, scheduled days are counted from today (inclusive) to
* month end and added to what has already been billed — days that have already elapsed without
* attendance were genuinely not owed, so counting the whole month would overstate the bill.
* Any other month is counted in full, since there is no "today" boundary inside it.
*/
function createExpectedTotalCalculator(month, year) {
	const monthIndex = ARABIC_MONTH_NAMES.indexOf(month);
	const payYear = Number(year);
	const daysInMonth = monthIndex !== -1 ? new Date(payYear, monthIndex + 1, 0).getDate() : 30;
	const today = /* @__PURE__ */ new Date();
	const isCurrentMonth = monthIndex === today.getMonth() && payYear === today.getFullYear();
	const startDay = isCurrentMonth ? today.getDate() : 1;
	const countLessonDayOccurrences = (lessonDays) => {
		let count = 0;
		for (let d = startDay; d <= daysInMonth; d++) if (lessonDays.includes(new Date(payYear, monthIndex, d).getDay())) count++;
		return count;
	};
	const expectedQuantity = (p) => {
		if (p.unit === "شهر") return p.quantity || 1;
		if (p.service === "حصص إضافية") return p.quantity;
		let lessonDays = [];
		try {
			lessonDays = JSON.parse(p.service_lesson_days || "[]");
		} catch {}
		if (lessonDays.length === 0 || monthIndex === -1) return p.quantity;
		return isCurrentMonth ? p.quantity + countLessonDayOccurrences(lessonDays) : countLessonDayOccurrences(lessonDays);
	};
	const expectedTotal = (p, qty) => {
		if (p.unit === "شهر" && p.prorated_calculated != null) return Number((Number(p.prorated_calculated) * qty).toFixed(2));
		return Number((qty * p.price).toFixed(2));
	};
	return {
		expectedQuantity,
		expectedTotal,
		monthIndex,
		daysInMonth,
		isCurrentMonth
	};
}
/** Annotates rows in place with `expected_quantity` / `expected_total`. */
function attachExpectedTotals(rows, month, year) {
	const { expectedQuantity, expectedTotal } = createExpectedTotalCalculator(month, year);
	for (const row of rows) {
		row.expected_quantity = expectedQuantity(row);
		row.expected_total = expectedTotal(row, row.expected_quantity);
	}
	return rows;
}
/**
* Loads the month's payment rows with the columns the expected-total maths needs, already
* annotated. Used by the Dashboard; the Payments screen selects more columns and calls
* `attachExpectedTotals` on its own result set.
*/
function getMonthBillableRows(db, month, year) {
	return attachExpectedTotals(db.prepare(`
    SELECT p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.prorated_calculated,
      COALESCE(NULLIF(cs.lesson_days, '[]'), c.lesson_days) as service_lesson_days
    FROM payments p
    JOIN children c ON p.child_id = c.id
    LEFT JOIN child_services cs ON cs.id = p.service_id
    WHERE p.month = ? AND p.year = ?
  `).all(month, year), month, year);
}
//#endregion
//#region electron/ipc/paymentsIPC.ts
function calculatePayment(quantity, price, paid) {
	const total = Number((quantity * price).toFixed(2));
	const balance = Number((total - paid).toFixed(2));
	let status = "unpaid";
	if (paid > 0) {
		if (paid >= total) status = "paid";
		else status = "partial";
	}
	return {
		total,
		balance,
		status
	};
}
/**
* Same as calculatePayment, but never destroys a pro-rated invoice.
*
* A child who enrolls mid-month is billed only for the remaining days: `payments:generate`
* stores that discounted amount in both `total` and `prorated_calculated`, while `quantity`
* stays 1 and `price` stays the FULL monthly rate. So re-deriving the total as quantity × price
* — which is exactly what calculatePayment does — silently re-inflates the bill to a whole
* month the first time anyone edits the payment or records an installment against it.
*
* Every path that recomputes an existing payment row must go through here and pass the row, so
* the discount survives. Only monthly ('شهر') rows carry this shape: the 'جلسة' pro-rate is
* applied by reducing `quantity` instead, so quantity × price is already correct there.
*/
function calculatePaymentPreservingProrate(row, quantity, price, paid) {
	const prorated = row?.prorated_calculated;
	if (row?.unit === "شهر" && prorated != null) {
		const total = Number((Number(prorated) * quantity).toFixed(2));
		return {
			total,
			balance: Number((total - paid).toFixed(2)),
			status: paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial"
		};
	}
	return calculatePayment(quantity, price, paid);
}
function calculateChildStatusRollup(payments) {
	if (payments.length === 0) return "unpaid";
	const allPaid = payments.every((p) => p.status === "paid");
	const allUnpaid = payments.every((p) => p.status === "unpaid");
	if (allPaid) return "paid";
	if (allUnpaid) return "unpaid";
	return "partial";
}
function checkAuth$7() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("payments:get", async (_event, { month, year }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const payments = db.prepare(`
      SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone, c.is_active as child_is_active,
        COALESCE(NULLIF(cs.lesson_days, '[]'), c.lesson_days) as service_lesson_days,
        (SELECT COUNT(*) FROM payment_transactions pt WHERE pt.payment_id = p.id) as transaction_count
      FROM payments p
      JOIN children c ON p.child_id = c.id
      LEFT JOIN child_services cs ON cs.id = p.service_id
      WHERE p.month = ? AND p.year = ?
      ORDER BY c.name ASC
    `).all(month, year);
		attachExpectedTotals(payments, month, year);
		let totalInvoiced = 0;
		let totalBilled = 0;
		let totalCollected = 0;
		let arrears = 0;
		const childMap = /* @__PURE__ */ new Map();
		for (const p of payments) {
			totalInvoiced += p.expected_total;
			totalBilled += p.total;
			totalCollected += p.paid;
			const outstanding = p.expected_total - p.paid;
			if (outstanding > 0) arrears += outstanding;
			if (!childMap.has(p.child_id)) childMap.set(p.child_id, {
				child_id: p.child_id,
				child_name: p.child_name,
				child_guardian: p.child_guardian,
				child_guardian_phone: p.child_guardian_phone,
				child_is_active: p.child_is_active ?? 1,
				services: [],
				totalInvoiced: 0,
				totalCollected: 0,
				totalExpectedSessions: 0,
				totalExpectedPayment: 0,
				balance: 0,
				status: "unpaid"
			});
			const rollUp = childMap.get(p.child_id);
			rollUp.services.push(p);
			rollUp.totalInvoiced += p.total;
			rollUp.totalCollected += p.paid;
			rollUp.balance += p.balance;
			rollUp.totalExpectedSessions += p.expected_quantity ?? p.quantity;
			rollUp.totalExpectedPayment += p.expected_total ?? p.total;
		}
		const lifetimeBalanceStmt = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as lifetime_balance
      FROM payments
      WHERE child_id = ?
    `);
		const priorCreditStmt = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as prior_balance
      FROM payments
      WHERE child_id = ? AND NOT (month = ? AND year = ?)
    `);
		for (const rollUp of childMap.values()) {
			rollUp.status = calculateChildStatusRollup(rollUp.services);
			rollUp.totalInvoiced = Number(rollUp.totalInvoiced.toFixed(2));
			rollUp.totalCollected = Number(rollUp.totalCollected.toFixed(2));
			rollUp.totalExpectedPayment = Number(rollUp.totalExpectedPayment.toFixed(2));
			rollUp.balance = Number(rollUp.balance.toFixed(2));
			const totalSessions = rollUp.services.reduce((sum, s) => sum + (s.quantity || 0), 0);
			const { lifetime_balance } = lifetimeBalanceStmt.get(rollUp.child_id);
			const { prior_balance } = priorCreditStmt.get(rollUp.child_id, month, year);
			const priorCredit = Math.max(0, -prior_balance);
			rollUp.totalSessions = totalSessions;
			rollUp.walletCredit = Number(Math.max(0, -lifetime_balance).toFixed(2));
			rollUp.remainingAfterWallet = Number(Math.max(0, rollUp.totalExpectedPayment - rollUp.totalCollected - priorCredit).toFixed(2));
		}
		return {
			payments,
			byChild: Array.from(childMap.values()).sort((a, b) => String(a.child_name ?? "").localeCompare(String(b.child_name ?? ""))),
			summary: {
				totalInvoiced: Number(totalInvoiced.toFixed(2)),
				totalBilled: Number(totalBilled.toFixed(2)),
				totalCollected: Number(totalCollected.toFixed(2)),
				arrears: Number(arrears.toFixed(2))
			}
		};
	} catch (error) {
		console.error("Failed to get payments:", error);
		throw new Error(error.message || "Failed to get payments");
	}
});
ipcMain.handle("payments:generate", async (_event, { month, year }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const activeEnrollments = db.prepare(`
      SELECT cs.*, c.extra_lessons, c.session_price, c.sessions_baseline, c.reg_date
      FROM child_services cs
      JOIN children c ON cs.child_id = c.id
      WHERE c.is_active = 1
    `).all();
		let createdCount = 0;
		let updatedCount = 0;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const checkStmt = db.prepare(`SELECT id FROM payments WHERE child_id = ? AND service_id = ? AND month = ? AND year = ? AND service != 'حصص إضافية'`);
		const checkExtraStmt = db.prepare(`SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ? AND service = 'حصص إضافية'`);
		const insertStmt = db.prepare(`
      INSERT INTO payments (
        child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, created_at, updated_at, synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0)
    `);
		const billableAttendanceStmt = db.prepare(`
      SELECT COUNT(DISTINCT ar.session_id) as cnt
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN service_definitions sd ON sd.id = ss.service_id
      WHERE ar.child_id = ?
        AND ss.session_date >= ? AND ss.session_date <= ?
        AND ar.status IN ('attended', 'absent_unexcused')
        AND (ss.service_id IS NULL OR sd.name = ?)
    `);
		const scheduledSessionsStmt = db.prepare(`
      SELECT COUNT(DISTINCT ar.session_id) as cnt
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN service_definitions sd ON sd.id = ss.service_id
      WHERE ar.child_id = ?
        AND ss.session_date >= ? AND ss.session_date <= ?
        AND (ss.service_id IS NULL OR sd.name = ?)
    `);
		db.transaction(() => {
			for (const enrollment of activeEnrollments) {
				const monthIndex = [
					"يناير",
					"فبراير",
					"مارس",
					"أبريل",
					"مايو",
					"يونيو",
					"يوليو",
					"أغسطس",
					"سبتمبر",
					"أكتوبر",
					"نوفمبر",
					"ديسمبر"
				].indexOf(month);
				const payYear = Number(year);
				const daysInMonth = monthIndex !== -1 ? new Date(payYear, monthIndex + 1, 0).getDate() : 30;
				const monthPad2 = monthIndex !== -1 ? String(monthIndex + 1).padStart(2, "0") : "01";
				const monthStartStr = `${payYear}-${monthPad2}-01`;
				const monthEndStr = `${payYear}-${monthPad2}-${String(daysInMonth).padStart(2, "0")}`;
				const countBillableAttendance = () => {
					const row = billableAttendanceStmt.get(enrollment.child_id, monthStartStr, monthEndStr, enrollment.service);
					return Number(row?.cnt) || 0;
				};
				const countScheduledSessions = (from = monthStartStr) => {
					const row = scheduledSessionsStmt.get(enrollment.child_id, from, monthEndStr, enrollment.service);
					return Number(row?.cnt) || 0;
				};
				const existing = checkStmt.get(enrollment.child_id, enrollment.id, month, year);
				if (existing && (enrollment.unit === "يوم" || enrollment.unit === "ساعة" || enrollment.unit === "جلسة")) {
					const current = db.prepare("SELECT * FROM payments WHERE id = ?").get(existing.id);
					const newQuantity = enrollment.unit === "جلسة" ? countScheduledSessions() : countBillableAttendance();
					if (current && current.quantity !== newQuantity) {
						const { total, balance, status } = calculatePaymentPreservingProrate(current, newQuantity, current.price, current.paid);
						db.prepare(`
              UPDATE payments SET quantity = ?, total = ?, balance = ?, status = ?, updated_at = ?, synced = 0
              WHERE id = ?
            `).run(newQuantity, total, balance, status, now, existing.id);
						updatedCount++;
					}
				}
				if (!existing) {
					let quantity;
					if (enrollment.unit === "شهر") quantity = 1;
					else if (enrollment.unit === "يوم") quantity = countBillableAttendance();
					else if (enrollment.unit === "ساعة") quantity = countBillableAttendance();
					else if (enrollment.unit === "جلسة") quantity = countScheduledSessions();
					else quantity = 1;
					let proratedCalc = null;
					if (enrollment.reg_date && monthIndex !== -1) {
						const regDate = new Date(enrollment.reg_date);
						const regYear = regDate.getFullYear();
						const regMonth = regDate.getMonth();
						if (regYear === payYear && regMonth === monthIndex && regDate.getDate() > 1) {
							const daysRemaining = daysInMonth - regDate.getDate() + 1;
							if (enrollment.unit === "شهر") proratedCalc = Math.round(enrollment.price * daysRemaining / daysInMonth);
							else if (enrollment.unit === "يوم" || enrollment.unit === "ساعة") {} else if (enrollment.unit === "جلسة") {
								quantity = countScheduledSessions(enrollment.reg_date);
								proratedCalc = Math.round(enrollment.price * quantity);
							}
						}
					}
					const effectiveTotal = enrollment.unit === "شهر" && proratedCalc != null ? proratedCalc : void 0;
					const { total, balance, status } = effectiveTotal != null ? {
						total: effectiveTotal,
						balance: effectiveTotal,
						status: "unpaid"
					} : calculatePayment(quantity, enrollment.price, 0);
					db.prepare(`
            INSERT INTO payments (
              child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, notes, prorated_calculated, created_at, updated_at, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0)
          `).run(enrollment.child_id, enrollment.id, month, year, enrollment.service, enrollment.unit, quantity, enrollment.price, total, balance, status, null, proratedCalc, now, now);
					createdCount++;
				}
				const extraLessons = Number(enrollment.extra_lessons) || 0;
				const sessionPrice = Number(enrollment.session_price) || 0;
				if (extraLessons > 0 && sessionPrice > 0) {
					if (!checkExtraStmt.get(enrollment.child_id, month, year)) {
						const extraTotal = extraLessons * sessionPrice;
						insertStmt.run(enrollment.child_id, enrollment.id, month, year, "حصص إضافية", "جلسة", extraLessons, sessionPrice, extraTotal, extraTotal, "unpaid", `${extraLessons} × ${sessionPrice}`, now, now);
						createdCount++;
					}
				}
			}
		})();
		return {
			created: createdCount,
			updated: updatedCount
		};
	} catch (error) {
		console.error("Failed to generate payments:", error);
		throw new Error(error.message || "Failed to generate payments");
	}
});
ipcMain.handle("payments:update", async (_event, { id, quantity, paid, notes, payment_method_id }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!id) throw new Error("Payment ID is required");
		const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(id);
		if (!payment) throw new Error("سجل الدفع غير موجود / Payment record not found");
		const isAdmin = getCurrentUser()?.role === "admin";
		if (quantity !== void 0 && Number(quantity) !== payment.quantity && !isAdmin) throw new Error("FORBIDDEN: غير مسموح بتعديل الكمية لغير المسؤولين / Forbidden: Only admins can edit quantity");
		const newQuantity = quantity !== void 0 ? Number(quantity) : payment.quantity;
		const newPaid = paid !== void 0 ? Number(paid) : payment.paid;
		const newNotes = notes !== void 0 ? notes : payment.notes;
		const newMethodId = payment_method_id !== void 0 ? payment_method_id : payment.payment_method_id ?? null;
		let newMethodName = payment.payment_method_name ?? null;
		if (payment_method_id !== void 0) {
			newMethodName = null;
			if (payment_method_id !== null) newMethodName = db.prepare("SELECT name FROM payment_methods WHERE id = ?").get(payment_method_id)?.name ?? null;
		}
		const { total, balance, status } = calculatePaymentPreservingProrate(payment, newQuantity, payment.price, newPaid);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      UPDATE payments
      SET quantity = ?, paid = ?, total = ?, balance = ?, status = ?, notes = ?,
          payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(newQuantity, newPaid, total, balance, status, newNotes, newMethodId, newMethodName, now, id);
		return db.prepare(`
      SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone
      FROM payments p JOIN children c ON p.child_id = c.id
      WHERE p.id = ?
    `).get(id);
	} catch (error) {
		console.error("Failed to update payment:", error);
		throw new Error(error.message || "Failed to update payment");
	}
});
ipcMain.handle("payments:bulkPay", async (_event, { ids, payment_method_id }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!ids || !Array.isArray(ids) || ids.length === 0) throw new Error("Payment IDs array is required");
		let methodName = null;
		const methodId = payment_method_id ?? null;
		if (methodId !== null) methodName = db.prepare("SELECT name FROM payment_methods WHERE id = ?").get(methodId)?.name ?? null;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		let updatedCount = 0;
		let alreadySettled = 0;
		const loadStmt = db.prepare("SELECT * FROM payments WHERE id = ?");
		const insertTxStmt = db.prepare(`
      INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);
		db.transaction(() => {
			for (const id of ids) {
				const payment = loadStmt.get(id);
				if (!payment) continue;
				const outstanding = Number((Number(payment.total || 0) - Number(payment.paid || 0)).toFixed(2));
				if (outstanding <= 0) {
					alreadySettled++;
					continue;
				}
				seedLegacyPaidAsTransaction(db, payment, now);
				insertTxStmt.run(id, outstanding, methodId, methodName, now.slice(0, 10), "تحصيل جماعي / Bulk payment", now, now);
				recomputePaymentFromTransactions(db, id);
				updatedCount++;
			}
		})();
		return {
			updated: updatedCount,
			alreadySettled
		};
	} catch (error) {
		console.error("Failed to bulk pay payments:", error);
		throw new Error(error.message || "Failed to process bulk payments");
	}
});
/**
* Preserves a payment's pre-existing `paid` amount as a seed transaction row.
*
* `paid` is derived from SUM(payment_transactions), but rows created before installments
* existed (or settled by an older bulk-pay) carry a `paid` figure with no transaction behind it.
* Writing the first real transaction against such a row would otherwise make the sum drop to
* just that new amount, silently erasing the money already collected. Called before every
* transaction insert; a no-op once the row has any transactions of its own.
*/
function seedLegacyPaidAsTransaction(db, payment, now) {
	if (db.prepare("SELECT COUNT(*) as c FROM payment_transactions WHERE payment_id = ?").get(payment.id).c > 0 || Number(payment.paid) <= 0) return;
	db.prepare(`
    INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(payment.id, Number(payment.paid), payment.payment_method_id ?? null, payment.payment_method_name ?? null, (payment.updated_at || payment.created_at || now).slice(0, 10), "رصيد سابق / Previous balance", now, now);
}
function recomputePaymentFromTransactions(db, paymentId) {
	const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
	if (!payment) return null;
	const paid = Number((db.prepare("SELECT COALESCE(SUM(amount), 0) as s FROM payment_transactions WHERE payment_id = ?").get(paymentId).s ?? 0).toFixed(2));
	const last = db.prepare("SELECT payment_method_id, payment_method_name FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date DESC, id DESC LIMIT 1").get(paymentId);
	const { total, balance, status } = calculatePaymentPreservingProrate(payment, payment.quantity, payment.price, paid);
	db.prepare(`
    UPDATE payments SET paid = ?, total = ?, balance = ?, status = ?,
      payment_method_id = ?, payment_method_name = ?, updated_at = ?, synced = 0
    WHERE id = ?
  `).run(paid, total, balance, status, last?.payment_method_id ?? null, last?.payment_method_name ?? null, (/* @__PURE__ */ new Date()).toISOString(), paymentId);
}
ipcMain.handle("payments:listTransactions", async (_event, { payment_id }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!payment_id) throw new Error("Payment ID is required");
		return db.prepare("SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC").all(payment_id);
	} catch (error) {
		console.error("Failed to list payment transactions:", error);
		throw new Error(error.message || "Failed to list payment transactions");
	}
});
ipcMain.handle("payments:addTransaction", async (_event, { payment_id, amount, payment_method_id = null, paid_date = null, notes = null }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!payment_id) throw new Error("Payment ID is required");
		const amt = Number(amount);
		if (!amt || amt <= 0) throw new Error("المبلغ يجب أن يكون أكبر من صفر / Amount must be greater than zero");
		const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(payment_id);
		if (!payment) throw new Error("سجل الدفع غير موجود / Payment record not found");
		const resolveMethodName = (id) => {
			if (id == null) return null;
			return db.prepare("SELECT name FROM payment_methods WHERE id = ?").get(id)?.name ?? null;
		};
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const date = paid_date || now.slice(0, 10);
		db.transaction(() => {
			seedLegacyPaidAsTransaction(db, payment, now);
			db.prepare(`
        INSERT INTO payment_transactions (payment_id, amount, payment_method_id, payment_method_name, paid_date, notes, created_at, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      `).run(payment_id, amt, payment_method_id, resolveMethodName(payment_method_id), date, notes, now, now);
			recomputePaymentFromTransactions(db, payment_id);
		})();
		return {
			payment: db.prepare("SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone FROM payments p JOIN children c ON p.child_id = c.id WHERE p.id = ?").get(payment_id),
			transactions: db.prepare("SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC").all(payment_id)
		};
	} catch (error) {
		console.error("Failed to add payment transaction:", error);
		throw new Error(error.message || "Failed to add payment transaction");
	}
});
ipcMain.handle("payments:deleteTransaction", async (_event, { id }) => {
	try {
		checkAuth$7();
		const db = getDb();
		if (!id) throw new Error("Transaction ID is required");
		const tx = db.prepare("SELECT payment_id FROM payment_transactions WHERE id = ?").get(id);
		if (!tx) throw new Error("العملية غير موجودة / Transaction not found");
		db.transaction(() => {
			db.prepare("DELETE FROM payment_transactions WHERE id = ?").run(id);
			recomputePaymentFromTransactions(db, tx.payment_id);
		})();
		return {
			payment: db.prepare("SELECT p.*, c.name as child_name, c.guardian as child_guardian, c.guardian_phone as child_guardian_phone FROM payments p JOIN children c ON p.child_id = c.id WHERE p.id = ?").get(tx.payment_id),
			transactions: db.prepare("SELECT * FROM payment_transactions WHERE payment_id = ? ORDER BY paid_date ASC, id ASC").all(tx.payment_id)
		};
	} catch (error) {
		console.error("Failed to delete payment transaction:", error);
		throw new Error(error.message || "Failed to delete payment transaction");
	}
});
ipcMain.handle("payments:deleteBulk", async (_event, { ids }) => {
	try {
		requireAdmin();
		const db = getDb();
		const list = Array.isArray(ids) ? ids.map(Number).filter((n) => Number.isFinite(n)) : [];
		if (list.length === 0) return {
			ok: true,
			deleted: 0
		};
		let deleted = 0;
		db.transaction(() => {
			const placeholders = list.map(() => "?").join(",");
			db.prepare(`DELETE FROM payment_transactions WHERE payment_id IN (${placeholders})`).run(...list);
			const res = db.prepare(`DELETE FROM payments WHERE id IN (${placeholders})`).run(...list);
			deleted = Number(res.changes);
			for (const id of list) recordLocalTombstone(db, "payments", id);
		})();
		return {
			ok: true,
			deleted
		};
	} catch (error) {
		console.error("Failed to delete selected payments:", error);
		throw new Error(error.message || "Failed to delete selected payments");
	}
});
ipcMain.handle("payments:deleteAll", async (_event, { month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		let deleted = 0;
		db.transaction(() => {
			const rows = db.prepare("SELECT id FROM payments WHERE month = ? AND year = ?").all(month, year);
			if (rows.length > 0) {
				const ids = rows.map((r) => r.id);
				const placeholders = ids.map(() => "?").join(",");
				db.prepare(`DELETE FROM payment_transactions WHERE payment_id IN (${placeholders})`).run(...ids);
			}
			const res = db.prepare(`DELETE FROM payments WHERE month = ? AND year = ?`).run(month, year);
			deleted = Number(res.changes);
			for (const row of rows) recordLocalTombstone(db, "payments", row.id);
		})();
		return {
			ok: true,
			deleted
		};
	} catch (error) {
		console.error("Failed to delete all payments for period:", error);
		throw new Error(error.message || "Failed to delete all payments for period");
	}
});
ipcMain.handle("payments:deleteForChild", async (_event, { child_id, month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!child_id || !month || !year) throw new Error("Child ID, month, and year are required");
		db.transaction(() => {
			const payments = db.prepare("SELECT id FROM payments WHERE child_id = ? AND month = ? AND year = ?").all(child_id, month, year);
			if (payments.length > 0) {
				const ids = payments.map((p) => p.id);
				const placeholders = ids.map(() => "?").join(",");
				db.prepare(`DELETE FROM payment_transactions WHERE payment_id IN (${placeholders})`).run(...ids);
				db.prepare(`DELETE FROM payments WHERE child_id = ? AND month = ? AND year = ?`).run(child_id, month, year);
				for (const id of ids) recordLocalTombstone(db, "payments", id);
			}
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to delete child payments:", error);
		throw new Error(error.message || "Failed to delete child payments");
	}
});
//#endregion
//#region electron/services/attendanceAuditService.ts
/**
* Appends one row to attendance_audit_log. Insert-only — no update/delete handler is ever
* exposed for this table (FR-013/FR-021): "no attendance record should ever disappear
* completely" extends to its history.
*/
function writeAuditLog(db, entry) {
	db.prepare(`
    INSERT INTO attendance_audit_log
      (attendance_record_id, edit_request_id, old_status, old_excuse_notes, old_teacher_status,
       new_status, new_excuse_notes, new_teacher_status, changed_by, approved_by, reason, changed_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(entry.attendance_record_id, entry.edit_request_id, entry.old_status, entry.old_excuse_notes, entry.old_teacher_status, entry.new_status, entry.new_excuse_notes, entry.new_teacher_status, entry.changed_by, entry.approved_by, entry.reason, entry.changed_at);
}
//#endregion
//#region electron/ipc/notificationsIPC.ts
/**
* Minimal in-app notification (research.md #6 — no email/SMS/push integration in v1).
* Exported so other IPC modules (attendanceIPC) can enqueue notifications inline.
*/
function insertNotification(db, entry) {
	db.prepare(`
    INSERT INTO notifications (user_id, type, related_id, message_ar, message_en, read_at, created_at, synced)
    VALUES (?, ?, ?, ?, ?, NULL, ?, 0)
  `).run(entry.user_id, entry.type, entry.related_id, entry.message_ar, entry.message_en, (/* @__PURE__ */ new Date()).toISOString());
}
ipcMain.handle("notifications:list", async (_event, args) => {
	try {
		checkAuth$10();
		const user = getCurrentUser();
		const db = getDb();
		const sql = args?.unreadOnly === true ? "SELECT * FROM notifications WHERE user_id = ? AND read_at IS NULL ORDER BY created_at DESC" : "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC";
		return db.prepare(sql).all(user.id);
	} catch (error) {
		throw new Error(error.message || "Failed to list notifications");
	}
});
ipcMain.handle("notifications:markRead", async (_event, args) => {
	try {
		checkAuth$10();
		const user = getCurrentUser();
		const db = getDb();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		if (args?.all) db.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").run(now, user.id);
		else db.prepare("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?").run(now, args.id, user.id);
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to mark notification read");
	}
});
//#endregion
//#region electron/ipc/attendanceIPC.ts
/**
* Pure payment-eligibility rule (spec.md FR-008…FR-011):
*   teacher present + child attended            → payable
*   teacher present + child absent (unexcused)   → payable
*   teacher present + child absent (excused)     → not payable
*   teacher absent (any child status)            → not payable
* Exported for direct unit testing without touching the database.
*/
function isPaymentEligible(teacherStatus, childStatus) {
	if (teacherStatus !== "present") return false;
	return childStatus === "attended" || childStatus === "absent_unexcused";
}
/**
* The price of this child's service, preferring the enrollment linked to this teacher, then the
* child's most recent enrollment, then the child record's own price. This is `price` — what the
* service itself costs — NEVER the enrollment's session_price field.
*/
function getChildServicePrice(db, child_id, childRow) {
	if (childRow?.price != null) return childRow.price;
	const anyEnrollment = db.prepare(`
    SELECT price FROM child_services WHERE child_id = ? ORDER BY id DESC LIMIT 1
  `).get(child_id);
	if (anyEnrollment?.price != null) return anyEnrollment.price;
	return db.prepare("SELECT price FROM children WHERE id = ?").get(child_id)?.price ?? null;
}
/**
* Resolves the per-session rate to pay a teacher for one child.
*
* `per_child_session` salary type mode (pay comes from the salary type itself, NEVER the
* child's service/section price, NEVER the teacher's flat "Per Session Cost" and NEVER the
* enrollment's session_price):
*   1. that child's own override (`child_services.teacher_session_rate` — salary type per child)
*   2. the salary type's own `session_rate`
*
* `per_session_pct` salary type mode (percentage OF the child's service price — a 100%
* percentage pays exactly the service price; nothing is ever hardcoded to 100 EGP):
*   1. that child's own override, if set (absolute amount)
*   2. `salary_types.session_pct` × the child's service price
*
* All other modes:
*   1. the child's own override, if set
*   2. the teacher's own flat rate (`employees.teacher_session_rate`)
*   3. the effective salary type's per-session rate (`salary_types.session_rate`)
*
* There is no org-wide fallback setting anymore — a teacher with none of the above configured
* simply generates no payment, so misconfiguration is visible rather than silently paid at a
* stale default.
*/
function resolveTeacherSessionRate(db, teacher_id, child_id) {
	const childRow = db.prepare(`
    SELECT teacher_session_rate, price FROM child_services
    WHERE child_id = ? AND teacher_id = ?
    ORDER BY (teacher_session_rate IS NOT NULL) DESC, id DESC LIMIT 1
  `).get(child_id, teacher_id);
	if (childRow?.teacher_session_rate != null) return childRow.teacher_session_rate;
	const salaryTypeRow = db.prepare(`
    SELECT st.mode as mode, st.session_rate as session_rate, st.session_pct as session_pct
    FROM employees e
    LEFT JOIN employee_roles er ON e.role_id = er.id
    LEFT JOIN salary_types st ON st.id = COALESCE(e.salary_type_override_id, er.salary_type_id)
    WHERE e.id = ?
  `).get(teacher_id);
	if (salaryTypeRow?.mode === "per_child_session") return salaryTypeRow?.session_rate ?? null;
	if (salaryTypeRow?.mode === "per_session_pct") {
		const price = getChildServicePrice(db, child_id, childRow);
		if (price != null && salaryTypeRow.session_pct != null) return Number((price * salaryTypeRow.session_pct).toFixed(2));
		return null;
	}
	const teacherRow = db.prepare("SELECT teacher_session_rate FROM employees WHERE id = ?").get(teacher_id);
	if (teacherRow?.teacher_session_rate != null) return teacherRow.teacher_session_rate;
	if (salaryTypeRow?.session_rate != null) return salaryTypeRow.session_rate;
	return null;
}
/**
* Re-snapshots every still-Pending payment of one teacher to the rate that CURRENTLY resolves
* for its child — so a salary-type switch (e.g. to per_child_session), a per-child override, or
* a rate correction is reflected in salary views immediately, without waiting for each
* attendance record to be re-saved. Paid/Void rows are never touched (research.md #7).
*/
function resnapshotPendingTeacherPayments(db, teacher_id) {
	const pending = db.prepare(`
    SELECT id, child_id, session_cost FROM teacher_payments WHERE teacher_id = ? AND status = 'pending'
  `).all(teacher_id);
	if (pending.length === 0) return;
	const now = (/* @__PURE__ */ new Date()).toISOString();
	for (const p of pending) {
		const rate = resolveTeacherSessionRate(db, teacher_id, p.child_id);
		if (rate != null && rate !== p.session_cost) db.prepare(`UPDATE teacher_payments SET session_cost = ?, updated_at = ?, synced = 0 WHERE id = ?`).run(rate, now, p.id);
	}
}
/**
* Recomputes the teacher_payments row for one (teacher, child, date) combination given the
* attendance values that now apply — voiding a stale pending payment or (re)generating one, per
* the same five payment-eligibility cases used since feature 006. Extracted so both the direct
* attendance:record write path AND the edit-request approval path (feature 007) call one shared
* implementation instead of two that could silently diverge (specs/007-.../research.md #5).
*/
function recalculateAttendancePayment(db, params) {
	const { teacher_id, child_id, attendance_record_id, attendance_date, status, teacher_status, now } = params;
	const existing = db.prepare(`
    SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ? AND attendance_date = ?
  `).get(teacher_id, child_id, attendance_date);
	const payable = isPaymentEligible(teacher_status, status);
	const effectiveRate = resolveTeacherSessionRate(db, teacher_id, child_id);
	const hasEffectiveRate = effectiveRate != null;
	if (payable && hasEffectiveRate) {
		if (!existing || existing.status === "void" || existing.status === "pending") db.prepare(`
        INSERT INTO teacher_payments (teacher_id, child_id, attendance_record_id, attendance_date, session_cost, status, created_at, updated_at, synced)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0)
        ON CONFLICT(teacher_id, child_id, attendance_date) DO UPDATE SET
          attendance_record_id = excluded.attendance_record_id,
          session_cost = excluded.session_cost,
          status = 'pending',
          updated_at = excluded.updated_at,
          synced = 0
      `).run(teacher_id, child_id, attendance_record_id, attendance_date, effectiveRate, now, now);
	} else if ((!payable || !hasEffectiveRate) && existing && existing.status === "pending") db.prepare(`UPDATE teacher_payments SET status = 'void', updated_at = ?, synced = 0 WHERE id = ?`).run(now, existing.id);
}
ipcMain.handle("attendance:getSheet", async (_event, { session_id }) => {
	try {
		checkAuth$10();
		const db = getDb();
		const session = db.prepare("SELECT session_date FROM scheduled_sessions WHERE id = ?").get(session_id);
		let dayOfWeek = null;
		if (session?.session_date) {
			const [y, m, d] = session.session_date.split("-").map(Number);
			dayOfWeek = new Date(y, m - 1, d).getDay();
		}
		const activeChildren = db.prepare(`
      SELECT id as child_id, name as child_name, photo_url as child_photo_url, lesson_days
      FROM children WHERE is_active = 1
    `).all();
		const enrollments = db.prepare(`
      SELECT DISTINCT cs.child_id, cs.teacher_id, cs.lesson_days as enrollment_lesson_days
      FROM child_services cs
      WHERE cs.teacher_id IS NOT NULL
    `).all();
		const enrollmentsByChild = /* @__PURE__ */ new Map();
		for (const en of enrollments) {
			if (!enrollmentsByChild.has(en.child_id)) enrollmentsByChild.set(en.child_id, []);
			enrollmentsByChild.get(en.child_id).push(en);
		}
		const candidates = [];
		for (const c of activeChildren) {
			const childEnrollments = enrollmentsByChild.get(c.child_id) ?? [];
			if (childEnrollments.length === 0) candidates.push({
				child_id: c.child_id,
				child_name: c.child_name,
				child_photo_url: c.child_photo_url,
				teacher_id: null,
				lesson_days: c.lesson_days
			});
			else {
				const seenTeachers = /* @__PURE__ */ new Set();
				for (const en of childEnrollments) {
					if (seenTeachers.has(en.teacher_id)) continue;
					seenTeachers.add(en.teacher_id);
					candidates.push({
						child_id: c.child_id,
						child_name: c.child_name,
						child_photo_url: c.child_photo_url,
						teacher_id: en.teacher_id,
						lesson_days: en.enrollment_lesson_days || c.lesson_days
					});
				}
			}
		}
		const teacherIds = [...new Set(candidates.map((c) => c.teacher_id).filter((id) => id != null))];
		const teachersById = /* @__PURE__ */ new Map();
		if (teacherIds.length > 0) {
			const ph = teacherIds.map(() => "?").join(",");
			for (const t of db.prepare(`SELECT id, name, teacher_session_rate FROM employees WHERE id IN (${ph})`).all(...teacherIds)) teachersById.set(t.id, t);
		}
		const rows = candidates.map((cand) => {
			const teacher = cand.teacher_id != null ? teachersById.get(cand.teacher_id) : null;
			const ar = cand.teacher_id != null ? db.prepare(`SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?`).get(session_id, cand.child_id, cand.teacher_id) : db.prepare(`SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL`).get(session_id, cand.child_id);
			const tp = ar ? db.prepare(`SELECT * FROM teacher_payments WHERE attendance_record_id = ?`).get(ar.id) : null;
			return {
				child_id: cand.child_id,
				child_name: cand.child_name,
				child_photo_url: cand.child_photo_url,
				lesson_days: cand.lesson_days,
				teacher_id: cand.teacher_id,
				teacher_name: teacher?.name ?? null,
				teacher_session_rate: cand.teacher_id != null ? resolveTeacherSessionRate(db, cand.teacher_id, cand.child_id) : null,
				attendance_id: ar?.id ?? null,
				locked: !!ar,
				status: ar?.status ?? null,
				excuse_notes: ar?.excuse_notes ?? null,
				recorded_by: ar?.recorded_by ?? null,
				recorded_at: ar?.recorded_at ?? null,
				updated_at: ar?.updated_at ?? null,
				attended_teacher_id: ar?.attended_teacher_id ?? null,
				teacher_status: ar?.teacher_status ?? null,
				payment: {
					generated: tp?.status === "pending" || tp?.status === "paid",
					amount: tp?.session_cost ?? null,
					status: tp?.status ?? null
				}
			};
		}).filter((r) => {
			if (r.attendance_id) return true;
			if (!r.lesson_days || r.lesson_days === "[]" || r.lesson_days === "") return true;
			if (dayOfWeek === null) return true;
			try {
				const days = JSON.parse(r.lesson_days);
				return days.length === 0 || days.includes(dayOfWeek);
			} catch {
				return true;
			}
		}).map(({ lesson_days, ...rest }) => rest);
		rows.sort((a, b) => a.child_name.localeCompare(b.child_name));
		return rows;
	} catch (error) {
		throw new Error(error.message || "Failed to get attendance sheet");
	}
});
ipcMain.handle("attendance:record", async (_event, args) => {
	try {
		checkAuth$10();
		const db = getDb();
		const user = getCurrentUser();
		const isAdmin = user?.role === "admin";
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const results = [];
		const sessionId = args?.session_id;
		const records = Array.isArray(args) ? args : args?.records ?? [];
		const payableTeachersBySession = /* @__PURE__ */ new Map();
		db.transaction(() => {
			for (const rec of records) {
				const session_id = sessionId ?? rec.session_id;
				const { child_id, status, excuse_notes = null, teacher_status = "present" } = rec;
				if (![
					"attended",
					"absent_excused",
					"absent_unexcused"
				].includes(status)) throw new Error(`Invalid status: ${status}`);
				if (teacher_status !== "present" && teacher_status !== "absent") throw new Error(`Invalid teacher_status: ${teacher_status}`);
				let attended_teacher_id;
				if ("teacher_id" in rec) attended_teacher_id = rec.teacher_id ?? null;
				else attended_teacher_id = db.prepare("SELECT teacher_id FROM children WHERE id = ?").get(child_id)?.teacher_id ?? null;
				const attendanceDate = db.prepare("SELECT session_date FROM scheduled_sessions WHERE id = ?").get(session_id)?.session_date;
				const existingRecord = attended_teacher_id == null ? db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL").get(session_id, child_id) : db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?").get(session_id, child_id, attended_teacher_id);
				if (existingRecord && !isAdmin) {
					results.push({
						...existingRecord,
						locked: true
					});
					continue;
				}
				if (existingRecord) db.prepare(`
            UPDATE attendance_records
            SET status = ?, excuse_notes = ?, recorded_by = ?, updated_at = ?, teacher_status = ?, synced = 0
            WHERE id = ?
          `).run(status, excuse_notes, user?.id ?? null, now, teacher_status, existingRecord.id);
				else db.prepare(`
            INSERT INTO attendance_records (session_id, child_id, status, excuse_notes, recorded_by, recorded_at, updated_at, synced, attended_teacher_id, teacher_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            ON CONFLICT(session_id, child_id, attended_teacher_id) DO UPDATE SET
              status = excluded.status,
              excuse_notes = excluded.excuse_notes,
              recorded_by = excluded.recorded_by,
              updated_at = excluded.updated_at,
              teacher_status = excluded.teacher_status,
              synced = 0
          `).run(session_id, child_id, status, excuse_notes, user?.id ?? null, now, now, attended_teacher_id, teacher_status);
				const savedRecord = attended_teacher_id == null ? db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL").get(session_id, child_id) : db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?").get(session_id, child_id, attended_teacher_id);
				if (existingRecord && isAdmin && user) writeAuditLog(db, {
					attendance_record_id: savedRecord.id,
					edit_request_id: null,
					old_status: existingRecord.status,
					old_excuse_notes: existingRecord.excuse_notes,
					old_teacher_status: existingRecord.teacher_status,
					new_status: status,
					new_excuse_notes: excuse_notes,
					new_teacher_status: teacher_status,
					changed_by: user.id,
					approved_by: user.id,
					reason: null,
					changed_at: now
				});
				if (attended_teacher_id && attendanceDate) recalculateAttendancePayment(db, {
					teacher_id: attended_teacher_id,
					child_id,
					attendance_record_id: savedRecord.id,
					attendance_date: attendanceDate,
					status,
					teacher_status,
					now
				});
				if ((status === "attended" || status === "absent_unexcused") && attended_teacher_id != null) {
					if (!payableTeachersBySession.has(session_id)) payableTeachersBySession.set(session_id, /* @__PURE__ */ new Set());
					payableTeachersBySession.get(session_id).add(attended_teacher_id);
				}
				results.push(savedRecord);
			}
			for (const [session_id, teacherIds] of payableTeachersBySession) for (const teacher_id of teacherIds) db.prepare("INSERT OR IGNORE INTO session_teachers (session_id, employee_id, synced) VALUES (?, ?, 0)").run(session_id, teacher_id);
		})();
		return results;
	} catch (error) {
		throw new Error(error.message || "Failed to record attendance");
	}
});
ipcMain.handle("attendance:delete", async (_event, { session_id, child_ids, reason }) => {
	try {
		checkAuth$10();
		const db = getDb();
		const user = getCurrentUser();
		const isAdmin = user.role === "admin";
		const items = (Array.isArray(child_ids) ? child_ids : []).map((it) => typeof it === "object" ? {
			child_id: it.child_id,
			teacher_id: it.teacher_id
		} : {
			child_id: it,
			teacher_id: void 0
		});
		if (items.length === 0) return {
			ok: true,
			deleted: 0,
			requested: 0
		};
		let deleted = 0;
		let requested = 0;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.transaction(() => {
			for (const item of items) {
				const records = item.teacher_id !== void 0 ? item.teacher_id == null ? db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL").all(session_id, item.child_id) : db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?").all(session_id, item.child_id, item.teacher_id) : db.prepare("SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ?").all(session_id, item.child_id);
				if (!isAdmin) {
					for (const record of records) {
						if (db.prepare(`SELECT 1 FROM attendance_edit_requests WHERE attendance_record_id = ? AND status = 'pending'`).get(record.id)) continue;
						const session = db.prepare("SELECT session_date FROM scheduled_sessions WHERE id = ?").get(record.session_id);
						db.prepare(`
              INSERT INTO attendance_edit_requests
                (attendance_record_id, child_id, teacher_id, attendance_date,
                 original_status, original_excuse_notes, original_teacher_status,
                 requested_status, requested_excuse_notes, requested_teacher_status,
                 reason, requested_by, requested_at, status, synced)
              VALUES (?, ?, ?, ?, ?, ?, ?, 'deleted', NULL, NULL, ?, ?, ?, 'pending', 0)
            `).run(record.id, record.child_id, record.attended_teacher_id, session?.session_date ?? now.slice(0, 10), record.status, record.excuse_notes, record.teacher_status, reason && String(reason).trim() || "حذف تسجيل حضور / Delete attendance record", user.id, now);
						requested++;
					}
					continue;
				}
				for (const { id: recordId } of records) {
					if (db.prepare(`SELECT 1 FROM teacher_payments WHERE attendance_record_id = ? AND status = 'paid'`).get(recordId)) continue;
					db.prepare(`UPDATE teacher_payments SET status = 'void', updated_at = ?, synced = 0 WHERE status = 'pending' AND attendance_record_id = ?`).run(now, recordId);
					db.prepare(`DELETE FROM attendance_conflicts WHERE attendance_record_id = ?`).run(recordId);
					const res = db.prepare(`DELETE FROM attendance_records WHERE id = ?`).run(recordId);
					deleted += Number(res.changes);
				}
			}
			if (requested > 0) {
				const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`).all();
				for (const admin of admins) insertNotification(db, {
					user_id: admin.id,
					type: "edit_request_submitted",
					related_id: null,
					message_ar: `طلب حذف حضور جديد بانتظار المراجعة (${requested})`,
					message_en: `New attendance delete request awaiting review (${requested})`
				});
			}
		})();
		return {
			ok: true,
			deleted,
			requested
		};
	} catch (error) {
		throw new Error(error.message || "Failed to delete attendance");
	}
});
ipcMain.handle("attendance:getChildHistory", async (_event, { child_id }) => {
	try {
		requireAdmin();
		return getDb().prepare(`
      SELECT
        ss.session_date as attendance_date,
        ar.attended_teacher_id as teacher_id,
        e.name as teacher_name,
        ar.teacher_status,
        ar.status as child_status,
        CASE WHEN tp.status IN ('pending','paid') THEN 1 ELSE 0 END as payment_generated,
        tp.status as payment_status,
        tp.session_cost
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN employees e ON e.id = ar.attended_teacher_id
      LEFT JOIN teacher_payments tp ON tp.attendance_record_id = ar.id
      WHERE ar.child_id = ?
      ORDER BY ss.session_date DESC
    `).all(child_id).map((row) => ({
			...row,
			payment_generated: !!row.payment_generated
		}));
	} catch (error) {
		throw new Error(error.message || "Failed to get attendance history");
	}
});
ipcMain.handle("attendance:getConflicts", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT * FROM attendance_conflicts WHERE reviewed = 0 ORDER BY created_at DESC").all();
	} catch (error) {
		throw new Error(error.message || "Failed to get conflicts");
	}
});
ipcMain.handle("attendance:resolveConflict", async (_event, { conflict_id, final_status }) => {
	try {
		requireAdmin();
		const db = getDb();
		const conflict = db.prepare("SELECT * FROM attendance_conflicts WHERE id = ?").get(conflict_id);
		if (!conflict) throw new Error("التعارض غير موجود / Conflict not found");
		db.prepare("UPDATE attendance_conflicts SET reviewed = 1 WHERE id = ?").run(conflict_id);
		db.prepare("UPDATE attendance_records SET status = ?, updated_at = ?, synced = 0 WHERE id = ?").run(final_status, (/* @__PURE__ */ new Date()).toISOString(), conflict.attendance_record_id);
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to resolve conflict");
	}
});
ipcMain.handle("attendance:getSummary", async (_event, { employee_id, month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		const monthIdx = [
			"يناير",
			"فبراير",
			"مارس",
			"أبريل",
			"مايو",
			"يونيو",
			"يوليو",
			"أغسطس",
			"سبتمبر",
			"أكتوبر",
			"نوفمبر",
			"ديسمبر"
		].indexOf(String(month));
		const monthNum = monthIdx !== -1 ? String(monthIdx + 1).padStart(2, "0") : String(month).padStart(2, "0");
		const yearStr = String(year);
		const monthStart = `${yearStr}-${monthNum}-01`;
		const monthEnd = `${yearStr}-${monthNum}-31`;
		const sessionIds = db.prepare(`
      SELECT ss.id FROM scheduled_sessions ss
      JOIN session_teachers st ON st.session_id = ss.id
      WHERE st.employee_id = ? AND ss.session_date >= ? AND ss.session_date <= ?
    `).all(employee_id, monthStart, monthEnd).map((s) => s.id);
		if (sessionIds.length === 0) return {
			total_sessions: 0,
			payable_sessions: 0,
			excused_absences: 0,
			unexcused_absences: 0,
			breakdown: []
		};
		const placeholders = sessionIds.map(() => "?").join(",");
		const records = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM attendance_records WHERE session_id IN (${placeholders}) GROUP BY status
    `).all(...sessionIds);
		const attended = records.find((r) => r.status === "attended")?.cnt ?? 0;
		const excused = records.find((r) => r.status === "absent_excused")?.cnt ?? 0;
		const unexcused = records.find((r) => r.status === "absent_unexcused")?.cnt ?? 0;
		return {
			total_sessions: sessionIds.length,
			payable_sessions: attended + unexcused,
			excused_absences: excused,
			unexcused_absences: unexcused,
			breakdown: records
		};
	} catch (error) {
		throw new Error(error.message || "Failed to get attendance summary");
	}
});
ipcMain.handle("attendance:requestEdit", async (_event, args) => {
	try {
		checkAuth$10();
		const user = getCurrentUser();
		if (user.role === "admin") throw new Error("Admins edit attendance directly and do not need to submit an edit request");
		const db = getDb();
		const { attendance_record_id, requested_status, requested_excuse_notes = null, requested_teacher_status = null, reason } = args;
		if (!reason || !String(reason).trim()) throw new Error("A reason is required to request an attendance edit");
		const record = db.prepare("SELECT * FROM attendance_records WHERE id = ?").get(attendance_record_id);
		if (!record) throw new Error("Attendance record not found");
		const existingPending = db.prepare(`SELECT * FROM attendance_edit_requests WHERE attendance_record_id = ? AND status = 'pending'`).get(attendance_record_id);
		if (existingPending) {
			const err = /* @__PURE__ */ new Error("A pending edit request already exists for this attendance record");
			err.existingRequest = existingPending;
			throw err;
		}
		const session = db.prepare("SELECT session_date FROM scheduled_sessions WHERE id = ?").get(record.session_id);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO attendance_edit_requests
        (attendance_record_id, child_id, teacher_id, attendance_date,
         original_status, original_excuse_notes, original_teacher_status,
         requested_status, requested_excuse_notes, requested_teacher_status,
         reason, requested_by, requested_at, status, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)
    `).run(attendance_record_id, record.child_id, record.attended_teacher_id, session?.session_date ?? null, record.status, record.excuse_notes, record.teacher_status, requested_status, requested_excuse_notes, requested_teacher_status, reason, user.id, now);
		const requestId = Number(result.lastInsertRowid);
		const admins = db.prepare(`SELECT id FROM users WHERE role = 'admin' AND is_active = 1`).all();
		for (const admin of admins) insertNotification(db, {
			user_id: admin.id,
			type: "edit_request_submitted",
			related_id: requestId,
			message_ar: `طلب تعديل حضور جديد بانتظار المراجعة`,
			message_en: `New attendance edit request awaiting review`
		});
		return db.prepare("SELECT * FROM attendance_edit_requests WHERE id = ?").get(requestId);
	} catch (error) {
		const err = new Error(error.message || "Failed to submit edit request");
		if (error.existingRequest) err.existingRequest = error.existingRequest;
		throw err;
	}
});
ipcMain.handle("attendance:listEditRequests", async (_event, args) => {
	try {
		checkAuth$10();
		const user = getCurrentUser();
		const db = getDb();
		const status = args?.status;
		const conditions = [];
		const params = [];
		if (user.role !== "admin") {
			conditions.push("requested_by = ?");
			params.push(user.id);
		}
		if (status) {
			conditions.push("status = ?");
			params.push(status);
		}
		if (args?.child_id) {
			conditions.push("child_id = ?");
			params.push(args.child_id);
		}
		if (args?.teacher_id) {
			conditions.push("teacher_id = ?");
			params.push(args.teacher_id);
		}
		const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		return db.prepare(`SELECT * FROM attendance_edit_requests ${where} ORDER BY requested_at DESC`).all(...params);
	} catch (error) {
		throw new Error(error.message || "Failed to list edit requests");
	}
});
ipcMain.handle("attendance:decideEditRequest", async (_event, args) => {
	try {
		requireAdmin();
		const admin = getCurrentUser();
		const db = getDb();
		const { id, decision, decision_notes = null } = args;
		if (decision !== "approve" && decision !== "reject") throw new Error(`Invalid decision: ${decision}`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		let result = null;
		db.transaction(() => {
			const request = db.prepare("SELECT * FROM attendance_edit_requests WHERE id = ?").get(id);
			if (!request) throw new Error("Edit request not found");
			if (request.status !== "pending") throw new Error("This request has already been decided");
			if (decision === "reject") {
				const upd = db.prepare(`UPDATE attendance_edit_requests SET status = 'rejected', decided_by = ?, decided_at = ?, decision_notes = ? WHERE id = ? AND status = 'pending'`).run(admin.id, now, decision_notes, id);
				if (Number(upd.changes) === 0) throw new Error("This request has already been decided");
			} else {
				const upd = db.prepare(`UPDATE attendance_edit_requests SET status = 'approved', decided_by = ?, decided_at = ?, decision_notes = ? WHERE id = ? AND status = 'pending'`).run(admin.id, now, decision_notes, id);
				if (Number(upd.changes) === 0) throw new Error("This request has already been decided");
				const record = db.prepare("SELECT * FROM attendance_records WHERE id = ?").get(request.attendance_record_id);
				if (!record) throw new Error("Attendance record no longer exists — cannot apply approved changes");
				if (request.requested_status === "deleted") {
					const tp = db.prepare("SELECT id, status FROM teacher_payments WHERE attendance_record_id = ?").get(record.id);
					if (tp && tp.status === "paid") throw new Error("Cannot delete this attendance record because the teacher payment has already been paid out.");
					if (tp) db.prepare("DELETE FROM teacher_payments WHERE id = ?").run(tp.id);
					writeAuditLog(db, {
						attendance_record_id: record.id,
						edit_request_id: request.id,
						old_status: request.original_status,
						old_excuse_notes: request.original_excuse_notes,
						old_teacher_status: request.original_teacher_status,
						new_status: request.requested_status,
						new_excuse_notes: request.requested_excuse_notes,
						new_teacher_status: request.requested_teacher_status,
						changed_by: request.requested_by,
						approved_by: admin.id,
						reason: request.reason,
						changed_at: now
					});
					db.prepare("DELETE FROM attendance_records WHERE id = ?").run(record.id);
				} else {
					db.prepare(`
            UPDATE attendance_records
            SET status = ?, excuse_notes = ?, teacher_status = ?, updated_at = ?, synced = 0
            WHERE id = ?
          `).run(request.requested_status, request.requested_excuse_notes, request.requested_teacher_status, now, record.id);
					writeAuditLog(db, {
						attendance_record_id: record.id,
						edit_request_id: request.id,
						old_status: request.original_status,
						old_excuse_notes: request.original_excuse_notes,
						old_teacher_status: request.original_teacher_status,
						new_status: request.requested_status,
						new_excuse_notes: request.requested_excuse_notes,
						new_teacher_status: request.requested_teacher_status,
						changed_by: request.requested_by,
						approved_by: admin.id,
						reason: request.reason,
						changed_at: now
					});
					if (record.attended_teacher_id && request.attendance_date) recalculateAttendancePayment(db, {
						teacher_id: record.attended_teacher_id,
						child_id: record.child_id,
						attendance_record_id: record.id,
						attendance_date: request.attendance_date,
						status: request.requested_status,
						teacher_status: request.requested_teacher_status,
						now
					});
				}
			}
			insertNotification(db, {
				user_id: request.requested_by,
				type: decision === "approve" ? "edit_request_approved" : "edit_request_rejected",
				related_id: request.id,
				message_ar: decision === "approve" ? "تمت الموافقة على طلب تعديل الحضور الخاص بك" : "تم رفض طلب تعديل الحضور الخاص بك",
				message_en: decision === "approve" ? "Your attendance edit request was approved" : "Your attendance edit request was rejected"
			});
			result = db.prepare("SELECT * FROM attendance_edit_requests WHERE id = ?").get(id);
		})();
		return result;
	} catch (error) {
		throw new Error(error.message || "Failed to decide edit request");
	}
});
ipcMain.handle("attendance:getAuditLog", async (_event, { attendance_record_id }) => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT * FROM attendance_audit_log WHERE attendance_record_id = ? ORDER BY changed_at ASC").all(attendance_record_id);
	} catch (error) {
		throw new Error(error.message || "Failed to get audit log");
	}
});
//#endregion
//#region electron/ipc/salariesIPC.ts
var ARABIC_MONTHS = {
	"يناير": 1,
	"فبراير": 2,
	"مارس": 3,
	"أبريل": 4,
	"مايو": 5,
	"يونيو": 6,
	"يوليو": 7,
	"أغسطس": 8,
	"سبتمبر": 9,
	"أكتوبر": 10,
	"نوفمبر": 11,
	"ديسمبر": 12
};
function monthBounds$1(month, year) {
	const n = ARABIC_MONTHS[month] ?? (Number(month) || 1);
	const mm = String(n).padStart(2, "0");
	return {
		start: `${year}-${mm}-01`,
		end: `${year}-${mm}-31`
	};
}
/**
* Sums this employee's attendance-based teacher_payments for a month (feature 006), excluding
* Void rows. This is the authoritative per-session earnings source for any employee who has
* their own `teacher_session_rate` configured — it reflects their REAL rate and REAL attendance,
* not the older session_teachers/salary_types estimate (which used a shared, role-level rate and
* a cruder "was any child payable in this session" count).
*/
function getTeacherPaymentsForMonth(db, employeeId, start, end) {
	const row = db.prepare(`
    SELECT COUNT(*) as cnt, COALESCE(SUM(session_cost), 0) as total
    FROM teacher_payments
    WHERE teacher_id = ? AND status IN ('pending','paid') AND attendance_date >= ? AND attendance_date <= ?
  `).get(employeeId, start, end);
	return {
		count: row.cnt,
		total: row.total
	};
}
/**
* Computes an employee's base monthly pay for a period from their effective salary type.
* For per-session/hybrid types this reflects how many sessions were actually payable
* (a session is payable when a child attended or was absent without excuse). Shared by
* salary:get and salary:update so a saved payroll row never disagrees with the live view.
*
* If the employee has their own `teacher_session_rate` configured (feature 006), their
* per-session earnings come from the teacher_payments ledger instead of the salary-type
* estimate — that ledger is what attendance actually generated, at their real rate.
*/
function computeBaseSalary(db, employeeId, month, year) {
	resnapshotPendingTeacherPayments(db, employeeId);
	const row = db.prepare(`
    SELECT e.net_salary, e.teacher_session_rate, COALESCE(e.salary_type_override_id, er.salary_type_id) as eff
    FROM employees e LEFT JOIN employee_roles er ON e.role_id = er.id WHERE e.id = ?
  `).get(employeeId);
	const netSalary = row?.net_salary ?? 0;
	let base = netSalary;
	let payableSessions = 0;
	let totalSessions = 0;
	let salaryTypeName = null;
	let salaryTypeMode = null;
	const { start, end } = monthBounds$1(month, year);
	const hasOwnTeacherRate = row?.teacher_session_rate != null;
	const teacherPayments = hasOwnTeacherRate ? getTeacherPaymentsForMonth(db, employeeId, start, end) : null;
	if (row?.eff) {
		const st = db.prepare("SELECT * FROM salary_types WHERE id = ?").get(row.eff);
		if (st) {
			salaryTypeName = st.name;
			salaryTypeMode = st.mode;
			if (st.mode === "per_child_session" || st.mode === "per_session_pct") {
				const tp = hasOwnTeacherRate ? teacherPayments : getTeacherPaymentsForMonth(db, employeeId, start, end);
				payableSessions = tp.count;
				totalSessions = tp.count;
				base = tp.total;
			} else if (hasOwnTeacherRate && (st.mode === "per_session_fixed" || st.mode === "hybrid")) {
				payableSessions = teacherPayments.count;
				totalSessions = teacherPayments.count;
				base = st.mode === "hybrid" ? (st.monthly_rate ?? 0) + teacherPayments.total : teacherPayments.total;
			} else {
				const sessionIds = db.prepare(`
          SELECT ss.id FROM scheduled_sessions ss
          JOIN session_teachers stc ON stc.session_id = ss.id
          WHERE stc.employee_id = ? AND ss.session_date >= ? AND ss.session_date <= ?
        `).all(employeeId, start, end).map((s) => s.id);
				totalSessions = sessionIds.length;
				if (sessionIds.length > 0) {
					const ph = sessionIds.map(() => "?").join(",");
					payableSessions = db.prepare(`
            SELECT COUNT(DISTINCT session_id) as cnt FROM attendance_records
            WHERE session_id IN (${ph}) AND status IN ('attended','absent_unexcused')
          `).get(...sessionIds).cnt;
				}
				if (st.mode === "fixed_monthly") base = st.monthly_rate ?? netSalary;
				else if (st.mode === "per_session_fixed") base = payableSessions * (st.session_rate ?? 0);
				else if (st.mode === "hybrid") base = (st.monthly_rate ?? 0) + payableSessions * (st.session_rate ?? 0);
			}
		}
	} else if (hasOwnTeacherRate) {
		payableSessions = teacherPayments.count;
		totalSessions = teacherPayments.count;
		base = teacherPayments.total;
	}
	return {
		base,
		payableSessions,
		totalSessions,
		salaryTypeName,
		salaryTypeMode
	};
}
ipcMain.handle("employees:get", async () => {
	try {
		requireAdmin();
		return getDb().prepare(`
      SELECT e.*, er.name as role_name, er.salary_type_id as role_salary_type_id
      FROM employees e
      LEFT JOIN employee_roles er ON e.role_id = er.id
      ORDER BY e.name ASC
    `).all();
	} catch (error) {
		console.error("Failed to get employees:", error);
		throw new Error(error.message || "Failed to get employees");
	}
});
ipcMain.handle("employees:add", async (_event, employeeInput) => {
	try {
		requireAdmin();
		const db = getDb();
		const { name, role_id, base_salary = 0, housing = 0, transport = 0, salary_type_override_id = null, teacher_session_rate = null } = employeeInput;
		if (!name) throw new Error("جميع الحقول الإلزامية مطلوبة / Missing required fields");
		let roleText = employeeInput.role ?? "";
		if (role_id) {
			const roleRow = db.prepare("SELECT name FROM employee_roles WHERE id = ?").get(role_id);
			if (!roleRow) throw new Error("الدور غير موجود / Role not found");
			roleText = roleRow.name;
		}
		const netSalary = Number(base_salary) + Number(housing) + Number(transport);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO employees (name, role, role_id, salary_type_override_id, base_salary, housing, transport, net_salary, is_active, created_at, updated_at, synced, teacher_session_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, ?)
    `).run(name, roleText, role_id ?? null, salary_type_override_id, Number(base_salary), Number(housing), Number(transport), netSalary, now, now, teacher_session_rate !== null ? Number(teacher_session_rate) : null);
		const createdId = Number(result.lastInsertRowid);
		return db.prepare(`
      SELECT e.*, er.name as role_name FROM employees e LEFT JOIN employee_roles er ON e.role_id = er.id WHERE e.id = ?
    `).get(createdId);
	} catch (error) {
		console.error("Failed to add employee:", error);
		throw new Error(error.message || "Failed to add employee");
	}
});
ipcMain.handle("employees:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!id || !patch) throw new Error("Employee ID and patch are required");
		const emp = db.prepare("SELECT * FROM employees WHERE id = ?").get(id);
		if (!emp) throw new Error("الموظف غير موجود / Employee not found");
		const name = patch.name !== void 0 ? patch.name : emp.name;
		let role = patch.role !== void 0 ? patch.role : emp.role;
		let role_id = patch.role_id !== void 0 ? patch.role_id : emp.role_id;
		const salary_type_override_id = patch.salary_type_override_id !== void 0 ? patch.salary_type_override_id : emp.salary_type_override_id;
		const base_salary = patch.base_salary !== void 0 ? Number(patch.base_salary) : emp.base_salary;
		const housing = patch.housing !== void 0 ? Number(patch.housing) : emp.housing;
		const transport = patch.transport !== void 0 ? Number(patch.transport) : emp.transport;
		const teacher_session_rate = patch.teacher_session_rate !== void 0 ? patch.teacher_session_rate === null ? null : Number(patch.teacher_session_rate) : emp.teacher_session_rate;
		if (patch.role_id !== void 0 && patch.role_id !== null) {
			const roleRow = db.prepare("SELECT name FROM employee_roles WHERE id = ?").get(patch.role_id);
			if (!roleRow) throw new Error("الدور غير موجود / Role not found");
			role = roleRow.name;
			role_id = patch.role_id;
		}
		const netSalary = base_salary + housing + transport;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      UPDATE employees
      SET name = ?, role = ?, role_id = ?, salary_type_override_id = ?, base_salary = ?, housing = ?, transport = ?, net_salary = ?, updated_at = ?, synced = 0, teacher_session_rate = ?
      WHERE id = ?
    `).run(name, role, role_id, salary_type_override_id, base_salary, housing, transport, netSalary, now, teacher_session_rate, id);
		if (patch.teacher_session_rate !== void 0 && teacher_session_rate !== emp.teacher_session_rate || patch.salary_type_override_id !== void 0 && salary_type_override_id !== emp.salary_type_override_id || patch.role_id !== void 0 && role_id !== emp.role_id) resnapshotPendingTeacherPayments(db, id);
		return db.prepare(`
      SELECT e.*, er.name as role_name FROM employees e LEFT JOIN employee_roles er ON e.role_id = er.id WHERE e.id = ?
    `).get(id);
	} catch (error) {
		console.error("Failed to update employee:", error);
		throw new Error(error.message || "Failed to update employee");
	}
});
ipcMain.handle("employees:deactivate", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!db.prepare("SELECT id FROM employees WHERE id = ?").get(id)) throw new Error("الموظف غير موجود / Employee not found");
		db.prepare("UPDATE employees SET is_active = 0, updated_at = ?, synced = 0 WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), id);
		return { ok: true };
	} catch (error) {
		console.error("Failed to deactivate employee:", error);
		throw new Error(error.message || "Failed to deactivate employee");
	}
});
ipcMain.handle("salary:get", async (_event, { month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		return db.prepare(`
      SELECT
        COALESCE(s.id, -e.id) as id,
        e.id as employee_id,
        e.name as employee_name,
        e.role as employee_role,
        e.role_id,
        e.salary_type_override_id,
        e.net_salary as net_salary,
        COALESCE(s.month, ?) as month,
        COALESCE(s.year, ?) as year,
        COALESCE(s.bonus, 0) as bonus,
        COALESCE(s.deductions, 0) as deductions,
        s.actual_paid as stored_actual_paid,
        s.paid_date,
        s.paid_date as pay_date,
        s.notes,
        er.salary_type_id as role_salary_type_id,
        COALESCE(e.salary_type_override_id, er.salary_type_id) as effective_salary_type_id
      FROM employees e
      LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
      LEFT JOIN employee_roles er ON e.role_id = er.id
      WHERE e.is_active = 1 OR s.id IS NOT NULL
      ORDER BY e.name ASC
    `).all(month, year, month, year).map((row) => {
			const { base: computedActualPaid, payableSessions, totalSessions, salaryTypeName, salaryTypeMode } = computeBaseSalary(db, row.employee_id, month, year);
			row.payable_sessions = payableSessions;
			row.total_sessions = totalSessions;
			const bonus = row.bonus ?? 0;
			const deductionSum = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?").get(row.employee_id, month, Number(year))?.total ?? 0;
			return {
				...row,
				salary_type_name: salaryTypeName,
				salary_type_mode: salaryTypeMode,
				net_salary: computedActualPaid,
				deductions: deductionSum,
				actual_paid: row.stored_actual_paid ?? computedActualPaid + bonus - deductionSum
			};
		});
	} catch (error) {
		console.error("Failed to get salary payments:", error);
		throw new Error(error.message || "Failed to get salary payments");
	}
});
ipcMain.handle("salary:update", async (_event, { employee_id, month, year, bonus = 0, deductions = 0, paid_date = null, notes = null, override_amount = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!employee_id || !month || !year) throw new Error("Employee ID, month, and year are required");
		if (!db.prepare("SELECT net_salary FROM employees WHERE id = ?").get(employee_id)) throw new Error("الموظف غير موجود / Employee not found");
		const tableDeductionRow = db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as cnt FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?").get(employee_id, month, Number(year));
		const deductionSum = tableDeductionRow?.cnt > 0 ? tableDeductionRow?.total ?? 0 : Number(deductions);
		const { base } = computeBaseSalary(db, employee_id, month, year);
		const actualPaid = override_amount !== null ? Number(override_amount) : base + Number(bonus) - deductionSum;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      INSERT INTO salary_payments (employee_id, month, year, bonus, deductions, actual_paid, paid_date, notes, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(employee_id, month, year) DO UPDATE SET
        bonus = excluded.bonus,
        deductions = excluded.deductions,
        actual_paid = excluded.actual_paid,
        paid_date = excluded.paid_date,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        synced = 0
    `).run(employee_id, month, Number(year), Number(bonus), deductionSum, actualPaid, paid_date, notes, now);
		return db.prepare(`
      SELECT s.*, s.paid_date as pay_date, e.name as employee_name, e.role as employee_role
      FROM salary_payments s
      JOIN employees e ON s.employee_id = e.id
      WHERE s.employee_id = ? AND s.month = ? AND s.year = ?
    `).get(employee_id, month, year);
	} catch (error) {
		console.error("Failed to update salary payment:", error);
		throw new Error(error.message || "Failed to update salary payment");
	}
});
ipcMain.handle("salary:getExpected", async (_event, { employee_id, month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!employee_id || !month || !year) throw new Error("Employee ID, month, and year are required");
		const { start } = monthBounds$1(month, year);
		const { base: actualToDate, salaryTypeMode } = computeBaseSalary(db, employee_id, month, year);
		const emp = db.prepare("SELECT teacher_session_rate FROM employees WHERE id = ?").get(employee_id);
		const projectable = salaryTypeMode === null || [
			"per_session_fixed",
			"hybrid",
			"per_child_session",
			"per_session_pct"
		].includes(salaryTypeMode ?? "");
		let projectedRemaining = 0;
		if (projectable) {
			const st = db.prepare(`
        SELECT st.session_rate as session_rate, st.monthly_rate as monthly_rate, st.session_pct as session_pct
        FROM employees e
        LEFT JOIN employee_roles er ON e.role_id = er.id
        LEFT JOIN salary_types st ON st.id = COALESCE(e.salary_type_override_id, er.salary_type_id)
        WHERE e.id = ?
      `).get(employee_id);
			const salaryTypeSessionRate = st?.session_rate ?? null;
			const assignedChildren = db.prepare(`
        SELECT lesson_days, teacher_session_rate, price FROM child_services WHERE teacher_id = ?
      `).all(employee_id);
			const startDate = new Date(start);
			const y = startDate.getFullYear();
			const m = startDate.getMonth();
			const daysInMonth = new Date(y, m + 1, 0).getDate();
			const today = /* @__PURE__ */ new Date();
			const startDay = m === today.getMonth() && y === today.getFullYear() ? today.getDate() : 1;
			let scheduleTotal = 0;
			for (const row of assignedChildren) {
				let days = [];
				if (row.lesson_days) try {
					days = JSON.parse(row.lesson_days);
				} catch {
					days = [];
				}
				if (days.length === 0) continue;
				const rate = row.teacher_session_rate ?? (salaryTypeMode === "per_child_session" ? salaryTypeSessionRate : salaryTypeMode === "per_session_pct" ? row.price != null && st?.session_pct != null ? Number((row.price * st.session_pct).toFixed(2)) : null : emp?.teacher_session_rate ?? salaryTypeSessionRate);
				if (!rate) continue;
				let sessionCount = 0;
				for (let d = startDay; d <= daysInMonth; d++) if (days.includes(new Date(y, m, d).getDay())) sessionCount++;
				scheduleTotal += sessionCount * rate;
			}
			projectedRemaining = scheduleTotal;
		}
		const expectedTotal = actualToDate + projectedRemaining;
		return {
			actual_to_date: actualToDate,
			projected_remaining: Number(projectedRemaining.toFixed(2)),
			expected_total: Number(expectedTotal.toFixed(2)),
			salary_type_mode: salaryTypeMode
		};
	} catch (error) {
		console.error("Failed to compute expected salary:", error);
		throw new Error(error.message || "Failed to compute expected salary");
	}
});
//#endregion
//#region electron/ipc/expensesIPC.ts
var arabicMonths$6 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
/**
* expenses:get
* Returns all expense rows for a given year (12 months × all distinct items).
* Items with no recorded amount appear with amount=0.
* Admin only.
*/
ipcMain.handle("expenses:get", async (_event, { year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!year) throw new Error("Year is required");
		const itemNames = db.prepare("SELECT DISTINCT item FROM expenses ORDER BY item ASC").all().map((r) => r.item);
		if (itemNames.length === 0) return [];
		const rows = db.prepare("SELECT * FROM expenses WHERE year = ? ORDER BY item ASC").all(year);
		const result = [];
		for (const item of itemNames) {
			const category = db.prepare("SELECT category FROM expenses WHERE item = ? AND category IS NOT NULL LIMIT 1").get(item)?.category ?? null;
			for (const month of arabicMonths$6) {
				const found = rows.find((r) => r.item === item && r.month === month);
				if (found) result.push(found);
				else result.push({
					id: 0,
					item,
					month,
					year: Number(year),
					amount: 0,
					category,
					notes: null,
					created_at: "",
					synced: 0
				});
			}
		}
		return result;
	} catch (error) {
		console.error("Failed to get expenses:", error);
		throw new Error(error.message || "Failed to get expenses");
	}
});
/**
* expenses:update
* Upsert a single expense row for (item, month, year).
* Admin only.
*/
ipcMain.handle("expenses:update", async (_event, { item, month, year, amount, category = null, notes = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!item || !month || !year) throw new Error("Item, month, and year are required");
		const amountNum = Number(amount);
		if (isNaN(amountNum) || amountNum < 0) throw new Error("Invalid amount value");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      INSERT INTO expenses (item, month, year, amount, category, notes, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
      ON CONFLICT(item, month, year) DO UPDATE SET
        amount = excluded.amount,
        category = excluded.category,
        notes = excluded.notes,
        updated_at = excluded.updated_at,
        synced = 0
    `).run(item, month, Number(year), amountNum, category, notes, now, now);
		return db.prepare("SELECT * FROM expenses WHERE item = ? AND month = ? AND year = ?").get(item, month, Number(year));
	} catch (error) {
		console.error("Failed to update expense:", error);
		throw new Error(error.message || "Failed to update expense");
	}
});
/**
* expenses:addItem
* Registers a new expense item name so it shows in the 12-month grid.
* Creates a placeholder row for the current year/current month (amount=0).
* Admin only.
*/
ipcMain.handle("expenses:addItem", async (_event, { item, category = null }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!item || !item.trim()) throw new Error("Item name is required");
		const itemName = item.trim();
		if (db.prepare("SELECT id FROM expenses WHERE item = ?").get(itemName)) throw new Error(`بند "${itemName}" موجود مسبقاً / Item "${itemName}" already exists`);
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const year = (/* @__PURE__ */ new Date()).getFullYear();
		db.transaction(() => {
			for (const month of arabicMonths$6) db.prepare(`
          INSERT OR IGNORE INTO expenses (item, month, year, amount, category, notes, created_at, updated_at, synced)
          VALUES (?, ?, ?, 0, ?, NULL, ?, ?, 0)
        `).run(itemName, month, year, category, now, now);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to add expense item:", error);
		throw new Error(error.message || "Failed to add expense item");
	}
});
/**
* expenses:removeItem
* Removes all expense rows for a given item name (all months/years).
* Admin only.
*/
ipcMain.handle("expenses:removeItem", async (_event, { item }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!item || !item.trim()) throw new Error("Item name is required");
		db.prepare("DELETE FROM expenses WHERE item = ?").run(item.trim());
		return { ok: true };
	} catch (error) {
		console.error("Failed to remove expense item:", error);
		throw new Error(error.message || "Failed to remove expense item");
	}
});
//#endregion
//#region electron/ipc/targetIPC.ts
var arabicMonths$5 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
function calcRequiredRevenue(totalExpenses, targetProfitPct) {
	if (targetProfitPct >= 1 || targetProfitPct < 0) return totalExpenses;
	return Number((totalExpenses / (1 - targetProfitPct)).toFixed(2));
}
function calcGap(requiredRevenue, collected) {
	return Number(Math.max(0, requiredRevenue - collected).toFixed(2));
}
function calcCoveragePct(collected, requiredRevenue) {
	if (requiredRevenue <= 0) return 1;
	return Number(Math.min(1, collected / requiredRevenue).toFixed(4));
}
function getServicePricing(db) {
	const defs = db.prepare("SELECT name, price_monthly, price_hourly FROM service_definitions").all();
	const pricing = {};
	for (const d of defs) pricing[d.name] = Number((d.name === "جلسة" || d.name === "جلسه" ? d.price_hourly : d.price_monthly) ?? 0);
	return pricing;
}
/**
* target:get { year }
* Returns a per-month array of target data for a given year:
* - month, expenses, salaries, totalExpenses
* - targetRequired (revenue needed to hit profit target)
* - collected (amount actually collected)
* - gap
* - coveragePct
* - status: 'met' | 'missed'
*
* Admin only.
*/
ipcMain.handle("target:get", async (_event, { year }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!year) throw new Error("Year is required");
		const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
		const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : .2;
		const result = [];
		for (const month of arabicMonths$5) {
			const payments = db.prepare("SELECT paid FROM payments WHERE month = ? AND year = ?").all(month, year);
			const expenses = db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(month, year);
			const salaries = db.prepare("SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?").all(month, year);
			const collected = payments.reduce((s, p) => s + p.paid, 0);
			const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0);
			const salariesTotal = salaries.reduce((s, s2) => s + s2.actual_paid, 0);
			const totalExpenses = expensesTotal + salariesTotal;
			const targetRequired = calcRequiredRevenue(totalExpenses, targetProfitPct);
			const gap = calcGap(targetRequired, collected);
			const coveragePct = calcCoveragePct(collected, targetRequired);
			result.push({
				month,
				collected: Number(collected.toFixed(2)),
				expenses: Number(expensesTotal.toFixed(2)),
				salaries: Number(salariesTotal.toFixed(2)),
				totalExpenses: Number(totalExpenses.toFixed(2)),
				targetRequired,
				gap,
				coveragePct,
				status: gap === 0 ? "met" : "missed"
			});
		}
		return {
			rows: result,
			targetProfitPct,
			annualCollected: Number(result.reduce((s, r) => s + r.collected, 0).toFixed(2)),
			annualExpenses: Number(result.reduce((s, r) => s + r.totalExpenses, 0).toFixed(2)),
			annualTargetRequired: Number(result.reduce((s, r) => s + r.targetRequired, 0).toFixed(2)),
			annualGap: Number(result.reduce((s, r) => s + r.gap, 0).toFixed(2))
		};
	} catch (error) {
		console.error("Failed to get target data:", error);
		throw new Error(error.message || "Failed to get target data");
	}
});
/**
* target:capacity-plan { numClasses, classCapacity, numStaff, desiredRevenue }
* Given the physical constraints of the centre, returns:
*  - totalCapacity (numClasses × classCapacity)
*  - For each service: minimum children needed to reach desiredRevenue alone,
*    and whether that fits within capacity.
*  - A balanced recommended mix (50 % nursery, 30 % hosting, 20 % sessions).
*  - Per-staff and per-class revenue metrics.
* Admin only.
*/
ipcMain.handle("target:capacity-plan", (_event, { numClasses, classCapacity, numStaff, desiredRevenue }) => {
	try {
		requireAdmin();
		const db = getDb();
		const nc = Math.max(0, Number(numClasses || 0));
		const cc = Math.max(0, Number(classCapacity || 0));
		const ns = Math.max(0, Number(numStaff || 0));
		const dr = Math.max(0, Number(desiredRevenue || 0));
		const totalCapacity = nc * cc;
		const pricing = getServicePricing(db);
		const scenarios = {};
		for (const [service, price] of Object.entries(pricing)) {
			const childrenNeeded = price > 0 ? Math.ceil(dr / price) : 0;
			scenarios[service] = {
				childrenNeeded,
				feasible: totalCapacity > 0 && childrenNeeded <= totalCapacity,
				maxRevenue: Number((totalCapacity * price).toFixed(2)),
				utilization: totalCapacity > 0 ? Number(Math.min(1, childrenNeeded / totalCapacity).toFixed(4)) : 0
			};
		}
		const nurserySlots = Math.floor(totalCapacity * .5);
		const hostingSlots = Math.floor(totalCapacity * .3);
		const recommendedMix = {
			حضانة: nurserySlots,
			استضافة: hostingSlots,
			جلسة: Math.max(0, totalCapacity - nurserySlots - hostingSlots)
		};
		const recommendedRevenue = Number(Object.entries(recommendedMix).reduce((s, [svc, count]) => s + count * (pricing[svc] ?? 0), 0).toFixed(2));
		return {
			totalCapacity,
			desiredRevenue: dr,
			pricing,
			scenarios,
			recommendedMix,
			recommendedRevenue,
			metrics: {
				revenuePerClass: nc > 0 ? Number((dr / nc).toFixed(2)) : 0,
				revenuePerStaff: ns > 0 ? Number((dr / ns).toFixed(2)) : 0,
				childrenPerStaff: ns > 0 ? Number((totalCapacity / ns).toFixed(2)) : 0,
				revenueGap: Number(Math.max(0, dr - recommendedRevenue).toFixed(2))
			}
		};
	} catch (error) {
		throw new Error(error.message || "Failed to calculate capacity plan");
	}
});
/**
* target:calc { distribution }
* Computes projected revenue and coverage for a custom service distribution.
* distribution: { حضانة?: number, استضافة?: number, جلسة?: number }
* Admin only.
*/
ipcMain.handle("target:calc", async (_event, { distribution, month, year, targetProfitPct: overridePct }) => {
	try {
		requireAdmin();
		const db = getDb();
		const pricing = getServicePricing(db);
		let projectedRevenue = 0;
		const unitsNeeded = {};
		for (const [service, count] of Object.entries(distribution)) {
			const price = pricing[service] ?? 0;
			projectedRevenue += count * price;
		}
		projectedRevenue = Number(projectedRevenue.toFixed(2));
		let targetRequired = 0;
		if (month && year) {
			const expenses = db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(month, year);
			const salaries = db.prepare("SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?").all(month, year);
			const totalExp = expenses.reduce((s, e) => s + e.amount, 0) + salaries.reduce((s, s2) => s + s2.actual_paid, 0);
			let targetProfitPct;
			if (overridePct !== void 0 && overridePct !== null && overridePct !== "") targetProfitPct = Number(overridePct);
			else {
				const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
				targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : .2;
			}
			targetRequired = calcRequiredRevenue(totalExp, targetProfitPct);
		}
		const coveragePct = targetRequired > 0 ? Number(Math.min(1, projectedRevenue / targetRequired).toFixed(4)) : 0;
		const services = Object.keys(pricing);
		for (const service of services) {
			const price = pricing[service];
			if (price > 0 && targetRequired > 0) unitsNeeded[service] = Math.ceil(targetRequired / (services.length * price));
			else unitsNeeded[service] = 0;
		}
		return {
			projectedRevenue,
			targetRequired,
			coveragePct,
			unitsNeeded,
			pricing
		};
	} catch (error) {
		console.error("Failed to calc target:", error);
		throw new Error(error.message || "Failed to calculate target");
	}
});
//#endregion
//#region electron/ipc/settingsIPC.ts
ipcMain.handle("settings:get", () => {
	try {
		const rows = getDb().prepare("SELECT key, value FROM settings").all();
		const settingsRecord = {};
		for (const row of rows) settingsRecord[row.key] = row.value;
		return settingsRecord;
	} catch (error) {
		console.error("Failed to get settings:", error);
		throw new Error(error.message || "Failed to retrieve settings");
	}
});
ipcMain.handle("settings:update", (_event, settings) => {
	try {
		requireAdmin();
		const db = getDb();
		const updateStmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at, synced)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `);
		db.transaction(() => {
			for (const [key, value] of Object.entries(settings)) updateStmt.run(key, value);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to update settings:", error);
		throw new Error(error.message || "Failed to update settings");
	}
});
//#endregion
//#region electron/ipc/brandingIPC.ts
function getBrandingSettings(db) {
	const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'brand_%'").all();
	const record = {};
	for (const row of rows) record[row.key] = row.value;
	return record;
}
ipcMain.handle("branding:get", () => {
	try {
		return getBrandingSettings(getDb());
	} catch (error) {
		console.error("Failed to get branding settings:", error);
		throw new Error(error.message || "Failed to retrieve branding settings");
	}
});
ipcMain.handle("branding:save", (_event, brandingData) => {
	try {
		requireAdmin();
		const db = getDb();
		const updateStmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at, synced)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `);
		db.transaction(() => {
			for (const [key, value] of Object.entries(brandingData)) if (key.startsWith("brand_")) updateStmt.run(key, value);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to save branding:", error);
		throw new Error(error.message || "Failed to save branding");
	}
});
ipcMain.handle("branding:upload-logo", async () => {
	try {
		requireAdmin();
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [{
				name: "Images",
				extensions: [
					"png",
					"jpg",
					"jpeg",
					"svg"
				]
			}]
		});
		if (result.canceled || result.filePaths.length === 0) return null;
		const srcPath = result.filePaths[0];
		const ext = path.extname(srcPath);
		const destName = `logo_${Date.now()}${ext}`;
		const brandingDir = path.join(app.getPath("userData"), "branding");
		if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
		const destPath = path.join(brandingDir, destName);
		fs.copyFileSync(srcPath, destPath);
		return { path: `branding/${destName}` };
	} catch (error) {
		console.error("Failed to upload logo:", error);
		throw new Error(error.message || "Failed to upload logo");
	}
});
ipcMain.handle("branding:upload-icon", async () => {
	try {
		requireAdmin();
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [{
				name: "Icons",
				extensions: [
					"ico",
					"png",
					"icns"
				]
			}]
		});
		if (result.canceled || result.filePaths.length === 0) return null;
		const srcPath = result.filePaths[0];
		const ext = path.extname(srcPath);
		const destName = `icon_${Date.now()}${ext}`;
		const brandingDir = path.join(app.getPath("userData"), "branding");
		if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
		const destPath = path.join(brandingDir, destName);
		fs.copyFileSync(srcPath, destPath);
		return { path: `branding/${destName}` };
	} catch (error) {
		console.error("Failed to upload icon:", error);
		throw new Error(error.message || "Failed to upload icon");
	}
});
ipcMain.handle("branding:reset", () => {
	try {
		requireAdmin();
		const db = getDb();
		const defaultBranding = {
			brand_app_name: "أكاديمية مهند الليثي",
			brand_org_name: "مركز مهند الليثي للتوحد ونمو الطفل",
			brand_tagline: "رعاية متميزة وتنمية مهارات طفلك",
			brand_primary_color: "#0f766e",
			brand_accent_color: "#f59e0b",
			brand_phone: "+20 123 456 7890",
			brand_address: "القاهرة، مصر",
			brand_email: "info@zaineldeen.com",
			brand_show_logo_sidebar: "1",
			brand_show_logo_login: "1",
			brand_show_logo_export: "1",
			brand_logo_path: "",
			brand_icon_path: ""
		};
		const updateStmt = db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at, synced)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `);
		db.transaction(() => {
			for (const [key, value] of Object.entries(defaultBranding)) updateStmt.run(key, value);
		})();
		return { ok: true };
	} catch (error) {
		console.error("Failed to reset branding:", error);
		throw new Error(error.message || "Failed to reset branding");
	}
});
//#endregion
//#region electron/services/exportHeader.ts
function getExportHeader() {
	const rows = getDb().prepare("SELECT key, value FROM settings WHERE key LIKE 'brand_%'").all();
	const settings = {};
	for (const r of rows) settings[r.key] = r.value;
	const logoRelPath = settings["brand_logo_path"] || "branding/logo.png";
	const logoPath = path.isAbsolute(logoRelPath) ? logoRelPath : path.join(app.getPath("userData"), logoRelPath);
	return {
		appName: settings["brand_app_name"] || "أكاديمية مهند الليثي",
		orgName: settings["brand_org_name"] || "مركز مهند الليثي للتوحد ونمو الطفل",
		tagline: settings["brand_tagline"] || "رعاية متميزة وتنمية مهارات طفلك",
		phone: settings["brand_phone"] || "+20 123 456 7890",
		address: settings["brand_address"] || "القاهرة، مصر",
		email: settings["brand_email"] || "info@zaineldeen.com",
		logoPath: fs.existsSync(logoPath) ? logoPath : "",
		primaryColor: settings["brand_primary_color"] || "#0f766e",
		accentColor: settings["brand_accent_color"] || "#f59e0b",
		showLogo: settings["brand_show_logo_export"] !== "0"
	};
}
//#endregion
//#region electron/services/exportService.ts
var arabicMonths$4 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
var englishMonths$3 = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
var FONT_FAMILY = "Segoe UI";
var HEADER_FILL = {
	type: "pattern",
	pattern: "solid",
	fgColor: { argb: "FFE2E8F0" }
};
var SUBHEADER_FILL = {
	type: "pattern",
	pattern: "solid",
	fgColor: { argb: "FFF1F5F9" }
};
var BORDER_STYLE = {
	top: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	},
	left: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	},
	bottom: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	},
	right: {
		style: "thin",
		color: { argb: "FFCBD5E1" }
	}
};
function getStatusStyle(valStr) {
	const normalStatus = valStr.toLowerCase();
	if (normalStatus === "paid" || normalStatus === "نشط" || normalStatus === "active" || normalStatus === "met" || normalStatus === "target_met" || normalStatus === "مكتمل" || normalStatus === "ناجح") return {
		fill: {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFECFDF5" }
		},
		font: {
			name: FONT_FAMILY,
			color: { argb: "FF065F46" },
			bold: true
		}
	};
	if (normalStatus === "unpaid" || normalStatus === "غير نشط" || normalStatus === "inactive" || normalStatus === "missed" || normalStatus === "target_missed" || normalStatus === "عجز" || normalStatus === "غير مكتمل") return {
		fill: {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFFEF2F2" }
		},
		font: {
			name: FONT_FAMILY,
			color: { argb: "FF991B1B" },
			bold: true
		}
	};
	if (normalStatus === "partial" || normalStatus === "جزئي") return {
		fill: {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FFFDF6B2" }
		},
		font: {
			name: FONT_FAMILY,
			color: { argb: "FF723B10" },
			bold: true
		}
	};
	return null;
}
function writeBrandingHeader(worksheet, workbook, brand, lang, titleText) {
	worksheet.views = [{
		showGridLines: true,
		rightToLeft: lang === "ar"
	}];
	if (brand.showLogo && brand.logoPath && fs.existsSync(brand.logoPath)) try {
		const logoId = workbook.addImage({
			filename: brand.logoPath,
			extension: "png"
		});
		worksheet.addImage(logoId, {
			tl: {
				col: 0,
				row: 0
			},
			ext: {
				width: 90,
				height: 60
			}
		});
	} catch (e) {
		console.error("Failed to embed logo in Excel:", e);
	}
	const row1 = worksheet.getRow(1);
	row1.height = 30;
	const titleCell = worksheet.getCell(lang === "ar" ? "D1" : "B1");
	titleCell.value = brand.orgName;
	titleCell.font = {
		name: FONT_FAMILY,
		size: 16,
		bold: true,
		color: { argb: "FF0F766E" }
	};
	const row2 = worksheet.getRow(2);
	row2.height = 20;
	const taglineCell = worksheet.getCell(lang === "ar" ? "D2" : "B2");
	taglineCell.value = brand.tagline;
	taglineCell.font = {
		name: FONT_FAMILY,
		size: 10,
		italic: true,
		color: { argb: "FF64748B" }
	};
	const row3 = worksheet.getRow(3);
	row3.height = 18;
	const contactsCell = worksheet.getCell(lang === "ar" ? "D3" : "B3");
	contactsCell.value = `${lang === "ar" ? "هاتف:" : "Tel:"} ${brand.phone} | ${lang === "ar" ? "عنوان:" : "Addr:"} ${brand.address} | ${lang === "ar" ? "بريد:" : "Email:"} ${brand.email}`;
	contactsCell.font = {
		name: FONT_FAMILY,
		size: 9,
		color: { argb: "FF64748B" }
	};
	const row5 = worksheet.getRow(5);
	row5.height = 25;
	const docTitleCell = worksheet.getCell("A5");
	docTitleCell.value = titleText;
	docTitleCell.font = {
		name: FONT_FAMILY,
		size: 14,
		bold: true,
		color: { argb: "FF1E293B" }
	};
	return 6;
}
function autofitColumns(worksheet, minWidth = 12) {
	worksheet.columns.forEach((column) => {
		let maxLength = 0;
		column.eachCell?.({ includeEmpty: true }, (cell) => {
			if (cell.value) {
				const valStr = cell.value.toString();
				if (valStr.length > maxLength) maxLength = valStr.length;
			}
		});
		column.width = Math.max(minWidth, maxLength + 4);
	});
}
function formatGridData(worksheet, startRow, currencyCols = [], percentCols = [], statusColIdx = -1) {
	worksheet.eachRow((row, rowNumber) => {
		if (rowNumber < startRow) return;
		row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
			cell.font = cell.font || {
				name: FONT_FAMILY,
				size: 10
			};
			cell.border = BORDER_STYLE;
			if (currencyCols.includes(colNumber)) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
			if (percentCols.includes(colNumber)) {
				cell.numFmt = "0%";
				cell.alignment = { horizontal: "right" };
			}
		});
		if (statusColIdx > 0) {
			const statusCell = row.getCell(statusColIdx);
			if (statusCell && statusCell.value) {
				const style = getStatusStyle(statusCell.value.toString());
				if (style) {
					statusCell.fill = style.fill;
					statusCell.font = style.font;
				}
			}
		}
	});
}
function generateMonthSheet(worksheet, workbook, brand, month, year, lang, paymentIds) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `مطالبات شهر ${month} لسنة ${year}` : `Billing Sheet: ${month} ${year}`);
	const headers = lang === "ar" ? [
		"اسم الطفل 👶",
		"ولي الأمر 👤",
		"الهاتف 📞",
		"الخدمة ⚙️",
		"الوحدة 📦",
		"الكمية 🔢",
		"السعر 💰",
		"الإجمالي 💵",
		"المحصل ✅",
		"المتأخرات ⚠️",
		"الحالة 📊",
		"ملاحظات 📝"
	] : [
		"Child Name 👶",
		"Guardian 👤",
		"Phone 📞",
		"Service ⚙️",
		"Unit 📦",
		"Qty 🔢",
		"Price 💰",
		"Total 💵",
		"Paid ✅",
		"Arrears ⚠️",
		"Status 📊",
		"Notes 📝"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF1E293B" }
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const hasSelection = Array.isArray(paymentIds) && paymentIds.length > 0;
	const payments = db.prepare(`
    SELECT p.id, c.name as child_name, c.guardian, c.guardian_phone, p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.status, p.notes
    FROM payments p
    JOIN children c ON p.child_id = c.id
    WHERE p.month = ? AND p.year = ?
    ${hasSelection ? `AND p.id IN (${paymentIds.map(() => "?").join(",")})` : ""}
  `).all(month, year, ...hasSelection ? paymentIds : []);
	let currentRow = startRow + 1;
	for (const p of payments) {
		const rowValues = [
			p.child_name,
			p.guardian,
			p.guardian_phone,
			p.service,
			p.unit,
			p.quantity,
			p.price,
			p.total,
			p.paid,
			p.balance,
			p.status,
			p.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (payments.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		const labelCol = 1;
		totalRow.getCell(labelCol).value = lang === "ar" ? "إجمالي المحاسبة" : "Totals";
		totalRow.getCell(labelCol).font = {
			name: FONT_FAMILY,
			size: 11,
			bold: true
		};
		const totalFormulaCol = 8;
		const paidFormulaCol = 9;
		const balanceFormulaCol = 10;
		totalRow.getCell(totalFormulaCol).value = { formula: `SUM(H${startRow + 1}:H${currentRow - 1})` };
		totalRow.getCell(paidFormulaCol).value = { formula: `SUM(I${startRow + 1}:I${currentRow - 1})` };
		totalRow.getCell(balanceFormulaCol).value = { formula: `SUM(J${startRow + 1}:J${currentRow - 1})` };
		for (let c = 1; c <= 12; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if ([
				totalFormulaCol,
				paidFormulaCol,
				balanceFormulaCol
			].includes(c)) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, startRow + 1, [
		7,
		8,
		9,
		10
	], [], 11);
	autofitColumns(worksheet);
}
function generateChildrenSheet(worksheet, workbook, brand, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? "سجل بيانات الأطفال المسجلين" : "Children Roster");
	const headers = lang === "ar" ? [
		"اسم الطفل",
		"ولي الأمر",
		"هاتف ولي الأمر",
		"هاتف الطفل",
		"الرقم القومي",
		"الخدمة الأساسية",
		"الوحدة المحتسبة",
		"السعر المتفق عليه",
		"تاريخ التسجيل",
		"الحالة",
		"ملاحظات"
	] : [
		"Child Name",
		"Guardian",
		"Guardian Phone",
		"Child Phone",
		"National ID",
		"Default Service",
		"Billing Unit",
		"Agreed Price",
		"Reg Date",
		"Status",
		"Notes"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const children = db.prepare("SELECT name, guardian, guardian_phone, child_phone, national_id, service, unit, price, reg_date, is_active, notes FROM children").all();
	let currentRow = startRow + 1;
	for (const c of children) {
		const statusStr = c.is_active ? lang === "ar" ? "نشط" : "Active" : lang === "ar" ? "غير نشط" : "Inactive";
		const rowValues = [
			c.name,
			c.guardian,
			c.guardian_phone,
			c.child_phone || "",
			c.national_id || "",
			c.service,
			c.unit,
			c.price,
			c.reg_date,
			statusStr,
			c.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	formatGridData(worksheet, startRow + 1, [8], [], 10);
	autofitColumns(worksheet);
}
function generateSalariesSheet(worksheet, workbook, brand, month, year, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `رواتب ومكافآت الموظفين لشهر ${month} لسنة ${year}` : `Employee Payroll: ${month} ${year}`);
	const headers = lang === "ar" ? [
		"اسم الموظف",
		"الوظيفة / الصلاحية",
		"الراتب الأساسي",
		"بدل السكن",
		"بدل الانتقال",
		"صافي الراتب المستحق",
		"مكافآت الشهر",
		"خصومات الشهر",
		"المدفوع الفعلي",
		"تاريخ الصرف",
		"ملاحظات"
	] : [
		"Employee Name",
		"Role",
		"Base Salary",
		"Housing Allow",
		"Transport Allow",
		"Net Salary",
		"Bonuses",
		"Deductions",
		"Actual Paid",
		"Pay Date",
		"Notes"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const payroll = db.prepare(`
    SELECT e.name, e.role, e.base_salary, e.housing, e.transport, e.net_salary,
           s.bonus, s.deductions, s.actual_paid, s.paid_date as pay_date, s.notes
    FROM employees e
    LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
    WHERE e.is_active = 1 OR s.id IS NOT NULL
  `).all(month, year);
	let currentRow = startRow + 1;
	for (const p of payroll) {
		const bonus = p.bonus || 0;
		const deductions = p.deductions || 0;
		const actualPaid = p.actual_paid !== null && p.actual_paid !== void 0 ? p.actual_paid : p.net_salary || 0;
		const rowValues = [
			p.name,
			p.role === "admin" ? lang === "ar" ? "مسؤول" : "Admin" : lang === "ar" ? "موظف" : "Employee",
			p.base_salary,
			p.housing,
			p.transport,
			p.net_salary,
			bonus,
			deductions,
			actualPaid,
			p.pay_date || "",
			p.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (payroll.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي الرواتب والمنصرف" : "Total Payroll";
		totalRow.getCell(3).value = { formula: `SUM(C${startRow + 1}:C${currentRow - 1})` };
		totalRow.getCell(4).value = { formula: `SUM(D${startRow + 1}:D${currentRow - 1})` };
		totalRow.getCell(5).value = { formula: `SUM(E${startRow + 1}:E${currentRow - 1})` };
		totalRow.getCell(6).value = { formula: `SUM(F${startRow + 1}:F${currentRow - 1})` };
		totalRow.getCell(7).value = { formula: `SUM(G${startRow + 1}:G${currentRow - 1})` };
		totalRow.getCell(8).value = { formula: `SUM(H${startRow + 1}:H${currentRow - 1})` };
		totalRow.getCell(9).value = { formula: `SUM(I${startRow + 1}:I${currentRow - 1})` };
		for (let c = 1; c <= 11; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c >= 3 && c <= 9) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, startRow + 1, [
		3,
		4,
		5,
		6,
		7,
		8,
		9
	]);
	autofitColumns(worksheet);
}
function generatePayrollReportSheet(worksheet, workbook, brand, params, lang) {
	const db = getDb();
	const { month, year } = params;
	const monthLabel = lang === "ar" ? arabicMonths$4[month - 1] : englishMonths$3[month - 1];
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `تقرير رواتب المعلمين لشهر ${monthLabel} ${year}` : `Teacher Payroll Report: ${monthLabel} ${year}`);
	const headers = lang === "ar" ? [
		"اسم المعلم",
		"عدد الجلسات المدفوعة",
		"تكلفة الجلسة",
		"إجمالي الراتب"
	] : [
		"Teacher Name",
		"Sessions Paid",
		"Session Rate",
		"Total Salary"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const monthKey = `${year}-${String(month).padStart(2, "0")}`;
	const rows = db.prepare(`
    SELECT
      e.id as teacher_id,
      e.name as teacher_name,
      e.teacher_session_rate as session_cost,
      COUNT(tp.id) as sessions_paid,
      COALESCE(SUM(tp.session_cost), 0) as total_salary
    FROM employees e
    JOIN teacher_payments tp ON tp.teacher_id = e.id
      AND tp.status IN ('pending','paid')
      AND strftime('%Y-%m', tp.attendance_date) = ?
    GROUP BY e.id
    ORDER BY e.name ASC
  `).all(monthKey);
	let currentRow = startRow + 1;
	for (const r of rows) {
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = [
			r.teacher_name,
			r.sessions_paid,
			r.session_cost,
			r.total_salary
		];
		dataRow.height = 20;
		currentRow++;
	}
	if (rows.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي الرواتب" : "Total Payroll";
		totalRow.getCell(4).value = { formula: `SUM(D${startRow + 1}:D${currentRow - 1})` };
		for (let c = 1; c <= 4; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c === 3 || c === 4) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	} else {
		const emptyRow = worksheet.getRow(currentRow);
		emptyRow.getCell(1).value = lang === "ar" ? "لا توجد جلسات مدفوعة لهذا الشهر." : "No paid sessions for this month.";
		emptyRow.getCell(1).font = {
			name: FONT_FAMILY,
			size: 10,
			italic: true,
			color: { argb: "FF94A3B8" }
		};
	}
	formatGridData(worksheet, startRow + 1, [3, 4]);
	autofitColumns(worksheet);
}
function generateEmployeesSheet(worksheet, workbook, brand, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? "سجل الموظفين" : "Employees Roster");
	const headers = lang === "ar" ? [
		"اسم الموظف",
		"الوظيفة",
		"الراتب الأساسي",
		"بدل السكن",
		"بدل الانتقال",
		"صافي الراتب",
		"الحالة"
	] : [
		"Employee Name",
		"Role",
		"Base Salary",
		"Housing Allow",
		"Transport Allow",
		"Net Salary",
		"Status"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const employees = db.prepare(`
    SELECT name, role, base_salary, housing, transport, net_salary, is_active
    FROM employees
    ORDER BY is_active DESC, name ASC
  `).all();
	let currentRow = startRow + 1;
	for (const e of employees) {
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = [
			e.name,
			e.role,
			e.base_salary,
			e.housing,
			e.transport,
			e.net_salary,
			e.is_active === 1 ? lang === "ar" ? "نشط" : "Active" : lang === "ar" ? "غير نشط" : "Inactive"
		];
		dataRow.height = 20;
		currentRow++;
	}
	if (employees.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "الإجمالي" : "Totals";
		totalRow.getCell(3).value = { formula: `SUM(C${startRow + 1}:C${currentRow - 1})` };
		totalRow.getCell(4).value = { formula: `SUM(D${startRow + 1}:D${currentRow - 1})` };
		totalRow.getCell(5).value = { formula: `SUM(E${startRow + 1}:E${currentRow - 1})` };
		totalRow.getCell(6).value = { formula: `SUM(F${startRow + 1}:F${currentRow - 1})` };
		for (let c = 1; c <= 7; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c >= 3 && c <= 6) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, startRow + 1, [
		3,
		4,
		5,
		6
	]);
	autofitColumns(worksheet);
}
function generateExpensesSheet(worksheet, workbook, brand, year, lang) {
	const db = getDb();
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `بيان المصاريف التشغيلية السنوية لسنة ${year}` : `Annual Expenses Sheet: ${year}`);
	const headers = [
		lang === "ar" ? "بند المصاريف" : "Expense Item",
		lang === "ar" ? "التصنيف" : "Category",
		...arabicMonths$4.map((m, idx) => lang === "ar" ? m : englishMonths$3[idx]),
		lang === "ar" ? "الإجمالي السنوي" : "Annual Total"
	];
	const headerRow = worksheet.getRow(startRow);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const items = db.prepare("SELECT DISTINCT item, category FROM expenses WHERE year = ? UNION SELECT DISTINCT item, category FROM expenses").all(year);
	let currentRow = startRow + 1;
	for (const it of items) {
		const rowValues = [it.item, it.category || ""];
		for (const m of arabicMonths$4) {
			const expenseRow = db.prepare("SELECT amount FROM expenses WHERE item = ? AND month = ? AND year = ?").get(it.item, m, year);
			rowValues.push(expenseRow ? expenseRow.amount : 0);
		}
		rowValues.push({ formula: `SUM(C${currentRow}:N${currentRow})` });
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (items.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي المصاريف الشهرية" : "Monthly Cost Sum";
		for (let c = 3; c <= 15; c++) {
			const colLetter = worksheet.getColumn(c).letter;
			totalRow.getCell(c).value = { formula: `SUM(${colLetter}${startRow + 1}:${colLetter}${currentRow - 1})` };
		}
		for (let c = 1; c <= 15; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if (c >= 3) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	const currencyColumns = Array.from({ length: 13 }, (_, i) => i + 3);
	formatGridData(worksheet, startRow + 1, currencyColumns);
	autofitColumns(worksheet);
}
function generateChildReportSheet(worksheet, workbook, brand, childId, lang) {
	const db = getDb();
	const isAr = lang === "ar";
	const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
	if (!child) throw new Error(`Child not found with ID: ${childId}`);
	let row = writeBrandingHeader(worksheet, workbook, brand, lang, isAr ? `تقرير الطفل الشامل: ${child.name}` : `Full Child Report: ${child.name}`);
	const sectionTitle = (text) => {
		const cell = worksheet.getCell(`A${row}`);
		cell.value = text;
		cell.font = {
			name: FONT_FAMILY,
			size: 12,
			bold: true,
			color: { argb: "FFFFFFFF" }
		};
		cell.fill = {
			type: "pattern",
			pattern: "solid",
			fgColor: { argb: "FF0F766E" }
		};
		worksheet.mergeCells(`A${row}:F${row}`);
		row += 1;
	};
	const kv = (label, value) => {
		worksheet.getCell(`A${row}`).value = label;
		worksheet.getCell(`A${row}`).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF64748B" }
		};
		worksheet.getCell(`B${row}`).value = value ?? "";
		worksheet.getCell(`B${row}`).font = {
			name: FONT_FAMILY,
			size: 10
		};
		row += 1;
	};
	sectionTitle(isAr ? "📋 البيانات الشخصية" : "📋 Personal Information");
	kv(isAr ? "الاسم" : "Name", child.name);
	kv(isAr ? "ولي الأمر" : "Guardian", child.guardian);
	kv(isAr ? "هاتف ولي الأمر" : "Guardian Phone", child.guardian_phone);
	kv(isAr ? "تاريخ التسجيل" : "Registration Date", child.reg_date);
	kv(isAr ? "الحالة" : "Status", child.is_active ? isAr ? "نشط" : "Active" : isAr ? "غير نشط" : "Inactive");
	row += 1;
	sectionTitle(isAr ? "🏷️ الخدمات المشترك بها والمعلمون" : "🏷️ Enrolled Services & Assigned Teacher(s)");
	const services = db.prepare(`
    SELECT cs.service, cs.unit, cs.price, e.name as teacher_name
    FROM child_services cs
    LEFT JOIN employees e ON e.id = cs.teacher_id
    WHERE cs.child_id = ?
  `).all(childId);
	const svcHeaderRow = worksheet.getRow(row);
	svcHeaderRow.values = isAr ? [
		"الخدمة",
		"الوحدة",
		"السعر",
		"المعلم"
	] : [
		"Service",
		"Unit",
		"Price",
		"Teacher"
	];
	svcHeaderRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = SUBHEADER_FILL;
		cell.border = BORDER_STYLE;
	});
	row += 1;
	for (const s of services) {
		worksheet.getRow(row).values = [
			s.service,
			s.unit,
			s.price,
			s.teacher_name || (isAr ? "بدون معلم" : "No teacher")
		];
		row += 1;
	}
	if (services.length === 0) {
		worksheet.getCell(`A${row}`).value = isAr ? "لا توجد خدمات مسجلة." : "No services enrolled.";
		worksheet.getCell(`A${row}`).font = {
			name: FONT_FAMILY,
			size: 10,
			italic: true,
			color: { argb: "FF94A3B8" }
		};
		row += 1;
	}
	row += 1;
	sectionTitle(isAr ? "📅 سجل الحضور" : "📅 Attendance History");
	const attendanceRows = db.prepare(`
    SELECT
      ss.session_date as attendance_date,
      e.name as teacher_name,
      ar.teacher_status,
      ar.status as child_status
    FROM attendance_records ar
    JOIN scheduled_sessions ss ON ss.id = ar.session_id
    LEFT JOIN employees e ON e.id = ar.attended_teacher_id
    WHERE ar.child_id = ?
    ORDER BY ss.session_date DESC
  `).all(childId);
	const attendedCount = attendanceRows.filter((r) => r.child_status === "attended").length;
	const attendancePct = attendanceRows.length > 0 ? Math.round(attendedCount / attendanceRows.length * 100) : null;
	kv(isAr ? "نسبة الحضور" : "Attendance Percentage", attendancePct != null ? `${attendancePct}%` : isAr ? "غير متاح" : "N/A");
	const attHeaderRow = worksheet.getRow(row);
	attHeaderRow.values = isAr ? [
		"التاريخ",
		"المعلم",
		"حالة المعلم",
		"حالة الطفل"
	] : [
		"Date",
		"Teacher",
		"Teacher Status",
		"Child Status"
	];
	attHeaderRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = SUBHEADER_FILL;
		cell.border = BORDER_STYLE;
	});
	row += 1;
	for (const a of attendanceRows) {
		worksheet.getRow(row).values = [
			a.attendance_date,
			a.teacher_name || "",
			a.teacher_status || "",
			a.child_status
		];
		row += 1;
	}
	if (attendanceRows.length === 0) {
		worksheet.getCell(`A${row}`).value = isAr ? "لا يوجد سجل حضور بعد." : "No attendance history yet.";
		worksheet.getCell(`A${row}`).font = {
			name: FONT_FAMILY,
			size: 10,
			italic: true,
			color: { argb: "FF94A3B8" }
		};
		row += 1;
	}
	row += 1;
	sectionTitle(isAr ? "💰 السجل المالي" : "💰 Payment History");
	const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status, notes FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
	const payHeaderRow = worksheet.getRow(row);
	payHeaderRow.values = isAr ? [
		"الشهر",
		"السنة",
		"الخدمة",
		"الإجمالي",
		"المدفوع",
		"الرصيد",
		"الحالة"
	] : [
		"Month",
		"Year",
		"Service",
		"Total",
		"Paid",
		"Balance",
		"Status"
	];
	payHeaderRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = SUBHEADER_FILL;
		cell.border = BORDER_STYLE;
	});
	row += 1;
	for (const p of statement.rows) {
		worksheet.getRow(row).values = [
			translateMonthName(p.month, lang),
			p.year,
			p.service,
			p.total,
			p.paid,
			p.balance,
			p.status
		];
		row += 1;
	}
	if (statement.rows.length === 0) {
		worksheet.getCell(`A${row}`).value = isAr ? "لا توجد معاملات مالية مسجلة." : "No financial transactions recorded.";
		worksheet.getCell(`A${row}`).font = {
			name: FONT_FAMILY,
			size: 10,
			italic: true,
			color: { argb: "FF94A3B8" }
		};
		row += 1;
	}
	row += 1;
	sectionTitle(isAr ? "📝 ملاحظات" : "📝 Notes");
	worksheet.getCell(`A${row}`).value = child.notes || (isAr ? "لا توجد ملاحظات." : "No notes.");
	worksheet.getCell(`A${row}`).font = {
		name: FONT_FAMILY,
		size: 10
	};
	worksheet.mergeCells(`A${row}:F${row}`);
	autofitColumns(worksheet);
}
function generateChildStatementSheet(worksheet, workbook, brand, childId, lang) {
	const db = getDb();
	const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
	if (!child) throw new Error(`Child not found with ID: ${childId}`);
	const startRow = writeBrandingHeader(worksheet, workbook, brand, lang, lang === "ar" ? `كشف حساب الطفل: ${child.name}` : `Account Statement: ${child.name}`);
	const detailsRow1 = worksheet.getRow(startRow);
	detailsRow1.height = 20;
	detailsRow1.getCell(1).value = lang === "ar" ? "اسم ولي الأمر:" : "Guardian:";
	detailsRow1.getCell(2).value = child.guardian;
	detailsRow1.getCell(4).value = lang === "ar" ? "الهاتف:" : "Phone:";
	detailsRow1.getCell(5).value = child.guardian_phone;
	const detailsRow2 = worksheet.getRow(startRow + 1);
	detailsRow2.height = 20;
	detailsRow2.getCell(1).value = lang === "ar" ? "الخدمة الأساسية:" : "Service:";
	detailsRow2.getCell(2).value = child.service;
	detailsRow2.getCell(4).value = lang === "ar" ? "تاريخ التسجيل:" : "Reg Date:";
	detailsRow2.getCell(5).value = child.reg_date;
	for (const r of [startRow, startRow + 1]) {
		const row = worksheet.getRow(r);
		row.getCell(1).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF64748B" }
		};
		row.getCell(4).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true,
			color: { argb: "FF64748B" }
		};
		row.getCell(2).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		row.getCell(5).font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
	}
	const tableHeaderRowIdx = startRow + 3;
	const headers = lang === "ar" ? [
		"الشهر",
		"السنة",
		"الخدمة المقدمة",
		"الكمية",
		"السعر",
		"الإجمالي المطلوب",
		"المبلغ المدفوع",
		"المتأخرات / الرصيد",
		"الحالة",
		"ملاحظات"
	] : [
		"Month",
		"Year",
		"Service",
		"Quantity",
		"Price",
		"Total Invoiced",
		"Amount Paid",
		"Balance / Credit",
		"Status",
		"Notes"
	];
	const headerRow = worksheet.getRow(tableHeaderRowIdx);
	headerRow.values = headers;
	headerRow.height = 24;
	headerRow.eachCell((cell) => {
		cell.font = {
			name: FONT_FAMILY,
			size: 10,
			bold: true
		};
		cell.fill = HEADER_FILL;
		cell.border = BORDER_STYLE;
		cell.alignment = {
			vertical: "middle",
			horizontal: "center"
		};
	});
	const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status, notes FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
	let currentRow = tableHeaderRowIdx + 1;
	for (const p of statement.rows) {
		const rowValues = [
			translateMonthName(p.month, lang),
			p.year,
			p.service,
			p.quantity,
			p.price,
			p.total,
			p.paid,
			p.balance,
			p.status,
			p.notes || ""
		];
		const dataRow = worksheet.getRow(currentRow);
		dataRow.values = rowValues;
		dataRow.height = 20;
		currentRow++;
	}
	if (statement.rows.length > 0) {
		const totalRow = worksheet.getRow(currentRow);
		totalRow.height = 22;
		totalRow.getCell(1).value = lang === "ar" ? "إجمالي الحساب التراكمي" : "Cumulative Totals";
		totalRow.getCell(6).value = { formula: `SUM(F${tableHeaderRowIdx + 1}:F${currentRow - 1})` };
		totalRow.getCell(7).value = { formula: `SUM(G${tableHeaderRowIdx + 1}:G${currentRow - 1})` };
		totalRow.getCell(8).value = { formula: `SUM(H${tableHeaderRowIdx + 1}:H${currentRow - 1})` };
		for (let c = 1; c <= 10; c++) {
			const cell = totalRow.getCell(c);
			cell.fill = SUBHEADER_FILL;
			cell.border = BORDER_STYLE;
			cell.font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			if ([
				6,
				7,
				8
			].includes(c)) {
				cell.numFmt = "#,##0.00";
				cell.alignment = { horizontal: "right" };
			}
		}
	}
	formatGridData(worksheet, tableHeaderRowIdx + 1, [
		5,
		6,
		7,
		8
	], [], 9);
	autofitColumns(worksheet);
}
function translateMonthName(mAr, lang) {
	if (lang === "ar") return mAr;
	const idx = arabicMonths$4.indexOf(mAr);
	return idx !== -1 ? englishMonths$3[idx] : mAr;
}
async function buildExcelFile(type, params, savePath) {
	const { month, year, childId, lang = "ar" } = params;
	const workbook = new ExcelJS.Workbook();
	const brand = getExportHeader();
	if (type === "month") {
		const sheetName = lang === "ar" ? `${month} ${year}` : `${month}_${year}`;
		generateMonthSheet(workbook.addWorksheet(sheetName), workbook, brand, month, year, lang, params.paymentIds);
	} else if (type === "payrollReport") {
		const sheetName = lang === "ar" ? "تقرير الرواتب" : "Payroll Report";
		generatePayrollReportSheet(workbook.addWorksheet(sheetName), workbook, brand, {
			month: Number(params.month),
			year: Number(params.year)
		}, lang);
	} else if (type === "childReport") generateChildReportSheet(workbook.addWorksheet(lang === "ar" ? "تقرير الطفل" : "Child Report"), workbook, brand, Number(childId), lang);
	else if (type === "child") generateChildStatementSheet(workbook.addWorksheet(lang === "ar" ? "كشف الحساب" : "Statement"), workbook, brand, Number(childId), lang);
	else if (type === "salaries") {
		const sheetName = lang === "ar" ? "الرواتب" : "Salaries";
		generateSalariesSheet(workbook.addWorksheet(sheetName), workbook, brand, month, year, lang);
	} else if (type === "expenses") {
		const sheetName = lang === "ar" ? "المصاريف" : "Expenses";
		generateExpensesSheet(workbook.addWorksheet(sheetName), workbook, brand, year, lang);
	} else if (type === "employees") {
		const sheetName = lang === "ar" ? "الموظفون" : "Employees";
		generateEmployeesSheet(workbook.addWorksheet(sheetName), workbook, brand, lang);
	} else if (type === "full") {
		const wsDash = workbook.addWorksheet(lang === "ar" ? "لوحة القيادة" : "Dashboard");
		wsDash.views = [{
			showGridLines: true,
			rightToLeft: lang === "ar"
		}];
		const startRow = writeBrandingHeader(wsDash, workbook, brand, lang, lang === "ar" ? "الملخص المالي السنوي العام" : "Annual Summary Dashboard");
		wsDash.getCell(`A${startRow}`).value = lang === "ar" ? "تحليل السنة المالية:" : "Fiscal Year Analysis:";
		wsDash.getCell(`A${startRow}`).font = {
			name: FONT_FAMILY,
			size: 11,
			bold: true
		};
		wsDash.getCell(`B${startRow}`).value = year;
		const db = getDb();
		const payRows = db.prepare("SELECT total, paid, balance FROM payments WHERE year = ?").all(year);
		const expRows = db.prepare("SELECT amount FROM expenses WHERE year = ?").all(year);
		const salRows = db.prepare("SELECT actual_paid FROM salary_payments WHERE year = ?").all(year);
		const invoiced = payRows.reduce((s, r) => s + r.total, 0);
		const collected = payRows.reduce((s, r) => s + r.paid, 0);
		const arrears = payRows.reduce((s, r) => s + Math.max(0, r.balance), 0);
		const expTotal = expRows.reduce((s, r) => s + r.amount, 0);
		const salTotal = salRows.reduce((s, r) => s + r.actual_paid, 0);
		const netProfit = collected - (expTotal + salTotal);
		const collectionRate = invoiced > 0 ? collected / invoiced : 0;
		const wsDashValues = [
			[lang === "ar" ? "إجمالي المطلوب سداده" : "Total Invoiced", invoiced],
			[lang === "ar" ? "إجمالي المبالغ المحصلة" : "Total Collected", collected],
			[lang === "ar" ? "إجمالي المتأخرات المستحقة" : "Outstanding Arrears", arrears],
			[lang === "ar" ? "إجمالي المصاريف التشغيلية" : "Operational Cost", expTotal],
			[lang === "ar" ? "إجمالي المرتبات المنصرفة" : "Employee Salaries", salTotal],
			[lang === "ar" ? "صافي الأرباح المحققة" : "Net Annual Profit", netProfit],
			[lang === "ar" ? "معدل التحصيل السنوي" : "Annual Collection Rate", collectionRate]
		];
		let rIdx = startRow + 2;
		for (const [lbl, val] of wsDashValues) {
			wsDash.getCell(`A${rIdx}`).value = lbl;
			wsDash.getCell(`B${rIdx}`).value = val;
			wsDash.getCell(`A${rIdx}`).font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			wsDash.getCell(`B${rIdx}`).font = {
				name: FONT_FAMILY,
				size: 10,
				bold: true
			};
			wsDash.getCell(`A${rIdx}`).border = BORDER_STYLE;
			wsDash.getCell(`B${rIdx}`).border = BORDER_STYLE;
			if (lbl === (lang === "ar" ? "معدل التحصيل السنوي" : "Annual Collection Rate")) wsDash.getCell(`B${rIdx}`).numFmt = "0%";
			else wsDash.getCell(`B${rIdx}`).numFmt = "#,##0.00";
			rIdx++;
		}
		autofitColumns(wsDash);
		generateChildrenSheet(workbook.addWorksheet(lang === "ar" ? "الأطفال" : "Children"), workbook, brand, lang);
		generateSalariesSheet(workbook.addWorksheet(lang === "ar" ? "الرواتب" : "Salaries"), workbook, brand, "ديسمبر", year, lang);
		generateExpensesSheet(workbook.addWorksheet(lang === "ar" ? "المصاريف" : "Expenses"), workbook, brand, year, lang);
		for (const m of arabicMonths$4) generateMonthSheet(workbook.addWorksheet(m), workbook, brand, m, year, lang);
	}
	await workbook.xlsx.writeFile(savePath);
}
//#endregion
//#region electron/services/pdfService.ts
var arabicMonths$3 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
var englishMonths$2 = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
function shapeText(text) {
	if (text === null || text === void 0) return "";
	const str = String(text);
	if (!/[\u0600-\u06FF]/.test(str)) return str;
	return ArabicReshaper.default.ArabicShaper.convertArabic(str).split(" ").map((word) => {
		if (/[\u0600-\u06FF\uFE70-\uFEFF]/.test(word)) return word.split("").reverse().join("");
		return word;
	}).reverse().join(" ");
}
function getPdfHeader(brand, lang, titleText) {
	const isAr = lang === "ar";
	const headerContent = [];
	const infoCol = {
		stack: [
			{
				text: shapeText(brand.orgName),
				fontSize: 15,
				bold: true,
				color: brand.primaryColor
			},
			{
				text: shapeText(brand.tagline),
				fontSize: 9,
				italic: true,
				color: "#64748b",
				margin: [
					0,
					2,
					0,
					4
				]
			},
			{
				text: shapeText(`${isAr ? "هاتف:" : "Tel:"} ${brand.phone} | ${isAr ? "عنوان:" : "Addr:"} ${brand.address}`),
				fontSize: 8,
				color: "#64748b"
			},
			{
				text: shapeText(`${isAr ? "بريد:" : "Email:"} ${brand.email}`),
				fontSize: 8,
				color: "#64748b"
			}
		],
		alignment: isAr ? "right" : "left"
	};
	if (brand.showLogo && brand.logoPath && fs.existsSync(brand.logoPath)) headerContent.push({
		columns: isAr ? [infoCol, {
			image: brand.logoPath,
			width: 70,
			height: 45,
			alignment: "left"
		}] : [{
			image: brand.logoPath,
			width: 70,
			height: 45,
			alignment: "left"
		}, infoCol],
		columnGap: 15,
		margin: [
			0,
			0,
			0,
			15
		]
	});
	else headerContent.push(infoCol);
	headerContent.push({
		canvas: [{
			type: "line",
			x1: 0,
			y1: 5,
			x2: isAr ? 762 : 515,
			y2: 5,
			lineWidth: 1.5,
			strokeColor: brand.primaryColor
		}],
		margin: [
			0,
			0,
			0,
			15
		]
	});
	headerContent.push({
		text: shapeText(titleText),
		fontSize: 13,
		bold: true,
		alignment: isAr ? "right" : "left",
		margin: [
			0,
			0,
			0,
			15
		]
	});
	return headerContent;
}
var formatCurrency = (val, lang) => {
	return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
		style: "currency",
		currency: "EGP",
		maximumFractionDigits: 0
	}).format(val);
};
function getStatusColor(status) {
	const normalStatus = status.toLowerCase();
	if (normalStatus === "paid" || normalStatus === "active" || normalStatus === "نشط" || normalStatus === "met" || normalStatus === "target_met" || normalStatus === "مكتمل" || normalStatus === "ناجح") return "#059669";
	if (normalStatus === "unpaid" || normalStatus === "inactive" || normalStatus === "غير نشط" || normalStatus === "missed" || normalStatus === "target_missed" || normalStatus === "عجز" || normalStatus === "غير مكتمل") return "#dc2626";
	return "#d97706";
}
function buildPdfFile(type, params, savePath) {
	return new Promise((resolve, reject) => {
		try {
			const db = getDb();
			const brand = getExportHeader();
			const { month, year, childId, lang = "ar" } = params;
			const isAr = lang === "ar";
			const fontsDir = path.join(app.getPath("userData"), "branding/fonts");
			const fontDescriptors = { Cairo: {
				normal: path.join(fontsDir, "Cairo-Regular.ttf"),
				bold: path.join(fontsDir, "Cairo-Bold.ttf"),
				italic: path.join(fontsDir, "Cairo-Regular.ttf"),
				bolditalic: path.join(fontsDir, "Cairo-Bold.ttf")
			} };
			const printer = new PdfPrinter(fontDescriptors);
			let pageOrientation = "portrait";
			if ([
				"full",
				"month",
				"salaries",
				"expenses",
				"employees",
				"payrollReport"
			].includes(type)) pageOrientation = "landscape";
			const docDefinition = {
				pageOrientation,
				pageSize: "A4",
				pageMargins: [
					40,
					40,
					40,
					40
				],
				defaultStyle: {
					font: "Cairo",
					fontSize: 9,
					alignment: isAr ? "right" : "left"
				},
				content: [],
				footer: (currentPage, pageCount) => {
					return {
						text: shapeText(`${isAr ? "صفحة" : "Page"} ${currentPage} / ${pageCount}`),
						alignment: "center",
						fontSize: 8,
						color: "#94a3b8",
						margin: [
							0,
							10,
							0,
							0
						]
					};
				}
			};
			if (type === "month") {
				const title = isAr ? `مطالبات واشتراكات شهر ${month} لسنة ${year}` : `Billing Sheet: ${month} ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const hasSelection = Array.isArray(params.paymentIds) && params.paymentIds.length > 0;
				const payments = db.prepare(`
          SELECT c.name as child_name, c.guardian, c.guardian_phone, p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.status, p.notes
          FROM payments p
          JOIN children c ON p.child_id = c.id
          WHERE p.month = ? AND p.year = ?
          ${hasSelection ? `AND p.id IN (${params.paymentIds.map(() => "?").join(",")})` : ""}
        `).all(month, year, ...hasSelection ? params.paymentIds : []);
				const body = [(isAr ? [
					"اسم الطفل",
					"ولي الأمر",
					"الهاتف",
					"الخدمة",
					"الوحدة",
					"الكمية",
					"السعر",
					"الإجمالي",
					"المدفوع",
					"المتأخرات",
					"الحالة"
				] : [
					"Child Name",
					"Guardian",
					"Phone",
					"Service",
					"Unit",
					"Qty",
					"Price",
					"Total",
					"Paid",
					"Arrears",
					"Status"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let totalInvoiced = 0;
				let totalCollected = 0;
				let arrears = 0;
				for (const p of payments) {
					totalInvoiced += p.total;
					totalCollected += p.paid;
					arrears += p.balance;
					body.push([
						{
							text: shapeText(p.child_name),
							bold: false,
							fillColor: "",
							color: "",
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.guardian),
							bold: false,
							fillColor: "",
							color: "",
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.guardian_phone),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.service),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.unit),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.quantity),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(p.price, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.total, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.paid, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.balance, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(p.status),
							bold: true,
							fillColor: "",
							color: getStatusColor(p.status),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "إجمالي المحاسبة" : "Totals"),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: shapeText(formatCurrency(totalInvoiced, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(totalCollected, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(arrears, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "childReport") {
				const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
				if (!child) throw new Error("Child not found");
				const title = isAr ? `تقرير الطفل الشامل: ${child.name}` : `Full Child Report: ${child.name}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const sectionHeader = (text) => ({
					text: shapeText(text),
					fontSize: 12,
					bold: true,
					color: "#ffffff",
					fillColor: brand.primaryColor,
					margin: [
						4,
						4,
						4,
						4
					]
				});
				const kvTable = (pairs) => ({
					margin: [
						0,
						6,
						0,
						10
					],
					table: {
						widths: ["auto", "*"],
						body: pairs.map(([k, v]) => [{
							text: shapeText(k),
							bold: true,
							color: "#64748b"
						}, { text: shapeText(v ?? "") }])
					},
					layout: "noBorders"
				});
				const simpleTable = (headers, rows, emptyMsg) => {
					if (rows.length === 0) return {
						text: shapeText(emptyMsg),
						italics: true,
						color: "#94a3b8",
						margin: [
							0,
							0,
							0,
							10
						]
					};
					const body = [headers.map((h) => ({
						text: shapeText(h),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "center"
					})), ...rows.map((r) => r.map((c) => ({
						text: shapeText(c ?? ""),
						alignment: isAr ? "right" : "left"
					})))];
					return {
						margin: [
							0,
							0,
							0,
							10
						],
						table: {
							headerRows: 1,
							widths: headers.map(() => "*"),
							body
						},
						layout: {
							hLineWidth: () => .5,
							vLineWidth: () => .5,
							hLineColor: () => "#cbd5e1",
							vLineColor: () => "#cbd5e1"
						}
					};
				};
				docDefinition.content.push(sectionHeader(isAr ? "📋 البيانات الشخصية" : "📋 Personal Information"));
				docDefinition.content.push(kvTable([
					[isAr ? "الاسم" : "Name", child.name],
					[isAr ? "ولي الأمر" : "Guardian", child.guardian],
					[isAr ? "هاتف ولي الأمر" : "Guardian Phone", child.guardian_phone],
					[isAr ? "تاريخ التسجيل" : "Registration Date", child.reg_date],
					[isAr ? "الحالة" : "Status", child.is_active ? isAr ? "نشط" : "Active" : isAr ? "غير نشط" : "Inactive"]
				]));
				docDefinition.content.push(sectionHeader(isAr ? "🏷️ الخدمات والمعلمون" : "🏷️ Services & Teachers"));
				const services = db.prepare(`
          SELECT cs.service, cs.unit, cs.price, e.name as teacher_name
          FROM child_services cs LEFT JOIN employees e ON e.id = cs.teacher_id
          WHERE cs.child_id = ?
        `).all(childId);
				docDefinition.content.push(simpleTable(isAr ? [
					"الخدمة",
					"الوحدة",
					"السعر",
					"المعلم"
				] : [
					"Service",
					"Unit",
					"Price",
					"Teacher"
				], services.map((s) => [
					s.service,
					s.unit,
					formatCurrency(s.price, lang),
					s.teacher_name || (isAr ? "بدون معلم" : "No teacher")
				]), isAr ? "لا توجد خدمات مسجلة." : "No services enrolled."));
				const attendanceRows = db.prepare(`
          SELECT ss.session_date as attendance_date, e.name as teacher_name, ar.teacher_status, ar.status as child_status
          FROM attendance_records ar
          JOIN scheduled_sessions ss ON ss.id = ar.session_id
          LEFT JOIN employees e ON e.id = ar.attended_teacher_id
          WHERE ar.child_id = ?
          ORDER BY ss.session_date DESC
        `).all(childId);
				const attended = attendanceRows.filter((r) => r.child_status === "attended").length;
				const pct = attendanceRows.length > 0 ? Math.round(attended / attendanceRows.length * 100) : null;
				docDefinition.content.push(sectionHeader(isAr ? `📅 سجل الحضور — نسبة الحضور: ${pct != null ? pct + "%" : "غير متاح"}` : `📅 Attendance History — Attendance %: ${pct != null ? pct + "%" : "N/A"}`));
				docDefinition.content.push(simpleTable(isAr ? [
					"التاريخ",
					"المعلم",
					"حالة المعلم",
					"حالة الطفل"
				] : [
					"Date",
					"Teacher",
					"Teacher Status",
					"Child Status"
				], attendanceRows.map((a) => [
					a.attendance_date,
					a.teacher_name || "",
					a.teacher_status || "",
					a.child_status
				]), isAr ? "لا يوجد سجل حضور بعد." : "No attendance history yet."));
				docDefinition.content.push(sectionHeader(isAr ? "💰 السجل المالي" : "💰 Payment History"));
				const statementForReport = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
				docDefinition.content.push(simpleTable(isAr ? [
					"الشهر",
					"السنة",
					"الخدمة",
					"الإجمالي",
					"المدفوع",
					"الرصيد",
					"الحالة"
				] : [
					"Month",
					"Year",
					"Service",
					"Total",
					"Paid",
					"Balance",
					"Status"
				], statementForReport.rows.map((p) => {
					const mIdx = arabicMonths$3.indexOf(p.month);
					return [
						isAr ? p.month : mIdx !== -1 ? englishMonths$2[mIdx] : p.month,
						p.year,
						p.service,
						formatCurrency(p.total, lang),
						formatCurrency(p.paid, lang),
						formatCurrency(p.balance, lang),
						p.status
					];
				}), isAr ? "لا توجد معاملات مالية مسجلة." : "No financial transactions recorded."));
				docDefinition.content.push(sectionHeader(isAr ? "📝 ملاحظات" : "📝 Notes"));
				docDefinition.content.push({
					text: shapeText(child.notes || (isAr ? "لا توجد ملاحظات." : "No notes.")),
					margin: [
						0,
						6,
						0,
						0
					]
				});
			} else if (type === "child") {
				const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
				if (!child) throw new Error("Child not found");
				const title = isAr ? `كشف حساب الطفل: ${child.name}` : `Account Statement: ${child.name}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				docDefinition.content.push({
					margin: [
						0,
						0,
						0,
						15
					],
					table: {
						widths: ["*", "*"],
						body: [[{
							text: shapeText(`${isAr ? "ولي الأمر:" : "Guardian:"} ${child.guardian}`),
							bold: true
						}, {
							text: shapeText(`${isAr ? "الهاتف:" : "Phone:"} ${child.guardian_phone}`),
							bold: true
						}], [{
							text: shapeText(`${isAr ? "الخدمة الأساسية:" : "Service:"} ${child.service}`),
							bold: true
						}, {
							text: shapeText(`${isAr ? "تاريخ التسجيل:" : "Reg Date:"} ${child.reg_date}`),
							bold: true
						}]]
					},
					layout: "noBorders"
				});
				const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
				const body = [(isAr ? [
					"الشهر",
					"السنة",
					"الخدمة المقدمة",
					"الكمية",
					"السعر",
					"الإجمالي المطلـوب",
					"المبلغ المدفوع",
					"المتأخرات",
					"الحالة"
				] : [
					"Month",
					"Year",
					"Service",
					"Qty",
					"Price",
					"Invoiced",
					"Paid",
					"Balance",
					"Status"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let totalInvoiced = 0;
				let totalCollected = 0;
				let totalBalance = 0;
				for (const p of statement.rows) {
					totalInvoiced += p.total;
					totalCollected += p.paid;
					totalBalance += p.balance;
					const mIdx = arabicMonths$3.indexOf(p.month);
					const mStr = isAr ? p.month : mIdx !== -1 ? englishMonths$2[mIdx] : p.month;
					body.push([
						{
							text: shapeText(mStr),
							bold: false,
							fillColor: "",
							color: "",
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.year),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.service),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(p.quantity),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(p.price, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.total, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.paid, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.balance, lang)),
							bold: false,
							fillColor: "",
							color: "",
							alignment: "right"
						},
						{
							text: shapeText(p.status),
							bold: true,
							fillColor: "",
							color: getStatusColor(p.status),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "إجمالي الحساب التراكمي" : "Totals"),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					},
					{
						text: shapeText(formatCurrency(totalInvoiced, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(totalCollected, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(totalBalance, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "right"
					},
					{
						text: "",
						bold: false,
						fillColor: "#f1f5f9",
						color: "",
						alignment: "left"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"auto",
							"auto",
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "salaries") {
				const title = isAr ? `مرتبات ومكافآت الموظفين لشهر ${month} لسنة ${year}` : `Employee Payroll: ${month} ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const payroll = db.prepare(`
          SELECT e.name, e.role, e.base_salary, e.housing, e.transport, e.net_salary,
                 s.bonus, s.deductions, s.actual_paid, s.paid_date as pay_date
          FROM employees e
          LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
          WHERE e.is_active = 1 OR s.id IS NOT NULL
        `).all(month, year);
				const body = [(isAr ? [
					"اسم الموظف",
					"الدور",
					"الراتب الأساسي",
					"بدل سكن",
					"بدل انتقال",
					"صافي الراتب",
					"مكافآت",
					"خصومات",
					"المدفوع الفعلي",
					"تاريخ الصرف"
				] : [
					"Employee Name",
					"Role",
					"Base Salary",
					"Housing",
					"Transport",
					"Net Salary",
					"Bonuses",
					"Deductions",
					"Actual Paid",
					"Pay Date"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let sumPaid = 0;
				for (const p of payroll) {
					const actualPaid = p.actual_paid !== null && p.actual_paid !== void 0 ? p.actual_paid : p.net_salary;
					sumPaid += actualPaid;
					body.push([
						{
							text: shapeText(p.name),
							bold: false,
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(p.role === "admin" ? isAr ? "مسؤول" : "Admin" : isAr ? "موظف" : "Employee"),
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(p.base_salary, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.housing, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.transport, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.net_salary, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.bonus || 0, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(p.deductions || 0, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(actualPaid, lang)),
							bold: true,
							alignment: "right"
						},
						{
							text: shapeText(p.pay_date || ""),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "إجمالي منصرف الرواتب" : "Total Payroll"),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: shapeText(formatCurrency(sumPaid, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "employees") {
				const title = isAr ? "سجل الموظفين" : "Employees Roster";
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const employees = db.prepare(`
          SELECT name, role, base_salary, housing, transport, net_salary, is_active
          FROM employees
          ORDER BY is_active DESC, name ASC
        `).all();
				const body = [(isAr ? [
					"اسم الموظف",
					"الوظيفة",
					"الراتب الأساسي",
					"بدل سكن",
					"بدل انتقال",
					"صافي الراتب",
					"الحالة"
				] : [
					"Employee Name",
					"Role",
					"Base Salary",
					"Housing",
					"Transport",
					"Net Salary",
					"Status"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let sumBase = 0, sumHousing = 0, sumTransport = 0, sumNet = 0;
				for (const e of employees) {
					if (e.is_active === 1) {
						sumBase += e.base_salary || 0;
						sumHousing += e.housing || 0;
						sumTransport += e.transport || 0;
						sumNet += e.net_salary || 0;
					}
					body.push([
						{
							text: shapeText(e.name),
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(e.role),
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(e.base_salary, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(e.housing, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(e.transport, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(e.net_salary, lang)),
							bold: true,
							alignment: "right"
						},
						{
							text: shapeText(e.is_active === 1 ? isAr ? "نشط" : "Active" : isAr ? "غير نشط" : "Inactive"),
							alignment: "center"
						}
					]);
				}
				body.push([
					{
						text: shapeText(isAr ? "الإجمالي (النشطون)" : "Totals (active)"),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: shapeText(formatCurrency(sumBase, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(sumHousing, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(sumTransport, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: shapeText(formatCurrency(sumNet, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "payrollReport") {
				const monthNum = Number(month);
				const monthLabel = isAr ? arabicMonths$3[monthNum - 1] : englishMonths$2[monthNum - 1];
				const title = isAr ? `تقرير رواتب المعلمين لشهر ${monthLabel} ${year}` : `Teacher Payroll Report: ${monthLabel} ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const monthKey = `${year}-${String(monthNum).padStart(2, "0")}`;
				const rows = db.prepare(`
          SELECT
            e.name as teacher_name,
            e.teacher_session_rate as session_cost,
            COUNT(tp.id) as sessions_paid,
            COALESCE(SUM(tp.session_cost), 0) as total_salary
          FROM employees e
          JOIN teacher_payments tp ON tp.teacher_id = e.id
            AND tp.status IN ('pending','paid')
            AND strftime('%Y-%m', tp.attendance_date) = ?
          GROUP BY e.id
          ORDER BY e.name ASC
        `).all(monthKey);
				const body = [(isAr ? [
					"اسم المعلم",
					"عدد الجلسات المدفوعة",
					"تكلفة الجلسة",
					"إجمالي الراتب"
				] : [
					"Teacher Name",
					"Sessions Paid",
					"Session Rate",
					"Total Salary"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let sumTotal = 0;
				for (const r of rows) {
					sumTotal += r.total_salary;
					body.push([
						{
							text: shapeText(r.teacher_name),
							alignment: isAr ? "right" : "left"
						},
						{
							text: shapeText(r.sessions_paid),
							alignment: "center"
						},
						{
							text: shapeText(formatCurrency(r.session_cost || 0, lang)),
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(r.total_salary, lang)),
							bold: true,
							alignment: "right"
						}
					]);
				}
				if (rows.length > 0) body.push([
					{
						text: shapeText(isAr ? "إجمالي الرواتب" : "Total Payroll"),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: isAr ? "right" : "left"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: "",
						fillColor: "#f1f5f9"
					},
					{
						text: shapeText(formatCurrency(sumTotal, lang)),
						bold: true,
						fillColor: "#f1f5f9",
						alignment: "right"
					}
				]);
				else body.push([
					{
						text: shapeText(isAr ? "لا توجد جلسات مدفوعة لهذا الشهر." : "No paid sessions for this month."),
						italic: true,
						color: "#94a3b8",
						colSpan: 4
					},
					{},
					{},
					{}
				]);
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto"
						],
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "expenses") {
				const title = isAr ? `تقرير المصاريف التشغيلية السنوية لسنة ${year}` : `Annual Expenses: ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, title));
				const items = db.prepare("SELECT DISTINCT item, category FROM expenses WHERE year = ? UNION SELECT DISTINCT item, category FROM expenses").all(year);
				const monthsHeaders = arabicMonths$3.map((m, idx) => isAr ? m : englishMonths$2[idx]);
				const body = [[
					isAr ? "البند" : "Item",
					isAr ? "التصنيف" : "Category",
					...monthsHeaders,
					isAr ? "الإجمالي" : "Total"
				].map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				let grandTotal = 0;
				const colTotals = Array(12).fill(0);
				for (const it of items) {
					const row = [{
						text: shapeText(it.item),
						bold: false,
						alignment: isAr ? "right" : "left"
					}, {
						text: shapeText(it.category || ""),
						alignment: "center"
					}];
					let itemTotal = 0;
					for (let mIdx = 0; mIdx < arabicMonths$3.length; mIdx++) {
						const m = arabicMonths$3[mIdx];
						const exp = db.prepare("SELECT amount FROM expenses WHERE item = ? AND month = ? AND year = ?").get(it.item, m, year);
						const amount = exp ? exp.amount : 0;
						row.push({
							text: shapeText(formatCurrency(amount, lang)),
							alignment: "right"
						});
						itemTotal += amount;
						colTotals[mIdx] += amount;
					}
					row.push({
						text: shapeText(formatCurrency(itemTotal, lang)),
						bold: true,
						alignment: "right"
					});
					body.push(row);
					grandTotal += itemTotal;
				}
				const totalRow = [{
					text: shapeText(isAr ? "المجموع الشهري" : "Monthly Totals"),
					bold: true,
					fillColor: "#f1f5f9",
					alignment: isAr ? "right" : "left"
				}, {
					text: "",
					fillColor: "#f1f5f9"
				}];
				for (const colSum of colTotals) totalRow.push({
					text: shapeText(formatCurrency(colSum, lang)),
					bold: true,
					fillColor: "#f1f5f9",
					alignment: "right"
				});
				totalRow.push({
					text: shapeText(formatCurrency(grandTotal, lang)),
					bold: true,
					fillColor: "#f8fafc",
					alignment: "right"
				});
				body.push(totalRow);
				const widths = [
					"*",
					"auto",
					...Array(12).fill("auto"),
					"auto"
				];
				docDefinition.content.push({
					table: {
						headerRows: 1,
						widths,
						body
					},
					layout: {
						hLineWidth: () => .5,
						vLineWidth: () => .5,
						hLineColor: () => "#cbd5e1",
						vLineColor: () => "#cbd5e1"
					}
				});
			} else if (type === "full") {
				const coverTitle = isAr ? `التقرير السنوي الشامل لسنة ${year}` : `Full Annual Report: ${year}`;
				docDefinition.content.push(...getPdfHeader(brand, lang, coverTitle));
				const payRows = db.prepare("SELECT total, paid, balance FROM payments WHERE year = ?").all(year);
				const expRows = db.prepare("SELECT amount FROM expenses WHERE year = ?").all(year);
				const salRows = db.prepare("SELECT actual_paid FROM salary_payments WHERE year = ?").all(year);
				const invoiced = payRows.reduce((s, r) => s + r.total, 0);
				const collected = payRows.reduce((s, r) => s + r.paid, 0);
				const arrears = payRows.reduce((s, r) => s + Math.max(0, r.balance), 0);
				const expTotal = expRows.reduce((s, r) => s + r.amount, 0);
				const salTotal = salRows.reduce((s, r) => s + r.actual_paid, 0);
				const netProfit = collected - (expTotal + salTotal);
				const collectionRate = invoiced > 0 ? collected / invoiced : 0;
				docDefinition.content.push({
					text: shapeText(isAr ? "البيانات المالية السنوية التراكمية" : "Annual Financial Cumulative Summary"),
					fontSize: 12,
					bold: true,
					margin: [
						0,
						10,
						0,
						10
					]
				});
				const summaryTable = {
					widths: ["*", "*"],
					body: [
						[{
							text: shapeText(isAr ? "المؤشر المالي" : "Key Performance Indicator"),
							bold: true,
							fillColor: brand.primaryColor,
							color: "#ffffff"
						}, {
							text: shapeText(isAr ? "القيمة الإجمالية" : "Total Value"),
							bold: true,
							fillColor: brand.primaryColor,
							color: "#ffffff"
						}],
						[shapeText(isAr ? "إجمالي المطلوب سداده" : "Total Invoiced"), shapeText(formatCurrency(invoiced, lang))],
						[shapeText(isAr ? "إجمالي المبالغ المحصلة" : "Total Collected"), shapeText(formatCurrency(collected, lang))],
						[shapeText(isAr ? "إجمالي المتأخرات المستحقة" : "Outstanding Arrears"), shapeText(formatCurrency(arrears, lang))],
						[shapeText(isAr ? "إجمالي المصاريف التشغيلية" : "Operational Cost"), shapeText(formatCurrency(expTotal, lang))],
						[shapeText(isAr ? "إجمالي المرتبات المنصرفة" : "Employee Salaries"), shapeText(formatCurrency(salTotal, lang))],
						[shapeText(isAr ? "صافي الأرباح المحققة" : "Net Annual Profit"), shapeText(formatCurrency(netProfit, lang))],
						[shapeText(isAr ? "معدل التحصيل السنوي" : "Annual Collection Rate"), shapeText(`${Math.round(collectionRate * 100)}%`)]
					]
				};
				docDefinition.content.push({
					table: summaryTable,
					margin: [
						0,
						0,
						0,
						20
					]
				});
				docDefinition.content.push({
					text: "",
					pageBreak: "after"
				});
				docDefinition.content.push(...getPdfHeader(brand, lang, isAr ? "قائمة سجلات الأطفال" : "Children Records List"));
				const kids = db.prepare("SELECT name, guardian, guardian_phone, service, price, reg_date FROM children").all();
				const kidBody = [(isAr ? [
					"اسم الطفل",
					"ولي الأمر",
					"رقم الهاتف",
					"الخدمة",
					"السعر",
					"تاريخ التسجيل"
				] : [
					"Child Name",
					"Guardian",
					"Phone",
					"Service",
					"Price",
					"Reg Date"
				]).map((h) => ({
					text: shapeText(h),
					bold: true,
					fillColor: brand.primaryColor,
					color: "#ffffff",
					alignment: "center"
				}))];
				for (const k of kids) kidBody.push([
					shapeText(k.name),
					shapeText(k.guardian),
					shapeText(k.guardian_phone),
					shapeText(k.service),
					shapeText(formatCurrency(k.price, lang)),
					shapeText(k.reg_date)
				]);
				docDefinition.content.push({ table: {
					headerRows: 1,
					widths: [
						"*",
						"*",
						"auto",
						"auto",
						"auto",
						"auto"
					],
					body: kidBody
				} });
				docDefinition.content.push({
					text: "",
					pageBreak: "after"
				});
				for (let mIdx = 0; mIdx < arabicMonths$3.length; mIdx++) {
					const m = arabicMonths$3[mIdx];
					const mTitle = isAr ? `مطالبات شهر ${m} لسنة ${year}` : `Billing Sheet: ${englishMonths$2[mIdx]} ${year}`;
					docDefinition.content.push(...getPdfHeader(brand, lang, mTitle));
					const payments = db.prepare(`
            SELECT c.name as child_name, p.service, p.quantity, p.price, p.total, p.paid, p.balance, p.status
            FROM payments p
            JOIN children c ON p.child_id = c.id
            WHERE p.month = ? AND p.year = ?
          `).all(m, year);
					const body = [(isAr ? [
						"اسم الطفل",
						"الخدمة",
						"الكمية",
						"السعر",
						"الإجمالي",
						"المدفوع",
						"المتأخرات",
						"الحالة"
					] : [
						"Child Name",
						"Service",
						"Qty",
						"Price",
						"Total",
						"Paid",
						"Arrears",
						"Status"
					]).map((h) => ({
						text: shapeText(h),
						bold: true,
						fillColor: brand.primaryColor,
						color: "#ffffff",
						alignment: "center"
					}))];
					let totalM = 0;
					let collectedM = 0;
					let arrearsM = 0;
					for (const p of payments) {
						totalM += p.total;
						collectedM += p.paid;
						arrearsM += p.balance;
						body.push([
							{
								text: shapeText(p.child_name),
								alignment: isAr ? "right" : "left"
							},
							{
								text: shapeText(p.service),
								alignment: "center"
							},
							{
								text: shapeText(p.quantity),
								alignment: "center"
							},
							{
								text: shapeText(formatCurrency(p.price, lang)),
								alignment: "right"
							},
							{
								text: shapeText(formatCurrency(p.total, lang)),
								alignment: "right"
							},
							{
								text: shapeText(formatCurrency(p.paid, lang)),
								alignment: "right"
							},
							{
								text: shapeText(formatCurrency(p.balance, lang)),
								alignment: "right"
							},
							{
								text: shapeText(p.status),
								bold: true,
								color: getStatusColor(p.status),
								alignment: "center"
							}
						]);
					}
					body.push([
						{
							text: shapeText(isAr ? "المجموع" : "Total"),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: isAr ? "right" : "left"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						},
						{
							text: shapeText(formatCurrency(totalM, lang)),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(collectedM, lang)),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: "right"
						},
						{
							text: shapeText(formatCurrency(arrearsM, lang)),
							bold: true,
							fillColor: "#f1f5f9",
							alignment: "right"
						},
						{
							text: "",
							fillColor: "#f1f5f9"
						}
					]);
					docDefinition.content.push({ table: {
						headerRows: 1,
						widths: [
							"*",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto",
							"auto"
						],
						body
					} });
					if (mIdx < arabicMonths$3.length - 1) docDefinition.content.push({
						text: "",
						pageBreak: "after"
					});
				}
			}
			const pdfDoc = printer.createPdfKitDocument(docDefinition);
			const writeStream = fs.createWriteStream(savePath);
			pdfDoc.pipe(writeStream);
			writeStream.on("finish", () => {
				resolve();
			});
			writeStream.on("error", (err) => {
				reject(err);
			});
			pdfDoc.end();
		} catch (e) {
			reject(e);
		}
	});
}
//#endregion
//#region electron/services/csvService.ts
var arabicMonths$2 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
var englishMonths$1 = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
function escapeCsvField(value) {
	if (value === null || value === void 0) return "";
	const str = String(value);
	if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
	return str;
}
function toCsvLine(fields) {
	return fields.map(escapeCsvField).join(",");
}
/**
* Builds the branded header lines shared by every report's CSV: org name, applied filters, and
* the generation timestamp (FR-004) — CSV has no logo image support, so the org name stands in
* for it in text form.
*/
function buildHeaderLines(title, filterSummary) {
	const brand = getExportHeader();
	const now = (/* @__PURE__ */ new Date()).toISOString();
	return [
		toCsvLine([brand.orgName]),
		toCsvLine([title]),
		toCsvLine([filterSummary]),
		toCsvLine([`Generated: ${now}`]),
		""
	];
}
async function buildCsvFile(type, params, savePath) {
	const { lang = "ar" } = params;
	const isAr = lang === "ar";
	let lines = [];
	if (type === "month") {
		const db = getDb();
		const month = params.month;
		const year = Number(params.year);
		const hasSelection = Array.isArray(params.paymentIds) && params.paymentIds.length > 0;
		lines = buildHeaderLines(isAr ? `مطالبات شهر ${month} لسنة ${year}` : `Billing Sheet: ${month} ${year}`, isAr ? `الفترة: ${month} ${year}${hasSelection ? ` — ${params.paymentIds.length} سجل محدد` : ""}` : `Period: ${month} ${year}${hasSelection ? ` — ${params.paymentIds.length} selected record(s)` : ""}`);
		lines.push(toCsvLine(isAr ? [
			"اسم الطفل",
			"ولي الأمر",
			"الهاتف",
			"الخدمة",
			"الوحدة",
			"الكمية",
			"السعر",
			"الإجمالي",
			"المدفوع",
			"المتأخرات",
			"الحالة",
			"ملاحظات"
		] : [
			"Child Name",
			"Guardian",
			"Phone",
			"Service",
			"Unit",
			"Qty",
			"Price",
			"Total",
			"Paid",
			"Arrears",
			"Status",
			"Notes"
		]));
		const payments = db.prepare(`
      SELECT c.name as child_name, c.guardian, c.guardian_phone, p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.status, p.notes
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.month = ? AND p.year = ?
      ${hasSelection ? `AND p.id IN (${params.paymentIds.map(() => "?").join(",")})` : ""}
    `).all(month, year, ...hasSelection ? params.paymentIds : []);
		let totalInvoiced = 0, totalCollected = 0, arrears = 0;
		for (const p of payments) {
			totalInvoiced += p.total;
			totalCollected += p.paid;
			arrears += p.balance;
			lines.push(toCsvLine([
				p.child_name,
				p.guardian,
				p.guardian_phone,
				p.service,
				p.unit,
				p.quantity,
				p.price,
				p.total,
				p.paid,
				p.balance,
				p.status,
				p.notes || ""
			]));
		}
		if (payments.length === 0) lines.push(toCsvLine([isAr ? "لا توجد مطالبات مسجلة لهذا الشهر." : "No billing records for this month."]));
		else lines.push(toCsvLine([
			isAr ? "الإجمالي" : "Total",
			"",
			"",
			"",
			"",
			"",
			"",
			totalInvoiced,
			totalCollected,
			arrears,
			"",
			""
		]));
	}
	if (type === "childReport") {
		const db = getDb();
		const childId = Number(params.childId);
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
		if (!child) throw new Error(`Child not found with ID: ${childId}`);
		lines = buildHeaderLines(isAr ? `تقرير الطفل الشامل: ${child.name}` : `Full Child Report: ${child.name}`, isAr ? `الطفل: ${child.name}` : `Child: ${child.name}`);
		lines.push(toCsvLine([isAr ? "📋 البيانات الشخصية" : "📋 Personal Information"]));
		lines.push(toCsvLine([isAr ? "الاسم" : "Name", child.name]));
		lines.push(toCsvLine([isAr ? "ولي الأمر" : "Guardian", child.guardian]));
		lines.push(toCsvLine([isAr ? "هاتف ولي الأمر" : "Guardian Phone", child.guardian_phone]));
		lines.push(toCsvLine([isAr ? "تاريخ التسجيل" : "Registration Date", child.reg_date]));
		lines.push(toCsvLine([isAr ? "الحالة" : "Status", child.is_active ? isAr ? "نشط" : "Active" : isAr ? "غير نشط" : "Inactive"]));
		lines.push("");
		lines.push(toCsvLine([isAr ? "🏷️ الخدمات والمعلمون" : "🏷️ Services & Teachers"]));
		lines.push(toCsvLine(isAr ? [
			"الخدمة",
			"الوحدة",
			"السعر",
			"المعلم"
		] : [
			"Service",
			"Unit",
			"Price",
			"Teacher"
		]));
		const services = db.prepare(`
      SELECT cs.service, cs.unit, cs.price, e.name as teacher_name
      FROM child_services cs LEFT JOIN employees e ON e.id = cs.teacher_id
      WHERE cs.child_id = ?
    `).all(childId);
		if (services.length === 0) lines.push(toCsvLine([isAr ? "لا توجد خدمات مسجلة." : "No services enrolled."]));
		for (const s of services) lines.push(toCsvLine([
			s.service,
			s.unit,
			s.price,
			s.teacher_name || (isAr ? "بدون معلم" : "No teacher")
		]));
		lines.push("");
		const attendanceRows = db.prepare(`
      SELECT ss.session_date as attendance_date, e.name as teacher_name, ar.teacher_status, ar.status as child_status
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN employees e ON e.id = ar.attended_teacher_id
      WHERE ar.child_id = ?
      ORDER BY ss.session_date DESC
    `).all(childId);
		const attended = attendanceRows.filter((r) => r.child_status === "attended").length;
		const pct = attendanceRows.length > 0 ? Math.round(attended / attendanceRows.length * 100) : null;
		lines.push(toCsvLine([isAr ? "📅 سجل الحضور" : "📅 Attendance History"]));
		lines.push(toCsvLine([isAr ? "نسبة الحضور" : "Attendance Percentage", pct != null ? `${pct}%` : isAr ? "غير متاح" : "N/A"]));
		lines.push(toCsvLine(isAr ? [
			"التاريخ",
			"المعلم",
			"حالة المعلم",
			"حالة الطفل"
		] : [
			"Date",
			"Teacher",
			"Teacher Status",
			"Child Status"
		]));
		if (attendanceRows.length === 0) lines.push(toCsvLine([isAr ? "لا يوجد سجل حضور بعد." : "No attendance history yet."]));
		for (const a of attendanceRows) lines.push(toCsvLine([
			a.attendance_date,
			a.teacher_name || "",
			a.teacher_status || "",
			a.child_status
		]));
		lines.push("");
		lines.push(toCsvLine([isAr ? "💰 السجل المالي" : "💰 Payment History"]));
		lines.push(toCsvLine(isAr ? [
			"الشهر",
			"السنة",
			"الخدمة",
			"الإجمالي",
			"المدفوع",
			"الرصيد",
			"الحالة"
		] : [
			"Month",
			"Year",
			"Service",
			"Total",
			"Paid",
			"Balance",
			"Status"
		]));
		const statementForReport = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
		if (statementForReport.rows.length === 0) lines.push(toCsvLine([isAr ? "لا توجد معاملات مالية مسجلة." : "No financial transactions recorded."]));
		for (const p of statementForReport.rows) {
			const monthLabel = isAr ? p.month : arabicMonths$2.includes(p.month) ? englishMonths$1[arabicMonths$2.indexOf(p.month)] : p.month;
			lines.push(toCsvLine([
				monthLabel,
				p.year,
				p.service,
				p.total,
				p.paid,
				p.balance,
				p.status
			]));
		}
		lines.push("");
		lines.push(toCsvLine([isAr ? "📝 ملاحظات" : "📝 Notes"]));
		lines.push(toCsvLine([child.notes || (isAr ? "لا توجد ملاحظات." : "No notes.")]));
	}
	if (type === "child") {
		const db = getDb();
		const childId = Number(params.childId);
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
		if (!child) throw new Error(`Child not found with ID: ${childId}`);
		lines = buildHeaderLines(isAr ? `كشف حساب الطفل: ${child.name}` : `Account Statement: ${child.name}`, isAr ? `الطفل: ${child.name}` : `Child: ${child.name}`);
		lines.push(toCsvLine(isAr ? [
			"الشهر",
			"السنة",
			"الخدمة",
			"الكمية",
			"السعر",
			"الإجمالي",
			"المدفوع",
			"الرصيد/المتأخرات",
			"الحالة",
			"ملاحظات"
		] : [
			"Month",
			"Year",
			"Service",
			"Quantity",
			"Price",
			"Total",
			"Paid",
			"Balance",
			"Status",
			"Notes"
		]));
		const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status, notes FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
		let totalDue = 0, totalPaid = 0, totalBalance = 0;
		for (const p of statement.rows) {
			totalDue += p.total;
			totalPaid += p.paid;
			totalBalance += p.balance;
			const monthLabel = isAr ? p.month : arabicMonths$2.includes(p.month) ? englishMonths$1[arabicMonths$2.indexOf(p.month)] : p.month;
			lines.push(toCsvLine([
				monthLabel,
				p.year,
				p.service,
				p.quantity,
				p.price,
				p.total,
				p.paid,
				p.balance,
				p.status,
				p.notes || ""
			]));
		}
		if (statement.rows.length === 0) lines.push(toCsvLine([isAr ? "لا توجد معاملات مالية مسجلة." : "No financial transactions recorded."]));
		else lines.push(toCsvLine([
			isAr ? "الإجمالي" : "Total",
			"",
			"",
			"",
			"",
			totalDue,
			totalPaid,
			totalBalance,
			"",
			""
		]));
	}
	if (type === "expenses") {
		const db = getDb();
		const year = Number(params.year);
		lines = buildHeaderLines(isAr ? `بيان المصاريف التشغيلية السنوية لسنة ${year}` : `Annual Expenses Sheet: ${year}`, isAr ? `السنة: ${year}` : `Year: ${year}`);
		const monthHeaders = arabicMonths$2.map((m, idx) => isAr ? m : englishMonths$1[idx]);
		lines.push(toCsvLine([
			isAr ? "بند المصاريف" : "Expense Item",
			isAr ? "التصنيف" : "Category",
			...monthHeaders,
			isAr ? "الإجمالي السنوي" : "Annual Total"
		]));
		const items = db.prepare("SELECT DISTINCT item, category FROM expenses WHERE year = ? UNION SELECT DISTINCT item, category FROM expenses").all(year);
		const colTotals = Array(12).fill(0);
		let grandTotal = 0;
		for (const it of items) {
			const monthAmounts = arabicMonths$2.map((m, idx) => {
				const amt = db.prepare("SELECT amount FROM expenses WHERE item = ? AND month = ? AND year = ?").get(it.item, m, year)?.amount ?? 0;
				colTotals[idx] += amt;
				return amt;
			});
			const rowTotal = monthAmounts.reduce((s, a) => s + a, 0);
			grandTotal += rowTotal;
			lines.push(toCsvLine([
				it.item,
				it.category || "",
				...monthAmounts,
				rowTotal
			]));
		}
		if (items.length === 0) lines.push(toCsvLine([isAr ? "لا توجد مصاريف مسجلة لهذه السنة." : "No expenses recorded for this year."]));
		else lines.push(toCsvLine([
			isAr ? "الإجمالي" : "Total",
			"",
			...colTotals,
			grandTotal
		]));
	}
	if (type === "payrollReport") {
		const db = getDb();
		const month = Number(params.month);
		const year = Number(params.year);
		const monthLabel = isAr ? arabicMonths$2[month - 1] : englishMonths$1[month - 1];
		lines = buildHeaderLines(isAr ? `تقرير رواتب المعلمين لشهر ${monthLabel} ${year}` : `Teacher Payroll Report: ${monthLabel} ${year}`, isAr ? `الفترة: ${monthLabel} ${year}` : `Period: ${monthLabel} ${year}`);
		lines.push(toCsvLine(isAr ? [
			"اسم المعلم",
			"عدد الجلسات المدفوعة",
			"تكلفة الجلسة",
			"إجمالي الراتب"
		] : [
			"Teacher Name",
			"Sessions Paid",
			"Session Rate",
			"Total Salary"
		]));
		const monthKey = `${year}-${String(month).padStart(2, "0")}`;
		const rows = db.prepare(`
      SELECT
        e.name as teacher_name,
        e.teacher_session_rate as session_cost,
        COUNT(tp.id) as sessions_paid,
        COALESCE(SUM(tp.session_cost), 0) as total_salary
      FROM employees e
      JOIN teacher_payments tp ON tp.teacher_id = e.id
        AND tp.status IN ('pending','paid')
        AND strftime('%Y-%m', tp.attendance_date) = ?
      GROUP BY e.id
      ORDER BY e.name ASC
    `).all(monthKey);
		let total = 0;
		for (const r of rows) {
			total += r.total_salary;
			lines.push(toCsvLine([
				r.teacher_name,
				r.sessions_paid,
				r.session_cost ?? "",
				r.total_salary
			]));
		}
		if (rows.length === 0) lines.push(toCsvLine([isAr ? "لا توجد جلسات مدفوعة لهذا الشهر." : "No paid sessions for this month."]));
		else lines.push(toCsvLine([
			isAr ? "الإجمالي" : "Total",
			"",
			"",
			total
		]));
	}
	fs.writeFileSync(savePath, "﻿" + lines.join("\r\n"), "utf8");
}
//#endregion
//#region electron/services/printService.ts
var arabicMonths$1 = [
	"يناير",
	"فبراير",
	"مارس",
	"أبريل",
	"مايو",
	"يونيو",
	"يوليو",
	"أغسطس",
	"سبتمبر",
	"أكتوبر",
	"نوفمبر",
	"ديسمبر"
];
var englishMonths = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December"
];
function escapeHtml(value) {
	if (value === null || value === void 0) return "";
	return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
/**
* Builds a self-contained, branded HTML print preview (research.md #2) — the renderer opens this
* in a print-preview window and hands off to the OS print dialog via window.print(). Reuses the
* exact same query as the equivalent export:* handler so Print and Export PDF/Excel can never
* disagree on what data they show (FR-003).
*/
function buildPrintPreviewHtml(reportType, params) {
	const brand = getExportHeader();
	const isAr = params.lang === "ar";
	const dir = isAr ? "rtl" : "ltr";
	const now = (/* @__PURE__ */ new Date()).toISOString();
	let title = "";
	let filterSummary = "";
	let tableHtml = "";
	if (reportType === "month") {
		const db = getDb();
		const month = params.month;
		const year = Number(params.year);
		title = isAr ? `مطالبات واشتراكات شهر ${month} لسنة ${year}` : `Billing Sheet: ${month} ${year}`;
		const hasSelection = Array.isArray(params.paymentIds) && params.paymentIds.length > 0;
		filterSummary = isAr ? `الفترة: ${month} ${year}${hasSelection ? ` — ${params.paymentIds.length} سجل محدد` : ""}` : `Period: ${month} ${year}${hasSelection ? ` — ${params.paymentIds.length} selected record(s)` : ""}`;
		const payments = db.prepare(`
      SELECT c.name as child_name, c.guardian, c.guardian_phone, p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.status
      FROM payments p
      JOIN children c ON p.child_id = c.id
      WHERE p.month = ? AND p.year = ?
      ${hasSelection ? `AND p.id IN (${params.paymentIds.map(() => "?").join(",")})` : ""}
    `).all(month, year, ...hasSelection ? params.paymentIds : []);
		const headers = isAr ? [
			"اسم الطفل",
			"ولي الأمر",
			"الهاتف",
			"الخدمة",
			"الوحدة",
			"الكمية",
			"السعر",
			"الإجمالي",
			"المدفوع",
			"المتأخرات",
			"الحالة"
		] : [
			"Child Name",
			"Guardian",
			"Phone",
			"Service",
			"Unit",
			"Qty",
			"Price",
			"Total",
			"Paid",
			"Arrears",
			"Status"
		];
		let totalInvoiced = 0, totalCollected = 0, arrears = 0;
		const bodyRows = payments.map((p) => {
			totalInvoiced += p.total;
			totalCollected += p.paid;
			arrears += p.balance;
			return `<tr><td>${escapeHtml(p.child_name)}</td><td>${escapeHtml(p.guardian)}</td><td>${escapeHtml(p.guardian_phone)}</td><td>${escapeHtml(p.service)}</td><td>${escapeHtml(p.unit)}</td><td>${escapeHtml(p.quantity)}</td><td>${escapeHtml(p.price)}</td><td>${escapeHtml(p.total)}</td><td>${escapeHtml(p.paid)}</td><td>${escapeHtml(p.balance)}</td><td>${escapeHtml(p.status)}</td></tr>`;
		}).join("");
		const footerRow = payments.length > 0 ? `<tr class="totals"><td>${isAr ? "الإجمالي" : "Total"}</td><td></td><td></td><td></td><td></td><td></td><td></td><td>${escapeHtml(totalInvoiced)}</td><td>${escapeHtml(totalCollected)}</td><td>${escapeHtml(arrears)}</td><td></td></tr>` : `<tr><td colspan="11" class="empty">${isAr ? "لا توجد مطالبات مسجلة لهذا الشهر." : "No billing records for this month."}</td></tr>`;
		tableHtml = `
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows}${footerRow}</tbody>
      </table>
    `;
	}
	if (reportType === "payroll") {
		const db = getDb();
		const month = Number(params.month);
		const year = Number(params.year);
		const monthLabel = isAr ? arabicMonths$1[month - 1] : englishMonths[month - 1];
		title = isAr ? `تقرير رواتب المعلمين لشهر ${monthLabel} ${year}` : `Teacher Payroll Report: ${monthLabel} ${year}`;
		filterSummary = isAr ? `الفترة: ${monthLabel} ${year}` : `Period: ${monthLabel} ${year}`;
		const monthKey = `${year}-${String(month).padStart(2, "0")}`;
		const rows = db.prepare(`
      SELECT
        e.name as teacher_name,
        e.teacher_session_rate as session_cost,
        COUNT(tp.id) as sessions_paid,
        COALESCE(SUM(tp.session_cost), 0) as total_salary
      FROM employees e
      JOIN teacher_payments tp ON tp.teacher_id = e.id
        AND tp.status IN ('pending','paid')
        AND strftime('%Y-%m', tp.attendance_date) = ?
      GROUP BY e.id
      ORDER BY e.name ASC
    `).all(monthKey);
		const headers = isAr ? [
			"اسم المعلم",
			"عدد الجلسات المدفوعة",
			"تكلفة الجلسة",
			"إجمالي الراتب"
		] : [
			"Teacher Name",
			"Sessions Paid",
			"Session Rate",
			"Total Salary"
		];
		let total = 0;
		const bodyRows = rows.map((r) => {
			total += r.total_salary;
			return `<tr><td>${escapeHtml(r.teacher_name)}</td><td>${escapeHtml(r.sessions_paid)}</td><td>${escapeHtml(r.session_cost ?? "")}</td><td>${escapeHtml(r.total_salary)}</td></tr>`;
		}).join("");
		const footerRow = rows.length > 0 ? `<tr class="totals"><td>${isAr ? "الإجمالي" : "Total"}</td><td></td><td></td><td>${escapeHtml(total)}</td></tr>` : `<tr><td colspan="4" class="empty">${isAr ? "لا توجد جلسات مدفوعة لهذا الشهر." : "No paid sessions for this month."}</td></tr>`;
		tableHtml = `
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows}${footerRow}</tbody>
      </table>
    `;
	}
	if (reportType === "expenses") {
		const db = getDb();
		const year = Number(params.year);
		title = isAr ? `بيان المصاريف التشغيلية السنوية لسنة ${year}` : `Annual Expenses Sheet: ${year}`;
		filterSummary = isAr ? `السنة: ${year}` : `Year: ${year}`;
		const monthHeaders = arabicMonths$1.map((m, idx) => isAr ? m : englishMonths[idx]);
		const headers = [
			isAr ? "بند المصاريف" : "Expense Item",
			isAr ? "التصنيف" : "Category",
			...monthHeaders,
			isAr ? "الإجمالي" : "Total"
		];
		const items = db.prepare("SELECT DISTINCT item, category FROM expenses WHERE year = ? UNION SELECT DISTINCT item, category FROM expenses").all(year);
		const colTotals = Array(12).fill(0);
		let grandTotal = 0;
		const bodyRows = items.map((it) => {
			const monthAmounts = arabicMonths$1.map((m, idx) => {
				const amt = db.prepare("SELECT amount FROM expenses WHERE item = ? AND month = ? AND year = ?").get(it.item, m, year)?.amount ?? 0;
				colTotals[idx] += amt;
				return amt;
			});
			const rowTotal = monthAmounts.reduce((s, a) => s + a, 0);
			grandTotal += rowTotal;
			return `<tr><td>${escapeHtml(it.item)}</td><td>${escapeHtml(it.category || "")}</td>${monthAmounts.map((a) => `<td>${escapeHtml(a)}</td>`).join("")}<td>${escapeHtml(rowTotal)}</td></tr>`;
		}).join("");
		const footerRow = items.length > 0 ? `<tr class="totals"><td>${isAr ? "الإجمالي" : "Total"}</td><td></td>${colTotals.map((t) => `<td>${escapeHtml(t)}</td>`).join("")}<td>${escapeHtml(grandTotal)}</td></tr>` : `<tr><td colspan="${2 + monthHeaders.length + 1}" class="empty">${isAr ? "لا توجد مصاريف مسجلة لهذه السنة." : "No expenses recorded for this year."}</td></tr>`;
		tableHtml = `
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows}${footerRow}</tbody>
      </table>
    `;
	}
	if (reportType === "child") {
		const db = getDb();
		const childId = Number(params.childId);
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
		if (!child) throw new Error(`Child not found with ID: ${childId}`);
		title = isAr ? `كشف حساب الطفل: ${child.name}` : `Account Statement: ${child.name}`;
		filterSummary = isAr ? `الطفل: ${child.name}` : `Child: ${child.name}`;
		const headers = isAr ? [
			"الشهر",
			"السنة",
			"الخدمة",
			"الكمية",
			"السعر",
			"الإجمالي",
			"المدفوع",
			"الرصيد/المتأخرات",
			"الحالة"
		] : [
			"Month",
			"Year",
			"Service",
			"Qty",
			"Price",
			"Total",
			"Paid",
			"Balance",
			"Status"
		];
		const statement = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status, notes FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
		let totalDue = 0, totalPaid = 0, totalBalance = 0;
		const bodyRows = statement.rows.map((p) => {
			totalDue += p.total;
			totalPaid += p.paid;
			totalBalance += p.balance;
			return `<tr><td>${escapeHtml(isAr ? p.month : arabicMonths$1.includes(p.month) ? englishMonths[arabicMonths$1.indexOf(p.month)] : p.month)}</td><td>${escapeHtml(p.year)}</td><td>${escapeHtml(p.service)}</td><td>${escapeHtml(p.quantity)}</td><td>${escapeHtml(p.price)}</td><td>${escapeHtml(p.total)}</td><td>${escapeHtml(p.paid)}</td><td>${escapeHtml(p.balance)}</td><td>${escapeHtml(p.status)}</td></tr>`;
		}).join("");
		const footerRow = statement.rows.length > 0 ? `<tr class="totals"><td>${isAr ? "الإجمالي" : "Total"}</td><td></td><td></td><td></td><td></td><td>${escapeHtml(totalDue)}</td><td>${escapeHtml(totalPaid)}</td><td>${escapeHtml(totalBalance)}</td><td></td></tr>` : `<tr><td colspan="9" class="empty">${isAr ? "لا توجد معاملات مالية مسجلة." : "No financial transactions recorded."}</td></tr>`;
		tableHtml = `
      <table>
        <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${bodyRows}${footerRow}</tbody>
      </table>
    `;
	}
	if (reportType === "childReport") {
		const db = getDb();
		const childId = Number(params.childId);
		const child = db.prepare("SELECT * FROM children WHERE id = ?").get(childId);
		if (!child) throw new Error(`Child not found with ID: ${childId}`);
		title = isAr ? `تقرير الطفل الشامل: ${child.name}` : `Full Child Report: ${child.name}`;
		filterSummary = isAr ? `الطفل: ${child.name}` : `Child: ${child.name}`;
		const section = (heading, inner) => `<h2>${escapeHtml(heading)}</h2>${inner}`;
		const personalInfo = `
      <table><tbody>
        <tr><td class="label">${escapeHtml(isAr ? "الاسم" : "Name")}</td><td>${escapeHtml(child.name)}</td></tr>
        <tr><td class="label">${escapeHtml(isAr ? "ولي الأمر" : "Guardian")}</td><td>${escapeHtml(child.guardian)}</td></tr>
        <tr><td class="label">${escapeHtml(isAr ? "هاتف ولي الأمر" : "Guardian Phone")}</td><td>${escapeHtml(child.guardian_phone)}</td></tr>
        <tr><td class="label">${escapeHtml(isAr ? "تاريخ التسجيل" : "Registration Date")}</td><td>${escapeHtml(child.reg_date)}</td></tr>
        <tr><td class="label">${escapeHtml(isAr ? "الحالة" : "Status")}</td><td>${escapeHtml(child.is_active ? isAr ? "نشط" : "Active" : isAr ? "غير نشط" : "Inactive")}</td></tr>
      </tbody></table>`;
		const services = db.prepare(`
      SELECT cs.service, cs.unit, cs.price, e.name as teacher_name
      FROM child_services cs LEFT JOIN employees e ON e.id = cs.teacher_id
      WHERE cs.child_id = ?
    `).all(childId);
		const servicesHtml = services.length === 0 ? `<p class="empty">${escapeHtml(isAr ? "لا توجد خدمات مسجلة." : "No services enrolled.")}</p>` : `<table><thead><tr><th>${escapeHtml(isAr ? "الخدمة" : "Service")}</th><th>${escapeHtml(isAr ? "الوحدة" : "Unit")}</th><th>${escapeHtml(isAr ? "السعر" : "Price")}</th><th>${escapeHtml(isAr ? "المعلم" : "Teacher")}</th></tr></thead>
        <tbody>${services.map((s) => `<tr><td>${escapeHtml(s.service)}</td><td>${escapeHtml(s.unit)}</td><td>${escapeHtml(s.price)}</td><td>${escapeHtml(s.teacher_name || (isAr ? "بدون معلم" : "No teacher"))}</td></tr>`).join("")}</tbody></table>`;
		const attendanceRows = db.prepare(`
      SELECT ss.session_date as attendance_date, e.name as teacher_name, ar.teacher_status, ar.status as child_status
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN employees e ON e.id = ar.attended_teacher_id
      WHERE ar.child_id = ?
      ORDER BY ss.session_date DESC
    `).all(childId);
		const attended = attendanceRows.filter((r) => r.child_status === "attended").length;
		const pct = attendanceRows.length > 0 ? Math.round(attended / attendanceRows.length * 100) : null;
		const attendanceHtml = `
      <p><strong>${escapeHtml(isAr ? "نسبة الحضور" : "Attendance Percentage")}:</strong> ${escapeHtml(pct != null ? `${pct}%` : isAr ? "غير متاح" : "N/A")}</p>
      ${attendanceRows.length === 0 ? `<p class="empty">${escapeHtml(isAr ? "لا يوجد سجل حضور بعد." : "No attendance history yet.")}</p>` : `<table><thead><tr><th>${escapeHtml(isAr ? "التاريخ" : "Date")}</th><th>${escapeHtml(isAr ? "المعلم" : "Teacher")}</th><th>${escapeHtml(isAr ? "حالة المعلم" : "Teacher Status")}</th><th>${escapeHtml(isAr ? "حالة الطفل" : "Child Status")}</th></tr></thead>
          <tbody>${attendanceRows.map((a) => `<tr><td>${escapeHtml(a.attendance_date)}</td><td>${escapeHtml(a.teacher_name || "")}</td><td>${escapeHtml(a.teacher_status || "")}</td><td>${escapeHtml(a.child_status)}</td></tr>`).join("")}</tbody></table>`}
    `;
		const statementForReport = getChildStatement(child, db.prepare("SELECT month, year, service, unit, quantity, price, total, paid, balance, status FROM payments WHERE child_id = ?").all(childId), /* @__PURE__ */ new Date());
		const paymentsHtml = statementForReport.rows.length === 0 ? `<p class="empty">${escapeHtml(isAr ? "لا توجد معاملات مالية مسجلة." : "No financial transactions recorded.")}</p>` : `<table><thead><tr><th>${escapeHtml(isAr ? "الشهر" : "Month")}</th><th>${escapeHtml(isAr ? "السنة" : "Year")}</th><th>${escapeHtml(isAr ? "الخدمة" : "Service")}</th><th>${escapeHtml(isAr ? "الإجمالي" : "Total")}</th><th>${escapeHtml(isAr ? "المدفوع" : "Paid")}</th><th>${escapeHtml(isAr ? "الرصيد" : "Balance")}</th><th>${escapeHtml(isAr ? "الحالة" : "Status")}</th></tr></thead>
        <tbody>${statementForReport.rows.map((p) => {
			return `<tr><td>${escapeHtml(isAr ? p.month : arabicMonths$1.includes(p.month) ? englishMonths[arabicMonths$1.indexOf(p.month)] : p.month)}</td><td>${escapeHtml(p.year)}</td><td>${escapeHtml(p.service)}</td><td>${escapeHtml(p.total)}</td><td>${escapeHtml(p.paid)}</td><td>${escapeHtml(p.balance)}</td><td>${escapeHtml(p.status)}</td></tr>`;
		}).join("")}</tbody></table>`;
		const notesHtml = `<p>${escapeHtml(child.notes || (isAr ? "لا توجد ملاحظات." : "No notes."))}</p>`;
		tableHtml = [
			section(isAr ? "📋 البيانات الشخصية" : "📋 Personal Information", personalInfo),
			section(isAr ? "🏷️ الخدمات والمعلمون" : "🏷️ Services & Teachers", servicesHtml),
			section(isAr ? "📅 سجل الحضور" : "📅 Attendance History", attendanceHtml),
			section(isAr ? "💰 السجل المالي" : "💰 Payment History", paymentsHtml),
			section(isAr ? "📝 ملاحظات" : "📝 Notes", notesHtml)
		].join("");
	}
	return `<!doctype html>
<html dir="${dir}" lang="${params.lang}">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: sans-serif; color: #1e293b; padding: 24px; }
  h1 { color: ${brand.primaryColor}; font-size: 18px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 13px; text-align: ${isAr ? "right" : "left"}; }
  h2 { color: #fff; background: ${brand.primaryColor}; font-size: 13px; padding: 6px 10px; margin-top: 18px; }
  td.label { color: #64748b; font-weight: bold; width: 160px; }
  th { background: ${brand.primaryColor}; color: #fff; }
  tr.totals { font-weight: bold; background: #f1f5f9; }
  .empty { color: #94a3b8; font-style: italic; text-align: center; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>${escapeHtml(brand.orgName)}</h1>
  <div class="meta">${escapeHtml(title)}<br/>${escapeHtml(filterSummary)}<br/>${isAr ? "تاريخ الإنشاء" : "Generated"}: ${escapeHtml(now)}</div>
  ${tableHtml}
</body>
</html>`;
}
//#endregion
//#region electron/ipc/exportIPC.ts
function checkAuth$6() {
	const user = getCurrentUser();
	if (!user) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
	return user;
}
async function executeExport(type, params, defaultFilename) {
	const isAr = params.lang === "ar";
	const filters = params.format === "xlsx" ? [{
		name: "Excel Workbook (*.xlsx)",
		extensions: ["xlsx"]
	}] : params.format === "csv" ? [{
		name: "CSV (*.csv)",
		extensions: ["csv"]
	}] : [{
		name: "PDF Document (*.pdf)",
		extensions: ["pdf"]
	}];
	const result = await dialog.showSaveDialog({
		title: isAr ? "حفظ ملف التصدير" : "Save Exported File",
		defaultPath: defaultFilename,
		filters
	});
	if (result.canceled || !result.filePath) return null;
	const savePath = result.filePath;
	if (params.format === "xlsx") await buildExcelFile(type, params, savePath);
	else if (params.format === "csv") await buildCsvFile(type, params, savePath);
	else await buildPdfFile(type, params, savePath);
	return { filePath: savePath };
}
ipcMain.handle("export:full", async (_event, { year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `التقرير_السنوي_الشامل_${year}.${format}` : `full_annual_report_${year}.${format}`;
		return await executeExport("full", {
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run full export:", error);
		throw new Error(error.message || "Failed to complete full database export");
	}
});
ipcMain.handle("export:month", async (_event, { month, year, format, lang, paymentIds }) => {
	try {
		checkAuth$6();
		const filename = lang === "ar" ? `مطالبات_${month}_${year}.${format}` : `billing_${month}_${year}.${format}`;
		return await executeExport("month", {
			month,
			year,
			format,
			lang,
			paymentIds
		}, filename);
	} catch (error) {
		console.error("Failed to run month payments export:", error);
		throw new Error(error.message || "Failed to export monthly payments");
	}
});
ipcMain.handle("export:child", async (_event, { childId, format, lang }) => {
	try {
		checkAuth$6();
		const filename = lang === "ar" ? `كشف_حساب_طفل_${childId}.${format}` : `child_statement_${childId}.${format}`;
		return await executeExport("child", {
			childId,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run child statement export:", error);
		throw new Error(error.message || "Failed to export child statement");
	}
});
ipcMain.handle("export:childReport", async (_event, { childId, format, lang }) => {
	try {
		checkAuth$6();
		const filename = lang === "ar" ? `تقرير_طفل_شامل_${childId}.${format}` : `child_report_${childId}.${format}`;
		return await executeExport("childReport", {
			childId,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run child report export:", error);
		throw new Error(error.message || "Failed to export child report");
	}
});
ipcMain.handle("export:salaries", async (_event, { month, year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `رواتب_${month}_${year}.${format}` : `payroll_${month}_${year}.${format}`;
		return await executeExport("salaries", {
			month,
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run salaries export:", error);
		throw new Error(error.message || "Failed to export payroll report");
	}
});
ipcMain.handle("export:payrollReport", async (_event, { month, year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `تقرير_رواتب_المعلمين_${month}_${year}.${format}` : `teacher_payroll_report_${month}_${year}.${format}`;
		return await executeExport("payrollReport", {
			month,
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run payroll report export:", error);
		throw new Error(error.message || "Failed to export payroll report");
	}
});
ipcMain.handle("export:employees", async (_event, { format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `سجل_الموظفين.${format}` : `employees_roster.${format}`;
		return await executeExport("employees", {
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run employees export:", error);
		throw new Error(error.message || "Failed to export employees roster");
	}
});
ipcMain.handle("export:expenses", async (_event, { year, format, lang }) => {
	try {
		requireAdmin();
		const filename = lang === "ar" ? `مصاريف_تشغيلية_${year}.${format}` : `expenses_report_${year}.${format}`;
		return await executeExport("expenses", {
			year,
			format,
			lang
		}, filename);
	} catch (error) {
		console.error("Failed to run expenses export:", error);
		throw new Error(error.message || "Failed to export expenses report");
	}
});
ipcMain.handle("print:preview", async (_event, args) => {
	try {
		if (args.reportType === "payroll" || args.reportType === "expenses") requireAdmin();
		else checkAuth$6();
		return { html: buildPrintPreviewHtml(args.reportType, args) };
	} catch (error) {
		console.error("Failed to build print preview:", error);
		throw new Error(error.message || "Failed to build print preview");
	}
});
//#endregion
//#region electron/ipc/progress.ts
/**
* Build a progress reporter bound to the invoking renderer. Each call emits a
* `progress:update` event carrying a 0–100 percent so the UI can show a real
* progress bar instead of an indeterminate spinner.
*/
function progressReporter(event, op) {
	return (current, total, phase = "") => {
		const percent = total > 0 ? Math.min(100, Math.max(0, Math.round(current / total * 100))) : 0;
		try {
			event.sender.send("progress:update", {
				op,
				phase,
				current,
				total,
				percent
			});
		} catch {}
	};
}
//#endregion
//#region electron/services/cloudinaryService.ts
/**
* Compute a Cloudinary upload signature: sha1 of the request params (sorted by
* key, joined as `k=v&...`) followed by the API secret. Exported for unit
* testing (feature 004, FR — no network needed).
*/
function signParams(params, apiSecret) {
	const toSign = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
	return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}
/**
* Upload an image (data URL or raw base64/remote URL accepted by Cloudinary's
* `file` field) to Cloudinary via a signed REST request. Runs in the main
* process only; the API secret never leaves here. Throws a descriptive error
* when Cloudinary is not configured or the request fails — the caller (renderer)
* catches it and proceeds to save the child without a photo (offline-safe).
*/
async function uploadImage(dataUrl, folder = "nursery/children") {
	const config = getCloudinaryConfig();
	if (!config) throw new Error("Cloudinary is not configured / لم يتم إعداد Cloudinary");
	if (!dataUrl) throw new Error("No image provided / لا توجد صورة");
	const timestamp = Math.floor(Date.now() / 1e3);
	const signature = signParams({
		folder,
		timestamp
	}, config.apiSecret);
	const form = new FormData();
	form.append("file", dataUrl);
	form.append("api_key", config.apiKey);
	form.append("timestamp", String(timestamp));
	form.append("folder", folder);
	form.append("signature", signature);
	const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;
	const res = await fetch(endpoint, {
		method: "POST",
		body: form
	});
	if (!res.ok) {
		let detail = "";
		try {
			const body = await res.json();
			detail = body?.error?.message ? `: ${body.error.message}` : "";
		} catch {}
		throw new Error(`Cloudinary upload failed (${res.status})${detail}`);
	}
	const body = await res.json();
	return {
		url: body.secure_url,
		publicId: body.public_id
	};
}
/**
* Upload any file (data URL) to Cloudinary via a signed REST request, targeting the
* `/auto/upload` endpoint so Cloudinary detects the resource type itself (image, video,
* or raw for documents/audio/anything else). Used by the child activity diary, which
* accepts attachments of any type.
*/
async function uploadFile(dataUrl, folder = "nursery/children") {
	const config = getCloudinaryConfig();
	if (!config) throw new Error("Cloudinary is not configured / لم يتم إعداد Cloudinary");
	if (!dataUrl) throw new Error("No file provided / لا يوجد ملف");
	const timestamp = Math.floor(Date.now() / 1e3);
	const signature = signParams({
		folder,
		timestamp
	}, config.apiSecret);
	const form = new FormData();
	form.append("file", dataUrl);
	form.append("api_key", config.apiKey);
	form.append("timestamp", String(timestamp));
	form.append("folder", folder);
	form.append("signature", signature);
	const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/auto/upload`;
	const res = await fetch(endpoint, {
		method: "POST",
		body: form
	});
	if (!res.ok) {
		let detail = "";
		try {
			const body = await res.json();
			detail = body?.error?.message ? `: ${body.error.message}` : "";
		} catch {}
		throw new Error(`Cloudinary file upload failed (${res.status})${detail}`);
	}
	const body = await res.json();
	return {
		url: body.secure_url,
		publicId: body.public_id
	};
}
/**
* Upload a video (data URL or remote URL) to Cloudinary via a signed REST request,
* identical in shape to `uploadImage` but targeting the `/video/upload` endpoint with
* `resource_type=video` (feature 009 — child activity/diary media).
*/
async function uploadVideo(dataUrl, folder = "nursery/children") {
	const config = getCloudinaryConfig();
	if (!config) throw new Error("Cloudinary is not configured / لم يتم إعداد Cloudinary");
	if (!dataUrl) throw new Error("No video provided / لا يوجد فيديو");
	const timestamp = Math.floor(Date.now() / 1e3);
	const signature = signParams({
		folder,
		timestamp
	}, config.apiSecret);
	const form = new FormData();
	form.append("file", dataUrl);
	form.append("api_key", config.apiKey);
	form.append("timestamp", String(timestamp));
	form.append("folder", folder);
	form.append("signature", signature);
	const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/video/upload`;
	const res = await fetch(endpoint, {
		method: "POST",
		body: form
	});
	if (!res.ok) {
		let detail = "";
		try {
			const body = await res.json();
			detail = body?.error?.message ? `: ${body.error.message}` : "";
		} catch {}
		throw new Error(`Cloudinary video upload failed (${res.status})${detail}`);
	}
	const body = await res.json();
	return {
		url: body.secure_url,
		publicId: body.public_id
	};
}
//#endregion
//#region electron/ipc/storageIPC.ts
/**
* storage:uploadPhoto { dataUrl, folder? }
* Uploads a child photo to Cloudinary from the main process (signed request;
* the API secret never reaches the renderer). Auth-level — employees may add
* children with photos (feature 004). Returns { url, publicId }. Throws when
* Cloudinary is unconfigured/unreachable; the renderer then saves the child
* without a photo (offline-safe, FR-004a).
*/
ipcMain.handle("storage:uploadPhoto", async (_event, { dataUrl, folder }) => {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
	return uploadImage(dataUrl, folder);
});
/**
* storage:stats
* Returns counts for all major tables and database file size.
* Admin only.
*/
ipcMain.handle("storage:stats", async () => {
	try {
		requireAdmin();
		const db = getDb();
		const counts = {
			users: db.prepare("SELECT COUNT(*) as c FROM users").get().c,
			children: db.prepare("SELECT COUNT(*) as c FROM children").get().c,
			payments: db.prepare("SELECT COUNT(*) as c FROM payments").get().c,
			employees: db.prepare("SELECT COUNT(*) as c FROM employees").get().c,
			salary_payments: db.prepare("SELECT COUNT(*) as c FROM salary_payments").get().c,
			expenses: db.prepare("SELECT COUNT(*) as c FROM expenses").get().c
		};
		let sizeBytes = 0;
		try {
			const dbPath = path.join(app.getPath("userData"), "nursery.db");
			if (fs.existsSync(dbPath)) sizeBytes = fs.statSync(dbPath).size;
		} catch {}
		return {
			counts,
			sizeBytes
		};
	} catch (error) {
		console.error("storage:stats error:", error);
		throw new Error(error.message || "Failed to retrieve storage stats");
	}
});
/**
* storage:backup
* Opens a save dialog and copies the current DB file to the chosen path.
* Admin only.
*/
ipcMain.handle("storage:backup", async (event) => {
	try {
		requireAdmin();
		const report = progressReporter(event, "backup");
		const dbPath = path.join(app.getPath("userData"), "nursery.db");
		const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const result = await dialog.showSaveDialog({
			defaultPath: `nursery-backup-${timestamp}.db`,
			filters: [{
				name: "SQLite Database",
				extensions: ["db"]
			}]
		});
		if (result.canceled || !result.filePath) throw new Error("Backup cancelled");
		report(1, 3, "checkpoint");
		getDb().checkpoint();
		report(2, 3, "copying");
		fs.copyFileSync(dbPath, result.filePath);
		report(3, 3, "done");
		return { path: result.filePath };
	} catch (error) {
		console.error("storage:backup error:", error);
		throw new Error(error.message || "Failed to backup database");
	}
});
/**
* storage:restore
* Opens a file picker and replaces the current DB with the selected backup.
* Admin only.
*/
ipcMain.handle("storage:restore", async (event, { path: restorePath }) => {
	try {
		requireAdmin();
		const report = progressReporter(event, "restore");
		let sourcePath = restorePath;
		if (!sourcePath) {
			const result = await dialog.showOpenDialog({
				properties: ["openFile"],
				filters: [{
					name: "SQLite Database",
					extensions: ["db"]
				}]
			});
			if (result.canceled || result.filePaths.length === 0) throw new Error("Restore cancelled");
			sourcePath = result.filePaths[0];
		}
		if (!fs.existsSync(sourcePath)) throw new Error("Backup file not found");
		const dbPath = path.join(app.getPath("userData"), "nursery.db");
		report(1, 3, "safety backup");
		const backupPath = `${dbPath}.pre-restore-${Date.now()}.bak`;
		fs.copyFileSync(dbPath, backupPath);
		report(2, 3, "restoring");
		closeDb();
		fs.copyFileSync(sourcePath, dbPath);
		initDb();
		report(3, 3, "done");
		return {
			ok: true,
			restoredFrom: sourcePath
		};
	} catch (error) {
		console.error("storage:restore error:", error);
		throw new Error(error.message || "Failed to restore database");
	}
});
/**
* storage:import
* Opens an Excel workbook file picker and imports data from the original workbook format.
* Admin only.
*/
ipcMain.handle("storage:import", async (event, args) => {
	try {
		requireAdmin();
		let filePath = args?.path;
		if (!filePath) {
			const result = await dialog.showOpenDialog({
				properties: ["openFile"],
				filters: [{
					name: "Excel Workbook",
					extensions: ["xlsx", "xls"]
				}]
			});
			if (result.canceled || result.filePaths.length === 0) throw new Error("Import cancelled");
			filePath = result.filePaths[0];
		}
		const { importFromWorkbook } = await import("./importService-39GcvGqD.js");
		return { imported: await importFromWorkbook(filePath, progressReporter(event, "import")) };
	} catch (error) {
		console.error("storage:import error:", error);
		throw new Error(error.message || "Failed to import workbook");
	}
});
/**
* storage:clear
* Truncates all data tables. Requires explicit confirm:true.
* Admin only.
*/
ipcMain.handle("storage:clear", async (_event, { confirm }) => {
	try {
		requireAdmin();
		if (!confirm) throw new Error("Explicit confirmation required to clear data");
		const db = getDb();
		db.pragma("foreign_keys = OFF");
		try {
			db.transaction(() => {
				db.prepare("DELETE FROM payments").run();
				db.prepare("DELETE FROM payment_transactions").run();
				db.prepare("DELETE FROM salary_payments").run();
				db.prepare("DELETE FROM employee_deductions").run();
				db.prepare("DELETE FROM expenses").run();
				db.prepare("DELETE FROM sync_log").run();
				db.prepare("DELETE FROM tombstones").run();
				db.prepare("DELETE FROM child_services").run();
				db.prepare("DELETE FROM children").run();
				db.prepare("DELETE FROM session_teachers").run();
				db.prepare("DELETE FROM scheduled_sessions").run();
				db.prepare("DELETE FROM service_teachers").run();
				db.prepare("DELETE FROM attendance_records").run();
				db.prepare("DELETE FROM attendance_conflicts").run();
				db.prepare("DELETE FROM teacher_payments").run();
				db.prepare("DELETE FROM attendance_edit_requests").run();
				db.prepare("DELETE FROM attendance_audit_log").run();
				db.prepare("DELETE FROM notifications").run();
				db.prepare("DELETE FROM imported_snapshots").run();
				db.prepare("DELETE FROM employees").run();
				db.prepare("DELETE FROM child_activities").run();
				db.prepare("DELETE FROM child_illness_cases").run();
			})();
		} finally {
			db.pragma("foreign_keys = ON");
		}
		return { ok: true };
	} catch (error) {
		console.error("storage:clear error:", error);
		throw new Error(error.message || "Failed to clear data");
	}
});
/**
* storage:audit
* Returns last 50 sync log entries (audit log).
* Admin only.
*/
ipcMain.handle("storage:audit", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT id, action, table_name AS entity_type, record_id, status, error, synced_at AS created_at FROM sync_log ORDER BY id DESC LIMIT 50").all();
	} catch (error) {
		console.error("storage:audit error:", error);
		throw new Error(error.message || "Failed to retrieve audit log");
	}
});
//#endregion
//#region electron/services/mongoSync.ts
/**
* mongoSync.ts — Mongoose models for cloud sync collections.
*
* Each model mirrors the SQLite table structure.
* The _id in MongoDB is the SQLite id (integer) to enable deterministic conflict resolution.
*
* Fields synced to MongoDB match the SQLite columns plus an updated_at timestamp.
*/
var isConnected = false;
var connectionError = null;
var connectPromise = null;
mongoose.connection.on("disconnected", () => {
	isConnected = false;
});
async function convertSrvToStandardUri(uri) {
	if (!uri.startsWith("mongodb+srv://")) return uri;
	try {
		const { Resolver } = promises;
		const resolver = new Resolver();
		resolver.setServers(["8.8.8.8", "8.8.4.4"]);
		const url = new URL(uri);
		const hostname = url.hostname;
		const srvRecords = await resolver.resolveSrv(`_mongodb._tcp.${hostname}`);
		if (!srvRecords || srvRecords.length === 0) throw new Error("No SRV records found");
		const txtOptions = (await resolver.resolveTxt(hostname)).flat().join("&");
		const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(",");
		const credentials = url.username ? `${url.username}:${url.password}@` : "";
		const searchParams = new URLSearchParams(url.search);
		const txtParams = new URLSearchParams(txtOptions);
		for (const [key, value] of txtParams) if (!searchParams.has(key)) searchParams.set(key, value);
		searchParams.set("ssl", "true");
		return `mongodb://${credentials}${hosts}/${url.pathname.replace(/^\//, "")}?${searchParams.toString()}`;
	} catch (error) {
		console.error("Error converting SRV to standard URI, falling back to original:", error);
		return uri;
	}
}
/**
* The MongoDB driver's server-selection timeout always says "check your IP whitelist" —
* that text is hardcoded regardless of the actual cause. Dig into the per-server errors the
* driver actually collected (auth failure, TLS handshake failure, DNS/connection refused, etc.)
* so a failed connect() tells the user something they can actually act on.
*/
function describeConnectFailure(err) {
	const genericMsg = err?.message || "Failed to connect to MongoDB";
	const servers = err?.reason?.servers;
	if (servers && servers.size > 0) {
		const perServer = [...servers.entries()].map(([address, desc]) => {
			const nodeErr = desc?.error;
			if (!nodeErr) return null;
			return `${address}: ${nodeErr.message || String(nodeErr)}`;
		}).filter(Boolean);
		if (perServer.length > 0) {
			const details = perServer.join(" | ");
			if (/bad auth|authentication failed/i.test(details)) return `MongoDB authentication failed — check the username/password in your connection string (and that any special characters like @ : / % are percent-encoded). Details: ${details}`;
			if (/certificate|ssl|tls/i.test(details)) return `MongoDB TLS/SSL handshake failed — often a system clock that's wrong, or a corporate proxy/antivirus intercepting HTTPS/TLS traffic. Details: ${details}`;
			if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(details)) return `Could not resolve the MongoDB Atlas hostname (DNS failure) — check your internet connection or try a different DNS/network. Details: ${details}`;
			if (/ECONNREFUSED|ETIMEDOUT|ENETUNREACH/i.test(details)) return `Could not reach MongoDB Atlas over the network — this really is a connectivity/firewall issue (a corporate network or antivirus may be blocking outbound port 27017), separate from the IP whitelist. Details: ${details}`;
			return `${genericMsg} — per-server details: ${details}`;
		}
	}
	return genericMsg;
}
async function connectMongo(uri) {
	if (isConnected) return;
	if (connectPromise) return connectPromise;
	connectPromise = (async () => {
		try {
			const finalUri = await convertSrvToStandardUri(uri);
			await mongoose.connect(finalUri, {
				serverSelectionTimeoutMS: 1e4,
				connectTimeoutMS: 1e4
			});
			isConnected = true;
			connectionError = null;
		} catch (err) {
			isConnected = false;
			connectionError = describeConnectFailure(err);
			console.error("[mongoSync] connect failed — raw error:", err);
			throw new Error(connectionError || "Failed to connect to MongoDB");
		} finally {
			connectPromise = null;
		}
	})();
	return connectPromise;
}
async function disconnectMongo() {
	if (!isConnected) return;
	await mongoose.disconnect();
	isConnected = false;
}
function getConnectionStatus() {
	return {
		connected: isConnected,
		error: connectionError
	};
}
var sharedOptions = {
	versionKey: false,
	_id: false
};
var childSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	guardian: String,
	guardian_phone: String,
	child_phone: String,
	national_id: String,
	service: String,
	unit: String,
	price: Number,
	reg_date: String,
	notes: String,
	is_active: Number,
	photo_url: String,
	photo_public_id: String,
	teacher_id: Number,
	lesson_days: String,
	sessions_baseline: Number,
	extra_lessons: Number,
	session_price: Number,
	monthly_fee: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ChildModel = mongoose.models["sync_children"] || mongoose.model("sync_children", childSchema);
var paymentSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	child_id: Number,
	service_id: Number,
	service: String,
	unit: String,
	quantity: Number,
	price: Number,
	prorated_calculated: Number,
	month: String,
	year: Number,
	total: Number,
	paid: Number,
	balance: Number,
	status: String,
	notes: String,
	payment_method_id: Number,
	payment_method_name: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var PaymentModel = mongoose.models["sync_payments"] || mongoose.model("sync_payments", paymentSchema);
var childServiceSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	child_id: Number,
	service: String,
	unit: String,
	price: Number,
	teacher_session_rate: Number,
	teacher_id: Number,
	lesson_days: String,
	extra_lessons: Number,
	session_price: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ChildServiceModel = mongoose.models["sync_child_services"] || mongoose.model("sync_child_services", childServiceSchema);
var userSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	username: String,
	password: String,
	role: String,
	name: String,
	is_active: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var UserModel = mongoose.models["sync_users"] || mongoose.model("sync_users", userSchema);
var settingSchema = new Schema({
	id: {
		type: String,
		required: true,
		unique: true
	},
	key: String,
	value: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var SettingModel = mongoose.models["sync_settings"] || mongoose.model("sync_settings", settingSchema);
var tombstoneSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	entity: String,
	record_id: Number,
	created_at: String,
	synced: Number
}, sharedOptions);
var TombstoneModel = mongoose.models["sync_tombstones"] || mongoose.model("sync_tombstones", tombstoneSchema);
var employeeSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	role: String,
	role_id: Number,
	salary_type_override_id: Number,
	base_salary: Number,
	housing: Number,
	transport: Number,
	net_salary: Number,
	is_active: Number,
	created_at: String,
	updated_at: String,
	synced: Number,
	teacher_session_rate: Number
}, sharedOptions);
var EmployeeModel = mongoose.models["sync_employees"] || mongoose.model("sync_employees", employeeSchema);
var salaryPaymentSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	employee_id: Number,
	month: String,
	year: Number,
	bonus: Number,
	deductions: Number,
	actual_paid: Number,
	paid_date: String,
	notes: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var SalaryPaymentModel = mongoose.models["sync_salary_payments"] || mongoose.model("sync_salary_payments", salaryPaymentSchema);
var expenseSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	item: String,
	month: String,
	year: Number,
	amount: Number,
	category: String,
	notes: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ExpenseModel = mongoose.models["sync_expenses"] || mongoose.model("sync_expenses", expenseSchema);
var importedSnapshotSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	sheet: String,
	row_index: Number,
	data_json: String,
	imported_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ImportedSnapshotModel = mongoose.models["sync_imported_snapshots"] || mongoose.model("sync_imported_snapshots", importedSnapshotSchema);
var salaryTypeSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	mode: String,
	monthly_rate: Number,
	session_rate: Number,
	session_pct: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var SalaryTypeModel = mongoose.models["sync_salary_types"] || mongoose.model("sync_salary_types", salaryTypeSchema);
var employeeRoleSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	salary_type_id: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var EmployeeRoleModel = mongoose.models["sync_employee_roles"] || mongoose.model("sync_employee_roles", employeeRoleSchema);
var serviceDefinitionSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	is_custom: Number,
	price_monthly: Number,
	price_daily: Number,
	price_hourly: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ServiceDefinitionModel = mongoose.models["sync_service_definitions"] || mongoose.model("sync_service_definitions", serviceDefinitionSchema);
var scheduledSessionSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	session_date: String,
	service_id: Number,
	group_name: String,
	notes: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ScheduledSessionModel = mongoose.models["sync_scheduled_sessions"] || mongoose.model("sync_scheduled_sessions", scheduledSessionSchema);
var sessionTeacherSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	session_id: Number,
	employee_id: Number,
	synced: Number
}, sharedOptions);
var SessionTeacherModel = mongoose.models["sync_session_teachers"] || mongoose.model("sync_session_teachers", sessionTeacherSchema);
var attendanceRecordSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	session_id: Number,
	child_id: Number,
	status: String,
	excuse_notes: String,
	recorded_by: Number,
	recorded_at: String,
	updated_at: String,
	synced: Number,
	attended_teacher_id: Number,
	teacher_status: String
}, sharedOptions);
var AttendanceRecordModel = mongoose.models["sync_attendance_records"] || mongoose.model("sync_attendance_records", attendanceRecordSchema);
var attendanceConflictSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	attendance_record_id: Number,
	overwritten_status: String,
	overwritten_by: String,
	overwritten_at: String,
	winning_status: String,
	winning_by: String,
	winning_at: String,
	reviewed: Number,
	created_at: String,
	synced: Number
}, sharedOptions);
var AttendanceConflictModel = mongoose.models["sync_attendance_conflicts"] || mongoose.model("sync_attendance_conflicts", attendanceConflictSchema);
var paymentMethodSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	name: String,
	is_active: Number,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var PaymentMethodModel = mongoose.models["sync_payment_methods"] || mongoose.model("sync_payment_methods", paymentMethodSchema);
var employeeDeductionSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	employee_id: Number,
	month: String,
	year: Number,
	reason: String,
	amount: Number,
	created_at: String,
	synced: Number
}, sharedOptions);
var EmployeeDeductionModel = mongoose.models["sync_employee_deductions"] || mongoose.model("sync_employee_deductions", employeeDeductionSchema);
var paymentTransactionSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	payment_id: Number,
	amount: Number,
	payment_method_id: Number,
	payment_method_name: String,
	paid_date: String,
	notes: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var PaymentTransactionModel = mongoose.models["sync_payment_transactions"] || mongoose.model("sync_payment_transactions", paymentTransactionSchema);
var serviceTeacherSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	service_id: Number,
	employee_id: Number,
	created_at: String,
	synced: Number
}, sharedOptions);
var ServiceTeacherModel = mongoose.models["sync_service_teachers"] || mongoose.model("sync_service_teachers", serviceTeacherSchema);
var teacherPaymentSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	teacher_id: Number,
	child_id: Number,
	attendance_record_id: Number,
	attendance_date: String,
	session_cost: Number,
	status: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var TeacherPaymentModel = mongoose.models["sync_teacher_payments"] || mongoose.model("sync_teacher_payments", teacherPaymentSchema);
var attendanceEditRequestSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	attendance_record_id: Number,
	child_id: Number,
	teacher_id: Number,
	attendance_date: String,
	original_status: String,
	original_excuse_notes: String,
	original_teacher_status: String,
	requested_status: String,
	requested_excuse_notes: String,
	requested_teacher_status: String,
	reason: String,
	requested_by: Number,
	requested_at: String,
	status: String,
	decided_by: Number,
	decided_at: String,
	decision_notes: String,
	synced: Number
}, sharedOptions);
var AttendanceEditRequestModel = mongoose.models["sync_attendance_edit_requests"] || mongoose.model("sync_attendance_edit_requests", attendanceEditRequestSchema);
var attendanceAuditLogSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	attendance_record_id: Number,
	edit_request_id: Number,
	old_status: String,
	old_excuse_notes: String,
	old_teacher_status: String,
	new_status: String,
	new_excuse_notes: String,
	new_teacher_status: String,
	changed_by: Number,
	approved_by: Number,
	reason: String,
	changed_at: String,
	synced: Number
}, sharedOptions);
var AttendanceAuditLogModel = mongoose.models["sync_attendance_audit_log"] || mongoose.model("sync_attendance_audit_log", attendanceAuditLogSchema);
var notificationSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	user_id: Number,
	type: String,
	related_id: Number,
	message_ar: String,
	message_en: String,
	read_at: String,
	created_at: String,
	synced: Number
}, sharedOptions);
var NotificationModel = mongoose.models["sync_notifications"] || mongoose.model("sync_notifications", notificationSchema);
var childIllnessCaseSchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	child_id: Number,
	status: String,
	description: String,
	opened_at: String,
	resolved_at: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ChildIllnessCaseModel = mongoose.models["sync_child_illness_cases"] || mongoose.model("sync_child_illness_cases", childIllnessCaseSchema);
var childActivitySchema = new Schema({
	id: {
		type: Number,
		required: true,
		unique: true
	},
	child_id: Number,
	activity_date: String,
	note: String,
	media_url: String,
	media_type: String,
	media_status: String,
	created_at: String,
	updated_at: String,
	synced: Number
}, sharedOptions);
var ChildActivityModel = mongoose.models["sync_child_activities"] || mongoose.model("sync_child_activities", childActivitySchema);
var SYNC_ENTITIES = [
	{
		name: "children",
		model: ChildModel,
		table: "children"
	},
	{
		name: "child_services",
		model: ChildServiceModel,
		table: "child_services"
	},
	{
		name: "payments",
		model: PaymentModel,
		table: "payments"
	},
	{
		name: "employees",
		model: EmployeeModel,
		table: "employees"
	},
	{
		name: "salary_payments",
		model: SalaryPaymentModel,
		table: "salary_payments"
	},
	{
		name: "expenses",
		model: ExpenseModel,
		table: "expenses"
	},
	{
		name: "users",
		model: UserModel,
		table: "users"
	},
	{
		name: "settings",
		model: SettingModel,
		table: "settings"
	},
	{
		name: "imported_snapshots",
		model: ImportedSnapshotModel,
		table: "imported_snapshots"
	},
	{
		name: "tombstones",
		model: TombstoneModel,
		table: "tombstones"
	},
	{
		name: "salary_types",
		model: SalaryTypeModel,
		table: "salary_types"
	},
	{
		name: "employee_roles",
		model: EmployeeRoleModel,
		table: "employee_roles"
	},
	{
		name: "service_definitions",
		model: ServiceDefinitionModel,
		table: "service_definitions"
	},
	{
		name: "scheduled_sessions",
		model: ScheduledSessionModel,
		table: "scheduled_sessions"
	},
	{
		name: "session_teachers",
		model: SessionTeacherModel,
		table: "session_teachers"
	},
	{
		name: "attendance_records",
		model: AttendanceRecordModel,
		table: "attendance_records"
	},
	{
		name: "attendance_conflicts",
		model: AttendanceConflictModel,
		table: "attendance_conflicts"
	},
	{
		name: "payment_methods",
		model: PaymentMethodModel,
		table: "payment_methods"
	},
	{
		name: "employee_deductions",
		model: EmployeeDeductionModel,
		table: "employee_deductions"
	},
	{
		name: "payment_transactions",
		model: PaymentTransactionModel,
		table: "payment_transactions"
	},
	{
		name: "service_teachers",
		model: ServiceTeacherModel,
		table: "service_teachers"
	},
	{
		name: "teacher_payments",
		model: TeacherPaymentModel,
		table: "teacher_payments"
	},
	{
		name: "attendance_edit_requests",
		model: AttendanceEditRequestModel,
		table: "attendance_edit_requests"
	},
	{
		name: "attendance_audit_log",
		model: AttendanceAuditLogModel,
		table: "attendance_audit_log"
	},
	{
		name: "notifications",
		model: NotificationModel,
		table: "notifications"
	},
	{
		name: "child_illness_cases",
		model: ChildIllnessCaseModel,
		table: "child_illness_cases"
	},
	{
		name: "child_activities",
		model: ChildActivityModel,
		table: "child_activities"
	}
];
//#endregion
//#region electron/ipc/syncIPC.ts
/**
* Cloud documents are read with `.lean()`, which returns the raw BSON — including any field that
* is NOT in the mongoose schema. Documents written by older versions of the app (or by another
* app sharing the database) carry columns this schema no longer has, e.g. the legacy `student_id`
* that predates `child_id`. Every pull write path builds its SQL from the document's own keys, so
* one such field turns into `no such column: student_id` and fails the record outright.
*
* Filtering the cloud record down to the columns the local table actually has makes the pull
* tolerant of any extra cloud field, not just the ones we know about today.
*/
var tableColumnsCache = /* @__PURE__ */ new Map();
function getTableColumns(db, table) {
	const cached = tableColumnsCache.get(table);
	if (cached) return cached;
	const rows = db.prepare("SELECT name FROM pragma_table_info(?)").all(table);
	const columns = new Set(rows.map((r) => r.name));
	tableColumnsCache.set(table, columns);
	return columns;
}
/**
* Strip cloud-only fields the local table can't store. `id` is always kept even when the table
* has no `id` column (settings keys on `key`, and the pull maps it across itself).
*/
function stripUnknownColumns(cloud, localColumns) {
	const record = { id: cloud.id };
	const dropped = [];
	for (const key of Object.keys(cloud)) {
		if (key === "_id" || key === "__v") continue;
		if (key === "id" || localColumns.has(key)) record[key] = cloud[key];
		else dropped.push(key);
	}
	return {
		record,
		dropped
	};
}
function resolveConflict(local, cloud) {
	const localTs = local.updated_at ? new Date(local.updated_at).getTime() : 0;
	const cloudTs = cloud.updated_at ? new Date(cloud.updated_at).getTime() : 0;
	if (cloudTs > localTs) return "cloud";
	if (localTs > cloudTs) return "local";
	return local.id >= cloud.id ? "local" : "cloud";
}
/**
* When local "wins" a conflict, the cloud row must still be reconciled into local instead of
* discarded — this computes which columns to fill in: any column that's NULL/undefined/empty
* string locally gets the cloud value; local's own non-empty values always take precedence.
* Pure/exported so the merge semantics are unit-testable without a database.
*/
function computeMergeColumns(local, cloud) {
	const columns = [];
	const values = [];
	for (const c of Object.keys(cloud)) {
		if (c === "_id" || c === "id" || c === "__v") continue;
		const localVal = local[c];
		const cloudVal = cloud[c];
		if ((localVal === null || localVal === void 0 || localVal === "") && !(cloudVal === null || cloudVal === void 0 || cloudVal === "")) {
			columns.push(c);
			values.push(cloudVal);
		}
	}
	return {
		columns,
		values
	};
}
/**
* Detects two DIFFERENT records that were independently assigned the same id on two devices.
*
* Every synced table uses SQLite's per-device `INTEGER PRIMARY KEY AUTOINCREMENT` and Mongo keys
* each document on that integer, with no device component anywhere. So if two devices each add a
* payment between syncs, both get the same next id — and sync treats them as the same row, with
* one silently overwriting the other and that record being lost for good.
*
* `created_at` is the tell: the same record synced between devices keeps the timestamp it was
* created with, while two independently-created records have different ones. When they disagree,
* this is NOT a conflict to resolve — it is two distinct records — so the caller must refuse the
* write and surface it rather than picking a "winner" and destroying real data.
*
* A 2-second tolerance absorbs the format difference between the two timestamp styles in the
* codebase (`strftime(...)` truncates to whole seconds, `toISOString()` keeps milliseconds).
* Returns a human-readable explanation, or null when there's no collision.
*/
function detectIdCollision(local, cloud) {
	const localCreated = local?.created_at;
	const cloudCreated = cloud?.created_at;
	if (!localCreated || !cloudCreated) return null;
	const localMs = new Date(localCreated).getTime();
	const cloudMs = new Date(cloudCreated).getTime();
	if (!Number.isFinite(localMs) || !Number.isFinite(cloudMs)) return null;
	if (Math.abs(localMs - cloudMs) <= 2e3) return null;
	return `ID COLLISION on id ${cloud.id} — the local row was created ${localCreated} but the cloud row with the same id was created ${cloudCreated}. These are two different records that two devices each numbered ${cloud.id}. Refusing to overwrite; one of them has to be re-entered so it gets a fresh id.`;
}
/**
* `payments.paid` is a derived column — it is the SUM of that payment's rows in
* `payment_transactions` (see recomputePaymentFromTransactions in paymentsIPC.ts). Sync copies
* the two tables independently, so a pull can legitimately land a `payments` row whose `paid`
* predates the installment rows that arrived with it (or that were already here), leaving a
* payment showing 0 next to transactions that clearly total more.
*
* This runs once at the END of a pull — after every entity, so `payment_transactions` is fully
* populated — and re-derives paid/total/balance/status for any payment that disagrees with its
* own transactions.
*
* Deliberately one-directional — it only ever RAISES `paid` to match transactions that prove
* money was received, never lowers it:
*   - a payment with no transaction rows at all (paid set directly, pre-installments) is never
*     touched, so it can't be zeroed out;
*   - `payments:bulkPay` and `payments:update` legitimately set `paid` ABOVE the transaction sum
*     without writing a matching transaction row, and this must not silently undo them.
* Recovering under-reported money is safe; reducing a recorded payment never is.
*/
function reconcilePaymentTotals(db) {
	const drifted = db.prepare(`
    SELECT p.id AS id, p.quantity AS quantity, p.price AS price, p.paid AS paid,
           p.unit AS unit, p.prorated_calculated AS prorated_calculated,
           ROUND(SUM(t.amount), 2) AS tx_total
    FROM payments p
    JOIN payment_transactions t ON t.payment_id = p.id
    GROUP BY p.id
    HAVING ROUND(SUM(t.amount), 2) - COALESCE(p.paid, 0) > 0.005
  `).all();
	if (drifted.length === 0) return 0;
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const update = db.prepare(`
    UPDATE payments SET paid = ?, total = ?, balance = ?, status = ?, updated_at = ?, synced = 0
    WHERE id = ?
  `);
	for (const row of drifted) {
		const paid = Number(Number(row.tx_total ?? 0).toFixed(2));
		const { total, balance, status } = calculatePaymentPreservingProrate(row, row.quantity, row.price, paid);
		update.run(paid, total, balance, status, now, row.id);
		logSync("pull-reconcile", "payments", row.id, "success", `paid ${row.paid} -> ${paid} (re-derived from payment_transactions)`);
	}
	console.warn(`[sync:pull] re-derived paid/balance for ${drifted.length} payment(s) from their transactions`);
	return drifted.length;
}
function logSync(action, entityType, recordId, status, error = null) {
	try {
		getDb().prepare(`
      INSERT INTO sync_log (action, table_name, record_id, status, error, synced_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(action, entityType, String(recordId), status, error, (/* @__PURE__ */ new Date()).toISOString());
	} catch {}
}
var DEFAULT_MONGO_URI = process.env.MONGO_URI || "mongodb+srv://nursery:nursery@cluster0.ile4s29.mongodb.net/?appName=Cluster0";
function getMongoUri() {
	try {
		return getDb().prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get()?.value || process.env.MONGO_URI || DEFAULT_MONGO_URI;
	} catch {
		return process.env.MONGO_URI || DEFAULT_MONGO_URI;
	}
}
/**
* sync:connect — Connect to MongoDB with given URI.
* Saves URI to settings. Admin only.
*/
ipcMain.handle("sync:connect", async (_event, { uri }) => {
	try {
		requireAdmin();
		if (!uri || !uri.startsWith("mongodb")) throw new Error("Invalid MongoDB URI. Must start with mongodb:// or mongodb+srv://");
		getDb().prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at, synced)
      VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
    `).run("sync_mongo_uri", uri);
		await connectMongo(uri);
		logSync("connect", "connection", "mongodb", "success");
		return { connected: true };
	} catch (error) {
		logSync("connect", "connection", "mongodb", "error", error.message);
		console.error("sync:connect error:", error);
		throw new Error(error.message || "Failed to connect to MongoDB");
	}
});
/**
* sync:reconnect — Reconnect using the URI already saved in settings / env.
* Admin only.
*/
ipcMain.handle("sync:reconnect", async () => {
	try {
		requireAdmin();
		const mongoUri = getMongoUri();
		if (!mongoUri) throw new Error("No MongoDB URI configured. Enter a URI first.");
		await connectMongo(mongoUri);
		logSync("reconnect", "connection", "mongodb", "success");
		return { connected: true };
	} catch (error) {
		logSync("reconnect", "connection", "mongodb", "error", error.message);
		throw new Error(error.message || "Failed to reconnect to MongoDB");
	}
});
/**
* sync:disconnect — Disconnect from MongoDB.
* Admin only.
*/
ipcMain.handle("sync:disconnect", async () => {
	try {
		requireAdmin();
		await disconnectMongo();
		return { connected: false };
	} catch (error) {
		console.error("sync:disconnect error:", error);
		throw new Error(error.message || "Failed to disconnect");
	}
});
/**
* sync:status — Returns sync status: connection, pending counts per entity.
* Any logged-in user (auto-sync runs for every role, so every role may see its status).
*/
ipcMain.handle("sync:status", async () => {
	try {
		checkAuth$10();
		const db = getDb();
		const { connected, error } = getConnectionStatus();
		const pending = {};
		for (const entity of SYNC_ENTITIES) {
			let cq = `SELECT COUNT(*) as c FROM ${entity.table} WHERE synced = 0`;
			if (entity.name === "settings") cq += " AND key != 'sync_mongo_uri'";
			const row = db.prepare(cq).get();
			pending[entity.name] = row?.c ?? 0;
		}
		const mongoUri = getMongoUri();
		const lastLogRow = db.prepare("SELECT synced_at AS created_at, status, action FROM sync_log ORDER BY id DESC LIMIT 1").get();
		const autoIntervalRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_auto_interval'").get();
		const savedInterval = autoIntervalRow ? Number(autoIntervalRow.value) : 1;
		return {
			connected,
			error,
			uri: mongoUri ? "***configured***" : null,
			pending,
			lastSync: lastLogRow || null,
			autoSyncEnabled: savedInterval > 0,
			autoSyncIntervalMinutes: savedInterval > 0 ? savedInterval : 1
		};
	} catch (error) {
		console.error("sync:status error:", error);
		throw new Error(error.message || "Failed to get sync status");
	}
});
var noopReport = () => {};
/** Connect (or reconnect) using the saved URI if the connection is down. */
async function ensureConnected() {
	const { connected } = getConnectionStatus();
	if (!connected) {
		const mongoUri = getMongoUri();
		if (!mongoUri) throw new Error("No MongoDB URI configured. Please connect first.");
		await connectMongo(mongoUri);
	}
}
/**
* Push records to MongoDB for every entity in SYNC_ENTITIES.
* Default mode pushes rows with synced = 0; force pushes every row (overwriting cloud).
*/
async function runPush(force, report = noopReport) {
	try {
		const db = getDb();
		await ensureConnected();
		const results = {};
		let totalCollisions = 0;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		let totalWork = 0;
		for (const entity of SYNC_ENTITIES) {
			let cq = force ? `SELECT COUNT(*) AS c FROM ${entity.table}` : `SELECT COUNT(*) AS c FROM ${entity.table} WHERE synced = 0`;
			if (entity.name === "settings") cq += force ? " WHERE key != 'sync_mongo_uri'" : " AND key != 'sync_mongo_uri'";
			totalWork += db.prepare(cq).get()?.c ?? 0;
		}
		let done = 0;
		report(0, totalWork, "starting");
		for (const entity of SYNC_ENTITIES) {
			let query = force ? `SELECT * FROM ${entity.table}` : `SELECT * FROM ${entity.table} WHERE synced = 0`;
			if (entity.name === "settings") query += force ? ` WHERE key != 'sync_mongo_uri'` : ` AND key != 'sync_mongo_uri'`;
			const unsynced = db.prepare(query).all();
			let pushed = 0;
			let failed = 0;
			let skipped = 0;
			let collisions = 0;
			for (const record of unsynced) {
				const recordKey = entity.name === "settings" ? record.key : record.id;
				try {
					if (!force) {
						const cloudDoc = await entity.model.findOne({ id: recordKey }).lean();
						const collision = cloudDoc ? detectIdCollision(record, cloudDoc) : null;
						if (collision) {
							logSync("push-collision", entity.name, recordKey, "skipped-collision", collision);
							console.error(`[sync:push] ${entity.name}: ${collision}`);
							collisions++;
							skipped++;
							report(++done, totalWork, entity.name);
							continue;
						}
						if (cloudDoc && resolveConflict({
							...record,
							id: recordKey
						}, cloudDoc) === "cloud") {
							logSync("push-skip", entity.name, recordKey, "skipped", "cloud copy is newer — pull will reconcile");
							skipped++;
							report(++done, totalWork, entity.name);
							continue;
						}
					}
					if (entity.name === "settings") {
						await entity.model.findOneAndUpdate({ id: record.key }, {
							...record,
							id: record.key,
							updated_at: record.updated_at || now
						}, {
							upsert: true,
							returnDocument: "after"
						});
						db.prepare(`UPDATE ${entity.table} SET synced = 1 WHERE key = ?`).run(record.key);
						logSync("push", entity.name, record.key, "success");
					} else {
						await entity.model.findOneAndUpdate({ id: record.id }, {
							...record,
							updated_at: record.updated_at || now
						}, {
							upsert: true,
							returnDocument: "after"
						});
						db.prepare(`UPDATE ${entity.table} SET synced = 1 WHERE id = ?`).run(record.id);
						logSync("push", entity.name, record.id, "success");
					}
					pushed++;
				} catch (err) {
					logSync("push", entity.name, recordKey, "error", err.message);
					failed++;
				}
				report(++done, totalWork, entity.name);
			}
			results[entity.name] = {
				pushed,
				failed,
				skipped,
				collisions
			};
			totalCollisions += collisions;
		}
		report(totalWork, totalWork, "done");
		if (totalCollisions > 0) console.error(`[sync:push] ${totalCollisions} record(s) NOT pushed — same id, different record on the other device. See the sync log.`);
		return {
			results,
			collisions: totalCollisions
		};
	} catch (error) {
		logSync("push", "all", "batch", "error", error.message);
		console.error("sync:push error:", error);
		throw new Error(error.message || "Push failed");
	}
}
/**
* Pull records from MongoDB for every entity in SYNC_ENTITIES.
* Default mode applies conflict resolution (most-recent updated_at wins, id tie-break);
* `force` makes every cloud record overwrite local unconditionally — for restoring/importing
* known-good cloud data onto a machine whose local rows have stale-but-technically-"newer"
* timestamps that would otherwise make the pull report everything as "skipped".
*/
async function runPull(force, report = noopReport) {
	try {
		const db = getDb();
		await ensureConnected();
		let totalWork = 0;
		for (const entity of SYNC_ENTITIES) try {
			totalWork += await entity.model.estimatedDocumentCount();
		} catch {}
		let done = 0;
		report(0, totalWork, "starting");
		const results = {};
		let totalCollisions = 0;
		for (const entity of SYNC_ENTITIES) {
			let pulled = 0;
			let merged = 0;
			let skipped = 0;
			let failed = 0;
			let collisions = 0;
			let orphanSkipped = 0;
			const droppedFields = /* @__PURE__ */ new Set();
			const errors = [];
			const skipReasons = [];
			/** Record a pull failure with its reason (logged + returned to the UI). */
			const noteError = (recordId, err) => {
				const message = err instanceof Error ? err.message : String(err);
				if (errors.length < 25) errors.push({
					recordId: String(recordId),
					message
				});
				console.error(`[sync:pull] ${entity.name} record=${recordId}: ${message}`);
			};
			/**
			* Record *why* a record was skipped (not just that it was), so the UI can show the actual
			* cause — e.g. "local looked newer" — instead of a bare skip count admins have no way to
			* act on.
			*/
			const noteSkip = (recordId, message) => {
				if (skipReasons.length < 25) skipReasons.push({
					recordId: String(recordId),
					message
				});
			};
			try {
				const cloudRecords = await entity.model.find({}).lean();
				const localColumns = getTableColumns(db, entity.table);
				for (const cloud of cloudRecords) {
					const { record: cloudRecord, dropped } = stripUnknownColumns(cloud, localColumns);
					for (const field of dropped) droppedFields.add(field);
					try {
						if (entity.name === "tombstones") {
							if (!db.prepare(`SELECT * FROM tombstones WHERE entity = ? AND record_id = ?`).get(cloudRecord.entity, cloudRecord.record_id)) {
								applyCloudTombstones(db, [cloudRecord]);
								logSync("pull-tombstone", entity.name, `${cloudRecord.entity}:${cloudRecord.record_id}`, "success");
								pulled++;
							} else {
								logSync("pull-skip", entity.name, `${cloudRecord.entity}:${cloudRecord.record_id}`, "skipped");
								noteSkip(`${cloudRecord.entity}:${cloudRecord.record_id}`, "already exists locally (tombstone already applied)");
								skipped++;
							}
							continue;
						}
						let local;
						if (entity.name === "settings") local = db.prepare(`SELECT * FROM settings WHERE key = ?`).get(cloudRecord.id);
						else local = db.prepare(`SELECT * FROM ${entity.table} WHERE id = ?`).get(cloudRecord.id);
						if (!local) {
							const columns = Object.keys(cloudRecord).filter((k) => k !== "_id" && k !== "__v");
							const placeholders = columns.map(() => "?").join(", ");
							const values = columns.map((c) => cloudRecord[c]);
							if (entity.name === "settings") {
								const keyIndex = columns.indexOf("id");
								if (keyIndex !== -1) columns[keyIndex] = "key";
							}
							db.prepare(`INSERT OR IGNORE INTO ${entity.table} (${columns.join(", ")}) VALUES (${placeholders})`).run(...values);
							logSync("pull-insert", entity.name, cloudRecord.id, "success");
							pulled++;
						} else {
							const collision = detectIdCollision(local, cloudRecord);
							if (collision) {
								logSync("pull-collision", entity.name, cloudRecord.id, "skipped-collision", collision);
								console.error(`[sync:pull] ${entity.name}: ${collision}`);
								noteSkip(cloudRecord.id, collision);
								collisions++;
								skipped++;
								report(++done, totalWork, entity.name);
								continue;
							}
							if (entity.name === "settings") local.id = local.key;
							if ((force ? "cloud" : resolveConflict(local, cloudRecord)) === "cloud") {
								const columns = Object.keys(cloudRecord).filter((k) => k !== "_id" && k !== "id" && k !== "__v");
								const setClause = columns.map((c) => `${c} = ?`).join(", ");
								const values = columns.map((c) => cloudRecord[c]);
								values.push(cloudRecord.id);
								if (entity.name === "settings") db.prepare(`UPDATE ${entity.table} SET ${setClause}, synced = 1 WHERE key = ?`).run(...values);
								else db.prepare(`UPDATE ${entity.table} SET ${setClause}, synced = 1 WHERE id = ?`).run(...values);
								logSync("pull-update", entity.name, cloudRecord.id, "success");
								pulled++;
							} else {
								const { columns: changedColumns, values: mergedValues } = computeMergeColumns(local, cloudRecord);
								if (changedColumns.length > 0) {
									const setClause = changedColumns.map((c) => `${c} = ?`).join(", ");
									const idField = entity.name === "settings" ? "key" : "id";
									db.prepare(`UPDATE ${entity.table} SET ${setClause}, synced = 1 WHERE ${idField} = ?`).run(...mergedValues, cloudRecord.id);
									const reason = `merged — filled in ${changedColumns.join(", ")} from cloud (local values for everything else kept)`;
									logSync("pull-merge", entity.name, cloudRecord.id, "merged", reason);
									noteSkip(cloudRecord.id, reason);
									merged++;
								} else {
									const idField = entity.name === "settings" ? "key" : "id";
									db.prepare(`UPDATE ${entity.table} SET synced = 1 WHERE ${idField} = ?`).run(cloudRecord.id);
									const reason = "already identical to cloud — marked synced, nothing to merge";
									logSync("pull-merge", entity.name, cloudRecord.id, "merged", reason);
									noteSkip(cloudRecord.id, reason);
									merged++;
								}
							}
						}
					} catch (err) {
						const message = err instanceof Error ? err.message : String(err);
						if (/FOREIGN KEY/i.test(message)) {
							orphanSkipped++;
							skipped++;
							logSync("pull", entity.name, cloudRecord.id, "skipped-orphan", message);
							noteSkip(cloudRecord.id, `orphaned — references a missing parent record (stale cloud data): ${message}`);
						} else {
							logSync("pull", entity.name, cloudRecord.id, "error", message);
							noteError(cloudRecord.id, err);
							failed++;
						}
					}
					report(++done, totalWork, entity.name);
				}
			} catch (err) {
				logSync("pull", entity.name, "batch", "error", err.message);
				noteError("batch", err);
				failed++;
			}
			if (droppedFields.size > 0) {
				console.warn(`[sync:pull] ${entity.name}: ignored cloud field(s) with no local column: ${[...droppedFields].join(", ")}`);
				logSync("pull", entity.name, "batch", "success", `ignored unknown cloud field(s): ${[...droppedFields].join(", ")}`);
			}
			if (orphanSkipped > 0) {
				console.warn(`[sync:pull] ${entity.name}: skipped ${orphanSkipped} orphaned cloud row(s) (missing parent record)`);
				if (errors.length < 25) errors.push({
					recordId: "orphans",
					message: `${orphanSkipped} skipped — reference a missing parent record (stale cloud data)`
				});
			}
			if (collisions > 0) {
				console.error(`[sync:pull] ${entity.name}: ${collisions} id collision(s) — cloud records left unapplied to avoid destroying local records with the same id`);
				if (errors.length < 25) errors.push({
					recordId: "collisions",
					message: `${collisions} record(s) share an id with a DIFFERENT local record and were not applied — see the sync log`
				});
			}
			results[entity.name] = {
				pulled,
				merged,
				skipped,
				failed,
				collisions,
				errors,
				skipReasons
			};
			totalCollisions += collisions;
		}
		let reconciledPayments = 0;
		try {
			reconciledPayments = reconcilePaymentTotals(db);
		} catch (err) {
			logSync("pull-reconcile", "payments", "batch", "error", err?.message ?? String(err));
			console.error("[sync:pull] payment reconciliation failed:", err);
		}
		report(totalWork, totalWork, "done");
		return {
			results,
			reconciledPayments,
			collisions: totalCollisions
		};
	} catch (error) {
		logSync("pull", "all", "batch", "error", error.message);
		console.error("sync:pull error:", error);
		throw new Error(error.message || "Pull failed");
	}
}
/**
* sync:push — Push all unsynced records to MongoDB (all rows when force: true).
* Any logged-in user — sync must work for every role, same as the automatic cycle.
* Graceful: reports pushed/failed counts per entity.
*/
ipcMain.handle("sync:push", async (event, args) => {
	checkAuth$10();
	return runPush(args?.force === true, progressReporter(event, "push"));
});
/**
* sync:pull — Pull records from MongoDB (cloud always wins when force: true).
* Any logged-in user — sync must work for every role, same as the automatic cycle.
*/
ipcMain.handle("sync:pull", async (event, args) => {
	checkAuth$10();
	return runPull(args?.force === true, progressReporter(event, "pull"));
});
var autoSyncTimer = null;
var autoSyncRunning = false;
var lastAutoSyncState = "idle";
function broadcastAutoSyncStatus(state) {
	lastAutoSyncState = state;
	for (const win of BrowserWindow.getAllWindows()) win.webContents.send("sync:auto-status", { state });
}
ipcMain.handle("sync:auto-status:get", () => ({
	state: lastAutoSyncState,
	running: autoSyncRunning
}));
async function runAutoSyncCycle() {
	if (autoSyncRunning) return;
	autoSyncRunning = true;
	try {
		broadcastAutoSyncStatus("connecting");
		await ensureConnected();
		broadcastAutoSyncStatus("pushing");
		await runPush(true);
		broadcastAutoSyncStatus("pulling");
		await runPull(true);
		broadcastAutoSyncStatus("done");
	} catch (err) {
		console.error("Auto-sync error:", err);
		broadcastAutoSyncStatus("error");
	} finally {
		autoSyncRunning = false;
	}
}
function startAutoSync(intervalMs) {
	if (autoSyncTimer) clearInterval(autoSyncTimer);
	autoSyncTimer = setInterval(() => {
		runAutoSyncCycle();
	}, intervalMs);
	setTimeout(() => {
		runAutoSyncCycle();
	}, 5e3);
}
function stopAutoSync() {
	if (autoSyncTimer) {
		clearInterval(autoSyncTimer);
		autoSyncTimer = null;
	}
}
/**
* sync:auto-sync — Enable/disable auto-sync and set the interval.
* Any logged-in user — employees can turn on the forced auto-sync cycle too.
*/
ipcMain.handle("sync:auto-sync", async (_event, { enabled, intervalMinutes = 1 }) => {
	try {
		checkAuth$10();
		const db = getDb();
		if (enabled) {
			startAutoSync(intervalMinutes * 60 * 1e3);
			db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at, synced)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
      `).run("sync_auto_interval", String(intervalMinutes));
			return {
				autoSync: true,
				intervalMinutes
			};
		} else {
			stopAutoSync();
			db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at, synced)
        VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
      `).run("sync_auto_interval", "0");
			return { autoSync: false };
		}
	} catch (error) {
		console.error("sync:auto-sync error:", error);
		throw new Error(error.message || "Failed to configure auto-sync");
	}
});
//#endregion
//#region electron/ipc/dashboardIPC.ts
var arabicMonths = ARABIC_MONTH_NAMES;
function calculateDashboard(payments, expenses, salaries, targetProfitPct) {
	let invoiced = 0;
	let billed = 0;
	let collected = 0;
	let childrenArrears = 0;
	for (const p of payments) {
		invoiced += p.expected_total;
		billed += p.total;
		collected += p.paid;
		const outstanding = p.expected_total - p.paid;
		if (outstanding > 0) childrenArrears += outstanding;
	}
	const collectionRate = invoiced > 0 ? Number((collected / invoiced).toFixed(2)) : 0;
	let expensesTotal = 0;
	for (const e of expenses) expensesTotal += e.amount;
	const salariesTotal = salaries.paid;
	const arrearsChildren = Number(childrenArrears.toFixed(2));
	const arrearsSalaries = Number(salaries.remaining.toFixed(2));
	const arrearsExpenses = Number(expensesTotal.toFixed(2));
	const arrears = Number((arrearsChildren + arrearsSalaries + arrearsExpenses).toFixed(2));
	const netProfit = Number((collected - (expensesTotal + salariesTotal)).toFixed(2));
	const totalExpenses = expensesTotal + salariesTotal;
	const targetRequired = targetProfitPct < 1 ? Number((totalExpenses / (1 - targetProfitPct)).toFixed(2)) : 0;
	const gap = Number(Math.max(0, targetRequired - collected).toFixed(2));
	return {
		invoiced: Number(invoiced.toFixed(2)),
		billed: Number(billed.toFixed(2)),
		collected: Number(collected.toFixed(2)),
		arrears,
		arrearsBreakdown: {
			children: arrearsChildren,
			salaries: arrearsSalaries,
			expenses: arrearsExpenses
		},
		collectionRate,
		expensesTotal: Number(expensesTotal.toFixed(2)),
		salariesTotal: Number(salariesTotal.toFixed(2)),
		salariesDue: Number(salaries.due.toFixed(2)),
		netProfit,
		targetRequired,
		gap
	};
}
/**
* Payroll cost and outstanding payroll for a month.
*
* A `salary_payments` row only exists once payroll has been recorded, so "unpaid salaries"
* cannot be read from a column — it is derived the same way the Salaries screen derives it
* (`computeBaseSalary` + bonus − itemised deductions), less whatever was actually paid.
* Active employees with no payroll row yet therefore count as fully outstanding.
*/
function getSalaryTotals(db, month, year) {
	const rows = db.prepare(`
    SELECT e.id as employee_id, COALESCE(s.bonus, 0) as bonus, s.actual_paid as stored_actual_paid
    FROM employees e
    LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
    WHERE e.is_active = 1 OR s.id IS NOT NULL
  `).all(month, year);
	const deductionStmt = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?");
	let due = 0;
	let paid = 0;
	let remaining = 0;
	for (const row of rows) {
		const { base } = computeBaseSalary(db, row.employee_id, month, year);
		const deductions = deductionStmt.get(row.employee_id, month, Number(year))?.total ?? 0;
		const employeeDue = base + (row.bonus ?? 0) - deductions;
		const employeePaid = row.stored_actual_paid ?? 0;
		due += employeeDue;
		paid += employeePaid;
		remaining += Math.max(0, employeeDue - employeePaid);
	}
	return {
		due: Number(due.toFixed(2)),
		paid: Number(paid.toFixed(2)),
		remaining: Number(remaining.toFixed(2))
	};
}
function checkAuth$5() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
/**
* Every line that feeds a Dashboard KPI, with the inputs each amount was derived FROM.
*
* The KPI cards are sums of sums — `dashboard:get` returns only the totals, so a figure that
* looks wrong is unarguable from the Dashboard alone. This returns the raw contributing rows
* plus the derivation inputs (quantity source, unit rate, pro-rating, lesson-day schedule,
* salary mode and session counts) so every card can open a page that shows where its number
* came from. Formatting/labelling is left to the renderer, which owns the AR/EN wording.
*/
ipcMain.handle("dashboard:breakdown", async (_event, { month, year }) => {
	try {
		checkAuth$5();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const monthIndex = arabicMonths.indexOf(month);
		const today = /* @__PURE__ */ new Date();
		const isCurrentMonth = monthIndex === today.getMonth() && Number(year) === today.getFullYear();
		const daysInMonth = monthIndex !== -1 ? new Date(Number(year), monthIndex + 1, 0).getDate() : 30;
		const children = attachExpectedTotals(db.prepare(`
        SELECT p.id, p.child_id, p.service, p.unit, p.quantity, p.price, p.total, p.paid,
               p.balance, p.status, p.prorated_calculated, p.notes,
               c.name as child_name, c.guardian,
               COALESCE(NULLIF(cs.lesson_days, '[]'), c.lesson_days) as service_lesson_days
        FROM payments p
        JOIN children c ON p.child_id = c.id
        LEFT JOIN child_services cs ON cs.id = p.service_id
        WHERE p.month = ? AND p.year = ?
        ORDER BY c.name ASC, p.service ASC
      `).all(month, year), month, year).map((p) => {
			let lessonDays = [];
			try {
				lessonDays = JSON.parse(p.service_lesson_days || "[]");
			} catch {}
			return {
				paymentId: p.id,
				childId: p.child_id,
				childName: p.child_name,
				guardian: p.guardian,
				service: p.service,
				unit: p.unit,
				/** Quantity already billed from recorded attendance. */
				billedQuantity: Number(p.quantity ?? 0),
				/** Full scheduled quantity for the month (billed + still-scheduled days). */
				expectedQuantity: Number(p.expected_quantity ?? 0),
				price: Number(p.price ?? 0),
				/** Set only for mid-month enrollments: the pro-rated month rate that replaces `price`. */
				proratedRate: p.prorated_calculated == null ? null : Number(p.prorated_calculated),
				/** quantity × price so far. */
				billedTotal: Number(p.total ?? 0),
				/** expectedQuantity × (proratedRate ?? price) — the month-end figure. */
				expectedTotal: Number(p.expected_total ?? 0),
				paid: Number(p.paid ?? 0),
				outstanding: Number(Math.max(0, Number(p.expected_total ?? 0) - Number(p.paid ?? 0)).toFixed(2)),
				status: p.status,
				lessonDays,
				notes: p.notes
			};
		});
		const collections = db.prepare(`
      SELECT * FROM (
        SELECT pt.id as id, c.name as child_name, p.service as service, pt.amount as amount,
               COALESCE(NULLIF(pt.payment_method_name, ''), 'غير محدد') as method,
               pt.paid_date as date, pt.notes as notes, 0 as is_legacy
        FROM payment_transactions pt
        JOIN payments p ON pt.payment_id = p.id
        JOIN children c ON p.child_id = c.id
        WHERE p.month = ? AND p.year = ?
        UNION ALL
        SELECT p.id as id, c.name as child_name, p.service as service, p.paid as amount,
               COALESCE(NULLIF(p.payment_method_name, ''), 'غير محدد') as method,
               p.updated_at as date, p.notes as notes, 1 as is_legacy
        FROM payments p
        JOIN children c ON p.child_id = c.id
        WHERE p.month = ? AND p.year = ? AND p.paid > 0
          AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.payment_id = p.id)
      )
      ORDER BY date DESC
    `).all(month, year, month, year).map((r) => ({
			id: r.id,
			childName: r.child_name,
			service: r.service,
			amount: Number((r.amount ?? 0).toFixed(2)),
			method: r.method,
			date: r.date,
			notes: r.notes,
			isLegacy: r.is_legacy === 1
		}));
		const employeeRows = db.prepare(`
      SELECT e.id as employee_id, e.name, e.net_salary,
             COALESCE(s.bonus, 0) as bonus, s.actual_paid as stored_actual_paid, s.paid_date
      FROM employees e
      LEFT JOIN salary_payments s ON e.id = s.employee_id AND s.month = ? AND s.year = ?
      WHERE e.is_active = 1 OR s.id IS NOT NULL
      ORDER BY e.name ASC
    `).all(month, year);
		const deductionRowsStmt = db.prepare("SELECT reason, amount FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ?");
		const salaries = employeeRows.map((row) => {
			const { base, payableSessions, totalSessions, salaryTypeName, salaryTypeMode } = computeBaseSalary(db, row.employee_id, month, year);
			const deductionItems = deductionRowsStmt.all(row.employee_id, month, Number(year)).map((d) => ({
				reason: d.reason,
				amount: Number(d.amount ?? 0)
			}));
			const deductions = deductionItems.reduce((sum, d) => sum + d.amount, 0);
			const bonus = Number(row.bonus ?? 0);
			const due = Number((base + bonus - deductions).toFixed(2));
			const paid = Number((row.stored_actual_paid ?? 0).toFixed(2));
			return {
				employeeId: row.employee_id,
				name: row.name,
				salaryTypeName,
				salaryTypeMode,
				netSalary: Number(row.net_salary ?? 0),
				base: Number(base.toFixed(2)),
				payableSessions,
				totalSessions,
				bonus,
				deductions: Number(deductions.toFixed(2)),
				deductionItems,
				due,
				paid,
				/** Floored per employee, exactly as the arrears KPI does. */
				remaining: Number(Math.max(0, due - paid).toFixed(2)),
				paidDate: row.paid_date,
				/** No salary_payments row yet — the whole amount is still outstanding. */
				hasPayrollRow: row.stored_actual_paid != null
			};
		});
		const expenses = db.prepare("SELECT id, item, category, amount, notes, created_at FROM expenses WHERE month = ? AND year = ? ORDER BY amount DESC").all(month, year).map((e) => ({
			id: e.id,
			item: e.item,
			category: e.category,
			amount: Number((e.amount ?? 0).toFixed(2)),
			notes: e.notes,
			createdAt: e.created_at
		}));
		const serviceMap = /* @__PURE__ */ new Map();
		for (const c of children) {
			const key = c.service || "غير محدد";
			const entry = serviceMap.get(key) ?? {
				collected: 0,
				expected: 0,
				children: 0
			};
			entry.collected += c.paid;
			entry.expected += c.expectedTotal;
			entry.children += 1;
			serviceMap.set(key, entry);
		}
		const revenueByService = [...serviceMap.entries()].map(([service, v]) => ({
			service,
			collected: Number(v.collected.toFixed(2)),
			expected: Number(v.expected.toFixed(2)),
			childCount: v.children
		})).sort((a, b) => b.collected - a.collected);
		const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
		const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : .2;
		const salariesTotals = getSalaryTotals(db, month, year);
		const kpi = calculateDashboard(getMonthBillableRows(db, month, year), expenses, salariesTotals, targetProfitPct);
		return {
			month,
			year: Number(year),
			/** Calendar facts the expected-quantity maths depends on, so the page can spell it out. */
			period: {
				monthIndex,
				daysInMonth,
				isCurrentMonth,
				/** Scheduled days are counted from here to month end (today for the current month). */
				countFromDay: isCurrentMonth ? today.getDate() : 1
			},
			targetProfitPct,
			kpis: {
				invoiced: kpi.invoiced,
				billed: kpi.billed,
				collected: kpi.collected,
				arrears: kpi.arrears,
				arrearsBreakdown: kpi.arrearsBreakdown,
				collectionRate: kpi.collectionRate,
				expensesTotal: kpi.expensesTotal,
				salariesTotal: kpi.salariesTotal,
				salariesDue: kpi.salariesDue,
				netProfit: kpi.netProfit,
				targetRequired: kpi.targetRequired,
				gap: kpi.gap
			},
			children,
			collections,
			salaries,
			expenses,
			revenueByService
		};
	} catch (error) {
		console.error("Failed to get dashboard breakdown:", error);
		throw new Error(error.message || "Failed to retrieve dashboard breakdown");
	}
});
ipcMain.handle("dashboard:get", async (_event, { month, year }) => {
	try {
		checkAuth$5();
		const db = getDb();
		if (!month || !year) throw new Error("Month and year are required");
		const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get();
		const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : .2;
		const payments = getMonthBillableRows(db, month, year);
		const kpi = calculateDashboard(payments, db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(month, year), getSalaryTotals(db, month, year), targetProfitPct);
		const revenueByServiceMap = /* @__PURE__ */ new Map();
		for (const p of payments) {
			const service = p.service || "غير محدد";
			revenueByServiceMap.set(service, (revenueByServiceMap.get(service) ?? 0) + p.paid);
		}
		const revenueByService = [...revenueByServiceMap.entries()].map(([service, collected]) => ({
			service,
			collected: Number(collected.toFixed(2))
		})).filter((s) => s.collected !== 0).sort((a, b) => b.collected - a.collected);
		const collectedByMethod = db.prepare(`
      SELECT method, SUM(amount) as total FROM (
        SELECT COALESCE(NULLIF(pt.payment_method_name, ''), 'غير محدد') as method, pt.amount as amount
        FROM payment_transactions pt
        JOIN payments p ON pt.payment_id = p.id
        WHERE p.month = ? AND p.year = ?
        UNION ALL
        SELECT COALESCE(NULLIF(p.payment_method_name, ''), 'غير محدد') as method, p.paid as amount
        FROM payments p
        WHERE p.month = ? AND p.year = ? AND p.paid > 0
          AND NOT EXISTS (SELECT 1 FROM payment_transactions pt WHERE pt.payment_id = p.id)
      )
      GROUP BY method
      ORDER BY total DESC
    `).all(month, year, month, year).map((r) => ({
			method: r.method,
			total: Number((r.total ?? 0).toFixed(2))
		}));
		const summary12Month = [];
		for (const m of arabicMonths) {
			const mPayments = getMonthBillableRows(db, m, year);
			const mExpenses = db.prepare("SELECT amount FROM expenses WHERE month = ? AND year = ?").all(m, year);
			const mPaidOut = db.prepare("SELECT COALESCE(SUM(actual_paid), 0) as total FROM salary_payments WHERE month = ? AND year = ?").get(m, year)?.total ?? 0;
			const mKpi = calculateDashboard(mPayments, mExpenses, {
				due: mPaidOut,
				paid: mPaidOut,
				remaining: 0
			}, targetProfitPct);
			const totalExp = mKpi.expensesTotal + mKpi.salariesTotal;
			summary12Month.push({
				month: m,
				collected: mKpi.collected,
				expenses: totalExp,
				netProfit: mKpi.netProfit,
				status: mKpi.targetRequired > 0 && mKpi.collected >= mKpi.targetRequired ? "target_met" : "target_missed"
			});
		}
		const alerts = [];
		if (kpi.gap > 0 && kpi.collected > 0) alerts.push({
			type: "warning",
			messageAr: `عجز في تحقيق الأهداف الماليّة بمقدار ${kpi.gap} ج.م لهذا الشهر`,
			messageEn: `Financial target shortfall of ${kpi.gap} EGP this month`
		});
		if (kpi.arrears > 0) {
			const b = kpi.arrearsBreakdown;
			alerts.push({
				type: "danger",
				messageAr: `التزامات مستحقة بقيمة ${kpi.arrears} ج.م هذا الشهر (متأخرات الأطفال ${b.children} + رواتب غير مدفوعة ${b.salaries} + مصروفات ${b.expenses})`,
				messageEn: `Outstanding obligations of ${kpi.arrears} EGP this month (children ${b.children} + unpaid salaries ${b.salaries} + expenses ${b.expenses})`
			});
		}
		if (kpi.collectionRate < .8 && kpi.invoiced > 0) {
			const pct = Math.round(kpi.collectionRate * 100);
			alerts.push({
				type: "info",
				messageAr: `نسبة تحصيل الاشتراكات منخفضة (${pct}%)`,
				messageEn: `Low collection rate of (${pct}%)`
			});
		}
		return {
			kpis: {
				invoiced: kpi.invoiced,
				billed: kpi.billed,
				collected: kpi.collected,
				arrears: kpi.arrears,
				arrearsBreakdown: kpi.arrearsBreakdown,
				collectionRate: kpi.collectionRate,
				expensesTotal: kpi.expensesTotal,
				salariesTotal: kpi.salariesTotal,
				salariesDue: kpi.salariesDue,
				netProfit: kpi.netProfit
			},
			target: {
				required: kpi.targetRequired,
				collected: kpi.collected,
				gap: kpi.gap,
				status: kpi.gap === 0 && kpi.targetRequired > 0 ? "met" : "missed"
			},
			summary12Month,
			revenueByService,
			collectedByMethod,
			alerts
		};
	} catch (error) {
		console.error("Failed to get dashboard data:", error);
		throw new Error(error.message || "Failed to retrieve dashboard data");
	}
});
//#endregion
//#region electron/ipc/rolesIPC.ts
ipcMain.handle("roles:list", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT * FROM employee_roles ORDER BY name ASC").all();
	} catch (error) {
		throw new Error(error.message || "Failed to list roles");
	}
});
ipcMain.handle("roles:add", async (_event, { name }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!name?.trim()) throw new Error("اسم الدور مطلوب / Role name is required");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare("INSERT INTO employee_roles (name, created_at, updated_at, synced) VALUES (?, ?, ?, 0)").run(name.trim(), now, now);
		return db.prepare("SELECT * FROM employee_roles WHERE id = ?").get(Number(result.lastInsertRowid));
	} catch (error) {
		throw new Error(error.message || "Failed to add role");
	}
});
ipcMain.handle("roles:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		const role = db.prepare("SELECT * FROM employee_roles WHERE id = ?").get(id);
		if (!role) throw new Error("الدور غير موجود / Role not found");
		const name = patch.name !== void 0 ? patch.name : role.name;
		const salary_type_id = patch.salary_type_id !== void 0 ? patch.salary_type_id : role.salary_type_id;
		db.prepare("UPDATE employee_roles SET name = ?, salary_type_id = ?, updated_at = ?, synced = 0 WHERE id = ?").run(name, salary_type_id, (/* @__PURE__ */ new Date()).toISOString(), id);
		if (patch.name !== void 0) db.prepare("UPDATE employees SET role = ?, updated_at = ?, synced = 0 WHERE role_id = ?").run(name, (/* @__PURE__ */ new Date()).toISOString(), id);
		return db.prepare("SELECT * FROM employee_roles WHERE id = ?").get(id);
	} catch (error) {
		throw new Error(error.message || "Failed to update role");
	}
});
ipcMain.handle("roles:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const active = db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE role_id = ? AND is_active = 1").get(id);
		if (active.cnt > 0) throw new Error(`لا يمكن حذف الدور — يوجد ${active.cnt} موظف نشط / Cannot delete role — ${active.cnt} active employee(s) assigned`);
		db.prepare("DELETE FROM employee_roles WHERE id = ?").run(id);
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to delete role");
	}
});
//#endregion
//#region electron/ipc/salaryTypesIPC.ts
ipcMain.handle("salaryTypes:list", async () => {
	try {
		requireAdmin();
		return getDb().prepare("SELECT * FROM salary_types ORDER BY name ASC").all();
	} catch (error) {
		throw new Error(error.message || "Failed to list salary types");
	}
});
ipcMain.handle("salaryTypes:add", async (_event, input) => {
	try {
		requireAdmin();
		const db = getDb();
		const { name, mode, monthly_rate = null, session_rate = null, session_pct = null } = input;
		if (!name?.trim()) throw new Error("الاسم مطلوب / Name is required");
		if (![
			"fixed_monthly",
			"per_session_fixed",
			"per_session_pct",
			"hybrid",
			"per_child_session"
		].includes(mode)) throw new Error("نوع الراتب غير صالح / Invalid salary mode");
		if (mode === "per_session_pct" && (session_pct == null || session_pct <= 0 || session_pct > 1)) throw new Error("نسبة الجلسة يجب أن تكون بين 0 و 1 / Session percentage must be between 0 and 1");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO salary_types (name, mode, monthly_rate, session_rate, session_pct, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `).run(name.trim(), mode, monthly_rate, session_rate, session_pct, now, now);
		return db.prepare("SELECT * FROM salary_types WHERE id = ?").get(Number(result.lastInsertRowid));
	} catch (error) {
		throw new Error(error.message || "Failed to add salary type");
	}
});
ipcMain.handle("salaryTypes:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		const st = db.prepare("SELECT * FROM salary_types WHERE id = ?").get(id);
		if (!st) throw new Error("نوع الراتب غير موجود / Salary type not found");
		const name = patch.name !== void 0 ? patch.name : st.name;
		const mode = patch.mode !== void 0 ? patch.mode : st.mode;
		const monthly_rate = patch.monthly_rate !== void 0 ? patch.monthly_rate : st.monthly_rate;
		const session_rate = patch.session_rate !== void 0 ? patch.session_rate : st.session_rate;
		const session_pct = patch.session_pct !== void 0 ? patch.session_pct : st.session_pct;
		db.prepare(`
      UPDATE salary_types SET name = ?, mode = ?, monthly_rate = ?, session_rate = ?, session_pct = ?, updated_at = ?, synced = 0 WHERE id = ?
    `).run(name, mode, monthly_rate, session_rate, session_pct, (/* @__PURE__ */ new Date()).toISOString(), id);
		return db.prepare("SELECT * FROM salary_types WHERE id = ?").get(id);
	} catch (error) {
		throw new Error(error.message || "Failed to update salary type");
	}
});
ipcMain.handle("salaryTypes:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const roleRef = db.prepare("SELECT COUNT(*) as cnt FROM employee_roles WHERE salary_type_id = ?").get(id);
		const empRef = db.prepare("SELECT COUNT(*) as cnt FROM employees WHERE salary_type_override_id = ?").get(id);
		if (roleRef.cnt > 0 || empRef.cnt > 0) throw new Error(`لا يمكن الحذف — مستخدم في ${roleRef.cnt} دور و ${empRef.cnt} موظف / Cannot delete — referenced by ${roleRef.cnt} role(s) and ${empRef.cnt} employee(s)`);
		db.prepare("DELETE FROM salary_types WHERE id = ?").run(id);
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to delete salary type");
	}
});
//#endregion
//#region electron/ipc/serviceDefinitionsIPC.ts
ipcMain.handle("serviceDefinitions:list", async () => {
	try {
		checkAuth$10();
		return getDb().prepare("SELECT * FROM service_definitions ORDER BY is_custom ASC, name ASC").all();
	} catch (error) {
		throw new Error(error.message || "Failed to list service definitions");
	}
});
ipcMain.handle("serviceDefinitions:add", async (_event, input) => {
	try {
		requireAdmin();
		const db = getDb();
		const { name, price_monthly = null, price_daily = null, price_hourly = null } = input;
		if (!name?.trim()) throw new Error("الاسم مطلوب / Name is required");
		if (price_monthly == null && price_daily == null && price_hourly == null) throw new Error("يجب تحديد سعر واحد على الأقل / At least one price is required");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO service_definitions (name, is_custom, price_monthly, price_daily, price_hourly, created_at, updated_at, synced)
      VALUES (?, 1, ?, ?, ?, ?, ?, 0)
    `).run(name.trim(), price_monthly, price_daily, price_hourly, now, now);
		return db.prepare("SELECT * FROM service_definitions WHERE id = ?").get(Number(result.lastInsertRowid));
	} catch (error) {
		throw new Error(error.message || "Failed to add service definition");
	}
});
ipcMain.handle("serviceDefinitions:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		const svc = db.prepare("SELECT * FROM service_definitions WHERE id = ?").get(id);
		if (!svc) throw new Error("الخدمة غير موجودة / Service not found");
		const name = patch.name !== void 0 ? patch.name : svc.name;
		const price_monthly = patch.price_monthly !== void 0 ? patch.price_monthly : svc.price_monthly;
		const price_daily = patch.price_daily !== void 0 ? patch.price_daily : svc.price_daily;
		const price_hourly = patch.price_hourly !== void 0 ? patch.price_hourly : svc.price_hourly;
		db.prepare(`
      UPDATE service_definitions SET name = ?, price_monthly = ?, price_daily = ?, price_hourly = ?, updated_at = ?, synced = 0 WHERE id = ?
    `).run(name, price_monthly, price_daily, price_hourly, (/* @__PURE__ */ new Date()).toISOString(), id);
		return db.prepare("SELECT * FROM service_definitions WHERE id = ?").get(id);
	} catch (error) {
		throw new Error(error.message || "Failed to update service definition");
	}
});
ipcMain.handle("serviceDefinitions:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const svc = db.prepare("SELECT * FROM service_definitions WHERE id = ?").get(id);
		if (!svc) throw new Error("الخدمة غير موجودة / Service not found");
		if (svc.is_custom === 0) throw new Error("لا يمكن حذف الخدمات الافتراضية / Cannot delete built-in services");
		const enrolled = db.prepare("SELECT COUNT(*) as cnt FROM child_services WHERE service = ?").get(svc.name);
		if (enrolled.cnt > 0) throw new Error(`لا يمكن الحذف — ${enrolled.cnt} طفل مسجل في هذه الخدمة / Cannot delete — ${enrolled.cnt} child(ren) enrolled`);
		db.prepare("DELETE FROM service_definitions WHERE id = ?").run(id);
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to delete service definition");
	}
});
//#endregion
//#region electron/ipc/sessionsIPC.ts
ipcMain.handle("sessions:list", async (_event, args) => {
	try {
		checkAuth$10();
		const db = getDb();
		const { from, to } = args || {};
		let query = `
      SELECT ss.*, sd.name as service_name,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.session_id = ss.id) as attendance_count
      FROM scheduled_sessions ss
      LEFT JOIN service_definitions sd ON ss.service_id = sd.id
      WHERE 1=1
    `;
		const params = [];
		if (from) {
			query += " AND ss.session_date >= ?";
			params.push(from);
		}
		if (to) {
			query += " AND ss.session_date <= ?";
			params.push(to);
		}
		query += " ORDER BY ss.session_date ASC";
		const sessions = db.prepare(query).all(...params);
		for (const s of sessions) s.teachers = db.prepare(`
        SELECT e.id, e.name, er.name as role_name
        FROM session_teachers st
        JOIN employees e ON st.employee_id = e.id
        LEFT JOIN employee_roles er ON e.role_id = er.id
        WHERE st.session_id = ?
      `).all(s.id);
		return sessions;
	} catch (error) {
		throw new Error(error.message || "Failed to list sessions");
	}
});
ipcMain.handle("sessions:add", async (_event, input) => {
	try {
		checkAuth$10();
		const { session_date, service_id = null, group_name = null, notes = null, employee_ids = [] } = input;
		if (!session_date) throw new Error("تاريخ الجلسة مطلوب / Session date is required");
		const db = getDb();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO scheduled_sessions (session_date, service_id, group_name, notes, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(session_date, service_id, group_name, notes, now, now);
		const sessionId = Number(result.lastInsertRowid);
		for (const empId of employee_ids) db.prepare("INSERT OR IGNORE INTO session_teachers (session_id, employee_id, synced) VALUES (?, ?, 0)").run(sessionId, empId);
		return db.prepare("SELECT * FROM scheduled_sessions WHERE id = ?").get(sessionId);
	} catch (error) {
		throw new Error(error.message || "Failed to add session");
	}
});
ipcMain.handle("sessions:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		const s = db.prepare("SELECT * FROM scheduled_sessions WHERE id = ?").get(id);
		if (!s) throw new Error("الجلسة غير موجودة / Session not found");
		const session_date = patch.session_date ?? s.session_date;
		const service_id = patch.service_id !== void 0 ? patch.service_id : s.service_id;
		const group_name = patch.group_name !== void 0 ? patch.group_name : s.group_name;
		const notes = patch.notes !== void 0 ? patch.notes : s.notes;
		db.prepare(`
      UPDATE scheduled_sessions SET session_date = ?, service_id = ?, group_name = ?, notes = ?, updated_at = ?, synced = 0 WHERE id = ?
    `).run(session_date, service_id, group_name, notes, (/* @__PURE__ */ new Date()).toISOString(), id);
		return db.prepare("SELECT * FROM scheduled_sessions WHERE id = ?").get(id);
	} catch (error) {
		throw new Error(error.message || "Failed to update session");
	}
});
ipcMain.handle("sessions:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		const { cnt: attendanceCount } = db.prepare("SELECT COUNT(*) as cnt FROM attendance_records WHERE session_id = ?").get(id);
		db.transaction(() => {
			db.prepare(`
        DELETE FROM attendance_conflicts
        WHERE attendance_record_id IN (SELECT id FROM attendance_records WHERE session_id = ?)
      `).run(id);
			db.prepare("DELETE FROM attendance_records WHERE session_id = ?").run(id);
			db.prepare("DELETE FROM session_teachers WHERE session_id = ?").run(id);
			db.prepare("DELETE FROM scheduled_sessions WHERE id = ?").run(id);
		})();
		return {
			ok: true,
			deleted_attendance: attendanceCount
		};
	} catch (error) {
		throw new Error(error.message || "Failed to delete session");
	}
});
ipcMain.handle("sessions:salaryCredit", async (_event, { session_id }) => {
	try {
		checkAuth$10();
		const db = getDb();
		const payable = !!db.prepare(`
      SELECT 1 FROM attendance_records
      WHERE session_id = ? AND status IN ('attended','absent_unexcused')
      LIMIT 1
    `).get(session_id);
		const teachers = db.prepare(`
      SELECT e.id as employee_id, e.name,
        COALESCE(e.salary_type_override_id, er.salary_type_id) as effective_salary_type_id
      FROM session_teachers st
      JOIN employees e ON st.employee_id = e.id
      LEFT JOIN employee_roles er ON e.role_id = er.id
      WHERE st.session_id = ?
    `).all(session_id);
		const credits = [];
		for (const t of teachers) {
			if (!t.effective_salary_type_id) continue;
			const st = db.prepare("SELECT mode, session_rate FROM salary_types WHERE id = ?").get(t.effective_salary_type_id);
			if (!st) continue;
			if (st.mode === "per_session_fixed" || st.mode === "hybrid") credits.push({
				employee_id: t.employee_id,
				name: t.name,
				amount: st.session_rate ?? 0
			});
		}
		return {
			payable,
			hasTeachers: teachers.length > 0,
			credits
		};
	} catch (error) {
		throw new Error(error.message || "Failed to compute session salary credit");
	}
});
ipcMain.handle("sessions:assignTeachers", async (_event, { session_id, employee_ids }) => {
	try {
		requireAdmin();
		const db = getDb();
		db.prepare("DELETE FROM session_teachers WHERE session_id = ?").run(session_id);
		for (const empId of employee_ids) db.prepare("INSERT OR IGNORE INTO session_teachers (session_id, employee_id, synced) VALUES (?, ?, 0)").run(session_id, empId);
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to assign teachers");
	}
});
ipcMain.handle("sessions:childrenForDay", async (_event, { day_of_week }) => {
	try {
		checkAuth$10();
		return getDb().prepare(`SELECT id, name, lesson_days FROM children WHERE is_active = 1 AND lesson_days IS NOT NULL AND lesson_days != '[]' AND lesson_days != ''`).all().filter((c) => {
			try {
				return JSON.parse(c.lesson_days).includes(Number(day_of_week));
			} catch {
				return false;
			}
		}).map((c) => ({
			id: c.id,
			name: c.name
		}));
	} catch (error) {
		throw new Error(error.message || "Failed to get children for day");
	}
});
ipcMain.handle("sessions:proRateCalc", async (_event, args) => {
	try {
		checkAuth$10();
		const db = getDb();
		let reg_date = args.reg_date;
		let pricePerSession = args.price_per_session ?? 0;
		if (!reg_date && args.child_id) {
			const child = db.prepare("SELECT reg_date, session_price FROM children WHERE id = ?").get(args.child_id);
			if (!child) throw new Error("الطفل غير موجود / Child not found");
			reg_date = child.reg_date;
			pricePerSession = child.session_price ?? 0;
		}
		if (!reg_date) throw new Error("reg_date is required");
		const regDate = new Date(reg_date);
		const year = regDate.getFullYear();
		const month = regDate.getMonth();
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const daysRemaining = daysInMonth - regDate.getDate() + 1;
		const monthStr = String(month + 1).padStart(2, "0");
		const monthStart = reg_date;
		const monthEnd = `${year}-${monthStr}-${daysInMonth}`;
		return {
			remaining_sessions: db.prepare(`
      SELECT COUNT(*) as cnt FROM scheduled_sessions
      WHERE session_date >= ? AND session_date <= ?
    `).get(monthStart, monthEnd).cnt,
			total_sessions: db.prepare(`
      SELECT COUNT(*) as cnt FROM scheduled_sessions
      WHERE strftime('%Y-%m', session_date) = ?
    `).get(`${year}-${monthStr}`).cnt,
			days_remaining: daysRemaining,
			days_in_month: daysInMonth,
			prorated_amount: Math.round(pricePerSession * daysRemaining / daysInMonth),
			per_session_price: pricePerSession
		};
	} catch (error) {
		throw new Error(error.message || "Failed to calculate pro-rate");
	}
});
//#endregion
//#region electron/ipc/paymentMethodsIPC.ts
ipcMain.handle("paymentMethods:list", async () => {
	try {
		checkAuth$10();
		return getDb().prepare(`SELECT * FROM payment_methods ORDER BY name`).all();
	} catch (e) {
		throw new Error(e.message || "Failed to list payment methods");
	}
});
ipcMain.handle("paymentMethods:add", async (_event, { name }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (!name?.trim()) throw new Error("اسم طريقة الدفع مطلوب / Name is required");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const res = db.prepare(`INSERT INTO payment_methods (name, is_active, created_at, updated_at, synced) VALUES (?, 1, ?, ?, 0)`).run(name.trim(), now, now);
		return db.prepare(`SELECT * FROM payment_methods WHERE id = ?`).get(Number(res.lastInsertRowid));
	} catch (e) {
		throw new Error(e.message || "Failed to add payment method");
	}
});
ipcMain.handle("paymentMethods:update", async (_event, { id, patch }) => {
	try {
		requireAdmin();
		const db = getDb();
		const row = db.prepare(`SELECT * FROM payment_methods WHERE id = ?`).get(id);
		if (!row) throw new Error("طريقة الدفع غير موجودة / Not found");
		const name = patch.name !== void 0 ? patch.name.trim() : row.name;
		const is_active = patch.is_active !== void 0 ? patch.is_active : row.is_active;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`UPDATE payment_methods SET name = ?, is_active = ?, updated_at = ?, synced = 0 WHERE id = ?`).run(name, is_active, now, id);
		return db.prepare(`SELECT * FROM payment_methods WHERE id = ?`).get(id);
	} catch (e) {
		throw new Error(e.message || "Failed to update payment method");
	}
});
ipcMain.handle("paymentMethods:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		const db = getDb();
		if (db.prepare(`SELECT COUNT(*) as c FROM payments WHERE payment_method_id = ?`).get(id).c > 0) throw new Error("لا يمكن حذف طريقة دفع مستخدمة في مدفوعات / Cannot delete a method in use");
		db.prepare(`DELETE FROM payment_methods WHERE id = ?`).run(id);
		return { ok: true };
	} catch (e) {
		throw new Error(e.message || "Failed to delete payment method");
	}
});
//#endregion
//#region electron/ipc/deductionsIPC.ts
function checkAuth$4() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("deductions:list", async (_event, { employee_id, month, year }) => {
	checkAuth$4();
	return getDb().prepare("SELECT * FROM employee_deductions WHERE employee_id = ? AND month = ? AND year = ? ORDER BY created_at ASC").all(employee_id, month, Number(year));
});
ipcMain.handle("deductions:add", async (_event, { employee_id, month, year, reason, amount }) => {
	requireAdmin();
	const db = getDb();
	if (!reason || !reason.trim()) throw new Error("السبب مطلوب / Reason is required");
	const amountNum = Number(amount);
	if (isNaN(amountNum) || amountNum <= 0) throw new Error("المبلغ يجب أن يكون موجباً / Amount must be positive");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const result = db.prepare("INSERT INTO employee_deductions (employee_id, month, year, reason, amount, created_at, synced) VALUES (?, ?, ?, ?, ?, ?, 0)").run(employee_id, month, Number(year), reason.trim(), amountNum, now);
	return db.prepare("SELECT * FROM employee_deductions WHERE id = ?").get(result.lastInsertRowid);
});
ipcMain.handle("deductions:remove", async (_event, { id }) => {
	requireAdmin();
	getDb().prepare("DELETE FROM employee_deductions WHERE id = ?").run(id);
	return { ok: true };
});
//#endregion
//#region electron/ipc/serviceTeachersIPC.ts
ipcMain.handle("serviceTeachers:list", async (_event, { service_id }) => {
	try {
		checkAuth$10();
		return getDb().prepare(`
      SELECT e.id, e.name, e.role
      FROM service_teachers st
      JOIN employees e ON st.employee_id = e.id
      WHERE st.service_id = ? AND e.is_active = 1
      ORDER BY e.name ASC
    `).all(service_id);
	} catch (error) {
		throw new Error(error.message || "Failed to list service teachers");
	}
});
ipcMain.handle("serviceTeachers:set", async (_event, { service_id, employee_ids }) => {
	try {
		requireAdmin();
		const db = getDb();
		const ids = Array.isArray(employee_ids) ? employee_ids : [];
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.transaction(() => {
			db.prepare("DELETE FROM service_teachers WHERE service_id = ?").run(service_id);
			for (const empId of ids) db.prepare(`
          INSERT OR IGNORE INTO service_teachers (service_id, employee_id, created_at, synced)
          VALUES (?, ?, ?, 0)
        `).run(service_id, empId, now);
		})();
		return { ok: true };
	} catch (error) {
		throw new Error(error.message || "Failed to set service teachers");
	}
});
//#endregion
//#region electron/ipc/teacherPaymentsIPC.ts
ipcMain.handle("teacherPayments:list", async (_event, filters) => {
	try {
		requireAdmin();
		const db = getDb();
		const { teacher_id, child_id, month, year } = filters || {};
		let query = `
      SELECT tp.*, e.name as teacher_name, c.name as child_name
      FROM teacher_payments tp
      JOIN employees e ON tp.teacher_id = e.id
      JOIN children c ON tp.child_id = c.id
      WHERE 1=1
    `;
		const params = [];
		if (teacher_id) {
			query += " AND tp.teacher_id = ?";
			params.push(teacher_id);
		}
		if (child_id) {
			query += " AND tp.child_id = ?";
			params.push(child_id);
		}
		if (month && year) {
			const mm = String(month).padStart(2, "0");
			query += " AND strftime('%Y-%m', tp.attendance_date) = ?";
			params.push(`${year}-${mm}`);
		}
		query += " ORDER BY tp.attendance_date DESC";
		return db.prepare(query).all(...params);
	} catch (error) {
		throw new Error(error.message || "Failed to list teacher payments");
	}
});
ipcMain.handle("teacherPayments:markPaid", async (_event, { ids }) => {
	try {
		requireAdmin();
		const db = getDb();
		const list = Array.isArray(ids) ? ids : [];
		if (list.length === 0) return {
			ok: true,
			updated: 0
		};
		const placeholders = list.map(() => "?").join(",");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      UPDATE teacher_payments SET status = 'paid', updated_at = ?, synced = 0
      WHERE id IN (${placeholders}) AND status = 'pending'
    `).run(now, ...list);
		return {
			ok: true,
			updated: Number(result.changes)
		};
	} catch (error) {
		throw new Error(error.message || "Failed to mark payments as paid");
	}
});
//#endregion
//#region electron/ipc/payrollIPC.ts
ipcMain.handle("payroll:report", async (_event, { month, year }) => {
	try {
		requireAdmin();
		const db = getDb();
		const monthKey = `${year}-${String(month).padStart(2, "0")}`;
		return db.prepare(`
      SELECT
        e.id as teacher_id,
        e.name as teacher_name,
        e.teacher_session_rate as session_cost,
        COUNT(tp.id) as sessions_paid,
        COALESCE(SUM(tp.session_cost), 0) as total_salary
      FROM employees e
      JOIN teacher_payments tp ON tp.teacher_id = e.id
        AND tp.status IN ('pending','paid')
        AND strftime('%Y-%m', tp.attendance_date) = ?
      GROUP BY e.id
      ORDER BY e.name ASC
    `).all(monthKey);
	} catch (error) {
		throw new Error(error.message || "Failed to generate payroll report");
	}
});
//#endregion
//#region electron/ipc/transactionsIPC.ts
function checkAuth$3() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
function weekBounds(dateStr) {
	const date = new Date(dateStr);
	const daysSinceSaturday = (date.getDay() + 1) % 7;
	const from = new Date(date);
	from.setDate(date.getDate() - daysSinceSaturday);
	const to = new Date(from);
	to.setDate(from.getDate() + 6);
	return {
		from: from.toISOString().slice(0, 10),
		to: to.toISOString().slice(0, 10)
	};
}
function monthBounds(dateStr) {
	const date = new Date(dateStr);
	const year = date.getFullYear();
	const month = date.getMonth();
	const lastDay = new Date(year, month + 1, 0).getDate();
	const pad = (n) => String(n).padStart(2, "0");
	return {
		from: `${year}-${pad(month + 1)}-01`,
		to: `${year}-${pad(month + 1)}-${pad(lastDay)}`
	};
}
ipcMain.handle("transactions:list", async (_event, args) => {
	try {
		checkAuth$3();
		const { range, date, childId } = args || {};
		let { from, to } = args || {};
		if (range === "day") {
			if (!date) throw new Error("date is required for range=day");
			from = date;
			to = date;
		} else if (range === "week") {
			if (!date) throw new Error("date is required for range=week");
			({from, to} = weekBounds(date));
		} else if (range === "month") {
			if (!date) throw new Error("date is required for range=month");
			({from, to} = monthBounds(date));
		} else if (range === "custom") {
			if (!from || !to) throw new Error("from and to are required for range=custom");
		} else throw new Error("Invalid range: must be one of day, week, month, custom");
		const db = getDb();
		const conditions = ["pt.paid_date BETWEEN ? AND ?"];
		const params = [from, to];
		if (childId) {
			conditions.push("p.child_id = ?");
			params.push(childId);
		}
		return db.prepare(`
      SELECT
        pt.id,
        p.child_id,
        c.name as child_name,
        p.service as service_name,
        pt.amount,
        'payment' as type,
        pt.paid_date as date
      FROM payment_transactions pt
      JOIN payments p ON p.id = pt.payment_id
      JOIN children c ON c.id = p.child_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY date DESC, pt.id DESC
    `).all(...params);
	} catch (error) {
		console.error("Failed to list transactions:", error);
		throw new Error(error.message || "Failed to list transactions");
	}
});
//#endregion
//#region electron/ipc/childIllnessCasesIPC.ts
function checkAuth$2() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("childIllnessCases:getOpen", async (_event, { child_id }) => {
	try {
		checkAuth$2();
		if (!child_id) throw new Error("child_id is required");
		return getDb().prepare("SELECT * FROM child_illness_cases WHERE child_id = ? AND status = 'open' ORDER BY opened_at DESC LIMIT 1").get(child_id) ?? null;
	} catch (error) {
		console.error("Failed to get open illness case:", error);
		throw new Error(error.message || "Failed to get open illness case");
	}
});
ipcMain.handle("childIllnessCases:list", async (_event, { child_id }) => {
	try {
		checkAuth$2();
		if (!child_id) throw new Error("child_id is required");
		return getDb().prepare("SELECT * FROM child_illness_cases WHERE child_id = ? ORDER BY opened_at DESC").all(child_id);
	} catch (error) {
		console.error("Failed to list illness cases:", error);
		throw new Error(error.message || "Failed to list illness cases");
	}
});
ipcMain.handle("childIllnessCases:create", async (_event, { child_id, description, opened_at }) => {
	try {
		checkAuth$2();
		if (!child_id) throw new Error("child_id is required");
		const db = getDb();
		if (db.prepare("SELECT id FROM child_illness_cases WHERE child_id = ? AND status = 'open'").get(child_id)) throw new Error("يوجد بالفعل حالة مرضية مفتوحة لهذا الطفل / An open illness case already exists for this child");
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO child_illness_cases (child_id, status, description, opened_at, created_at, updated_at, synced)
      VALUES (?, 'open', ?, ?, ?, ?, 0)
    `).run(child_id, description ?? null, opened_at || now.slice(0, 10), now, now);
		return db.prepare("SELECT * FROM child_illness_cases WHERE id = ?").get(result.lastInsertRowid);
	} catch (error) {
		console.error("Failed to create illness case:", error);
		throw new Error(error.message || "Failed to create illness case");
	}
});
ipcMain.handle("childIllnessCases:resolve", async (_event, { id, resolved_at }) => {
	try {
		checkAuth$2();
		if (!id) throw new Error("id is required");
		const db = getDb();
		const now = (/* @__PURE__ */ new Date()).toISOString();
		db.prepare(`
      UPDATE child_illness_cases
      SET status = 'resolved', resolved_at = ?, updated_at = ?, synced = 0
      WHERE id = ?
    `).run(resolved_at || now.slice(0, 10), now, id);
		return db.prepare("SELECT * FROM child_illness_cases WHERE id = ?").get(id);
	} catch (error) {
		console.error("Failed to resolve illness case:", error);
		throw new Error(error.message || "Failed to resolve illness case");
	}
});
//#endregion
//#region electron/ipc/childActivitiesIPC.ts
function checkAuth$1() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
ipcMain.handle("childActivities:list", async (_event, { child_id }) => {
	try {
		checkAuth$1();
		if (!child_id) throw new Error("child_id is required");
		return getDb().prepare("SELECT * FROM child_activities WHERE child_id = ? ORDER BY activity_date DESC, id DESC").all(child_id);
	} catch (error) {
		console.error("Failed to list child activities:", error);
		throw new Error(error.message || "Failed to list child activities");
	}
});
ipcMain.handle("childActivities:create", async (_event, { child_id, activity_date, note, media_data_url, media_type }) => {
	try {
		checkAuth$1();
		if (!child_id) throw new Error("child_id is required");
		if (!note && !media_data_url) throw new Error("يجب إضافة ملاحظة أو وسائط / An activity needs a note or media");
		const db = getDb();
		let mediaUrl = null;
		let mediaStatus = null;
		if (media_data_url) try {
			const folder = `nursery/children/${child_id}/activities`;
			mediaUrl = (media_type === "video" ? await uploadVideo(media_data_url, folder) : media_type === "file" ? await uploadFile(media_data_url, folder) : await uploadImage(media_data_url, folder)).url;
			mediaStatus = "uploaded";
		} catch (uploadError) {
			console.error("Activity media upload failed, saving note without media:", uploadError);
			mediaStatus = "failed";
		}
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const result = db.prepare(`
      INSERT INTO child_activities (child_id, activity_date, note, media_url, media_type, media_status, created_at, updated_at, synced)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
    `).run(child_id, activity_date || now.slice(0, 10), note ?? null, mediaUrl, media_data_url ? media_type ?? "photo" : null, mediaStatus, now, now);
		return db.prepare("SELECT * FROM child_activities WHERE id = ?").get(result.lastInsertRowid);
	} catch (error) {
		console.error("Failed to create child activity:", error);
		throw new Error(error.message || "Failed to create child activity");
	}
});
ipcMain.handle("childActivities:delete", async (_event, { id }) => {
	try {
		requireAdmin();
		if (!id) throw new Error("id is required");
		getDb().prepare("DELETE FROM child_activities WHERE id = ?").run(id);
		return { success: true };
	} catch (error) {
		console.error("Failed to delete child activity:", error);
		throw new Error(error.message || "Failed to delete child activity");
	}
});
//#endregion
//#region electron/ipc/calendarIPC.ts
function checkAuth() {
	if (!getCurrentUser()) throw new Error("UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized");
}
function buildMonthEntries(db, year, month) {
	const daysInMonth = new Date(year, month, 0).getDate();
	const entries = [];
	const enrollments = db.prepare(`
    SELECT cs.id as service_row_id, cs.child_id, c.name as child_name, cs.service, cs.teacher_id,
           e.name as teacher_name, cs.lesson_days
    FROM child_services cs
    JOIN children c ON c.id = cs.child_id
    LEFT JOIN employees e ON e.id = cs.teacher_id
    WHERE c.is_active = 1
  `).all();
	for (let d = 1; d <= daysInMonth; d++) {
		const date = new Date(year, month - 1, d);
		const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
		const weekday = date.getDay();
		for (const en of enrollments) {
			if (en.lesson_days != null && en.lesson_days !== "" && en.lesson_days !== "[]") {
				let days;
				try {
					days = JSON.parse(en.lesson_days);
				} catch {
					continue;
				}
				if (!days.includes(weekday)) continue;
			}
			entries.push({
				date: iso,
				user_id: en.child_id,
				user_name: en.child_name,
				user_type: "child",
				service_id: en.service_row_id,
				service_name: en.service,
				teacher_id: en.teacher_id ?? null,
				teacher_name: en.teacher_name ?? null,
				session_id: null
			});
		}
	}
	const from = `${year}-${String(month).padStart(2, "0")}-01`;
	const to = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
	const sessions = db.prepare(`
    SELECT ss.id, ss.session_date, ss.service_id, sd.name as service_name
    FROM scheduled_sessions ss
    LEFT JOIN service_definitions sd ON sd.id = ss.service_id
    WHERE ss.session_date BETWEEN ? AND ?
  `).all(from, to);
	const teacherStmt = db.prepare(`
    SELECT st.employee_id, e.name as employee_name
    FROM session_teachers st
    JOIN employees e ON e.id = st.employee_id
    WHERE st.session_id = ?
  `);
	for (const session of sessions) {
		const teachers = teacherStmt.all(session.id);
		if (teachers.length === 0) entries.push({
			date: session.session_date,
			user_id: session.id,
			user_name: session.service_name || "Session",
			user_type: "session",
			service_id: session.service_id,
			service_name: session.service_name,
			teacher_id: null,
			teacher_name: null,
			session_id: session.id
		});
		else for (const t of teachers) entries.push({
			date: session.session_date,
			user_id: t.employee_id,
			user_name: t.employee_name,
			user_type: "teacher",
			service_id: session.service_id,
			service_name: session.service_name,
			teacher_id: t.employee_id,
			teacher_name: t.employee_name,
			session_id: session.id
		});
	}
	return entries;
}
ipcMain.handle("calendar:getMonth", async (_event, { year, month }) => {
	try {
		checkAuth();
		if (!year || !month) throw new Error("year and month are required");
		return buildMonthEntries(getDb(), Number(year), Number(month));
	} catch (error) {
		console.error("Failed to get calendar month:", error);
		throw new Error(error.message || "Failed to get calendar month");
	}
});
ipcMain.handle("calendar:getDay", async (_event, { date }) => {
	try {
		checkAuth();
		if (!date) throw new Error("date is required");
		const db = getDb();
		const d = new Date(date);
		return {
			date,
			entries: buildMonthEntries(db, d.getFullYear(), d.getMonth() + 1).filter((e) => e.date === date)
		};
	} catch (error) {
		console.error("Failed to get calendar day:", error);
		throw new Error(error.message || "Failed to get calendar day");
	}
});
//#endregion
//#region electron/main.ts
var { autoUpdater } = electronUpdater;
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
app.commandLine.appendSwitch("disable-http2");
protocol.registerSchemesAsPrivileged([{
	scheme: "asset",
	privileges: {
		secure: true,
		standard: true,
		supportFetchAPI: true
	}
}]);
var mainWindow = null;
function createWindow() {
	Menu.setApplicationMenu(null);
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		minWidth: 960,
		minHeight: 600,
		icon: path.join(__dirname, "../assets/branding/icon.png"),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			preload: path.join(__dirname, "preload.cjs")
		},
		title: "نظام إدارة الحضانة ومركز التوحد | Nursery & Autism Center Management System"
	});
	mainWindow.webContents.on("preload-error", (_event, preloadPath, error) => {
		console.error("PRELOAD ERROR at", preloadPath, "->", error);
	});
	if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
	else mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
	mainWindow.on("closed", () => {
		mainWindow = null;
	});
}
app.whenReady().then(async () => {
	const configCheck = checkRequiredConfig();
	if (!configCheck.ok) {
		console.error("FATAL CONFIG ERROR:", configCheck.error);
		dialog.showErrorBox("Configuration Error / خطأ في الإعداد", configCheck.error || "Invalid configuration");
		app.quit();
		return;
	}
	try {
		const db = initDb();
		runMigrations(db);
		await seedDatabase(db);
		console.log("Database initialized, migrated and seeded successfully!");
		const brandingDir = path.join(app.getPath("userData"), "branding");
		if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });
		const defaultLogoSrc = path.join(__dirname, "../assets/default-branding/logo.png");
		const defaultIconSrc = path.join(__dirname, "../assets/default-branding/icon.png");
		const destLogo = path.join(brandingDir, "logo.png");
		const destIcon = path.join(brandingDir, "icon.png");
		if (fs.existsSync(defaultLogoSrc) && !fs.existsSync(destLogo)) fs.copyFileSync(defaultLogoSrc, destLogo);
		if (fs.existsSync(defaultIconSrc) && !fs.existsSync(destIcon)) fs.copyFileSync(defaultIconSrc, destIcon);
		const fontsDir = path.join(brandingDir, "fonts");
		if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });
		const defaultFontRegularSrc = path.join(__dirname, "../assets/branding/fonts/Cairo-Regular.ttf");
		const defaultFontBoldSrc = path.join(__dirname, "../assets/branding/fonts/Cairo-Bold.ttf");
		const destFontRegular = path.join(fontsDir, "Cairo-Regular.ttf");
		const destFontBold = path.join(fontsDir, "Cairo-Bold.ttf");
		if (fs.existsSync(defaultFontRegularSrc) && !fs.existsSync(destFontRegular)) fs.copyFileSync(defaultFontRegularSrc, destFontRegular);
		if (fs.existsSync(defaultFontBoldSrc) && !fs.existsSync(destFontBold)) fs.copyFileSync(defaultFontBoldSrc, destFontBold);
		const currentLogo = db.prepare("SELECT value FROM settings WHERE key = 'brand_logo_path'").get();
		if (!currentLogo || !currentLogo.value) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brand_logo_path', 'branding/logo.png')").run();
		const currentIcon = db.prepare("SELECT value FROM settings WHERE key = 'brand_icon_path'").get();
		if (!currentIcon || !currentIcon.value) db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('brand_icon_path', 'branding/icon.png')").run();
		const resolvedMongoUri = getMongoUri();
		if (!db.prepare("SELECT value FROM settings WHERE key = 'sync_mongo_uri'").get()) {
			db.prepare(`
        INSERT INTO settings (key, value, updated_at, synced)
        VALUES ('sync_mongo_uri', ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 0)
      `).run(resolvedMongoUri);
			console.log("[startup] Seeded sync_mongo_uri into settings:", resolvedMongoUri);
		}
		console.log("Connecting to MongoDB on startup...");
		connectMongo(resolvedMongoUri).then(() => console.log("Successfully connected to MongoDB on startup.")).catch((err) => console.error("Failed to connect to MongoDB on startup:", err.message));
		const autoIntervalRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_auto_interval'").get();
		const savedInterval = Number(autoIntervalRow?.value);
		startAutoSync((Number.isFinite(savedInterval) && savedInterval > 0 ? savedInterval : 1) * 60 * 1e3);
	} catch (error) {
		console.error("Failed to initialize database or branding assets:", error);
	}
	protocol.handle("asset", (request) => {
		try {
			const cleanPath = decodeURIComponent(request.url.slice(8)).replace(/^\/+/, "");
			const absolutePath = path.isAbsolute(cleanPath) ? cleanPath : path.join(app.getPath("userData"), cleanPath);
			return net.fetch(pathToFileURL(absolutePath).toString());
		} catch (err) {
			console.error("Asset protocol error:", err);
			return new Response("Asset not found", { status: 404 });
		}
	});
	createWindow();
	initAutoUpdater();
	if (app.isPackaged) setTimeout(() => {
		autoUpdater.checkForUpdatesAndNotify().catch((err) => {
			console.error("Error during automatic update check:", err);
		});
	}, 5e3);
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});
function initAutoUpdater() {
	autoUpdater.logger = console;
	const CHECK_COOLDOWN_MS = 6e5;
	let lastCheckAt = 0;
	let lastOutcome = null;
	let rateLimitRetryTimer = null;
	autoUpdater.on("checking-for-update", () => {
		lastCheckAt = Date.now();
		mainWindow?.webContents.send("updater:status", { event: "checking-for-update" });
	});
	autoUpdater.on("update-available", (info) => {
		lastOutcome = {
			event: "update-available",
			info
		};
		mainWindow?.webContents.send("updater:status", lastOutcome);
	});
	autoUpdater.on("update-not-available", (info) => {
		lastOutcome = {
			event: "update-not-available",
			info
		};
		mainWindow?.webContents.send("updater:status", lastOutcome);
	});
	let _updateRetried = false;
	autoUpdater.on("error", (err) => {
		const msg = err.message || "";
		const isRateLimit = msg.includes("429") || msg.includes("Too Many Requests");
		const isNetworkError = !isRateLimit && (msg.includes("ERR_HTTP2") || msg.includes("net::") || msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT"));
		if (isRateLimit) {
			console.warn("[updater] GitHub rate limit (429); will retry after cooldown");
			lastOutcome = null;
			mainWindow?.webContents.send("updater:status", {
				event: "error",
				error: msg,
				errorCode: "rate_limit"
			});
			if (!rateLimitRetryTimer) rateLimitRetryTimer = setTimeout(() => {
				rateLimitRetryTimer = null;
				autoUpdater.checkForUpdates().catch(() => {});
			}, CHECK_COOLDOWN_MS);
			return;
		}
		if (isNetworkError && !_updateRetried) {
			_updateRetried = true;
			setTimeout(() => autoUpdater.downloadUpdate().catch(() => {}), 3e3);
			return;
		}
		lastOutcome = null;
		mainWindow?.webContents.send("updater:status", {
			event: "error",
			error: msg,
			errorCode: isNetworkError ? "network" : "unknown"
		});
	});
	autoUpdater.on("download-progress", (progressObj) => {
		mainWindow?.webContents.send("updater:status", {
			event: "download-progress",
			progress: {
				percent: progressObj.percent,
				bytesPerSecond: progressObj.bytesPerSecond,
				transferred: progressObj.transferred,
				total: progressObj.total
			}
		});
	});
	autoUpdater.on("update-downloaded", (info) => {
		mainWindow?.webContents.send("updater:status", {
			event: "update-downloaded",
			info
		});
	});
	ipcMain.handle("updater:check", async () => {
		if (lastOutcome && Date.now() - lastCheckAt < CHECK_COOLDOWN_MS) {
			mainWindow?.webContents.send("updater:status", lastOutcome);
			return {
				success: true,
				cached: true
			};
		}
		try {
			return {
				success: true,
				result: await autoUpdater.checkForUpdates()
			};
		} catch (err) {
			return {
				success: false,
				error: err.message
			};
		}
	});
	ipcMain.handle("updater:install", () => {
		autoUpdater.quitAndInstall();
		return { success: true };
	});
	ipcMain.handle("updater:open-release-page", () => {
		shell.openExternal("https://github.com/ZainEldeen-Ashraf-Ibrahim-Ibrahim-Samak/Nursery/releases/latest");
	});
}
process.on("uncaughtException", (err) => {
	console.error("[main] Uncaught exception:", err);
});
app.on("window-all-closed", () => {
	closeDb();
	if (process.platform !== "darwin") app.quit();
});
//#endregion
export {};

//# sourceMappingURL=main.js.map