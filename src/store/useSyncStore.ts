import { create } from 'zustand'

interface PendingCounts {
  children: number
  payments: number
  employees: number
  salary_payments: number
  expenses: number
}

interface SyncStatus {
  connected: boolean
  error: string | null
  uri: string | null
  pending: PendingCounts
  lastSync: { created_at: string; status: string; action: string } | null
}

interface PushPullResults {
  [entityName: string]: { pushed?: number; pulled?: number; skipped?: number; failed?: number }
}

interface SyncState {
  status: SyncStatus | null
  isConnecting: boolean
  isPushing: boolean
  isPulling: boolean
  isLoading: boolean
  lastPushResults: PushPullResults | null
  lastPullResults: PushPullResults | null
  error: string | null
  autoSyncEnabled: boolean
  autoSyncIntervalMinutes: number

  fetchStatus: () => Promise<void>
  connect: (uri: string) => Promise<boolean>
  disconnect: () => Promise<void>
  push: () => Promise<void>
  pull: () => Promise<void>
  setAutoSync: (enabled: boolean, intervalMinutes?: number) => Promise<void>
  clearError: () => void
}

const handleError = (err: any): string => {
  let msg = err.message || 'Sync error'
  if (msg.includes('Error invoking remote method')) {
    msg = msg.replace(/^Error: Error invoking remote method '[^']+': /, '')
  }
  return msg
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: null,
  isConnecting: false,
  isPushing: false,
  isPulling: false,
  isLoading: false,
  lastPushResults: null,
  lastPullResults: null,
  error: null,
  autoSyncEnabled: false,
  autoSyncIntervalMinutes: 30,

  fetchStatus: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.sync.status()
      set({ status: result, isLoading: false })
    } catch (err: any) {
      set({ error: handleError(err), isLoading: false })
    }
  },

  connect: async (uri: string) => {
    set({ isConnecting: true, error: null })
    try {
      await window.api.sync.connect({ uri })
      await get().fetchStatus()
      set({ isConnecting: false })
      return true
    } catch (err: any) {
      set({ error: handleError(err), isConnecting: false })
      return false
    }
  },

  disconnect: async () => {
    try {
      await window.api.sync.disconnect()
      await get().fetchStatus()
    } catch (err: any) {
      set({ error: handleError(err) })
    }
  },

  push: async () => {
    set({ isPushing: true, error: null, lastPushResults: null })
    try {
      const result = await window.api.sync.push()
      set({ lastPushResults: result.results, isPushing: false })
      await get().fetchStatus()
    } catch (err: any) {
      set({ error: handleError(err), isPushing: false })
    }
  },

  pull: async () => {
    set({ isPulling: true, error: null, lastPullResults: null })
    try {
      const result = await window.api.sync.pull()
      set({ lastPullResults: result.results, isPulling: false })
      await get().fetchStatus()
    } catch (err: any) {
      set({ error: handleError(err), isPulling: false })
    }
  },

  setAutoSync: async (enabled: boolean, intervalMinutes = 30) => {
    try {
      await window.api.sync.autoSync({ enabled, intervalMinutes })
      set({ autoSyncEnabled: enabled, autoSyncIntervalMinutes: intervalMinutes })
    } catch (err: any) {
      set({ error: handleError(err) })
    }
  },

  clearError: () => set({ error: null })
}))
