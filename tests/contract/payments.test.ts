import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { initDb, closeDb } from '../../electron/db/connection.js'
import { runMigrations } from '../../electron/db/migrations/index.js'
import { seedDatabase } from '../../electron/db/seed.js'

// Mock Electron modules
vi.mock('electron', () => {
  const handlers: Record<string, Function> = {};
  (globalThis as any).__paymentsHandlers = handlers

  return {
    ipcMain: {
      handle: (channel: string, callback: Function) => {
        ;(globalThis as any).__paymentsHandlers[channel] = callback
      }
    },
    app: {
      getPath: () => 'mock-user-data'
    }
  }
})

// Import files to register handlers
import '../../electron/ipc/paymentsIPC.js'
import { setCurrentUser } from '../../electron/ipc/authIPC.js'

describe('Payments IPC Contract tests', () => {
  let db: any
  const getHandlers = () => (globalThis as any).__paymentsHandlers

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    db = initDb()
    runMigrations(db)
    await seedDatabase(db)
  })

  beforeEach(() => {
    db.prepare('DELETE FROM payments').run()
    db.prepare('DELETE FROM children').run()
    setCurrentUser(null)
  })

  const adminSession = () => {
    setCurrentUser({ id: 1, username: 'admin', role: 'admin', is_active: 1 })
  }

  const employeeSession = () => {
    setCurrentUser({ id: 2, username: 'emp1', role: 'employee', is_active: 1 })
  }

  it('should block anonymous users', async () => {
    const getHandler = getHandlers()['payments:get']
    await expect(getHandler(null, { month: 'يناير', year: 2026 })).rejects.toThrow('UNAUTHORIZED')
  })

  it('should generate payments for active children and skip existing ones (idempotent)', async () => {
    const generateHandler = getHandlers()['payments:generate']
    const getHandler = getHandlers()['payments:get']
    expect(generateHandler).toBeDefined()
    expect(getHandler).toBeDefined()

    // Add children directly to DB
    db.prepare(`
      INSERT INTO children (id, name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, is_active)
      VALUES 
        (1, 'طفل 1', 'ولي 1', '010', 'حضانة', 'شهر', 2500, '2026-01-01', '2026-06-06', '2026-06-06', 1),
        (2, 'طفل 2', 'ولي 2', '011', 'استضافة', 'يوم', 150, '2026-01-01', '2026-06-06', '2026-06-06', 0) -- Inactive
    `).run()

    db.prepare(`
      INSERT INTO child_services (child_id, service, unit, price, created_at, updated_at)
      VALUES 
        (1, 'حضانة', 'شهر', 2500, '2026-06-06', '2026-06-06'),
        (2, 'استضافة', 'يوم', 150, '2026-06-06', '2026-06-06')
    `).run()

    employeeSession()

    // Generate for June 2026
    const genResult = await generateHandler(null, { month: 'يونيو', year: 2026 })
    expect(genResult.created).toBe(1) // Only active child 1

    // Fetch payments
    const getResult = await getHandler(null, { month: 'يونيو', year: 2026 })
    expect(getResult.payments.length).toBe(1)
    expect(getResult.payments[0].child_name).toBe('طفل 1')
    expect(getResult.payments[0].price).toBe(2500)
    expect(getResult.payments[0].quantity).toBe(1)
    expect(getResult.payments[0].total).toBe(2500)
    expect(getResult.payments[0].paid).toBe(0)
    expect(getResult.payments[0].balance).toBe(2500)
    expect(getResult.payments[0].status).toBe('unpaid')

    // Summary checks
    expect(getResult.summary.totalInvoiced).toBe(2500)
    expect(getResult.summary.totalCollected).toBe(0)
    expect(getResult.summary.arrears).toBe(2500)

    // Generate again (idempotent check)
    const genResult2 = await generateHandler(null, { month: 'يونيو', year: 2026 })
    expect(genResult2.created).toBe(0)
  })

  it('should update payment recording quantity/paid, ignore client price, and recompute server-side', async () => {
    const updateHandler = getHandlers()['payments:update']
    
    // Create direct child and payment
    db.prepare(`
      INSERT INTO children (id, name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, is_active)
      VALUES (10, 'طفل 10', 'ولي 10', '010', 'حضانة', 'شهر', 2000, '2026-01-01', '2026-06-06', '2026-06-06', 1)
    `).run()

    db.prepare(`
      INSERT INTO child_services (id, child_id, service, unit, price, created_at, updated_at)
      VALUES (10, 10, 'حضانة', 'شهر', 2000, '2026-06-06', '2026-06-06')
    `).run()

    db.prepare(`
      INSERT INTO payments (id, child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, created_at, updated_at, synced)
      VALUES (100, 10, 10, 'يونيو', 2026, 'حضانة', 'شهر', 1, 2000, 2000, 0, 2000, 'unpaid', '2026-06-06', '2026-06-06', 1)
    `).run()

    employeeSession()

    // Update with quantity=1.5, paid=2000, and trying to cheat price=100
    const updated = await updateHandler(null, {
      id: 100,
      quantity: 1.5,
      paid: 2000,
      price: 100 // client-supplied price should be ignored
    })

    expect(updated.quantity).toBe(1.5)
    expect(updated.price).toBe(2000) // kept original child price
    expect(updated.total).toBe(3000) // 1.5 * 2000
    expect(updated.paid).toBe(2000)
    expect(updated.balance).toBe(1000) // 3000 - 2000
    expect(updated.status).toBe('partial')
    expect(updated.synced).toBe(0) // reset synced to 0
  })

  it('should support bulk recording full payments', async () => {
    const bulkPayHandler = getHandlers()['payments:bulkPay']
    const getHandler = getHandlers()['payments:get']

    db.prepare(`
      INSERT INTO children (id, name, guardian, guardian_phone, service, unit, price, reg_date, created_at, updated_at, is_active)
      VALUES 
        (20, 'طفل 20', 'ولي 20', '010', 'حضانة', 'شهر', 2000, '2026-01-01', '2026-06-06', '2026-06-06', 1),
        (21, 'طفل 21', 'ولي 21', '011', 'حضانة', 'شهر', 1500, '2026-01-01', '2026-06-06', '2026-06-06', 1)
    `).run()

    db.prepare(`
      INSERT INTO child_services (id, child_id, service, unit, price, created_at, updated_at)
      VALUES 
        (20, 20, 'حضانة', 'شهر', 2000, '2026-06-06', '2026-06-06'),
        (21, 21, 'حضانة', 'شهر', 1500, '2026-06-06', '2026-06-06')
    `).run()

    db.prepare(`
      INSERT INTO payments (id, child_id, service_id, month, year, service, unit, quantity, price, total, paid, balance, status, created_at, updated_at, synced)
      VALUES 
        (200, 20, 20, 'يونيو', 2026, 'حضانة', 'شهر', 1, 2000, 2000, 500, 1500, 'partial', '2026-06-06', '2026-06-06', 1),
        (201, 21, 21, 'يونيو', 2026, 'حضانة', 'شهر', 1, 1500, 1500, 0, 1500, 'unpaid', '2026-06-06', '2026-06-06', 1)
    `).run()

    adminSession()

    const bulkResult = await bulkPayHandler(null, { ids: [200, 201] })
    expect(bulkResult.updated).toBe(2)

    const listResult = await getHandler(null, { month: 'يونيو', year: 2026 })
    const p1 = listResult.payments.find((p: any) => p.id === 200)
    const p2 = listResult.payments.find((p: any) => p.id === 201)

    expect(p1.paid).toBe(2000)
    expect(p1.balance).toBe(0)
    expect(p1.status).toBe('paid')

    expect(p2.paid).toBe(1500)
    expect(p2.balance).toBe(0)
    expect(p2.status).toBe('paid')
  })
})
