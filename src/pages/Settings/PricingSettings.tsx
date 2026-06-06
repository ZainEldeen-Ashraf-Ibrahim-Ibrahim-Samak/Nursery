import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/ui/Card.js'
import { Input } from '../../components/ui/Input.js'
import { Button } from '../../components/ui/Button.js'
import { Alert } from '../../components/ui/Alert.js'

export default function PricingSettings() {
  const { t, i18n } = useTranslation()

  const [settings, setSettings] = useState({
    nursery_monthly: '0',
    nursery_daily: '0',
    nursery_hourly: '0',
    hosting_monthly: '0',
    hosting_daily: '0',
    hosting_hourly: '0',
    session_hourly: '0',
    session_daily: '0',
    target_profit_pct: '0.20',
    max_capacity: '50',
    work_days: '22',
    work_hours: '8',
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true)
        const data = await window.api.settings.get()
        if (data) {
          setSettings((prev) => ({
            ...prev,
            ...data,
          }))
        }
      } catch (err: any) {
        console.error('Failed to load pricing settings:', err)
        setMessage({
          type: 'danger',
          text: i18n.language === 'ar' ? 'فشل تحميل الإعدادات' : 'Failed to load settings',
        })
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [i18n.language])

  const handleChange = (key: keyof typeof settings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setMessage(null)

    // Validate inputs are non-negative numbers
    for (const [, val] of Object.entries(settings)) {
      const num = Number(val)
      if (isNaN(num) || num < 0) {
        setMessage({
          type: 'danger',
          text:
            i18n.language === 'ar'
              ? 'يرجى إدخال قيم رقمية صالحة وغير سالبة'
              : 'Please enter valid non-negative numeric values',
        })
        setIsSaving(false)
        return
      }
    }

    try {
      const result = await window.api.settings.update(settings)
      if (result && result.ok) {
        setMessage({
          type: 'success',
          text:
            i18n.language === 'ar'
              ? 'تم حفظ إعدادات التسعير بنجاح'
              : 'Pricing settings saved successfully',
        })
      }
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      setMessage({
        type: 'danger',
        text: err.message || (i18n.language === 'ar' ? 'فشل حفظ الإعدادات' : 'Failed to save settings'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {message && (
        <Alert variant={message.type} title={message.type === 'success' ? t('success') : t('error')} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nursery Section */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="text-primary">👶</span> {t('services.nursery')}
          </h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.month')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.nursery_monthly}
                onChange={(e) => handleChange('nursery_monthly', e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.day')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.nursery_daily}
                onChange={(e) => handleChange('nursery_daily', e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.hour')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.nursery_hourly}
                onChange={(e) => handleChange('nursery_hourly', e.target.value)}
                min={0}
              />
            </div>
          </div>
        </Card>

        {/* Hosting Section */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="text-primary">🏠</span> {t('services.hosting')}
          </h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.month')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.hosting_monthly}
                onChange={(e) => handleChange('hosting_monthly', e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.day')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.hosting_daily}
                onChange={(e) => handleChange('hosting_daily', e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.hour')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.hosting_hourly}
                onChange={(e) => handleChange('hosting_hourly', e.target.value)}
                min={0}
              />
            </div>
          </div>
        </Card>

        {/* Sessions Section */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="text-primary">💬</span> {t('services.session')}
          </h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.session')} / {t('units.hour')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.session_hourly}
                onChange={(e) => handleChange('session_hourly', e.target.value)}
                min={0}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {t('units.day')} (EGP)
              </label>
              <Input
                type="number"
                value={settings.session_daily}
                onChange={(e) => handleChange('session_daily', e.target.value)}
                min={0}
              />
            </div>
          </div>
        </Card>

        {/* Targets & Capacities Section */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
            <span className="text-primary">📈</span> {i18n.language === 'ar' ? 'الأهداف والقدرة الاستيعابية' : 'Targets & Capacity'}
          </h2>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {i18n.language === 'ar' ? 'نسبة الربح المستهدفة (مثال: 0.20 للربح 20%)' : 'Target Profit Rate (e.g. 0.20 for 20%)'}
              </label>
              <Input
                type="number"
                step="0.01"
                value={settings.target_profit_pct}
                onChange={(e) => handleChange('target_profit_pct', e.target.value)}
                min={0}
                max={1}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {i18n.language === 'ar' ? 'القدرة الاستيعابية القصوى للأطفال' : 'Maximum Capacity (Children)'}
              </label>
              <Input
                type="number"
                value={settings.max_capacity}
                onChange={(e) => handleChange('max_capacity', e.target.value)}
                min={1}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {i18n.language === 'ar' ? 'أيام العمل في الشهر' : 'Working Days in Month'}
              </label>
              <Input
                type="number"
                value={settings.work_days}
                onChange={(e) => handleChange('work_days', e.target.value)}
                min={1}
                max={31}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                {i18n.language === 'ar' ? 'ساعات العمل اليومية' : 'Daily Working Hours'}
              </label>
              <Input
                type="number"
                value={settings.work_hours}
                onChange={(e) => handleChange('work_hours', e.target.value)}
                min={1}
                max={24}
              />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end pt-4 border-t border-slate-100">
        <Button type="submit" variant="primary" isLoading={isSaving}>
          {t('save')}
        </Button>
      </div>
    </form>
  )
}
