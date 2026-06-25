import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSessionsStore } from '../../store/useSessionsStore.js'
import { useAttendanceStore } from '../../store/useAttendanceStore.js'
import { Button } from '../../components/ui/Button.js'
import { Modal } from '../../components/ui/Modal.js'
import { Input } from '../../components/ui/Input.js'
import { Alert } from '../../components/ui/Alert.js'
import { Badge } from '../../components/ui/Badge.js'
import type { ScheduledSession, AttendanceRecord, AttendanceStatus } from '../../types/index.js'

export default function SessionsList() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
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
  const [attendanceEdits, setAttendanceEdits] = useState<Record<number, { status: AttendanceStatus; excuse_notes: string }>>({})
  const [isSavingAttendance, setIsSavingAttendance] = useState(false)

  useEffect(() => { fetchSessions(fromDate, toDate) }, [fromDate, toDate])

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
    if (result) { setSuccessMsg(isAr ? 'تم الحفظ.' : 'Saved.'); setIsFormOpen(false) }
  }

  const handleDelete = async () => {
    if (!toDelete) return
    const ok = await deleteSession(toDelete.id)
    if (ok) setSuccessMsg(isAr ? 'تم الحذف.' : 'Deleted.')
    setToDelete(null)
  }

  const openAttendance = async (sessionId: number) => {
    setViewingSessionId(sessionId)
    await fetchSheet(sessionId)
    setAttendanceEdits({})
  }

  const getEdit = (rec: AttendanceRecord) => attendanceEdits[rec.child_id] || { status: rec.status as AttendanceStatus, excuse_notes: rec.excuse_notes || '' }

  const setEdit = (childId: number, field: 'status' | 'excuse_notes', value: string) => {
    setAttendanceEdits((prev) => ({
      ...prev,
      [childId]: { ...(prev[childId] || { status: 'attended', excuse_notes: '' }), [field]: value }
    }))
  }

  const handleSaveAttendance = async () => {
    if (!viewingSessionId) return
    setIsSavingAttendance(true)
    const records = sheet.map((rec) => {
      const edit = getEdit(rec)
      return { child_id: rec.child_id, status: edit.status, excuse_notes: edit.excuse_notes || undefined }
    })
    const ok = await recordBulk(viewingSessionId, records)
    setIsSavingAttendance(false)
    if (ok) { setSuccessMsg(isAr ? 'تم حفظ الحضور.' : 'Attendance saved.'); setViewingSessionId(null) }
  }

  const statusLabel = (s: AttendanceStatus) => {
    if (s === 'attended') return isAr ? 'حاضر' : 'Attended'
    if (s === 'absent_excused') return isAr ? 'غائب بعذر' : 'Excused'
    return isAr ? 'غائب' : 'Absent'
  }
  const statusVariant = (s: AttendanceStatus): 'success' | 'warning' | 'danger' => {
    if (s === 'attended') return 'success'
    if (s === 'absent_excused') return 'warning'
    return 'danger'
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">{isAr ? 'الجلسات' : 'Sessions'}</h1>
        <Button variant="primary" onClick={openCreate}>{isAr ? '+ إضافة جلسة' : '+ Add Session'}</Button>
      </div>

      {successMsg && <Alert variant="success" onClose={() => setSuccessMsg('')}>{successMsg}</Alert>}
      {error && <Alert variant="danger" onClose={clearError}>{error}</Alert>}

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
          {sessions.map((s) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800">{s.session_date}</p>
                {s.group_name && <p className="text-xs text-slate-500">{s.group_name}</p>}
                {s.notes && <p className="text-xs text-slate-400">{s.notes}</p>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openAttendance(s.id)}>{isAr ? 'كشف الحضور' : 'Attendance'}</Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(s)}>{isAr ? 'تعديل' : 'Edit'}</Button>
                <Button variant="danger" size="sm" onClick={() => setToDelete(s)}>{isAr ? 'حذف' : 'Delete'}</Button>
              </div>
            </div>
          ))}
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
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title={isAr ? 'حذف الجلسة' : 'Delete Session'}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setToDelete(null)}>{isAr ? 'إلغاء' : 'Cancel'}</Button><Button variant="danger" onClick={handleDelete}>{isAr ? 'حذف' : 'Delete'}</Button></div>}
      >
        <p className="text-sm text-slate-600">{isAr ? `حذف جلسة ${toDelete?.session_date}؟` : `Delete session on ${toDelete?.session_date}?`}</p>
      </Modal>

      {/* Attendance Sheet Modal */}
      <Modal isOpen={!!viewingSessionId} onClose={() => setViewingSessionId(null)}
        title={isAr ? 'كشف الحضور' : 'Attendance Sheet'}
        footer={<div className="flex gap-2"><Button variant="outline" onClick={() => setViewingSessionId(null)}>{isAr ? 'إغلاق' : 'Close'}</Button><Button variant="primary" onClick={handleSaveAttendance} isLoading={isSavingAttendance}>{isAr ? 'حفظ الحضور' : 'Save Attendance'}</Button></div>}
      >
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
                  <span className="flex-1 font-medium text-sm text-slate-800">{rec.child_name}</span>
                  <div className="flex gap-1">
                    {(['attended', 'absent_excused', 'absent_unexcused'] as AttendanceStatus[]).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setEdit(rec.child_id, 'status', status)}
                        className={[
                          'px-2 py-1 rounded text-xs font-medium border transition-all',
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
                      value={edit.excuse_notes}
                      onChange={(e) => setEdit(rec.child_id, 'excuse_notes', e.target.value)}
                      placeholder={isAr ? 'سبب الغياب بعذر...' : 'Reason...'}
                      className="flex-1 text-xs border border-slate-200 rounded px-2 py-1"
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Modal>
    </div>
  )
}
