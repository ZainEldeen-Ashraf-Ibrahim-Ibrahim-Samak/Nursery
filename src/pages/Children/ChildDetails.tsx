import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/ui/Card.js'
import { Stat } from '../../components/ui/Stat.js'
import { Button } from '../../components/ui/Button.js'
import { Alert } from '../../components/ui/Alert.js'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner.js'
import { useChildActivitiesStore } from '../../store/useChildActivitiesStore.js'
import type { TimetableSlot } from '../../types/index.js'

const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function ChildDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const childId = Number(id)

  const [timetable, setTimetable] = useState<TimetableSlot[]>([])
  const [balance, setBalance] = useState<{ totalCollected: number; remainingDue: number } | null>(null)
  const [childName, setChildName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const {
    openCase, activities, error: activityError,
    fetchAll, addActivity, openIllnessCase, resolveIllnessCase, clearError,
  } = useChildActivitiesStore()

  const [note, setNote] = useState('')
  const [mediaDataUrl, setMediaDataUrl] = useState<string | undefined>()
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo')
  const [illnessDescription, setIllnessDescription] = useState('')
  const [showIllnessForm, setShowIllnessForm] = useState(false)

  useEffect(() => {
    if (!childId) return
    setIsLoading(true)
    setLoadError('')
    Promise.all([
      window.api.childServices.getTimetable(childId),
      window.api.children.statement({ childId }),
    ]).then(([slots, statement]) => {
      setTimetable(slots)
      setChildName(statement?.child?.name || '')
      setBalance({
        totalCollected: statement?.summary?.totalCollected ?? 0,
        remainingDue: statement?.summary?.remainingDue ?? statement?.summary?.totalBalance ?? 0,
      })
    }).catch((err: any) => setLoadError(err.message || 'Failed to load child details'))
      .finally(() => setIsLoading(false))
    fetchAll(childId)
  }, [childId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'photo' | 'video') => {
    const file = e.target.files?.[0]
    if (!file) return
    setMediaType(type)
    const reader = new FileReader()
    reader.onload = () => setMediaDataUrl(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleAddActivity = async () => {
    const ok = await addActivity(childId, { note, media_data_url: mediaDataUrl, media_type: mediaType })
    if (ok) {
      setNote('')
      setMediaDataUrl(undefined)
    }
  }

  const handleOpenIllness = async () => {
    const ok = await openIllnessCase(childId, illnessDescription)
    if (ok) {
      setIllnessDescription('')
      setShowIllnessForm(false)
    }
  }

  if (isLoading) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{childName || (isAr ? 'تفاصيل الطفل' : 'Child Details')}</h1>
        <Button variant="outline" onClick={() => navigate(-1)}>{isAr ? 'رجوع' : 'Back'}</Button>
      </div>

      {loadError && <Alert variant="danger">{loadError}</Alert>}
      {activityError && <Alert variant="danger" onClose={clearError}>{activityError}</Alert>}

      {/* Paid vs. remaining balance (FR-010) */}
      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Stat title={isAr ? 'إجمالي المدفوع' : 'Total Paid'} value={balance.totalCollected.toFixed(2)} unit={isAr ? 'ج.م' : 'EGP'} />
          <Stat title={isAr ? 'المتبقي المستحق' : 'Remaining Due'} value={balance.remainingDue.toFixed(2)} unit={isAr ? 'ج.م' : 'EGP'} />
        </div>
      )}

      {/* Timetable (FR-005/FR-006) */}
      <Card title={isAr ? 'الجدول الزمني' : 'Timetable'}>
        {timetable.length === 0 ? (
          <p className="text-slate-500 p-4">{isAr ? 'لا يوجد جدول مواعيد لهذا الطفل' : 'No scheduled services for this child'}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {timetable.map((slot, i) => (
              <li key={i} className="px-4 py-3 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800">{isAr ? dayNamesAr[slot.day] : dayNamesEn[slot.day]}</span>
                <span className="text-slate-600">{slot.service}</span>
                <span className="text-slate-500">{slot.teacher_name || (isAr ? 'بدون معلم' : 'No teacher')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Illness case OR activity/media diary (FR-007/FR-008/FR-009/FR-014) */}
      <Card title={isAr ? 'الحالة الصحية / النشاط اليومي' : 'Health / Daily Activity'}>
        <div className="p-4 space-y-4">
          {openCase ? (
            <div>
              <Alert variant="warning">
                {isAr ? 'حالة مرضية مفتوحة: ' : 'Open illness case: '}{openCase.description || ''}
              </Alert>
              <Button className="mt-2" variant="secondary" onClick={() => resolveIllnessCase(openCase.id, childId)}>
                {isAr ? 'إغلاق الحالة' : 'Resolve case'}
              </Button>
            </div>
          ) : showIllnessForm ? (
            <div className="space-y-2">
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                placeholder={isAr ? 'وصف الحالة المرضية' : 'Illness description'}
                value={illnessDescription}
                onChange={(e) => setIllnessDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button onClick={handleOpenIllness}>{isAr ? 'فتح الحالة' : 'Open case'}</Button>
                <Button variant="ghost" onClick={() => setShowIllnessForm(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full border rounded-lg p-2 text-sm"
                placeholder={isAr ? 'ملاحظة عن نشاط اليوم' : 'Note about today\'s activity'}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-600">
                  {isAr ? 'صورة' : 'Photo'}
                  <input type="file" accept="image/*" className="block" onChange={(e) => handleFileChange(e, 'photo')} />
                </label>
                <label className="text-sm text-slate-600">
                  {isAr ? 'فيديو' : 'Video'}
                  <input type="file" accept="video/*" className="block" onChange={(e) => handleFileChange(e, 'video')} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddActivity} disabled={!note && !mediaDataUrl}>
                  {isAr ? 'إضافة نشاط' : 'Add Activity'}
                </Button>
                <Button variant="outline" onClick={() => setShowIllnessForm(true)}>
                  {isAr ? 'الإبلاغ عن حالة مرضية' : 'Report illness case'}
                </Button>
              </div>
            </div>
          )}

          {activities.length > 0 && (
            <ul className="space-y-3 pt-2 border-t border-slate-100">
              {activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">{a.activity_date}</span>
                    {a.media_status === 'failed' && (
                      <span className="text-red-500 text-xs">{isAr ? 'فشل رفع الوسائط' : 'Media upload failed'}</span>
                    )}
                  </div>
                  {a.note && <p className="text-slate-600">{a.note}</p>}
                  {a.media_url && a.media_type === 'photo' && (
                    <img src={a.media_url} alt="" className="mt-1 max-h-40 rounded-lg" />
                  )}
                  {a.media_url && a.media_type === 'video' && (
                    <video src={a.media_url} controls className="mt-1 max-h-40 rounded-lg" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
