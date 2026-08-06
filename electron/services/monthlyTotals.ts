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

export const ARABIC_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

/** The extra-lessons row `payments:generate` creates; its quantity is admin-entered, not scheduled. */
export const EXTRA_LESSONS_SERVICE = 'حصص إضافية'

/** The columns the expected-total maths needs. Anything else on the row is ignored. */
export interface BillableRow {
  service: string
  unit: string
  quantity: number
  price: number
  paid?: number
  prorated_calculated?: number | null
  /** JSON array of weekday numbers (0=Sunday), from the enrollment or the child. */
  service_lesson_days?: string | null
}

export interface ExpectedTotals {
  expected_quantity: number
  expected_total: number
}

/**
 * Builds the expected-quantity / expected-total calculators for one month.
 *
 * For the month currently in progress, scheduled days are counted from today (inclusive) to
 * month end and added to what has already been billed — days that have already elapsed without
 * attendance were genuinely not owed, so counting the whole month would overstate the bill.
 * Any other month is counted in full, since there is no "today" boundary inside it.
 */
export function createExpectedTotalCalculator(month: string, year: number | string) {
  const monthIndex = ARABIC_MONTH_NAMES.indexOf(month)
  const payYear = Number(year)
  const daysInMonth = monthIndex !== -1 ? new Date(payYear, monthIndex + 1, 0).getDate() : 30

  const today = new Date()
  const isCurrentMonth = monthIndex === today.getMonth() && payYear === today.getFullYear()
  const startDay = isCurrentMonth ? today.getDate() : 1

  const countLessonDayOccurrences = (lessonDays: number[]): number => {
    let count = 0
    for (let d = startDay; d <= daysInMonth; d++) {
      if (lessonDays.includes(new Date(payYear, monthIndex, d).getDay())) count++
    }
    return count
  }

  const expectedQuantity = (p: BillableRow): number => {
    // Monthly enrollments are one unit regardless of the calendar.
    if (p.unit === 'شهر') return p.quantity || 1
    // Extra lessons are entered by hand ("3 extra sessions"), not derived from a schedule —
    // running them through the lesson-day counter invented sessions nobody agreed to.
    if (p.service === EXTRA_LESSONS_SERVICE) return p.quantity
    let lessonDays: number[] = []
    try {
      lessonDays = JSON.parse(p.service_lesson_days || '[]')
    } catch {
      /* no schedule set on the enrollment or the child */
    }
    if (lessonDays.length === 0 || monthIndex === -1) return p.quantity
    // Already-billed attendance + still-scheduled days left in the month. For a past month
    // startDay is 1, so this is the full schedule and `quantity` is not double counted.
    return isCurrentMonth ? p.quantity + countLessonDayOccurrences(lessonDays) : countLessonDayOccurrences(lessonDays)
  }

  const expectedTotal = (p: BillableRow, qty: number): number => {
    // A child who enrolled mid-month owes the pro-rated amount, not a whole month. That
    // discount lives in `prorated_calculated` (quantity stays 1, price stays the full rate),
    // so re-deriving quantity × price here would quietly bill them for the full month.
    if (p.unit === 'شهر' && p.prorated_calculated != null) {
      return Number((Number(p.prorated_calculated) * qty).toFixed(2))
    }
    return Number((qty * p.price).toFixed(2))
  }

  return { expectedQuantity, expectedTotal, monthIndex, daysInMonth, isCurrentMonth }
}

/** Annotates rows in place with `expected_quantity` / `expected_total`. */
export function attachExpectedTotals<T extends BillableRow>(
  rows: T[],
  month: string,
  year: number | string
): (T & ExpectedTotals)[] {
  const { expectedQuantity, expectedTotal } = createExpectedTotalCalculator(month, year)
  for (const row of rows as (T & ExpectedTotals)[]) {
    row.expected_quantity = expectedQuantity(row)
    row.expected_total = expectedTotal(row, row.expected_quantity)
  }
  return rows as (T & ExpectedTotals)[]
}

/**
 * Loads the month's payment rows with the columns the expected-total maths needs, already
 * annotated. Used by the Dashboard; the Payments screen selects more columns and calls
 * `attachExpectedTotals` on its own result set.
 */
export function getMonthBillableRows(db: any, month: string, year: number | string) {
  const rows = db
    .prepare(
      `
    SELECT p.service, p.unit, p.quantity, p.price, p.total, p.paid, p.balance, p.prorated_calculated,
      COALESCE(NULLIF(cs.lesson_days, '[]'), c.lesson_days) as service_lesson_days
    FROM payments p
    JOIN children c ON p.child_id = c.id
    LEFT JOIN child_services cs ON cs.id = p.service_id
    WHERE p.month = ? AND p.year = ?
  `
    )
    .all(month, year) as (BillableRow & { total: number; balance: number; paid: number })[]

  return attachExpectedTotals(rows, month, year)
}
