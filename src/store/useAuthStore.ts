import { create } from 'zustand'
import type { User } from '../types/index.js'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  checkCurrent: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  
  login: async (username, password) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.auth.login({ username, password })
      set({
        user: result.user,
        token: result.token,
        isAuthenticated: true,
        isLoading: false,
      })
      return true
    } catch (err: any) {
      // Extract the raw message if wrapped by Electron IPC
      let errorMsg = err.message || 'Login failed'
      if (errorMsg.includes('Error invoking remote method')) {
        errorMsg = errorMsg.replace(/^Error: Error invoking remote method '[^']+':\s*/, '')
      }
      set({ error: errorMsg, isLoading: false })
      return false
    }
  },
  
  logout: async () => {
    set({ isLoading: true })
    try {
      await window.api.auth.logout()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    }
  },
  
  checkCurrent: async () => {
    set({ isLoading: true })
    try {
      const result = await window.api.auth.current()
      if (result && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        })
      } else {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      }
    } catch (err) {
      console.error('Check current session failed:', err)
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      })
    }
  },
  
  clearError: () => set({ error: null })
}))
