import { describe, it, expect } from 'vitest'
import { getEnrollmentDays } from '../../src/utils/enrollmentDays.js'

const AUG_9 = new Date(2026, 7, 9) // 9 Aug 2026, a 31-day month

describe('getEnrollmentDays', () => {
  it('counts a mid-month join from the registration day, not the 1st', () => {
    const days = getEnrollmentDays('2026-08-05', AUG_9)
    expect(days.monthDays).toBe(5) // 5th through 9th, inclusive
    expect(days.totalDays).toBe(5)
    expect(days.daysInMonth).toBe(31)
    expect(days.joinedMidMonth).toBe(true)
    expect(days.joinDayOfMonth).toBe(5)
  })

  it('counts the current month from the 1st for a child enrolled earlier', () => {
    const days = getEnrollmentDays('2026-07-15', AUG_9)
    expect(days.monthDays).toBe(9) // 1st through 9th of August
    expect(days.totalDays).toBe(26) // 17 days of July + 9 of August
    expect(days.joinedMidMonth).toBe(false)
    expect(days.joinDayOfMonth).toBe(null)
  })

  it('treats a join on the 1st as a full month, not a mid-month join', () => {
    const days = getEnrollmentDays('2026-08-01', AUG_9)
    expect(days.monthDays).toBe(9)
    expect(days.totalDays).toBe(9)
    expect(days.joinedMidMonth).toBe(false)
  })

  it('counts the registration day itself', () => {
    const days = getEnrollmentDays('2026-08-09', AUG_9)
    expect(days.monthDays).toBe(1)
    expect(days.totalDays).toBe(1)
  })

  it('reports zero for a future registration date instead of negative days', () => {
    const days = getEnrollmentDays('2026-08-20', AUG_9)
    expect(days.monthDays).toBe(0)
    expect(days.totalDays).toBe(0)
    expect(days.isValid).toBe(true)
  })

  it('accepts a full ISO timestamp without shifting the day', () => {
    const days = getEnrollmentDays('2026-08-05T00:00:00Z', AUG_9)
    expect(days.joinDayOfMonth).toBe(5)
    expect(days.monthDays).toBe(5)
  })

  it('flags a missing or unparseable registration date', () => {
    expect(getEnrollmentDays(null, AUG_9).isValid).toBe(false)
    expect(getEnrollmentDays('', AUG_9).isValid).toBe(false)
    expect(getEnrollmentDays('not-a-date', AUG_9).isValid).toBe(false)
  })

  it('reports a full past month rather than stopping at today', () => {
    const days = getEnrollmentDays('2026-01-01', new Date(2026, 1, 28)) // Feb 2026, 28 days
    expect(days.monthDays).toBe(28)
    expect(days.daysInMonth).toBe(28)
  })
})
