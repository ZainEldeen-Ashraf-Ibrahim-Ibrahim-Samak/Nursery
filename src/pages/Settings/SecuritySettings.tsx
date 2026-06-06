import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useSyncStore } from '../../store/useSyncStore.js'
import { Card } from '../../components/ui/Card.js'
import { Button } from '../../components/ui/Button.js'
import { Input } from '../../components/ui/Input.js'
import { Alert } from '../../components/ui/Alert.js'
import { Badge } from '../../components/ui/Badge.js'

export default function SecuritySettings() {
  const { i18n } = useTranslation()
  const isAr = i18n.language === 'ar'
  const user = useAuthStore((s) => s.user)

  const {
    status,
    isConnecting,
    autoSyncEnabled,
    fetchStatus,
    connect,
    disconnect,
    setAutoSync,
    error: syncError,
    clearError
  } = useSyncStore()

  // ── App password change ──────────────────────────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwSuccess, setPwSuccess] = useState<string | null>(null)

  // ── MongoDB / auto-sync ──────────────────────────────────────────────────
  const [mongoUri, setMongoUri] = useState('')
  const [autoInterval, setAutoInterval] = useState('30')

  useEffect(() => {
    fetchStatus()
  }, [])

  const isConnected = status?.connected ?? false

  const handleChangePassword = async () => {
    setPwError(null)
    setPwSuccess(null)
    if (newPassword.trim().length < 4) {
      setPwError(isAr ? 'كلمة المرور قصيرة جداً (4 أحرف على الأقل).' : 'Password too short (min 4 characters).')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError(isAr ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.')
      return
    }
    if (!user) return
    setPwSaving(true)
    try {
      await window.api.users.update({ id: user.id, password: newPassword })
      setPwSuccess(isAr ? 'تم تغيير كلمة المرور بنجاح.' : 'Password changed successfully.')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: any) {
      let msg = err.message || 'Failed to change password'
      if (msg.includes('Error invoking remote method')) {
        msg = msg.replace(/^Error: Error invoking remote method '[^']+': /, '')
      }
      setPwError(msg)
    } finally {
      setPwSaving(false)
    }
  }

  const handleConnect = async () => {
    if (!mongoUri.trim()) return
    await connect(mongoUri.trim())
  }

  const handleToggleAutoSync = async () => {
    await setAutoSync(!autoSyncEnabled, Number(autoInterval) || 30)
  }

  return (
    <div className="space-y-6">
      {/* App password */}
      <Card className="p-6 space-y-4">
        <div>
          <h2 className="font-bold text-slate-800">{isAr ? 'كلمة مرور التطبيق' : 'App Password'}</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'تغيير كلمة المرور الخاصة بحسابك الحالي.'
              : 'Change the password for your current account.'}
          </p>
        </div>

        {pwError && <Alert variant="danger">{pwError}</Alert>}
        {pwSuccess && <Alert variant="success">{pwSuccess}</Alert>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          <Input
            type="password"
            label={isAr ? 'كلمة المرور الجديدة' : 'New Password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            type="password"
            label={isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button onClick={handleChangePassword} disabled={pwSaving}>
          {pwSaving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : isAr ? 'تغيير كلمة المرور' : 'Change Password'}
        </Button>
      </Card>

      {/* MongoDB connection */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">{isAr ? 'قاعدة البيانات السحابية (MongoDB)' : 'Cloud Database (MongoDB)'}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {isAr
                ? 'رابط الاتصال بقاعدة بيانات MongoDB للمزامنة السحابية.'
                : 'MongoDB connection URI used for cloud synchronization.'}
            </p>
          </div>
          <Badge variant={isConnected ? 'success' : 'neutral'}>
            {isConnected ? (isAr ? 'متصل' : 'Connected') : isAr ? 'غير متصل' : 'Disconnected'}
          </Badge>
        </div>

        {syncError && (
          <Alert variant="danger" onClose={clearError}>
            {syncError}
          </Alert>
        )}

        <div className="flex items-end gap-3 max-w-2xl">
          <div className="flex-1">
            <Input
              type="text"
              label={isAr ? 'رابط الاتصال' : 'Connection URI'}
              value={mongoUri}
              onChange={(e) => setMongoUri(e.target.value)}
              placeholder="mongodb+srv://user:pass@cluster.mongodb.net/db"
            />
          </div>
          {isConnected ? (
            <Button variant="secondary" onClick={disconnect}>
              {isAr ? 'قطع الاتصال' : 'Disconnect'}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={isConnecting || !mongoUri.trim()}>
              {isConnecting ? (isAr ? 'جارٍ الاتصال...' : 'Connecting...') : isAr ? 'اتصال' : 'Connect'}
            </Button>
          )}
        </div>
        {status?.uri && (
          <p className="text-xs text-slate-400">
            {isAr ? 'رابط محفوظ:' : 'Saved URI:'} {status.uri}
          </p>
        )}
      </Card>

      {/* Auto-sync */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-800">{isAr ? 'المزامنة التلقائية' : 'Auto-Sync'}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {isAr
                ? 'دفع السجلات غير المتزامنة تلقائياً على فترات منتظمة.'
                : 'Automatically push unsynced records on a regular interval.'}
            </p>
          </div>
          <Badge variant={autoSyncEnabled ? 'success' : 'neutral'}>
            {autoSyncEnabled ? (isAr ? 'مفعّل' : 'Active') : isAr ? 'موقف' : 'Off'}
          </Badge>
        </div>

        <div className="flex items-end gap-3 max-w-md">
          <div className="w-40">
            <Input
              type="number"
              label={isAr ? 'الفترة (دقائق)' : 'Interval (minutes)'}
              value={autoInterval}
              onChange={(e) => setAutoInterval(e.target.value)}
              min={1}
            />
          </div>
          <Button variant={autoSyncEnabled ? 'secondary' : 'primary'} onClick={handleToggleAutoSync}>
            {autoSyncEnabled ? (isAr ? 'إيقاف' : 'Disable') : isAr ? 'تفعيل' : 'Enable'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
