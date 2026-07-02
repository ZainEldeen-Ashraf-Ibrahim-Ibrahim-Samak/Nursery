import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Auth & Users
  auth: {
    login: (args: any) => ipcRenderer.invoke('auth:login', args),
    logout: () => ipcRenderer.invoke('auth:logout'),
    current: () => ipcRenderer.invoke('auth:current'),
    restore: (args: { token: string }) => ipcRenderer.invoke('auth:restore', args),
  },
  users: {
    list: () => ipcRenderer.invoke('users:list'),
    create: (args: any) => ipcRenderer.invoke('users:create', args),
    update: (args: any) => ipcRenderer.invoke('users:update', args),
    deactivate: (args: any) => ipcRenderer.invoke('users:deactivate', args),
    delete: (args: any) => ipcRenderer.invoke('users:delete', args),
  },
  
  // Children
  children: {
    get: (args: any) => ipcRenderer.invoke('children:get', args),
    add: (args: any) => ipcRenderer.invoke('children:add', args),
    update: (args: any) => ipcRenderer.invoke('children:update', args),
    deactivate: (args: any) => ipcRenderer.invoke('children:deactivate', args),
    statement: (args: { childId: number }) => ipcRenderer.invoke('children:statement', args),
  },
  childServices: {
    list: (args: { childId: number }) => ipcRenderer.invoke('childServices:list', args),
    add: (args: any) => ipcRenderer.invoke('childServices:add', args),
    update: (args: any) => ipcRenderer.invoke('childServices:update', args),
    remove: (args: { id: number }) => ipcRenderer.invoke('childServices:remove', args),
    previewTeacherCost: (teacher_id: number, lesson_days: number[]) =>
      ipcRenderer.invoke('childServices:previewTeacherCost', { teacher_id, lesson_days }) as Promise<{ remaining_sessions: number; expected_cost: number; teacher_session_rate: number }>,
  },

  // Service Teachers
  serviceTeachers: {
    list: (service_id: number) => ipcRenderer.invoke('serviceTeachers:list', { service_id }),
    set: (service_id: number, employee_ids: number[]) => ipcRenderer.invoke('serviceTeachers:set', { service_id, employee_ids }),
  },

  // Teacher Payments
  teacherPayments: {
    list: (filters: { teacher_id?: number; child_id?: number; month?: number; year?: number }) =>
      ipcRenderer.invoke('teacherPayments:list', filters),
    markPaid: (ids: number[]) => ipcRenderer.invoke('teacherPayments:markPaid', { ids }) as Promise<{ ok: boolean; updated: number }>,
  },

  // Payroll
  payroll: {
    report: (month: number, year: number) => ipcRenderer.invoke('payroll:report', { month, year }),
  },
  teachers: {
    list: (args?: { role?: string }) => ipcRenderer.invoke('teachers:list', args),
  },

  // Payments
  payments: {
    get: (args: any) => ipcRenderer.invoke('payments:get', args),
    generate: (args: any) => ipcRenderer.invoke('payments:generate', args),
    update: (args: any) => ipcRenderer.invoke('payments:update', args),
    bulkPay: (args: any) => ipcRenderer.invoke('payments:bulkPay', args),
    listTransactions: (payment_id: number) => ipcRenderer.invoke('payments:listTransactions', { payment_id }),
    addTransaction: (args: { payment_id: number; amount: number; payment_method_id?: number | null; paid_date?: string | null; notes?: string | null }) => ipcRenderer.invoke('payments:addTransaction', args),
    deleteTransaction: (id: number) => ipcRenderer.invoke('payments:deleteTransaction', { id }),
    deleteForChild: (args: { child_id: number; month: string; year: number }) => ipcRenderer.invoke('payments:deleteForChild', args),
  },

  // Salaries
  employees: {
    get: () => ipcRenderer.invoke('employees:get'),
    add: (args: any) => ipcRenderer.invoke('employees:add', args),
    update: (args: any) => ipcRenderer.invoke('employees:update', args),
    deactivate: (args: any) => ipcRenderer.invoke('employees:deactivate', args),
  },
  salary: {
    get: (args: any) => ipcRenderer.invoke('salary:get', args),
    update: (args: any) => ipcRenderer.invoke('salary:update', args),
  },

  // Expenses
  expenses: {
    get: (args: any) => ipcRenderer.invoke('expenses:get', args),
    update: (args: any) => ipcRenderer.invoke('expenses:update', args),
    addItem: (args: any) => ipcRenderer.invoke('expenses:addItem', args),
    removeItem: (args: any) => ipcRenderer.invoke('expenses:removeItem', args),
  },

  // Dashboard / Target
  dashboard: {
    get: (args: any) => ipcRenderer.invoke('dashboard:get', args),
  },
  target: {
    get: (args: any) => ipcRenderer.invoke('target:get', args),
    calc: (args: any) => ipcRenderer.invoke('target:calc', args),
    capacityPlan: (args: any) => ipcRenderer.invoke('target:capacity-plan', args),
  },

  // Settings & Branding
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (args: any) => ipcRenderer.invoke('settings:update', args),
  },
  branding: {
    get: () => ipcRenderer.invoke('branding:get'),
    save: (args: any) => ipcRenderer.invoke('branding:save', args),
    uploadLogo: () => ipcRenderer.invoke('branding:upload-logo'),
    uploadIcon: () => ipcRenderer.invoke('branding:upload-icon'),
    reset: () => ipcRenderer.invoke('branding:reset'),
  },

  // Export
  export: {
    full: (args: any) => ipcRenderer.invoke('export:full', args),
    month: (args: any) => ipcRenderer.invoke('export:month', args),
    child: (args: any) => ipcRenderer.invoke('export:child', args),
    salaries: (args: any) => ipcRenderer.invoke('export:salaries', args),
    expenses: (args: any) => ipcRenderer.invoke('export:expenses', args),
    employees: (args: any) => ipcRenderer.invoke('export:employees', args),
  },

  // Storage
  storage: {
    stats: () => ipcRenderer.invoke('storage:stats'),
    backup: () => ipcRenderer.invoke('storage:backup'),
    restore: (args: any) => ipcRenderer.invoke('storage:restore', args),
    import: (args: any) => ipcRenderer.invoke('storage:import', args),
    clear: (args: any) => ipcRenderer.invoke('storage:clear', args),
    audit: () => ipcRenderer.invoke('storage:audit'),
    uploadPhoto: (args: { dataUrl: string; folder?: string }) =>
      ipcRenderer.invoke('storage:uploadPhoto', args),
  },

  // Sync
  sync: {
    connect: (args: { uri: string }) => ipcRenderer.invoke('sync:connect', args),
    reconnect: () => ipcRenderer.invoke('sync:reconnect'),
    disconnect: () => ipcRenderer.invoke('sync:disconnect'),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    status: () => ipcRenderer.invoke('sync:status'),
    autoSync: (args: { enabled: boolean; intervalMinutes?: number }) =>
      ipcRenderer.invoke('sync:auto-sync', args),
  },

  // Roles
  roles: {
    list: () => ipcRenderer.invoke('roles:list'),
    add: (args: { name: string }) => ipcRenderer.invoke('roles:add', args),
    update: (args: { id: number; patch: { name?: string; salary_type_id?: number | null } }) => ipcRenderer.invoke('roles:update', args),
    delete: (args: { id: number }) => ipcRenderer.invoke('roles:delete', args),
  },

  // Salary Types
  salaryTypes: {
    list: () => ipcRenderer.invoke('salaryTypes:list'),
    add: (args: any) => ipcRenderer.invoke('salaryTypes:add', args),
    update: (args: { id: number; patch: any }) => ipcRenderer.invoke('salaryTypes:update', args),
    delete: (args: { id: number }) => ipcRenderer.invoke('salaryTypes:delete', args),
  },

  // Service Definitions
  serviceDefinitions: {
    list: () => ipcRenderer.invoke('serviceDefinitions:list'),
    add: (args: any) => ipcRenderer.invoke('serviceDefinitions:add', args),
    update: (args: { id: number; patch: any }) => ipcRenderer.invoke('serviceDefinitions:update', args),
    delete: (args: { id: number }) => ipcRenderer.invoke('serviceDefinitions:delete', args),
  },

  // Sessions
  sessions: {
    list: (args?: { from?: string; to?: string }) => ipcRenderer.invoke('sessions:list', args),
    add: (args: any) => ipcRenderer.invoke('sessions:add', args),
    update: (id: number, patch: any) => ipcRenderer.invoke('sessions:update', { id, patch }),
    delete: (id: number) => ipcRenderer.invoke('sessions:delete', { id }),
    assignTeachers: (session_id: number, employee_ids: number[]) => ipcRenderer.invoke('sessions:assignTeachers', { session_id, employee_ids }),
    salaryCredit: (session_id: number) => ipcRenderer.invoke('sessions:salaryCredit', { session_id }) as Promise<{ payable: boolean; hasTeachers: boolean; credits: { employee_id: number; name: string; amount: number }[] }>,
    proRateCalc: (args: { reg_date: string; price_per_session: number }) => ipcRenderer.invoke('sessions:proRateCalc', args),
    childrenForDay: (day_of_week: number) => ipcRenderer.invoke('sessions:childrenForDay', { day_of_week }),
  },

  // Attendance
  attendance: {
    getSheet: (sessionId: number) => ipcRenderer.invoke('attendance:getSheet', { session_id: sessionId }),
    record: (sessionId: number, records: any[]) => ipcRenderer.invoke('attendance:record', { session_id: sessionId, records }),
    delete: (sessionId: number, child_ids: (number | { child_id: number; teacher_id: number | null })[]) =>
      ipcRenderer.invoke('attendance:delete', { session_id: sessionId, child_ids }) as Promise<{ ok: boolean; deleted: number }>,
    getConflicts: () => ipcRenderer.invoke('attendance:getConflicts'),
    resolveConflict: (conflict_id: number, final_status: string) => ipcRenderer.invoke('attendance:resolveConflict', { conflict_id, final_status }),
    getSummary: (employee_id: number, month: string, year: number) => ipcRenderer.invoke('attendance:getSummary', { employee_id, month, year }),
    getChildHistory: (child_id: number) => ipcRenderer.invoke('attendance:getChildHistory', { child_id }),
  },

  // Employee Deductions
  deductions: {
    list: (args: { employee_id: number; month: string; year: number }) => ipcRenderer.invoke('deductions:list', args),
    add: (args: { employee_id: number; month: string; year: number; reason: string; amount: number }) => ipcRenderer.invoke('deductions:add', args),
    remove: (args: { id: number }) => ipcRenderer.invoke('deductions:remove', args),
  },

  // Payment Methods
  paymentMethods: {
    list: () => ipcRenderer.invoke('paymentMethods:list'),
    add: (args: { name: string }) => ipcRenderer.invoke('paymentMethods:add', args),
    update: (args: { id: number; patch: any }) => ipcRenderer.invoke('paymentMethods:update', args),
    delete: (args: { id: number }) => ipcRenderer.invoke('paymentMethods:delete', args),
  },

  // Auto-Updater
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    install: () => ipcRenderer.invoke('updater:install'),
    openReleasePage: () => ipcRenderer.invoke('updater:open-release-page'),
    onStatusChange: (
      callback: (payload: {
        event: 'checking-for-update' | 'update-available' | 'update-not-available' | 'error' | 'download-progress' | 'update-downloaded'
        info?: any
        error?: string
        errorCode?: 'rate_limit' | 'network' | 'unknown'
        progress?: { percent: number; bytesPerSecond: number; transferred: number; total: number }
      }) => void
    ) => {
      const handler = (_e: unknown, payload: any) => callback(payload)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    }
  },

  /**
   * Subscribe to long-running operation progress (push/pull/import/backup/restore).
   * Returns an unsubscribe function. Payload: { op, phase, current, total, percent }.
   */
  onProgress: (
    callback: (payload: {
      op: 'push' | 'pull' | 'import' | 'backup' | 'restore'
      phase: string
      current: number
      total: number
      percent: number
    }) => void
  ) => {
    const handler = (_e: unknown, payload: any) => callback(payload)
    ipcRenderer.on('progress:update', handler)
    return () => ipcRenderer.removeListener('progress:update', handler)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
