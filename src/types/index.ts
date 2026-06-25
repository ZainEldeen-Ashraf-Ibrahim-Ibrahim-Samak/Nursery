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

export interface ServiceEnrollment {
  id: number
  child_id: number
  service: ServiceType
  unit: UnitType
  price: number
  created_at?: string
  updated_at?: string
  synced?: number
}

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
  services?: ServiceEnrollment[]
  reg_date: string
  notes?: string | null
  is_active: number // 0 or 1
  created_at: string
  updated_at: string
  synced: number // 0 or 1

  // Feature 004 — child enrollment enhancements (all optional / additive)
  photo_url?: string | null
  photo_public_id?: string | null
  teacher_id?: number | null
  lesson_days?: number[] | string | null // number[] in the UI; JSON string at rest
  sessions_baseline?: number // default 8
  extra_lessons?: number // default 0
  session_price?: number | null
  monthly_fee?: number | null
}

/** A teacher option, projected from the employees table (feature 004). */
export interface Teacher {
  id: number
  name: string
  role: string
}

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

export interface Payment {
  id: number
  child_id: number
  service_id?: number
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
  // Pro-rating audit (feature 005)
  prorated_calculated?: number | null
}

export interface EmployeeRole {
  id: number
  name: string
  salary_type_id: number | null
  created_at: string
  updated_at: string
  synced: number
}

export type SalaryMode = 'fixed_monthly' | 'per_session_fixed' | 'per_session_pct' | 'hybrid'

export interface SalaryType {
  id: number
  name: string
  mode: SalaryMode
  monthly_rate: number | null
  session_rate: number | null
  session_pct: number | null
  created_at: string
  updated_at: string
  synced: number
}

export interface ServiceDefinition {
  id: number
  name: string
  is_custom: number // 0 = built-in, 1 = custom
  price_monthly: number | null
  price_daily: number | null
  price_hourly: number | null
  created_at: string
  updated_at: string
  synced: number
}

export interface ScheduledSession {
  id: number
  session_date: string
  service_id: number | null
  service_name?: string | null
  group_name: string | null
  notes: string | null
  teachers?: Teacher[]
  created_at: string
  updated_at: string
  synced: number
}

export interface SessionTeacher {
  id: number
  session_id: number
  employee_id: number
  synced: number
}

export type AttendanceStatus = 'attended' | 'absent_excused' | 'absent_unexcused'

export interface AttendanceRecord {
  id: number
  session_id: number
  child_id: number
  child_name?: string
  status: AttendanceStatus
  excuse_notes: string | null
  recorded_by: number | null
  recorded_at: string
  updated_at: string
  synced: number
}

export interface AttendanceConflict {
  id: number
  attendance_record_id: number
  overwritten_status: AttendanceStatus
  overwritten_by: string | null
  overwritten_at: string
  winning_status: AttendanceStatus
  winning_by: string | null
  winning_at: string
  reviewed: number
  created_at: string
}

export interface AttendanceSummary {
  total_sessions: number
  payable_sessions: number
  excused_absences: number
  unexcused_absences: number
  breakdown: { status: string; cnt: number }[]
}

export interface Employee {
  id: number
  name: string
  role: string
  role_id?: number | null
  role_name?: string | null
  salary_type_override_id?: number | null
  base_salary: number
  housing: number
  transport: number
  net_salary: number
  is_active: number // 0 or 1
  created_at: string
  updated_at?: string
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
  updated_at?: string
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
  updated_at?: string
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
    photo_url?: string | null
    teacher_name?: string | null
    monthly_fee?: number | null
  }
  rows: ChildStatementRow[]
  summary: {
    activeMonths: number
    totalInvoiced: number
    totalCollected: number
    totalBalance: number
  }
}
