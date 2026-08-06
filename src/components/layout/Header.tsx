import * as React from 'react'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useSyncStore } from '../../store/useSyncStore.js'
import { LanguageSwitcher } from './LanguageSwitcher.js'
import { NotificationsBell } from './NotificationsBell.js'
import { Button } from '../ui/Button.js'
import clsx from 'clsx'

export const Header: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const { user, logout } = useAuthStore()

  const { status, fetchStatus, reconnect, push, pull, isPushing, isPulling } = useSyncStore()
  const [localLoading, setLocalLoading] = useState(false)
  const [syncStatusMsg, setSyncStatusMsg] = useState<{ textAr: string; textEn: string; type: 'success' | 'error' | 'info' } | null>(null)
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchStatus().catch(console.error)
  }, [fetchStatus])

  const handleRefresh = async () => {
    if (localLoading || isPushing || isPulling) return

    if (messageTimer.current) {
      clearTimeout(messageTimer.current)
    }
    setSyncStatusMsg(null)
    setLocalLoading(true)

    try {
      let currentStatus = status
      if (!currentStatus) {
        await fetchStatus()
        currentStatus = useSyncStore.getState().status
      }

      if (!currentStatus?.connected) {
        setSyncStatusMsg({
          textAr: 'جاري الاتصال بقاعدة البيانات...',
          textEn: 'Connecting to database...',
          type: 'info',
        })
        const ok = await reconnect()
        if (!ok) {
          throw new Error('Database disconnected. Please check settings / قاعدة البيانات غير متصلة')
        }
      }

      setSyncStatusMsg({
        textAr: 'جاري رفع البيانات (إجباري)...',
        textEn: 'Uploading data (force)...',
        type: 'info',
      })
      await push(true)

      setSyncStatusMsg({
        textAr: 'جاري تنزيل البيانات (إجباري)...',
        textEn: 'Downloading data (force)...',
        type: 'info',
      })
      await pull(true)

      const latestError = useSyncStore.getState().error
      if (latestError) {
        throw new Error(latestError)
      }

      setSyncStatusMsg({
        textAr: 'تمت المزامنة والتحديث بنجاح ✓',
        textEn: 'Sync & refresh completed ✓',
        type: 'success',
      })
    } catch (err: any) {
      console.error('Manual refresh failed:', err)
      setSyncStatusMsg({
        textAr: `فشلت المزامنة: ${err.message || 'خطأ غير معروف'}`,
        textEn: `Sync failed: ${err.message || 'Unknown error'}`,
        type: 'error',
      })
    } finally {
      setLocalLoading(false)
      messageTimer.current = setTimeout(() => {
        setSyncStatusMsg(null)
      }, 4000)
    }
  }

  useEffect(() => {
    return () => {
      if (messageTimer.current) clearTimeout(messageTimer.current)
    }
  }, [])

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
      {/* Welcome Message */}
      <div className="flex flex-col gap-0.5 text-start">
        <h1 className="text-lg font-bold text-slate-800 m-0 p-0 leading-none">
          {t('welcome')}, {user?.name || user?.username}
        </h1>
        <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
          {user?.role === 'admin' ? t('admin') : t('employee')}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {/* Sync Status Message */}
        {syncStatusMsg && (
          <span
            className={clsx(
              "text-xs px-2.5 py-1 rounded-full font-semibold border transition-all duration-300 shadow-sm animate-fade-in",
              {
                "bg-emerald-50 border-emerald-200 text-emerald-700": syncStatusMsg.type === 'success',
                "bg-amber-50 border-amber-200 text-amber-700": syncStatusMsg.type === 'error',
                "bg-sky-50 border-sky-200 text-sky-700": syncStatusMsg.type === 'info',
              }
            )}
          >
            {isAr ? syncStatusMsg.textAr : syncStatusMsg.textEn}
          </span>
        )}

        {/* Force Sync Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={localLoading || isPushing || isPulling}
          title={isAr ? "مزامنة وتحديث إجباري" : "Force Sync & Refresh"}
          className={clsx(
            "p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50 border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5",
            {
              "border-primary text-primary bg-primary/5": localLoading || isPushing || isPulling
            }
          )}
        >
          <svg
            className={clsx("h-5 w-5", {
              "animate-spin": localLoading || isPushing || isPulling,
            })}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2"
            />
          </svg>
        </button>

        {/* Notifications */}
        <NotificationsBell />

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Separator */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Logout Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="text-red-600 border-red-100 hover:bg-red-50 hover:border-red-200 gap-1.5 focus:ring-red-500 font-semibold"
        >
          <svg
            className="h-4.5 w-4.5 transform flip-x-rtl"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>{t('logout')}</span>
        </Button>
      </div>
    </header>
  )
}
