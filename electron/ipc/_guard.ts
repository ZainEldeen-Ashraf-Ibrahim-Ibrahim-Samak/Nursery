import { getCurrentUser } from './authIPC.js'

export function requireAdmin(): void {
  const user = getCurrentUser()
  if (!user) {
    throw new Error('UNAUTHORIZED: يجب تسجيل الدخول أولاً / Unauthorized')
  }
  if (user.role !== 'admin') {
    throw new Error('FORBIDDEN: غير مسموح بالوصول لغير المسؤولين / Forbidden')
  }
}
