import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PricingSettings from './PricingSettings.js'
import BrandingSettings from './BrandingSettings.js'
import SecuritySettings from './SecuritySettings.js'

type TabType = 'pricing' | 'branding' | 'security'

export default function Settings() {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>('pricing')

  const tabs = [
    {
      id: 'pricing' as TabType,
      label: i18n.language === 'ar' ? 'التسعير والأهداف' : 'Pricing & Targets',
    },
    {
      id: 'branding' as TabType,
      label: i18n.language === 'ar' ? 'الهوية البصرية' : 'Branding',
    },
    {
      id: 'security' as TabType,
      label: i18n.language === 'ar' ? 'الأمان والمزامنة' : 'Security & Sync',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{t('settings')}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {i18n.language === 'ar'
            ? 'تكوين أسعار الخدمات الافتراضية والحدود الربحية وإعدادات النظام.'
            : 'Configure service rate defaults, targets, and system preferences.'}
        </p>
      </div>

      {/* Tabs list */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 rtl:space-x-reverse" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-all focus:outline-none
                  ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }
                `}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'pricing' && <PricingSettings />}
        
        {activeTab === 'branding' && <BrandingSettings />}
        
        {activeTab === 'security' && <SecuritySettings />}
      </div>
    </div>
  )
}