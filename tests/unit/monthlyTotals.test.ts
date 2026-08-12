import { describe, it, expect } from 'vitest'
import { ARABIC_MONTH_NAMES, attachExpectedTotals } from '../../electron/services/monthlyTotals.js'

describe('monthlyTotals expected quantity/total', () => {
  // January 2026 starts on a Thursday: Sundays fall on 4/11/18/25 and Tuesdays on 6/13/20/27,
  // so a Sunday+Tuesday schedule has 8 lesson days in the month.
  const pastMonth = { month: 'يناير', year: 2026 }
  const sundayTuesday = JSON.stringify([0, 2])

  it('bills a past month on the whole schedule, not the attendance recorded so far', () => {
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'يوم', quantity: 3, price: 100, service_lesson_days: sundayTuesday }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_quantity).toBe(8)
    expect(row.expected_total).toBe(800)
  })

  it('falls back to the billed quantity when the enrollment has no schedule', () => {
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'يوم', quantity: 3, price: 100, service_lesson_days: null }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_quantity).toBe(3)
    expect(row.expected_total).toBe(300)
  })

  it('treats a monthly enrollment as one unit and keeps a mid-month pro-rate', () => {
    const [full, prorated] = attachExpectedTotals(
      [
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, service_lesson_days: sundayTuesday },
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, prorated_calculated: 1800, service_lesson_days: sundayTuesday },
      ],
      pastMonth.month,
      pastMonth.year
    )

    expect(full.expected_total).toBe(3000)
    // A child who enrolled mid-month owes the pro-rated 1800, not a rebuilt full month.
    expect(prorated.expected_total).toBe(1800)
  })

  it('derives a monthly pro-rate from reg_date when none was stored on the row', () => {
    // Rows created before pro-rating existed, imported from Excel, or regenerated after the
    // fact carry no `prorated_calculated`; billing them a whole month ignored the start date.
    // No schedule here, so the split falls back to calendar days: January has 31 days and
    // joining on the 11th leaves 21 of them.
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'شهر', quantity: 1, price: 3100, reg_date: '2026-01-11' }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_prorate_basis).toEqual({ basis: 'days', remaining: 21, total: 31 })
    expect(row.expected_rate).toBe(2100)
    expect(row.expected_total).toBe(2100)
  })

  it('splits a mid-month subscription by the selected lesson days, not the calendar', () => {
    // A "3 days a week" subscription is sold as sessions, not as calendar days. Sundays fall on
    // 4/11/18/25 and Tuesdays on 6/13/20/27, so 8 sessions in the month; joining on the 11th
    // leaves 6 of them (11, 13, 18, 20, 25, 27).
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'شهر', quantity: 1, price: 3200, reg_date: '2026-01-11', service_lesson_days: sundayTuesday }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_prorate_basis).toEqual({ basis: 'sessions', remaining: 6, total: 8 })
    // 6/8 of the month's sessions remain — not the 21/31 of calendar days the old maths used.
    expect(row.expected_rate).toBe(2400)
    expect(row.expected_total).toBe(2400)
  })

  it('leaves a full-month subscription at the full price and reports no split', () => {
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'شهر', quantity: 1, price: 3200, reg_date: '2025-12-01', service_lesson_days: sundayTuesday }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_prorate_basis).toBeNull()
    expect(row.expected_rate).toBe(3200)
  })

  it('does not let a stored pro-rate be overridden by reg_date', () => {
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'شهر', quantity: 1, price: 3100, prorated_calculated: 1800, reg_date: '2026-01-11' }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_total).toBe(1800)
  })

  it('counts only the lesson days on or after the registration date', () => {
    // Sundays 4/11/18/25 and Tuesdays 6/13/20/27 — joining on the 14th leaves 18, 20, 25, 27.
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'يوم', quantity: 0, price: 100, reg_date: '2026-01-14', service_lesson_days: sundayTuesday }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_quantity).toBe(4)
    expect(row.expected_total).toBe(400)
  })

  it('owes nothing for a month that ended before the child registered', () => {
    const [daily, monthly] = attachExpectedTotals(
      [
        { service: 'حضانة', unit: 'يوم', quantity: 0, price: 100, reg_date: '2026-03-02', service_lesson_days: sundayTuesday },
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, reg_date: '2026-03-02' },
      ],
      pastMonth.month,
      pastMonth.year
    )

    expect(daily.expected_total).toBe(0)
    expect(monthly.expected_total).toBe(0)
  })

  it('reports the day billing actually starts from, so the drill-down can explain the figure', () => {
    const [before, during, after, unknown] = attachExpectedTotals(
      [
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, reg_date: '2025-11-20' },
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, reg_date: '2026-01-14' },
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, reg_date: '2026-03-02' },
        { service: 'حضانة', unit: 'شهر', quantity: 1, price: 3000, reg_date: null },
      ],
      pastMonth.month,
      pastMonth.year
    )

    expect(before.expected_from_day).toBe(1)
    expect(during.expected_from_day).toBe(14)
    expect(after.expected_from_day).toBeNull()
    // No registration date recorded — bill the full month rather than invent a discount.
    expect(unknown.expected_from_day).toBe(1)
    expect(unknown.expected_rate).toBe(3000)
  })

  it('bills the whole month when the child registered before it started', () => {
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'يوم', quantity: 0, price: 100, reg_date: '2025-11-20', service_lesson_days: sundayTuesday }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_quantity).toBe(8)
  })

  it('takes extra lessons at their entered quantity rather than off the schedule', () => {
    const [row] = attachExpectedTotals(
      [{ service: 'حصص إضافية', unit: 'جلسة', quantity: 2, price: 150, service_lesson_days: sundayTuesday }],
      pastMonth.month,
      pastMonth.year
    )

    expect(row.expected_quantity).toBe(2)
    expect(row.expected_total).toBe(300)
  })

  it('adds the days still to come to what is already billed in the month in progress', () => {
    const now = new Date()
    const [row] = attachExpectedTotals(
      [{ service: 'حضانة', unit: 'يوم', quantity: 5, price: 100, service_lesson_days: JSON.stringify([0, 1, 2, 3, 4, 5, 6]) }],
      ARABIC_MONTH_NAMES[now.getMonth()],
      now.getFullYear()
    )

    // Every remaining day of the month is a lesson day, so the expected figure is the 5 days
    // already billed plus today through month end — never less than what has accrued.
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    expect(row.expected_quantity).toBe(5 + (daysInMonth - now.getDate() + 1))
  })
})
