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
