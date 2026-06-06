export type UserRole = 'admin' | 'employee'

export interface User {
  id: number
  username: string
  role: UserRole
  name?: string | null
  is_active: number // 0 or 1
  created_at?: string
}

export type ServiceType = 'حضانة' | 'استضافة' | 'جلسة'
export type UnitType = 'شهر' | 'يوم' | 'ساعة' | 'جلسة'

export interface Child {
  id: number
  name: string
  guardian: string
  guardian_phone: string
  child_phone?: string | null
  national_id?: string | null
  service: ServiceType
  unit: UnitType
  price: number
  reg_date: string
  notes?: string | null
  is_active: number // 0 or 1
  created_at: string
  updated_at: string
  synced: number // 0 or 1
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export interface Payment {
  id: number
  child_id: number
  month: string // Arabic month name
  year: number
  service: string
  unit: string
  quantity: number
  price: number
  total: number
  paid: number
  balance: number
  status: PaymentStatus
  notes?: string | null
  created_at: string
  updated_at: string
  synced: number // 0 or 1
  
  // Optional join field for UI
  child_name?: string
}

export interface Employee {
  id: number
  name: string
  role: string
  base_salary: number
  housing: number
  transport: number
  net_salary: number
  is_active: number // 0 or 1
  created_at: string
  synced: number // 0 or 1
}

export interface SalaryPayment {
  id: number
  employee_id: number
  month: string // Arabic month name
  year: number
  bonus: number
  deductions: number
  actual_paid: number
  paid_date?: string | null
  notes?: string | null
  synced: number // 0 or 1
  
  // Optional join fields for UI
  employee_name?: string
  employee_role?: string
  net_salary?: number
}

export interface Expense {
  id: number
  item: string
  month: string // Arabic month name
  year: number
  amount: number
  category?: string | null
  notes?: string | null
  created_at: string
  synced: number // 0 or 1
}

export interface Setting {
  key: string
  value: string
}

export type SyncAction = 'push' | 'pull'
export type SyncStatus = 'ok' | 'error'

export interface SyncLog {
  id: number
  action: SyncAction
  table_name: string
  record_id: number
  status: SyncStatus
  error?: string | null
  synced_at: string
}

export interface ChildStatementRow {
  month: string
  year: number
  service: string
  unit: string
  quantity: number
  price: number
  total: number
  paid: number
  balance: number
  status: PaymentStatus
  notes: string
}

export interface ChildStatement {
  child: {
    id: number
    name: string
    guardian: string
    guardian_phone: string
    service: string
    unit: string
    price: number
    reg_date: string
    is_active: number
  }
  rows: ChildStatementRow[]
  summary: {
    activeMonths: number
    totalInvoiced: number
    totalCollected: number
    totalBalance: number
  }
}
