import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { findMonthlyProrateMismatches, reconcileMonthlyProrates } from '../../electron/services/prorateReconcile.js'

// January 2026: Sundays fall on 4/11/18/25 and Tuesdays on 6/13/20/27 — 8 sessions in the month.
// A child joining on the 11th still has 6 of them to come (11, 13, 18, 20, 25, 27).
const MONTH = 'يناير'
const YEAR = 2026

function makeDb() {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE children (id INTEGER PRIMARY KEY, name TEXT, reg_date TEXT, lesson_days TEXT);
    CREATE TABLE child_services (id INTEGER PRIMARY KEY, child_id INTEGER, lesson_days TEXT);
    CREATE TABLE payments (
      id INTEGER PRIMARY KEY, child_id INTEGER, service_id INTEGER, month TEXT, year INTEGER,
      service TEXT, unit TEXT, quantity INTEGER, price REAL, total REAL, paid REAL,
      balance REAL, status TEXT, prorated_calculated REAL, updated_at TEXT, synced INTEGER DEFAULT 1
    );
  `)
  return db
}

/** One child + enrollment + monthly payment row, with whatever stored total the test needs. */
function seed(
  db: any,
  id: number,
  opts: { regDate: string; price: number; total: number; paid: number; prorated?: number | null; lessonDays?: string | null }
) {
  db.exec(`INSERT INTO children (id, name, reg_date, lesson_days) VALUES (${id}, 'طفل ${id}', '${opts.regDate}', NULL)`)
  db.prepare('INSERT INTO child_services (id, child_id, lesson_days) VALUES (?, ?, ?)').run(id, id, opts.lessonDays ?? null)
  db.prepare(
    `INSERT INTO payments (id, child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, prorated_calculated, updated_at)
     VALUES (?, ?, ?, ?, ?, 'حضانة', 'شهر', 1, ?, ?, ?, ?, 'unpaid', ?, '2026-01-01')`
  ).run(id, id, id, MONTH, YEAR, opts.price, opts.total, opts.paid, opts.total - opts.paid, opts.prorated ?? null)
}

const rowOf = (db: any, id: number) => db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any

describe('monthly pro-rate reconciliation', () => {
  let db: any
  beforeEach(() => {
    db = makeDb()
  })

  it('corrects an unpaid row that was billed a full month despite a mid-month start', () => {
    // Joined the 11th on a Sun/Tue schedule: 6 of 8 sessions remain → 3200 × 6/8 = 2400.
    seed(db, 1, { regDate: '2026-01-11', price: 3200, total: 3200, paid: 0, lessonDays: '[0,2]' })

    const { fixed, skipped } = reconcileMonthlyProrates(db)

    expect(fixed).toBe(1)
    expect(skipped).toHaveLength(0)
    const row = rowOf(db, 1)
    expect(row.total).toBe(2400)
    expect(row.balance).toBe(2400)
    expect(row.prorated_calculated).toBe(2400)
    // Re-flagged for the cloud, otherwise the next push leaves the corrected row behind.
    expect(row.synced).toBe(0)
  })

  it('re-splits a row that was pro-rated on calendar days instead of the selected days', () => {
    // The old calendar split gave 3200 × 21/31 = 2168; the schedule-aware split gives 2400.
    seed(db, 1, { regDate: '2026-01-11', price: 3200, total: 2168, paid: 0, prorated: 2168, lessonDays: '[0,2]' })

    expect(reconcileMonthlyProrates(db).fixed).toBe(1)
    expect(rowOf(db, 1).total).toBe(2400)
  })

  it('never touches a row that has money collected against it, and reports it instead', () => {
    seed(db, 1, { regDate: '2026-01-11', price: 3200, total: 3200, paid: 500, lessonDays: '[0,2]' })

    const { fixed, skipped } = reconcileMonthlyProrates(db)

    expect(fixed).toBe(0)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]).toMatchObject({ child_id: 1, storedTotal: 3200, expectedTotal: 2400, difference: -800 })
    // The stored figure is left exactly as it was for a human to decide on.
    const row = rowOf(db, 1)
    expect(row.total).toBe(3200)
    expect(row.paid).toBe(500)
    expect(row.synced).toBe(1)
  })

  it('leaves a correct row alone and is idempotent on a second run', () => {
    seed(db, 1, { regDate: '2025-12-01', price: 3200, total: 3200, paid: 0, lessonDays: '[0,2]' })
    seed(db, 2, { regDate: '2026-01-11', price: 3200, total: 3200, paid: 0, lessonDays: '[0,2]' })

    expect(reconcileMonthlyProrates(db).fixed).toBe(1)
    // Second pass has nothing left to do — the repair converged.
    expect(reconcileMonthlyProrates(db).fixed).toBe(0)
    expect(findMonthlyProrateMismatches(db)).toHaveLength(0)
    // The full-month child keeps the full price and gains no phantom discount.
    expect(rowOf(db, 1).total).toBe(3200)
    expect(rowOf(db, 1).prorated_calculated).toBeNull()
  })

  it('zeroes a row for a month that ended before the child registered', () => {
    seed(db, 1, { regDate: '2026-03-02', price: 3200, total: 3200, paid: 0, lessonDays: '[0,2]' })

    expect(reconcileMonthlyProrates(db).fixed).toBe(1)
    expect(rowOf(db, 1).total).toBe(0)
  })

  it('falls back to a calendar split when the enrollment has no selected days', () => {
    // No schedule to count, so 3100 × 21/31 = 2100.
    seed(db, 1, { regDate: '2026-01-11', price: 3100, total: 3100, paid: 0, lessonDays: null })

    expect(reconcileMonthlyProrates(db).fixed).toBe(1)
    expect(rowOf(db, 1).total).toBe(2100)
  })
})
