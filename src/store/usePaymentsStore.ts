import { create } from 'zustand'
import type { Payment } from '../types/index.js'

interface PaymentSummary {
  totalInvoiced: number
  totalCollected: number
  arrears: number
}

interface PaymentsState {
  payments: Payment[]
  summary: PaymentSummary
  isLoading: boolean
  error: string | null
  currentMonth: string
  currentYear: number
  setPeriod: (month: string, year: number) => void
  fetchPayments: () => Promise<void>
  generatePayments: () => Promise<number>
  updatePayment: (args: {
    id: number
    quantity?: number
    paid?: number
    notes?: string
  }) => Promise<Payment | null>
  bulkPay: (ids: number[]) => Promise<number>
  clearError: () => void
}

const arabicMonths = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]

const now = new Date()
const defaultMonth = arabicMonths[now.getMonth()]
const defaultYear = now.getFullYear()

export const usePaymentsStore = create<PaymentsState>((set, get) => ({
  payments: [],
  summary: { totalInvoiced: 0, totalCollected: 0, arrears: 0 },
  isLoading: false,
  error: null,
  currentMonth: defaultMonth,
  currentYear: defaultYear,

  setPeriod: (month, year) => {
    set({ currentMonth: month, currentYear: year })
    get().fetchPayments()
  },

  fetchPayments: async () => {
    set({ isLoading: true, error: null })
    try {
      const month = get().currentMonth
      const year = get().currentYear
      const result = await window.api.payments.get({ month, year })
      set({
        payments: result.payments,
        summary: result.summary,
        isLoading: false,
      })
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to fetch payments'
      if (errorMsg.includes('Error invoking remote method')) {
        errorMsg = errorMsg.replace(/^Error: Error invoking remote method '[^']+':\s*/, '')
      }
      set({ error: errorMsg, isLoading: false })
    }
  },

  generatePayments: async () => {
    set({ isLoading: true, error: null })
    try {
      const month = get().currentMonth
      const year = get().currentYear
      const result = await window.api.payments.generate({ month, year })
      await get().fetchPayments()
      return result.created
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to generate payments'
      if (errorMsg.includes('Error invoking remote method')) {
        errorMsg = errorMsg.replace(/^Error: Error invoking remote method '[^']+':\s*/, '')
      }
      set({ error: errorMsg, isLoading: false })
      return 0
    }
  },

  updatePayment: async ({ id, quantity, paid, notes }) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.payments.update({ id, quantity, paid, notes })
      
      // Update local state directly to prevent full list refetches if possible,
      // but re-calculating the summary locally is cleaner.
      // Let's just update payments and recompute summary locally.
      set((state) => {
        const updatedPayments = state.payments.map((p) => (p.id === id ? result : p))
        
        let totalInvoiced = 0
        let totalCollected = 0
        let arrears = 0
        
        for (const p of updatedPayments) {
          totalInvoiced += p.total
          totalCollected += p.paid
          if (p.balance > 0) {
            arrears += p.balance
          }
        }
        
        return {
          payments: updatedPayments,
          summary: {
            totalInvoiced: Number(totalInvoiced.toFixed(2)),
            totalCollected: Number(totalCollected.toFixed(2)),
            arrears: Number(arrears.toFixed(2)),
          },
          isLoading: false,
        }
      })
      
      return result
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to update payment'
      if (errorMsg.includes('Error invoking remote method')) {
        errorMsg = errorMsg.replace(/^Error: Error invoking remote method '[^']+':\s*/, '')
      }
      set({ error: errorMsg, isLoading: false })
      return null
    }
  },

  bulkPay: async (ids) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.payments.bulkPay({ ids })
      await get().fetchPayments()
      return result.updated
    } catch (err: any) {
      let errorMsg = err.message || 'Failed to process bulk payments'
      if (errorMsg.includes('Error invoking remote method')) {
        errorMsg = errorMsg.replace(/^Error: Error invoking remote method '[^']+':\s*/, '')
      }
      set({ error: errorMsg, isLoading: false })
      return 0
    }
  },

  clearError: () => set({ error: null }),
}))
