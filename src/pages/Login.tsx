import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/useAuthStore.js'
import { Input } from '../components/ui/Input.js'
import { Button } from '../components/ui/Button.js'
import { Alert } from '../components/ui/Alert.js'
import { AppLogo } from '../components/ui/AppLogo.js'
import { LanguageSwitcher } from '../components/layout/LanguageSwitcher.js'

export default function Login() {
  const { t } = useTranslation()
  const { login, isLoading, error, clearError } = useAuthStore()
  
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError('')
    clearError()

    if (!username.trim()) {
      setValidationError(
        t('i18n_username_required', {
          defaultValue: 'اسم المستخدم مطلوب / Username is required',
        })
      )
      return
    }

    if (!password) {
      setValidationError(
        t('i18n_password_required', {
          defaultValue: 'كلمة المرور مطلوبة / Password is required',
        })
      )
      return
    }

    await login(username.trim(), password)
  }

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-slate-50 px-4 relative">
      {/* Top Floating Language Switcher */}
      <div className="absolute top-6 left-6 right-6 flex justify-end">
        <LanguageSwitcher />
      </div>

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden p-8 flex flex-col items-center gap-6">
        {/* Branding Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <AppLogo className="w-16 h-16 text-2xl" />
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-slate-800 m-0 leading-tight">
              {t('app_name')}
            </h2>
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
              نظام الإدارة الماليّة / Management System
            </span>
          </div>
        </div>

        {/* Login Title */}
        <div className="w-full text-center border-b border-slate-100 pb-4">
          <h3 className="text-lg font-bold text-slate-700 m-0">
            {t('login')}
          </h3>
        </div>

        {/* Feedback Messages */}
        {(validationError || error) && (
          <div className="w-full">
            <Alert variant="danger" onClose={() => { setValidationError(''); clearError(); }}>
              {validationError || error}
            </Alert>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-5">
          <Input
            id="username-input"
            label={t('username')}
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin / employee"
            disabled={isLoading}
            autoFocus
          />

          <Input
            id="password-input"
            label={t('password')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={isLoading}
          />

          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            className="w-full py-2.5 mt-2 font-bold shadow-md shadow-primary/10"
          >
            {t('login')}
          </Button>
        </form>
      </div>

      {/* Footer copyright */}
      <div className="mt-8 text-center text-xs text-slate-400 font-medium select-none">
        © {new Date().getFullYear()} {t('app_name')}. جميع الحقوق محفوظة. / All rights reserved.
      </div>
    </div>
  )
}