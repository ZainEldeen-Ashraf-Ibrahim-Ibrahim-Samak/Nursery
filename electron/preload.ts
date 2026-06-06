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
  },
  
  // Children
  children: {
    get: (args: any) => ipcRenderer.invoke('children:get', args),
    add: (args: any) => ipcRenderer.invoke('children:add', args),
    update: (args: any) => ipcRenderer.invoke('children:update', args),
    deactivate: (args: any) => ipcRenderer.invoke('children:deactivate', args),
    statement: (args: { childId: number }) => ipcRenderer.invoke('children:statement', args),
  },

  // Payments
  payments: {
    get: (args: any) => ipcRenderer.invoke('payments:get', args),
    generate: (args: any) => ipcRenderer.invoke('payments:generate', args),
    update: (args: any) => ipcRenderer.invoke('payments:update', args),
    bulkPay: (args: any) => ipcRenderer.invoke('payments:bulkPay', args),
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
  },

  // Storage
  storage: {
    stats: () => ipcRenderer.invoke('storage:stats'),
    backup: () => ipcRenderer.invoke('storage:backup'),
    restore: (args: any) => ipcRenderer.invoke('storage:restore', args),
    import: (args: any) => ipcRenderer.invoke('storage:import', args),
    clear: (args: any) => ipcRenderer.invoke('storage:clear', args),
    audit: () => ipcRenderer.invoke('storage:audit'),
  },

  // Sync
  sync: {
    connect: (args: { uri: string }) => ipcRenderer.invoke('sync:connect', args),
    disconnect: () => ipcRenderer.invoke('sync:disconnect'),
    push: () => ipcRenderer.invoke('sync:push'),
    pull: () => ipcRenderer.invoke('sync:pull'),
    status: () => ipcRenderer.invoke('sync:status'),
    autoSync: (args: { enabled: boolean; intervalMinutes?: number }) =>
      ipcRenderer.invoke('sync:auto-sync', args),
  }
}

contextBridge.exposeInMainWorld('api', api)

export type WindowApi = typeof api
