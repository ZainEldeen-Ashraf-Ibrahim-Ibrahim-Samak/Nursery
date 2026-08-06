import { vi, describe, it, expect } from 'vitest'

// Mock Electron modules
vi.mock('electron', () => {
  return {
    ipcMain: {
      handle: vi.fn()
    },
    app: {
      getPath: () => 'mock-user-data'
    }
  }
})

import { calculateDashboard } from '../../electron/ipc/dashboardIPC.js'

describe('Dashboard calculations unit tests', () => {
  // `expected_total` is what the row will be worth by month end; `total` is what has accrued so
  // far. They differ for attendance-billed services partway through a month — the last row here
  // is such a case (only 500 of an eventual 1000 has accrued).
  const mockPayments = [
    { expected_total: 2000, total: 2000, paid: 2000, balance: 0, service: 'حضانة' },
    { expected_total: 1500, total: 1500, paid: 500, balance: 1000, service: 'استضافة' },
    { expected_total: 500, total: 500, paid: 0, balance: 500, service: 'جلسة' },
    { expected_total: 1000, total: 1000, paid: 1200, balance: -200, service: 'جلسة' }, // overpayment
  ]

  const mockExpenses = [
    { amount: 300 },
    { amount: 700 },
  ]

  const mockSalaries = { due: 4000, paid: 4000, remaining: 0 }

  const targetProfitPct = 0.20 // 20%

  it('should compute core KPIs correctly', () => {
    const result = calculateDashboard(mockPayments as any, mockExpenses as any, mockSalaries, targetProfitPct)

    expect(result.invoiced).toBe(5000) // 2000 + 1500 + 500 + 1000
    expect(result.collected).toBe(3700) // 2000 + 500 + 0 + 1200
    // Children owe 1000 + 500; the overpaid row contributes 0, not -200.
    // Salaries are fully paid (0 remaining), plus the month's 1000 of expenses.
    expect(result.arrears).toBe(2500)
    expect(result.arrearsBreakdown).toEqual({ children: 1500, salaries: 0, expenses: 1000 })
    expect(result.collectionRate).toBe(0.74) // 3700 / 5000 = 74%

    expect(result.expensesTotal).toBe(1000) // 300 + 700
    expect(result.salariesTotal).toBe(4000)
    expect(result.netProfit).toBe(-1300) // collected - (expensesTotal + salariesTotal) = 3700 - 5000 = -1300
  })

  it('should invoice on the expected total, not the amount accrued so far', () => {
    // A day-billed enrollment 40% of the way through the month: 800 accrued of an eventual 2000.
    const midMonth = [{ expected_total: 2000, total: 800, paid: 800, balance: 0, service: 'حضانة' }]
    const result = calculateDashboard(midMonth as any, [], { due: 0, paid: 0, remaining: 0 }, 0.20)

    expect(result.invoiced).toBe(2000)
    expect(result.billed).toBe(800)
    // Owed by month end, even though the stored `balance` column reads 0.
    expect(result.arrearsBreakdown.children).toBe(1200)
  })

  it('should count unpaid salaries and month expenses as outstanding', () => {
    const result = calculateDashboard(
      [{ expected_total: 1000, total: 1000, paid: 1000, balance: 0, service: 'حضانة' }] as any,
      [{ amount: 250 }],
      { due: 5000, paid: 2000, remaining: 3000 },
      0.20
    )

    expect(result.arrearsBreakdown).toEqual({ children: 0, salaries: 3000, expenses: 250 })
    expect(result.arrears).toBe(3250)
    // Net profit stays cash-based: only salaries actually paid out count against collections.
    expect(result.salariesTotal).toBe(2000)
    expect(result.salariesDue).toBe(5000)
    expect(result.netProfit).toBe(-1250) // 1000 - (250 + 2000)
  })

  it('should compute target planning metrics correctly', () => {
    const result = calculateDashboard(mockPayments as any, mockExpenses as any, mockSalaries, targetProfitPct)

    // totalExpenses = expensesTotal + salariesTotal = 1000 + 4000 = 5000
    // targetRequired = 5000 / (1 - 0.20) = 6250
    // gap = 6250 - 3700 = 2550
    expect(result.targetRequired).toBe(6250)
    expect(result.gap).toBe(2550)
  })

  it('should handle zero totals and divide-by-zero cases gracefully', () => {
    const result = calculateDashboard([], [], { due: 0, paid: 0, remaining: 0 }, 0.20)

    expect(result.invoiced).toBe(0)
    expect(result.collected).toBe(0)
    expect(result.arrears).toBe(0)
    expect(result.collectionRate).toBe(0) // Safe fallback
    expect(result.expensesTotal).toBe(0)
    expect(result.salariesTotal).toBe(0)
    expect(result.netProfit).toBe(0)
    expect(result.targetRequired).toBe(0)
    expect(result.gap).toBe(0)
  })
})
