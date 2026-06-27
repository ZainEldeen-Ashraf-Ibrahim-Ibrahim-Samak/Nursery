import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useSessionsStore } from '../../store/useSessionsStore.js'
import { useAttendanceStore } from '../../store/useAttendanceStore.js'
import { Button } from '../../components/ui/Button.js'
import { Modal } from '../../components/ui/Modal.js'
import { Input } from '../../components/ui/Input.js'
import { Alert } from '../../components/ui/Alert.js'
import type { ScheduledSession, AttendanceRecord, AttendanceStatus } from '../../types/index.js'

export default function SessionsList() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const navigate = useNavigate()
  const { sessions, isLoading, error, fetchSessions, addSession, updateSession, deleteSession, clearError } = useSessionsStore()
  const { sheet, isLoading: sheetLoading, error: sheetError, fetchSheet, recordBulk, clearError: clearSheetError } = useAttendanceStore()

  // Filter state
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState(() => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    return d.toISOString().slice(0, 10)
  })

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduledSession | null>(null)
  const [sessionDate, setSessionDate] = useState('')
  const [groupName, setGroupName] = useState('')
  const [sessionNotes, setSessionNotes] = useState('')
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [toDelete, setToDelete] = useState<ScheduledSession | null>(null)

  // Attendance sheet state
  const [viewingSessionId, setViewingSessionId] = useState<number | null>(null)
  const [attendanceEdits, setAttendanceEdits] = useState<Record<number, { status: AttendanceStatus | null; excuse_notes: string }>>({})
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)
  const [sessionCredit, setSessionCredit] = useState<{ payable: boolean; hasTeachers: boolean; credits: { employee_id: number; name: string; amount: number }[] } | null>(null)

  // Today's auto-session detection
  const [todayChildren, setTodayChildren] = useState<{ id: number; name: string }[]>([])
  const [isCreatingToday, setIsCreatingToday] = useState(false)
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayDow = new Date().getDay()

  useEffect(() => { fetchSessions(fromDate, toDate) }, [fromDate, toDate])

  useEffect(() => {
    window.api.sessions.childrenForDay(todayDow).then(setTodayChildren).catch(() => {})
  }, [todayDow])

  const hasTodaySession = sessions.some(s => s.session_date === todayStr)

  const handleCreateTodaySession = async () => {
    if (hasTodaySession) { setSuccessMsg(isAr ? 'جلسة اليوم موجودة بالفعل.' : "Today's session already exists."); return }
    setIsCreatingToday(true)
    await addSession({ session_date: todayStr })
    setIsCreatingToday(false)
    fetchSessions(fromDate, toDate)
  }

  const openCreate = () => {
    setEditing(null); setSessionDate(new Date().toISOString().slice(0, 10)); setGroupName(''); setSessionNotes(''); setFormError('')
    setIsFormOpen(true)
  }
  const openEdit = (s: ScheduledSession) => {
    setEditing(s); setSessionDate(s.session_date); setGroupName(s.group_name || ''); setSessionNotes(s.notes || ''); setFormError('')
    setIsFormOpen(true)
  }

  const handleSubmit = async () => {
    setFormError('')
    if (!sessionDate) { setFormError(isAr ? 'التاريخ مطلوب' : 'Date is required'); return }
    setIsSubmitting(true)
    const payload = { session_date: sessionDate, group_name: groupName || null, notes: sessionNotes || null }
    const result = editing ? await updateSession(editing.id, payload) : await addSession(payload)
    setIsSubmitting(false)
    if (result) {
      setSuccessMsg(isAr ? 'تم الحفظ.' : 'Saved.')
      setIsFormOpen(false)
    }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const ok = await deleteSession(toDelete.id)
    if (ok) setSuccessMsg(isAr ? 'تم الحذف.' : 'Deleted.')
    setToDelete(null)
  }

  const openAttendance = async (sessionId: number) => {
    setViewingSessionId(sessionId)
    setSessionCredit(null)
    await fetchSheet(sessionId)
    setAttendanceEdits({})
    try { setSessionCredit(await window.api.sessions.salaryCredit(sessionId)) } catch { setSessionCredit(null) }
  }

  const getEdit = (rec: AttendanceRecord) => attendanceEdits[rec.child_id] || { status: rec.status as AttendanceStatus | null, excuse_notes: rec.excuse_notes || '' }

  const setEdit = (childId: number, field: 'status' | 'excuse_notes', value: string) => {
    setAttendanceEdits((prev) => ({
      ...prev,
      [childId]: { ...(prev[childId] || { status: null, excuse_notes: '' }), [field]: value }
    }))
  }

  // Clicking the already-selected status clears it (back to no status); otherwise selects it.
  const toggleStatus = (childId: number, status: AttendanceStatus, current: AttendanceStatus | null) => {
    setAttendanceEdits((prev) => ({
      ...prev,
      [childId]: { ...(prev[childId] || { status: null, excuse_notes: '' }), status: current === status ? null : status }
    }))
  }

  const handleSaveAttendance = async () => {
    if (!viewingSessionId) return
    setIsSavingAttendance(true)
    const records = sheet
      .map((rec) => {
        const edit = getEdit(rec)
        return { child_id: rec.child_id, status: edit.status, excuse_notes: edit.excuse_notes || undefined }
      })
      .filter((r) => r.status != null)
    // Children whose previously-saved status was cleared in the sheet — remove their records
    // so they don't reappear as selected after saving.
    const clearedChildIds = sheet
      .filter((rec) => rec.child_id in attendanceEdits && attendanceEdits[rec.child_id].status == null && rec.status != null)
      .map((rec) => rec.child_id)
    const ok = await recordBulk(viewingSessionId, records)
    if (ok) {
      if (clearedChildIds.length > 0) {
        try { await window.api.attendance.delete(viewingSessionId, clearedChildIds) } catch { /* best-effort */ }
      }
      let msg = isAr ? 'تم حفظ الحضور.' : 'Attendance saved.'
      try {
        const credit = await window.api.sessions.salaryCredit(viewingSessionId)
        setSessionCredit(credit)
        if (credit.payable && credit.credits.length > 0) {
          const lines = credit.credits
            .map((c) => `${c.name} ${c.amount >= 0 ? '+' : ''}${c.amount} ${isAr ? 'ج.م' : 'EGP'}`)
            .join('، ')
          msg += isAr ? ` 💰 تم احتساب راتب الجلسة: ${lines}` : ` 💰 Session salary credited: ${lines}`
        }
      } catch { /* salary note is best-effort; never block the save */ }
      setSuccessMsg(msg)
      setViewingSessionId(null)
    }
    setIsSavingAttendance(false)
  }

  const statusLabel = (s: AttendanceStatus) => {
    if (s === 'attended') return isAr ? 'حاضر' : 'Attended'
    if (s === 'absent_excused') return isAr ? 'غائب بعذر' : 'Excused'
    return isAr ? 'غائب' : 'Absent'
  }

  const today = new Date().toISOString().slice(0, 10)

  // Derives open/closed/upcoming from system date
  const sessionStatus = (sessionDate: string): 'open' | 'closed' | 'upcoming' => {
    if (sessionDate === today) return 'open'
    if (sessionDate < today) return 'closed'
    return 'upcoming'
  }

  const sessionStatusBadge = (sessionDate: string) => {
    const st = sessionStatus(sessionDate)
    if (st === 'open') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        {isAr ? 'نشطة' : 'Open'}
      </span>
    )
    if (st === 'closed') return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
        🔒 {isAr ? 'مغلقة' : 'Closed'}
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
        🗓 {isAr ? 'مجدولة' : 'Upcoming'}
      </span>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">{isAr ? 'الجلسات' : 'Sessions'}</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCreateTodaySession} isLoading={isCreatingToday}>
            {isAr ? '📅 تحقق من اليوم' : '📅 Check Today'}
          </Button>
          <Button variant="primary" onClick={openCreate}>{isAr ? '+ إضافة جلسة' : '+ Add Session'}</Button>
        </div>
      </div>

      {successMsg && <Alert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {error && <Alert variant="danger" onClose={clearError}>{error}</Alert>}

      {/* Today's session banner */}
      {!hasTodaySession && todayChildren.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
          <div>
            <p className="font-semibold text-amber-800 text-sm">
              {isAr
                ? `⚠️ لا توجد جلسة لليوم — ${todayChildren.length} طفل لديهم حصة اليوم`
                : `⚠️ No session for today — ${todayChildren.length} child${todayChildren.length !== 1 ? 'ren' : ''} scheduled`}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {todayChildren.map(c => c.name).join(' • ')}
            </p>
          </div>
          <Button variant="primary" size="sm" isLoading={isCreatingToday} onClick={handleCreateTodaySession}>
            {isAr ? 'إنشاء جلسة اليوم' : "Create Today's Session"}
          </Button>
        </div>
      )}

      {/* Date filters */}
      <div className="flex gap-3 items-end">
        <Input label={isAr ? 'من' : 'From'} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        <Input label={isAr ? 'إلى' : 'To'} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
      </div>

      {isLoading ? (
        <p className="text-slate-400 text-sm">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
      ) : sessions.length === 0 ? (
        <p className="text-slate-400 text-sm">{isAr ? 'لا توجد جلسات في هذه الفترة.' : 'No sessions in this period.'}</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => {
            const st = sessionStatus(s.session_date)
            const isClosed = st === 'closed'
            return (
              <div key={s.id} className={`bg-white border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${st === 'open' ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200'}`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800">{s.session_date}</p>
                    {sessionStatusBadge(s.session_date)}
                  </div>
                  {s.group_name && <p className="text-xs text-slate-500">{s.group_name}</p>}
                  {s.service_name && <p className="text-xs text-slate-400">{s.service_name}</p>}
                  {s.notes && <p className="text-xs text-slate-400">{s.notes}</p>}
                  {s.teachers && s.teachers.length > 0 && (
                    <p className="text-xs text-slate-400">{s.teachers.map((t: any) => t.name).join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={isClosed ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() => openAttendance(s.id)}
                  >
                    {isClosed ? (isAr ? '👁 عرض الحضور' : '👁 View') : (isAr ? 'كشف الحضور' : 'Attendance')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(s)}>{isAr ? 'تعديل' : 'Edit'}</Button>
                  <Button variant="danger" size="sm" onClick={() => setToDelete(s)}>{isAr ? 'حذف' : 'Delete'}</Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit Session Modal */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}
        title={editing ? (isAr ? 'تعديل الجلسة' : 'Edit Session') : (isAr ? 'إضافة جلسة' : 'Add Session')}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setIsFormOpen(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button><Button variant="primary" onClick={handleSubmit} isLoading={isSubmitting}>{isAr ? 'حفظ' : 'Save'}</Button></div>}
      >
        <div className="space-y-4">
          {formError && <Alert variant="danger" onClose={() => setFormError('')}>{formError}</Alert>}
          <Input label={isAr ? 'تاريخ الجلسة' : 'Session Date'} type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
          <Input label={isAr ? 'اسم المجموعة (اختياري)' : 'Group Name (optional)'} value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <Input label={isAr ? 'ملاحظات' : 'Notes'} value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} />
          <p className="text-xs text-slate-400">
            {isAr
              ? '👩‍🏫 يتم ربط معلم كل طفل تلقائياً عند تسجيل حضوره — لا حاجة لتعيين المعلمين يدوياً.'
              : '👩‍🏫 Each attending child\'s teacher is linked automatically when attendance is recorded — no manual assignment needed.'}
          </p>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={isAr ? 'حذف الجلسة' : 'Delete Session'}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setToDelete(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button><Button variant="danger" onClick={handleDelete}>{isAr ? 'حذف' : 'Delete'}</Button></div>}
      >
        <p className="text-sm text-slate-600">{isAr ? `حذف جلسة ${toDelete?.session_date}؟` : `Delete session on ${toDelete?.session_date}?`}</p>
        {!!toDelete?.attendance_count && toDelete.attendance_count > 0 && (
          <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
            ⚠️ <span>
              {isAr
                ? `تحتوي هذه الجلسة على ${toDelete.attendance_count} سجل حضور. سيؤدي الحذف إلى حذف هذه السجلات نهائياً.`
                : `This session has ${toDelete.attendance_count} attendance record${toDelete.attendance_count !== 1 ? 's' : ''}. Deleting it will permanently delete ${toDelete.attendance_count !== 1 ? 'them' : 'it'}.`}
            </span>
          </div>
        )}
      </Modal>

      {/* Attendance Sheet Modal */}
      {(() => {
        const viewingSession = sessions.find(s => s.id === viewingSessionId)
        const viewingClosed = viewingSession ? sessionStatus(viewingSession.session_date) === 'closed' : false
        return (
      <Modal isOpen={!!viewingSessionId} onClose={() => setViewingSessionId(null)}
        title={isAr ? 'كشف الحضور' : 'Attendance Sheet'}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setViewingSessionId(null)}>{isAr ? 'إغلاق' : 'Close'}</Button>
            {!viewingClosed && (
              <Button variant="primary" onClick={handleSaveAttendance} isLoading={isSavingAttendance}>{isAr ? 'حفظ الحضور' : 'Save Attendance'}</Button>
            )}
          </div>
        }
      >
        {viewingClosed && (
          <div className="mb-3 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500">
            🔒 {isAr ? 'هذه الجلسة مغلقة — تم إغلاقها تلقائياً بواسطة النظام. يمكن عرض الحضور فقط.' : 'This session is closed — auto-closed by the system. Attendance is view-only.'}
          </div>
        )}
        {/* Teacher salary banner — always shows who earns from this session and why, so it's
            never a mystery whether salary will be credited. */}
        {sessionCredit && (
          sessionCredit.credits.length > 0 ? (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm border ${sessionCredit.payable ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <div className="font-semibold">💰 {isAr ? 'راتب الجلسة للمعلمين:' : 'Session salary for teachers:'}</div>
              <ul className="mt-1 space-y-0.5">
                {sessionCredit.credits.map((c) => (
                  <li key={c.employee_id}>
                    {c.name}: <span className="font-semibold">+{c.amount} {isAr ? 'ج.م' : 'EGP'}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-xs">
                {sessionCredit.payable
                  ? (isAr ? '✅ سيُحتسب لهذه الجلسة (يوجد حضور/غياب بدون عذر).' : '✅ Will be credited for this session (a child attended / was absent without excuse).')
                  : (isAr ? '⏳ لن يُحتسب حتى تسجّل حضور طفل أو غياب بدون عذر.' : '⏳ Not credited yet — mark a child attended or absent-without-excuse.')}
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-lg px-3 py-2 text-sm bg-slate-50 border border-slate-200 text-slate-600">
              ℹ️ {sessionCredit.hasTeachers
                ? (isAr ? 'المعلمون المعينون ليسوا على نظام راتب لكل جلسة، فلا يُحتسب راتب جلسة.' : 'Assigned teacher(s) are not on a per-session salary type, so no per-session salary is credited.')
                : (isAr ? 'لا يوجد معلم معيّن لهذه الجلسة. عيّن معلماً من «تعديل» لاحتساب راتب الجلسة.' : 'No teacher is assigned to this session. Assign one via Edit to credit session salary.')}
            </div>
          )
        )}
        {sheetError && <Alert variant="danger" onClose={clearSheetError}>{sheetError}</Alert>}
        {sheetLoading ? (
          <p className="text-sm text-slate-400">{isAr ? 'جارٍ التحميل...' : 'Loading...'}</p>
        ) : sheet.length === 0 ? (
          <p className="text-sm text-slate-400">{isAr ? 'لا يوجد أطفال مسجلون في هذه الجلسة.' : 'No children enrolled for this session.'}</p>
        ) : (
          <div className="space-y-3">
            {sheet.map((rec) => {
              const edit = getEdit(rec)
              return (
                <div key={rec.child_id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 border border-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => navigate(`/children/${rec.child_id}/statement`)}
                    className="flex items-center gap-2 flex-1 text-start hover:opacity-75 transition-opacity"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                      {rec.child_photo_url
                        ? <img src={rec.child_photo_url} alt={rec.child_name} className="w-full h-full object-cover" />
                        : <span className="text-sm text-slate-300">🧒</span>
                      }
                    </div>
                    <span className="flex flex-col">
                      <span className="font-medium text-sm text-slate-800">{rec.child_name}</span>
                      <span className="text-xs text-slate-400">
                        {rec.teacher_name
                          ? `👩‍🏫 ${rec.teacher_name}`
                          : (isAr ? '⚠️ لا يوجد معلم' : '⚠️ No teacher')}
                      </span>
                    </span>
                  </button>
                  <div className="flex gap-1">
                    {(['attended', 'absent_excused', 'absent_unexcused'] as AttendanceStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={viewingClosed}
                        onClick={() => !viewingClosed && toggleStatus(rec.child_id, status, edit.status)}
                        className={[
                          'px-2 py-1 rounded text-xs font-medium border transition-all',
                          viewingClosed ? 'cursor-default opacity-70' : '',
                          edit.status === status
                            ? status === 'attended' ? 'bg-emerald-100 border-emerald-400 text-emerald-700' : status === 'absent_excused' ? 'bg-amber-100 border-amber-400 text-amber-700' : 'bg-red-100 border-red-400 text-red-700'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'
                        ].join(' ')}
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                  {edit.status === 'absent_excused' && (
                    <input
                      type="text"
                      disabled={viewingClosed}
                      value={edit.excuse_notes}
                      onChange={(e) => !viewingClosed && setEdit(rec.child_id, 'excuse_notes', e.target.value)}
                      placeholder={isAr ? 'سبب الغياب بعذر...' : 'Reason...'}
                      className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 disabled:bg-slate-50 disabled:cursor-default"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
        )
      })()}
    </div>
  )
}
