import { create } from 'zustand'
import { friendlyError } from '../utils/errors.js'
import type { DailyPayment } from '../types/index.js'

interface PaymentSummary {
  totalInvoiced: number
  totalCollected: number
  arrears: number
}

interface DailyPaymentsState {
  payments: DailyPayment[]
  byChild: any[]
  summary: PaymentSummary
  isLoading: boolean
  error: string | null
  currentDate: string
  setDate: (date: string) => void
  fetchDailyPayments: () => Promise<void>
  generateDailyPayments: () => Promise<number>
  updateDailyPayment: (args: {
    id: number
    quantity?: number
    paid?: number
    notes?: string
    payment_method_id?: number | null
  }) => Promise<DailyPayment | null>
  bulkPay: (ids: number[], payment_method_id?: number | null) => Promise<number>
  deleteForChild: (child_id: number) => Promise<boolean>
  deleteSelected: (ids: number[]) => Promise<number>
  deleteAll: () => Promise<number>
  clearError: () => void
}

const today = new Date().toISOString().split('T')[0]

export const useDailyPaymentsStore = create<DailyPaymentsState>((set, get) => ({
  payments: [],
  byChild: [],
  summary: { totalInvoiced: 0, totalCollected: 0, arrears: 0 },
  isLoading: false,
  error: null,
  currentDate: today,

  setDate: (date: string) => {
    set({ currentDate: date })
    get().fetchDailyPayments()
  },

  clearError: () => set({ error: null }),

  fetchDailyPayments: async () => {
    try {
      set({ isLoading: true, error: null })
      const data = await window.api.dailyPayments.get({
        billing_date: get().currentDate
      })
      set({
        payments: data.payments,
        byChild: data.byChild,
        summary: data.summary,
        isLoading: false
      })
    } catch (error: any) {
      set({ error: friendlyError(error), isLoading: false })
    }
  },

  generateDailyPayments: async () => {
    try {
      set({ isLoading: true, error: null })
      const res = await window.api.dailyPayments.generate({
        billing_date: get().currentDate
      })
      await get().fetchDailyPayments()
      return res.created
    } catch (error: any) {
      set({ error: friendlyError(error), isLoading: false })
      throw error
    }
  },

  updateDailyPayment: async (args) => {
    try {
      set({ error: null })
      const updated = await window.api.dailyPayments.update(args)
      
      // We do a full refetch so byChild and summary update correctly
      await get().fetchDailyPayments()
      
      return updated
    } catch (error: any) {
      set({ error: friendlyError(error) })
      return null
    }
  },

  bulkPay: async (ids, payment_method_id) => {
    try {
      set({ isLoading: true, error: null })
      const res = await window.api.dailyPayments.bulkPay({ ids, payment_method_id })
      await get().fetchDailyPayments()
      return res.updated
    } catch (error: any) {
      set({ error: friendlyError(error), isLoading: false })
      throw error
    }
  },

  deleteForChild: async (child_id) => {
    try {
      set({ isLoading: true, error: null })
      await window.api.dailyPayments.deleteForChild({ child_id, billing_date: get().currentDate })
      await get().fetchDailyPayments()
      return true
    } catch (error: any) {
      set({ error: friendlyError(error), isLoading: false })
      return false
    }
  },

  deleteSelected: async (ids) => {
    try {
      set({ isLoading: true, error: null })
      const res = await window.api.dailyPayments.deleteBulk({ ids })
      await get().fetchDailyPayments()
      return res.deleted
    } catch (error: any) {
      set({ error: friendlyError(error), isLoading: false })
      throw error
    }
  },

  deleteAll: async () => {
    try {
      set({ isLoading: true, error: null })
      const res = await window.api.dailyPayments.deleteAll({ billing_date: get().currentDate })
      await get().fetchDailyPayments()
      return res.deleted
    } catch (error: any) {
      set({ error: friendlyError(error), isLoading: false })
      throw error
    }
  }
}))
