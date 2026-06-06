import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useChildrenStore } from '../../store/useChildrenStore.js'
import { Button } from '../../components/ui/Button.js'
import { Input } from '../../components/ui/Input.js'
import { Select } from '../../components/ui/Select.js'
import { Card } from '../../components/ui/Card.js'
import { Alert } from '../../components/ui/Alert.js'
import type { ServiceType, UnitType } from '../../types/index.js'

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
    service: 'حضانة' as ServiceType,
    unit: 'شهر' as UnitType,
    price: 0,
    reg_date: new Date().toISOString().split('T')[0],
    notes: '',
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [isLoadingChild, setIsLoadingChild] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  // If in edit mode, load the child record
  useEffect(() => {
    if (isEdit) {
      setIsLoadingChild(true)
      // First ensure children are loaded in the store
      const loadChild = async () => {
        let child = children.find((c) => c.id === Number(id))
        if (!child) {
          await fetchChildren()
          // Re-retrieve from store
          const currentStore = useChildrenStore.getState()
          child = currentStore.children.find((c) => c.id === Number(id))
        }

        if (child) {
          setFormData({
            name: child.name,
            guardian: child.guardian,
            guardian_phone: child.guardian_phone,
            child_phone: child.child_phone || '',
            national_id: child.national_id || '',
            service: child.service,
            unit: child.unit,
            price: child.price,
            reg_date: child.reg_date,
            notes: child.notes || '',
          })
        }
        setIsLoadingChild(false)
      }
      loadChild()
    }
  }, [id, isEdit, fetchChildren])

  // Automatically update default price when service/unit changes
  useEffect(() => {
    // Skip auto-pricing on load when editing to avoid overwriting existing custom price
    if (isEdit && isLoadingChild) return

    let priceKey = ''
    const { service, unit } = formData

    if (service === 'حضانة') {
      if (unit === 'شهر') priceKey = 'nursery_monthly'
      if (unit === 'يوم') priceKey = 'nursery_daily'
      if (unit === 'ساعة') priceKey = 'nursery_hourly'
    } else if (service === 'استضافة') {
      if (unit === 'شهر') priceKey = 'hosting_monthly'
      if (unit === 'يوم') priceKey = 'hosting_daily'
      if (unit === 'ساعة') priceKey = 'hosting_hourly'
    } else if (service === 'جلسة') {
      if (unit === 'جلسة' || unit === 'ساعة') priceKey = 'session_hourly'
      if (unit === 'يوم') priceKey = 'session_daily'
    }

    if (priceKey && settings[priceKey] !== undefined) {
      setFormData((prev) => ({
        ...prev,
        price: Number(settings[priceKey]),
      }))
    }
  }, [formData.service, formData.unit, settings, isEdit, isLoadingChild])

  // Form Validation
  const validateForm = () => {
    const errors: Record<string, string> = {}

    if (!formData.name.trim()) {
      errors.name = i18n.language === 'ar' ? 'اسم الطفل مطلوب' : 'Child name is required'
    }

    if (!formData.guardian.trim()) {
      errors.guardian = i18n.language === 'ar' ? 'اسم ولي الأمر مطلوب' : 'Guardian name is required'
    }

    if (!formData.guardian_phone.trim()) {
      errors.guardian_phone = i18n.language === 'ar' ? 'رقم هاتف ولي الأمر مطلوب' : 'Guardian phone is required'
    } else if (!/^\+?[0-9\s-]{8,15}$/.test(formData.guardian_phone)) {
      errors.guardian_phone = i18n.language === 'ar' ? 'رقم الهاتف غير صالح' : 'Invalid phone number'
    }

    if (formData.child_phone.trim() && !/^\+?[0-9\s-]{8,15}$/.test(formData.child_phone)) {
      errors.child_phone = i18n.language === 'ar' ? 'رقم هاتف الطفل غير صالح' : 'Invalid child phone number'
    }

    if (formData.national_id.trim() && !/^[0-9]{14}$/.test(formData.national_id)) {
      errors.national_id = i18n.language === 'ar' ? 'الرقم القومي يجب أن يتكون من 14 رقماً' : 'National ID must be exactly 14 digits'
    }

    if (formData.price < 0) {
      errors.price = i18n.language === 'ar' ? 'السعر لا يمكن أن يكون سالباً' : 'Price cannot be negative'
    }

    if (!formData.reg_date) {
      errors.reg_date = i18n.language === 'ar' ? 'تاريخ التسجيل مطلوب' : 'Registration date is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      if (isEdit) {
        const patch = {
          name: formData.name.trim(),
          guardian: formData.guardian.trim(),
          guardian_phone: formData.guardian_phone.trim(),
          child_phone: formData.child_phone.trim() || null,
          national_id: formData.national_id.trim() || null,
          service: formData.service,
          unit: formData.unit,
          price: formData.price,
          reg_date: formData.reg_date,
          notes: formData.notes.trim() || null,
        }
        const result = await updateChild(Number(id), patch)
        if (result) {
          navigate('/children')
        }
      } else {
        const childInput = {
          name: formData.name.trim(),
          guardian: formData.guardian.trim(),
          guardian_phone: formData.guardian_phone.trim(),
          child_phone: formData.child_phone.trim() || null,
          national_id: formData.national_id.trim() || null,
          service: formData.service,
          unit: formData.unit,
          price: formData.price,
          reg_date: formData.reg_date,
          notes: formData.notes.trim() || null,
        }
        const result = await addChild(childInput)
        if (result) {
          navigate('/children')
        }
      }
    } catch (err) {
      console.error('Submit child failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Adjust unit choices based on service type
  const unitOptions = formData.service === 'جلسة'
    ? [
        { value: 'جلسة', label: t('units.session') },
        { value: 'يوم', label: t('units.day') },
      ]
    : [
        { value: 'شهر', label: t('units.month') },
        { value: 'يوم', label: t('units.day') },
        { value: 'ساعة', label: t('units.hour') },
      ]

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

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Child Name */}
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

            {/* Guardian Name */}
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

            {/* Guardian Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('guardian_phone')} <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.guardian_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, guardian_phone: e.target.value }))}
                error={formErrors.guardian_phone}
                placeholder={i18n.language === 'ar' ? 'رقم الهاتف المحمول (مثال: 010...)' : 'Phone number (e.g. 010...)'}
              />
            </div>

            {/* Child Phone (Optional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('child_phone')} <span className="text-xs text-slate-400 font-normal">({i18n.language === 'ar' ? 'اختياري' : 'Optional'})</span>
              </label>
              <Input
                value={formData.child_phone}
                onChange={(e) => setFormData((prev) => ({ ...prev, child_phone: e.target.value }))}
                error={formErrors.child_phone}
                placeholder={i18n.language === 'ar' ? 'رقم هاتف الطفل الخاص' : 'Child\'s own phone number'}
              />
            </div>

            {/* National ID (Optional) */}
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

            {/* Registration Date */}
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

            {/* Service Dropdown */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('service')} <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.service}
                onChange={(e) => {
                  const newService = e.target.value as ServiceType
                  // Adjust unit default if switching to session
                  const newUnit = newService === 'جلسة' ? 'جلسة' as UnitType : 'شهر' as UnitType
                  setFormData((prev) => ({ ...prev, service: newService, unit: newUnit }))
                }}
                options={[
                  { value: 'حضانة', label: t('services.nursery') },
                  { value: 'استضافة', label: t('services.hosting') },
                  { value: 'جلسة', label: t('services.session') },
                ]}
              />
            </div>

            {/* Unit Dropdown */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('unit')} <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.unit}
                onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value as UnitType }))}
                options={unitOptions}
              />
            </div>

            {/* Price (Editable, defaulted) */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('price')} (EGP) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))}
                error={formErrors.price}
                min={0}
                placeholder="0.00"
              />
              <span className="text-xs text-slate-400">
                {i18n.language === 'ar'
                  ? 'يتم تعبئة السعر تلقائياً بناءً على إعدادات التسعير الافتراضية، ويمكنك تعديله لهذا الطفل فقط.'
                  : 'Pre-filled from pricing defaults, but customizable for this child.'}
              </span>
            </div>
          </div>

          {/* Notes */}
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

        {/* Buttons */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate('/children')} disabled={isSubmitting}>
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