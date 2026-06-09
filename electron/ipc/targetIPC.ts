import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin } from './_guard.js'

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
]

// Pure helpers (same logic as dashboard, kept DRY per file)
function calcRequiredRevenue(totalExpenses: number, targetProfitPct: number): number {
  if (targetProfitPct >= 1 || targetProfitPct < 0) return totalExpenses
  return Number((totalExpenses / (1 - targetProfitPct)).toFixed(2))
}

function calcGap(requiredRevenue: number, collected: number): number {
  return Number(Math.max(0, requiredRevenue - collected).toFixed(2))
}

function calcCoveragePct(collected: number, requiredRevenue: number): number {
  if (requiredRevenue <= 0) return 1.0
  return Number(Math.min(1, collected / requiredRevenue).toFixed(4))
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
ipcMain.handle('target:get', async (_event, { year }) => {
  try {
    requireAdmin()
    const db = getDb()

    if (!year) throw new Error('Year is required')

    const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get() as any
    const targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : 0.20

    const result = []

    for (const month of arabicMonths) {
      const payments = db.prepare(
        'SELECT paid FROM payments WHERE month = ? AND year = ?'
      ).all(month, year) as { paid: number }[]

      const expenses = db.prepare(
        'SELECT amount FROM expenses WHERE month = ? AND year = ?'
      ).all(month, year) as { amount: number }[]

      const salaries = db.prepare(
        'SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?'
      ).all(month, year) as { actual_paid: number }[]

      const collected = payments.reduce((s, p) => s + p.paid, 0)
      const expensesTotal = expenses.reduce((s, e) => s + e.amount, 0)
      const salariesTotal = salaries.reduce((s, s2) => s + s2.actual_paid, 0)
      const totalExpenses = expensesTotal + salariesTotal

      const targetRequired = calcRequiredRevenue(totalExpenses, targetProfitPct)
      const gap = calcGap(targetRequired, collected)
      const coveragePct = calcCoveragePct(collected, targetRequired)

      result.push({
        month,
        collected: Number(collected.toFixed(2)),
        expenses: Number(expensesTotal.toFixed(2)),
        salaries: Number(salariesTotal.toFixed(2)),
        totalExpenses: Number(totalExpenses.toFixed(2)),
        targetRequired,
        gap,
        coveragePct,
        status: gap === 0 ? 'met' : 'missed'
      })
    }

    return {
      rows: result,
      targetProfitPct,
      annualCollected: Number(result.reduce((s, r) => s + r.collected, 0).toFixed(2)),
      annualExpenses: Number(result.reduce((s, r) => s + r.totalExpenses, 0).toFixed(2)),
      annualTargetRequired: Number(result.reduce((s, r) => s + r.targetRequired, 0).toFixed(2)),
      annualGap: Number(result.reduce((s, r) => s + r.gap, 0).toFixed(2)),
    }
  } catch (error: any) {
    console.error('Failed to get target data:', error)
    throw new Error(error.message || 'Failed to get target data')
  }
})

/**
 * target:calc { distribution }
 * Computes projected revenue and coverage for a custom service distribution.
 * distribution: { حضانة?: number, استضافة?: number, جلسة?: number }
 * Admin only.
 */
ipcMain.handle('target:calc', async (_event, { distribution, month, year, targetProfitPct: overridePct }) => {
  try {
    requireAdmin()
    const db = getDb()

    // Get current pricing
    const settings = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[]
    const settingMap: Record<string, string> = {}
    for (const s of settings) settingMap[s.key] = s.value

    const pricing: Record<string, number> = {
      حضانة: Number(settingMap['nursery_monthly'] || 2500),
      استضافة: Number(settingMap['hosting_monthly'] || 3000),
      جلسة: Number(settingMap['session_hourly'] || 100)
    }

    // Compute projected monthly revenue
    let projectedRevenue = 0
    const unitsNeeded: Record<string, number> = {}

    for (const [service, count] of Object.entries(distribution as Record<string, number>)) {
      const price = pricing[service] ?? 0
      projectedRevenue += count * price
    }
    projectedRevenue = Number(projectedRevenue.toFixed(2))

    // Get target expenses for the given month/year (if provided)
    let targetRequired = 0
    if (month && year) {
      const expenses = db.prepare(
        'SELECT amount FROM expenses WHERE month = ? AND year = ?'
      ).all(month, year) as { amount: number }[]
      const salaries = db.prepare(
        'SELECT actual_paid FROM salary_payments WHERE month = ? AND year = ?'
      ).all(month, year) as { actual_paid: number }[]

      const totalExp = expenses.reduce((s, e) => s + e.amount, 0) +
                       salaries.reduce((s, s2) => s + s2.actual_paid, 0)

      // Use the caller-supplied target profit % when provided (feature 004,
      // FR-014); otherwise fall back to the saved setting. The formula is
      // unchanged so an equal value reproduces the prior result (FR-015).
      let targetProfitPct: number
      if (overridePct !== undefined && overridePct !== null && overridePct !== '') {
        targetProfitPct = Number(overridePct)
      } else {
        const targetProfitRow = db.prepare("SELECT value FROM settings WHERE key = 'target_profit_pct'").get() as any
        targetProfitPct = targetProfitRow ? Number(targetProfitRow.value) : 0.20
      }
      targetRequired = calcRequiredRevenue(totalExp, targetProfitPct)
    }

    const coveragePct = targetRequired > 0
      ? Number(Math.min(1, projectedRevenue / targetRequired).toFixed(4))
      : 0

    // Suggest units needed per service to reach target
    const services = Object.keys(pricing)
    for (const service of services) {
      const price = pricing[service]
      if (price > 0 && targetRequired > 0) {
        unitsNeeded[service] = Math.ceil(targetRequired / (services.length * price))
      } else {
        unitsNeeded[service] = 0
      }
    }

    return {
      projectedRevenue,
      targetRequired,
      coveragePct,
      unitsNeeded,
      pricing
    }
  } catch (error: any) {
    console.error('Failed to calc target:', error)
    throw new Error(error.message || 'Failed to calculate target')
  }
})
