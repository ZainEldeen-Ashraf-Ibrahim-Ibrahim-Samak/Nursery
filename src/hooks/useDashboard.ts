import { useState, useEffect, useCallback } from 'react'
import { friendlyError } from '../utils/errors.js'

export interface ArrearsBreakdown {
  /** Still owed BY families: expected total for the month minus what they have paid. */
  children: number
  /** Still owed TO staff: payroll due for the month minus what has been paid out. */
  salaries: number
  /** The month's expenses (the expenses table has no paid/unpaid split, so all of it counts). */
  expenses: number
}

export interface DashboardKPIs {
  /** What the month should bring in by month end — the full scheduled/expected total. */
  invoiced: number
  /** What has accrued so far (attendance-billed services only accrue as days are attended). */
  billed: number
  collected: number
  /** Every obligation the month still carries — the three parts of `arrearsBreakdown`. */
  arrears: number
  arrearsBreakdown: ArrearsBreakdown
  collectionRate: number
  expensesTotal: number
  /** Payroll actually paid out this month. */
  salariesTotal: number
  /** Payroll owed for this month, whether or not it has been paid. */
  salariesDue: number
  netProfit: number
}

export interface DashboardTarget {
  required: number
  collected: number
  gap: number
  status: 'met' | 'missed'
}

export interface Summary12MonthEntry {
  month: string
  collected: number
  expenses: number
  netProfit: number
  status: 'target_met' | 'target_missed'
}

export interface RevenueByServiceEntry {
  service: string
  collected: number
}

export interface CollectedByMethodEntry {
  method: string
  total: number
}

export interface DashboardAlert {
  type: 'warning' | 'danger' | 'info'
  messageAr: string
  messageEn: string
}

export interface DashboardData {
  kpis: DashboardKPIs
  target: DashboardTarget
  summary12Month: Summary12MonthEntry[]
  revenueByService: RevenueByServiceEntry[]
  collectedByMethod: CollectedByMethodEntry[]
  alerts: DashboardAlert[]
}

export function useDashboard(month: string, year: number) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await window.api.dashboard.get({ month, year })
      setData(result)
    } catch (err: any) {
      console.error('Failed to fetch dashboard:', err)
      const errorMsg = friendlyError(err, 'Failed to fetch dashboard data')
      setError(errorMsg)
    } finally {
      setIsLoading(false)
    }
  }, [month, year])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  return {
    data,
    isLoading,
    error,
    refresh: fetchDashboard,
    clearError: () => setError(null)
  }
}
