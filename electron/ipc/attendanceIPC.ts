import { ipcMain } from 'electron'
import { getDb } from '../db/connection.js'
import { requireAdmin, checkAuth, getCurrentUser } from './_guard.js'

/**
 * Pure payment-eligibility rule (spec.md FR-008…FR-011):
 *   teacher present + child attended            → payable
 *   teacher present + child absent (unexcused)   → payable
 *   teacher present + child absent (excused)     → not payable
 *   teacher absent (any child status)            → not payable
 * Exported for direct unit testing without touching the database.
 */
export function isPaymentEligible(teacherStatus: 'present' | 'absent' | null | undefined, childStatus: string): boolean {
  if (teacherStatus !== 'present') return false
  return childStatus === 'attended' || childStatus === 'absent_unexcused'
}

ipcMain.handle('attendance:getSheet', async (_event, { session_id }) => {
  try {
    checkAuth()
    const db = getDb()
    // Get session date to compute weekday
    const session = db.prepare('SELECT session_date FROM scheduled_sessions WHERE id = ?').get(session_id) as any
    let dayOfWeek: number | null = null
    if (session?.session_date) {
      // Parse date as local date to avoid UTC offset shifting the day
      const [y, m, d] = session.session_date.split('-').map(Number)
      dayOfWeek = new Date(y, m - 1, d).getDay()
    }

    // A child can have more than one teacher — one per service enrollment in child_services
    // (e.g. Speech Therapy with Ahmed, Occupational Therapy with Sara). Build one candidate
    // row per distinct (child, teacher) pair so each teacher gets their own attendance/payment
    // for that child, instead of collapsing onto a single flattened teacher.
    const activeChildren = db.prepare(`
      SELECT id as child_id, name as child_name, photo_url as child_photo_url, lesson_days
      FROM children WHERE is_active = 1
    `).all() as any[]

    const enrollments = db.prepare(`
      SELECT DISTINCT cs.child_id, cs.teacher_id, cs.lesson_days as enrollment_lesson_days
      FROM child_services cs
      WHERE cs.teacher_id IS NOT NULL
    `).all() as any[]
    const enrollmentsByChild = new Map<number, any[]>()
    for (const en of enrollments) {
      if (!enrollmentsByChild.has(en.child_id)) enrollmentsByChild.set(en.child_id, [])
      enrollmentsByChild.get(en.child_id)!.push(en)
    }

    type Candidate = { child_id: number; child_name: string; child_photo_url: string | null; teacher_id: number | null; lesson_days: string | null }
    const candidates: Candidate[] = []
    for (const c of activeChildren) {
      const childEnrollments = enrollmentsByChild.get(c.child_id) ?? []
      if (childEnrollments.length === 0) {
        candidates.push({ child_id: c.child_id, child_name: c.child_name, child_photo_url: c.child_photo_url, teacher_id: null, lesson_days: c.lesson_days })
      } else {
        // Distinct teachers only — the same teacher across two services for one child still
        // produces a single row, per the spec's "one row per teacher" (not per enrollment).
        const seenTeachers = new Set<number>()
        for (const en of childEnrollments) {
          if (seenTeachers.has(en.teacher_id)) continue
          seenTeachers.add(en.teacher_id)
          candidates.push({
            child_id: c.child_id, child_name: c.child_name, child_photo_url: c.child_photo_url,
            teacher_id: en.teacher_id, lesson_days: en.enrollment_lesson_days || c.lesson_days
          })
        }
      }
    }

    const teacherIds = [...new Set(candidates.map((c) => c.teacher_id).filter((id): id is number => id != null))]
    const teachersById = new Map<number, any>()
    if (teacherIds.length > 0) {
      const ph = teacherIds.map(() => '?').join(',')
      for (const t of db.prepare(`SELECT id, name, teacher_session_rate FROM employees WHERE id IN (${ph})`).all(...teacherIds) as any[]) {
        teachersById.set(t.id, t)
      }
    }

    const allRows = candidates.map((cand) => {
      const teacher = cand.teacher_id != null ? teachersById.get(cand.teacher_id) : null
      const ar = cand.teacher_id != null
        ? db.prepare(`SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?`).get(session_id, cand.child_id, cand.teacher_id) as any
        : db.prepare(`SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL`).get(session_id, cand.child_id) as any
      const tp = ar ? db.prepare(`SELECT * FROM teacher_payments WHERE attendance_record_id = ?`).get(ar.id) as any : null

      return {
        child_id: cand.child_id,
        child_name: cand.child_name,
        child_photo_url: cand.child_photo_url,
        lesson_days: cand.lesson_days,
        teacher_id: cand.teacher_id,
        teacher_name: teacher?.name ?? null,
        teacher_session_rate: teacher?.teacher_session_rate ?? null,
        attendance_id: ar?.id ?? null,
        status: ar?.status ?? null,
        excuse_notes: ar?.excuse_notes ?? null,
        recorded_by: ar?.recorded_by ?? null,
        recorded_at: ar?.recorded_at ?? null,
        updated_at: ar?.updated_at ?? null,
        attended_teacher_id: ar?.attended_teacher_id ?? null,
        teacher_status: ar?.teacher_status ?? null,
        payment: {
          generated: tp?.status === 'pending' || tp?.status === 'paid',
          amount: tp?.session_cost ?? null,
          status: tp?.status ?? null
        }
      }
    })

    // Filter to rows scheduled for that weekday, already recorded, or with no lesson_days set
    const rows = allRows.filter((r) => {
      if (r.attendance_id) return true
      if (!r.lesson_days || r.lesson_days === '[]' || r.lesson_days === '') return true
      if (dayOfWeek === null) return true
      try {
        const days: number[] = JSON.parse(r.lesson_days)
        return days.length === 0 || days.includes(dayOfWeek)
      } catch { return true }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    }).map(({ lesson_days, ...rest }) => rest)

    rows.sort((a, b) => a.child_name.localeCompare(b.child_name))
    return rows
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get attendance sheet')
  }
})

ipcMain.handle('attendance:record', async (_event, args) => {
  try {
    checkAuth()
    const db = getDb()
    const user = getCurrentUser()
    const now = new Date().toISOString()
    const results: any[] = []

    // Support both { session_id, records } and flat array of records
    const sessionId = args?.session_id
    const records: any[] = Array.isArray(args) ? args : (args?.records ?? [])

    // Teachers whose per-child row this save made payable-relevant; auto-linked to the session
    // so they show up in salariesIPC's session_teachers-based payroll views.
    const payableTeachersBySession = new Map<number, Set<number>>()

    const upsert = db.transaction(() => {
      for (const rec of records) {
        const session_id = sessionId ?? rec.session_id
        const { child_id, status, excuse_notes = null, teacher_status = 'present' } = rec
        const validStatuses = ['attended', 'absent_excused', 'absent_unexcused']
        if (!validStatuses.includes(status)) throw new Error(`Invalid status: ${status}`)
        if (teacher_status !== 'present' && teacher_status !== 'absent') {
          throw new Error(`Invalid teacher_status: ${teacher_status}`)
        }

        // A child can have more than one teacher (one per service enrollment), so the caller
        // must say which teacher's row this is — attendance:getSheet returns teacher_id per
        // row precisely so the UI can send it back here. Fall back to the child's single
        // flattened teacher_id only for older callers that don't yet pass it explicitly.
        let attended_teacher_id: number | null
        if ('teacher_id' in rec) {
          attended_teacher_id = rec.teacher_id ?? null
        } else {
          const child = db.prepare('SELECT teacher_id FROM children WHERE id = ?').get(child_id) as any
          attended_teacher_id = child?.teacher_id ?? null
        }
        const sessionRow = db.prepare('SELECT session_date FROM scheduled_sessions WHERE id = ?').get(session_id) as any
        const attendanceDate: string | undefined = sessionRow?.session_date

        // SQLite treats NULL as distinct in a UNIQUE index, so ON CONFLICT never matches a
        // NULL attended_teacher_id — look up any existing no-teacher row for this child/session
        // explicitly and update it in place instead of inserting a second one.
        const existingRecord = attended_teacher_id == null
          ? db.prepare('SELECT id FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL').get(session_id, child_id) as any
          : null

        if (existingRecord) {
          db.prepare(`
            UPDATE attendance_records
            SET status = ?, excuse_notes = ?, recorded_by = ?, updated_at = ?, teacher_status = ?, synced = 0
            WHERE id = ?
          `).run(status, excuse_notes, user?.id ?? null, now, teacher_status, existingRecord.id)
        } else {
          db.prepare(`
            INSERT INTO attendance_records (session_id, child_id, status, excuse_notes, recorded_by, recorded_at, updated_at, synced, attended_teacher_id, teacher_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            ON CONFLICT(session_id, child_id, attended_teacher_id) DO UPDATE SET
              status = excluded.status,
              excuse_notes = excluded.excuse_notes,
              recorded_by = excluded.recorded_by,
              updated_at = excluded.updated_at,
              teacher_status = excluded.teacher_status,
              synced = 0
          `).run(session_id, child_id, status, excuse_notes, user?.id ?? null, now, now, attended_teacher_id, teacher_status)
        }

        const savedRecord = attended_teacher_id == null
          ? db.prepare('SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL').get(session_id, child_id) as any
          : db.prepare('SELECT * FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?').get(session_id, child_id, attended_teacher_id) as any

        // Evaluate the five payment-eligibility cases (FR-008…FR-011) and keep the
        // teacher_payments ledger in sync, with duplicate protection via the UNIQUE
        // constraint on (teacher_id, child_id, attendance_date) and a paid row never
        // being auto-mutated (research.md #7).
        if (attended_teacher_id && attendanceDate) {
          const existing = db.prepare(`
            SELECT * FROM teacher_payments WHERE teacher_id = ? AND child_id = ? AND attendance_date = ?
          `).get(attended_teacher_id, child_id, attendanceDate) as any

          const payable = isPaymentEligible(teacher_status, status)

          // Resolve the effective rate: the teacher's own rate takes priority; if the admin
          // never configured one for this specific teacher, fall back to the org-wide default
          // rate in Settings (`default_teacher_session_rate`) rather than skipping payment.
          const teacherRow = db.prepare('SELECT teacher_session_rate FROM employees WHERE id = ?').get(attended_teacher_id) as any
          let effectiveRate: number | null = teacherRow?.teacher_session_rate ?? null
          if (effectiveRate == null) {
            const defaultSetting = db.prepare("SELECT value FROM settings WHERE key = 'default_teacher_session_rate'").get() as any
            const defaultRate = defaultSetting?.value != null ? Number(defaultSetting.value) : NaN
            if (!isNaN(defaultRate) && defaultRate > 0) effectiveRate = defaultRate
          }
          const hasEffectiveRate = effectiveRate != null

          if (payable && hasEffectiveRate) {
            if (!existing || existing.status === 'void' || existing.status === 'pending') {
              // Re-snapshot the rate on every qualifying save while the payment is still
              // Pending (not yet settled), so correcting a teacher's rate — e.g. from the
              // org-wide default down to their own configured rate — is reflected immediately
              // instead of freezing in whatever rate happened to apply at first save. Once a
              // payment is marked Paid it is excluded from this branch entirely and is never
              // auto-mutated (research.md #7).
              db.prepare(`
                INSERT INTO teacher_payments (teacher_id, child_id, attendance_record_id, attendance_date, session_cost, status, created_at, updated_at, synced)
                VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, 0)
                ON CONFLICT(teacher_id, child_id, attendance_date) DO UPDATE SET
                  attendance_record_id = excluded.attendance_record_id,
                  session_cost = excluded.session_cost,
                  status = 'pending',
                  updated_at = excluded.updated_at,
                  synced = 0
              `).run(attended_teacher_id, child_id, savedRecord.id, attendanceDate, effectiveRate, now, now)
            }
            // existing.status === 'paid': left untouched — a settled payment is never auto-mutated.
          } else if ((!payable || !hasEffectiveRate) && existing && existing.status === 'pending') {
            db.prepare(`UPDATE teacher_payments SET status = 'void', updated_at = ?, synced = 0 WHERE id = ?`)
              .run(now, existing.id)
          }
        }

        if ((status === 'attended' || status === 'absent_unexcused') && attended_teacher_id != null) {
          if (!payableTeachersBySession.has(session_id)) payableTeachersBySession.set(session_id, new Set())
          payableTeachersBySession.get(session_id)!.add(attended_teacher_id)
        }

        results.push(savedRecord)
      }

      // Auto-assign teachers: each payable (child, teacher) row contributes that teacher to
      // the session, so per-session salary is credited without any manual teacher assignment —
      // now correctly covering every teacher a child has, not just the child's single
      // flattened teacher_id.
      for (const [session_id, teacherIds] of payableTeachersBySession) {
        for (const teacher_id of teacherIds) {
          db.prepare('INSERT OR IGNORE INTO session_teachers (session_id, employee_id, synced) VALUES (?, ?, 0)')
            .run(session_id, teacher_id)
        }
      }
    })
    upsert()
    return results
  } catch (error: any) {
    throw new Error(error.message || 'Failed to record attendance')
  }
})

// Removes attendance records for the given (child, teacher) pairs in a session. Used when a
// status is cleared in the sheet so the previously-saved record does not linger and reappear.
// Each item may be a plain child_id (legacy — deletes every teacher row for that child) or
// { child_id, teacher_id } (precise — deletes only that child's row for that specific teacher,
// since a child can now have more than one teacher's row in the same session).
ipcMain.handle('attendance:delete', async (_event, { session_id, child_ids }) => {
  try {
    checkAuth()
    const db = getDb()
    const rawItems: any[] = Array.isArray(child_ids) ? child_ids : []
    const items: { child_id: number; teacher_id: number | null | undefined }[] = rawItems.map((it) =>
      typeof it === 'object' ? { child_id: it.child_id, teacher_id: it.teacher_id } : { child_id: it, teacher_id: undefined }
    )
    if (items.length === 0) return { ok: true, deleted: 0 }
    let deleted = 0
    const now = new Date().toISOString()
    db.transaction(() => {
      for (const item of items) {
        const matchTeacher = item.teacher_id !== undefined
        const records = (matchTeacher
          ? (item.teacher_id == null
              ? db.prepare('SELECT id FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id IS NULL').all(session_id, item.child_id)
              : db.prepare('SELECT id FROM attendance_records WHERE session_id = ? AND child_id = ? AND attended_teacher_id = ?').all(session_id, item.child_id, item.teacher_id))
          : db.prepare('SELECT id FROM attendance_records WHERE session_id = ? AND child_id = ?').all(session_id, item.child_id)
        ) as { id: number }[]

        for (const { id: recordId } of records) {
          // A paid teacher_payments row must never disappear silently — leave its attendance
          // record (and the payment) in place rather than cascade-deleting a settled payment.
          const paid = db.prepare(`SELECT 1 FROM teacher_payments WHERE attendance_record_id = ? AND status = 'paid'`).get(recordId)
          if (paid) continue

          // Void any pending payment first (also covered by the FK's ON DELETE CASCADE, but
          // explicit here so the intent — void, not silently vanish — is unambiguous).
          db.prepare(`UPDATE teacher_payments SET status = 'void', updated_at = ?, synced = 0 WHERE status = 'pending' AND attendance_record_id = ?`)
            .run(now, recordId)
          db.prepare(`DELETE FROM attendance_conflicts WHERE attendance_record_id = ?`).run(recordId)
          const res = db.prepare(`DELETE FROM attendance_records WHERE id = ?`).run(recordId)
          deleted += Number(res.changes)
        }
      }
    })()
    return { ok: true, deleted }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete attendance')
  }
})

// Full attendance history for one child (FR-019), admin-only per the access-control
// clarification (payments/payroll are never visible to non-admins, even a teacher's own).
ipcMain.handle('attendance:getChildHistory', async (_event, { child_id }) => {
  try {
    requireAdmin()
    const db = getDb()
    return db.prepare(`
      SELECT
        ss.session_date as attendance_date,
        ar.attended_teacher_id as teacher_id,
        e.name as teacher_name,
        ar.teacher_status,
        ar.status as child_status,
        CASE WHEN tp.status IN ('pending','paid') THEN 1 ELSE 0 END as payment_generated,
        tp.status as payment_status,
        tp.session_cost
      FROM attendance_records ar
      JOIN scheduled_sessions ss ON ss.id = ar.session_id
      LEFT JOIN employees e ON e.id = ar.attended_teacher_id
      LEFT JOIN teacher_payments tp ON tp.attendance_record_id = ar.id
      WHERE ar.child_id = ?
      ORDER BY ss.session_date DESC
    `).all(child_id).map((row: any) => ({ ...row, payment_generated: !!row.payment_generated }))
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get attendance history')
  }
})

ipcMain.handle('attendance:getConflicts', async () => {
  try {
    requireAdmin()
    const db = getDb()
    return db.prepare('SELECT * FROM attendance_conflicts WHERE reviewed = 0 ORDER BY created_at DESC').all()
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get conflicts')
  }
})

ipcMain.handle('attendance:resolveConflict', async (_event, { conflict_id, final_status }) => {
  try {
    requireAdmin()
    const db = getDb()
    const conflict = db.prepare('SELECT * FROM attendance_conflicts WHERE id = ?').get(conflict_id) as any
    if (!conflict) throw new Error('التعارض غير موجود / Conflict not found')
    db.prepare('UPDATE attendance_conflicts SET reviewed = 1 WHERE id = ?').run(conflict_id)
    db.prepare('UPDATE attendance_records SET status = ?, updated_at = ?, synced = 0 WHERE id = ?')
      .run(final_status, new Date().toISOString(), conflict.attendance_record_id)
    return { ok: true }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to resolve conflict')
  }
})

ipcMain.handle('attendance:getSummary', async (_event, { employee_id, month, year }) => {
  try {
    requireAdmin()
    const db = getDb()
    const arabicMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
    const monthIdx = arabicMonths.indexOf(String(month))
    const monthNum = monthIdx !== -1 ? String(monthIdx + 1).padStart(2, '0') : String(month).padStart(2, '0')
    const yearStr = String(year)
    const monthStart = `${yearStr}-${monthNum}-01`
    const monthEnd = `${yearStr}-${monthNum}-31`

    const sessions = db.prepare(`
      SELECT ss.id FROM scheduled_sessions ss
      JOIN session_teachers st ON st.session_id = ss.id
      WHERE st.employee_id = ? AND ss.session_date >= ? AND ss.session_date <= ?
    `).all(employee_id, monthStart, monthEnd) as { id: number }[]

    const sessionIds = sessions.map((s) => s.id)
    if (sessionIds.length === 0) {
      return { total_sessions: 0, payable_sessions: 0, excused_absences: 0, unexcused_absences: 0, breakdown: [] }
    }

    const placeholders = sessionIds.map(() => '?').join(',')
    const records = db.prepare(`
      SELECT status, COUNT(*) as cnt FROM attendance_records WHERE session_id IN (${placeholders}) GROUP BY status
    `).all(...sessionIds) as { status: string; cnt: number }[]

    const attended = records.find((r) => r.status === 'attended')?.cnt ?? 0
    const excused = records.find((r) => r.status === 'absent_excused')?.cnt ?? 0
    const unexcused = records.find((r) => r.status === 'absent_unexcused')?.cnt ?? 0

    return {
      total_sessions: sessionIds.length,
      payable_sessions: attended + unexcused,
      excused_absences: excused,
      unexcused_absences: unexcused,
      breakdown: records
    }
  } catch (error: any) {
    throw new Error(error.message || 'Failed to get attendance summary')
  }
})
