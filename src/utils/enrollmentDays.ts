/**
 * Enrolled-day math derived from a child's `reg_date`.
 *
 * A child who registers on the 15th has only been enrolled for part of that month, so the
 * month figure is counted from the registration day rather than from the 1st. The same
 * applies at the other end: the current month is only counted up to today, not to the last
 * day of the month.
 */

export interface EnrollmentDays {
  /** Days enrolled within the reference month, prorated when the child joined mid-month. */
  monthDays: number
  /** Total calendar days enrolled since reg_date, inclusive of the registration day. */
  totalDays: number
  /** Number of days in the reference month, for "16 / 31" style display. */
  daysInMonth: number
  /** True when reg_date falls inside the reference month on a day after the 1st. */
  joinedMidMonth: boolean
  /** Day-of-month the child joined; only meaningful when joinedMidMonth is true. */
  joinDayOfMonth: number | null
  /** False when reg_date is missing or unparseable — callers should render a dash. */
  isValid: boolean
}

const MS_PER_DAY = 86_400_000

/**
 * Parse the stored reg_date to a local midnight Date. reg_date is TEXT and may be either
 * 'YYYY-MM-DD' or a full ISO timestamp; taking only the date part and building the Date from
 * its components keeps the day from shifting under a UTC-negative timezone.
 */
function parseRegDate(regDate: string | null | undefined): Date | null {
  if (!regDate) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(regDate.trim())
  if (!match) {
    const fallback = new Date(regDate)
    if (isNaN(fallback.getTime())) return null
    return startOfDay(fallback)
  }
  const [, y, m, d] = match
  const parsed = new Date(Number(y), Number(m) - 1, Number(d))
  return isNaN(parsed.getTime()) ? null : parsed
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Whole days between two local midnights, normalized through UTC so DST shifts don't round off. */
function diffInDays(later: Date, earlier: Date): number {
  const a = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate())
  const b = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())
  return Math.round((a - b) / MS_PER_DAY)
}

/**
 * @param regDate   The child's registration date as stored in `children.reg_date`.
 * @param reference The "today" to count up to, and the month to report on. Defaults to now.
 */
export function getEnrollmentDays(
  regDate: string | null | undefined,
  reference: Date = new Date()
): EnrollmentDays {
  const today = startOfDay(reference)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const reg = parseRegDate(regDate)

  if (!reg) {
    return {
      monthDays: 0,
      totalDays: 0,
      daysInMonth,
      joinedMidMonth: false,
      joinDayOfMonth: null,
      isValid: false,
    }
  }

  // A future registration date counts as not yet enrolled rather than as negative days.
  const totalDays = reg > today ? 0 : diffInDays(today, reg) + 1

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth(), daysInMonth)
  // Count from whichever came later (the 1st, or the join date) up to whichever came
  // earlier (today, or the month's end) — so a past month reports its full length.
  const windowStart = reg > monthStart ? reg : monthStart
  const windowEnd = today < monthEnd ? today : monthEnd
  const monthDays = windowStart > windowEnd ? 0 : diffInDays(windowEnd, windowStart) + 1

  const joinedInThisMonth =
    reg.getFullYear() === today.getFullYear() && reg.getMonth() === today.getMonth()

  return {
    monthDays,
    totalDays,
    daysInMonth,
    joinedMidMonth: joinedInThisMonth && reg.getDate() > 1,
    joinDayOfMonth: joinedInThisMonth ? reg.getDate() : null,
    isValid: true,
  }
}
