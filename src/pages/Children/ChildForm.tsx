import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useChildrenStore } from '../../store/useChildrenStore.js'
import { Button } from '../../components/ui/Button.js'
import { Input } from '../../components/ui/Input.js'
import { Select } from '../../components/ui/Select.js'
import { Card } from '../../components/ui/Card.js'
import { Alert } from '../../components/ui/Alert.js'
import PhotoCapture from '../../components/PhotoCapture.js'
import type { ServiceType, UnitType, Teacher } from '../../types/index.js'


interface ServiceRow {
  service: ServiceType
  unit: UnitType
  price: number
}

// Egyptian mobile: starts with 01, optionally prefixed by 2 or +2 (feature 004, FR-001).
const GUARDIAN_PHONE_RE = /^(?:\+?2)?01[0-9]{9}$/
// Weekday keys in JS getDay() order (0 = Sunday … 6 = Saturday).
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export default function ChildForm() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id

  const { addChild, updateChild, children, fetchChildren, error, clearError } = useChildrenStore()

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    guardian: '',
    guardian_phone: '',
    child_phone: '',
    national_id: '',
    reg_date: new Date().toISOString().split('T')[0],
    notes: '',
    services: [{ service: 'حضانة' as ServiceType, unit: 'شهر' as UnitType, price: 0 }] as ServiceRow[],
    // Feature 004 — teacher / lesson schedule / fee
    teacher_id: '' as string,
    lesson_days: [] as number[],
    extra_lessons: 0,
    session_price: 0,
  })

  // Feature 004 — photo (data URL for new/changed photo; existing URL otherwise)
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoChanged, setPhotoChanged] = useState(false)
  const [teachers, setTeachers] = useState<Teacher[]>([])

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [isLoadingChild, setIsLoadingChild] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [photoNotice, setPhotoNotice] = useState<string | null>(null)

  // Derived: sessions and computed fee (baseline is fixed at 8 per clarification)
  const sessionsBaseline = 8
  const totalSessions = sessionsBaseline + (Number(formData.extra_lessons) || 0)
  const monthlyFee = totalSessions * (Number(formData.session_price) || 0)

  // Fetch Settings (pricing defaults)
  useEffect(() => {
    async function loadSettings() {
      try {
        const data = await window.api.settings.get()
        setSettings(data || {})
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    loadSettings()
  }, [])

  // Load the teacher options (from the Employees list, feature 004)
  useEffect(() => {
    async function loadTeachers() {
      try {
        const list = await window.api.teachers.list()
        setTeachers(list || [])
      } catch (err) {
        console.error('Failed to load teachers:', err)
      }
    }
    loadTeachers()
  }, [])

  // If in edit mode, load the child record
  useEffect(() => {
    if (isEdit) {
      setIsLoadingChild(true)
      const loadChild = async () => {
        let child = children.find((c) => c.id === Number(id))
        if (!child) {
          await fetchChildren()
          const currentStore = useChildrenStore.getState()
          child = currentStore.children.find((c) => c.id === Number(id))
        }

        if (child) {
          const loadedServices = child.services && child.services.length > 0
            ? child.services.map(s => ({ service: s.service, unit: s.unit, price: s.price }))
            : [{ service: child.service, unit: child.unit, price: child.price }]

          let days: number[] = []
          if (Array.isArray(child.lesson_days)) days = child.lesson_days as number[]
          else if (typeof child.lesson_days === 'string' && child.lesson_days) {
            try { days = JSON.parse(child.lesson_days) } catch { days = [] }
          }

          setFormData({
            name: child.name,
            guardian: child.guardian,
            guardian_phone: child.guardian_phone,
            child_phone: child.child_phone || '',
            national_id: child.national_id || '',
            reg_date: child.reg_date,
            notes: child.notes || '',
            services: loadedServices,
            teacher_id: child.teacher_id != null ? String(child.teacher_id) : '',
            lesson_days: days,
            extra_lessons: child.extra_lessons ?? 0,
            session_price: child.session_price ?? 0,
          })
          setPhoto(child.photo_url || null)
          setPhotoChanged(false)
        }
        setIsLoadingChild(false)
      }
      loadChild()
    }
  }, [id, isEdit, fetchChildren])

  const handleAddService = () => {
    setFormData(prev => ({
      ...prev,
      services: [...prev.services, { service: 'استضافة', unit: 'يوم', price: 0 }]
    }))
  }

  const handleRemoveService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }))
  }

  const handleServiceChange = (index: number, field: keyof ServiceRow, value: any) => {
    setFormData(prev => {
      const newServices = [...prev.services]
      const row = { ...newServices[index], [field]: value }

      // Auto-update unit if service changes to session
      if (field === 'service' && value === 'جلسة' && row.unit !== 'جلسة' && row.unit !== 'يوم') {
        row.unit = 'جلسة'
      }

      // Auto-price if service or unit changes
      if (field === 'service' || field === 'unit') {
        let priceKey = ''
        if (row.service === 'حضانة') {
          if (row.unit === 'شهر') priceKey = 'nursery_monthly'
          if (row.unit === 'يوم') priceKey = 'nursery_daily'
          if (row.unit === 'ساعة') priceKey = 'nursery_hourly'
        } else if (row.service === 'استضافة') {
          if (row.unit === 'شهر') priceKey = 'hosting_monthly'
          if (row.unit === 'يوم') priceKey = 'hosting_daily'
          if (row.unit === 'ساعة') priceKey = 'hosting_hourly'
        } else if (row.service === 'جلسة') {
          if (row.unit === 'جلسة' || row.unit === 'ساعة') priceKey = 'session_hourly'
          if (row.unit === 'يوم') priceKey = 'session_daily'
        }
        if (priceKey && settings[priceKey] !== undefined) {
          row.price = Number(settings[priceKey])
        }
      }

      newServices[index] = row
      return { ...prev, services: newServices }
    })
  }

  const toggleLessonDay = (day: number) => {
    setFormData(prev => ({
      ...prev,
      lesson_days: prev.lesson_days.includes(day)
        ? prev.lesson_days.filter(d => d !== day)
        : [...prev.lesson_days, day].sort((a, b) => a - b),
    }))
  }

  // Form Validation
  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) errors.name = i18n.language === 'ar' ? 'اسم الطفل مطلوب' : 'Child name is required'
    if (!formData.guardian.trim()) errors.guardian = i18n.language === 'ar' ? 'اسم ولي الأمر مطلوب' : 'Guardian name is required'
    if (!formData.guardian_phone.trim()) {
      errors.guardian_phone = i18n.language === 'ar' ? 'رقم هاتف ولي الأمر مطلوب' : 'Guardian phone is required'
    } else if (!GUARDIAN_PHONE_RE.test(formData.guardian_phone.trim())) {
      errors.guardian_phone = i18n.language === 'ar'
        ? 'رقم هاتف غير صالح (مثال: 01012345678 أو +201012345678)'
        : 'Invalid phone format (e.g., 01012345678 or +201012345678)'
    }
    if (formData.child_phone.trim() && !GUARDIAN_PHONE_RE.test(formData.child_phone.trim())) {
      errors.child_phone = i18n.language === 'ar'
        ? 'رقم هاتف غير صالح (مثال: 01012345678 أو +201012345678)'
        : 'Invalid phone format (e.g., 01012345678 or +201012345678)'
    }

    if (formData.national_id.trim() && !/^[0-9]{14}$/.test(formData.national_id)) {
      errors.national_id = i18n.language === 'ar' ? 'الرقم القومي يجب أن يتكون من 14 رقماً' : 'National ID must be exactly 14 digits'
    }
    if (!formData.reg_date) {
      errors.reg_date = i18n.language === 'ar' ? 'تاريخ التسجيل مطلوب' : 'Registration date is required'
    }

    if (formData.services.length === 0) {
      errors.services = i18n.language === 'ar' ? 'يجب اختيار خدمة واحدة على الأقل' : 'At least one service is required'
    } else {
      const seen = new Set()
      let hasDupes = false
      let invalidPrice = false
      for (const s of formData.services) {
        if (seen.has(s.service)) hasDupes = true
        seen.add(s.service)
        if (s.price < 0) invalidPrice = true
      }
      if (hasDupes) errors.services = i18n.language === 'ar' ? 'لا يمكن إضافة نفس الخدمة أكثر من مرة' : 'Cannot add duplicate services'
      if (invalidPrice) errors.services = i18n.language === 'ar' ? 'السعر لا يمكن أن يكون سالباً' : 'Price cannot be negative'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Allow digits and '+' at the start, up to 13 chars total
  const handleGuardianPhoneChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d+]/g, '')
    const startsWithPlus = cleaned.startsWith('+')
    const digitsOnly = cleaned.replace(/\+/g, '')
    const finalVal = (startsWithPlus ? '+' : '') + digitsOnly.slice(0, 12)
    setFormData((prev) => ({ ...prev, guardian_phone: finalVal.slice(0, 13) }))
  }

  const handleChildPhoneChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d+]/g, '')
    const startsWithPlus = cleaned.startsWith('+')
    const digitsOnly = cleaned.replace(/\+/g, '')
    const finalVal = (startsWithPlus ? '+' : '') + digitsOnly.slice(0, 12)
    setFormData((prev) => ({ ...prev, child_phone: finalVal.slice(0, 13) }))
  }

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setPhotoNotice(null)

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      // Resolve the photo: upload a newly captured/selected image first.
      let photo_url: string | null | undefined = undefined
      let photo_public_id: string | null | undefined = undefined
      if (photoChanged) {
        if (photo) {
          try {
            const uploaded = await window.api.storage.uploadPhoto({ dataUrl: photo })
            photo_url = uploaded.url
            photo_public_id = uploaded.publicId
          } catch (err) {
            // Offline / not configured — save the child without a photo (FR-004a).
            console.warn('Photo upload failed:', err)
            setPhotoNotice(t('photo_upload_failed'))
            photo_url = null
            photo_public_id = null
          }
        } else {
          // Photo explicitly removed.
          photo_url = null
          photo_public_id = null
        }
      }

      const payload: any = {
        name: formData.name.trim(),
        guardian: formData.guardian.trim(),
        guardian_phone: formData.guardian_phone.trim(),
        child_phone: formData.child_phone.trim() || null,
        national_id: formData.national_id.trim() || null,
        reg_date: formData.reg_date,
        notes: formData.notes.trim() || null,
        services: formData.services,
        teacher_id: formData.teacher_id ? Number(formData.teacher_id) : null,
        lesson_days: formData.lesson_days,
        sessions_baseline: sessionsBaseline,
        extra_lessons: Number(formData.extra_lessons) || 0,
        session_price: Number(formData.session_price) || 0,
      }
      if (photo_url !== undefined) {
        payload.photo_url = photo_url
        payload.photo_public_id = photo_public_id
      }

      if (isEdit) {
        const result = await updateChild(Number(id), payload)
        if (result) navigate('/children')
      } else {
        const result = await addChild(payload)
        if (result) navigate('/children')
      }
    } catch (err) {
      console.error('Submit child failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoadingChild) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
      style: 'currency', currency: 'EGP', maximumFractionDigits: 0,
    }).format(val)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEdit ? t('edit_child') : t('add_child')}
        </h1>
        <Button variant="outline" onClick={() => navigate('/children')}>
          {i18n.language === 'ar' ? 'عودة للقائمة' : 'Back to List'}
        </Button>
      </div>

      {error && (
        <Alert variant="danger" title={t('error')} onClose={clearError}>
          {error}
        </Alert>
      )}

      {photoNotice && (
        <Alert variant="warning" title={t('photo')} onClose={() => setPhotoNotice(null)}>
          {photoNotice}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-6">
          {/* Photo */}
          <PhotoCapture
            value={photo}
            onChange={(d) => { setPhoto(d); setPhotoChanged(true) }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('child_name')} <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                error={formErrors.name}
                placeholder={i18n.language === 'ar' ? 'أدخل اسم الطفل كاملاً' : 'Enter child\'s full name'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('guardian')} <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.guardian}
                onChange={(e) => setFormData((prev) => ({ ...prev, guardian: e.target.value }))}
                error={formErrors.guardian}
                placeholder={i18n.language === 'ar' ? 'أدخل اسم ولي الأمر' : 'Enter guardian\'s name'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('guardian_phone')} <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.guardian_phone}
                onChange={(e) => handleGuardianPhoneChange(e.target.value)}
                error={formErrors.guardian_phone}
                inputMode="tel"
                maxLength={13}
                placeholder={i18n.language === 'ar' ? 'رقم الهاتف المحمول (مثال: 010... أو +2010...)' : 'Phone number (e.g. 010... or +2010...)'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('child_phone')} <span className="text-xs text-slate-400 font-normal">({i18n.language === 'ar' ? 'اختياري' : 'Optional'})</span>
              </label>
              <Input
                value={formData.child_phone}
                onChange={(e) => handleChildPhoneChange(e.target.value)}
                error={formErrors.child_phone}
                inputMode="tel"
                maxLength={13}
                placeholder={i18n.language === 'ar' ? 'رقم هاتف الطفل الخاص (مثال: 010... أو +2010...)' : 'Child\'s own phone number (e.g. 010... or +2010...)'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('national_id')} <span className="text-xs text-slate-400 font-normal">({i18n.language === 'ar' ? '14 رقماً، اختياري' : '14 digits, optional'})</span>
              </label>
              <Input
                value={formData.national_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, national_id: e.target.value }))}
                error={formErrors.national_id}
                maxLength={14}
                placeholder={i18n.language === 'ar' ? 'الرقم القومي للطفل' : 'National ID'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('reg_date')} <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.reg_date}
                onChange={(e) => setFormData((prev) => ({ ...prev, reg_date: e.target.value }))}
                error={formErrors.reg_date}
              />
            </div>
          </div>

          {/* Teacher, lesson days & fee (feature 004) */}
          <div className="space-y-4 border-t border-slate-100 pt-6">
            <label className="text-lg font-bold text-slate-800">{t('lesson_schedule')}</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('teacher')}</label>
                <Select
                  value={formData.teacher_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, teacher_id: e.target.value }))}
                  options={[
                    { value: '', label: t('no_teacher') },
                    ...teachers.map((tch) => ({ value: String(tch.id), label: tch.name })),
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('lesson_days')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAY_KEYS.map((key, dayIdx) => {
                    const active = formData.lesson_days.includes(dayIdx)
                    return (
                      <button
                        type="button"
                        key={key}
                        onClick={() => toggleLessonDay(dayIdx)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {t(`days.${key}`)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('extra_lessons')}</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.extra_lessons}
                  onChange={(e) => setFormData((prev) => ({ ...prev, extra_lessons: Math.max(0, Number(e.target.value)) }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">{t('session_price')} (EGP)</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.session_price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, session_price: Math.max(0, Number(e.target.value)) }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div>
                <p className="text-xs text-slate-500">{t('sessions_per_month')}</p>
                <p className="text-lg font-bold text-slate-800">{totalSessions}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('monthly_fee')}</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(monthlyFee)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-lg font-bold text-slate-800">
                {i18n.language === 'ar' ? 'الخدمات المشترك بها' : 'Enrolled Services'}
              </label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddService}>
                <span className="ml-1">➕</span>
                {i18n.language === 'ar' ? 'إضافة خدمة' : 'Add Service'}
              </Button>
            </div>

            {formErrors.services && (
              <p className="text-sm text-red-500 font-medium">{formErrors.services}</p>
            )}

            <div className="space-y-3">
              {formData.services.map((row, index) => {
                const unitOptions = row.service === 'جلسة'
                  ? [
                      { value: 'جلسة', label: t('units.session') },
                      { value: 'يوم', label: t('units.day') },
                    ]
                  : [
                      { value: 'شهر', label: t('units.month') },
                      { value: 'يوم', label: t('units.day') },
                      { value: 'ساعة', label: t('units.hour') },
                    ]

                return (
                  <div key={index} className="flex flex-col md:flex-row gap-3 items-end p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex-1 space-y-1.5 w-full">
                      <label className="text-xs font-semibold text-slate-500">{t('service')}</label>
                      <Select
                        value={row.service}
                        onChange={(e) => handleServiceChange(index, 'service', e.target.value)}
                        options={[
                          { value: 'حضانة', label: t('services.nursery') },
                          { value: 'استضافة', label: t('services.hosting') },
                          { value: 'جلسة', label: t('services.session') },
                        ]}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5 w-full">
                      <label className="text-xs font-semibold text-slate-500">{t('unit')}</label>
                      <Select
                        value={row.unit}
                        onChange={(e) => handleServiceChange(index, 'unit', e.target.value)}
                        options={unitOptions}
                      />
                    </div>
                    <div className="flex-1 space-y-1.5 w-full">
                      <label className="text-xs font-semibold text-slate-500">{t('price')} (EGP)</label>
                      <Input
                        type="number"
                        min={0}
                        value={row.price}
                        onChange={(e) => handleServiceChange(index, 'price', Number(e.target.value))}
                      />
                    </div>
                    {formData.services.length > 1 && (
                      <div className="pb-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2"
                          onClick={() => handleRemoveService(index)}
                        >
                          🗑️
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              {t('notes')}
            </label>
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              className="block w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-start text-sm shadow-sm transition-all"
              placeholder={i18n.language === 'ar' ? 'ملاحظات إضافية...' : 'Any additional notes...'}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/children')} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
  )
}
