import { vi, describe, it, expect } from 'vitest'

// paymentsIPC registers its IPC handlers on import, so `electron` has to be stubbed before the
// module is pulled in — otherwise importing these two pure helpers tries to boot real Electron.
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  app: { getPath: () => 'mock-user-data' },
}))

import { calculatePayment, calculatePaymentPreservingProrate } from '../../electron/ipc/paymentsIPC.js'

/**
 * Regression tests for the pro-rate being destroyed on recomputation.
 *
 * A child who enrolls mid-month is billed only for the remaining days. `payments:generate`
 * stores that discounted figure in `total` AND `prorated_calculated`, but leaves `quantity` at 1
 * and `price` at the FULL monthly rate. Every later recomputation (payments:update, adding an
 * installment, the post-pull sync reconciliation) used to re-derive `total = quantity × price`,
 * silently re-inflating the invoice to a whole month and overcharging the family.
 */
describe('calculatePaymentPreservingProrate', () => {
  // 1200/month, enrolled on the 20th of a 30-day month → 11/30 ≈ 440
  const proratedMonthly = { unit: 'شهر', prorated_calculated: 440 }

  it('keeps the pro-rated total instead of re-deriving quantity × price', () => {
    const result = calculatePaymentPreservingProrate(proratedMonthly, 1, 1200, 0)
    expect(result.total).toBe(440)
    expect(result.balance).toBe(440)
    expect(result.status).toBe('unpaid')
  })

  it('is what plain calculatePayment would have got wrong', () => {
    // The bug: the full month's price comes back as the total.
    expect(calculatePayment(1, 1200, 0).total).toBe(1200)
    expect(calculatePaymentPreservingProrate(proratedMonthly, 1, 1200, 0).total).toBe(440)
  })

  it('marks a pro-rated invoice fully paid once the discounted amount is covered', () => {
    const result = calculatePaymentPreservingProrate(proratedMonthly, 1, 1200, 440)
    expect(result.status).toBe('paid')
    expect(result.balance).toBe(0)
  })

  it('reports a partial payment against the pro-rated total, not the full month', () => {
    const result = calculatePaymentPreservingProrate(proratedMonthly, 1, 1200, 200)
    expect(result.status).toBe('partial')
    expect(result.balance).toBe(240)
  })

  it('allows overpayment to go negative, matching calculatePayment', () => {
    const result = calculatePaymentPreservingProrate(proratedMonthly, 1, 1200, 500)
    expect(result.status).toBe('paid')
    expect(result.balance).toBe(-60)
  })

  it('falls back to quantity × price when the row is not pro-rated', () => {
    const plain = { unit: 'شهر', prorated_calculated: null }
    expect(calculatePaymentPreservingProrate(plain, 1, 1200, 0)).toEqual(calculatePayment(1, 1200, 0))
  })

  it('ignores prorated_calculated on per-session rows, where the discount is in the quantity', () => {
    // 'جلسة' pro-rating reduces the quantity, so quantity × price is already correct and
    // prorated_calculated is only a record of the computation.
    const session = { unit: 'جلسة', prorated_calculated: 400 }
    expect(calculatePaymentPreservingProrate(session, 4, 100, 0).total).toBe(400)
    expect(calculatePaymentPreservingProrate(session, 7, 100, 0).total).toBe(700)
  })

  it('tolerates a missing row without throwing', () => {
    expect(calculatePaymentPreservingProrate(undefined, 2, 300, 0).total).toBe(600)
    expect(calculatePaymentPreservingProrate(null, 2, 300, 0).total).toBe(600)
  })
})
