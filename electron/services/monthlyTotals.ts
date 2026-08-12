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
  /** The child's registration date (`YYYY-MM-DD`) — the first day they can be billed for. */
  reg_date?: string | null
}

export interface ExpectedTotals {
  expected_quantity: number
  expected_total: number
  /**
   * The per-unit rate `expected_total` was actually built from. Equals `price` for a full
   * month/day/session, and the pro-rated month rate for a child who joined mid-month — so the
   * UI can print "1 شهر × 231" instead of claiming a full 1000 next to a 231 total.
   */
  expected_rate: number
  /**
   * The first day of the month this enrollment is billable from — 1 for a child already
   * enrolled when the month began, their registration day for a mid-month start, and `null`
   * when the child had not registered yet at all. The drill-down needs it to explain a day
   * count or a pro-rated rate that is less than a full month.
   */
  expected_from_day: number | null
  /**
   * For a mid-month monthly subscription: how the split was worked out. `sessions` means it was
   * divided by the enrollment's selected lesson days ("4 of the month's 13 sessions remain"),
   * `days` means no schedule was set so calendar days were used. `null` for anything that is not
   * a pro-rated monthly line.
   */
  expected_prorate_basis: { basis: 'sessions' | 'days'; remaining: number; total: number } | null
}

/**
 * Parses a `YYYY-MM-DD` date without going through `new Date(string)`, which parses date-only
 * strings as UTC midnight and then reports local components — shifting the day by one in any
 * timezone behind UTC and silently moving a registration across a month boundary.
 * Returns a 0-based month, matching `Date#getMonth`.
 */
function parseIsoDate(value?: string | null): { year: number; month: number; day: number } | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim())
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
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

  const countLessonDayOccurrences = (lessonDays: number[], from: number): number => {
    let count = 0
    for (let d = from; d <= daysInMonth; d++) {
      if (lessonDays.includes(new Date(payYear, monthIndex, d).getDay())) count++
    }
    return count
  }

  /**
   * The first day of THIS month the child is billable from, or `null` when the enrollment does
   * not reach the month at all (registered in a later month).
   *
   * Without this, every expected figure counted the whole month for a child who joined on the
   * 19th: a Sunday+Thursday schedule in a past month was billed all 9 occurrences instead of the
   * 3 that fall after registration, and the Dashboard's "invoiced" KPI inherited the same
   * overstatement because it shares this calculator.
   */
  const billableFromDay = (p: BillableRow): number | null => {
    const reg = parseIsoDate(p.reg_date)
    if (!reg || monthIndex === -1) return 1
    // Registered after this month ended — nothing is owed for it.
    if (reg.year > payYear || (reg.year === payYear && reg.month > monthIndex)) return null
    // Registered before this month started — the whole month counts.
    if (reg.year < payYear || reg.month < monthIndex) return 1
    return Math.min(Math.max(reg.day, 1), daysInMonth)
  }

  const parseLessonDays = (p: BillableRow): number[] => {
    try {
      const parsed = JSON.parse(p.service_lesson_days || '[]')
      return Array.isArray(parsed) ? parsed.map(Number).filter((n) => Number.isInteger(n)) : []
    } catch {
      /* no schedule set on the enrollment or the child */
      return []
    }
  }

  /**
   * How a mid-month monthly subscription is split, and on what basis.
   *
   * A monthly enrollment with a weekday schedule ("fitness, 3 days a week") is not sold by the
   * calendar day — it is sold as a number of sessions per week. Splitting it on calendar days
   * charged the wrong fraction whenever the selected days are not spread evenly: joining before
   * the last week of a Mon/Wed/Sat service can leave most of the month's sessions still to come
   * even though few calendar days remain. So when the enrollment HAS selected days, the split is
   * "sessions still to come ÷ sessions in the whole month". Without a schedule there is nothing
   * to count and it falls back to calendar days.
   */
  const monthlyProrateBasis = (p: BillableRow, fromDay: number) => {
    const lessonDays = parseLessonDays(p)
    if (lessonDays.length > 0 && monthIndex !== -1) {
      const total = countLessonDayOccurrences(lessonDays, 1)
      if (total > 0) {
        return { basis: 'sessions' as const, remaining: countLessonDayOccurrences(lessonDays, fromDay), total, lessonDays }
      }
    }
    return {
      basis: 'days' as const,
      remaining: Math.max(0, daysInMonth - Math.min(fromDay, daysInMonth) + 1),
      total: daysInMonth,
      lessonDays,
    }
  }

  const expectedQuantity = (p: BillableRow): number => {
    const from = billableFromDay(p)
    // The enrollment starts after this month; it owes nothing here.
    if (from === null) return 0
    // Monthly enrollments are one unit regardless of the calendar — a mid-month start is
    // reflected in the RATE (see expectedRate), not in the quantity.
    if (p.unit === 'شهر') return p.quantity || 1
    // Extra lessons are entered by hand ("3 extra sessions"), not derived from a schedule —
    // running them through the lesson-day counter invented sessions nobody agreed to.
    if (p.service === EXTRA_LESSONS_SERVICE) return p.quantity
    const lessonDays = parseLessonDays(p)
    if (lessonDays.length === 0 || monthIndex === -1) return p.quantity
    // Count from whichever comes later: the child's registration day, or (in the month still in
    // progress) today — days already elapsed without attendance were genuinely not owed.
    const countFrom = Math.max(from, startDay)
    const scheduled = countLessonDayOccurrences(lessonDays, countFrom)
    // Already-billed attendance + still-scheduled days left in the month. For a past month
    // startDay is 1, so this is the full post-registration schedule and `quantity` is not
    // double counted.
    return isCurrentMonth ? p.quantity + scheduled : scheduled
  }

  /**
   * The per-unit rate to bill at. Only monthly enrollments can differ from `price`: a child who
   * joined mid-month owes a pro-rated month.
   *
   * `prorated_calculated` (written by `payments:generate`) wins when present, so an amount an
   * admin already settled against is never rewritten. When it is absent the rate is derived from
   * `reg_date` instead of falling back to the full price — rows created before pro-rating
   * existed, imported from Excel, or regenerated after the fact carry no stored discount, and
   * defaulting those to a whole month is exactly what billed a 19th-of-the-month enrollment the
   * full 550 instead of 231.
   */
  const expectedRate = (p: BillableRow): number => {
    if (p.unit !== 'شهر') return Number(p.price) || 0
    if (p.prorated_calculated != null) return Number(p.prorated_calculated)
    const from = billableFromDay(p)
    if (from === null) return 0
    return monthlyRate(Number(p.price) || 0, from, p)
  }

  /**
   * The month rate to charge a subscription starting on `fromDay`: the full price from the 1st,
   * otherwise the price scaled by whichever basis applies (see `monthlyProrateBasis`).
   */
  const monthlyRate = (price: number, fromDay: number, p: BillableRow): number => {
    if (!(fromDay > 1)) return price
    const { remaining, total } = monthlyProrateBasis(p, fromDay)
    if (total <= 0) return price
    return Math.round((price * remaining) / total)
  }

  const expectedTotal = (p: BillableRow, qty: number): number =>
    Number((qty * expectedRate(p)).toFixed(2))

  return {
    expectedQuantity,
    expectedRate,
    expectedTotal,
    billableFromDay,
    monthlyRate,
    monthlyProrateBasis,
    monthIndex,
    daysInMonth,
    isCurrentMonth,
  }
}

/** Annotates rows in place with `expected_quantity` / `expected_total`. */
export function attachExpectedTotals<T extends BillableRow>(
  rows: T[],
  month: string,
  year: number | string
): (T & ExpectedTotals)[] {
  const { expectedQuantity, expectedRate, expectedTotal, billableFromDay, monthlyProrateBasis } =
    createExpectedTotalCalculator(month, year)
  for (const row of rows as (T & ExpectedTotals)[]) {
    row.expected_quantity = expectedQuantity(row)
    row.expected_rate = expectedRate(row)
    row.expected_total = expectedTotal(row, row.expected_quantity)
    row.expected_from_day = billableFromDay(row)
    if (row.unit === 'شهر' && row.expected_from_day != null && row.expected_from_day > 1) {
      const { basis, remaining, total } = monthlyProrateBasis(row, row.expected_from_day)
      row.expected_prorate_basis = { basis, remaining, total }
    } else {
      row.expected_prorate_basis = null
    }
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
      c.reg_date,
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
